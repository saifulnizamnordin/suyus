/// <reference path="../pb_data/types.d.ts" />
// Collections for submitting a Suyus portfolio with the form at https://suy.us/submit/form.
//
//   submitters      auth collection, GitHub sign-in only (no passwords)
//   github_tokens   each submitter's GitHub OAuth token. No API rules = only the server (pb_hooks) can read it.
//   portfolio_drafts  the form's saved progress, one per submitter, readable only by its owner
//
// The GitHub provider's client ID and secret are added in the dashboard (see pocketbase/README.md).
migrate(
  (app) => {
    const submitters = new Collection({
      type: "auth",
      name: "submitters",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: "", // signing in with GitHub for the first time creates the record
      updateRule: null,
      deleteRule: "id = @request.auth.id",
      passwordAuth: { enabled: false },
      oauth2: {
        enabled: true,
        mappedFields: { name: "name", username: "githubLogin", avatarURL: "avatar" },
      },
      fields: [
        { name: "name", type: "text", max: 200 },
        { name: "avatar", type: "url" },
        { name: "githubLogin", type: "text", max: 39 },
        { name: "githubId", type: "number", onlyInt: true },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    app.save(submitters)

    const tokens = new Collection({
      type: "base",
      name: "github_tokens",
      // All rules null: superusers and server-side hooks only. The token is never sent to a browser.
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "user", type: "relation", collectionId: submitters.id, maxSelect: 1, required: true, cascadeDelete: true },
        { name: "token", type: "text", required: true, hidden: true },
        { name: "scopes", type: "text" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_github_tokens_user ON github_tokens (user)"],
    })
    app.save(tokens)

    const owner = "user = @request.auth.id"
    const drafts = new Collection({
      type: "base",
      name: "portfolio_drafts",
      listRule: owner,
      viewRule: owner,
      createRule: `@request.auth.collectionName = "submitters" && @request.body.user = @request.auth.id`,
      updateRule: `${owner} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
      deleteRule: owner,
      fields: [
        { name: "user", type: "relation", collectionId: submitters.id, maxSelect: 1, required: true, cascadeDelete: true },
        { name: "data", type: "json", maxSize: 200000 },
        { name: "step", type: "number", onlyInt: true, min: 0, max: 20 },
        { name: "prUrl", type: "url" },
        { name: "prNumber", type: "number", onlyInt: true },
        { name: "submitted", type: "date" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_portfolio_drafts_user ON portfolio_drafts (user)"],
    })
    app.save(drafts)
  },
  (app) => {
    for (const name of ["portfolio_drafts", "github_tokens", "submitters"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  }
)
