# Mock transport handlers

Canned-data backend for offline/dev work, switched on by `VITE_USE_MOCKS=true`
(see `../client.ts`). These are the **fake half** of the two transports; the real
half is `../transport.ts` (FetchTransport → a live Ant Media Server).

How it works: each file calls `registerMock(method, path, handler)` (from
`@/lib/api`). `MockTransport` (`../mock.ts`) matches the **exact URL** a real
request would hit (`:param` placeholders → regex) and returns the **raw wire
shape** (the same JSON the real server returns) so the typed methods in
`../endpoints/*` run their transforms on mock output too. Swapping mocks for a
live server requires **zero** changes above the transport line.

Rules:
- One file per domain. A mock exists for every endpoint the UI actually calls;
  unwired catalog methods in `../endpoints/*` (tokens, subscribers, ipcamera, …)
  get a mock when a feature first surfaces them; don't pre-stub dead routes.
- Return raw wire shapes, never transformed/model shapes.
- Placeholder/demo/fake data lives ONLY here, never in hooks or components.
- Endpoints AMS doesn't expose yet: stub the response and leave a big
  `// TODO: BACKEND - <what the real endpoint must return>` (see docs/API.md "Does NOT exist yet").
- Imported behind the flag, so this folder tree-shakes out of production builds.
