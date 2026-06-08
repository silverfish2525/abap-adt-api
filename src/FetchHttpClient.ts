import { Buffer } from "buffer"
import https from "https"
import makeFetchCookie from "fetch-cookie"
import { CookieJar } from "tough-cookie"
import { Agent as UndiciAgent } from "undici"
import { ClientOptions, HttpClient } from "."
import {
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse,
  ResponseHeaders
} from "./AdtHTTP"
import { hasMessage, isString } from "./utilities"

const buildUrl = (baseURL: string, options: HttpClientOptions): URL => {
  const url = new URL(options.url, options.baseURL || baseURL)
  if (options.qs) {
    for (const [key, raw] of Object.entries(options.qs)) {
      if (raw === undefined || raw === null) continue
      if (Array.isArray(raw)) {
        raw.forEach(value => url.searchParams.append(key, String(value)))
      } else {
        url.searchParams.append(key, String(raw))
      }
    }
  }
  return url
}

const normalizeBody = (body: unknown) => {
  if (body === undefined || body === null) return undefined
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return body
  if (isString(body)) return body
  return JSON.stringify(body)
}

const headersToResponseHeaders = (headers: Headers): ResponseHeaders => {
  const responseHeaders: ResponseHeaders = {}
  headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[]
  }
  if (typeof withGetSetCookie.getSetCookie === "function") {
    const setCookie = withGetSetCookie.getSetCookie()
    if (setCookie.length) responseHeaders["set-cookie"] = setCookie
  }

  return responseHeaders
}

const dispatcherFromHttpsAgent = (agent: https.Agent): UndiciAgent => {
  const opts = (agent.options ?? {}) as {
    rejectUnauthorized?: boolean
    ca?: string | Buffer | Array<string | Buffer>
    keepAlive?: boolean
  }
  return new UndiciAgent({
    connect: {
      rejectUnauthorized: opts.rejectUnauthorized,
      ca: opts.ca
    },
    keepAliveTimeout: opts.keepAlive ? 60_000 : undefined
  })
}

export class FetchHttpClient implements HttpClient {
  private readonly cookieJar = new CookieJar()
  private readonly fetchWithCookies: typeof fetch
  private readonly clientDispatcher?: UndiciAgent

  constructor(
    private readonly baseURL: string,
    private readonly config?: ClientOptions
  ) {
    if (config?.httpsAgent) {
      this.clientDispatcher = dispatcherFromHttpsAgent(config.httpsAgent)
    }
    this.fetchWithCookies = makeFetchCookie(
      fetch,
      this.cookieJar
    ) as unknown as typeof fetch
  }

  private buildHeaders(options: HttpClientOptions): Record<string, string> {
    const merged: Record<string, string> = {}
    const inputs = [this.config?.headers, options.headers]

    for (const source of inputs) {
      if (!source) continue
      for (const [key, value] of Object.entries(source)) {
        merged[key] = value
      }
    }

    if (!merged.Authorization && options.auth) {
      const token = Buffer.from(
        `${options.auth.username}:${options.auth.password}`,
        "utf8"
      ).toString("base64")
      merged.Authorization = `Basic ${token}`
    }

    return merged
  }

  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    const controller = new AbortController()
    const timeout = options.timeout ?? this.config?.timeout
    const timeoutId =
      timeout && timeout > 0
        ? setTimeout(() => controller.abort("Request timed out"), timeout)
        : undefined

    const url = buildUrl(this.baseURL, options)
    const method = options.method || "GET"
    const body = normalizeBody(
      (options as HttpClientOptions & { body?: unknown }).body
    )
    const headers = this.buildHeaders(options)
    const requestHttpsAgent = options.httpsAgent
    const dispatcher = requestHttpsAgent
      ? dispatcherFromHttpsAgent(requestHttpsAgent)
      : this.clientDispatcher

    try {
      const response = await this.fetchWithCookies(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
        // fetch-cookie handles redirects internally (with cross-origin
        // Authorization/Cookie stripping built in) and tough-cookie
        // enforces RFC 6265 scope, expiry, and Secure correctness.
        redirect: "follow",
        ...(dispatcher ? { dispatcher } : {})
      } as RequestInit)

      return {
        body: await response.text(),
        status: response.status,
        statusText: response.statusText,
        headers: headersToResponseHeaders(response.headers),
        request: options
      }
    } catch (error) {
      if (error instanceof HttpClientException) throw error

      // fetch-cookie throws TypeError("Reached maximum redirect of N for URL: …")
      // when its built-in redirect cap is hit. Map that back to the documented code.
      if (
        error instanceof TypeError &&
        typeof error.message === "string" &&
        error.message.startsWith("Reached maximum redirect")
      ) {
        throw new HttpClientException(
          "Maximum redirects exceeded",
          "ERR_FR_TOO_MANY_REDIRECTS",
          undefined,
          this.config,
          options,
          undefined,
          error
        )
      }

      const aborted = controller.signal.aborted
      const message = aborted
        ? `timeout of ${timeout}ms exceeded`
        : hasMessage(error)
          ? error.message
          : "Unknown error in HTTP client"

      throw new HttpClientException(
        message,
        aborted ? "ECONNABORTED" : undefined,
        undefined,
        this.config,
        options,
        undefined,
        error
      )
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}
