// suyus-submit: the backend of the submission form at https://suy.us/submit/form.
//
//   GET  /auth/github?return=/submit/form   start GitHub sign-in (OAuth App, scopes read:user public_repo)
//   GET  /auth/callback                      GitHub redirects here; saves the token, sends the user back with a session
//   GET  /health                             { ok: true }
//   GET  /me                                 the signed-in GitHub account
//   GET  /draft      PUT /draft              the form's saved progress (GET also reports prState: open/merged/closed)
//   POST /submit     { markdown }            fork the repo as the user, commit their file, open (or update) the PR
//   POST /logout     { forget?: boolean }    forget=true revokes Suyus's GitHub access and deletes the stored token
//
// Data lives in PocketBase (collections created by scripts/setup-pocketbase.mjs). Their API rules are all closed:
// only this Worker, signed in as a superuser, can read or write them. GitHub tokens never reach a browser.
// The browser holds a signed session (HMAC, 30 days) that names the PocketBase record; nothing else.
//
// Secrets: GITHUB_CLIENT_SECRET, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, SESSION_SECRET
// Vars:    GITHUB_CLIENT_ID, PB_URL, SITE_URL, ALLOWED_ORIGINS, SUYUS_REPO

const GH_API = "https://api.github.com"
const SCOPES = ["read:user", "public_repo"]
const SESSION_DAYS = 30
const MAX_MARKDOWN = 100_000
const MAX_DRAFT = 200_000
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/
const UA = "suyus-submit (+https://suy.us)"

// ---------------------------------------------------------------- small helpers

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0))

function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  })
}

function cors(request, env) {
  const origin = request.headers.get("Origin")
  if (!origin || !list(env.ALLOWED_ORIGINS).includes(origin)) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

// ---------------------------------------------------------------- signed values (sessions and OAuth state)

async function hmacKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(500, "SESSION_SECRET is not set")
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

async function sign(env, payload) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(body))
  return `${body}.${b64url(sig)}`
}

async function verify(env, value, kind) {
  const [body, sig] = String(value ?? "").split(".")
  if (!body || !sig) return null
  let ok = false
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(sig), new TextEncoder().encode(body))
  } catch {
    return null
  }
  if (!ok) return null
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)))
  if (payload.k !== kind || !(payload.exp > Date.now())) return null
  return payload
}

// ---------------------------------------------------------------- PocketBase (as superuser)

let pbToken = null
let pbTokenUntil = 0

async function pbAuth(env, force) {
  if (!force && pbToken && Date.now() < pbTokenUntil) return pbToken
  const res = await fetch(`${env.PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new HttpError(502, "The form's database is unavailable (sign-in failed).")
  pbToken = (await res.json()).token
  pbTokenUntil = Date.now() + 30 * 60 * 1000
  return pbToken
}

async function pb(env, method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(env.PB_URL + path, {
      method,
      headers: { Authorization: await pbAuth(env, attempt > 0), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 401 && attempt === 0) continue
    const data = res.status === 204 ? null : await res.json().catch(() => null)
    if (!res.ok && res.status !== 404) throw new HttpError(502, `Database error: ${data?.message ?? res.status}`)
    return res.status === 404 ? null : data
  }
}

async function findOne(env, collection, filter) {
  const q = new URLSearchParams({ filter, perPage: "1", skipTotal: "1" })
  const page = await pb(env, "GET", `/api/collections/${collection}/records?${q}`)
  return page?.items?.[0] ?? null
}

const records = (collection) => `/api/collections/${collection}/records`

// ---------------------------------------------------------------- GitHub

async function gh(token, method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : GH_API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, json: data }
}

function ghMessage(res) {
  const j = res.json ?? {}
  const extra = Array.isArray(j.errors) ? j.errors.map((x) => x.message || x.code).filter(Boolean).join("; ") : ""
  return `${j.message ?? "GitHub error"} (HTTP ${res.status})${extra ? `: ${extra}` : ""}`
}

function upstream(env) {
  const [owner, name] = (env.SUYUS_REPO || "saifulnizamnordin/suyus").split("/")
  return { owner, name, full: `${owner}/${name}` }
}

// ---------------------------------------------------------------- sign-in

function safeReturn(value) {
  return typeof value === "string" && /^\/(?!\/)[\w\-./]*$/.test(value) ? value : "/submit/form"
}

async function startAuth(request, env) {
  const url = new URL(request.url)
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const state = await sign(env, { k: "state", n: nonce, r: safeReturn(url.searchParams.get("return")), exp: Date.now() + 10 * 60 * 1000 })
  const authorize = new URL("https://github.com/login/oauth/authorize")
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID)
  authorize.searchParams.set("redirect_uri", `${url.origin}/auth/callback`)
  authorize.searchParams.set("scope", SCOPES.join(" "))
  authorize.searchParams.set("state", state)
  authorize.searchParams.set("allow_signup", "true")
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.href,
      "Set-Cookie": `suyus_oauth=${nonce}; Path=/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  })
}

