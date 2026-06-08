import { z } from "zod"
import { parts, toInt } from "../utilities"
import { Location } from "./syntax"

const StringRecord = z.record(z.string(), z.string())

export const RangePoint = z.object({
  line: z.number(),
  column: z.number()
})
export type RangePoint = z.infer<typeof RangePoint>

export const Range = z.object({
  start: RangePoint,
  end: RangePoint
})
export type Range = z.infer<typeof Range>

export const UriParts = z.object({
  uri: z.string(),
  query: StringRecord.optional(),
  range: Range,
  hashparms: StringRecord.optional()
})
export type UriParts = z.infer<typeof UriParts>

export const isUriParts = (x: unknown): x is UriParts =>
  UriParts.safeParse(x).success

/** @deprecated Use `isUriParts` instead — `uriParts` was the io-ts codec, now removed. */
export const uriParts = { is: isUriParts }

export const rangeToString = (range: Range) =>
  `#start=${range.start.line},${range.start.column};end=${range.end.line},${range.end.column}`

const serializeKv = (r?: Record<string, string>) => {
  const rec = r || {}
  return Object.keys(rec).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(rec[k])}`)
}
const isNullRange = (r: Range) =>
  r.start.line === 0 && r.start.column === 0 && r.end.line === 0 && r.end.column === 0

export const uriPartsToString = (parts: UriParts) => {
  const range = isNullRange(parts.range) ? "" : rangeToString(parts.range)
  const parms = serializeKv(parts.hashparms).join(";")
  const query = serializeKv(parts.query).join("&")
  const hash = `${range ? range : ""}${parms ? `${range ? ";" : "#"}${parms}` : ``}`
  return `${parts.uri}${query ? `?${query}` : ``}${hash}`
}

const uriPartsCompatSmokeCheck: boolean = uriParts.is({
  uri: "",
  query: undefined,
  range: {
    start: { line: 0, column: 0 },
    end: { line: 0, column: 0 }
  },
  hashparms: undefined
})
void uriPartsCompatSmokeCheck

export function parseUri(sourceuri: string): UriParts {
  const [uri, qs, hash] = parts(sourceuri, /([^\?#]*)(?:\?([^#]*))?(?:#(.*))?/)
  const query = (qs || "").split(/&/).reduce((acc: Record<string, string>, cur) => {
    const [key, val] = cur.split("=")
    if (key) acc[decodeURIComponent(key)] = decodeURIComponent(val)
    return acc
  }, {})

  const { start, end, ...hashparms } = (hash || "")
    .split(/;/)
    .reduce((acc: Record<string, string>, cur) => {
      const [key, val] = cur.split("=")
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent(val)
      return acc
    }, {})

  const parsePos = (x: string): Location => {
    const [line, column] = x ? x.split(",").map(toInt) : [0, 0]
    return { line: line || 0, column: column || 0 }
  }
  const st = parsePos(start)
  const range: Range = {
    start: st,
    end: end ? parsePos(end) : st
  }

  return UriParts.parse({
    range,
    uri,
    query,
    hashparms
  })
}
