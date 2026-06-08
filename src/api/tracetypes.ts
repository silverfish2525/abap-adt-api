import {
  extractXmlArray,
  fullParse,
  isArray,
  isNumber,
  isObject,
  isString,
  toInt,
  typedNodeAttr,
  xmlNode
} from "../utilities"
import { validateShape } from "../AdtException"

// ---------------------------------------------------------------------------
// Type guard helpers
// ---------------------------------------------------------------------------

const isStr = (x: unknown): x is string => typeof x === "string"
const isNum = (x: unknown): x is number => typeof x === "number"
const isBool = (x: unknown): x is boolean => typeof x === "boolean"

// Mirrors the original `xmlArrayType<C>` codec: accepts a single value, an
// array of values, or undefined. fast-xml-parser collapses single-element
// arrays to scalars unless told otherwise, so the API has to handle both.
const xmlArrayLike = <T>(g: (x: unknown) => x is T) =>
  (x: unknown): x is T | T[] | undefined => {
    if (x === undefined) return true
    if (isArray(x)) return (x as unknown[]).every(g)
    return g(x)
  }

// ---------------------------------------------------------------------------
// Trace results (parseTraceResults)
// ---------------------------------------------------------------------------

interface ContributorClass { name: string }
interface XmlLink {
  "@_href": string
  "@_rel": string
  "@_type": string
  "@_title": string
}
interface XmlState { "@_value": string; "@_text": string }
interface ExtendedDataRaw {
  host: string
  size: number
  runtime: number
  runtimeABAP: number
  runtimeSystem: number
  runtimeDatabase: number
  expiration: string
  system: string
  client: number
  isAggregated: boolean
  aggregationKind?: string
  objectName: string
  state: XmlState
}
interface EntryAuthor { name: string; uri: string }
interface FeedEntryRaw {
  author: EntryAuthor
  content: { "@_type": string; "@_src": string }
  id: string
  link: XmlLink | XmlLink[] | undefined
  published: string
  title: string
  updated: string
  extendedData: ExtendedDataRaw
  "@_lang": string
}
interface FeedRaw {
  author: ContributorClass
  contributor: ContributorClass
  title: string
  updated: string
  entry: FeedEntryRaw | FeedEntryRaw[] | undefined
}
interface TraceResultsRaw { feed: FeedRaw }

const isContributorClass = (x: unknown): x is ContributorClass =>
  isObject(x) && isStr((x as any).name)

const isXmlLink = (x: unknown): x is XmlLink =>
  isObject(x) &&
  isStr((x as any)["@_href"]) &&
  isStr((x as any)["@_rel"]) &&
  isStr((x as any)["@_type"]) &&
  isStr((x as any)["@_title"])

const isXmlState = (x: unknown): x is XmlState =>
  isObject(x) && isStr((x as any)["@_value"]) && isStr((x as any)["@_text"])

const isExtendedDataRaw = (x: unknown): x is ExtendedDataRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.host) &&
    isNum(o.size) &&
    isNum(o.runtime) &&
    isNum(o.runtimeABAP) &&
    isNum(o.runtimeSystem) &&
    isNum(o.runtimeDatabase) &&
    isStr(o.expiration) &&
    isStr(o.system) &&
    isNum(o.client) &&
    isBool(o.isAggregated) &&
    (o.aggregationKind === undefined || isStr(o.aggregationKind)) &&
    isStr(o.objectName) &&
    isXmlState(o.state)
  )
}

const isEntryAuthor = (x: unknown): x is EntryAuthor =>
  isObject(x) && isStr((x as any).name) && isStr((x as any).uri)

const isFeedEntryRaw = (x: unknown): x is FeedEntryRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  const c = o.content as Record<string, unknown> | undefined
  return (
    isEntryAuthor(o.author) &&
    isObject(c) &&
    isStr(c["@_type"]) &&
    isStr(c["@_src"]) &&
    isStr(o.id) &&
    xmlArrayLike(isXmlLink)(o.link) &&
    isStr(o.published) &&
    isStr(o.title) &&
    isStr(o.updated) &&
    isExtendedDataRaw(o.extendedData) &&
    isStr(o["@_lang"])
  )
}

