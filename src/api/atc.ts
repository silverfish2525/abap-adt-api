import { AdtHTTP } from "../AdtHTTP"
import {
  Clean,
  encodeEntity,
  fullParse,
  isArray,
  isObject,
  isString,
  numberParseOptions,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { adtException, isErrorMessageType, validateShape } from ".."
import { parseUri, UriParts } from "./urlparser"
import { isUriParts } from "./unittest"

// SATC_AC_RSLT_XMPT_KIND Atc based/Inline/none. The original io-ts decoder
// listed "A" | "I" | "" but with `t.string` as a fallback union, so any
// string was accepted. We keep that permissive surface.
export type ExemptionKind = string

export interface ProposalFinding {
  uri: string
  type: string
  name: string
  location: string
  processor: string
  lastChangedBy: string
  priority: number
  checkId: string
  checkTitle: string
  messageId: string
  messageTitle: string
  exemptionApproval: string
  exemptionKind: ExemptionKind
  checksum: number
  quickfixInfo: string
  quickfixes?: {
    automatic?: boolean
    manual?: boolean
    pseudo?: boolean
  }
}

export interface RestrictByObjectInner {
  object: boolean
  package: boolean
  subobject: boolean
  target: "subobject" | "object" | "package" | ""
}

export interface RestrictByCheckInner {
  check: boolean
  message: boolean
  target: "message" | "check" | ""
}

export interface AtcRestriction {
  enabled: boolean
  singlefinding: boolean
  rangeOfFindings: {
    enabled: boolean
    restrictByObject: RestrictByObjectInner
    restrictByCheck: RestrictByCheckInner
  }
}

export interface AtcProposal {
  finding: ProposalFinding | string
  package: string
  subObject: string
  subObjectType: string
  subObjectTypeDescr: string
  objectTypeDescr: string
  approver: string
  reason: "FPOS" | "OTHR" | ""
  justification: string
  notify: "never" | "on_rejection" | "always"
  restriction: AtcRestriction
  apprIsArea?: string
  checkClass?: string
  validUntil?: string
}

export interface AtcProposalMessage {
  type: string
  message: string
}

export interface RestrictByObject {
  object: boolean
  package: boolean
  subobject: boolean
  text: string
}

export interface AtcRunResultInfo {
  type: string
  description: string
}

export interface AtcRunResult {
  id: string
  timestamp: number
  infos: AtcRunResultInfo[]
}

export interface AtcExemption {
  id: string
  justificationMandatory: boolean
  title: string
}

export interface AtcProperty {
  name: string
  value: boolean | string
}

export interface AtcCustomizing {
  properties: AtcProperty[]
  excemptions: AtcExemption[]
}

export interface AtcObjectSet {
  name: string
  title: string
  kind: string
}

export interface AtcLink {
  href: string
  rel: string
  type: string
}

export interface AtcFinding {
  uri: string
  location: UriParts
  priority: number
  checkId: string
  checkTitle: string
  messageId: string
  messageTitle: string
  exemptionApproval: string
  exemptionKind: ExemptionKind
  quickfixInfo: string | undefined
  link: AtcLink
}

export interface AtcObject {
  uri: string
  type: string
  name: string
  packageName: string
  author: string
  objectTypeId: string | undefined
  findings: AtcFinding[]
}

export interface AtcWorkList {
  id: string
  timestamp: number
  usedObjectSet: string
  objectSetIsComplete: boolean
  objectSets: AtcObjectSet[]
  objects: AtcObject[]
}

export interface AtcUser {
  id: string
  title: string
}

// `Clean<T>` aliases preserved for binary public-API symmetry with the
// previous `t.TypeOf<typeof X>`-derived shapes.
export type AtcRunResultClean = Clean<AtcRunResult>
export type AtcCustomizingClean = Clean<AtcCustomizing>
export type AtcWorkListClean = Clean<AtcWorkList>
export type AtcUserClean = Clean<AtcUser>
export type AtcProposalClean = Clean<AtcProposal>
export type AtcProposalMessageClean = Clean<AtcProposalMessage>

// Type guards ------------------------------------------------------------

const isStr = (x: unknown): x is string => typeof x === "string"
const isNum = (x: unknown): x is number => typeof x === "number"
const isBool = (x: unknown): x is boolean => typeof x === "boolean"

const isExemptionKind = (x: unknown): x is ExemptionKind => isStr(x)

const isProposalFindingQuickfixes = (
  x: unknown
): x is ProposalFinding["quickfixes"] => {
  if (x === undefined) return true
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if ("automatic" in o && !isBool(o.automatic)) return false
  if ("manual" in o && !isBool(o.manual)) return false
  if ("pseudo" in o && !isBool(o.pseudo)) return false
  return true
}

const isProposalFinding = (x: unknown): x is ProposalFinding => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.uri) &&
    isStr(o.type) &&
    isStr(o.name) &&
    isStr(o.location) &&
    isStr(o.processor) &&
    isStr(o.lastChangedBy) &&
    isNum(o.priority) &&
    isStr(o.checkId) &&
    isStr(o.checkTitle) &&
    isStr(o.messageId) &&
    isStr(o.messageTitle) &&
    isStr(o.exemptionApproval) &&
    isExemptionKind(o.exemptionKind) &&
    isNum(o.checksum) &&
    isStr(o.quickfixInfo) &&
    isProposalFindingQuickfixes(o.quickfixes)
  )
}

