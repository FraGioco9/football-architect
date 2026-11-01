# PLAYER-AUTH-01 — Initial authenticated player landing

## In scope, before a gameplay engine exists
- `/account/` is the initial authenticated destination. It restores the server-backed session and shows the user's own email.
- From the landing, authenticated players may open the existing public clubs, competitions and guide views. These remain anonymous-readable: logging in adds no second world and does not change the world clock.
- Account self-service remains available: change password, revoke other sessions, sign out, request deletion. Password and session data never appear in HTML at build time.
- The World administration entry is shown only when D1-derived permissions include both `admin.access` and `admin.world.read`. Each Admin API also checks these rights on the server; visibility is not authorization.

## Explicitly outside this issue's initial player landing
No club ownership, manager selection, match engine, game actions, separate game save/world, purchases, notifications or private sporting projections. Future player features need independent permission and product design.

## Routing and trust
- `/account/` redirects an HTTP 401 session check to `/account/login/?next=%2Faccount%2F`.
- `/account/login/` accepts only safe same-origin return locations.
- Public pages remain accessible without player authentication.
- New registration and recovery require an email provider explicitly approved in a later step.

Implementation only. Owner requested final-test deferral. Draft/HOLD, no release.
