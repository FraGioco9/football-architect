# Hosted nonproduction Preview preparation

Owner approved a shared Dev/Preview account/world DB, independent sign-ins and preparation of a Preview Worker, not its publication. D1 football-architect-dev has been initialized separately with 18 migrations and dev-preview metadata. Formal issue progress remains 13/15 (86.7%).

## Approach
Builder's choice under the owner's autonomous implementation instruction: one workers.dev Preview origin for existing static frontend and existing Worker APIs. This avoids a new domain/DNS change and preserves the exact-origin/Cloudflare trust contract. Keeping Vercel behind a dedicated Cloudflare hostname would also work but needs an owned domain and approved DNS/proxy setup. A bare API Worker or cross-origin rewrite does not fulfill the frontend contract. Existing Vercel Preview and local Worker remain unchanged.

A separate Preview entry wraps the existing API handler and uses an ASSETS binding for frontend files. Reuse the route registry, canonical alias/query rules and shared HTML shells. Run Worker first for all paths with asset HTML handling disabled; enforce Account privacy headers and stream asset bodies. Static requests strip all credentials and query parameters before the asset binding. No SPA fallback or filesystem-root serving. Preview refuses a non-Preview configuration or wrong origin. Existing API auth, CSRF, pool checks and atomic mutation guards remain intact.

Treat workers.dev like existing Vercel/GitHub preview hosts in frontend origin helpers, preserving same-origin entry/account URLs. No debug markers or fictional sporting overlays.

An offline preparation tool exports the exact requested Git commit, invokes the unchanged publication guard from that snapshot, compiles the Preview entry with pinned Wrangler --dry-run, and writes a standalone package with static assets, private Worker modules, nonproduction-only config and hashes. Never stage repository root, node_modules, state, credentials or operational receipts. Explicit target account/database IDs and canonical workers.dev origin are required; preserve the current compatibility date rather than silently changing backend behavior. The package never uploads, applies migrations or grants access. Source CI remains exact-head; no merge/deploy is implied by a prepared artifact.

Tests cover canonical routes/query retention, private cache and stripped asset credentials, API non-fallthrough, unsafe/unpublished paths, workers.dev account/CTA origins, snapshot/provenance/config/hash validation and actual local compilation/assets. Full CI only on the final combined source commit. Deployment, real email, remote maintenance adapter and live acceptance remain outside this block.
