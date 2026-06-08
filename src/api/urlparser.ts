import { parts, toInt } from "../utilities"
import { Location } from "./syntax"

interface RangePoint {
  line: number
  column: number
}

export interface Range {
  start: RangePoint
  end: RangePoint
}

export interface UriParts {
  uri: string
  query: Record<string, string> | undefined
  range: Range
  hashparms: Record<string, string> | undefined
}

const isStringRecord = (x: unknown): x is Record<string, string> => {
  if (x === undefined) return false
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false
  return Object.values(x as Record<string, unknown>).every(v => typeof v === "string")
}

export const isUriParts = (x: unknown): x is UriParts => {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false
  const o = x as Record<string, unknown>
  const range = o.range as Record<string, unknown> | undefined
  const start = range?.start as Record<string, unknown> | undefined
  const end = range?.end as Record<string, unknown> | undefined

  return (
    typeof o.uri === "string" &&
    (o.query === undefined || isStringRecord(o.query)) &&
    (o.hashparms === undefined || isStringRecord(o.hashparms)) &&
    !!range &&
    !!start &&
    !!end &&
    typeof start.line === "number" &&
    typeof start.column === "number" &&
    typeof end.line === "number" &&
    typeof end.column === "number"
  )
}

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
  //
  const query = (qs || "").split(/&/).reduce((acc: any, cur) => {
    const [key, val] = cur.split("=")
    if (key) acc[decodeURIComponent(key)] = decodeURIComponent(val)
    return acc
  }, {})

  const { start, end, ...hashparms } = (hash || "")
    .split(/;/)
    .reduce((acc: any, cur) => {
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

  return { range, uri, query, hashparms }
}
