import { z } from "zod"
import { validateShape } from ".."
import {
  extractXmlArray,
  fullParse,
  isNumber,
  toInt,
  typedNodeAttr,
  xmlNode
} from "../utilities"

const xmlArrayLike = <T extends z.ZodTypeAny>(s: T) =>
  z.union([s, z.array(s), z.undefined()]).transform(v =>
    v === undefined ? [] : Array.isArray(v) ? v : [v]
  )

const StrictOptionalString = z.string().optional()
const StrictOptionalNumber = z.number().optional()
const StrictOptionalBoolean = z.boolean().optional()
const noPresentUndefined =
  (keys: string[], kind: "string" | "number" | "boolean") =>
  (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key) && value[key] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `expected ${kind}`
        })
      }
    }
  }

const ContributorClass = z.object({ name: z.string() })
type ContributorClass = z.infer<typeof ContributorClass>

const XmlLink = z.object({
  "@_href": z.string(),
  "@_rel": z.string(),
  "@_type": z.string(),
  "@_title": z.string()
})
type XmlLink = z.infer<typeof XmlLink>

const XmlState = z.object({ "@_value": z.string(), "@_text": z.string() })
type XmlState = z.infer<typeof XmlState>

const ExtendedDataRaw = z
  .object({
    host: z.string(),
    size: z.number(),
    runtime: z.number(),
    runtimeABAP: z.number(),
    runtimeSystem: z.number(),
    runtimeDatabase: z.number(),
    expiration: z.string(),
    system: z.string(),
    client: z.number(),
    isAggregated: z.boolean(),
    aggregationKind: StrictOptionalString,
    objectName: z.string(),
    state: XmlState
  })
  .superRefine(noPresentUndefined(["aggregationKind"], "string"))
type ExtendedDataRaw = z.infer<typeof ExtendedDataRaw>

const EntryAuthor = z.object({ name: z.string(), uri: z.string() })
type EntryAuthor = z.infer<typeof EntryAuthor>

const FeedEntryRaw = z.object({
  author: EntryAuthor,
  content: z.object({ "@_type": z.string(), "@_src": z.string() }),
  id: z.string(),
  link: xmlArrayLike(XmlLink),
  published: z.string(),
  title: z.string(),
  updated: z.string(),
  extendedData: ExtendedDataRaw,
  "@_lang": z.string()
})
type FeedEntryRaw = z.infer<typeof FeedEntryRaw>

const FeedRaw = z.object({
  author: ContributorClass,
  contributor: ContributorClass,
  title: z.string(),
  updated: z.string(),
  entry: xmlArrayLike(FeedEntryRaw)
})
type FeedRaw = z.infer<typeof FeedRaw>

const TraceResultsRaw = z.object({ feed: FeedRaw })
type TraceResultsRaw = z.infer<typeof TraceResultsRaw>

const BaseLink = z.object({ "@_rel": z.string(), "@_href": z.string() })
type BaseLink = z.infer<typeof BaseLink>

const XmlTime = z.object({
  "@_time": z.number(),
  "@_percentage": z.number()
})
type XmlTime = z.infer<typeof XmlTime>

const CalledProgramRaw = z.object({ "@_context": z.string() })
type CalledProgramRaw = z.infer<typeof CalledProgramRaw>

const CallingProgramRaw = z
  .object({
    "@_context": z.string(),
    "@_byteCodeOffset": z.number(),
    "@_uri": StrictOptionalString,
    "@_type": StrictOptionalString,
    "@_name": StrictOptionalString,
    "@_packageName": StrictOptionalString,
    "@_objectReferenceQuery": StrictOptionalString
  })
  .superRefine(
    noPresentUndefined(
      ["@_uri", "@_type", "@_name", "@_packageName", "@_objectReferenceQuery"],
      "string"
    )
  )
type CallingProgramRaw = z.infer<typeof CallingProgramRaw>

