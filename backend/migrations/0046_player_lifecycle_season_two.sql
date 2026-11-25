-- #779: first two-season rehearsal only. No rewrite of signed terms or earned claims.
-- The approved, immutable season snapshots are the sole sporting promotion authority.
CREATE VIEW player_contract_promotion_salary AS
 WITH promoted AS (
  SELECT DISTINCT s2.generation,j2.value AS club_key
  FROM seasons s2 JOIN seasons s1 ON s1.generation=s2.generation AND s1.season_number=1
  CROSS JOIN json_each(s2.snapshot_json,'$.bindings') b2
  CROSS JOIN json_each(b2.value,'$.clubIds') j2
  WHERE s2.season_number=2
   AND json_extract(b2.value,'$.competitionId') LIKE '%-1'
   AND json_extract(b2.value,'$.competitionId') NOT LIKE 'int-%'
   AND EXISTS(SELECT 1 FROM json_each(s1.snapshot_json,'$.bindings') b1
    CROSS JOIN json_each(b1.value,'$.clubIds') j1
    WHERE json_extract(b1.value,'$.competitionId') LIKE '%-2'
     AND json_extract(b1.value,'$.competitionId') NOT LIKE 'int-%'
     AND j1.value=j2.value)
 )
 SELECT c.id AS contract_id,40 AS annual_salary_arc
 FROM player_signed_contracts c JOIN promoted p ON p.generation=c.world_generation AND p.club_key=c.club_key
 WHERE c.annual_salary_arc<40 AND c.start_tick<56 AND COALESCE(c.closed_tick,c.scheduled_end_tick)>56;

-- The existing authenticated prepare-next transaction writes the Season 2
-- snapshot, completes its terminal milestone and performs this exact CAS.
-- Trigger work is part of that same transaction; a rejected CAS or rollback
-- cannot age players or close contracts. There is no independent aging command.
CREATE TRIGGER player_lifecycle_season_two BEFORE UPDATE OF season_number ON world_state
WHEN OLD.generation=NEW.generation AND OLD.season_number=1 AND OLD.phase='closed' AND OLD.day=56
 AND NEW.season_number=2 AND NEW.phase='preparing' AND NEW.day=0
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM seasons WHERE season_number=2 AND generation=OLD.generation)
  OR EXISTS(SELECT 1 FROM generated_players p WHERE p.entry_season<=1
   AND json_extract(p.payload_json,'$.career_status')='active'
   AND (json_type(p.payload_json,'$.age') IS NOT 'integer'
    OR json_extract(p.payload_json,'$.age') NOT BETWEEN 16 AND 39
    OR json_type(p.payload_json,'$.retirement_age') IS NOT 'integer'
    OR json_extract(p.payload_json,'$.retirement_age') NOT BETWEEN 33 AND 40
    OR json_extract(p.payload_json,'$.age')>=json_extract(p.payload_json,'$.retirement_age')))
  THEN RAISE(ABORT,'invalid player lifecycle source') END;
 -- Retirements take precedence over coincident expiry; no future wage entitlement.
 UPDATE player_signed_contracts SET closed_tick=MIN(56,scheduled_end_tick),
  close_reason=CASE WHEN EXISTS(SELECT 1 FROM generated_players p WHERE p.id=player_signed_contracts.player_id
   AND p.entry_season<=1 AND json_extract(p.payload_json,'$.career_status')='active'
   AND json_extract(p.payload_json,'$.age')+1>=json_extract(p.payload_json,'$.retirement_age'))
   THEN 'retirement' ELSE 'expiry' END
 WHERE world_generation=OLD.generation AND closed_tick IS NULL AND start_tick<56
  AND (scheduled_end_tick<=56 OR EXISTS(SELECT 1 FROM generated_players p WHERE p.id=player_signed_contracts.player_id
   AND p.entry_season<=1 AND json_extract(p.payload_json,'$.career_status')='active'
   AND json_extract(p.payload_json,'$.age')+1>=json_extract(p.payload_json,'$.retirement_age')));
 UPDATE player_agent_mandates SET end_tick=56
 WHERE world_generation=OLD.generation AND end_tick IS NULL AND start_tick<=56
  AND EXISTS(SELECT 1 FROM generated_players p WHERE p.id=player_agent_mandates.player_id
   AND p.entry_season<=1 AND json_extract(p.payload_json,'$.career_status')='active'
   AND json_extract(p.payload_json,'$.age')+1>=json_extract(p.payload_json,'$.retirement_age'));
 UPDATE generated_players SET payload_json=json_set(payload_json,
  '$.age',json_extract(payload_json,'$.age')+1,
  '$.career_status',CASE WHEN json_extract(payload_json,'$.age')+1>=json_extract(payload_json,'$.retirement_age')
   THEN 'retired' ELSE 'active' END)
 WHERE entry_season<=1 AND json_extract(payload_json,'$.career_status')='active';
 -- #763's existing trigger invalidates only the derived valuation index.
