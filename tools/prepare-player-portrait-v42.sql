-- Read-only V4.2 preparation export; run against only the intended environment.
-- This SELECT reads the original committed player-generation draft and current
-- permanent player record. It NEVER reads or backs up legacy portrait identities.
-- The V4.2 offline preparer enforces one exact original draft match per ID.
SELECT g.id,
       g.payload_json,
       (SELECT j.value
        FROM player_generation_drafts AS d, json_each(d.candidates_json) AS j
        WHERE d.id=g.batch_id
          AND d.world_generation=g.world_generation
          AND json_extract(j.value,'$.display_name')=
              json_extract(g.payload_json,'$.display_name')
        LIMIT 1) AS original_json,
       (SELECT COUNT(*)
        FROM player_generation_drafts AS d, json_each(d.candidates_json) AS j
        WHERE d.id=g.batch_id
          AND d.world_generation=g.world_generation
          AND json_extract(j.value,'$.display_name')=
              json_extract(g.payload_json,'$.display_name')) AS matches
FROM generated_players AS g
ORDER BY g.id;
