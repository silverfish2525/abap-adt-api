import {
  type InferTypedSchema,
  transportmanagment,
  transportmanagmentSingle
} from "@abapify/adt-schemas"
import { adtException, ValidateObjectUrl } from "../AdtException"
import { SAPRC } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  asXmlNode,
  fullParse,
  JSON2AbapXML,
  parse,
  parseSapDate,
  toSapDate,
  XmlNode,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { Link } from "./objectstructure"

interface TransportHeader {
  TRKORR: string
  TRFUNCTION: string
  TRSTATUS: string
  TARSYSTEM: string
  AS4USER: string
  AS4DATE: string
  AS4TIME: string
  AS4TEXT: string
  CLIENT: string
}
interface TransportLock {
  HEADER: TransportHeader
  TASKS: TransportHeader[]
  OBJECT_KEY: {
    OBJ_NAME: string
    OBJECT: string
    PGMID: string
  }
}
export interface TransportInfo {
  PGMID: string
  OBJECT: string
  OBJECTNAME: string
  OPERATION: string
  DEVCLASS: string
  CTEXT: string
  KORRFLAG: string
  AS4USER: string
  PDEVCLASS: string
  DLVUNIT: string
  MESSAGES?: {
    SEVERITY: string
    SPRSL: string
    ARBGB: string
    MSGNR: number
    VARIABLES: string[]
    TEXT: string
  }[]
  NAMESPACE: string
  RESULT: string
  RECORDING: string
  EXISTING_REQ_ONLY: string
  TRANSPORTS: TransportHeader[]
  TADIRDEVC?: string
  URI?: string
  LOCKS?: TransportLock
}

export interface TransportConfigurationEntry {
  createdBy: string
  changedBy: string
  client: string
  link: string
  etag: string
  createdAt: number
  changedAt: number
}
export enum TransportDateFilter {
  SinceYesterday = 0,
  SincleTwoWeeks = 1,
  SinceFourWeeks = 2,
  DateRange = 3
}

export interface SimpleTransportConfiguration {
  DateFilter:
    | TransportDateFilter.SinceYesterday
    | TransportDateFilter.SincleTwoWeeks
    | TransportDateFilter.SinceFourWeeks
  WorkbenchRequests: boolean
  TransportOfCopies: boolean
  Released: boolean
  User: string
  CustomizingRequests: boolean
  Modifiable: boolean
}

export interface RangeTransportConfiguration {
  DateFilter: TransportDateFilter
  FromDate: number
  ToDate: number
  WorkbenchRequests: boolean
  TransportOfCopies: boolean
  Released: boolean
  User: string
  CustomizingRequests: boolean
  Modifiable: boolean
}

export type TransportConfiguration =
  | SimpleTransportConfiguration
  | RangeTransportConfiguration

function extractLocks(raw: any): TransportLock | undefined {
  const lock = raw && raw.CTS_OBJECT_LOCK
  if (!lock) return
  try {
    const holder = lock.LOCK_HOLDER
    const TASKS: TransportHeader[] = xmlArray(holder, "TASK_HEADERS").map(
      (x: any) => x.CTS_TASK_HEADER
    )
    return {
      HEADER: holder.REQ_HEADER,
      OBJECT_KEY: xmlNode(lock, "OBJECT_KEY") as TransportLock["OBJECT_KEY"],
      TASKS
    }
  } catch {
    return
  }
}

function extractTransports(raw: any): TransportHeader[] {
  return xmlArray(raw, "CTS_REQUEST").map((x: any) => x.REQ_HEADER)
}

