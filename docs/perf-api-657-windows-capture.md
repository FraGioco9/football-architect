# PERF-API #657 — paired local Worker/D1 measurement on Windows

This procedure captures actual anonymous HTTP request counts and browser `ResourceTiming.transferSize` values against two immutable source revisions. It does not use the shared DEV/Preview/Production D1.

## Preconditions

- Windows 11 PowerShell, Node 22, Git and npm. The runner installs pinned Playwright Chromium in a disposable temporary directory.
- All local Football Architect servers on ports 2000 and 8787 must be stopped.
- A separate snapshot of a **disposable local** Wrangler state containing a legitimately prepared and published season (preferably Season 1/day 13). The Worker must be stopped during the copy. Never copy remote production, shared DEV or Preview data.
- Fetch both exact Git commits locally. No branch is force-updated and no deploy occurs.

## Snapshot the local-only D1 state

From the root of a checkout already using the LOCAL Wrangler configuration, with the local Worker stopped:

```powershell
$source = (Resolve-Path '.\backend\.wrangler\state').Path
$snapshot = Join-Path $env:TEMP ('fa-657-disposable-' + [guid]::NewGuid().ToString('N'))
Copy-Item -LiteralPath $source -Destination $snapshot -Recurse
```

Keep this SQLite snapshot private. Do not upload it or share local accounts/tokens. The runner requires the snapshot outside the working repository and checks that it contains SQLite data.

## Run the exact before/after capture

Run from a checkout containing `tools/perf-api-657-paired-local.mjs`:

```powershell
git fetch origin main pull/686/head
node tools/perf-api-657-paired-local.mjs --before=003806fd7bd6a9b51ef1811f1e3b255eabcf9c8d --after=30bd215f41531326676e4c28f56f2a7546125b7b --snapshot="$snapshot" --runs=2
```

The two SHAs are respectively the pre-#686 `main` and the exact PR #686 Explore optimization HEAD. This measures the actual Worker and frontend served by each checkout with one identical schema-v2 sampler.

On a clean temporary copy of the same local SQLite state for each revision, the script starts only `node tools/dev.mjs --local`, checks `/api/world` and anonymous permissions, verifies identical world generation/revision/season/day/phase, collects direct/refresh/return and applicable in-page routes, then stops that Worker before starting the other one. Only successful comparable observations can contribute to reported on-wire savings. Cleanup removes the runner's temporary worktrees, not the source snapshot.

Default coverage: Dashboard, Calendar, Explore Clubs, Club Overview, Fixtures and History. To focus on one subsystem:

```powershell
node tools/perf-api-657-paired-local.mjs --before=003806fd7bd6a9b51ef1811f1e3b255eabcf9c8d --after=30bd215f41531326676e4c28f56f2a7546125b7b --snapshot="$snapshot" --runs=3 --routes=/clubs,/dashboard,/calendar
```

Redacted reports are written to `int24-browser-artifacts/perf-api-657-*.json`. Review `pairs.wireComparable` and individual `status: wire-comparable` rows before claiming a transfer reduction. Missing browser timing, 4xx/5xx on required endpoints, unprepared seasons and mismatched world states are not a performance pass. Counts include allowlisted static JSON and read-contract modules (including Calendar's authoritative reader and season validator, the shared compact reader and Competition model), but not every image/CSS/font.

After reviewing the reports, the snapshot can be deleted locally by its exact path. This is a diagnostic activity only: it does not advance/reset the world, apply migrations, authenticate Admin users, write any remote D1, merge PRs or deploy.