async function finishAuth(request, env) {
  const url = new URL(request.url)
  const state = await verify(env, url.searchParams.get("state"), "state")
  const back = (hash) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${env.SITE_URL}${state?.r ?? "/submit/form"}#${hash}`,
        "Set-Cookie": "suyus_oauth=; Path=/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
        "Cache-Control": "no-store",
      },
    })
  const fail = (message) => back(`error=${encodeURIComponent(message)}`)

  const cookieNonce = /(?:^|;\s*)suyus_oauth=([^;]+)/.exec(request.headers.get("Cookie") ?? "")?.[1]
  if (!state || !cookieNonce || cookieNonce !== state.n) return fail("The sign-in expired or was started in another browser. Please try again.")
  if (url.searchParams.get("error")) return fail("GitHub sign-in was cancelled.")

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get("code"),
      redirect_uri: `${url.origin}/auth/callback`,
    }),
  })
  const tokenData = await tokenRes.json().catch(() => ({}))
  if (!tokenData.access_token) return fail(`GitHub sign-in failed: ${tokenData.error_description ?? tokenData.error ?? tokenRes.status}`)
  const scopes = list(tokenData.scope)
  if (!scopes.includes("public_repo") && !scopes.includes("repo")) {
    return fail("Suyus needs access to public repositories to open the pull request for you. Please sign in again and allow it.")
  }

  const me = await gh(tokenData.access_token, "GET", "/user")
  if (me.status !== 200) return fail(`Couldn't read your GitHub account: ${ghMessage(me)}`)

  const fields = {
    githubId: me.json.id,
    githubLogin: String(me.json.login).toLowerCase(),
    name: me.json.name ?? "",
    token: tokenData.access_token,
    scopes: scopes.join(" "),
  }
  const existing = await findOne(env, "submitters", `githubId=${Number(me.json.id)}`)
  const record = existing
    ? await pb(env, "PATCH", `${records("submitters")}/${existing.id}`, fields)
    : await pb(env, "POST", records("submitters"), fields)

  const session = await sign(env, { k: "session", sub: record.id, exp: Date.now() + SESSION_DAYS * 86400_000 })
  return back(`session=${session}`)
}

async function currentUser(request, env) {
  const header = request.headers.get("Authorization") ?? ""
  const session = await verify(env, header.replace(/^Bearer\s+/i, ""), "session")
  if (!session) throw new HttpError(401, "Please sign in with GitHub.")
  const user = await pb(env, "GET", `${records("submitters")}/${session.sub}`)
  if (!user || !user.token) throw new HttpError(401, "Please sign in with GitHub again.")
  return user
}

const publicUser = (u) => ({ id: u.id, githubLogin: u.githubLogin, githubId: u.githubId, name: u.name })

// ---------------------------------------------------------------- drafts

const findDraft = (env, user) => findOne(env, "portfolio_drafts", `user="${user.id}"`)

const publicDraft = (d, prState = "") =>
  d ? { data: d.data, step: d.step, prUrl: d.prUrl || "", prNumber: d.prNumber || 0, submitted: d.submitted || "", prState } : null

// The saved draft, plus what happened to its pull request. Once that PR is merged or closed it no longer takes new
// commits, so the draft forgets it (the next submit opens a fresh PR) and the form is told why.
async function loadDraft(env, user) {
  let draft = await findDraft(env, user)
  if (!draft?.prNumber || !user.token) return publicDraft(draft, draft?.prNumber ? "open" : "")
  const pr = await gh(user.token, "GET", `/repos/${upstream(env).full}/pulls/${draft.prNumber}`)
  if (pr.status !== 200) return publicDraft(draft, "open") // can't tell; keep it as is
  if (pr.json.state === "open") return publicDraft(draft, "open")
  const prState = pr.json.merged_at ? "merged" : "closed"
  const number = draft.prNumber
  const url = draft.prUrl
  draft = await pb(env, "PATCH", `${records("portfolio_drafts")}/${draft.id}`, { prUrl: "", prNumber: 0 })
  return { ...publicDraft(draft, prState), prUrl: url, prNumber: number }
}