export async function transportInfo(
  h: AdtHTTP,
  URI: string,
  DEVCLASS: string = "",
  OPERATION: string = "I"
): Promise<TransportInfo> {
  ValidateObjectUrl(URI)
  const body = JSON2AbapXML({
    DEVCLASS,
    OPERATION,
    URI
  })

  const headers = {
    Accept:
      "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData",
    "Content-Type":
      "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData"
  }
  const response = await h.request("/sap/bc/adt/cts/transportchecks", {
    body,
    method: "POST",
    headers
  })
  // return parsePackageResponse(response.body)
  // tslint:disable-next-line: prefer-const
  const data = (asXmlNode(parse(response.body)["asx:abap"]) as XmlNode)[
    "asx:values"
  ] as XmlNode
  let { REQUESTS, LOCKS, MESSAGES, ...header } = data.DATA as XmlNode
  if (MESSAGES) {
    MESSAGES = xmlArray(MESSAGES, "CTS_MESSAGE").map((m: any) => {
      // tslint:disable-next-line: prefer-const
      let { VARIABLES, ...rest } = m
      VARIABLES =
        (VARIABLES && xmlArray(m, "VARIABLES", "CTS_VARIABLE")).map(
          (v: any) => v.VARIABLE
        ) || []
      return { VARIABLES, ...rest }
    })
    MESSAGES.filter((m: any) => m.SEVERITY.match(/[EAX]/)).some((e: any) => {
      throw adtException(e.TEXT)
    })
  }
  const TRANSPORTS = extractTransports(REQUESTS)
  return { ...header, LOCKS: extractLocks(LOCKS), TRANSPORTS } as TransportInfo
}

export async function createTransport(
  h: AdtHTTP,
  REF: string,
  REQUEST_TEXT: string,
  DEVCLASS: string,
  OPERATION: string = "I",
  transportLayer = ""
): Promise<string> {
  ValidateObjectUrl(REF)
  const body = JSON2AbapXML({ DEVCLASS, REQUEST_TEXT, REF, OPERATION })
  const qs = transportLayer ? { transportLayer } : {}
  const response = await h.request("/sap/bc/adt/cts/transports", {
    body,
    qs,
    headers: {
      Accept: "text/plain",
      "Content-Type":
        "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest"
    },
    method: "POST"
  })
  const transport = response.body?.split("/").pop()
  return transport || ""
}

type TransportManagementRoot = InferTypedSchema<typeof transportmanagment>["root"]
type TransportManagementSingleRoot = InferTypedSchema<
  typeof transportmanagmentSingle
>["root"]
type SchemaTransportTarget = NonNullable<
  NonNullable<TransportManagementRoot["workbench"]["target"]>[number]
>
type SchemaTransportRequest = NonNullable<
  NonNullable<SchemaTransportTarget["modifiable"]["request"]>[number]
>
type SchemaTransportTask = NonNullable<
  NonNullable<SchemaTransportRequest["task"]>[number]
>
type SchemaTransportObject = NonNullable<
  NonNullable<SchemaTransportTask["abap_object"]>[number]
>
type SchemaTransportLink = NonNullable<
  NonNullable<SchemaTransportTask["link"]>[number]
>
type SchemaTransportRequestSingle = NonNullable<
  TransportManagementSingleRoot["request"]
>

export type TransportObject = {
  "tm:pgmid": NonNullable<SchemaTransportObject["pgmid"]>
  "tm:type": NonNullable<SchemaTransportObject["type"]>
  "tm:name": NonNullable<SchemaTransportObject["name"]>
  "tm:dummy_uri": NonNullable<SchemaTransportObject["dummy_uri"]>
  "tm:obj_info": NonNullable<SchemaTransportObject["obj_info"]>
}
export type TransportTask = {
  "tm:number": NonNullable<SchemaTransportTask["number"]>
  "tm:owner": NonNullable<SchemaTransportTask["owner"]>
  "tm:desc": NonNullable<SchemaTransportTask["desc"]>
  "tm:status": NonNullable<SchemaTransportTask["status"]>
  "tm:uri": NonNullable<SchemaTransportTask["uri"]>
  links: Link[]
  objects: TransportObject[]
}

export type TransportRequest = TransportTask & {
  tasks: TransportTask[]
}

export type TransportTarget = {
  "tm:name": NonNullable<SchemaTransportTarget["name"]>
  "tm:desc": NonNullable<SchemaTransportTarget["desc"]>
  modifiable: TransportRequest[]
  released: TransportRequest[]
}

export interface TransportsOfUser {
  workbench: TransportTarget[]
  customizing: TransportTarget[]
  /**
   * Transport-of-copies bucket. Populated when the SAP server returns a
   * `<tm:transportofcopies>` element (driven by the `TransportOfCopies`
   * configuration property — see `CL_CTS_ADT_TM_CONFIG_HANDLER`). Older
   * downstream code that constructs synthetic `TransportsOfUser` values
   * may omit this field, which is why it is optional.
   */
  transportofcopies?: TransportTarget[]
}

