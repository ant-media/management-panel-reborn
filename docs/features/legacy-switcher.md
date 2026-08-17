# Legacy panel switcher

The new panel ships next to the old console, in the same AMS build. The old Angular console keeps
`/`. The new panel goes into `/reborn-panel/`, a folder inside the same root webapp. Each panel
keeps its own login page, and each one carries a switch above the card that links to the other.
You pick a panel at the door, then log in there.

**The short version**

- Same webapp, same origin, same session cookie. Log in once and both panels see it.
- Nothing routes. Both panels use hash routing, so the server only ever sees two static paths.
- The panel build uses a relative asset base, so the same `dist/` runs from any folder.
- The session is shared for free. *Who you are* is not, and there is no way to ask the backend.
  So each panel only trusts a session it created itself.

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

## The door switch

Both login pages carry the same control above the login card: a two-segment pill, `Classic` and
`New UI` with a BETA tag. The segment you are on is the solid one; the other is a plain link to the
other panel's login page. Nothing is stored and nothing is posted, so the switch works before you
have a session and it cannot get out of sync with one.

- old console: `<a href="/reborn-panel/">`, in `login.component.html`, behind `*ngIf="rebornSwitcher"`.
- new panel: `<a href="/">`, the `PanelSwitch` in `features/auth/login-page.tsx`.

Each link is a full page load, not a route, because these are two separate apps. Both hrefs are
origin-absolute; the panel's relative asset base does not apply to them (see *The build does not
care where it lives*).

You then log in on whichever panel you landed on, so that panel gets identity out of its own
authenticate call. That is the point of the design, and it is why nothing has to be handed between
the two apps. The old console's post-login redirect is untouched: still the dashboard, or the app
page for an app-scoped user.

Switching costs a login. Both doors kill the session as you land on them, the old console in
`ngOnInit`, the new panel on boot when it finds a session it cannot identify. So you cannot carry a
session sideways into a panel that does not know who you are.

There is no saved preference, so a beta user opts in on every visit. That is what we want while it
is a beta. Logging out of either panel drops you on that panel's own login page, switch included.

The switch is only on the login pages, not the first-account form and not inside either panel. The
door is the one place where changing your mind is free.

## Both doors are the same room

Switching used to mean the whole world changed at once: photo backdrop to a flat sheet at 99.5%
white, in one frame. That reads as whiplash, not as an upgrade, and in light mode it hurts.

So the panel's door carries the same photo (`src/assets/login-background.jpg`, a copy of the legacy
console's `background-2.jpg`, bundled rather than linked so it also resolves in dev and standalone
serves). The backdrop holds still across the jump and only the card changes, which is the part the
eye is already on.

Two deliberate differences from the legacy treatment:

- **Darkened, not greyed.** The old theme washes with flat `#5e5e5e` at 70%. That grey is *lighter*
  than the photo's mean, so it lifts the shadows and crushes the highlights toward mud, and it still
  leaves white text at 4.6:1 over the bright sky. The panel uses black at 45% (50% in dark mode),
  which darkens without desaturating: the sunset keeps its colour and white text lands at 6.5:1.
- **The door opts out of dark mode.** A photo backdrop wants a light card in either theme; a dark
  card on a dark wash stops reading as a surface at all. `.door` (index.css) re-declares the light
  palette for the subtree, so every primitive inside just works, and the dark class only deepens the
  wash. `--accent` is deliberately left out of that block, because the boot script writes it as an
  inline style on `<html>` and the door must not shadow a user's chosen accent.

The legacy door also pings its New UI segment once on load: three soft rings, starting after the
login card has animated in, then silence. It respects `prefers-reduced-motion`. It is a nudge, not a
nag, and there is nothing to dismiss.

## Session and identity are not the same thing

**The session is free.** The server keeps an `HttpSession` (`isAuthenticated`, `user.email`,
`user.password`), the browser holds `JSESSIONID` at path `/`, and the new panel calls
`GET /rest/v2/authentication-status` and gets `success: true`. Nothing to build.

**Identity is not.** The UI needs your email, whether you are an admin, and your app scopes. No
endpoint returns that. `authentication-status` is a bare boolean. `GET /users` is admin-only, and we
would not know which row is us anyway. Identity shows up in exactly one place: the `message` field
of the `POST /users/authenticate` response (`"system/ADMIN"`, or a JSON map of app to role). The
panel that logs you in gets it. The other one never sees it.

Left alone, the new panel would boot, see a valid session, look for its stored user, find nothing,
and set `user = null`. You would be logged in but the UI would treat you as nobody: `isAdmin` false,
no scopes, sidebar says "App user", account menu says "Unknown user", the Users tab hides every
admin action. Nothing crashes and nothing logs you out, which is what makes it easy to miss.

Normally the panel you are using is the one that authenticated you, so its identity is in
`ams.auth.user` and none of this comes up. The gap is a session created on the *other* door: log in
on the old console, then open `/reborn-panel/` on that live session.

## An unidentifiable session gets ended

The panel only trusts a session it created itself. On boot, if the server says authenticated and
there is no `ams.auth.user`, it sends `DELETE /users/logout` and shows its own login page. You sign
in again, the panel gets `message` from its own authenticate call, and identity is real.

That is the whole mechanism, and no identity data crosses between the two apps, so there is no wire
format for the two repos to keep in step. What the old console still owes us is one key name: it
must drop `ams.auth.user` when it ends the session (see *The old login page clears localStorage on
mount*). That check is what makes "no stored user" mean "not ours" rather than "not written yet".

It costs a re-login in one case: a live legacy session, then a direct visit to `/reborn-panel/`.
Worth it. The alternative was the old console forwarding `{email, message}` through a localStorage
key, which meant two codebases agreeing on the wire format of identity forever, to save a
password prompt on a path nobody takes on purpose.

**The case it does not cover.** The rule fires on a *missing* stored user, not a *stale* one. Sign in
to the panel as one admin, then sign in on the old console as a different one, and the panel would
boot on the second admin's session while still showing the first admin's name and scopes. Closing it
would mean the old console clearing `ams.auth.user` on its way through, i.e. knowing a key the panel
owns. The boundary is worth more than the case: it takes two admin accounts in one browser with the
second logging in through the old door, the server still enforces the real permissions either way, and
signing out and back in clears it. `GET /current-user` ends it properly.

**Why not a backend `GET /current-user`.** That is the real fix: identity would come from the
session, the panel would trust any session, and no localStorage would be involved. It needs a Java
change and a new AMS release, so it is left for later.

## Deploy

- Build the panel, copy `dist/` into the folder that lands at `webapps/root/reborn-panel/`.
- `redeploy.sh` targets `$AMS_DIR/webapps/root/reborn-panel` for local testing. It must not wipe
  `webapps/root`, the old console lives there.
- CI is handled outside this repo.

## The old login page clears localStorage on mount

It also sends `DELETE /users/logout`. The logout is right: landing on the door means your old
session dies. The `localStorage.clear()` beside it is not, because it wipes the whole origin,
including the panel's `ams.theme`, `ams.beta.notice.seen` and the `{app}jwtToken` keys both panels
share. Under `rebornSwitcher` it is a targeted `removeItem` list instead. It matters more with the
switch than it did before: two doors means people bounce through `/` a lot.

The list is *the old console's own keys*, nothing else, and it stays that way: clearing only what you
wrote is ordinary good manners on a shared origin, and it means the old console never has to know
what the panel stores. The accepted cost is in *An unidentifiable session gets ended* above.
