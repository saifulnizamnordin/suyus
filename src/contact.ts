import publicKey from "./contact/public-key.json"

// Email reveal: the contact Worker (workers/contact) checks a Turnstile token, then decrypts
// the portfolio's `emailEncrypted`. Until a Turnstile site key is set, the Email button is hidden.
// PUBLIC_* env vars override these for local testing.
export const contact = {
  apiUrl: import.meta.env.PUBLIC_CONTACT_API_URL ?? "https://contact.suy.us/reveal",
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "",
  publicKey: publicKey as JsonWebKey,
}

export const contactEnabled = Boolean(contact.apiUrl && contact.turnstileSiteKey)
