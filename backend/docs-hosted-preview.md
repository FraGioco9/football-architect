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