const isRestrictByObjectInner = (x: unknown): x is RestrictByObjectInner => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!isBool(o.object) || !isBool(o.package) || !isBool(o.subobject))
    return false
  return (
    o.target === "subobject" ||
    o.target === "object" ||
    o.target === "package" ||
    o.target === ""
  )
}

const isRestrictByCheckInner = (x: unknown): x is RestrictByCheckInner => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!isBool(o.check) || !isBool(o.message)) return false
  return o.target === "message" || o.target === "check" || o.target === ""
}

const isAtcRestriction = (x: unknown): x is AtcRestriction => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!isBool(o.enabled) || !isBool(o.singlefinding)) return false
  const r = o.rangeOfFindings as Record<string, unknown> | undefined
  if (!isObject(r)) return false
  return (
    isBool(r.enabled) &&
    isRestrictByObjectInner(r.restrictByObject) &&
    isRestrictByCheckInner(r.restrictByCheck)
  )
}

export const isAtcProposal = (x: unknown): x is AtcProposal => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  if (!(isProposalFinding(o.finding) || isStr(o.finding))) return false
  if (
    !isStr(o.package) ||
    !isStr(o.subObject) ||
    !isStr(o.subObjectType) ||
    !isStr(o.subObjectTypeDescr) ||
    !isStr(o.objectTypeDescr) ||
    !isStr(o.approver) ||
    !isStr(o.justification)
  )
    return false
  if (o.reason !== "FPOS" && o.reason !== "OTHR" && o.reason !== "") return false
  if (
    o.notify !== "never" &&
    o.notify !== "on_rejection" &&
    o.notify !== "always"
  )
    return false
  if (!isAtcRestriction(o.restriction)) return false
  if ("apprIsArea" in o && !isStr((o as any).apprIsArea)) return false
  if ("checkClass" in o && !isStr((o as any).checkClass)) return false
  if ("validUntil" in o && !isStr((o as any).validUntil)) return false
  return true
}

export const isAtcProposalMessage = (x: unknown): x is AtcProposalMessage => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.type) && isStr(o.message)
}

// Backwards-compat alias for the old `atcProposalMessage.is` helper.
export const isProposalMessage = isAtcProposalMessage

const isAtcRunResultInfo = (x: unknown): x is AtcRunResultInfo => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.type) && isStr(o.description)
}

const isAtcRunResult = (x: unknown): x is AtcRunResult => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.id) &&
    isNum(o.timestamp) &&
    isArray(o.infos) &&
    (o.infos as unknown[]).every(isAtcRunResultInfo)
  )
}

const isAtcExemption = (x: unknown): x is AtcExemption => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.id) && isBool(o.justificationMandatory) && isStr(o.title)
}

const isAtcProperty = (x: unknown): x is AtcProperty => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.name) && (isBool(o.value) || isStr(o.value))
}

const isAtcCustomizing = (x: unknown): x is AtcCustomizing => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isArray(o.properties) &&
    (o.properties as unknown[]).every(isAtcProperty) &&
    isArray(o.excemptions) &&
    (o.excemptions as unknown[]).every(isAtcExemption)
  )
}

const isAtcObjectSet = (x: unknown): x is AtcObjectSet => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.name) && isStr(o.title) && isStr(o.kind)
}

const isAtcLink = (x: unknown): x is AtcLink => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.href) && isStr(o.rel) && isStr(o.type)
}

