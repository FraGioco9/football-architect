# Shared Dev/Preview backend

Owner chose shared accounts **and world** (seasons, matches, results) for Dev/Preview; Production remains independent. Sign-in must be separate per frontend. Owner command remains the only privilege-assignment interface. Mailbox/account creation and all live activation remain deferred.

## Chosen topology
One nonproduction Worker/D1 serves both frontends. No cross-database joins, identity replication or new world namespaces: current atomic session/permission/world guards remain in the same D1. The alternative account-only/independent-world topology is no longer requested.

Preview uses an exact configured HTTPS app/API origin on Cloudflare, mode `preview`, and an explicitly initialized `dev-preview` D1 marker. The private API uses secure host-only Player cookies and existing CSRF/origin checks. Preview cannot activate the real email adapter, which remains Production-only. Production rejects a dev-preview-marked DB; local mode rejects production-marked DB. Existing unmarked local/legacy Production fixtures remain compatible; new Preview is strict and requires a marker.

Dev keeps its HTTP app.localhost frontend and a loopback-only server bridge. An opt-in HTTPS target plus explicit dev-preview selection enables sharing; no target comes from a browser URL. Before sending credentials, the bridge calls the target's no-secret environment handshake. Every forwarded request also asserts expected dev-preview pool, which Production rejects before dispatch. The bridge accepts only the existing API allowlist/method/body bounds, validates local Origin for mutations, and never follows redirects. Native TLS verification remains enabled.

Cookie translation is narrow: localhost's HttpOnly/SameSite=Strict fa_player_local is mapped to the backend __Host-fa_player; only a valid secure host-only backend session cookie is translated back. Other cookies/client CF or forwarding headers never cross. Preview cookies are not installed on localhost automatically; new login mints a separate session and logout affects that session only.

## Activation boundary
Supply examples and tests, but leave backend/wrangler.toml, vercel.json, publication guard and live resources unchanged. Owner must later provide the shared nonproduction origin and separately authorize routing/bindings/resources. Preview must serve /api on its configured app origin through approved routing; a Vercel preview URL alone does not create that routing. No real email, remote D1, account grant, deploy or merge.
