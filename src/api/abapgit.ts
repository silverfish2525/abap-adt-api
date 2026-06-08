import { AdtHTTP } from "../AdtHTTP"
import {
  boolFromAbap,
  fullParse,
  xmlArray,
  xmlNode,
  xmlNodeAttr,
  stripNs,
  btoa,
  toXmlAttributes,
  encodeEntity,
  toInt,
  parse,
  XmlNode,
  XmlValue,
  asXmlNode
} from "../utilities"


import { adtException } from "../AdtException"

export interface GitLink {
  href: string
  rel: string
  type?:
  | "pull_link"
  | "stage_link"
  | "push_link"
  | "check_link"
  | "status_link"
  | "log_link"
  | string
}
export interface GitRepo {
  key: string
  sapPackage: string
  url: string
  branch_name: string
  created_by: string
  created_at: Date
  created_email?: string
  deserialized_by?: string
  deserialized_email?: string
  deserialized_at?: Date
  status?: string
  status_text?: string
  links: GitLink[]
}

export interface GitBranch {
  sha1: string
  name: string
  type: string
  is_head: boolean
  display_name: string
}
export interface GitExternalInfo {
  access_mode: "PUBLIC" | "PRIVATE"
  branches: GitBranch[]
}

export interface GitObject {
  obj_type: string
  obj_name: string
  package: string
  obj_status: string
  msg_type: string
  msg_text: string
}

export interface GitStagingFile {
  name: string
  path: string
  localState: string
  links: GitLink[]
}
export interface GitStagingObject {
  wbkey: string
  uri: string
  type: string
  name: string
  abapGitFiles: GitStagingFile[]
}

export interface GitUser {
  name: string
  email: string
}

export interface GitStaging {
  staged: GitStagingObject[]
  unstaged: GitStagingObject[]
  ignored: GitStagingObject[]
  comment: string
  author: GitUser
  committer: GitUser
}

/**
 * @deprecated since 1.2.1, duplicate of GitExternalInfo
 */
export interface GitRemoteInfo {
  access_mode: string
  branches: GitBranch[]
}

const parseDate = (d: string) => {
  const match = d.match(/(\d\d\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/)
  if (!match) return new Date() // wrong but valid
  const [Y, M, D, h, m, s] = match.slice(1)
  return new Date(Date.UTC(toInt(Y), toInt(M) - 1, toInt(D), toInt(h), toInt(m), toInt(s)))
}

export async function gitRepos(h: AdtHTTP) {
  const headers = { Accept: "application/abapgit.adt.repos.v2+xml" }
  const response = await h.request(`/sap/bc/adt/abapgit/repos`, { headers })
  const raw = parse(response.body, {
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    removeNSPrefix: true
  })
  return xmlArray(raw, "repositories", "repository").map((x: XmlNode) => {
    const key = String(x.key || "")
    const sapPackage = String(x.package || "")
    const url = String(x.url || "")
    const status = x.status ? String(x.status) : undefined
    const status_text = x.status_text ? String(x.status_text) : undefined
    // tslint:disable: variable-name
    const branch_name = String(x.branch_name || x.branchName || "")
    const created_by = String(x.created_by || x.createdBy || "")
    const created_at = String(x.created_at || x.createdAt || "")
    const created_email = x.created_email ? String(x.created_email) : x.createdEmail ? String(x.createdEmail) : undefined
    const deserialized_by = x.deserialized_by ? String(x.deserialized_by) : x.deserializedBy ? String(x.deserializedBy) : undefined
    const deserialized_email = x.deserialized_email ? String(x.deserialized_email) : x.deserializedEmail ? String(x.deserializedEmail) : undefined
    const deserialized_at = x.deserialized_at ? String(x.deserialized_at) : x.deserializedAt ? String(x.deserializedAt) : undefined
    const links = xmlArray(x, "link").map(node => {
      const attrs = xmlNodeAttr(node as XmlNode)
      return {
        href: String(attrs.href || ""),
        rel: String(attrs.rel || ""),
        type: attrs.type ? String(attrs.type) : undefined,
      }
    })
    const repo: GitRepo = {
      key,
      sapPackage,
      url,
      branch_name,
      created_by,
      created_at: parseDate(created_at),
      created_email,
      deserialized_by,
      deserialized_email,
      deserialized_at: deserialized_at ? parseDate(deserialized_at) : undefined,
      status,
      status_text,
      links,
    }
    return repo
  })
}

export async function externalRepoInfo(
  h: AdtHTTP,
  repourl: string,
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.info.ext.request.v2+xml",
    Accept: "application/abapgit.adt.repo.info.ext.response.v2+xml",
  }
  const body = `<?xml version="1.0" ?>
  <abapgitexternalrepo:externalRepoInfoRequest xmlns:abapgitexternalrepo="http://www.sap.com/adt/abapgit/externalRepo">
    <abapgitexternalrepo:url>${repourl}</abapgitexternalrepo:url>
    <abapgitexternalrepo:user>${user}</abapgitexternalrepo:user>
    <abapgitexternalrepo:password>${password}</abapgitexternalrepo:password>
  </abapgitexternalrepo:externalRepoInfoRequest>`

  const response = await h.request(`/sap/bc/adt/abapgit/externalrepoinfo`, {
    method: "POST", // encodeEntity?
    body,
    headers,
  })
  const raw = fullParse(response.body, { removeNSPrefix: true })
  // tslint:disable-next-line: variable-name
  const access_mode = String(xmlNode(raw, "externalRepoInfo", "accessMode") || "")
  const branches = xmlArray(
    raw,
    "externalRepoInfo",
    "branch"
  ).map((branch: XmlNode) => ({
    name: branch.name as string,
    type: branch.type as string,
    sha1: branch.sha1 as string,
    display_name: branch.displayName as string,
    is_head: boolFromAbap(branch && (branch.is_head as string)),
  }))
  return { access_mode, branches } as GitExternalInfo
}

