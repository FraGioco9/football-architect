-- #778 Phase 2, inert domain evidence only. No balances, postings or activation.
-- 0044 is provisional; coordinate 0042/0043 before any merge.
CREATE TABLE payroll_runs (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 160),
 generation TEXT NOT NULL CHECK(length(generation)=36),
 season INTEGER NOT NULL CHECK(typeof(season)='integer' AND season BETWEEN 1 AND 1000000000),
 day INTEGER NOT NULL CHECK(day IN (28,56)),
 club_key TEXT NOT NULL CHECK(length(club_key) BETWEEN 4 AND 6),
 world_revision INTEGER NOT NULL CHECK(typeof(world_revision)='integer' AND world_revision>=0),
 policy_version TEXT NOT NULL REFERENCES economic_policy_versions(version),
 source_hash TEXT NOT NULL CHECK(length(source_hash)=64),
 UNIQUE(generation,season,day,club_key)
);
CREATE TABLE payroll_claims (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 160),
 run_id TEXT NOT NULL REFERENCES payroll_runs(id),
 contract_id INTEGER NOT NULL REFERENCES player_signed_contracts(id),
 mandate_id INTEGER REFERENCES player_agent_mandates(id),
 recipient_id TEXT NOT NULL REFERENCES economic_accounts(id),
 from_tick INTEGER NOT NULL CHECK(typeof(from_tick)='integer' AND from_tick>=0),
 to_tick INTEGER NOT NULL CHECK(typeof(to_tick)='integer' AND to_tick>from_tick),
 annual_salary_arc INTEGER NOT NULL CHECK(typeof(annual_salary_arc)='integer' AND annual_salary_arc BETWEEN 1 AND 1000000000000),
 due_arc INTEGER NOT NULL CHECK(typeof(due_arc)='integer' AND due_arc BETWEEN 1 AND 1000000000000),
 UNIQUE(contract_id,from_tick,to_tick)
);
CREATE TABLE payroll_allocations (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 160),
 run_id TEXT NOT NULL REFERENCES payroll_runs(id),
 claim_id TEXT NOT NULL REFERENCES payroll_claims(id),
 planned_arc INTEGER NOT NULL CHECK(typeof(planned_arc)='integer' AND planned_arc BETWEEN 0 AND 1000000000000),
 UNIQUE(run_id,claim_id)
);
CREATE TABLE payroll_run_seals (
 run_id TEXT PRIMARY KEY NOT NULL REFERENCES payroll_runs(id),
 plan_hash TEXT NOT NULL CHECK(length(plan_hash)=64)
);
CREATE TABLE payroll_payment_receipts (
 transaction_id TEXT PRIMARY KEY NOT NULL REFERENCES economic_transactions(id),
 allocation_id TEXT NOT NULL REFERENCES payroll_allocations(id)
);
CREATE TABLE payroll_run_completions (
 run_id TEXT PRIMARY KEY NOT NULL REFERENCES payroll_runs(id),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64)
);
CREATE INDEX payroll_claims_run ON payroll_claims(run_id);
CREATE INDEX payroll_allocations_claim ON payroll_allocations(claim_id);
CREATE INDEX payroll_receipts_allocation ON payroll_payment_receipts(allocation_id);
-- Paid amounts derive exclusively from sealed ledger entries; reversals remain visible.
CREATE VIEW payroll_allocation_paid AS
 SELECT a.id,a.run_id,a.claim_id,a.planned_arc,
 COALESCE((SELECT SUM(e.amount_arc) FROM payroll_payment_receipts p
 JOIN economic_entries e ON e.transaction_id=p.transaction_id
 WHERE p.allocation_id=a.id AND e.amount_arc>0
 AND NOT EXISTS(SELECT 1 FROM economic_transactions v WHERE v.reversal_of=p.transaction_id)),0) AS paid_arc,
 EXISTS(SELECT 1 FROM payroll_payment_receipts p JOIN economic_transactions v
 ON v.reversal_of=p.transaction_id WHERE p.allocation_id=a.id) AS reversed
 FROM payroll_allocations a;
