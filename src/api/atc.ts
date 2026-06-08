import { z } from "zod"
import { AdtHTTP } from "../AdtHTTP"
import {
  Clean,
  XmlNode,
  asXmlNode,
  encodeEntity,
  fullParse,
  isString,
  numberParseOptions,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { adtException, isErrorMessageType, validateShape } from ".."
import { parseUri, UriParts } from "./urlparser"

export type ExemptionKind = string

const StrictOptionalString = z.string().optional()
const noPresentUndefined =
  (keys: string[], kind: string) =>
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

const ProposalFindingQuickfixes = z
  .object({
    automatic: z.boolean().optional(),
    manual: z.boolean().optional(),
    pseudo: z.boolean().optional()
  })
  .superRefine(noPresentUndefined(["automatic", "manual", "pseudo"], "boolean"))

export const ProposalFinding = z.object({
  uri: z.string(),
  type: z.string(),
  name: z.string(),
  location: z.string(),
  processor: z.string(),
  lastChangedBy: z.string(),
  priority: z.number(),
  checkId: z.string(),
  checkTitle: z.string(),
  messageId: z.string(),
  messageTitle: z.string(),
  exemptionApproval: z.string(),
  exemptionKind: z.string(),
  checksum: z.number(),
  quickfixInfo: z.string(),
  quickfixes: ProposalFindingQuickfixes.optional()
})
export type ProposalFinding = z.infer<typeof ProposalFinding>

export const RestrictByObjectInner = z.object({
  object: z.boolean(),
  package: z.boolean(),
  subobject: z.boolean(),
  target: z.union([
    z.literal("subobject"),
    z.literal("object"),
    z.literal("package"),
    z.literal("")
  ])
})
export type RestrictByObjectInner = z.infer<typeof RestrictByObjectInner>

export const RestrictByCheckInner = z.object({
  check: z.boolean(),
  message: z.boolean(),
  target: z.union([z.literal("message"), z.literal("check"), z.literal("")])
})
export type RestrictByCheckInner = z.infer<typeof RestrictByCheckInner>

export const AtcRestriction = z.object({
  enabled: z.boolean(),
  singlefinding: z.boolean(),
  rangeOfFindings: z.object({
    enabled: z.boolean(),
    restrictByObject: RestrictByObjectInner,
    restrictByCheck: RestrictByCheckInner
  })
})
export type AtcRestriction = z.infer<typeof AtcRestriction>

export const AtcProposal = z
  .object({
    finding: z.union([ProposalFinding, z.string()]),
    package: z.string(),
    subObject: z.string(),
    subObjectType: z.string(),
    subObjectTypeDescr: z.string(),
    objectTypeDescr: z.string(),
    approver: z.string(),
    reason: z.union([z.literal("FPOS"), z.literal("OTHR"), z.literal("")]),
    justification: z.string(),
    notify: z.union([
      z.literal("never"),
      z.literal("on_rejection"),
      z.literal("always")
    ]),
    restriction: AtcRestriction,
    apprIsArea: StrictOptionalString,
    checkClass: StrictOptionalString,
    validUntil: StrictOptionalString
  })
  .superRefine(noPresentUndefined(["apprIsArea", "checkClass", "validUntil"], "string"))
export type AtcProposal = z.infer<typeof AtcProposal>

export const isAtcProposal = (x: unknown): x is AtcProposal =>
  AtcProposal.safeParse(x).success

export const AtcProposalMessage = z.object({
  type: z.string(),
  message: z.string()
})
export type AtcProposalMessage = z.infer<typeof AtcProposalMessage>

export const isAtcProposalMessage = (x: unknown): x is AtcProposalMessage =>
  AtcProposalMessage.safeParse(x).success

export const isProposalMessage = isAtcProposalMessage

export interface RestrictByObject {
  object: boolean
  package: boolean
  subobject: boolean
  text: string
}

export const AtcRunResultInfo = z.object({
  type: z.string(),
  description: z.string()
})
export type AtcRunResultInfo = z.infer<typeof AtcRunResultInfo>

export const AtcRunResult = z.object({
  id: z.string(),
  timestamp: z.number(),
  infos: z.array(AtcRunResultInfo)
})
export type AtcRunResult = z.infer<typeof AtcRunResult>

export const AtcExemption = z.object({
  id: z.string(),
  justificationMandatory: z.boolean(),
  title: z.string()
})
export type AtcExemption = z.infer<typeof AtcExemption>

export const AtcProperty = z.object({
  name: z.string(),
  value: z.union([z.boolean(), z.string()])
})
export type AtcProperty = z.infer<typeof AtcProperty>

export const AtcCustomizing = z.object({
  properties: z.array(AtcProperty),
  excemptions: z.array(AtcExemption)
})
export type AtcCustomizing = z.infer<typeof AtcCustomizing>

export const AtcObjectSet = z.object({
  name: z.string(),
  title: z.string(),
  kind: z.string()
})
export type AtcObjectSet = z.infer<typeof AtcObjectSet>

export const AtcLink = z.object({
  href: z.string(),
  rel: z.string(),
  type: z.string()
})
export type AtcLink = z.infer<typeof AtcLink>

export const AtcFinding = z
  .object({
    uri: z.string(),
    location: UriParts,
    priority: z.number(),
    checkId: z.string(),
    checkTitle: z.string(),
    messageId: z.string(),
    messageTitle: z.string(),
    exemptionApproval: z.string(),
    exemptionKind: z.string(),
    quickfixInfo: StrictOptionalString,
    link: AtcLink
  })
  .superRefine(noPresentUndefined(["quickfixInfo"], "string"))
export type AtcFinding = z.infer<typeof AtcFinding>

export const AtcObject = z
  .object({
    uri: z.string(),
    type: z.string(),
    name: z.string(),
    packageName: z.string(),
    author: z.string(),
    objectTypeId: StrictOptionalString,
    findings: z.array(AtcFinding)
  })
  .superRefine(noPresentUndefined(["objectTypeId"], "string"))
export type AtcObject = z.infer<typeof AtcObject>

export const AtcWorkList = z.object({
  id: z.string(),
  timestamp: z.number(),
  usedObjectSet: z.string(),
  objectSetIsComplete: z.boolean(),
  objectSets: z.array(AtcObjectSet),
  objects: z.array(AtcObject)
})
export type AtcWorkList = z.infer<typeof AtcWorkList>

export const AtcUser = z.object({
  id: z.string(),
  title: z.string()
})
export type AtcUser = z.infer<typeof AtcUser>

const AtcUserArray = z.array(AtcUser)
const StringSchema = z.string()

export type AtcRunResultClean = Clean<AtcRunResult>
export type AtcCustomizingClean = Clean<AtcCustomizing>
export type AtcWorkListClean = Clean<AtcWorkList>
export type AtcUserClean = Clean<AtcUser>
export type AtcProposalClean = Clean<AtcProposal>
export type AtcProposalMessageClean = Clean<AtcProposalMessage>

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
  return validateShape(
    { properties, excemptions },
    AtcCustomizing,
    "AtcCustomizing"
  )
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
  const id = String(xmlNode(raw, "worklistRun", "worklistId") || "")
  const ts = String(xmlNode(raw, "worklistRun", "worklistTimestamp") || "")
  const infos = xmlArray(raw, "worklistRun", "infos", "info")
  return validateShape(
    {
      id,
      timestamp: new Date(ts).getTime() / 1000,
      infos
    },
    AtcRunResult,
    "AtcRunResult"
  )
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
  const root = xmlNode(raw, "worklist") as XmlNode
  const attrs = xmlNodeAttr(root) as Record<string, any>
  const objectSets = xmlArray(root, "objectSets", "objectSet").map(xmlNodeAttr)
  const objects = xmlArray(root, "objects", "object").map(o => {
    const oa = xmlNodeAttr(o)
    const findings = xmlArray(o, "findings", "finding").map(f => {
      const fa = xmlNodeAttr(f) as Record<string, any>
      const priority = toInt(fa.priority)
      const link = xmlNodeAttr(asXmlNode(xmlNode(f, "link")))
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
  return validateShape(
    { ...attrs, timestamp: ts, objectSets, objects },
    AtcWorkList,
    "AtcWorkList"
  )
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
  return validateShape(users, AtcUserArray, "AtcUser[]")
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
  const root = xmlNode(raw, "exemptionApply", "exemptionProposal") as XmlNode
  const { message, type } = (xmlNode(raw, "exemptionApply", "status") as XmlNode) || {}
  if (isErrorMessageType(String(type || ""))) throw adtException(String(message || ""))
  if (message && type) {
    return validateShape({ message, type }, AtcProposalMessage, "AtcProposalMessage")
  }
  const finding = isString(root.finding)
    ? root.finding
    : (xmlNodeAttr(asXmlNode(xmlNode(root, "finding"))) as Record<string, any>)
  if (!isString(finding)) {
    finding.priority = toInt(finding.priority)
    finding.checksum = toInt(finding.checksum)
    const qf = xmlNodeAttr(asXmlNode(xmlNode(root, "finding", "quickfixes"))) as Record<string, any>
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
  const { thisFinding, rangeOfFindings } = (xmlNode(root, "restriction") as XmlNode)
  const thisFindingNode = thisFinding as XmlNode
  const rangeOfFindingsNode = rangeOfFindings as XmlNode
  const { restrictByObject, restrictByCheck } = rangeOfFindingsNode as XmlNode
  const restrictByObjectNode = restrictByObject as XmlNode
  const restrictByCheckNode = restrictByCheck as XmlNode
  return validateShape({
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
      enabled: thisFindingNode["@_enabled"] === "true",
      singlefinding: thisFindingNode["#text"] === "true",
      rangeOfFindings: {
        enabled: rangeOfFindingsNode["@_enabled"] === "true",
        restrictByObject: {
          object: restrictByObjectNode["@_object"] === "true",
          package: restrictByObjectNode["@_package"] === "true",
          subobject: restrictByObjectNode["@_subobject"] === "true",
          target: String(restrictByObjectNode["#text"] || "")
        },
        restrictByCheck: {
          check: restrictByCheckNode["@_check"] === "true",
          message: restrictByCheckNode["@_message"] === "true",
          target: String(restrictByCheckNode["#text"] || "")
        }
      }
    }
  }, AtcProposal, "AtcProposal")
}

export async function atcDocumentation(h: AdtHTTP, docUri: string) {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }
  const response = await h.request(docUri, {
    headers,
    method: "GET"
  })

  return response
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
  const result = validateShape(raw?.status, AtcProposalMessage, "AtcProposalMessage")
  if (isErrorMessageType(result.type)) throw adtException(result.message)
  return validateShape(result, AtcProposalMessage, "AtcProposalMessage")
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
  const { uri } = xmlNodeAttr(asXmlNode(xmlNode(raw, "items", "item"))) as Record<string, string>
  return validateShape(uri, StringSchema, "string")
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
