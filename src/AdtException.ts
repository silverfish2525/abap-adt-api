import { z } from "zod"
import {
  AdtHTTP,
  HttpClientException,
  HttpClientResponse,
  isHttpClientException,
  RequestOptions
} from "./AdtHTTP"
import {
  asXmlNode,
  fullParse,
  hasMessage,
  isNativeError,
  isNumber,
  isObject,
  isString,
  xmlArray
} from "./utilities"
const ADTEXTYPEID = Symbol.for("ADT EXCEPTION")
const CSRFEXTYPEID = Symbol.for("BAD CSRF")
const HTTPEXTYPEID = Symbol.for("HTTP EXCEPTION")

export enum SAPRC {
  Success = "S",
  Info = "I",
  Warning = "W",
  Error = "E",
  CriticalError = "A",
  Exception = "X"
}
export interface ExceptionProperties {
  conflictText: string
  ideUser: string
  "com.sap.adt.communicationFramework.subType": string
  "T100KEY-ID": string
  "T100KEY-NO": string
}

const isResponse = (r: any): r is HttpClientResponse =>
  isObject<Record<string, any>>(r) && !!r?.status && isString(r?.statusText)

export class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }

  public static create(
    resp: HttpClientResponse,
    properties: ExceptionProperties | Record<string, string>
  ): AdtErrorException
  public static create(
    err: number,
    properties: ExceptionProperties | Record<string, string>,
    type: string,
    message: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: HttpClientResponse
  ): AdtErrorException
  public static create(
    errOrResponse: number | HttpClientResponse,
    properties: ExceptionProperties | Record<string, string>,
    type?: string,
    message?: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: HttpClientResponse
  ): AdtErrorException {
    if (!isNumber(errOrResponse)) {
      return this.create(
        errOrResponse.status,
        properties,
        "",
        errOrResponse.statusText || "Unknown error in adt client",
        undefined,
        undefined,
        undefined,
        errOrResponse
      )
    } else {
      return new AdtErrorException(
        errOrResponse,
        properties,
        type!,
        message!,
        parent,
        namespace,
        localizedMessage,
        response
      )
    }
  }

  constructor(
    public readonly err: number,
    public readonly properties: ExceptionProperties | Record<string, string>,
    public readonly type: string,
    public readonly message: string,
    public readonly parent?: Error,
    public readonly namespace?: string,
    public readonly localizedMessage?: string,
    public readonly response?: HttpClientResponse
  ) {
    super()
  }
}

class AdtCsrfException extends Error {
  get typeID(): symbol {
    return CSRFEXTYPEID
  }
  constructor(
    public readonly message: string,
    public readonly parent?: Error
  ) {
    super()
  }
}
class AdtHttpException extends Error {
  get typeID(): symbol {
    return HTTPEXTYPEID
  }
  get status(): number {
    if (isHttpClientException(this.parent)) return this.parent.status || 0
    const p: any = this.parent
    const status = p?.response?.status
    return isNumber(status) ? status : 0
  }
  get code() {
    const p: any = this.parent
    if (isHttpClientException(p)) return p.code
    return undefined
  }
  get message() {
    return this.parent.message
  }
  get name() {
    return this.parent.name
  }
  constructor(public readonly parent: Error) {
    super()
  }
}

export type AdtException =
  | AdtErrorException
  | AdtCsrfException
  | AdtHttpException

export function isAdtError(e: unknown): e is AdtErrorException {
  return (e as any)?.typeID === ADTEXTYPEID
}
export function isCsrfError(e: unknown): e is AdtCsrfException {
  return (e as any)?.typeID === CSRFEXTYPEID
}
export function isHttpError(e: unknown): e is AdtHttpException {
  return (e as any)?.typeID === HTTPEXTYPEID
}
export function isAdtException(e: unknown): e is AdtException {
  return isAdtError(e) || isCsrfError(e) || isHttpError(e)
}
export const isLoginError = (adtErr: AdtException) =>
  (isHttpError(adtErr) && adtErr.status === 401) || isCsrfError(adtErr)