const arrayOrEmpty = <T>(items: T[] | undefined): T[] => items ?? []

const toLink = (link: SchemaTransportLink): Link => ({
  href: link.href,
  rel: link.rel ?? "",
  type: link.type,
  title: link.title,
  etag: typeof link.etag === "number" ? link.etag : undefined
})

const toTransportObject = (object: SchemaTransportObject): TransportObject => ({
  "tm:pgmid": object.pgmid ?? "",
  "tm:type": object.type ?? "",
  "tm:name": object.name ?? "",
  "tm:dummy_uri": object.dummy_uri ?? "",
  "tm:obj_info": object.obj_info ?? ""
})

const toTransportTask = (
  task: Pick<SchemaTransportTask, "number" | "owner" | "desc" | "status" | "uri" | "link" | "abap_object">
): TransportTask => ({
  "tm:number": task.number ?? "",
  "tm:owner": task.owner ?? "",
  "tm:desc": task.desc ?? "",
  "tm:status": task.status ?? "",
  "tm:uri": task.uri ?? "",
  links: arrayOrEmpty(task.link).map(toLink),
  objects: arrayOrEmpty(task.abap_object).map(toTransportObject)
})

const toTransportRequest = (
  request: Pick<
    SchemaTransportRequestSingle,
    "number" | "owner" | "desc" | "status" | "uri" | "link" | "abap_object" | "task"
  >
): TransportRequest => ({
  ...toTransportTask(request),
  tasks: arrayOrEmpty(request.task).map(toTransportTask)
})

const toTransportTarget = (target: SchemaTransportTarget): TransportTarget => ({
  "tm:name": target.name ?? "",
  "tm:desc": target.desc ?? "",
  modifiable: arrayOrEmpty(target.modifiable.request).map(toTransportRequest),
  released: arrayOrEmpty(target.released.request).map(toTransportRequest)
})

const parseTransportsOfUser = (body: string): TransportsOfUser => {
  const parsed = transportmanagment.parse(body)
  return {
    workbench: arrayOrEmpty(parsed.root.workbench.target).map(toTransportTarget),
    customizing: arrayOrEmpty(parsed.root.customizing.target).map(toTransportTarget),
    // TODO: @abapify/adt-schemas@0.4.1 has no `transportofcopies` branch in
    // `transportmanagment`, so keep this optional bucket unset until the
    // upstream schema covers it and we have a fixture/test for the shape.
    transportofcopies: undefined
  }
}

export async function transportDetails(
  h: AdtHTTP,
  transportNumber: string
): Promise<TransportRequest> {
  const Accept = "application/vnd.sap.adt.transportorganizer.v1+xml"
  const url = `/sap/bc/adt/cts/transportrequests/${transportNumber}`
  const raw = await h.request(url, { headers: { Accept } })
  const parsed = transportmanagmentSingle.parse(raw.body)
  return toTransportRequest(parsed.root.request ?? {})
}

export async function userTransports(
  h: AdtHTTP,
  user: string,
  targets = true
): Promise<TransportsOfUser> {
  const response = await h.request("/sap/bc/adt/cts/transportrequests", {
    qs: { user, targets }
  })

  return parseTransportsOfUser(response.body)
}

export async function transportsByConfig(
  h: AdtHTTP,
  configUri: string,
  targets = true
): Promise<TransportsOfUser> {
  const response = await h.request("/sap/bc/adt/cts/transportrequests", {
    qs: { configUri, targets }
  })

  return parseTransportsOfUser(response.body)
}

const serializeTransportConfig = (cfg: TransportConfiguration) => {
  const w = (k: string, v: string) =>
    `<configuration:property key="${k}">${v}</configuration:property>`
  const p = <T extends Record<string, any>>(v: T, k: string) => w(k, v[k])
  const td = (d: number) => `${toSapDate(new Date(d))}`
  const datelimit =
    cfg.DateFilter === TransportDateFilter.DateRange
      ? `${w("FromDate", td(cfg.FromDate))}${w("ToDate", td(cfg.ToDate))}`
      : ""
  return "".concat(
    `<configuration:configuration xmlns:configuration="http://www.sap.com/adt/configuration"> <configuration:properties>`,
    p(cfg, "WorkbenchRequests"),
    p(cfg, "CustomizingRequests"),
    p(cfg, "TransportOfCopies"),
    p(cfg, "DateFilter"),
    p(cfg, "Modifiable"),
    p(cfg, "Released"),
    p(cfg, "User"),
    datelimit,
    `</configuration:properties> </configuration:configuration>`
  )
}

