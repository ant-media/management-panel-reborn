# Streams: table, drawer, playback

The per-app **Live Streams** tab: a master table, a detail drawer that docks beside it, and the
embedded player. All of it lives in `src/features/streams/`.

## The split

`app-streams-tab.tsx` owns the layout. The drawer is a 580px dock whose *own width* animates
between 580 and 0; the inner wrapper stays fixed at 580 so content is clipped, never re-laid-out.
Below 640px (`useIsNarrow`) the drawer is a full-screen overlay instead.

**Compact is a width decision, not a breakpoint.** The table degrades to 5 columns only when the
space beside the dock drops under `FULL_TABLE_MIN_WIDTH` (1040px), so a 1080p-and-up monitor keeps
the full 9-column table docked beside the drawer. Compact drops the checkbox, thumbnail, Bitrate,
Duration and the inline row buttons; it keeps Stream, Status, Viewers, Created and the `⋯` menu.
The sidebar auto-collapses on the same condition (docked *and* too tight), edge-triggered so a
manual toggle isn't fought.

**The decision is computed from the viewport** (`useViewportWidth`), modelling the sidebar and
dock widths explicitly. Do not measure the table row: it animates when the sidebar collapses
(256↔60 over 200ms), so a measured width lags, `compact` flips mid-animation, and the columns
visibly pop.

## The drawer

Lives in `src/features/streams/drawer/`, one file per block it renders: `drawer.tsx` (shell, header,
empty state), `action-bar.tsx`, `metrics.tsx`, `recording.tsx`, `section.tsx`. One body, two shells
(`mode: 'inline' | 'overlay'`). The backdrop and the body scroll-lock are overlay-only; ESC and
focus-into-panel apply to both.

`onClose` must keep a stable identity (the parent memoises it): the ESC/focus effect keys off it,
and the tab re-renders on every 5s poll, so an inline arrow re-runs that effect and yanks focus
back into the panel while you are using it.

- **Header:** identity only. Thumbnail, name, `StreamStatus` badge, type / resolution / duration /
  origin, then the `⋯` menu and close. No action buttons: they live in the bar below.
- **Action bar:** four tappable tiles, Play / Start-Stop / Edit / Delete, above the metric tiles and
  deliberately sharing their radius, border and gap so the two rows read as one system. Tiles are
  the mobile-friendly target the header icons never were. An action that doesn't apply stays in
  place, greyed, with a tooltip saying why (offline, publisher-started, VoD), so the grid never
  reflows and the rule is discoverable. Edit is gated on `isEditable` (everything but a VoD record)
  and opens the modal described in *Editing* below.
- **Metrics:** three tiles (Bitrate / Viewers / Speed) driving one shared animated chart. Each
  metric is defined once (`METRICS` in `metrics.tsx`: label, colour, series, value, axis format) and
  both the tile and the chart read that entry, so the two cannot disagree about the same number.
- **Recording** and **Re-streaming** are collapsible sections; see below.
- **Every action resolves through `streamAction`** (`stream-actions.ts`) and executes through
  `useStreamActions`, owned by the parent. The row button, the `⋯` menu (`buildRowMenu`) and the
  drawer all read that one resolver, so a stream's label, icon and click can never disagree. Never
  branch on type/status at a call site; extend the resolver. Truth table: *Start and stop* below.
- **Recording mutates through `recordStream`** (same file), shared by the drawer section and the ⋯
  menu: the encoder guard (H.264 for MP4, VP8 for WebM) and the wording live there once. The caller
  owns its busy flag and decides what to refresh.

Status is the shared 5-state health model (Healthy / Unhealthy / Preparing / Offline / Error; dot
= liveness, background = severity, verdict in `health.ts`). Encoding speed rides as a sub-line
under the badge; resolution lives in the badge's tooltip.

### Sections and what persists

**A titled block is a `Section` (`drawer/section.tsx`); an untitled one isn't.** That is the whole
rule. The action bar and the metric tiles carry no title, so they are always visible with no
"always expanded" flag to maintain. Recording and Re-streaming are titled, so they collapse.

Each section stores its own collapsed bit under `streams.drawer.<id>` (`useStoredState`), which is
why a collapse survives stream-switching, closing the drawer, and a reload. Deliberately **one key
per section, storing `collapsed`, never a shared map**: several `useStoredState` instances over one
map each hold their own copy and would clobber each other, and an absent or corrupt key must read
as *open* so bad storage can never hide content.

A collapsed header still reports its state through `meta` (`MP4 · WebM`, `1/2 forwarding`): a
failed endpoint or a running recording must not hide behind a closed header.