const HitListEntryRaw = z
  .object({
    calledProgram: CalledProgramRaw,
    grossTime: XmlTime,
    traceEventNetTime: XmlTime,
    proceduralNetTime: XmlTime,
    "@_topDownIndex": z.number(),
    "@_index": z.number(),
    "@_hitCount": z.number(),
    "@_recursionDepth": z.number(),
    "@_description": z.string(),
    callingProgram: CallingProgramRaw.optional(),
    "@_stackCount": StrictOptionalNumber,
    "@_proceduralEntryAnchor": StrictOptionalNumber,
    "@_dbAccessAnchor": StrictOptionalNumber
  })
  .superRefine(
    noPresentUndefined(
      ["@_stackCount", "@_proceduralEntryAnchor", "@_dbAccessAnchor"],
      "number"
    )
  )
type HitListEntryRaw = z.infer<typeof HitListEntryRaw>

const HitlistRaw = z.object({
  link: BaseLink,
  entry: xmlArrayLike(HitListEntryRaw)
})
type HitlistRaw = z.infer<typeof HitlistRaw>

const HitListResponseRaw = z.object({ hitlist: HitlistRaw })
type HitListResponseRaw = z.infer<typeof HitListResponseRaw>

const AccessTimeRaw = z.object({
  "@_total": z.number(),
  "@_applicationServer": z.number(),
  "@_database": z.number(),
  "@_ratioOfTraceTotal": z.number()
})
type AccessTimeRaw = z.infer<typeof AccessTimeRaw>

const DbAccessTypeLiteral = z.union([
  z.literal("EXEC SQL"),
  z.literal("OpenSQL"),
  z.literal("")
])

const DbAccessRaw = z.object({
  accessTime: AccessTimeRaw,
  "@_index": z.number(),
  "@_tableName": z.string(),
  "@_statement": z.string(),
  "@_type": DbAccessTypeLiteral,
  "@_totalCount": z.number(),
  "@_bufferedCount": z.number(),
  callingProgram: CallingProgramRaw.optional()
})
type DbAccessRaw = z.infer<typeof DbAccessRaw>

const DbTableRaw = z.object({
  "@_name": z.string(),
  "@_type": z.string(),
  "@_description": z.string(),
  "@_bufferMode": z.string(),
  "@_storageType": z.string(),
  "@_package": z.string()
})
type DbTableRaw = z.infer<typeof DbTableRaw>

const DbAccessesRaw = z.union([
  z.object({
    link: BaseLink,
    dbAccess: xmlArrayLike(DbAccessRaw),
    tables: z.literal(""),
    "@_totalDbTime": z.number()
  }),
  z.object({
    link: BaseLink,
    dbAccess: xmlArrayLike(DbAccessRaw),
    tables: z.object({ table: xmlArrayLike(DbTableRaw) }),
    "@_totalDbTime": z.number()
  })
])
type DbAccessesRaw = z.infer<typeof DbAccessesRaw>

const TraceDbAccessResponseRaw = z.object({ dbAccesses: DbAccessesRaw })
type TraceDbAccessResponseRaw = z.infer<typeof TraceDbAccessResponseRaw>

const StatementRaw = z
  .object({
    callingProgram: CallingProgramRaw,
    grossTime: XmlTime,
    traceEventNetTime: XmlTime,
    proceduralNetTime: XmlTime,
    "@_index": z.number(),
    "@_id": z.number(),
    "@_description": z.string(),
    "@_hitCount": z.number(),
    "@_hasDetailSubnodes": z.boolean(),
    "@_hasProcedureLikeSubnodes": z.boolean(),
    "@_callerId": z.number(),
    "@_callLevel": z.number(),
    "@_subnodeCount": z.number(),
    "@_directSubnodeCount": z.number(),
    "@_directSubnodeCountProcedureLike": z.number(),
    "@_hitlistAnchor": z.number(),
    "@_isProcedureLike": StrictOptionalBoolean,
    "@_isProceduralUnit": StrictOptionalBoolean,
    "@_isAutoDrillDowned": StrictOptionalBoolean,
    "@_calltreeAnchor": StrictOptionalNumber,
    "@_moduleHitlistAnchor": StrictOptionalNumber
  })
  .superRefine(
    noPresentUndefined(
      ["@_isProcedureLike", "@_isProceduralUnit", "@_isAutoDrillDowned"],
      "boolean"
    )
  )
  .superRefine(
    noPresentUndefined(["@_calltreeAnchor", "@_moduleHitlistAnchor"], "number")
  )