async function saveDraft(request, env, user) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid draft.")
  const data = body.data ?? {}
  if (JSON.stringify(data).length > MAX_DRAFT) throw new HttpError(413, "This draft is too large.")
  const step = Math.max(0, Math.min(20, Number.parseInt(body.step, 10) || 0))
  const existing = await findDraft(env, user)
  const saved = existing
    ? await pb(env, "PATCH", `${records("portfolio_drafts")}/${existing.id}`, { data, step })
    : await pb(env, "POST", records("portfolio_drafts"), { user: user.id, data, step })
  return publicDraft(saved)
}

// ---------------------------------------------------------------- submit

async function submit(request, env, user) {
  const body = await request.json().catch(() => ({}))
  const markdown = String(body.markdown ?? "").replace(/\r\n/g, "\n")
  if (!markdown.startsWith("---\n") || markdown.length > MAX_MARKDOWN) {
    throw new HttpError(400, "The portfolio file is empty, too large or missing its frontmatter.")
  }
  const token = user.token

  // 1. Who is this? The token decides the file name, never the request.
  const me = await gh(token, "GET", "/user")
  if (me.status === 401) {
    await pb(env, "PATCH", `${records("submitters")}/${user.id}`, { token: "" })
    throw new HttpError(401, "Your GitHub sign-in has expired. Please sign in again.")
  }
  if (me.status !== 200) throw new HttpError(502, ghMessage(me))
  const login = String(me.json.login)
  const username = login.toLowerCase()
  if (!USERNAME_RE.test(username)) throw new HttpError(400, `"${login}" isn't a valid username for a portfolio.`)
  const githubField = /^github:\s*["']?([A-Za-z0-9-]+)["']?\s*$/m.exec(markdown)
  if (!githubField || githubField[1].toLowerCase() !== username) {
    throw new HttpError(400, `The file's github field must be "${username}", the account you signed in with.`)
  }
  if (user.githubLogin !== username) await pb(env, "PATCH", `${records("submitters")}/${user.id}`, { githubLogin: username })

  // 2. Upstream and the commit to branch from.
  const up = upstream(env)
  const repo = await gh(token, "GET", `/repos/${up.full}`)
  if (repo.status !== 200) throw new HttpError(502, `Can't read ${up.full}: ${ghMessage(repo)}`)
  const base = repo.json.default_branch
  const baseRef = await gh(token, "GET", `/repos/${up.full}/git/ref/heads/${base}`)
  if (baseRef.status !== 200) throw new HttpError(502, ghMessage(baseRef))
  const baseSha = baseRef.json.object.sha

  // 3. The user's fork. The repo owner can't fork their own repo, so their branch lives upstream.
  let headRepo = up.full
  let headOwner = up.owner
  if (username !== up.owner.toLowerCase()) {
    const fork = await gh(token, "POST", `/repos/${up.full}/forks`, { default_branch_only: true })
    if (fork.status !== 202 && fork.status !== 200) {
      throw new HttpError(403, `GitHub didn't let Suyus fork the repository for you: ${ghMessage(fork)}`)
    }
    headRepo = fork.json.full_name
    headOwner = fork.json.owner.login
    for (let i = 0; i < 10; i++) {
      if ((await gh(token, "GET", `/repos/${headRepo}/git/ref/heads/${base}`)).status === 200) break
      await sleep(1500) // forks are created asynchronously
    }
  }

  const branch = `suyus/portfolio-${username}`
  const head = `${headOwner}:${branch}`
  const path = `src/content/portfolios/${username}.md`
  const openPrs = await gh(token, "GET", `/repos/${up.full}/pulls?state=open&head=${encodeURIComponent(head)}`)
  const existingPr = openPrs.status === 200 && openPrs.json.length ? openPrs.json[0] : null

  // 4. Start the branch from upstream's latest commit, unless an open PR already uses it (then add a commit).
  if (!existingPr) {
    const setBranch = async () => {
      const current = await gh(token, "GET", `/repos/${headRepo}/git/ref/heads/${branch}`)
      return current.status === 200
        ? gh(token, "PATCH", `/repos/${headRepo}/git/refs/heads/${branch}`, { sha: baseSha, force: true })
        : gh(token, "POST", `/repos/${headRepo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha })
    }
    const ok = (r) => r.status === 200 || r.status === 201
    let ref = await setBranch()
    if (!ok(ref) && headRepo !== up.full) {
      // Usually the fork is behind upstream and the missing commits touch .github/workflows/. GitHub won't let
      // a token without the `workflow` scope (we only ask for public_repo) bring those into the fork, and says
      // "Not Found". Try syncing the fork; if GitHub refuses that too, only the user can, with one click.
      const sync = await gh(token, "POST", `/repos/${headRepo}/merge-upstream`, { branch: base })
      ref = ok(sync) ? await setBranch() : ref
      if (!ok(ref)) {
        throw new HttpError(
          409,
          `Your copy of Suyus on GitHub is out of date, and GitHub only lets you update it yourself. ` +
            `Open https://github.com/${headRepo}, click "Sync fork" and then "Update branch", ` +
            `then come back and press Submit again. Your draft is saved.`
        )
      }
    }
    if (!ok(ref)) throw new HttpError(502, `Couldn't create the branch: ${ghMessage(ref)}`)
  }

  // 5. Commit the file.
  const existingFile = await gh(token, "GET", `/repos/${headRepo}/contents/${path}?ref=${encodeURIComponent(branch)}`)
  const isUpdate = (await gh(token, "GET", `/repos/${up.full}/contents/${path}?ref=${encodeURIComponent(base)}`)).status === 200
  const put = await gh(token, "PUT", `/repos/${headRepo}/contents/${path}`, {
    message: `${isUpdate ? "Update" : "Add"} portfolio for @${login} (via the suy.us form)`,
    content: base64Utf8(markdown.endsWith("\n") ? markdown : `${markdown}\n`),
    branch,
    sha: existingFile.status === 200 ? existingFile.json.sha : undefined,
  })
  if (put.status !== 200 && put.status !== 201) throw new HttpError(502, `Couldn't save the file: ${ghMessage(put)}`)

  // 6. The pull request.
  let pr = existingPr
  if (!pr) {
    const created = await gh(token, "POST", `/repos/${up.full}/pulls`, {
      title: `${isUpdate ? "Update" : "Add"} portfolio: ${login}`,
      head,
      base,
      maintainer_can_modify: true,
      body:
        `${isUpdate ? "Updates" : "Adds"} \`${path}\`.\n\n` +
        `Submitted by @${login} with the form at ${env.SITE_URL}/submit/form.\n` +
        `Live after merge: ${env.SITE_URL}/p/${username}\n`,
    })
    if (created.status === 201) pr = created.json
    else {
      const again = await gh(token, "GET", `/repos/${up.full}/pulls?state=open&head=${encodeURIComponent(head)}`)
      if (again.status === 200 && again.json.length) pr = again.json[0]
      else throw new HttpError(502, `Couldn't open the pull request: ${ghMessage(created)}`)
    }
  }

  // 7. Remember the PR on the draft.
  const draft = await findDraft(env, user)
  if (draft) {
    await pb(env, "PATCH", `${records("portfolio_drafts")}/${draft.id}`, {
      prUrl: pr.html_url,
      prNumber: pr.number,
      submitted: new Date().toISOString(),
    })
  }

  return { login: username, prUrl: pr.html_url, prNumber: pr.number, updatedExistingPr: Boolean(existingPr), repo: up.full }
}