The open chart is not stored: it lives in `app-streams-tab.tsx` (`metric`), because the drawer is
keyed by stream id and remounts on every row click. So the picked chart follows you across streams
and dies with the tab, and the tab is keyed by app name, so a different app starts fresh.

## Start and stop

The truth table `streamAction` implements. One resolver, three call sites (row button, `⋯` menu,
drawer tile), so a stream's label, icon and click cannot disagree.

| Type | Idle (`created`, `finished`) | `preparing` | `broadcasting` | Error (`error`, `failed`, `terminated_unexpectedly`) |
| --- | --- | --- | --- | --- |
| `streamSource` | **Start** (play, green) | **Stop** (stop, red) | **Stop** (stop, red) | **Start** (play, green) |
| `ipCamera` | **Start** (play, green) | **Stop** (stop, red) | **Stop** (stop, red) | **Start** (play, green) |
| `playlist` | **Start** (play, green) | **Stop** (stop, red) | **Stop** (stop, red) | **Start** (play, green) |
| `liveStream` (publisher) | *none* | **Force Stop Ingest** (power, red) | **Force Stop Ingest** (power, red) | *none* |
| `VoD` | *none* | *none* | *none* | *none* |

- "Live" is `broadcasting` or `preparing` (`isLive`). Stopping a `preparing` pull is how an operator
  cancels a source stuck on a bad URL, so it stays enabled.
- **A publisher is never plain-stopped, only force-stopped, and that always confirms**
  (`confirm-force-stop-modal.tsx`), because it cuts a live broadcast off mid-stream. Start/Stop of a
  server-pulled source fires straight from the row. Backend: `POST /broadcasts/{id}/stop` closes the
  publisher's connection (`AntMediaApplicationAdapter.stopStreaming`, RTMP), and the enterprise
  `WebRTCApplication.stopStreaming` override extends it to WebRTC and SRT.
- **In the row**, *none* renders an empty slot of the button's exact width, so `⋯` keeps a constant
  x down the column. Compact mode (drawer docked) drops the button and keeps `⋯`.
- Row action buttons are gated by the shared `busy` flag, so rapid clicks don't fan out.

## Editing

**Everything that writes a stream's definition lives in `src/features/streams/editor/`**: the two modals
(`new-stream-modal.tsx`, `edit-stream-modal.tsx`), the form chrome they share (`fields.tsx`), the
playlist item editor (`playlist-items.tsx`), and the draft model both speak (`draft.ts`). A stream's
*runtime* (start/stop, playback, recording, metrics) stays outside. That is the same
definition-vs-runtime line `stream-io.ts` draws for import/export.

Edit opens from the drawer's Edit tile and the `⋯` menu's *Edit Stream*. The tab owns
`editing: Broadcast | null` and mounts the modal only while it is set, so the draft seeds from props
with no reset effect. That snapshot is deliberately not a polled value: the list refreshes every 5s,
and re-seeding from a tick would stomp what is being typed.

Every type gets display name, description and the three viewer limits (WebRTC / HLS / DASH). On top:

| Type | Extra fields | Save side effect |
| --- | --- | --- |
| `liveStream` | none | none, safe while broadcasting |
| `streamSource` | Source URL, Auto start/stop | stops + restarts if live |
| `ipCamera` | Camera host (with ONVIF Discover), Username, Password, Auto start/stop | stops + restarts if live; ONVIF reconnect; bad credentials abort |
| `playlist` | Items editor, Loop, Schedule (`plannedStartDate`) | none; re-arms the schedule timer |

**`draft.ts` is the whole contract, pure and outside React**, so it is checkable without a renderer:
`toDraft`/`toDraftItems` seed from a `Broadcast`, `toWire` projects a draft to the wire values for one
type, and `diff` of seed-vs-current is the request body. `PUT /broadcasts/{id}` merges the non-null
fields of a `BroadcastUpdate`, so a dirty-only patch is the endpoint's intended usage, not a shortcut.
Four properties fall out of the diff, and each is a bug the moment someone "simplifies" it away:

- **A no-op save is impossible.** Save stays disabled until the patch is non-empty, which dodges the
  Mongo phantom failure (RISKS.md).
- **Runtime state never rides along.** Viewer counts, bitrate and status are on the `Broadcast` we
  seeded from but never in `toWire`, so they cannot be written back.
- **`ipCamera` never sends `streamUrl`**, and a blank credential is omitted rather than sent as `""`.
  Both are silent-corruption traps; RISKS.md has the backend reasoning.