const isAtcFinding = (x: unknown): x is AtcFinding => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.uri) &&
    isUriParts(o.location) &&
    isNum(o.priority) &&
    isStr(o.checkId) &&
    isStr(o.checkTitle) &&
    isStr(o.messageId) &&
    isStr(o.messageTitle) &&
    isStr(o.exemptionApproval) &&
    isExemptionKind(o.exemptionKind) &&
    (o.quickfixInfo === undefined || isStr(o.quickfixInfo)) &&
    isAtcLink(o.link)
  )
}

const isAtcObject = (x: unknown): x is AtcObject => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.uri) &&
    isStr(o.type) &&
    isStr(o.name) &&
    isStr(o.packageName) &&
    isStr(o.author) &&
    (o.objectTypeId === undefined || isStr(o.objectTypeId)) &&
    isArray(o.findings) &&
    (o.findings as unknown[]).every(isAtcFinding)
  )
}

const isAtcWorkList = (x: unknown): x is AtcWorkList => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return (
    isStr(o.id) &&
    isNum(o.timestamp) &&
    isStr(o.usedObjectSet) &&
    isBool(o.objectSetIsComplete) &&
    isArray(o.objectSets) &&
    (o.objectSets as unknown[]).every(isAtcObjectSet) &&
    isArray(o.objects) &&
    (o.objects as unknown[]).every(isAtcObject)
  )
}

const isAtcUser = (x: unknown): x is AtcUser => {
  if (!isObject(x)) return false
  const o = x as Record<string, unknown>
  return isStr(o.id) && isStr(o.title)
}

const isAtcUserArray = (x: unknown): x is AtcUser[] =>
  isArray(x) && x.every(isAtcUser)

// Functions --------------------------------------------------------------

export async function atcCustomizing(h: AdtHTTP): Promise<AtcCustomizing> {
  const headers = {
    Accept: "application/xml, application/vnd.sap.atc.customizing-v1+xml"
  }
  const response = await h.request("/sap/bc/adt/atc/customizing", { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const properties = xmlArray(raw, "customizing", "properties", "property").map(
    xmlNodeAttr
  )
  const excemptions = xmlArray(
    raw,
    "customizing",
    "exemption",
    "reasons",
    "reason"
  ).map(xmlNodeAttr)
  const retval = { properties, excemptions }
  return validateShape(retval, isAtcCustomizing, "AtcCustomizing")
}

export async function atcCheckVariant(
  h: AdtHTTP,
  variant: string
): Promise<string> {
  const headers = { Accept: "text/plain" }
  const response = await h.request(
    `/sap/bc/adt/atc/worklists?checkVariant=${variant}`,
    { method: "POST", headers }
  )
  return response.body
}

export async function createAtcRun(
  h: AdtHTTP,
  variant: string,
  mainUrl: string,
  maxResults = 100
): Promise<AtcRunResult> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atc:run maximumVerdicts="${maxResults}" xmlns:atc="http://www.sap.com/adt/atc">
	<objectSets xmlns:adtcore="http://www.sap.com/adt/core">
		<objectSet kind="inclusive">
			<adtcore:objectReferences>
				<adtcore:objectReference adtcore:uri="${mainUrl}"/>
			</adtcore:objectReferences>
		</objectSet>
	</objectSets>
</atc:run>`
  const headers = {
    Accept: "application/xml",
    "Content-Type": "application/xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/runs?worklistId=${variant}`,
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const id = xmlNode(raw, "worklistRun", "worklistId")
  const ts = xmlNode(raw, "worklistRun", "worklistTimestamp")
  const infos = xmlArray(raw, "worklistRun", "infos", "info")
  const retval = { id, timestamp: new Date(ts).getTime() / 1000, infos }
  return validateShape(retval, isAtcRunResult, "AtcRunResult")
}

export async function atcWorklists(
  h: AdtHTTP,
  runResultId: string,
  timestamp?: number,
  usedObjectSet?: string,
  includeExemptedFindings = false
): Promise<AtcWorkList> {
  const headers = { Accept: "application/atc.worklist.v1+xml" }
  const qs = { timestamp, usedObjectSet, includeExemptedFindings }
  const response = await h.request(`/sap/bc/adt/atc/worklists/${runResultId}`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    numberParseOptions
  })
  const root = xmlNode(raw, "worklist")
  const attrs = xmlNodeAttr(root)
  const objectSets = xmlArray(root, "objectSets", "objectSet").map(xmlNodeAttr)
  const objects = xmlArray(root, "objects", "object").map(o => {
    const oa = xmlNodeAttr(o)
    const findings = xmlArray(o, "findings", "finding").map(f => {
      const fa = xmlNodeAttr(f)
      const priority = toInt(fa.priority)
      const link = xmlNodeAttr(xmlNode(f, "link"))
      const location = parseUri(fa.location)
      const messageTitle = fa.messageTitle
      const checkTitle = fa.checkTitle
      return {
        ...fa,
        priority,
        messageTitle,
        checkTitle,
        location,
        messageId: `${fa.messageId}`,
        link
      }
    })
    return { ...oa, findings }
  })
  const ts = new Date(attrs.timestamp).getTime() / 1000
  const result = { ...attrs, timestamp: ts, objectSets, objects }
  return validateShape(result, isAtcWorkList, "AtcWorkList")
}

