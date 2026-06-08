import { type InferTypedSchema, aunitResult } from "@abapify/adt-schemas"
import { z } from "zod"
import { validateShape } from ".."
import { AdtHTTP } from "../AdtHTTP"
import { asXmlNode, fullParse, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"
import { parseUri, UriParts } from "./urlparser"

type AunitRunResult = InferTypedSchema<typeof aunitResult>["runResult"]
type AunitProgram = NonNullable<NonNullable<AunitRunResult["program"]>[number]>
type AunitClassSchema = NonNullable<
  NonNullable<NonNullable<AunitProgram["testClasses"]>["testClass"]>[number]
>
type AunitMethodSchema = NonNullable<
  NonNullable<NonNullable<AunitClassSchema["testMethods"]>["testMethod"]>[number]
>
type AunitAlertSchema = NonNullable<
  NonNullable<NonNullable<AunitMethodSchema["alerts"]>["alert"]>[number]
>
type AunitStackEntrySchema = NonNullable<
  NonNullable<NonNullable<AunitAlertSchema["stack"]>["stackEntry"]>[number]
>

export type UnitTestStackEntry = {
  "adtcore:uri": NonNullable<AunitStackEntrySchema["uri"]>
  "adtcore:type": NonNullable<AunitStackEntrySchema["type"]>
  "adtcore:name": NonNullable<AunitStackEntrySchema["name"]>
  "adtcore:description": NonNullable<AunitStackEntrySchema["description"]>
}

export enum UnitTestAlertKind {
  exception = "exception",
  failedAssertion = "failedAssertion",
  warning = "warning"
}
export enum UnitTestSeverity {
  critical = "critical",
  fatal = "fatal",
  tolerable = "tolerable",
  tolerant = "tolerant"
}
export interface UnitTestAlert {
  kind: UnitTestAlertKind
  severity: UnitTestSeverity
  details: string[]
  stack: UnitTestStackEntry[]
  title: string
}
export type UnitTestMethod = {
  "adtcore:uri": NonNullable<AunitMethodSchema["uri"]>
  "adtcore:type": ""
  "adtcore:name": NonNullable<AunitMethodSchema["name"]>
  executionTime: number
  uriType: NonNullable<AunitMethodSchema["uriType"]>
  navigationUri?: string
  unit: NonNullable<AunitMethodSchema["unit"]>
  alerts: UnitTestAlert[]
}

export type UnitTestClass = {
  "adtcore:uri": NonNullable<AunitClassSchema["uri"]>
  "adtcore:type": ""
  "adtcore:name": NonNullable<AunitClassSchema["name"]>
  uriType: NonNullable<AunitClassSchema["uriType"]>
  navigationUri?: string
  durationCategory: NonNullable<AunitClassSchema["durationCategory"]>
  riskLevel: NonNullable<AunitClassSchema["riskLevel"]>
  testmethods: UnitTestMethod[]
  alerts: UnitTestAlert[]
}

export const UnitTestOccurrenceMarker = z.object({
  kind: z.string(),
  keepsResult: z.boolean(),
  location: UriParts
})
export type UnitTestOccurrenceMarker = z.infer<typeof UnitTestOccurrenceMarker>

export const isUriParts = (x: unknown): x is UriParts => UriParts.safeParse(x).success

export const isUnitTestOccurrenceMarker = (
  x: unknown
): x is UnitTestOccurrenceMarker => UnitTestOccurrenceMarker.safeParse(x).success

const UnitTestOccurrenceMarkerArray = z.array(UnitTestOccurrenceMarker)

const arrayOrEmpty = <T>(items: T[] | undefined): T[] => items ?? []

const toAlertKind = (kind?: string): UnitTestAlertKind => {
  switch (kind) {
    case UnitTestAlertKind.exception:
      return UnitTestAlertKind.exception
    case UnitTestAlertKind.failedAssertion:
      return UnitTestAlertKind.failedAssertion
    default:
      return UnitTestAlertKind.warning
  }
}

const toUnitTestSeverity = (severity?: string): UnitTestSeverity => {
  switch (severity) {
    case UnitTestSeverity.critical:
      return UnitTestSeverity.critical
    case UnitTestSeverity.fatal:
      return UnitTestSeverity.fatal
    case UnitTestSeverity.tolerable:
      return UnitTestSeverity.tolerable
    default:
      return UnitTestSeverity.tolerant
  }
}

const parseDetail = (alert: AunitAlertSchema): string[] =>
  arrayOrEmpty(alert.details?.detail)
    .map(detail => detail.text ?? "")
    .filter(Boolean)

const parseStack = (alert: AunitAlertSchema): UnitTestStackEntry[] =>
  arrayOrEmpty(alert.stack?.stackEntry).map(entry => ({
    "adtcore:uri": entry.uri ?? "",
    "adtcore:type": entry.type ?? "",
    "adtcore:name": entry.name ?? "",
    "adtcore:description": entry.description ?? ""
  }))

const parseAlert = (alert: AunitAlertSchema): UnitTestAlert => ({
  kind: toAlertKind(alert.kind),
  severity: toUnitTestSeverity(alert.severity),
  details: parseDetail(alert),
  stack: parseStack(alert),
  title: alert.title ?? ""
})

const parseMethod = (method: AunitMethodSchema): UnitTestMethod => ({
  "adtcore:uri": method.uri ?? "",
  "adtcore:type": "",
  "adtcore:name": method.name ?? "",
  executionTime: Number(method.executionTime ?? 0),
  uriType: method.uriType ?? "",
  unit: method.unit ?? "",
  alerts: arrayOrEmpty(method.alerts?.alert).map(parseAlert)
})

const parseClass = (clas: AunitClassSchema): UnitTestClass => ({
  "adtcore:uri": clas.uri ?? "",
  "adtcore:type": "",
  "adtcore:name": clas.name ?? "",
  uriType: clas.uriType ?? "",
  durationCategory: clas.durationCategory ?? "",
  riskLevel: clas.riskLevel ?? "",
  testmethods: arrayOrEmpty(clas.testMethods?.testMethod).map(parseMethod),
  alerts: arrayOrEmpty(clas.alerts?.alert).map(parseAlert)
})

export interface UnitTestRunFlags {
  harmless: boolean
  dangerous: boolean
  critical: boolean
  short: boolean
  medium: boolean
  long: boolean
}

export const DefaultUnitTestRunFlags: UnitTestRunFlags = {
  harmless: true,
  dangerous: false,
  critical: false,
  short: true,
  medium: false,
  long: false
}

export async function runUnitTest(
  h: AdtHTTP,
  url: string,
  flags: UnitTestRunFlags = DefaultUnitTestRunFlags
) {
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false"/>
    <testRiskLevels harmless="${flags.harmless}" dangerous="${flags.dangerous}" critical="${flags.critical}"/>
    <testDurations short="${flags.short}" medium="${flags.medium}" long="${flags.long}"/>
    <withNavigationUri enabled="true"/>    
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
        <adtcore:objectReference adtcore:uri="${url}"/>
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`
  const response = await h.request("/sap/bc/adt/abapunit/testruns", {
    method: "POST",
    headers,
    body
  })
  const raw = aunitResult.parse(response.body)

  return arrayOrEmpty(raw.runResult.program).flatMap(program =>
    arrayOrEmpty(program.testClasses?.testClass).map(parseClass)
  )
}

export async function unitTestEvaluation(
  h: AdtHTTP,
  clas: UnitTestClass,
  flags: UnitTestRunFlags = DefaultUnitTestRunFlags
) {
  const headers = { "Content-Type": "application/*l", Accept: "application/*" }
  const references = clas.testmethods
    .map(m => `<adtcore:objectReference adtcore:uri="${m["adtcore:uri"]}" />`)
    .join("\n")
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
      <options>
          <uriType value="${clas.uriType}"></uriType>
          <testDeterminationStrategy sameProgram="true" assignedTests="false"></testDeterminationStrategy>
          <testRiskLevels harmless="${flags.harmless}" dangerous="${flags.dangerous}" critical="${flags.critical}"/>
          <testDurations short="${flags.short}" medium="${flags.medium}" long="${flags.long}"/>      
          <withNavigationUri enabled="true"></withNavigationUri>
      </options>
      <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
          <objectSet kind="inclusive">
              <adtcore:objectReferences>
              ${references}
              </adtcore:objectReferences>
          </objectSet>
      </adtcore:objectSets>
  </aunit:runConfiguration>`
  const response = await h.request("/sap/bc/adt/abapunit/testruns/evaluation", {
    method: "POST",
    headers,
    body
  })

  const raw = aunitResult.parse(response.body)
  return arrayOrEmpty(raw.runResult.program).flatMap(program =>
    arrayOrEmpty(program.testClasses?.testClass).flatMap(clas =>
      arrayOrEmpty(clas.testMethods?.testMethod).map(parseMethod)
    )
  )
}

export async function unitTestOccurrenceMarkers(
  h: AdtHTTP,
  uri: string,
  source: string
): Promise<UnitTestOccurrenceMarker[]> {
  const headers = { "Content-Type": "text/plain", Accept: "application/*" }
  const response = await h.request("/sap/bc/adt/abapsource/occurencemarkers", {
    method: "POST",
    headers,
    body: source,
    qs: { uri }
  })
  const raw = fullParse(response.body, { removeNSPrefix: true })
  const markers = xmlArray(
    raw,
    "occurrenceInfo",
    "occurrences",
    "occurrence"
  ).map(o => {
    const { kind, keepsResult } = xmlNodeAttr(o)
    const { uri } = xmlNodeAttr(asXmlNode(xmlNode(o, "objectReference")))
    return { kind, keepsResult, location: parseUri(String(uri ?? "")) }
  })

  return validateShape(markers, UnitTestOccurrenceMarkerArray, "UnitTestOccurrenceMarker[]")
}