CREATE VIEW payroll_claim_outstanding AS
 SELECT c.*,c.due_arc-COALESCE((SELECT SUM(a.paid_arc) FROM payroll_allocation_paid a WHERE a.claim_id=c.id),0) AS outstanding_arc
 FROM payroll_claims c;
CREATE TRIGGER payroll_run_insert_guard BEFORE INSERT ON payroll_runs
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_runs r WHERE r.id=NEW.id OR
 (r.generation=NEW.generation AND r.club_key=NEW.club_key AND
 (r.season*56+r.day>=NEW.season*56+NEW.day OR NOT EXISTS(SELECT 1 FROM payroll_run_completions x WHERE x.run_id=r.id))))
 OR EXISTS(SELECT 1 FROM payroll_allocation_paid a JOIN payroll_runs r ON r.id=a.run_id WHERE r.generation=NEW.generation AND r.club_key=NEW.club_key AND a.reversed<>0)
 OR NOT EXISTS(SELECT 1 FROM world_state w WHERE w.id=1 AND w.generation=NEW.generation
 AND w.season_number=NEW.season AND w.day=NEW.day AND w.revision=NEW.world_revision AND w.phase='active')
 THEN RAISE(ABORT,'invalid payroll run') END;
END;
CREATE TRIGGER payroll_claim_insert_guard BEFORE INSERT ON payroll_claims
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_claims c WHERE c.id=NEW.id OR
 (c.contract_id=NEW.contract_id AND c.from_tick<NEW.to_tick AND NEW.from_tick<c.to_tick))
 OR EXISTS(SELECT 1 FROM payroll_run_seals WHERE run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN player_signed_contracts c ON c.id=NEW.contract_id
 WHERE r.id=NEW.run_id AND c.world_generation=r.generation AND c.club_key=r.club_key
 AND NEW.from_tick>=MAX(c.start_tick,(r.season-1)*56+r.day-28)
 AND NEW.to_tick<=MIN(COALESCE(c.closed_tick,c.scheduled_end_tick),(r.season-1)*56+r.day)
 -- Phase 2 only: refuse non-original rate until #779 supplies authoritative prospective adjustments.
 AND NEW.annual_salary_arc=c.annual_salary_arc
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
CREATE TRIGGER payroll_allocation_insert_guard BEFORE INSERT ON payroll_allocations
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_allocations a WHERE a.id=NEW.id OR (a.run_id=NEW.run_id AND a.claim_id=NEW.claim_id))
 OR EXISTS(SELECT 1 FROM payroll_run_seals WHERE run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_claim_outstanding c ON c.id=NEW.claim_id
 JOIN payroll_runs original ON original.id=c.run_id WHERE r.id=NEW.run_id
 AND r.generation=original.generation AND r.club_key=original.club_key
 AND original.season*56+original.day<=r.season*56+r.day
 AND c.outstanding_arc>0 AND NEW.planned_arc<=c.outstanding_arc)
 THEN RAISE(ABORT,'invalid payroll allocation') END;
END;
CREATE TRIGGER payroll_seal_insert_guard BEFORE INSERT ON payroll_run_seals
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_run_seals WHERE run_id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_runs original ON original.generation=r.generation AND original.club_key=r.club_key
 JOIN payroll_claim_outstanding c ON c.run_id=original.id
 WHERE r.id=NEW.run_id AND original.season*56+original.day<=r.season*56+r.day
 AND c.outstanding_arc>0 AND NOT EXISTS(SELECT 1 FROM payroll_allocations a WHERE a.run_id=r.id AND a.claim_id=c.id))
 THEN RAISE(ABORT,'incomplete payroll allocation') END;