async function logout(request, env, user) {
  const body = await request.json().catch(() => ({}))
  if (body.forget && user.token) {
    // Revoke the whole authorization, so GitHub asks again next time.
    await fetch(`${GH_API}/applications/${env.GITHUB_CLIENT_ID}/grant`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        Accept: "application/vnd.github+json",
        "User-Agent": UA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: user.token }),
    }).catch(() => {})
    await pb(env, "PATCH", `${records("submitters")}/${user.id}`, { token: "", scopes: "" })
  }
  return { ok: true }
}

// ---------------------------------------------------------------- router

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = cors(request, env)
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })

    try {
      if (request.method === "GET" && url.pathname === "/auth/github") return await startAuth(request, env)
      if (request.method === "GET" && url.pathname === "/auth/callback") return await finishAuth(request, env)
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true }, 200, corsHeaders)

      // Everything else is called by the form with a session.
      if (!corsHeaders["Access-Control-Allow-Origin"]) throw new HttpError(403, "Origin not allowed.")
      const route = `${request.method} ${url.pathname}`
      const user = await currentUser(request, env)
      if (route === "GET /me") return json(publicUser(user), 200, corsHeaders)
      if (route === "GET /draft") return json({ draft: await loadDraft(env, user) }, 200, corsHeaders)
      if (route === "PUT /draft") return json({ draft: await saveDraft(request, env, user) }, 200, corsHeaders)
      if (route === "POST /submit") return json(await submit(request, env, user), 200, corsHeaders)
      if (route === "POST /logout") return json(await logout(request, env, user), 200, corsHeaders)
      throw new HttpError(404, "Not found.")
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error(err)
      return json({ message: status === 500 ? "Something went wrong. Please try again." : err.message }, status, corsHeaders)
    }
  },
}
