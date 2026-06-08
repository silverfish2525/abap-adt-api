import { expect, test } from "vitest"
import { ADTClient } from "../AdtClient"
import { parseServiceBinding, servicePreviewUrl } from "../"

type UaaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  jti?: string
}

const adtCp = process.env.ADT_CP ? JSON.parse(process.env.ADT_CP) : {}

const {
  refreshToken = "",
  clientId = "",
  clientSecret = "",
  uaaUrl = "",
  url = "",
  user = "",
  repopkg = "",
  repouser = "",
  repopwd = "",
  bindingName = ""
} = adtCp as { [key: string]: string }

let oldToken: string = ""

const fetchToken = async () => {
  oldToken = oldToken || await refreshAccessToken()
  return oldToken
}

const refreshAccessToken = async () => {
  const response = await fetch(`${uaaUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    throw new Error(`OAuth token refresh failed: ${response.status} ${response.statusText}`)
  }

  const token = await response.json() as UaaTokenResponse
  if (!token.access_token) {
    throw new Error("OAuth token refresh failed: missing access_token in response")
  }

  return token.access_token
}
test("abapgit repos on CF", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const repos = await client.gitRepos()
  const repo = repos.find(r => r.sapPackage === repopkg)
  expect(repo).toBeDefined()
  const staged = await client.stageRepo(repo!, repouser, repopwd)
  expect(staged).toBeDefined()
  await client.checkRepo(repo!, repouser, repopwd)

  const branches = await client.remoteRepoInfo(repo!, repouser, repopwd)

  expect(
    branches.branches.map(b => b.display_name).find(n => n === "master")
  ).toBe("master")

  // commented out as would commit at every jest run...
  // staged.comment = "Commit from test"
  // staged.staged = staged.unstaged
  // staged.unstaged = []
  // await client.pushRepo(repo!, staged, repouser, repopwd)
})

test("read table", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const data = await client.tableContents("/DMO/TRAVEL", 2)

  expect(data.values.length).toBe(3)
  expect(data.columns[0].name in data.values[0]).toBeTruthy()

})

test("run SQL", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const data = await client.runQuery("SELECT TRAVEL_ID,CUSTOMER_ID,STATUS FROM /DMO/TRAVEL", 2)

  expect(data.values.length).toBe(2)
  expect(data.columns.length).toBe(3)
  expect(data.columns[0].name).toBe("TRAVEL_ID")
  expect(data.values[0].TRAVEL_ID).toBeTruthy()
})

test("service bindings", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const source = await client.getObjectSource(`/sap/bc/adt/businessservices/bindings/${bindingName}`)
  const binding = parseServiceBinding(source)
  expect(binding.name.toLowerCase()).toBe(bindingName.toLowerCase())

  const bdetails = await client.bindingDetails(binding)

  // not much of a test as we don't know the details
  expect(bdetails.services.length).toBeGreaterThan(0)
  const collections = bdetails.services[0].serviceInformation.collection
  expect(collections.length).toBeGreaterThan(0)

  const previewLinks = collections.map(c => servicePreviewUrl(bdetails.services[0], c.name))
  for (const l of previewLinks) expect(l).toMatch(/https:\/\//i)

})