const simpleError = (response: HttpClientResponse) =>
  adtException(
    `Error ${response.status}:${response.statusText}`,
    response.status
  )

const isCsrfException = (r: HttpClientResponse) =>
  (r.status === 403 && r.headers["x-csrf-token"] === "Required") ||
  (r.status === 400 && r.statusText === "Session timed out")

export const fromResponse = (data: string, response: HttpClientResponse) => {
  if (!data) return simpleError(response)
  if (data.match(/CSRF/)) return new AdtCsrfException(data)
  const raw = fullParse(data as string)
  const root = asXmlNode(raw["exc:exception"])
  if (!root && response.status === 401) return simpleError(response)
  if (!root) throw new Error("Missing exc:exception in ADT error response")
  const getf = (base: any, idx: string) => (base ? base[idx] : "")
  const properties: Record<string, string> = {}
  xmlArray(root, "properties", "entry").forEach((p: any) => {
    properties[p["@_key"]] = `${p["#text"]}`
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
  })
  return new AdtErrorException(
    response.status,
    properties,
    getf(root.type, "@_id"),
    getf(root.message, "#text"),
    undefined,
    getf(root.namespace, "@_id"),
    getf(root.localizedMessage, "#text")
  )
}

export const fromError = (error: unknown): AdtException => {
  try {
    if (isAdtError(error)) return error

    if (isHttpClientException(error)) {
      if (error.response) {
        if (error.status === 401) return new AdtHttpException(error)
        try {
          return fromResponse(error.response.body, error.response)
        } catch (e) {}
      }
      return new AdtHttpException(error)
    }
    if (hasMessage(error))
      return new AdtErrorException(500, {}, "", error.message)
  } catch (error) {}
  return AdtErrorException.create(500, {}, "Unknown error", `${error}`)
}

function fromExceptionOrResponse_int(
  errOrResp: HttpClientResponse | HttpClientException,
  config?: RequestOptions
): AdtException {
  try {
    if (isResponse(errOrResp)) return fromResponse(errOrResp.body, errOrResp)
    else return fromError(errOrResp)
  } catch (e) {
    return isResponse(errOrResp)
      ? AdtErrorException.create(errOrResp, {})
      : fromError(e)
  }
}

export function fromException(
  errOrResp: unknown,
  config?: RequestOptions
): AdtException {
  if (isAdtException(errOrResp)) return errOrResp
  if (
    !isResponse(errOrResp) &&
    (!isNativeError(errOrResp) ||
      (isNativeError(errOrResp) && !isHttpClientException(errOrResp)))
  )
    return AdtErrorException.create(500, {}, "Unknown error", `${errOrResp}`)
  return fromExceptionOrResponse_int(errOrResp, config)
}

export function adtException(message: string, number = 0) {
  return new AdtErrorException(number, {}, "", message)
}

export function ValidateObjectUrl(url: string) {
  if (url.match(/^\/sap\/bc\/adt\/[a-z]+\/[a-zA-Z%\$]?[\w%]+/)) return
  throw new AdtErrorException(
    0,
    {},
    "BADOBJECTURL",
    "Invalid Object URL:" + url
  )
}

export function ValidateStateful(h: AdtHTTP) {
  if (h.isStateful) return
  throw new AdtErrorException(
    0,
    {},
    "STATELESS",
    "This operation can only be performed in stateful mode"
  )
}

export function validateShape<T extends z.ZodTypeAny>(
  value: unknown,
  schema: T,
  name: string
): z.infer<T> {
  const r = schema.safeParse(value)
  if (r.success) return r.data
  const issue = r.error.issues[0]
  const path = issue?.path?.length ? ` at ${issue.path.join(".")}` : ""
  throw new AdtErrorException(
    0,
    {},
    "INTERNAL",
    `Unexpected response shape: expected ${name}${path}: ${issue?.message || "invalid value"}`,
    undefined,
    undefined,
    undefined
  )
}

export const isErrorMessageType = (x: string | SAPRC | undefined) =>
  !!`${x}`.match(/^[EAX]$/i)