- **The seed is the initial state**, captured once with `useState`, never re-derived from the prop. The
  modal validates *the patch*, not the draft, so a pre-existing odd value (a `0` limit, a schedule in
  the past) can't block an unrelated edit.

Viewer limits show blank for the wire's `-1` sentinel and never surface it; inputs are digit-coerced and
length-capped, so `0` is the only invalid value a user can type. Playlist items round-trip `seekTimeInMs`
and `type` through `PlaylistDraftItem` even though neither has a UI yet (V2): a save replaces the whole
list, so an offset set in the old console would otherwise be silently zeroed. Editing a row's URL keeps
them and drops only the picked VoD's name.

**Live pulled sources restart on save.** The backend stops, patches and restarts a live `streamSource`
or `ipCamera` whatever the field changed, and a rejected save leaves the stream down. The modal renders a
callout, relabels Save to *Save and restart*, and says so in the error. Detail: RISKS.md.

### What create and edit share, and what they must not

They share the **leaf fields** (`fields.tsx`: `FieldLabel`, `TextField`, `ToggleRow`,
`OnvifCameraHostField`), the **playlist item editor**, and the **draft model** (`draft.ts`, whose
`STREAM_URL_RE` is the one place the backend's scheme whitelist is encoded). Those compose cleanly
precisely because they sit *below* the create/edit distinction and neither knows which modal it is in.
`fields.tsx` carries its own input chrome, a size apart from the shared `Field` kit in
`components/shared/form.tsx`, so don't mix the two kits in one modal.

**Do not factor the per-type sections into shared "views."** It looks like duplication and isn't: the
two modals disagree on nearly every field, so a shared `<IpCameraFields mode="create" | "edit">` would
thread that flag through all of it and hide the divergence instead of expressing it.

- Create has a **type switcher**; edit has none (the backend ignores `type` on update).
- Create has an editable **Stream ID**; in edit it is identity, a read-only chip in the header.
- Create has **Record as MP4**; edit cannot, because `updateStreamInfo` silently ignores `mp4Enabled`
  (recording only moves through `PUT /broadcasts/{id}/recording/{bool}`).
- Create's pulled-source toggle is **"start fetching now"** (the `?autoStart` query param, not a field);
  edit's is **`autoStartStopEnabled`** (a persisted field). They look like the same switch and are not.
- IP camera credentials are **required** on create and **"blank keeps the stored one"** on edit.
- **Viewer limits** and **Schedule** are edit-only.
- Create POSTs a whole object; edit diffs against a seed and PATCHes only what moved.

The JSX that is actually near-identical between them comes to roughly 20 lines, because each block
already delegates to a shared leaf. That is not worth an abstraction.

## Playback

An `iframe` of the app's own `play.html` inside an `xl` `Modal` (`player-modal.tsx`). No player
dependency (`@antmedia/web_player` is ~5.5MB); the page negotiates the protocol itself. The modal
is rendered only while playing, so closing unmounts the iframe and the session dies with it.

Launch points: the **thumbnail play badge** (live rows), the drawer's **Play tile**, and
`⋯ > Play > Play Embedded Player`. `Play With WebRTC` / `Play With HLS` and row middle-click stay
new-tab openers. The row deliberately has **no** play button in its action cell: the thumbnail is
the bigger, more obvious target, and the cell stays quiet for start/stop.

The badge sits at rest (muted circle, solid triangle) so the thumb reads as playable, and turns
live-red over a scrim on row hover. The LIVE badge dims to 45% on hover rather than compete with
it, but never disappears.

`usePlayUrl` (`use-play-url.ts`) resolves the URL, and carries the three things legacy taught us:

- **Play order** is `webrtc,hls,dash`. Playlists are HLS-only.
- **`subFolder` apps** namespace the stream id. The token is still minted against the raw id.
- **Play tokens.** `playTokenControlEnabled` mints a one-time token, `playJwtControlEnabled` a
  JWT, both per playback with a 100s expiry. TOTP can't be minted in a browser, so the modal says
  so instead of showing a black player. A failed mint degrades to a bare URL and lets the player
  report the auth error itself. Caveats: [RISKS.md](../RISKS.md), *Playback tokens ride on the
  player URL*.

## Gotchas

- **Every media URL comes from `mediaOrigin()`** (`lib/media-origin.ts`), never `window.location`
  directly. In dev it resolves to `VITE_BACKEND`, because vite proxies `/rest/v2` only and an
  iframe or `<img>` has to actually load.
- **ESC is not stacked.** One press closes the player *and* the drawer under it. Known and
  accepted; see RISKS.md.
- **The future cross-app streams table** (TODO.md V2) should reuse this table + drawer, not fork
  them.
