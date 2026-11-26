# suyus-submit

The backend of the submission form at [suy.us/submit/form](https://suy.us/submit/form), as a Cloudflare Worker at **`submit.suy.us`**.

1. **Sign-in.** The Worker runs the GitHub sign-in with an OAuth App (scopes `read:user public_repo`). It saves the user's GitHub token in PocketBase, then sends them back to the form with a signed session.
2. **Drafts.** The form saves its progress after every step through the Worker.
3. **Submitting.** The Worker uses the user's token to fork the repo, commit `src/content/portfolios/<login>.md` and open the pull request **in the user's name**. That matters because the **Validate portfolio submission** check only lets people change their own file.

PocketBase stores the data only. Every API rule on its collections is closed, and the Worker signs in as a superuser. GitHub tokens never reach a browser.

```
GET  /auth/github?return=/submit/form    → GitHub → GET /auth/callback → back to the form with #session=…
GET  /health                             { ok: true }
GET  /me                                 the signed-in account
GET  /draft · PUT /draft                 saved progress
POST /submit   { markdown }              { prUrl, prNumber, updatedExistingPr, … }
POST /logout   { forget }                forget=true revokes the GitHub grant and deletes the token
```

## Configuration

The values live in `~/.saifulnizamnordin.env`, never in the repo:

| Env file | Worker | Kind |
| --- | --- | --- |
| `SUYUS_POCKETBASE_URL` | `PB_URL` | var |
| `SUYUS_GITHUB_CLIENT_ID` | `GITHUB_CLIENT_ID` | var |
| `SUYUS_GITHUB_CLIENT_SECRET` | `GITHUB_CLIENT_SECRET` | secret |
| `SUYUS_POCKETBASE_ADMIN_EMAIL` | `PB_ADMIN_EMAIL` | secret |
| `SUYUS_POCKETBASE_ADMIN_PASSWORD` | `PB_ADMIN_PASSWORD` | secret |
| — (generated) | `SESSION_SECRET` | secret |

`SITE_URL`, `ALLOWED_ORIGINS` and `SUYUS_REPO` are in [`wrangler.toml`](wrangler.toml).

## One-time setup

### 1. GitHub OAuth App

Set the app's **Authorization callback URL** to:

```
https://submit.suy.us/auth/callback
```

### 2. PocketBase collections

Create `submitters` and `portfolio_drafts` on the suy.us PocketBase instance. The script is safe to run again:

```sh
SUYUS_POCKETBASE_URL=… SUYUS_POCKETBASE_ADMIN_EMAIL=… SUYUS_POCKETBASE_ADMIN_PASSWORD=… \
  node workers/submit/scripts/setup-pocketbase.mjs
```

### 3. Deploy

```sh
cd workers/submit
npx wrangler login                     # or set CLOUDFLARE_API_TOKEN
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put PB_ADMIN_EMAIL
npx wrangler secret put PB_ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET   # e.g. node -e "console.log(crypto.randomBytes(48).toString('base64url'))"
npx wrangler deploy --var PB_URL:https://… --var GITHUB_CLIENT_ID:…
```

The site calls `https://submit.suy.us` by default ([`src/lib/submit-api.ts`](../../src/lib/submit-api.ts)). The form checks `/health` first: while the Worker isn't deployed, it shows "The form isn't available yet" and points people to the pull request route.

## Local testing

Create `.dev.vars` (git-ignored) with the same names, plus:

```sh
SITE_URL=http://localhost:4321
ALLOWED_ORIGINS=http://localhost:4321
```

Then run:

```sh
npx wrangler dev --port 8788
# in the repo root:
PUBLIC_SUBMIT_API_URL=http://localhost:8788 npm run dev
```

GitHub only redirects to the callback URL registered on the OAuth App, so a full local sign-in needs a second OAuth App with `http://localhost:8788/auth/callback`.
