import http, { IncomingMessage, ServerResponse } from "http"
import { AddressInfo } from "net"
import { afterEach, describe, expect, test } from "vitest"
import { HttpClientException } from "./AdtHTTP"
import { FetchHttpClient } from "./FetchHttpClient"

type TestServer = {
  url: string
  close: () => Promise<void>
}

type Handler = (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>
) => void

const servers: http.Server[] = []

const startServer = async (handler: Handler): Promise<TestServer> => {
  const server = http.createServer(handler)
  servers.push(server)

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve())
    server.once("error", reject)
  })

  const address = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()))
      })
    }
  }
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve()
            return
          }
          server.close(error => (error ? reject(error) : resolve()))
        })
    )
  )
})

describe("FetchHttpClient cookies and redirects", () => {
  test("captures and re-sends a single Set-Cookie header", async () => {
    const seenCookies: Array<string | undefined> = []
    const server = await startServer((req, res) => {
      if (req.url === "/set") {
        res.setHeader("Set-Cookie", "sid=abc; Path=/")
        res.end("ok")
        return
      }

      if (req.url === "/check") {
        seenCookies.push(req.headers.cookie)
        res.end("done")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)
    await client.request({ url: "/set" })
    await client.request({ url: "/check" })

    expect(seenCookies).toEqual(["sid=abc"])
  })

  test("captures and re-sends multiple Set-Cookie headers", async () => {
    const seenCookies: Array<string | undefined> = []
    const server = await startServer((req, res) => {
      if (req.url === "/set") {
        res.setHeader("Set-Cookie", ["a=1; Path=/", "b=2; Path=/"])
        res.end("ok")
        return
      }

      if (req.url === "/check") {
        seenCookies.push(req.headers.cookie)
        res.end("done")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)
    await client.request({ url: "/set" })
    await client.request({ url: "/check" })

    expect(seenCookies[0]?.split(/;\s*/).toSorted()).toEqual(["a=1", "b=2"])
  })

  test("drops expired cookies", async () => {
    const seenCookies: Array<string | undefined> = []
    const server = await startServer((req, res) => {
      if (req.url === "/set") {
        res.setHeader("Set-Cookie", "expired=gone; Max-Age=0; Path=/")
        res.end("ok")
        return
      }

      if (req.url === "/check") {
        seenCookies.push(req.headers.cookie)
        res.end("done")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)
    await client.request({ url: "/set" })
    await client.request({ url: "/check" })

    expect(seenCookies).toEqual([undefined])
  })

  test("honors cookie path scoping", async () => {
    const seenCookies: Array<string | undefined> = []
    const server = await startServer((req, res) => {
      if (req.url === "/foo/set") {
        res.setHeader("Set-Cookie", "scoped=1; Path=/foo")
        res.end("ok")
        return
      }

      if (req.url === "/bar/check") {
        seenCookies.push(req.headers.cookie)
        res.end("done")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)
    await client.request({ url: "/foo/set" })
    await client.request({ url: "/bar/check" })

    expect(seenCookies).toEqual([undefined])
  })

  test("captures cookies across redirect chains", async () => {
    const seenCookies: Array<string | undefined> = []
    const server = await startServer((req, res) => {
      if (req.url === "/start") {
        res.statusCode = 302
        res.setHeader("Location", "/middle")
        res.setHeader("Set-Cookie", "first=1; Path=/")
        res.end("redirect")
        return
      }

      if (req.url === "/middle") {
        seenCookies.push(req.headers.cookie)
        res.statusCode = 302
        res.setHeader("Location", "/final")
        res.setHeader("Set-Cookie", "second=2; Path=/")
        res.end("redirect")
        return
      }

      if (req.url === "/final") {
        seenCookies.push(req.headers.cookie)
        res.end("done")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)
    await client.request({ url: "/start" })

    expect(seenCookies[0]).toBe("first=1")
    expect(seenCookies[1]?.split(/;\s*/).toSorted()).toEqual(["first=1", "second=2"])
  })

  test("drops cookies and Authorization on cross-origin redirects", async () => {
    // Use distinct hostnames (both loopback) so fetch-cookie's RFC 6265
    // domain-scoping treats this as a true cross-origin redirect and strips
    // cookies + Authorization. Same-host different-port is intentionally
    // NOT considered cross-origin by fetch-cookie / RFC 6265.
    const targetRequests: Array<{ cookie?: string; authorization?: string }> = []
    const targetServer = http.createServer((req, res) => {
      targetRequests.push({
        cookie: req.headers.cookie,
        authorization: req.headers.authorization
      })
      res.end("done")
    })
    servers.push(targetServer)

    await new Promise<void>((resolve, reject) => {
      targetServer.listen(0, "127.0.0.1", () => resolve())
      targetServer.once("error", reject)
    })
    const targetPort = (targetServer.address() as AddressInfo).port
    const targetUrl = `http://127.0.0.1:${targetPort}`

    const sourceServer = http.createServer((req, res) => {
      if (req.url === "/start") {
        res.statusCode = 302
        res.setHeader("Location", `${targetUrl}/final`)
        res.setHeader("Set-Cookie", "source=1; Path=/")
        res.end("redirect")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })
    servers.push(sourceServer)

    await new Promise<void>((resolve, reject) => {
      sourceServer.listen(0, "localhost", () => resolve())
      sourceServer.once("error", reject)
    })
    const sourcePort = (sourceServer.address() as AddressInfo).port
    const sourceUrl = `http://localhost:${sourcePort}`

    const client = new FetchHttpClient(sourceUrl)
    await client.request({
      url: "/start",
      headers: { Authorization: "Bearer secret" }
    })

    expect(targetRequests).toEqual([{ cookie: undefined, authorization: undefined }])
  })

  test("preserves HttpClientException code when max redirects are exceeded", async () => {
    const server = await startServer((req, res) => {
      if (req.url === "/loop") {
        res.statusCode = 302
        res.setHeader("Location", "/loop")
        res.end("redirect")
        return
      }

      res.statusCode = 404
      res.end("missing")
    })

    const client = new FetchHttpClient(server.url)

    await expect(client.request({ url: "/loop" })).rejects.toMatchObject({
      code: "ERR_FR_TOO_MANY_REDIRECTS"
    })

    try {
      await client.request({ url: "/loop" })
      throw new Error("Expected request to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(HttpClientException)
      expect((error as HttpClientException).code).toBe("ERR_FR_TOO_MANY_REDIRECTS")
    }
  })
})
