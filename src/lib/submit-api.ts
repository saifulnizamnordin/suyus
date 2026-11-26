// Client for the suyus-submit Worker (workers/submit), the backend of the submission form.
// The browser keeps only a signed session; the GitHub token stays server-side.

export const SUBMIT_API_URL: string = (import.meta.env.PUBLIC_SUBMIT_API_URL ?? "https://submit.suy.us").replace(/\/+$/, "")

const SESSION_KEY = "suyus_session"

export interface Me {
  id: string
  githubLogin: string
  githubId: number
  name: string
}

export interface Draft {
  data: unknown
  step: number
  prUrl: string
  prNumber: number
  submitted: string
}

export interface SubmitResult {
  login: string
  prUrl: string
  prNumber: number
  updatedExistingPr: boolean
  repo: string
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const getSession = () => storage()?.getItem(SESSION_KEY) ?? null
export const clearSession = () => storage()?.removeItem(SESSION_KEY)

/** Picks up `#session=…` or `#error=…` after the GitHub sign-in redirect and cleans the address bar. */
export function takeAuthResult(): { error?: string } {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const session = hash.get("session")
  const error = hash.get("error")
  if (session || error) history.replaceState(null, "", window.location.pathname + window.location.search)
  if (session) storage()?.setItem(SESSION_KEY, session)
  return error ? { error } : {}
}

export function signInUrl(returnPath = "/submit/form") {
  return `${SUBMIT_API_URL}/auth/github?return=${encodeURIComponent(returnPath)}`
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = getSession()
  let res: Response
  try {
    res = await fetch(SUBMIT_API_URL + path, {
      method: init.method ?? "GET",
      headers: {
        ...(session ? { Authorization: `Bearer ${session}` } : {}),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Couldn't reach Suyus. Check your connection and try again.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status}).`)
  }
  return data as T
}

/** True when the Worker answers; the form shows "not available yet" otherwise. */
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${SUBMIT_API_URL}/health`, { cache: "no-store" })
    return res.ok
  } catch {
    return false
  }
}
