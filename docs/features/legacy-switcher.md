# Legacy panel switcher

The new panel ships next to the old console, in the same AMS build. The old Angular console keeps
`/`. The new panel goes into `/reborn-panel/`, a folder inside the same root webapp. The login
screen at `/` asks which panel you want, old one preselected. To switch, you log out and log in
again.

**The short version**

- Same webapp, same origin, same session cookie. Log in once and both panels see it.
- Nothing routes. Both panels use hash routing, so the server only ever sees two static paths.
- The panel build uses a relative asset base, so the same `dist/` runs from any folder.
- The session is shared for free. *Who you are* is not. That needs a handoff key, and it is the
  only tricky part of this whole feature.

## Why a folder inside root, and not its own webapp

Every directory under `webapps/` becomes its own Tomcat context. That gives you two problems:

- its own session cookie path, so no shared login
- the installer treats any unknown `webapps/` dir as a streaming app and unzips `StreamApp.war`
  over it on the next upgrade

Folders *inside* an existing webapp are not scanned, so `root/reborn-panel/` avoids both. The
rest works out of the box:

- **Session.** Root's context path is `""`, so `JSESSIONID` has path `/` and covers the subfolder.
- **Static files.** `AuthenticationFilter` is mapped to `/rest/*` only, and Tomcat's default servlet
  serves the folder. The three `/*` filters (HSTS, CORS, IPFilterDashboard) already gate the old
  console exactly the same way.
- **Packaging.** The maven assembly copies `src/main/server/webapps/root` whole, no include list, so
  a new folder ships with it.

One thing to remember: the installer **replaces `webapps/root` on every upgrade** (it keeps only
`red5-web.properties` and `streams/`). So the panel has to be in the release zip. A folder copied
onto a customer box by hand is gone after the next upgrade.

## Nothing routes

Both panels use hash routing. Old: Angular `HashLocationStrategy` (`#/pages/login`). New:
`createHashRouter` (`#/login`). Everything after `#` stays in the browser.

So the server only ever sees `/` and `/reborn-panel/`, and serves an `index.html` for each. No
rewrite rule, no SPA fallback, no server-side switch. Switching panels is just a
`window.location.href`.

## The build does not care where it lives

`vite.config.ts` sets `base: './'`. Assets come out relative (`./assets/index-<hash>.js`), so the
browser resolves them against the folder the page came from. Rename the folder and the same build
still works.

This holds because HashRouter needs no basename, REST paths are origin-absolute (`/rest/v2/...`),
`mediaOrigin()` is `window.location.origin` (no path in it), and nothing reads
`import.meta.env.BASE_URL`. Tomcat redirects `/reborn-panel` to `/reborn-panel/` before
serving the page, so the trailing slash that relative paths need is always there.

Two rules fall out of this, and breaking either one breaks the deploy:

- **REST paths stay origin-absolute.** A relative one would resolve inside the panel folder and 404.
- **No BrowserRouter.** A path router needs a real base, and a relative build cannot give it one.

## The name

`reborn-panel`. App names match `^[a-zA-Z0-9_-]*$`, so someone could create an app with that
name. Tomcat would register a context at `/reborn-panel`, it would win over root's folder, and
the panel would 404 until that app is renamed. The backend reserves the name to stop that.

## The chooser

The old login page is the only door. It shows two cards, one per panel, each with a small wireframe
silhouette. Classic is preselected every time. There is no saved preference, so a beta user opts in
on every login, which is what we want while it is a beta. The new card carries a BETA badge and is
the loud one on a first visit.

Pick a card, type credentials, hit login. The old console authenticates like it always did
(`POST /rest/v2/users/authenticate`, MD5 password). Then:

- classic: the existing `router.navigateByUrl(...)`, so the dashboard, or the app page for an
  app-scoped user.
- new: `window.location.href = '/reborn-panel/'`.

Logging out of the new panel sends you back to `/`, so you land on the door and can pick again.

The new panel keeps its own login page. Nobody sees it in a normal install, but it stays for direct
visits and for mock dev.

## Session and identity are not the same thing

**The session is free.** The server keeps an `HttpSession` (`isAuthenticated`, `user.email`,
`user.password`), the browser holds `JSESSIONID` at path `/`, and the new panel calls
`GET /rest/v2/authentication-status` and gets `success: true`. Nothing to build.

**Identity is not.** The UI needs your email, whether you are an admin, and your app scopes. No
endpoint returns that. `authentication-status` is a bare boolean. `GET /users` is admin-only, and we
would not know which row is us anyway. Identity shows up in exactly one place: the `message` field
of the `POST /users/authenticate` response (`"system/ADMIN"`, or a JSON map of app to role). The
panel that logs you in gets it. The other one never sees it.

So without a handoff, the new panel boots, sees a valid session, looks for its stored user, finds
nothing, and sets `user = null`. You are logged in but the UI treats you as nobody: `isAdmin` false,
no scopes, sidebar says "App user", account menu says "Unknown user", the Users tab hides every
admin action. Nothing crashes and nothing logs you out, which is what makes it easy to miss.

And here it is not an edge case. The old login is the only door, so it is *always* the one that
authenticates. Every single user would land in that state.

## The handoff key

On every successful login, the old console writes:

```js
localStorage["ams.legacy.auth.handoff"] = JSON.stringify({ email, message })
```

`message` is the raw string from the authenticate response. The old console does not parse it and
does not work out `isAdmin`. It forwards two strings it already holds.

It writes on *every* login, not only when the new panel is picked, so that a bookmarked
`/reborn-panel/` still finds an identity.

The new panel, on boot: if the server says authenticated and there is no `ams.auth.user`, read the
handoff, run its own `toAuthUser(email, message)` (that parser already handles both wire formats),
save the result as `ams.auth.user`, then drop the handoff key. On logout it clears both keys and
goes to `/`.

**Why the old console does not write `ams.auth.user` directly.** Then "what counts as an admin"
would live in two codebases, and changing the panel's user model would silently break the old
console's write. Forward raw wire data, parse it in one place.

**Why not a backend `GET /current-user`.** That is the clean fix and it kills the problem for good:
identity would come from the session and no localStorage would be involved. It needs a Java change
and a new AMS release, so it is left for later. The handoff dies with the old panel anyway.

**Check this when wiring it up:** the old console's `isScopeSystem()` and the panel's
`parseScopes()` have to agree on what counts as `system`. They look compatible. Confirm it with a
real login instead of trusting it.

## Deploy

- Build the panel, copy `dist/` into the folder that lands at `webapps/root/reborn-panel/`.
- `redeploy.sh` targets `$AMS_DIR/webapps/root/reborn-panel` for local testing. It must not wipe
  `webapps/root`, the old console lives there.
- CI is handled outside this repo.

## One bug we live with for now

The old login page calls `localStorage.clear()` on mount, plus `DELETE /users/logout`. The logout is
fine, and it is even right here: landing on the door means your old session dies. The `clear()` is
not fine. It wipes the whole origin, which includes the panel's `ams.theme`, the handoff key,
and the `{app}jwtToken` keys both panels share. The fix is targeted `removeItem` calls, scheduled
last, after everything else works.
