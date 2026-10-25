// suyus-contact: reveals a portfolio's email address only to visitors who pass Cloudflare Turnstile.
//
// Portfolio files store `emailEncrypted` (RSA-OAEP, encrypted with the public key in
// src/contact/public-key.json). Neither the repository nor the built site contains a readable
// address. This Worker holds the private key, so decryption only happens after a valid,
// single-use Turnstile token has been checked server-side.
//
// POST /reveal  { token: string, ciphertext: "v1.<base64url>" }  →  { email }
//
// Secrets: TURNSTILE_SECRET, EMAIL_PRIVATE_KEY (JWK JSON)
// Vars:    ALLOWED_ORIGINS (comma-separated), ALLOWED_HOSTNAMES (comma-separated, optional)

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const list = (value) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  })
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

let privateKey
async function getPrivateKey(env) {
  privateKey ??= await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env.EMAIL_PRIVATE_KEY),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  )
  return privateKey
}

async function verifyTurnstile(token, request, env) {
  const form = new FormData()
  form.append("secret", env.TURNSTILE_SECRET)
  form.append("response", token)
  const ip = request.headers.get("CF-Connecting-IP")
  if (ip) form.append("remoteip", ip)

  const result = await (await fetch(SITEVERIFY_URL, { method: "POST", body: form })).json()
  if (!result.success) return false
  const hostnames = list(env.ALLOWED_HOSTNAMES)
  return hostnames.length === 0 || hostnames.includes(result.hostname)
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? ""
    const originAllowed = list(env.ALLOWED_ORIGINS).includes(origin)
    const cors = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : { Vary: "Origin" }

    if (request.method === "OPTIONS") return new Response(null, { status: originAllowed ? 204 : 403, headers: cors })

    const { pathname } = new URL(request.url)
    if (request.method !== "POST" || pathname !== "/reveal") return json({ error: "Not found" }, 404, cors)
    if (!originAllowed) return json({ error: "Origin not allowed" }, 403, cors)

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors)
    }
    const { token, ciphertext } = body ?? {}
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return json({ error: "Missing verification token" }, 400, cors)
    }
    if (typeof ciphertext !== "string" || !ciphertext.startsWith("v1.") || ciphertext.length > 1024) {
      return json({ error: "Invalid encrypted email" }, 400, cors)
    }

    if (!(await verifyTurnstile(token, request, env))) return json({ error: "Verification failed" }, 403, cors)

    try {
      const plain = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        await getPrivateKey(env),
        fromBase64Url(ciphertext.slice(3))
      )
      const email = new TextDecoder().decode(plain)
      if (!EMAIL_RE.test(email)) throw new Error("not an email")
      return json({ email }, 200, cors)
    } catch {
      return json({ error: "Could not decrypt this email address" }, 422, cors)
    }
  },
}
