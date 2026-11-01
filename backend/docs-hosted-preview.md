# Hosted Preview package — preparation only

The existing nonproduction D1 is initialized, but no Worker has been published. The proposed Worker is `football-architect-preview` on the account's workers.dev subdomain: frontend and `/api/*` share one exact origin. Dev connects through its existing opt-in bridge. Production remains separate; Vercel Preview, local wrangler.toml and the publication guard remain unchanged. Issue #170 remains **13/15 (86.7%)**.

## Prepare from an exact reviewed commit

With pinned backend dependencies installed, run from the repository root in PowerShell. Replace the values with the exact source/account/database/origin approved for the operation. Choose a NEW absolute output directory, outside the public repository document root.

```powershell
npm --prefix backend run preview:prepare -- `
  --source-sha '<full-40-character-reviewed-commit>' `
  --output 'C:\Users\Francesco\Desktop\fa-preview-review' `
  --account-id '<Cloudflare-account-id>' `
  --database-id '<existing-nonproduction-D1-uuid>' `
  --origin 'https://football-architect-preview.<account-subdomain>.workers.dev'
```

Preparation exports that exact Git commit. It does not stage working-tree edits, node_modules, local databases or credentials. The unchanged publication guard builds `assets/` from the clean snapshot; compilation then uses the installed pinned dependency toolchain in private temporary source, with authentication environment variables excluded. Compatibility date stays aligned with the existing tested backend. The sole Wrangler invocation is `deploy --dry-run`: **no upload, D1 operation, grant, DNS or email**.

Output:
- `assets/`: unchanged allowlisted frontend bytes only, including the existing route shells and account scripts; no debug injection.
- `bundle/`: compiled Worker entry and private Wasm modules. Never mount this directory as static content.
- `wrangler.json`: Preview-only target config, ASSETS binding, all requests through the Worker, no SPA or automatic HTML redirects, exact origin, expected D1 ID and no email/remote-development bindings. `no_bundle` preserves the compiled modules for later review/publication.
- `manifest.json`: source commit/tree and every other package file's SHA-256/size. `publicationAuthorized` is false. `verifyPreviewPackage()` detects missing/extra/changed files; hashes establish integrity, not independent permission to publish.

Preparation refuses overwrite. A failed build may leave incomplete output for diagnosis; do not publish it. Every new attempt must use a new output path. Git and tar must be available (Windows 11 provides tar).

## Serving behavior

The separate Preview entry reuses the route registry and existing API handler. Canonical trailing-slash/index aliases redirect with 308, preserving approved query state. Club and competition views use existing physical HTML shells. `/api` never falls through to HTML, including browser navigation requests. Account pages and HTML responses receive private/no-store/referrer/noindex protections. Static fetches strip cookies, authorization, CSRF, source headers and query tokens; bodies stream from ASSETS. workers.dev host helpers retain same-origin login/CTA links, like existing Vercel/GitHub previews, without creating an app.* hostname. Existing custom-domain behavior is unchanged.

## Before any publication

Review the exact source CI, manifest/file hashes, nonproduction IDs, origin, static boundary and final Worker modules. A successful package check is not a deployment approval. Explicit owner authorization must name the proposed Worker/URL and existing D1. Publication must not apply migrations again, change pool metadata, generate/reset a season, grant Admin, configure email/DNS or touch Production. Keep PR #329 Draft/HOLD and do not merge.

No hosted account exists yet. Preview verification/recovery delivery remains disabled and the owner grant tool is still local only. Publishing this package alone does not complete registration, actual operator cutover or live acceptance. Preserve the existing initialized Season 0 and recovery records during later smoke tests; destructive lifecycle scenarios stay on disposable local D1.

## Namespace migration — planned target (1 November 2026)

Target: `https://preview.football-architect.workers.dev` (Worker `preview`, account workers.dev subdomain `football-architect`). This is NOT yet live. The existing `football-architect-preview.giocolifrancesco.workers.dev` remains the only published origin until the controlled switch. Account subdomain changes affect the account's existing Workers routes; they are not a zero-downtime alias. Do **not** change the account subdomain first or rename/delete the live Worker in isolation.

The prepare tool now selects the Worker name from the **exact** approved origin and retains the old source-target format for verification of existing packages. Migration sequence:

1. Confirm `football-architect` subdomain availability and inventory all account Workers/routes. Preserve the current deployment/version and D1 recovery markers; never migrate/reset D1.
2. Review a clean exact-source `preview:prepare` package targeting the new origin, with its Worker name `preview`, existing `dev-preview` D1 and no email settings/secrets. Inspect the manifest, hashes and bundle before publication.
3. Plan the coordinated cutover: account subdomain switch followed by publishing the reviewed `preview` Worker; an interruption is possible while these changes propagate. Do not assume the old hostname continues to work. Publish only under the owner's approved nonproduction scope, never Production.
4. Test HTTPS, `/api/environment`, anonymous pages, no-store/asset boundaries, login/register/logout, CSRF, Session/World isolation and redirects on the **new** exact origin. Existing sessions from the old hostname will not carry over; users may need to sign in again.
5. Update Gmail OAuth/allowlist activation documentation and any external links to the new host; keep outbound mail disabled until separately approved. Record rollback steps and observed availability before claiming completion.

The migration does not change issue #170 completion count (13/15), Admin permissions or Draft/HOLD status. No cutover, secrets, remote D1 write or merge is implied by this document.