const isFeedRaw = (x: unknown): x is FeedRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isContributorClass(o.author) &&
    isContributorClass(o.contributor) &&
    isStr(o.title) &&
    isStr(o.updated) &&
    xmlArrayLike(isFeedEntryRaw)(o.entry)
  )
}

const isTraceResultsRaw = (x: unknown): x is TraceResultsRaw =>
  isObject(x) && isFeedRaw((x as any).feed)

// ---------------------------------------------------------------------------
// HitListResponse
// ---------------------------------------------------------------------------

interface BaseLink { "@_rel": string; "@_href": string }
interface XmlTime { "@_time": number; "@_percentage": number }
interface CalledProgramRaw { "@_context": string }
interface CallingProgramRaw {
  "@_context": string
  "@_byteCodeOffset": number
  "@_uri"?: string
  "@_type"?: string
  "@_name"?: string
  "@_packageName"?: string
  "@_objectReferenceQuery"?: string
}
interface HitListEntryRaw {
  calledProgram: CalledProgramRaw
  grossTime: XmlTime
  traceEventNetTime: XmlTime
  proceduralNetTime: XmlTime
  "@_topDownIndex": number
  "@_index": number
  "@_hitCount": number
  "@_recursionDepth": number
  "@_description": string
  callingProgram?: CallingProgramRaw
  "@_stackCount"?: number
  "@_proceduralEntryAnchor"?: number
  "@_dbAccessAnchor"?: number
}
interface HitlistRaw {
  link: BaseLink
  entry: HitListEntryRaw | HitListEntryRaw[] | undefined
}
interface HitListResponseRaw { hitlist: HitlistRaw }

const isBaseLink = (x: unknown): x is BaseLink =>
  isObject(x) && isStr((x as any)["@_rel"]) && isStr((x as any)["@_href"])

const isXmlTime = (x: unknown): x is XmlTime =>
  isObject(x) &&
  isNum((x as any)["@_time"]) &&
  isNum((x as any)["@_percentage"])

const isCalledProgramRaw = (x: unknown): x is CalledProgramRaw =>
  isObject(x) && isStr((x as any)["@_context"])

const isCallingProgramRaw = (x: unknown): x is CallingProgramRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!isStr(o["@_context"]) || !isNum(o["@_byteCodeOffset"])) return false
  if (o["@_uri"] !== undefined && !isStr(o["@_uri"])) return false
  if (o["@_type"] !== undefined && !isStr(o["@_type"])) return false
  if (o["@_name"] !== undefined && !isStr(o["@_name"])) return false
  if (o["@_packageName"] !== undefined && !isStr(o["@_packageName"]))
    return false
  if (
    o["@_objectReferenceQuery"] !== undefined &&
    !isStr(o["@_objectReferenceQuery"])
  )
    return false
  return true
}

const isHitListEntryRaw = (x: unknown): x is HitListEntryRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (
    !isCalledProgramRaw(o.calledProgram) ||
    !isXmlTime(o.grossTime) ||
    !isXmlTime(o.traceEventNetTime) ||
    !isXmlTime(o.proceduralNetTime)
  )
    return false
  if (
    !isNum(o["@_topDownIndex"]) ||
    !isNum(o["@_index"]) ||
    !isNum(o["@_hitCount"]) ||
    !isNum(o["@_recursionDepth"]) ||
    !isStr(o["@_description"])
  )
    return false
  if (o.callingProgram !== undefined && !isCallingProgramRaw(o.callingProgram))
    return false
  if (o["@_stackCount"] !== undefined && !isNum(o["@_stackCount"])) return false
  if (
    o["@_proceduralEntryAnchor"] !== undefined &&
    !isNum(o["@_proceduralEntryAnchor"])
  )
    return false
  if (o["@_dbAccessAnchor"] !== undefined && !isNum(o["@_dbAccessAnchor"]))
    return false
  return true
}