export async function createTransportsConfig(h: AdtHTTP) {
  const headers = { Accept: "application/vnd.sap.adt.configuration.v1+xml" }
  const uri =
    "/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations"
  const response = await h.request(uri, { method: "POST", headers })

  return parseTransportConfig(response.body)
}

export async function setTransportsConfig(
  h: AdtHTTP,
  uri: string,
  etag: string,
  config: TransportConfiguration
) {
  const body = serializeTransportConfig(config)
  const headers = {
    Accept: "application/vnd.sap.adt.configuration.v1+xml",
    "Content-Type": "application/vnd.sap.adt.configuration.v1+xml",
    "If-Match": etag
  }

  const response = await h.request(uri, { method: "PUT", headers, body })

  return parseTransportConfig(response.body)
}

function validateTransport(transportNumber: string) {
  if (transportNumber.length !== 10 || !transportNumber.match(/^[a-z]\w\wk/i))
    adtException("Invalid transport number:" + transportNumber)
}

export async function transportDelete(h: AdtHTTP, transportNumber: string) {
  validateTransport(transportNumber)

  await h.request("/sap/bc/adt/cts/transportrequests/" + transportNumber, {
    method: "DELETE",
    headers: { Accept: "application/*" }
  })
}
export interface TransportReleaseMessage {
  "chkrun:uri": string
  "chkrun:type": SAPRC
  "chkrun:shortText": string
}
export interface TransportReleaseReport {
  "chkrun:reporter": string
  "chkrun:triggeringUri": string
  "chkrun:status": "released" | "abortrelapifail" // perhaps other values?
  "chkrun:statusText": string
  messages: TransportReleaseMessage[]
}

export async function transportRelease(
  h: AdtHTTP,
  transportNumber: string,
  ignoreLocks = false,
  IgnoreATC = false
) {
  validateTransport(transportNumber)
  const action = IgnoreATC
    ? "relObjigchkatc"
    : ignoreLocks
      ? "relwithignlock"
      : "newreleasejobs"
  const response = await h.request(
    `/sap/bc/adt/cts/transportrequests/${transportNumber}/${action}`,
    {
      method: "POST",
      headers: { Accept: "application/*" }
    }
  )
  const raw = fullParse(response.body)
  const reports = xmlArray(
    raw,
    "tm:root",
    "tm:releasereports",
    "chkrun:checkReport"
  ).map((r: XmlNode) => {
    return {
      ...xmlNodeAttr(r),
      messages: xmlArray(
        r,
        "chkrun:checkMessageList",
        "chkrun:checkMessage"
      ).map(xmlNodeAttr)
    }
  })
  return reports as unknown as TransportReleaseReport[]
}
export interface TransportOwnerResponse {
  "tm:targetuser": string
  "tm:number": string
}

export async function transportSetOwner(
  h: AdtHTTP,
  transportNumber: string,
  targetuser: string
) {
  validateTransport(transportNumber)
  const body = `<?xml version="1.0" encoding="ASCII"?><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${transportNumber}" tm:targetuser="${targetuser}" tm:useraction="changeowner"/>`
  const response = await h.request(
    "/sap/bc/adt/cts/transportrequests/" + transportNumber,
    {
      method: "PUT",
      headers: { Accept: "application/*" },
      qs: { targetuser },
      body
    }
  )
  const raw = fullParse(response.body)
  return xmlNodeAttr(asXmlNode(xmlNode(raw, "tm:root"))) as unknown as TransportOwnerResponse
}

