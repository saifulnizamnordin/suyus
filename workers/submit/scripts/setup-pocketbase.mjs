// Creates the PocketBase collections used by the suyus-submit Worker. Safe to run again: existing
// collections are left alone.
//
//   SUYUS_POCKETBASE_URL=https://pb.example.com \
//   SUYUS_POCKETBASE_ADMIN_EMAIL=you@example.com SUYUS_POCKETBASE_ADMIN_PASSWORD=… \
//   node workers/submit/scripts/setup-pocketbase.mjs
//
// Every API rule is null (closed): only superusers, i.e. the Worker, can read or write these records.

const url = (process.env.SUYUS_POCKETBASE_URL ?? "").replace(/\/+$/, "")
const email = process.env.SUYUS_POCKETBASE_ADMIN_EMAIL
const password = process.env.SUYUS_POCKETBASE_ADMIN_PASSWORD
if (!url || !email || !password) {
  console.error("Set SUYUS_POCKETBASE_URL, SUYUS_POCKETBASE_ADMIN_EMAIL and SUYUS_POCKETBASE_ADMIN_PASSWORD.")
  process.exit(1)
}

async function call(method, path, body, token) {
  const res = await fetch(url + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

const auth = await call("POST", "/api/collections/_superusers/auth-with-password", { identity: email, password })
if (auth.status !== 200) {
  console.error(`Superuser sign-in failed (HTTP ${auth.status}): ${auth.data?.message ?? ""}`)
  process.exit(1)
}
const token = auth.data.token

const closed = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
const timestamps = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
]

async function ensure(definition) {
  const existing = await call("GET", `/api/collections/${definition.name}`, null, token)
  if (existing.status === 200) {
    console.log(`= ${definition.name} already exists (id ${existing.data.id}), left as is`)
    return existing.data
  }
  const created = await call("POST", "/api/collections", definition, token)
  if (created.status !== 200) {
    console.error(`✗ ${definition.name}: HTTP ${created.status} ${JSON.stringify(created.data)}`)
    process.exit(1)
  }
  console.log(`+ ${definition.name} created (id ${created.data.id})`)
  return created.data
}

const submitters = await ensure({
  name: "submitters",
  type: "base",
  ...closed,
  fields: [
    { name: "githubId", type: "number", required: true, onlyInt: true, min: 1 },
    { name: "githubLogin", type: "text", max: 39 },
    { name: "name", type: "text", max: 200 },
    // Not `hidden`: the Worker (superuser) must read it. The closed API rules keep everyone else out.
    { name: "token", type: "text" },
    { name: "scopes", type: "text" },
    ...timestamps,
  ],
  indexes: ["CREATE UNIQUE INDEX idx_submitters_github_id ON submitters (githubId)"],
})

await ensure({
  name: "portfolio_drafts",
  type: "base",
  ...closed,
  fields: [
    { name: "user", type: "relation", collectionId: submitters.id, maxSelect: 1, required: true, cascadeDelete: true },
    { name: "data", type: "json", maxSize: 200000 },
    { name: "step", type: "number", onlyInt: true, min: 0, max: 20 },
    { name: "prUrl", type: "url" },
    { name: "prNumber", type: "number", onlyInt: true },
    { name: "submitted", type: "date" },
    ...timestamps,
  ],
  indexes: ["CREATE UNIQUE INDEX idx_portfolio_drafts_user ON portfolio_drafts (user)"],
})

console.log("Done.")