const isHitlistRaw = (x: unknown): x is HitlistRaw =>
  isObject(x) &&
  isBaseLink((x as any).link) &&
  xmlArrayLike(isHitListEntryRaw)((x as any).entry)

const isHitListResponseRaw = (x: unknown): x is HitListResponseRaw =>
  isObject(x) && isHitlistRaw((x as any).hitlist)

// ---------------------------------------------------------------------------
// traceDBAccesResponse
// ---------------------------------------------------------------------------

interface AccessTimeRaw {
  "@_total": number
  "@_applicationServer": number
  "@_database": number
  "@_ratioOfTraceTotal": number
}
interface DbAccessRaw {
  accessTime: AccessTimeRaw
  "@_index": number
  "@_tableName": string
  "@_statement": string
  "@_type": "EXEC SQL" | "OpenSQL" | ""
  "@_totalCount": number
  "@_bufferedCount": number
  callingProgram?: CallingProgramRaw
}
interface DbTableRaw {
  "@_name": string
  "@_type": string
  "@_description": string
  "@_bufferMode": string
  "@_storageType": string
  "@_package": string
}
interface DbAccessesRaw {
  link: BaseLink
  dbAccess: DbAccessRaw | DbAccessRaw[] | undefined
  tables: { table: DbTableRaw | DbTableRaw[] | undefined } | ""
  "@_totalDbTime": number
}
interface TraceDbAccessResponseRaw { dbAccesses: DbAccessesRaw }

const isAccessTimeRaw = (x: unknown): x is AccessTimeRaw =>
  isObject(x) &&
  isNum((x as any)["@_total"]) &&
  isNum((x as any)["@_applicationServer"]) &&
  isNum((x as any)["@_database"]) &&
  isNum((x as any)["@_ratioOfTraceTotal"])

const isDbAccessTypeLiteral = (x: unknown): x is "EXEC SQL" | "OpenSQL" | "" =>
  x === "EXEC SQL" || x === "OpenSQL" || x === ""

const isDbAccessRaw = (x: unknown): x is DbAccessRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (
    !isAccessTimeRaw(o.accessTime) ||
    !isNum(o["@_index"]) ||
    !isStr(o["@_tableName"]) ||
    !isStr(o["@_statement"]) ||
    !isDbAccessTypeLiteral(o["@_type"]) ||
    !isNum(o["@_totalCount"]) ||
    !isNum(o["@_bufferedCount"])
  )
    return false
  if (o.callingProgram !== undefined && !isCallingProgramRaw(o.callingProgram))
    return false
  return true
}

const isDbTableRaw = (x: unknown): x is DbTableRaw =>
  isObject(x) &&
  isStr((x as any)["@_name"]) &&
  isStr((x as any)["@_type"]) &&
  isStr((x as any)["@_description"]) &&
  isStr((x as any)["@_bufferMode"]) &&
  isStr((x as any)["@_storageType"]) &&
  isStr((x as any)["@_package"])

const isDbAccessesRaw = (x: unknown): x is DbAccessesRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!isBaseLink(o.link) || !isNum(o["@_totalDbTime"])) return false
  if (!xmlArrayLike(isDbAccessRaw)(o.dbAccess)) return false
  if (o.tables === "") return true
  if (!isObject(o.tables)) return false
  return xmlArrayLike(isDbTableRaw)((o.tables as any).table)
}

const isTraceDbAccessResponseRaw = (
  x: unknown
): x is TraceDbAccessResponseRaw =>
  isObject(x) && isDbAccessesRaw((x as any).dbAccesses)

// ---------------------------------------------------------------------------
// traceStatementResponse
// ---------------------------------------------------------------------------

interface StatementRaw {
  callingProgram: CallingProgramRaw
  grossTime: XmlTime
  traceEventNetTime: XmlTime
  proceduralNetTime: XmlTime
  "@_index": number
  "@_id": number
  "@_description": string
  "@_hitCount": number
  "@_hasDetailSubnodes": boolean
  "@_hasProcedureLikeSubnodes": boolean
  "@_callerId": number
  "@_callLevel": number
  "@_subnodeCount": number
  "@_directSubnodeCount": number
  "@_directSubnodeCountProcedureLike": number
  "@_hitlistAnchor": number
  "@_isProcedureLike"?: boolean
  "@_isProceduralUnit"?: boolean
  "@_isAutoDrillDowned"?: boolean
  "@_calltreeAnchor"?: number
  "@_moduleHitlistAnchor"?: number
}

