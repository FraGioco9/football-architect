# Dev/Preview account and world integration — confirmed

Owner requirements already confirmed: Dev and Preview share accounts, Production accounts are independent, each environment requires its own sign-in, and Admin permissions use a trusted owner command. Sender mailbox and the intended account will be created later. No remote operation is authorized.

## Current constraint

`http-player.ts` and `http-admin.ts` both obtain credentials, sessions, permissions and sporting data from `env.DB`. `unifiedAdminMutationGuard()` joins session/account/link/permissions in the **same D1 batch** as a world mutation. This protects against revocation and identity changes at commit time.

The local owner command now enforces target-pool metadata; it does not synchronize accounts or connect hosted resources. Merely pointing Dev and Preview at the same existing D1 would share their world as well as their accounts. Merely splitting auth into a second binding would invalidate the current atomic authorization design.

## Approaches

1. **Share nonproduction backend and world as well as accounts.** One nonproduction D1 for Dev/Preview, with independent per-origin sessions and explicit trusted entry points; a separate Production backend/D1. This preserves the current same-database atomic guard, but shared sporting/world state must be explicitly intended by the owner. Origins/proxy trust and environment resources still require implementation and separately authorized activation.
2. **Share accounts only; keep Dev/Preview worlds independent.** A common identity service with separate environment sessions/permissions/world backends. This needs an explicit authorization/revocation protocol that preserves the current commit-time guarantees; moving the joins across D1 bindings or using stale replicas is not an acceptable shortcut. Larger implementation, with separate design/security acceptance.

Owner confirmed option 1: **also share seasons, matches and results**. The opt-in implementation now uses one nonproduction Worker/D1 with independent sign-ins and strict environment checks. See [runtime setup and remaining activation boundaries](docs-shared-nonproduction.md). Option 2 is not being implemented. No database rebinding, account copying, live permission propagation or resource provisioning has been performed.
