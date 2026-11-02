# DEBUG-DATA-01 — I03 local protected projection adapter

Implemented (not active): `tools/debug-data-private-adapter.mjs`, mounted before static routes in the **local** DEV preview server.

Activation requires `FA_DEBUG_I03_PROTECTED=1` and a separately provided, 32–128-character `FA_DEBUG_I03_TOKEN`. Requests must originate from loopback with a recognized DEV host and include an exact `Authorization: Bearer <token>` header. No browser token is embedded in HTML/JS. All responses are `private, no-store`; unknown routes and disabled mode return 404. No static files or raw JSON are exposed.

Example local request, after explicitly enabling the preview server:

```powershell
$headers = @{ Authorization = "Bearer $env:FA_DEBUG_I03_TOKEN" }
Invoke-RestMethod "http://app.localhost:2000/__fa_dev_private__/season-view?season=1&day=16&competition=IT-1" -Headers $headers
```

This is a **development-only API exploration boundary**, not a ready UI integration. It does not connect to D1 or replace `/api/world`; source is unsealed, and existing Debug settings remain untouched. I03 still needs a controlled browser-side delivery strategy that does not expose a shared secret and a comprehensive security/visual QA gate in I06.

## Explicit browser session (I03 experimental)

The dedicated `POST /__fa_dev_private__/session` accepts the owner token **only when explicitly supplied** from a same-origin local request with `Content-Type: application/json`. On successful authorization, it sets a host-only, path-scoped, `HttpOnly; SameSite=Strict` session cookie with a one-hour lifetime. Sessions exist only in server memory, are bound to the requesting host, and are not written to D1 or static assets. Subsequent browser `GET /__fa_dev_private__/season-view?season=1&day=16&competition=IT-1` can use this cookie without injecting the original bearer token into page JavaScript.

The session handshake is **not automatic** and there is no UI login flow in this block. Public client code never receives the bearer token. This adapter remains DEV-only, disabled unless `FA_DEBUG_I03_PROTECTED=1`, and is not wired to active Debug pages. Its security properties and browser flow require I06 tests; do not enable remotely.