interface StatementsRaw {
  link: BaseLink
  statement: StatementRaw | StatementRaw[] | undefined
  "@_withDetails": boolean
  "@_withSysEvents": boolean
  "@_count": number | string
}

interface TraceStatementResponseRaw { statements: StatementsRaw }

const isStatementRaw = (x: unknown): x is StatementRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (
    !isCallingProgramRaw(o.callingProgram) ||
    !isXmlTime(o.grossTime) ||
    !isXmlTime(o.traceEventNetTime) ||
    !isXmlTime(o.proceduralNetTime)
  )
    return false
  if (
    !isNum(o["@_index"]) ||
    !isNum(o["@_id"]) ||
    !isStr(o["@_description"]) ||
    !isNum(o["@_hitCount"]) ||
    !isBool(o["@_hasDetailSubnodes"]) ||
    !isBool(o["@_hasProcedureLikeSubnodes"]) ||
    !isNum(o["@_callerId"]) ||
    !isNum(o["@_callLevel"]) ||
    !isNum(o["@_subnodeCount"]) ||
    !isNum(o["@_directSubnodeCount"]) ||
    !isNum(o["@_directSubnodeCountProcedureLike"]) ||
    !isNum(o["@_hitlistAnchor"])
  )
    return false
  if (o["@_isProcedureLike"] !== undefined && !isBool(o["@_isProcedureLike"]))
    return false
  if (
    o["@_isProceduralUnit"] !== undefined &&
    !isBool(o["@_isProceduralUnit"])
  )
    return false
  if (
    o["@_isAutoDrillDowned"] !== undefined &&
    !isBool(o["@_isAutoDrillDowned"])
  )
    return false
  if (o["@_calltreeAnchor"] !== undefined && !isNum(o["@_calltreeAnchor"]))
    return false
  if (
    o["@_moduleHitlistAnchor"] !== undefined &&
    !isNum(o["@_moduleHitlistAnchor"])
  )
    return false
  return true
}

const isStatementsRaw = (x: unknown): x is StatementsRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isBaseLink(o.link) &&
    xmlArrayLike(isStatementRaw)(o.statement) &&
    isBool(o["@_withDetails"]) &&
    isBool(o["@_withSysEvents"]) &&
    (isNum(o["@_count"]) || isStr(o["@_count"]))
  )
}

const isTraceStatementResponseRaw = (
  x: unknown
): x is TraceStatementResponseRaw =>
  isObject(x) && isStatementsRaw((x as any).statements)

// ---------------------------------------------------------------------------
// tracesListRequest
// ---------------------------------------------------------------------------

interface AuthorRaw { name: string; uri: string; "@_role": string }
interface ClientRaw { "#text"?: number; "@_role"?: string }
interface ExecutionsRaw { "@_maximal": number; "@_completed": number }

const RAW_PROCESS_TYPES = [
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
] as const
type RawProcessTypes = (typeof RAW_PROCESS_TYPES)[number]

const RAW_OBJECT_TYPES = [
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
] as const
type RawObjectTypes = (typeof RAW_OBJECT_TYPES)[number]

const isRawProcessTypes = (x: unknown): x is RawProcessTypes =>
  isStr(x) && (RAW_PROCESS_TYPES as readonly string[]).includes(x)

const isRawObjectTypes = (x: unknown): x is RawObjectTypes =>
  isStr(x) && (RAW_OBJECT_TYPES as readonly string[]).includes(x)

interface TraceListExtendedDataRaw {
  host: string
  requestIndex: number
  client: ClientRaw | ClientRaw[] | undefined
  description: string
  isAggregated: boolean
  expires: string
  processType: { "@_processTypeId": RawProcessTypes }
  object: { "@_objectTypeId": RawObjectTypes }
  executions: ExecutionsRaw
}

