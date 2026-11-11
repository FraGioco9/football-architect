-- Replace legacy footballer IDs with monotonic positive integers; unrelated IDs remain opaque.
-- Preserve the previous migration as historical input for existing local databases.
CREATE TABLE generated_players_numeric (
 id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id > 0),
 batch_id TEXT NOT NULL REFERENCES player_generation_drafts(id),
 world_generation TEXT NOT NULL CHECK(length(world_generation)=36),
 entry_season INTEGER NOT NULL CHECK(entry_season >= 0),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 created_at INTEGER NOT NULL CHECK(created_at > 0)
);
INSERT INTO generated_players_numeric
 (id,batch_id,world_generation,entry_season,payload_json,created_at)
WITH numbered AS (
 SELECT ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS next_id,
        batch_id,world_generation,entry_season,payload_json,created_at
 FROM generated_players
)
SELECT next_id,batch_id,world_generation,entry_season,
       json_set(json_remove(payload_json,'$.id','$.preview_id'),'$.id',next_id),
       created_at
FROM numbered;
DROP TABLE generated_players;
ALTER TABLE generated_players_numeric RENAME TO generated_players;
CREATE INDEX generated_players_world
 ON generated_players(world_generation,entry_season,batch_id);
CREATE INDEX generated_players_batch
 ON generated_players(batch_id);
-- Remove obsolete candidate IDs from both pending and committed previews.
-- Draft IDs, operation IDs, and world generation identifiers are separate audit/security values.
UPDATE player_generation_drafts
 SET candidates_json=(
   SELECT json_group_array(json_remove(value,'$.id'))
   FROM json_each(player_generation_drafts.candidates_json)
 );
