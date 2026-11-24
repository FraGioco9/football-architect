-- Backfill a permanent private per-player entropy seed for future annual retirement draws.
-- Approval of the retirement hazard does NOT authorize changing career_status here.
-- Independent of development aptitude, age and other footballer data.
-- Run only in an explicitly authorized D1 environment, never automatically against remote D1.
UPDATE generated_players
SET payload_json=json_set(payload_json,'$.retirement_seed',lower(hex(randomblob(16))))
WHERE json_type(payload_json,'$.retirement_seed') IS NULL;