interface TraceListEntryRaw {
  id: string
  author: AuthorRaw | AuthorRaw[] | undefined
  content: { "@_type": string; "@_src": string }
  published: string
  title: string
  updated: string
  extendedData: TraceListExtendedDataRaw
  "@_lang": string
  link?: XmlLink | XmlLink[] | undefined
}

interface TlFeedRaw {
  contributor: { name: string; "@_role": string }
  title: string
  updated: string
  entry: TraceListEntryRaw | TraceListEntryRaw[] | undefined
}

interface TracesListRequestRaw { feed: TlFeedRaw }

const isAuthorRaw = (x: unknown): x is AuthorRaw =>
  isObject(x) &&
  isStr((x as any).name) &&
  isStr((x as any).uri) &&
  isStr((x as any)["@_role"])

const isClientRaw = (x: unknown): x is ClientRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (o["#text"] !== undefined && !isNum(o["#text"])) return false
  if (o["@_role"] !== undefined && !isStr(o["@_role"])) return false
  return true
}

const isExecutionsRaw = (x: unknown): x is ExecutionsRaw =>
  isObject(x) &&
  isNum((x as any)["@_maximal"]) &&
  isNum((x as any)["@_completed"])

const isTraceListExtendedDataRaw = (
  x: unknown
): x is TraceListExtendedDataRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.host) &&
    isNum(o.requestIndex) &&
    xmlArrayLike(isClientRaw)(o.client) &&
    isStr(o.description) &&
    isBool(o.isAggregated) &&
    isStr(o.expires) &&
    isObject(o.processType) &&
    isRawProcessTypes((o.processType as any)["@_processTypeId"]) &&
    isObject(o.object) &&
    isRawObjectTypes((o.object as any)["@_objectTypeId"]) &&
    isExecutionsRaw(o.executions)
  )
}

const isTraceListEntryRaw = (x: unknown): x is TraceListEntryRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  const c = o.content as Record<string, unknown> | undefined
  if (!isStr(o.id)) return false
  if (!xmlArrayLike(isAuthorRaw)(o.author)) return false
  if (!isObject(c) || !isStr(c["@_type"]) || !isStr(c["@_src"])) return false
  if (
    !isStr(o.published) ||
    !isStr(o.title) ||
    !isStr(o.updated) ||
    !isStr(o["@_lang"])
  )
    return false
  if (!isTraceListExtendedDataRaw(o.extendedData)) return false
  if (o.link !== undefined && !xmlArrayLike(isXmlLink)(o.link)) return false
  return true
}

const isTlFeedRaw = (x: unknown): x is TlFeedRaw => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  const contributor = o.contributor as Record<string, unknown> | undefined
  return (
    isObject(contributor) &&
    isStr(contributor.name) &&
    isStr(contributor["@_role"]) &&
    isStr(o.title) &&
    isStr(o.updated) &&
    xmlArrayLike(isTraceListEntryRaw)(o.entry)
  )
}

const isTracesListRequestRaw = (x: unknown): x is TracesListRequestRaw =>
  isObject(x) && isTlFeedRaw((x as any).feed)

// ---------------------------------------------------------------------------
// Public types (unchanged from before)
// ---------------------------------------------------------------------------

export interface TraceResults {
  author: string
  contributor: string
  title: string
  updated: Date
  runs: TraceRun[]
}

export interface TraceRun {
  id: string
  author: string
  title: string
  published: Date
  updated: Date
  authorUri: string
  type: string
  src: string
  lang: string
  extendedData: ExtendedTraceData
  links: TraceLink[]
}

export interface ExtendedTraceData {
  host: string
  size: number
  runtime: number
  runtimeABAP: number
  runtimeSystem: number
  runtimeDatabase: number
  expiration: Date
  system: string
  client: number
  isAggregated: boolean
  aggregationKind?: string
  objectName: string
  state: State
}

export interface State {
  value: string
  text: string
}