END;

-- Preserve all existing payroll checks; only replace the rate predicate and
-- entitlement calculation, using the same promotion view as the planner.
DROP TRIGGER payroll_claim_insert_guard;
CREATE TRIGGER payroll_claim_insert_guard BEFORE INSERT ON payroll_claims
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_claims c WHERE c.id=NEW.id OR
 (c.contract_id=NEW.contract_id AND c.from_tick<NEW.to_tick AND NEW.from_tick<c.to_tick))
 OR EXISTS(SELECT 1 FROM payroll_run_milestones WHERE kind='sealed' AND run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN player_signed_contracts c ON c.id=NEW.contract_id
 WHERE r.id=NEW.run_id AND c.world_generation=r.generation AND c.club_key=r.club_key
 AND NEW.from_tick>=MAX(c.start_tick,(r.season-1)*56+r.day-28)
 AND NEW.to_tick<=MIN(COALESCE(c.closed_tick,c.scheduled_end_tick),(r.season-1)*56+r.day)
 AND NEW.annual_salary_arc=(CASE WHEN r.season>=2 THEN COALESCE((SELECT annual_salary_arc FROM player_contract_promotion_salary WHERE contract_id=c.id),c.annual_salary_arc) ELSE c.annual_salary_arc END)
 AND NEW.due_arc=(NEW.annual_salary_arc*(NEW.to_tick-MAX(c.start_tick,(r.season-1)*56)))/56
 -(NEW.annual_salary_arc*(NEW.from_tick-MAX(c.start_tick,(r.season-1)*56)))/56
 AND ((NEW.mandate_id IS NULL AND NEW.recipient_id='reserve' AND NOT EXISTS(
 SELECT 1 FROM player_agent_mandates m WHERE m.player_id=c.player_id AND m.world_generation=r.generation
 AND m.start_tick<NEW.to_tick AND COALESCE(m.end_tick,NEW.to_tick)>NEW.from_tick AND COALESCE(m.end_tick,NEW.to_tick)>m.start_tick))
 OR EXISTS(SELECT 1 FROM player_agent_mandates m WHERE m.id=NEW.mandate_id
 AND m.player_id=c.player_id AND m.world_generation=r.generation
 AND m.start_tick<=NEW.from_tick AND COALESCE(m.end_tick,NEW.to_tick)>=NEW.to_tick
 AND NEW.recipient_id='user:'||m.account_id)))
 THEN RAISE(ABORT,'invalid payroll claim') END;
END;
DROP TRIGGER payroll_seal_insert_guard;
CREATE TRIGGER payroll_seal_insert_guard BEFORE INSERT ON payroll_run_milestones WHEN NEW.kind='sealed'
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_run_milestones WHERE kind='sealed' AND run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN world_state w ON w.id=1 AND w.generation=r.generation AND w.season_number=r.season AND w.day=r.day AND w.revision=r.world_revision AND w.phase='active' WHERE r.id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM payroll_runs r JOIN player_signed_contracts c ON c.world_generation=r.generation AND c.club_key=r.club_key
 WHERE r.id=NEW.run_id AND MAX(c.start_tick,(r.season-1)*56+r.day-28)<MIN(COALESCE(c.closed_tick,c.scheduled_end_tick),(r.season-1)*56+r.day)
 AND COALESCE((SELECT SUM(p.due_arc) FROM payroll_claims p WHERE p.run_id=r.id AND p.contract_id=c.id),0)<>
 ((CASE WHEN r.season>=2 THEN COALESCE((SELECT annual_salary_arc FROM player_contract_promotion_salary WHERE contract_id=c.id),c.annual_salary_arc) ELSE c.annual_salary_arc END)*(MIN(COALESCE(c.closed_tick,c.scheduled_end_tick),(r.season-1)*56+r.day)-MAX(c.start_tick,(r.season-1)*56)))/56
 -((CASE WHEN r.season>=2 THEN COALESCE((SELECT annual_salary_arc FROM player_contract_promotion_salary WHERE contract_id=c.id),c.annual_salary_arc) ELSE c.annual_salary_arc END)*(MAX(c.start_tick,(r.season-1)*56+r.day-28)-MAX(c.start_tick,(r.season-1)*56)))/56)
 OR EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_runs original ON original.generation=r.generation AND original.club_key=r.club_key
 JOIN payroll_claim_outstanding c ON c.run_id=original.id
 WHERE r.id=NEW.run_id AND original.season*56+original.day<=r.season*56+r.day
 AND c.outstanding_arc>0 AND NOT EXISTS(SELECT 1 FROM payroll_allocations a WHERE a.run_id=r.id AND a.claim_id=c.id))
 THEN RAISE(ABORT,'incomplete payroll allocation') END;
END;