const parseObjects = (body: string) => {
  const raw = fullParse(body)
  return xmlArray(raw, "objects", "object").map((r: XmlNode) => {
    const {
      type,
      name,
      package: pkg,
      status,
      msgType,
      msgText,
    } = r
    const obj: GitObject = {
      obj_type: type as string,
      obj_name: name as string,
      package: pkg as string,
      obj_status: status as string,
      msg_type: msgType as string,
      msg_text: msgText as string,
    }
    return obj
  })
}

export async function createRepo(
  h: AdtHTTP,
  packageName: string,
  repourl: string,
  branch = "refs/heads/master",
  transport = "",
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v3+xml",
  }
  const body = `<?xml version="1.0" ?>
  <abapgitrepo:repository xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">
    <abapgitrepo:package>${packageName}</abapgitrepo:package>
    <abapgitrepo:url>${repourl}</abapgitrepo:url>
    <abapgitrepo:branchName>${branch}</abapgitrepo:branchName>
    <abapgitrepo:transportRequest>${transport}</abapgitrepo:transportRequest>
    <abapgitrepo:remoteUser>${user}</abapgitrepo:remoteUser>
    <abapgitrepo:remotePassword>${password}</abapgitrepo:remotePassword>
  </abapgitrepo:repository>`
  const response = await h.request(`/sap/bc/adt/abapgit/repos`, {
    method: "POST",
    body,
    headers, // encodeEntity?
  })

  return parseObjects(response.body)
}

export async function pullRepo(
  h: AdtHTTP,
  repoId: string,
  branch = "refs/heads/master",
  transport = "",
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v3+xml",
  }
  branch = `<abapgitrepo:branchName>${branch}</abapgitrepo:branchName>`
  transport = transport
    ? `<abapgitrepo:transportRequest>${transport}</abapgitrepo:transportRequest>`
    : ""
  user = user ? `<abapgitrepo:remoteUser>${user}</abapgitrepo:remoteUser>` : ""
  password = password ? `<abapgitrepo:remotePassword>${password}</abapgitrepo:remotePassword>` : ""
  const body = `<?xml version="1.0" ?><abapgitrepo:repository xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories">
    ${branch}${transport}${user}${password}</abapgitrepo:repository>`
  const response = await h.request(`/sap/bc/adt/abapgit/repos/${repoId}/pull`, {
    method: "POST",
    body,
    headers,
  })

  return parseObjects(response.body)
}

