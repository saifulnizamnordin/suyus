// Generates the RSA key pair used to encrypt portfolio email addresses.
//
//   public key  → src/contact/public-key.json (committed; used by the site and encrypt script)
//   private key → workers/contact/.secrets/email-private-key.json (git-ignored; upload to the Worker)
//
// Rotating the key makes every existing `emailEncrypted` value unreadable, so this refuses to
// overwrite an existing private key unless you pass --force.
// Usage (from the repo root): node workers/contact/scripts/generate-keys.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

const PRIVATE_PATH = "workers/contact/.secrets/email-private-key.json"
const PUBLIC_PATH = "src/contact/public-key.json"

if (existsSync(PRIVATE_PATH) && !process.argv.includes("--force")) {
  console.error(`${PRIVATE_PATH} already exists. Re-run with --force to replace it (existing encrypted emails will stop working).`)
  process.exit(1)
}

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["encrypt", "decrypt"]
)

const kid = new Date().toISOString().slice(0, 10)
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid }
const privateJwk = { ...(await crypto.subtle.exportKey("jwk", privateKey)), kid }

for (const path of [PRIVATE_PATH, PUBLIC_PATH]) mkdirSync(dirname(path), { recursive: true })
writeFileSync(PRIVATE_PATH, JSON.stringify(privateJwk))
writeFileSync(PUBLIC_PATH, JSON.stringify(publicJwk, null, 2) + "\n")

console.log(`Public key  → ${PUBLIC_PATH} (commit this)`)
console.log(`Private key → ${PRIVATE_PATH} (keep it secret; back it up somewhere safe)`)
console.log("Upload the private key: cd workers/contact && npx wrangler secret put EMAIL_PRIVATE_KEY < .secrets/email-private-key.json")
