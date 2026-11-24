-- Owner correction (#390): sample a private fixed retirement age at creation.
-- This replaces the unused seed; do not rerun the historical migration 0036.
-- All existing players in the authorized DEV backfill cohort are pre-retirement age.
-- No career status, age, contract, affiliation or other player state changes.
UPDATE generated_players
SET payload_json=json_set(json_remove(payload_json,'$.retirement_seed'),'$.retirement_age',
 CASE
       WHEN abs(random()) % 100 < 2 THEN 33
       WHEN abs(random()) % 100 < 5 THEN 34
       WHEN abs(random()) % 100 < 12 THEN 35
       WHEN abs(random()) % 100 < 25 THEN 36
       WHEN abs(random()) % 100 < 45 THEN 37
       WHEN abs(random()) % 100 < 70 THEN 38
       WHEN abs(random()) % 100 < 90 THEN 39
       ELSE 40 END)
WHERE json_type(payload_json,'$.retirement_age') IS NULL
   OR json_type(payload_json,'$.retirement_age')='null';
-- Preserve a previously assigned retirement age and remove any leftover legacy seed.
UPDATE generated_players
SET payload_json=json_remove(payload_json,'$.retirement_seed')
WHERE json_type(payload_json,'$.retirement_seed') IS NOT NULL;
