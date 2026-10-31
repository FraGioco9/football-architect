# Owner Admin permission command — local only (Draft/HOLD)

`admin:permissions` manages an account you have already created and verified through the site. It does not register accounts, send email or ask for passwords. Only a person with filesystem access to the local D1 persistence can run it; it is never exposed through HTTP.

**Current scope:** real local permission management and disposable rehearsals. There is no remote D1 adapter. `--environment production` labels explicitly selected **local rehearsal data**, not a live production connection. Live Cloudflare resources and account-pool sharing remain unconfigured.

## PowerShell use

From the repository root, initialize the local account-pool marker once (this explicitly applies local additive migrations):

```powershell
npm --prefix backend run admin:permissions -- init --apply
```

The default environment is `dev`; default state is `backend/.wrangler/state`, matching the local Wrangler configuration. Stop the local Worker before owner maintenance, then restart it afterward.

After you create and verify the intended site account, inspect it:

```powershell
npm --prefix backend run admin:permissions -- status --email your-account@example.com
```

Assign Admin access using one command and its typed confirmation prompt:

```powershell
npm --prefix backend run admin:permissions -- grant --email your-account@example.com --apply
```

Revoke it similarly:

```powershell
npm --prefix backend run admin:permissions -- revoke --email your-account@example.com --apply
```

Without `--apply`, grant/revoke are dry-runs. Noninteractive trusted automation must explicitly pass the reviewed `--confirm-account <accountId>` shown by status. Unknown/duplicate arguments, relative/URL/network targets, missing accounts, unverified grants and mismatching account IDs are rejected. Status and dry-run open existing state without applying migrations or changing account/permission data; the local SQLite engine may open its journals.

## Environment boundary

| Environment flag | Required target marker |
| --- | --- |
| `--environment dev` | `dev-preview` |
| `--environment preview` | `dev-preview` |
| `--environment production` | `production` |

Use `--persist-to <absolute-local-directory>` when maintaining another local target. A target is pinned by `init`; it cannot be relabeled/deleted through this tool. Selecting Production against a Dev/Preview target fails closed. Migration alone never initializes a marker, creates an account or grants permissions.

**A shared marker is not a shared account database.** This block does not synchronize Dev and Preview or change runtime bindings. They will require the same approved nonproduction identity service in a later integration. Sporting worlds must not be shared merely to share accounts; current world mutation guards must stay atomic. Production remains an independent account pool, and separate browser sign-ins remain required.

## Existing historical operators

A new Player without an existing historical operator gets an audit-only principal with the non-password sentinel `!unified-player-audit-only`. The retired Admin login remains unavailable. If an old operator already exists with that email, automatic matching is refused: review its immutable ID from the trusted status output and add `--legacy-id <id>` to the grant command. Existing passwords and historical `admin_operations` records are never rewritten. Disabled or conflicting identities cannot be granted access.

## Atomic effects

Grant writes the explicit audit link and all three existing permissions (`admin.access`, `admin.world.read`, `admin.world.write`). Grant/revoke invalidate old Player sessions, one-time verification/recovery links and linked legacy sessions in the same transaction. Sign in again afterward. Revoke removes permissions and the active link even after verification/legacy identity drift; historical principals and sporting audit remain. The append-only permission receipt contains opaque IDs, action, pool and timestamp, with no email, password or token payload.

Late identity changes, link conflicts, audit errors and postcondition failures roll back the complete permission transaction. This is independent of the whole-roster historic cutover runbook; managing one future account does not declare that cutover complete.

No production grant, remote D1, email, DNS, deployment or merge is authorized or executed by adding this command.


## Hardening follow-up — 31 October 2026

Migration `0018_owner_permissions_insert_guards.sql` closes SQLite `REPLACE`/`INSERT OR REPLACE` bypasses for existing pool/receipt IDs. Reinitializing the same Dev/Preview pool remains idempotent; no existing pool or receipt is rewritten.

Before opening an existing target, the helper derives the selected reserved local D1 backing path using the pinned runtime in temporary scratch state. It rejects missing, unrelated, symlinked or invalid-header targets before starting Miniflare on that target. Only 16 header bytes are read. Status/dry-run on an unrelated SQLite directory no longer creates a selected database/cache there. Temporary discovery state is removed even when runtime disposal fails.
