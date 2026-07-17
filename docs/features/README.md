# Features

Design and how-it-works notes for the shipped features that needed one. Each doc covers
the backend reality it builds on, the data layer, and the locked decisions.

- [app-settings.md](app-settings.md): the App Settings editor. The schema overlay on the flat POJO, the single value interpreter (`parseFieldValue`), the save safety net, and JSON import/export.
- [backend-analytics.md](backend-analytics.md): the Java side of the analytics endpoints (history rings, per-stream metrics, node note). Design + invariants.
- [cluster.md](cluster.md): the cluster view at `/cluster`. Node-health cards, a capacity summary, editable per-node notes, and a first-class standalone empty state.
- [server-logs.md](server-logs.md): the live-tail log viewer at `/logs`. Level and search filters, follow-tail, and a source selector built to take cluster per-node logs later.
- [streams-master-detail.md](streams-master-detail.md): the per-app streams table, the stream-detail split (width-based compact behavior), and the embedded player.
- [streams-import-export.md](streams-import-export.md): stream definitions as JSON files. Allow-list export, bulk create endpoint, interactive duplicate handling.
- [dashboard-widgets.md](dashboard-widgets.md): the dashboard widgets and where each number comes from, real data versus placeholder.
- [legacy-switcher.md](legacy-switcher.md): shipping next to the old console. The subfolder deploy, the chooser on the legacy login, and the session/identity handoff.