export interface TraceLink {
  href: string
  rel: string
  type: string
  title: string
}

export interface TraceHitList {
  parentLink: string
  entries: HitListEntry[]
}

export interface CallingProgram {
  context: string
  byteCodeOffset: number
  uri?: string
  type?: string
  name?: string
  packageName?: string
  objectReferenceQuery?: string
}

export interface HitListEntry {
  topDownIndex: number
  index: number
  hitCount: number
  stackCount?: number
  recursionDepth: number
  description: string
  proceduralEntryAnchor?: number
  dbAccessAnchor?: number
  callingProgram?: CallingProgram
  calledProgram: string
  grossTime: TraceTime
  traceEventNetTime: TraceTime
  proceduralNetTime: TraceTime
}

export interface TraceTime {
  time: number
  percentage: number
}

export interface TraceDBAccessResponse {
  parentLink: string
  dbaccesses: Dbaccess[]
  tables: Table[]
}

export interface Dbaccess {
  index: number
  tableName: string
  statement: string
  type: TraceTableType
  totalCount: number
  bufferedCount: number
  accessTime: AccessTime
  callingProgram?: CallingProgram
}

export interface AccessTime {
  total: number
  applicationServer: number
  database: number
  ratioOfTraceTotal: number
}

export type TraceTableType = "" | "EXEC SQL" | "OpenSQL"
export interface Table {
  name: string
  type: string
  description: string
  bufferMode: string
  storageType: string
  package: string
}

export interface TraceStatement {
  index: number
  id: number
  description: string
  hitCount: number
  hasDetailSubnodes: boolean
  hasProcedureLikeSubnodes: boolean
  callerId: number
  callLevel: number
  subnodeCount: number
  directSubnodeCount: number
  directSubnodeCountProcedureLike: number
  isAutoDrillDowned?: boolean
  isProceduralUnit?: boolean
  isProcedureLike?: boolean
  hitlistAnchor: number
  calltreeAnchor?: number
  moduleHitlistAnchor?: number
  callingProgram: CallingProgram
  grossTime: TraceTime
  traceEventNetTime: TraceTime
  proceduralNetTime: TraceTime
}

export interface TraceStatementResponse {
  withDetails: boolean
  withSysEvents: boolean
  count: number
  parentLink: string
  statements: TraceStatement[]
}

export type TraceStatementOptions = Partial<{
  id: number
  withDetails: boolean
  autoDrillDownThreshold: number
  withSystemEvents: boolean
}>

export interface TraceRequestAuthor {
  name: string
  role: string
  uri: string
}
export interface TraceRequestClient {
  id: number
  role: string
}

export interface TraceRequestExecutions {
  maximal: number
  completed: number
}

export interface TraceRequestExtendedData {
  description: string
  executions: TraceRequestExecutions
  isAggregated: boolean
  host: string
  expires: Date
  processType: TracedProcessType
  objectType: TracedObjectType
  requestIndex: number
  clients: TraceRequestClient[]
}

export interface TraceRequest {
  id: string
  lang: string
  title: string
  published: Date
  updated: Date
  links: TraceLink[]
  authors: TraceRequestAuthor[]
  contentSrc: string
  contentType: string
  extendedData: TraceRequestExtendedData
}

export interface TraceRequestList {
  title: string
  contributorName: string
  contributorRole: string
  requests: TraceRequest[]
}

export interface TraceParameters {
  allMiscAbapStatements: boolean
  allProceduralUnits: boolean
  allInternalTableEvents: boolean
  allDynproEvents: boolean
  description: string
  aggregate: boolean
  explicitOnOff: boolean
  withRfcTracing: boolean
  allSystemKernelEvents: boolean
  sqlTrace: boolean
  allDbEvents: boolean
  maxSizeForTraceFile: number
  maxTimeForTracing: number
}

export type TracedProcessType =
  | "HTTP"
  | "DIALOG"
  | "RFC"
  | "BATCH"
  | "SHARED_OBJECTS_AREA"
  | "ANY"
