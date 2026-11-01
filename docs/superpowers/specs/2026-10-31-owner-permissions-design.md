# Trusted Admin command and account-pool boundary

Owner decisions: Dev and Preview share accounts; Production has independent accounts. Sign-in remains separate per environment. Admin assignment uses a trusted command, not a web panel. The intended account and sender mailbox will be created later.

## This block
Implement a complete **local-only** owner command: initialize a target pool marker, inspect an existing account, grant and revoke the three existing Admin permissions. Default target is local Dev persistence. Dev/Preview map to `dev-preview`, Production to `production`; immutable database metadata must match before any permission mutation. Production labels refer only to explicitly selected local rehearsal data, never a remote production database.

An active verified Player is selected by email and pinned immutable account ID at confirmation. New operators receive an audit-only principal with no usable legacy password. Linking an existing historic principal requires its explicit ID; matching email alone is insufficient. Grants, audit link, session/token invalidation and permission-change receipt commit atomically. Revocation remains possible after verification/legacy identity drift and preserves historical sporting audit. No self-service route or automatic registration promotion.

`init` alone may apply local migrations and bind a previously unbound database. Other actions must require existing persistence and skip migrations. Permission changes default to dry-run; interactive confirmation or an explicit matching account ID is required for `--apply`. No password is accepted by the command.

## Approaches
Chosen by owner: trusted CLI; fastest way to bootstrap the first Admin. Alternative: bootstrap command plus a site management panel, deferred. Existing rehearsal helpers cannot be used as the real permission manager because they lack transactional pre/postcondition checks.

## Deferred integration
Runtime account-pool sharing is **not implemented by this block**. Auth and sporting mutation guards currently share one D1 transaction. A future shared nonproduction identity service must preserve these guards and keep worlds/sessions/Production independent; simply rebinding Dev to production or splitting the atomic guard across D1 databases is prohibited. No runtime binding, remote D1, email, DNS, live grants, merge or deployment here.
