# Dedicated public match statistics

Owner-approved #643 API split:

- `GET /api/matches/:id`: match identity, participants, competition/season/stage, status, score/resolution, venue and provenance. No player lineup, individual votes or player counters.
- `GET /api/matches/:id/stats`: the same numeric match identity, status, competition/season, home/away club IDs, provenance receipt hash and nullable `statistics`.

Both readers use the same independently verified immutable receipt chain. This separates transport and consumers; it does not introduce another result authority or promise cheaper chain verification. Unknown/unpublished IDs return 404; unavailable evidence returns 503; stale-world reads return 409. Only GET with no query string is accepted. Existing anonymous/no-store/security proxy boundaries apply.

Scheduled and unresolved matches return `statistics: null`. Completed evidence exposes `ratingVersion`, home/away sides and recorded goal events. Each side contains its mode, unattributed team goals and verified real player participation rows. Fallback sides have no player IDs. Each player row contains:

- `playerId`, nullable frozen `name`, nullable ISO-3 primary `nationality`, and actual frozen `role`.
- `started`, `minutes`, `goals`, nullable `rating`, nullable goalkeeper-only `cleanSheets` (requires at least 60 recorded minutes playing GK, regardless of natural position; team concedes zero goals).
- Nullable `assists` and `redCards`, currently unavailable because those events are not modeled.

Goal events carry scorer ID/name/nationality, side, minute and period. There are no internal attributes, suitability, seed or private generator fields. Penalty-shootout kicks are not scored-goal events.

The match page renders its ordinary match response immediately, then loads the statistics endpoint independently for completed games. Statistics commit only when match ID, competition, season, completed status and nonempty immutable receipt hash agree with the displayed match. A slow, failed or mismatched statistics response leaves the scoreboard and fixed lineup geometry intact. No per-player detail HTTP calls are needed.

## Frozen identity persistence

New official writes attach a versioned `player-identity-v1` extension to the existing result receipt: one `{playerId, name, nationality}` entry per actual participating player, no fallback identities. The metadata is attached **after simulation** so it cannot change seeded scores or votes. The existing candidate/official receipt digest binds it; replay rejects partial, duplicate, foreign-ID, wrong-version or malformed identity metadata. Atomic roster-source guards cover the full original persisted player payload.

Historical receipts are not updated. Without identity metadata the per-match API returns null name/nationality and the UI uses the numeric ID. Existing pre-identity archive summaries retain their original JSON/hash; newly identity-bearing archived player rows preserve the frozen name/nationality. No migration, backfill, remote DB write or historical resimulation is needed.

The response schema split and its frontend consumer must ship together when deployment is separately authorized. A new client against an old server can still render the scoreboard when the statistics route is absent. Owner review, merge and deploy remain separate gates.