export type TracedObjectType =
  | "FUNCTION_MODULE"
  | "URL"
  | "TRANSACTION"
  | "REPORT"
  | "SHARED_OBJECTS_AREA"
  | "ANY"

export const traceProcessTypeUris: Record<TracedProcessType, RawProcessTypes> =
  {
    ANY: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any",
    HTTP: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http",
    DIALOG: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog",
    BATCH: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch",
    RFC: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc",
    SHARED_OBJECTS_AREA:
      "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
  }

export const traceObjectTypeUris: Record<TracedObjectType, RawObjectTypes> = {
  ANY: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any",
  URL: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url",
  TRANSACTION: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction",
  REPORT: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report",
  FUNCTION_MODULE:
    "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule",
  SHARED_OBJECTS_AREA:
    "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
}

const decodeObjectType = (x: RawObjectTypes): TracedObjectType => {
  switch (x) {
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any":
      return "ANY"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url":
      return "URL"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction":
      return "TRANSACTION"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report":
      return "REPORT"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule":
      return "FUNCTION_MODULE"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea":
      return "SHARED_OBJECTS_AREA"
    default:
      return "ANY"
  }
}

const decodeProcessType = (x: RawProcessTypes): TracedProcessType => {
  switch (x) {
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any":
      return "ANY"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http":
      return "HTTP"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog":
      return "DIALOG"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch":
      return "BATCH"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc":
      return "RFC"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea":
      return "SHARED_OBJECTS_AREA"
    default:
      return "ANY"
  }
}

export const traceProcessObjects: Record<
  TracedProcessType,
  TracedObjectType[]
> = {
  ANY: [
    "FUNCTION_MODULE",
    "URL",
    "TRANSACTION",
    "REPORT",
    "SHARED_OBJECTS_AREA",
    "ANY"
  ],
  HTTP: ["URL"],
  DIALOG: ["TRANSACTION", "REPORT"],
  BATCH: ["REPORT"],
  RFC: ["FUNCTION_MODULE"],
  SHARED_OBJECTS_AREA: ["SHARED_OBJECTS_AREA"]
}

export interface TracesCreationConfig {
  /**
   * server name, use * for all servers
   */
  server?: string
  description: string
  traceUser: string
  traceClient: string
  processType: TracedProcessType
  objectType: TracedObjectType
  expires: Date
  maximalExecutions: number
  parametersId: string
}

const parseRawTrace = (x: unknown) =>
  validateShape(x, isTraceResultsRaw, "TraceResults").feed

export const parseTraceResults = (xml: string): TraceResults => {
  const raw = parseRawTrace(fullParse(xml, { removeNSPrefix: true }))
  const runs = extractXmlArray(raw.entry).map(l => {
    const links = extractXmlArray(l.link).map(typedNodeAttr)
    const {
      id,
      author: { name: author, uri: authorUri },
      content: { "@_type": type, "@_src": src },
      "@_lang": lang,
      title
    } = l
    const published = new Date(l.published)
    const updated = new Date(l.updated)
    const extendedData = {
      ...l.extendedData,
      expiration: new Date(l.extendedData.expiration),
      state: typedNodeAttr(l.extendedData.state)
    }
    // @ts-ignore
    delete extendedData["#text"]
    return {
      id,
      author,
      title,
      published,
      updated,
      authorUri,
      type,
      src,
      lang,
      extendedData,
      links
    }
  })
  const {
    author: { name: author },
    contributor: { name: contributor },
    title
  } = raw
  const updated = new Date(xmlNode(raw, "updated"))
  return { author, contributor, title, updated, runs }
}