export async function atcUsers(h: AdtHTTP): Promise<AtcUser[]> {
  const headers = { Accept: "application/atom+xml;type=feed" }
  const response = await h.request(`/sap/bc/adt/system/users`, { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const users = xmlArray(raw, "feed", "entry")
  return validateShape(users, isAtcUserArray, "AtcUser[]")
}

export async function atcExemptProposal(
  h: AdtHTTP,
  markerId: string
): Promise<AtcProposal | AtcProposalMessage> {
  const headers = {
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptapp.v1+xml"
  }
  const qs = { markerId }
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const root = xmlNode(raw, "exemptionApply", "exemptionProposal")
  const { message, type } = xmlNode(raw, "exemptionApply", "status") || {}
  if (isErrorMessageType(type)) throw adtException(message)
  if (message && type)
    return validateShape({ message, type }, isAtcProposalMessage, "AtcProposalMessage")
  const finding = isString(root.finding)
    ? root.finding
    : xmlNodeAttr(xmlNode(root, "finding"))
  if (!isString(finding)) {
    finding.priority = toInt(finding.priority)
    finding.checksum = toInt(finding.checksum)
    const qf = xmlNodeAttr(xmlNode(root, "finding", "quickfixes"))
    finding.quickfixes = {
      automatic: qf.automatic === "true",
      manual: qf.manual === "true",
      pseudo: qf.pseudo === "true"
    }
  }
  const {
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil
  } = root
  const { thisFinding, rangeOfFindings } = xmlNode(root, "restriction")
  const { restrictByObject, restrictByCheck } = rangeOfFindings
  const result = {
    finding,
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil,
    restriction: {
      enabled: thisFinding["@_enabled"] === "true",
      singlefinding: thisFinding["#text"] === "true",
      rangeOfFindings: {
        enabled: rangeOfFindings["@_enabled"] === "true",
        restrictByObject: {
          object: restrictByObject["@_object"] === "true",
          package: restrictByObject["@_package"] === "true",
          subobject: restrictByObject["@_subobject"] === "true",
          target: restrictByObject["#text"] || ""
        },
        restrictByCheck: {
          check: restrictByCheck["@_check"] === "true",
          message: restrictByCheck["@_message"] === "true",
          target: restrictByCheck["#text"] || ""
        }
      }
    }
  }
  return validateShape(result, isAtcProposal, "AtcProposal")
}

export async function atcDocumentation(h: AdtHTTP, docUri: string) {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }; 
  const response = await h.request(docUri, {
    headers,
    method: "GET"
  })

  return response;
}

export async function atcRequestExemption(
  h: AdtHTTP,
  proposal: AtcProposal
): Promise<AtcProposalMessage> {
  const headers = {
    "Content-Type": "application/atc.xmptprop.v1+xml",
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptprop.v1+xml"
  }
  const {
    finding,
    restriction: {
      rangeOfFindings: { restrictByCheck, restrictByObject }
    },
    restriction
  } = proposal
  const qs = { markerId: isString(finding) ? finding : finding.quickfixInfo }
  const findingXml = isString(finding)
    ? `<atcexmpt:finding>${finding}</atcexmpt:finding>`
    : `<atcfinding:finding adtcore:name="${finding.name}" adtcore:type="${
        finding.type
      }" adtcore:uri="${finding.uri}" 
    atcfinding:checkId="${finding.checkId}" atcfinding:checksum="${
        finding.checksum
      }" atcfinding:checkTitle="${encodeEntity(finding.checkTitle)}" 
    atcfinding:exemptionApproval="${
      finding.exemptionApproval
    }" atcfinding:exemptionKind="${finding.exemptionKind}" 
    atcfinding:lastChangedBy="${finding.lastChangedBy}" 
    atcfinding:location="${finding.location}" atcfinding:messageId="${
        finding.messageId
      }" atcfinding:messageTitle="${encodeEntity(finding.messageTitle)}" 
    atcfinding:priority="${finding.priority}" atcfinding:processor="${
        finding.processor
      }" atcfinding:quickfixInfo="${finding.quickfixInfo}">
      <atcfinding:quickfixes atcfinding:automatic="false" atcfinding:manual="false" atcfinding:pseudo="false" />
    </atcfinding:finding>`
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcexmpt:exemptionProposal xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcexmpt="http://www.sap.com/adt/atc/exemption" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      ${findingXml}
      <atcexmpt:package>${proposal.package}</atcexmpt:package>
      <atcexmpt:subObject>${proposal.subObject}</atcexmpt:subObject>
      <atcexmpt:subObjectType>${proposal.subObjectType}</atcexmpt:subObjectType>
      <atcexmpt:subObjectTypeDescr>${
        proposal.subObjectTypeDescr
      }</atcexmpt:subObjectTypeDescr>
      <atcexmpt:objectTypeDescr>${
        proposal.objectTypeDescr
      }</atcexmpt:objectTypeDescr>
      <atcexmpt:restriction>
        <atcexmpt:thisFinding enabled="${restriction.enabled}">${
    restriction.singlefinding
  }</atcexmpt:thisFinding>
        <atcexmpt:rangeOfFindings enabled="${
          restriction.rangeOfFindings.enabled
        }">
          <atcexmpt:restrictByObject object="${
            restrictByObject.object
          }" package="${restrictByObject.package}" subobject="${
    restrictByObject.subobject
  }">
          ${restrictByObject.target}</atcexmpt:restrictByObject>
          <atcexmpt:restrictByCheck check="${restrictByCheck.check}" message="${
    restrictByCheck.message
  }">
          ${restrictByCheck.target}</atcexmpt:restrictByCheck>
        </atcexmpt:rangeOfFindings>
      </atcexmpt:restriction>
      <atcexmpt:approver>${proposal.approver}</atcexmpt:approver>
      <atcexmpt:reason>${proposal.reason}</atcexmpt:reason>
      <atcexmpt:justification>${encodeEntity(
        proposal.justification
      )}</atcexmpt:justification>
      <atcexmpt:notify>${proposal.notify}</atcexmpt:notify>
      <atcexmpt:apprIsArea>${proposal.apprIsArea || ""}</atcexmpt:apprIsArea>
      <atcexmpt:checkClass>${proposal.checkClass || ""}</atcexmpt:checkClass>
      <atcexmpt:validUntil>${proposal.validUntil || ""}</atcexmpt:validUntil>
      </atcexmpt:exemptionProposal>`
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    body,
    qs,
    method: "POST"
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const result = validateShape(raw?.status, isAtcProposalMessage, "AtcProposalMessage")
  if (isErrorMessageType(result.type)) throw adtException(result.message)
  return validateShape(result, isAtcProposalMessage, "AtcProposalMessage")
}

export async function atcContactUri(
  h: AdtHTTP,
  findingUri: string
): Promise<string> {
  const headers = {
    "Content-Type": "application/vnd.sap.adt.atc.findingreferences.v1+xml",
    Accept: "application/vnd.sap.adt.atc.items.v1+xml"
  }
  const qs = { step: "proposal" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:findingReferences xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:findingReference adtcore:uri="${findingUri}"/>
    </atcfinding:findingReferences>`
  const response = await h.request(`/sap/bc/adt/atc/items`, {
    headers,
    body,
    method: "POST",
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const { uri } = xmlNodeAttr(xmlNode(raw, "items", "item"))
  return validateShape(uri, isStr, "string")
}

export async function atcChangeContact(
  h: AdtHTTP,
  itemUri: string,
  userId: string
): Promise<void> {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:items xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:item adtcore:uri="${itemUri}" atcfinding:processor="${userId}" atcfinding:status="2"/>
    </atcfinding:items>`
  await h.request(`/sap/bc/adt/atc/items`, { headers, body, method: "PUT" })
}
