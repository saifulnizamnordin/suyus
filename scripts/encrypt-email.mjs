// Encrypts an email address for the `emailEncrypted` field of a portfolio.
// Only the suyus-contact Worker can decrypt it, after the visitor passes a Turnstile check.
//
// Usage: npm run encrypt-email -- you@example.com
// Encryption happens locally with the public key; nothing is sent anywhere.
import { readFileSync } from "node:fs"

const email = process.argv[2]?.trim()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run encrypt-email -- you@example.com")
  process.exit(1)
}

const jwk = JSON.parse(readFileSync(new URL("../src/contact/public-key.json", import.meta.url), "utf8"))
const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"])
const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(email)))
const base64url = Buffer.from(encrypted).toString("base64url")

console.log(`emailEncrypted: v1.${base64url}`)