export const parseTraceHitList = (xml: string): TraceHitList => {
  const raw = validateShape(
    fullParse(xml, { removeNSPrefix: true }),
    isHitListResponseRaw,
    "HitListResponse"
  ).hitlist
  const parentLink = raw.link["@_href"]
  const entries = extractXmlArray(raw.entry).map(e => {
    const callingProgram = e.callingProgram
      ? typedNodeAttr(e.callingProgram)
      : undefined
    const calledProgram = e.calledProgram?.["@_context"]
    const grossTime = typedNodeAttr(e.grossTime)
    const traceEventNetTime = typedNodeAttr(e.traceEventNetTime)
    const proceduralNetTime = typedNodeAttr(e.proceduralNetTime)

    return {
      ...typedNodeAttr(e),
      callingProgram,
      calledProgram,
      grossTime,
      traceEventNetTime,
      proceduralNetTime
    }
  })
  return { parentLink, entries }
}

export const parseTraceDbAccess = (xml: string): TraceDBAccessResponse => {
  const toParse = fullParse(xml, { removeNSPrefix: true })
  const raw = validateShape(
    toParse,
    isTraceDbAccessResponseRaw,
    "TraceDBAccessResponse"
  ).dbAccesses
  const parentLink = raw.link["@_href"]
  const dbaccesses = extractXmlArray(raw.dbAccess).map(a => {
    const callingProgram = a.callingProgram && typedNodeAttr(a.callingProgram)
    const accessTime = typedNodeAttr(a.accessTime)
    return { ...typedNodeAttr(a), accessTime, callingProgram }
  })
  const tables =
    raw.tables === ""
      ? []
      : extractXmlArray(raw.tables.table).map(typedNodeAttr)
  return { parentLink, dbaccesses, tables }
}

const parseCount = (count: string | number) => {
  if (isNumber(count)) return count
  const [base, exp] = count.split("E").map(toInt)
  if (exp) return base * 10 ** exp
  return base
}

export const parseTraceStatements = (xml: string) => {
  const raw = validateShape(
    fullParse(xml, { removeNSPrefix: true }),
    isTraceStatementResponseRaw,
    "TraceStatementResponse"
  ).statements

  const parentLink = raw.link["@_href"]
  const statements = extractXmlArray(raw.statement).map(s => {
    const callingProgram = typedNodeAttr(s.callingProgram)
    const grossTime = typedNodeAttr(s.grossTime)
    const proceduralNetTime = typedNodeAttr(s.proceduralNetTime)
    const traceEventNetTime = typedNodeAttr(s.traceEventNetTime)
    return {
      ...typedNodeAttr(s),
      callingProgram,
      grossTime,
      traceEventNetTime,
      proceduralNetTime
    }
  })
  const count = parseCount(raw["@_count"])

  return { ...typedNodeAttr(raw), count, parentLink, statements }
}

export const parseTraceRequestList = (xml: string): TraceRequestList => {
  const parsed = validateShape(
    fullParse(xml, { removeNSPrefix: true }),
    isTracesListRequestRaw,
    "TracesListRequest"
  ).feed
  const {
    contributor: { name: contributorName, "@_role": contributorRole },
    title
  } = parsed
  const requests = extractXmlArray(parsed.entry).map(e => {
    const { id, "@_lang": lang, title } = e
    const published = new Date(e.published)
    const updated = new Date(e.updated)
    const links = extractXmlArray(e.link).map(typedNodeAttr)
    const authors = extractXmlArray(e.author).map(
      ({ name, uri, "@_role": role }) => ({ name, role, uri })
    )
    const { "@_src": contentSrc, "@_type": contentType } = e.content
    const { description, executions, isAggregated, host, requestIndex } =
      e.extendedData
    const expires = new Date(e.extendedData.expires)
    const processType = decodeProcessType(
      e.extendedData.processType["@_processTypeId"]
    )
    const objectType = decodeObjectType(e.extendedData.object["@_objectTypeId"])
    const clients = extractXmlArray(e.extendedData.client).map(
      ({ "#text": id = 0, "@_role": role = "" }) => ({ id, role })
    )
    const extendedData = {
      description,
      executions: typedNodeAttr(executions),
      isAggregated,
      host,
      expires,
      processType,
      objectType,
      requestIndex,
      clients
    }
    return {
      id,
      lang,
      title,
      published,
      updated,
      links,
      authors,
      contentSrc,
      contentType,
      extendedData
    }
  })
  return { title, contributorName, contributorRole, requests }
}
