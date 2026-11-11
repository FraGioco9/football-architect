-- Local-first generated player persistence. Apply to DEV/preview only with explicit approval;
-- never run automatically against production or remote databases.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS player_generation_drafts (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 season_number INTEGER NOT NULL CHECK(season_number>=0),
 account_id TEXT NOT NULL, -- immutable audit identity; never blocks account removal
 options_json TEXT NOT NULL CHECK(json_valid(options_json)),
 candidates_json TEXT NOT NULL CHECK(json_valid(candidates_json)),
 count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 1000),
 seed TEXT NOT NULL CHECK(length(seed) BETWEEN 1 AND 64),
 status TEXT NOT NULL DEFAULT 'preview' CHECK(status IN('preview','committed')),
 created_at INTEGER NOT NULL CHECK(created_at>0),
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
 committed_at INTEGER,
 CHECK((status='preview' AND committed_at IS NULL) OR (status='committed' AND committed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS player_generation_drafts_actor
 ON player_generation_drafts(account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS generated_players (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 batch_id TEXT NOT NULL REFERENCES player_generation_drafts(id),
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 entry_season INTEGER NOT NULL CHECK(entry_season>=0),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 created_at INTEGER NOT NULL CHECK(created_at>0)
);
CREATE INDEX IF NOT EXISTS generated_players_world
 ON generated_players(world_generation,entry_season,batch_id);
CREATE INDEX IF NOT EXISTS generated_players_batch
 ON generated_players(batch_id);
