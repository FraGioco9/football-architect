-- Owner correction (#390): sample a private fixed retirement age at creation.
-- This replaces the unused seed; do not rerun the historical migration 0036.
-- All existing players in the authorized DEV backfill cohort are pre-retirement age.
-- Preserve every other field's value and relative order, including JSON null/boolean/array/object types.
-- Rebuild only rows needing assignment, seed removal or placement immediately after age.
UPDATE generated_players
SET payload_json=(
 SELECT json_group_object(field,json(raw_value)) FROM (
  SELECT e.key AS field,generated_players.payload_json -> e.fullkey AS raw_value,e.id*2 AS sort_order
  FROM json_each(generated_players.payload_json) AS e
  WHERE e.key NOT IN ('retirement_seed','retirement_age')
  UNION ALL
  SELECT 'retirement_age',COALESCE(NULLIF(generated_players.payload_json -> '$.retirement_age','null'),CAST(CASE
       WHEN abs(random()) % 100 < 2 THEN 33
       WHEN abs(random()) % 100 < 5 THEN 34
       WHEN abs(random()) % 100 < 12 THEN 35
       WHEN abs(random()) % 100 < 25 THEN 36
       WHEN abs(random()) % 100 < 45 THEN 37
       WHEN abs(random()) % 100 < 70 THEN 38
       WHEN abs(random()) % 100 < 90 THEN 39
       ELSE 40 END AS TEXT)),e.id*2+1
  FROM json_each(generated_players.payload_json) AS e WHERE e.key='age'
  ORDER BY sort_order
 ))
WHERE json_type(payload_json,'$.retirement_seed') IS NOT NULL
 OR json_type(payload_json,'$.retirement_age') IS NULL
 OR json_type(payload_json,'$.retirement_age')='null'
 OR NOT EXISTS (
  SELECT 1 FROM (SELECT key,lag(key) OVER(ORDER BY id) AS previous_key FROM json_each(generated_players.payload_json))
  WHERE key='retirement_age' AND previous_key='age'
 );
