// Helpers for suyus.pb.js. PocketBase runs every hook handler in its own isolated VM, so handlers
// `require()` this file instead of sharing top-level functions.

const API = "https://api.github.com"
const MAX_MARKDOWN = 100000
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/

function upstreamRepo() {
  const repo = ($os.getenv("SUYUS_REPO") || "saifulnizamnordin/suyus").trim()
  const [owner, name] = repo.split("/")
  if (!owner || !name) throw new Error("SUYUS_REPO must look like owner/name")
  return { owner, name, full: `${owner}/${name}` }
}

function gh(token, method, path, body) {
  const res = $http.send({
    url: path.startsWith("http") ? path : API + path,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "suyus-submit-form",
      "Content-Type": "application/json",
    },
    body: body === undefined ? "" : JSON.stringify(body),
    timeout: 30,
  })
  return { status: res.statusCode, json: res.json }
}

function ghMessage(res) {
  const j = res.json || {}
  const extra = Array.isArray(j.errors) ? j.errors.map((x) => x.message || x.code).filter(Boolean).join("; ") : ""
  return `${j.message || "GitHub error"} (HTTP ${res.status})${extra ? `: ${extra}` : ""}`
}

// UTF-8 safe base64 (the JS VM has no btoa/Buffer).
function base64(text) {
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00)
        i++
      }
    }
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63]
    out += i + 1 < bytes.length ? abc[(n >> 6) & 63] : "="
    out += i + 2 < bytes.length ? abc[n & 63] : "="
  }
  return out
}

function findOne(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params)
  } catch (_) {
    return null
  }
}

/** Saves the GitHub token and identity after a successful GitHub sign-in. */
function storeGithubAuth(e) {
  if (e.providerName !== "github" || !e.record || !e.oAuth2User) return
  const app = e.app
  const u = e.oAuth2User

  const record = e.record
  if (u.username) record.set("githubLogin", String(u.username).toLowerCase())
  if (u.id) record.set("githubId", parseInt(u.id, 10))
  if (!record.get("name") && u.name) record.set("name", u.name)
  app.save(record)

  if (!u.accessToken) return
  let token = findOne(app, "github_tokens", "user = {:user}", { user: record.id })
  if (!token) {
    token = new Record(app.findCollectionByNameOrId("github_tokens"))
    token.set("user", record.id)
  }
  token.set("token", u.accessToken)
  app.save(token)
}

