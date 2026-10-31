# PLAYER-AUTH-01 — Existing Admin operator migration

Status: Draft/HOLD. This is an **offline trusted procedure**; no HTTP provisioning endpoint is exposed. No production migration has occurred.

## Preconditions
1. Apply reviewed local additive Player migrations 0013, 0014 and 0015 only to an isolated D1 fixture.
2. Register and verify the real operator's unified Player account through an owner-approved delivery mechanism (not yet configured).
3. Owner verifies the operator's identity outside the application and explicitly approves the exact `playerAccountId`, `legacyAdminId` and trusted `approvedBy` identity.
4. Capture read-only inventory with `adminOperatorMigrationInventory` from `backend/src/admin-operator-migration.ts`. Never expose account inventory to clients.

## Prepare and activate
Invoke `linkExistingAdminOperator(db,{playerAccountId,legacyAdminId,approvedBy},now)` **only from an approved, operator-controlled local migration runner**. This inserts a unique 1:1 audit link and grants the three existing Admin permissions in one atomic batch, only when:
- Both accounts exist and are enabled/active; Player email is verified.
- The normalized Player and legacy Admin emails match, but matching **never triggers automatic linking**.
- Neither identity is linked to another principal.
- The operator has explicitly approved both IDs.

No password hash or historical `admin_operations` row is copied or altered. The historical audit FK still points to the original legacy operator. Default Player accounts have zero permissions.

## Rollback and incident response
Invoke `revokeMigratedAdminOperator(db,playerAccountId,now)` from the same trusted context. It removes the explicit link, all three permissions and all of that Player's sessions atomically; it does **not** remove historical admin identities or operation records. An unlinked Player is blocked even if previously granted an Admin permission. No rollback is attempted against the live world until migration acceptance passes.

## Final acceptance (deferred)
Verify local migration rollback, two-identity collision, disabled legacy operator, unverified Player, mismatched email, grants and revocations, expired sessions, CSRF, replay and all Admin commands. Verify the old Admin login path is retired and no existing operator loses access after explicit onboarding. Review and execute CI exact-head. No deploy, remote D1 or real provider configuration without separate approval.