export interface TransportAddUserResponse {
  "tm:number": string
  "tm:targetuser": string
  "tm:uri": string
  "tm:useraction": string
}
export async function transportAddUser(
  h: AdtHTTP,
  transportNumber: string,
  user: string
) {
  validateTransport(transportNumber)

  const body = `<?xml version="1.0" encoding="ASCII"?>
  <tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${transportNumber}"
  tm:targetuser="${user}" tm:useraction="newtask"/>`

  const response = await h.request(
    "/sap/bc/adt/cts/transportrequests/" + transportNumber + "/tasks",
    {
      method: "POST",
      body,
      headers: { Accept: "application/*", "Content-Type": "text/plain" }
    }
  )
  const raw = fullParse(response.body)
  return xmlNodeAttr(asXmlNode(xmlNode(raw, "tm:root"))) as unknown as TransportAddUserResponse
}

export interface SystemUser {
  id: string
  title: string
}

export async function systemUsers(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/system/users", {
    headers: { Accept: "application/atom+xml;type=feed" }
  })
  const raw = parse(response.body)
  return xmlArray<XmlNode>(raw, "atom:feed", "atom:entry").map(
    (r): SystemUser => ({
      id: (r["atom:id"] as string) || "",
      title: (r["atom:title"] as string) || ""
    })
  )
}

// tslint:disable: variable-name
export async function transportReference(
  h: AdtHTTP,
  pgmid: string,
  obj_wbtype: string,
  obj_name: string,
  tr_number = ""
) {
  const response = await h.request(
    "/sap/bc/adt/cts/transportrequests/reference",
    {
      headers: { Accept: "application/*" },
      qs: { obj_name, obj_wbtype, pgmid, tr_number }
    }
  )
  const raw = fullParse(response.body)
  const link = xmlNodeAttr(asXmlNode(xmlNode(raw, "tm:root", "atom:link")))
  return link.href as string
}
const parseTransportConfigItemList = (body: string) => {
  const raw = fullParse(body, { parseAttributeValue: false })
  return xmlArray(
    raw,
    "configurations:configurations",
    "configuration:configuration"
  ).map((conf: XmlNode) => {
    const linkNode = conf["atom:link"] as XmlNode
    const link = (linkNode?.["@_href"] as string) || ""
    const etag = (linkNode?.["@_etag"] as string) || ""
    const { ["atom:link"]: _link, ...rest } = conf
    const attrs = xmlNodeAttr(rest as XmlNode)
    const createdAt = attrs.createdAt as string
    const changedAt = attrs.changedAt as string
    const item: TransportConfigurationEntry = {
      ...(attrs as unknown as Omit<TransportConfigurationEntry, "link" | "etag" | "createdAt" | "changedAt">),
      link,
      etag,
      createdAt: Date.parse(createdAt),
      changedAt: Date.parse(changedAt)
    }
    return item
  })
}

export async function transportConfigurations(h: AdtHTTP) {
  const headers = { Accept: "application/vnd.sap.adt.configurations.v1+xml" }
  const url =
    "/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations"
  const response = await h.request(url, { headers })
  return parseTransportConfigItemList(response.body)
}

const parseTransportConfig = (r: string) => {
  const raw = fullParse(r, { parseAttributeValue: false })

  const props = xmlArray(
    raw,
    "configuration:configuration",
    "configuration:properties",
    "configuration:property"
  ).map((p: XmlNode) => {
    return { key: p["@_key"] as string, value: p["#text"] as string }
  })
  const cfg: any = {}
  for (const { key, value } of props) cfg[key] = value
  const WorkbenchRequests = cfg.WorkbenchRequests
  const TransportOfCopies = cfg.TransportOfCopies
  const Released = cfg.Released
  const User = cfg.User
  const CustomizingRequests = cfg.CustomizingRequests
  const FromDate = cfg.FromDate && parseSapDate(`${cfg.FromDate}`)
  const ToDate = cfg.ToDate && parseSapDate(`${cfg.ToDate}`)
  const DateFilter = cfg.DateFilter
  const Modifiable = cfg.Modifiable

  return {
    WorkbenchRequests,
    TransportOfCopies,
    Released,
    User,
    CustomizingRequests,
    FromDate,
    ToDate,
    DateFilter,
    Modifiable
  } as TransportConfiguration
}

export async function getTransportConfiguration(h: AdtHTTP, url: string) {
  const headers = { Accept: "application/vnd.sap.adt.configuration.v1+xml" }
  const response = await h.request(url, { headers })
  return parseTransportConfig(response.body)
}
