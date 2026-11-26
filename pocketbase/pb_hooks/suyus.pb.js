/// <reference path="../pb_data/types.d.ts" />
// Suyus portfolio form: GitHub sign-in stores the token server-side; /api/suyus/submit opens the PR as the user.
// Logic lives in suyus_lib.js (each handler runs in its own VM, so it is required inside the handler).

onRecordAuthWithOAuth2Request((e) => {
  e.next()
  require(`${__hooks}/suyus_lib.js`).storeGithubAuth(e)
}, "submitters")

routerAdd(
  "POST",
  "/api/suyus/submit",
  (e) => require(`${__hooks}/suyus_lib.js`).submit(e),
  $apis.requireAuth("submitters"),
  $apis.bodyLimit(200 * 1024)
)

routerAdd(
  "DELETE",
  "/api/suyus/token",
  (e) => require(`${__hooks}/suyus_lib.js`).forgetToken(e),
  $apis.requireAuth("submitters")
)
