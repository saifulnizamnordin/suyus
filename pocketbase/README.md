# PocketBase for the submission form

The form at [suy.us/submit/form](https://suy.us/submit/form) uses PocketBase for three things:

1. **GitHub sign-in.** The `submitters` auth collection signs people in with GitHub only.
2. **Saved progress.** `portfolio_drafts` keeps one draft per person, saved after every step. Only its owner can read it.
3. **Opening the pull request as the user.** On sign-in, a hook stores the user's GitHub token in `github_tokens`. That collection has no API rules, so no browser can read it. `POST /api/suyus/submit` then uses the token to fork the repo, commit `src/content/portfolios/<login>.md` and open the PR in the user's name. The PR has to come from the user, because the **Validate portfolio submission** check only lets people change their own file.

Requires PocketBase **v0.23 or newer** (written for v0.40).

| File | What it does |
| --- | --- |
| [`pb_migrations/1764115200_suyus_submissions.js`](pb_migrations/1764115200_suyus_submissions.js) | Creates `submitters`, `github_tokens` and `portfolio_drafts` |
| [`pb_hooks/suyus.pb.js`](pb_hooks/suyus.pb.js) | Saves the token after GitHub sign-in; adds `POST /api/suyus/submit` and `DELETE /api/suyus/token` |
| [`pb_hooks/suyus_lib.js`](pb_hooks/suyus_lib.js) | The GitHub API calls behind the hooks |

## Setup

### 1. GitHub OAuth App

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**:

- **Homepage URL:** `https://suy.us`
- **Authorization callback URL:** `https://<your-pocketbase-host>/api/oauth2-redirect`

Copy the **Client ID** and generate a **Client secret**.

Use an OAuth App, not a GitHub App. The form asks for the `public_repo` scope so it can fork and open pull requests as the user.

### 2. Install the migration and hooks

Copy both folders next to your PocketBase executable (merge with any you already have), then restart PocketBase:

```text
pocketbase
pb_migrations/1764115200_suyus_submissions.js
pb_hooks/suyus.pb.js
pb_hooks/suyus_lib.js
```

The migration runs automatically on start.

If the upstream repository isn't `saifulnizamnordin/suyus` (for example after a rename), set `SUYUS_REPO=owner/name` in PocketBase's environment.

### 3. Turn on GitHub sign-in

Dashboard → **Collections → submitters → ⚙ Options → OAuth2**: add **GitHub** with the Client ID and secret from step 1, then save.

Also check **Settings → Application → Application URL**. It must be your public PocketBase URL, because PocketBase builds the OAuth callback from it.

### 4. Point the site at PocketBase

In the `suyus` repository: **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- **Name:** `PUBLIC_POCKETBASE_URL`
- **Value:** `https://<your-pocketbase-host>` (no trailing slash)

Re-run the **Deploy to GitHub Pages** workflow. Until this variable is set, `/submit/form` shows "The form isn't available yet" and points people to the pull request route.

## What a submission does

As the signed-in user, `POST /api/suyus/submit`:

1. Reads `/user` with the stored token. The token decides the file name, never the request.
2. Checks that the file's `github:` field matches that login.
3. Forks the upstream repo to the user's account, or reuses their existing fork. The repo owner can't fork their own repo, so for them the branch goes in upstream.
4. Points the branch `suyus/portfolio-<login>` at upstream's latest `main`. If a PR from that branch is already open, it adds a commit to it instead.
5. Commits `src/content/portfolios/<login>.md` and opens the pull request, with "Allow edits by maintainers" on.
6. Saves the PR link on the user's draft.

Signing out with **"remove Suyus's access"** deletes the stored token (`DELETE /api/suyus/token`). Users can also revoke access in GitHub under **Settings → Applications**.

## Privacy notes

- **Tokens** are only readable by superusers and the hooks. A new sign-in replaces the old token.
- **Drafts** hold everything the person typed. The email is already encrypted in the browser before it is saved (same key as `npm run encrypt-email`), so a plain address is never stored.
- **Deleting** a `submitters` record also deletes its token and draft (cascade).