END;
CREATE TRIGGER payroll_receipt_insert_guard BEFORE INSERT ON payroll_payment_receipts
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_payment_receipts WHERE transaction_id=NEW.transaction_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_allocations a JOIN payroll_runs r ON r.id=a.run_id
 JOIN payroll_claims c ON c.id=a.claim_id JOIN payroll_allocation_paid p ON p.id=a.id
 JOIN payroll_run_seals s ON s.run_id=r.id JOIN economic_transactions t ON t.id=NEW.transaction_id
 JOIN economic_entries debit ON debit.transaction_id=t.id AND debit.account_id='club:'||r.club_key
 JOIN economic_entries credit ON credit.transaction_id=t.id AND credit.account_id=c.recipient_id
 WHERE a.id=NEW.allocation_id AND t.source_id=a.id AND t.generation=r.generation AND t.season=r.season AND t.day=r.day
 AND t.config_version=r.policy_version AND t.actor_kind='system' AND t.actor_id='payroll-settlement-v1'
 AND t.purpose=CASE WHEN c.mandate_id IS NULL THEN 'PAYROLL_AI' ELSE 'PAYROLL_HUMAN' END
 AND credit.amount_arc>0 AND debit.amount_arc=-credit.amount_arc
 AND p.reversed=0 AND p.paid_arc+credit.amount_arc<=a.planned_arc
 AND EXISTS(SELECT 1 FROM world_state w WHERE w.id=1 AND w.generation=r.generation AND w.season_number=r.season AND w.day=r.day AND w.revision=r.world_revision AND w.phase='active')
 AND NOT EXISTS(SELECT 1 FROM economic_transactions v WHERE v.reversal_of=t.id)
 AND NOT EXISTS(SELECT 1 FROM payroll_run_completions x WHERE x.run_id=r.id))
 THEN RAISE(ABORT,'invalid payroll receipt') END;
END;
CREATE TRIGGER payroll_completion_insert_guard BEFORE INSERT ON payroll_run_completions
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll_run_completions WHERE run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_run_seals WHERE run_id=NEW.run_id)
 OR NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN world_state w ON w.id=1 AND w.generation=r.generation AND w.season_number=r.season AND w.day=r.day AND w.revision=r.world_revision AND w.phase='active' WHERE r.id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM payroll_allocation_paid p WHERE p.run_id=NEW.run_id AND (p.paid_arc<>p.planned_arc OR p.reversed<>0))
 OR EXISTS(SELECT 1 FROM payroll_runs r JOIN economic_transactions t ON t.generation=r.generation AND t.season=r.season AND t.day=r.day
 JOIN economic_entries e ON e.transaction_id=t.id AND e.account_id='club:'||r.club_key AND e.amount_arc<0
 WHERE r.id=NEW.run_id AND t.purpose IN ('PAYROLL_AI','PAYROLL_HUMAN') AND NOT EXISTS(SELECT 1 FROM payroll_payment_receipts p WHERE p.transaction_id=t.id))
 THEN RAISE(ABORT,'incomplete payroll receipts') END;
END;
CREATE TRIGGER payroll_runs_no_update BEFORE UPDATE ON payroll_runs BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_runs_no_delete BEFORE DELETE ON payroll_runs BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_claims_no_update BEFORE UPDATE ON payroll_claims BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_claims_no_delete BEFORE DELETE ON payroll_claims BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_allocations_no_update BEFORE UPDATE ON payroll_allocations BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_allocations_no_delete BEFORE DELETE ON payroll_allocations BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_run_seals_no_update BEFORE UPDATE ON payroll_run_seals BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_run_seals_no_delete BEFORE DELETE ON payroll_run_seals BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_payment_receipts_no_update BEFORE UPDATE ON payroll_payment_receipts BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_payment_receipts_no_delete BEFORE DELETE ON payroll_payment_receipts BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_run_completions_no_update BEFORE UPDATE ON payroll_run_completions BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
CREATE TRIGGER payroll_run_completions_no_delete BEFORE DELETE ON payroll_run_completions BEGIN SELECT RAISE(ABORT,'immutable payroll evidence'); END;
