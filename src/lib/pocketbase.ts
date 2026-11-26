import PocketBase, { type RecordModel } from "pocketbase"

// Set PUBLIC_POCKETBASE_URL (a GitHub Actions repository variable for the deploy) to turn on the form.
// Without it the form explains that it isn't available and points to the pull request route.
export const POCKETBASE_URL: string = (import.meta.env.PUBLIC_POCKETBASE_URL ?? "").replace(/\/+$/, "")
export const formEnabled = POCKETBASE_URL !== ""

let client: PocketBase | undefined

/** Browser-only singleton; the session lives in localStorage via the SDK's default store. */
export function getPocketBase() {
  client ??= new PocketBase(POCKETBASE_URL)
  return client
}

/** GitHub scopes: PocketBase's defaults (profile + email), plus forking and opening PRs on public repos as the user. */
export const GITHUB_SCOPES = ["read:user", "user:email", "public_repo"]

export interface Submitter extends RecordModel {
  name: string
  avatar: string
  githubLogin: string
  githubId: number
}

export interface DraftRecord extends RecordModel {
  user: string
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