export async function unlinkRepo(h: AdtHTTP, repoId: string) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v3+xml",
  }
  await h.request(`/sap/bc/adt/abapgit/repos/${repoId}`, {
    method: "DELETE",
    headers,
  })
}
const deserializeStaging = (body: string) => {
  const raw = xmlNode(fullParse(body), "abapgitstaging:abapgitstaging") as XmlNode
  const parsefile = (x: XmlNode) =>
  ({
    ...stripNs(xmlNodeAttr(x)),
    links: xmlArray(x, "atom:link")
      .map(xmlNodeAttr)
      .map(stripNs)
      .map((l) => ({ ...l, href: l.href })),
  } as GitStagingFile)
  const parseObject = (x: XmlNode) => {
    const attrs = stripNs(xmlNodeAttr(x))
    const abapGitFiles = xmlArray(x, "abapgitstaging:abapgitfile").map(
      parsefile
    )
    return { ...attrs, abapGitFiles } as GitStagingObject
  }

  const unstaged = xmlArray(
    raw,
    "abapgitstaging:unstaged_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const staged = xmlArray(
    raw,
    "abapgitstaging:staged_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const ignored = xmlArray(
    raw,
    "abapgitstaging:ignored_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const commentNode = xmlNode(raw, "abapgitstaging:abapgit_comment") as XmlNode
  const extractUser = (p: string) =>
    stripNs(xmlNodeAttr(asXmlNode(xmlNode(commentNode, p)))) as GitUser
  const comment = (commentNode["@_abapgitstaging:comment"] as string) || ""
  const author = extractUser("abapgitstaging:author")
  const committer = extractUser("abapgitstaging:author")
  const result: GitStaging = {
    staged,
    unstaged,
    ignored,
    comment,
    author,
    committer,
  }
  return result
}

const serializeStaging = (s: GitStaging) => {
  const formatFile = (f: GitStagingFile) => {
    const { links, ...rest } = f
    return `  <abapgitstaging:abapgitfile ${toXmlAttributes(
      rest,
      "abapgitstaging"
    )}>${links
      .map((l) => ({ ...l, href: encodeEntity(l.href) }))
      .map((l) => `<atom:link ${toXmlAttributes(l, "")}/>`)
      .join("")}
  </abapgitstaging:abapgitfile>`
  }

  const formatObject = (obj: GitStagingObject) => {
    const { abapGitFiles, wbkey, ...rest } = obj
    return `<abapgitstaging:abapgitobject ${toXmlAttributes(
      rest,
      "adtcore"
    )} abapgitstaging:wbkey="${obj.wbkey}">
    ${obj.abapGitFiles.map(formatFile).join("")}
 </abapgitstaging:abapgitobject>`
  }
  const formatObjects = (objects: GitStagingObject[], root: string) => {
    if (!objects.length) return `<${root}/>`
    return `<${root}>${objects.map(formatObject).join("")}</${root}>`
  }

  const unstaged = formatObjects(s.unstaged, "abapgitstaging:unstaged_objects")
  const staged = formatObjects(s.staged, "abapgitstaging:staged_objects")
  const ignored = formatObjects(s.ignored, "abapgitstaging:ignored_objects")
  const comment = `<abapgitstaging:abapgit_comment abapgitstaging:comment="${s.comment}">
  <abapgitstaging:author abapgitstaging:name="${s.author.name}" abapgitstaging:email="${s.author.email}"/>
  <abapgitstaging:committer abapgitstaging:name="${s.committer.name}" abapgitstaging:email="${s.committer.email}"/>
</abapgitstaging:abapgit_comment>
`

  return `<?xml version="1.0" encoding="UTF-8"?>
  <abapgitstaging:abapgitstaging xmlns:abapgitstaging="http://www.sap.com/adt/abapgit/staging"
         xmlns:adtcore="http://www.sap.com/adt/core"
         xmlns:atom="http://www.w3.org/2005/Atom">
  ${unstaged}
  ${staged}
  ${ignored}
  ${comment}
  </abapgitstaging:abapgitstaging>`
}

export async function checkRepo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const clink = repo.links.find((l) => l.type === "check_link")
  if (!clink?.href) throw adtException("Check link not found")
  const headers: any = {
    Accept: "text/plain",
  }
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)
  await h.request(clink.href, { method: "POST", headers })
}

export async function pushRepo(
  h: AdtHTTP,
  repo: GitRepo,
  staging: GitStaging,
  user = "",
  password = ""
) {
  const link = repo.links.find((l) => l.type === "push_link")
  if (!link?.href) throw adtException("Push link not found")
  const headers: any = {
    Accept: "application/abapgit.adt.repo.stage.v1+xml",
  }
  headers["Content-Type"] = headers.Accept
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)
  const body = serializeStaging(staging)

  await h.request(link.href, { method: "POST", headers, body })
}

export async function stageRepo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const link = repo.links.find((l) => l.type === "stage_link")
  if (!link?.href) throw adtException("Stage link not found")
  const headers: any = {
    "Content-Type": "application/abapgit.adt.repo.stage.v1+xml",
  }
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)

  const resp = await h.request(link.href, { headers })
  return deserializeStaging(resp.body)
}

/**
 * @deprecated since 1.2.1, duplicate of externalRepoInfo
 */
export async function remoteRepoInfo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const headers: any = {
    "Content-Type": "application/abapgit.adt.repo.info.ext.request.v1+xml",
    Accept: "application/abapgit.adt.repo.info.ext.response.v1+xml",
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<repository_ext>
<url>${repo.url}</url>
<user>${user}</user>
<password>${password}</password>
</repository_ext>`

  const resp = await h.request("/sap/bc/adt/abapgit/externalrepoinfo", {
    headers,
    body,
    method: "POST",
  })
  const raw = parse(resp.body)?.repository_external as XmlNode
  const { access_mode, branches } = raw
  return {
    access_mode: String(access_mode || ""),
    branches: xmlArray<GitBranch>(branches, "branch"),
  } as GitRemoteInfo
}

export async function switchRepoBranch(
  h: AdtHTTP,
  repo: GitRepo,
  branch: string,
  create = false,
  user = "",
  password = ""
) {
  const headers: any = {}
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)

  await h.request(
    `/sap/bc/adt/abapgit/repos/${repo.key}/branches/${encodeURIComponent(
      branch
    )}?create=${create}`,
    {
      headers,
      method: "POST",
    }
  )
}