type StatementRaw = z.infer<typeof StatementRaw>

const StatementsRaw = z.object({
  link: BaseLink,
  statement: xmlArrayLike(StatementRaw),
  "@_withDetails": z.boolean(),
  "@_withSysEvents": z.boolean(),
  "@_count": z.union([z.number(), z.string()])
})
type StatementsRaw = z.infer<typeof StatementsRaw>

const TraceStatementResponseRaw = z.object({ statements: StatementsRaw })
type TraceStatementResponseRaw = z.infer<typeof TraceStatementResponseRaw>

const AuthorRaw = z.object({
  name: z.string(),
  uri: z.string(),
  "@_role": z.string()
})
type AuthorRaw = z.infer<typeof AuthorRaw>

const ClientRaw = z
  .object({
    "#text": StrictOptionalNumber,
    "@_role": StrictOptionalString
  })
  .superRefine(noPresentUndefined(["#text"], "number"))
  .superRefine(noPresentUndefined(["@_role"], "string"))
type ClientRaw = z.infer<typeof ClientRaw>

const ExecutionsRaw = z.object({
  "@_maximal": z.number(),
  "@_completed": z.number()
})
type ExecutionsRaw = z.infer<typeof ExecutionsRaw>

const RAW_PROCESS_TYPES = [
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
] as const
export type RawProcessTypes = (typeof RAW_PROCESS_TYPES)[number]

const RAW_OBJECT_TYPES = [
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
] as const
export type RawObjectTypes = (typeof RAW_OBJECT_TYPES)[number]

const RawProcessTypesSchema = z.union(RAW_PROCESS_TYPES.map(v => z.literal(v)) as [z.ZodLiteral<RawProcessTypes>, ...z.ZodLiteral<RawProcessTypes>[]])
const RawObjectTypesSchema = z.union(RAW_OBJECT_TYPES.map(v => z.literal(v)) as [z.ZodLiteral<RawObjectTypes>, ...z.ZodLiteral<RawObjectTypes>[]])

const TraceListExtendedDataRaw = z.object({
  host: z.string(),
  requestIndex: z.number(),
  client: xmlArrayLike(ClientRaw),
  description: z.string(),
  isAggregated: z.boolean(),
  expires: z.string(),
  processType: z.object({ "@_processTypeId": RawProcessTypesSchema }),
  object: z.object({ "@_objectTypeId": RawObjectTypesSchema }),
  executions: ExecutionsRaw
})
type TraceListExtendedDataRaw = z.infer<typeof TraceListExtendedDataRaw>

const TraceListEntryRaw = z.object({
  id: z.string(),
  author: xmlArrayLike(AuthorRaw),
  content: z.object({ "@_type": z.string(), "@_src": z.string() }),
  published: z.string(),
  title: z.string(),
  updated: z.string(),
  extendedData: TraceListExtendedDataRaw,
  "@_lang": z.string(),
  link: xmlArrayLike(XmlLink).optional()
})
type TraceListEntryRaw = z.infer<typeof TraceListEntryRaw>

const TlFeedRaw = z.object({
  contributor: z.object({ name: z.string(), "@_role": z.string() }),
  title: z.string(),
  updated: z.string(),
  entry: xmlArrayLike(TraceListEntryRaw)
})
type TlFeedRaw = z.infer<typeof TlFeedRaw>

const TracesListRequestRaw = z.object({ feed: TlFeedRaw })
type TracesListRequestRaw = z.infer<typeof TracesListRequestRaw>

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
  validateShape(x, TraceResultsRaw, "TraceResultsRaw").feed

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
  const updated = new Date(String(xmlNode(raw, "updated") || ""))
  return { author, contributor, title, updated, runs }
}

export const parseTraceHitList = (xml: string): TraceHitList => {
  const raw = validateShape(
    fullParse(xml, { removeNSPrefix: true }),
    HitListResponseRaw,
    "HitListResponseRaw"
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
    TraceDbAccessResponseRaw,
    "TraceDbAccessResponseRaw"
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
    TraceStatementResponseRaw,
    "TraceStatementResponseRaw"
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
    TracesListRequestRaw,
    "TracesListRequestRaw"
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
