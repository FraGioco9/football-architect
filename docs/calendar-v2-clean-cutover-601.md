# Calendar V2 clean-cut cutover — #601

Owner decision (2026-11-14): **discard old calendar V1 state and regenerate a fresh world**. Do not build a V1 calendar backfill or an in-place V1-to-V2 transformation.

## Supported read/write behavior
- `initial-leagues-v2` is the only generated/validated domestic calendar version. Existing V1 calendar metadata, staged domestic fixtures and draw receipts are rejected as incompatible; they are **not** silently remapped.
- The new season is regenerated from the approved current world, with deterministic V2 30-round domestic home/away balancing, unchanged international pot rules, independent domestic/international official publication, and 4,082 permanent match-slot IDs.
- The legacy preexisting match/results/source IDs are **not rewritten**. Old V1 state should be removed using the existing authorized **Reset Season 0** workflow, which rotates the world generation and clears season fixtures, sporting receipts and match slots together. Recreate calendar evidence through the normal official draw commands.
- **No automatic destructive data migration.** D1 schema migrations 0023/0024 only create tables and indexes. They never delete sporting history. If a shared DEV/preview/prod environment contains V1 state, an operator must separately approve its explicit reset and understand the irreversibility of wiping its world seasons/results.
- Other legacy systems (accounts, players, player–club affiliations, profiles and unrelated persistent state) are not included in this calendar-only clean cut.

## Safety, operational sequence
1. On PR review: verify no unexpected V1 source replay remains and the fresh-world backend tests pass on the exact HEAD.
2. Review any existing V1 world **before** deploying these changes. Decide explicitly whether/when to reset it with the supported world reset command. Never attempt a partial migration that leaves receipts and schedule hashes inconsistent.
3. Apply the two new schema migrations only through a separately approved deployment/database change.
4. Under separate authorization, reset the old calendar world and perform the domestic draw then international draw. Confirm scope-specific publication and stable IDs; repeat for a second season.
5. Only then roll out read APIs. The page/link integration is deliberately deferred to #577 / #605.

No merge, deployment or remote database action is authorized merely by the owner accepting a clean cut in this conversation.