/** POST /api/suyus/submit — commits the portfolio file to the user's fork and opens (or updates) a PR. */
function submit(e) {
  const app = e.app
  const auth = e.auth
  const body = e.requestInfo().body || {}
  const markdown = String(body.markdown || "").replace(/\r\n/g, "\n")
  if (!markdown.startsWith("---\n") || markdown.length > MAX_MARKDOWN) {
    throw new BadRequestError("The portfolio file is empty, too large or missing its frontmatter.")
  }

  const tokenRecord = findOne(app, "github_tokens", "user = {:user}", { user: auth.id })
  if (!tokenRecord) throw new UnauthorizedError("Sign in with GitHub again to submit.")
  const token = tokenRecord.get("token")

  // 1. Who is this? The token decides the file name, never the request body.
  const me = gh(token, "GET", "/user")
  if (me.status === 401) {
    app.delete(tokenRecord)
    throw new UnauthorizedError("Your GitHub sign-in has expired. Sign in again to submit.")
  }
  if (me.status !== 200) throw new BadRequestError(ghMessage(me))
  const login = String(me.json.login)
  const username = login.toLowerCase()
  if (!USERNAME_RE.test(username)) throw new BadRequestError(`"${login}" isn't a valid username for a portfolio.`)

  const githubField = markdown.match(/^github:\s*["']?([A-Za-z0-9-]+)["']?\s*$/m)
  if (!githubField || githubField[1].toLowerCase() !== username) {
    throw new BadRequestError(`The file's github field must be "${username}", the account you signed in with.`)
  }
  if (auth.get("githubLogin") !== username || auth.get("githubId") !== me.json.id) {
    auth.set("githubLogin", username)
    auth.set("githubId", me.json.id)
    app.save(auth)
  }

  // 2. Upstream repository and the commit to branch from.
  const up = upstreamRepo()
  const repo = gh(token, "GET", `/repos/${up.full}`)
  if (repo.status !== 200) throw new BadRequestError(`Can't read ${up.full}: ${ghMessage(repo)}`)
  const base = repo.json.default_branch
  const baseRef = gh(token, "GET", `/repos/${up.full}/git/ref/heads/${base}`)
  if (baseRef.status !== 200) throw new BadRequestError(ghMessage(baseRef))
  const baseSha = baseRef.json.object.sha

  // 3. Where the branch lives: the user's fork (the repo owner can't fork their own repo, so they use upstream).
  let headRepo = up.full
  let headOwner = up.owner
  if (username !== up.owner.toLowerCase()) {
    const fork = gh(token, "POST", `/repos/${up.full}/forks`, { default_branch_only: true })
    if (fork.status !== 202 && fork.status !== 200) {
      throw new BadRequestError(
        `GitHub didn't let Suyus fork the repository for you: ${ghMessage(fork)}. Sign in again and allow access to public repositories.`
      )
    }
    headRepo = fork.json.full_name
    headOwner = fork.json.owner.login
    for (let i = 0; i < 20; i++) {
      // Forks are created asynchronously.
      if (gh(token, "GET", `/repos/${headRepo}/git/ref/heads/${base}`).status === 200) break
      sleep(1500)
    }
  }

  const branch = `suyus/portfolio-${username}`
  const head = `${headOwner}:${branch}`
  const path = `src/content/portfolios/${username}.md`

  const open = gh(token, "GET", `/repos/${up.full}/pulls?state=open&head=${encodeURIComponent(head)}`)
  const existingPr = open.status === 200 && open.json.length ? open.json[0] : null

  // 4. Point the branch at upstream's latest commit, unless an open PR already uses it (then add a commit to it).
  if (!existingPr) {
    const setBranch = () => {
      const current = gh(token, "GET", `/repos/${headRepo}/git/ref/heads/${branch}`)
      return current.status === 200
        ? gh(token, "PATCH", `/repos/${headRepo}/git/refs/heads/${branch}`, { sha: baseSha, force: true })
        : gh(token, "POST", `/repos/${headRepo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha })
    }
    let ref = setBranch()
    if (ref.status !== 200 && ref.status !== 201 && headRepo !== up.full) {
      gh(token, "POST", `/repos/${headRepo}/merge-upstream`, { branch: base }) // bring the fork up to date, then retry
      ref = setBranch()
    }
    if (ref.status !== 200 && ref.status !== 201) throw new BadRequestError(`Couldn't create the branch: ${ghMessage(ref)}`)
  }

  // 5. Commit the file.
  const existingFile = gh(token, "GET", `/repos/${headRepo}/contents/${path}?ref=${encodeURIComponent(branch)}`)
  const isUpdate = gh(token, "GET", `/repos/${up.full}/contents/${path}?ref=${encodeURIComponent(base)}`).status === 200
  const put = gh(token, "PUT", `/repos/${headRepo}/contents/${path}`, {
    message: `${isUpdate ? "Update" : "Add"} portfolio for @${login} (via the suy.us form)`,
    content: base64(markdown.endsWith("\n") ? markdown : markdown + "\n"),
    branch,
    sha: existingFile.status === 200 ? existingFile.json.sha : undefined,
  })
  if (put.status !== 200 && put.status !== 201) throw new BadRequestError(`Couldn't save the file: ${ghMessage(put)}`)

  // 6. Open the pull request.
  let pr = existingPr
  if (!pr) {
    const created = gh(token, "POST", `/repos/${up.full}/pulls`, {
      title: `${isUpdate ? "Update" : "Add"} portfolio: ${login}`,
      head,
      base,
      maintainer_can_modify: true,
      body:
        `${isUpdate ? "Updates" : "Adds"} \`${path}\`.\n\n` +
        `Submitted by @${login} with the form at https://suy.us/submit/form.\n` +
        `Live after merge: https://suy.us/p/${username}\n`,
    })
    if (created.status === 201) pr = created.json
    else {
      const again = gh(token, "GET", `/repos/${up.full}/pulls?state=open&head=${encodeURIComponent(head)}`)
      if (again.status === 200 && again.json.length) pr = again.json[0]
      else throw new BadRequestError(`Couldn't open the pull request: ${ghMessage(created)}`)
    }
  }

  // 7. Remember the PR on the draft so the form can show it later.
  const draft = findOne(app, "portfolio_drafts", "user = {:user}", { user: auth.id })
  if (draft) {
    draft.set("prUrl", pr.html_url)
    draft.set("prNumber", pr.number)
    draft.set("submitted", new Date().toISOString())
    app.save(draft)
  }

  return e.json(200, {
    login: username,
    prUrl: pr.html_url,
    prNumber: pr.number,
    updatedExistingPr: Boolean(existingPr),
    repo: up.full,
  })
}

/** DELETE /api/suyus/token — forget the stored GitHub token. */
function forgetToken(e) {
  const token = findOne(e.app, "github_tokens", "user = {:user}", { user: e.auth.id })
  if (token) e.app.delete(token)
  return e.json(200, { ok: true })
}

module.exports = { storeGithubAuth, submit, forgetToken }
