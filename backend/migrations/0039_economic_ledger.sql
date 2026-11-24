-- #775: additive, inert accounting foundation. No accounts, money, grants or policy
-- activated by this migration. Never apply remotely without separate authorization.
-- All monetary units are whole ARC. Bound each line to keep all per-post arithmetic exact.
CREATE TABLE economic_accounts (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('CLUB_TREASURY','USER_WALLET','PLATFORM_RESERVE','ISSUANCE_CONTROL')),
 owner_id TEXT NOT NULL CHECK(length(owner_id) BETWEEN 1 AND 160),
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 UNIQUE(kind,owner_id),
 CHECK(id=CASE kind WHEN 'CLUB_TREASURY' THEN 'club:'||owner_id
  WHEN 'USER_WALLET' THEN 'user:'||owner_id
  WHEN 'PLATFORM_RESERVE' THEN 'reserve' ELSE 'issuance' END),
 CHECK(kind IN ('CLUB_TREASURY','USER_WALLET') OR owner_id='platform')
);
-- Wallet identity is an opaque account ID, not email; retain it even on account closure.
CREATE TRIGGER economic_account_insert_guard BEFORE INSERT ON economic_accounts
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_accounts WHERE id=NEW.id OR (kind=NEW.kind AND owner_id=NEW.owner_id))
 THEN RAISE(ABORT,'economic account already exists') END;
 SELECT CASE WHEN NEW.kind='USER_WALLET' AND NOT EXISTS(
  SELECT 1 FROM player_accounts WHERE id=NEW.owner_id AND status='active' AND email_verified_at IS NOT NULL)
 THEN RAISE(ABORT,'economic wallet ineligible') END;
END;
CREATE TRIGGER economic_account_no_update BEFORE UPDATE ON economic_accounts
BEGIN SELECT RAISE(ABORT,'economic account identity immutable'); END;
CREATE TRIGGER economic_account_no_delete BEFORE DELETE ON economic_accounts
BEGIN SELECT RAISE(ABORT,'economic account identity immutable'); END;

CREATE TABLE economic_policy_versions (
 version TEXT PRIMARY KEY NOT NULL CHECK(length(version) BETWEEN 1 AND 100),
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 approved_by TEXT NOT NULL CHECK(length(approved_by) BETWEEN 1 AND 160),
 genesis_reserve_arc INTEGER NOT NULL CHECK(typeof(genesis_reserve_arc)='integer' AND genesis_reserve_arc BETWEEN 1 AND 1000000000000),
 issuance_limit_arc INTEGER NOT NULL CHECK(typeof(issuance_limit_arc)='integer' AND issuance_limit_arc BETWEEN genesis_reserve_arc AND 1000000000000),
 club_opening_json TEXT NOT NULL CHECK(json_valid(club_opening_json) AND json_type(club_opening_json)='object'),
 rules_json TEXT NOT NULL CHECK(json_valid(rules_json) AND json_type(rules_json)='object')
);
CREATE TRIGGER economic_policy_no_replace BEFORE INSERT ON economic_policy_versions
WHEN EXISTS(SELECT 1 FROM economic_policy_versions WHERE version=NEW.version)
BEGIN SELECT RAISE(ABORT,'economic policy immutable'); END;
CREATE TRIGGER economic_policy_no_update BEFORE UPDATE ON economic_policy_versions
BEGIN SELECT RAISE(ABORT,'economic policy immutable'); END;
CREATE TRIGGER economic_policy_no_delete BEFORE DELETE ON economic_policy_versions
BEGIN SELECT RAISE(ABORT,'economic policy immutable'); END;

-- Deliberately empty. Trusted local fixtures may activate an explicit test version.
-- Future production activation, finance grants and lifecycle adapter are separate gates.
CREATE TABLE economic_control (
 id INTEGER PRIMARY KEY CHECK(id=1),
 active_version TEXT NOT NULL REFERENCES economic_policy_versions(version),
 posting_enabled INTEGER NOT NULL CHECK(posting_enabled IN (0,1))
);
-- Fail a whole batch, rather than accepting a zero-row guarded mutation.
CREATE TABLE economic_assertions (must_be_true INTEGER NOT NULL CHECK(must_be_true=1 AND 0));

CREATE TABLE economic_transactions (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36),
 business_key TEXT NOT NULL UNIQUE CHECK(length(business_key) BETWEEN 1 AND 240),
 request_key TEXT NOT NULL CHECK(length(request_key) BETWEEN 1 AND 160),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 purpose TEXT NOT NULL CHECK(purpose IN ('GENESIS_RESERVE','ISSUE_RESERVE','RETIRE_RESERVE','CLUB_OPENING','REWARD','PAYROLL_HUMAN','PAYROLL_AI','YOUTH_PURCHASE','SPORTING_TRANSFER','CAPITAL_PURCHASE','ARC_ACQUISITION','REVERSAL')),
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('user','admin','system')),
 actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 160),
 config_version TEXT NOT NULL REFERENCES economic_policy_versions(version),
 source_id TEXT NOT NULL CHECK(length(source_id) BETWEEN 1 AND 240),
 generation TEXT CHECK(generation IS NULL OR length(generation)=36),
 season INTEGER CHECK(season IS NULL OR (typeof(season)='integer' AND season>=0)),
 day INTEGER CHECK(day IS NULL OR (typeof(day)='integer' AND day BETWEEN 0 AND 56)),
 occurred_at INTEGER NOT NULL CHECK(typeof(occurred_at)='integer' AND occurred_at>0),
 reversal_of TEXT UNIQUE REFERENCES economic_transactions(id),
 lines_json TEXT NOT NULL CHECK(json_valid(lines_json) AND json_type(lines_json)='array'),
 UNIQUE(actor_kind,actor_id,request_key),
 CHECK((generation IS NULL AND season IS NULL AND day IS NULL) OR (generation IS NOT NULL AND season IS NOT NULL AND day IS NOT NULL)),
 CHECK((purpose='REVERSAL')=(reversal_of IS NOT NULL))
);
CREATE UNIQUE INDEX economic_genesis_once ON economic_transactions(purpose) WHERE purpose='GENESIS_RESERVE';
CREATE UNIQUE INDEX economic_club_opening_once ON economic_transactions(source_id) WHERE purpose='CLUB_OPENING';
CREATE INDEX economic_transactions_time ON economic_transactions(occurred_at,id);
CREATE TABLE economic_entries (
 transaction_id TEXT NOT NULL REFERENCES economic_transactions(id),
 line_no INTEGER NOT NULL CHECK(typeof(line_no)='integer' AND line_no BETWEEN 0 AND 15),
 account_id TEXT NOT NULL REFERENCES economic_accounts(id),
 amount_arc INTEGER NOT NULL CHECK(typeof(amount_arc)='integer' AND amount_arc BETWEEN -1000000000000 AND 1000000000000 AND amount_arc<>0),
 PRIMARY KEY(transaction_id,line_no),
 UNIQUE(transaction_id,account_id)
) WITHOUT ROWID;
CREATE INDEX economic_entries_account ON economic_entries(account_id,transaction_id);
-- Canonical balance projection; no independently editable balance column.
CREATE VIEW economic_balances AS
 SELECT a.id,a.kind,a.owner_id,COALESCE((SELECT SUM(e.amount_arc) FROM economic_entries e WHERE e.account_id=a.id),0) AS balance_arc
 FROM economic_accounts a;

-- One INSERT is the seal: validate complete envelope before materializing ALL entries
-- in its AFTER trigger. No application-visible unsealed journal state.
CREATE TRIGGER economic_transaction_guard BEFORE INSERT ON economic_transactions
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_transactions WHERE id=NEW.id OR business_key=NEW.business_key
 OR (actor_kind=NEW.actor_kind AND actor_id=NEW.actor_id AND request_key=NEW.request_key)
 OR (NEW.reversal_of IS NOT NULL AND reversal_of=NEW.reversal_of)
 OR (NEW.purpose='GENESIS_RESERVE' AND purpose='GENESIS_RESERVE')
 OR (NEW.purpose='CLUB_OPENING' AND purpose='CLUB_OPENING' AND source_id=NEW.source_id))
 THEN RAISE(ABORT,'economic duplicate operation') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM economic_control WHERE id=1 AND posting_enabled=1 AND active_version=NEW.config_version)
 THEN RAISE(ABORT,'economic posting disabled or stale policy') END;
 SELECT CASE WHEN json_array_length(NEW.lines_json)<>2
 OR EXISTS(SELECT 1 FROM json_each(NEW.lines_json) j WHERE j.type<>'object'
 OR json_type(j.value,'$.accountId') IS NOT 'text'
 OR json_type(j.value,'$.amountArc') IS NOT 'integer'
 OR json_extract(j.value,'$.amountArc') NOT BETWEEN -1000000000000 AND 1000000000000
 OR json_extract(j.value,'$.amountArc')=0
 OR (SELECT COUNT(*) FROM json_each(j.value))<>2
 OR NOT EXISTS(SELECT 1 FROM economic_accounts a WHERE a.id=json_extract(j.value,'$.accountId')))
 THEN RAISE(ABORT,'economic invalid entries') END;
 SELECT CASE WHEN (SELECT COUNT(DISTINCT json_extract(value,'$.accountId')) FROM json_each(NEW.lines_json))<>2
 OR (SELECT SUM(json_extract(value,'$.amountArc')) FROM json_each(NEW.lines_json))<>0
 THEN RAISE(ABORT,'economic unbalanced entries') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.lines_json) j JOIN economic_balances b
 ON b.id=json_extract(j.value,'$.accountId')
 WHERE b.balance_arc+json_extract(j.value,'$.amountArc') NOT BETWEEN
 CASE WHEN b.kind='ISSUANCE_CONTROL' THEN -1000000000000 ELSE 0 END
 AND CASE WHEN b.kind='ISSUANCE_CONTROL' THEN 0 ELSE 1000000000000 END)
 THEN RAISE(ABORT,'economic insufficient funds or balance limit') END;
 -- Only approved route shapes; domain adapters must supply their own authority,
 -- certificate/ownership/entitlement predicates in the same batch.
 SELECT CASE WHEN NEW.purpose<>'REVERSAL' AND NOT EXISTS(
 SELECT 1 FROM json_each(NEW.lines_json) d JOIN economic_accounts da ON da.id=json_extract(d.value,'$.accountId'),
 json_each(NEW.lines_json) c JOIN economic_accounts ca ON ca.id=json_extract(c.value,'$.accountId')
 WHERE json_extract(d.value,'$.amountArc')<0 AND json_extract(c.value,'$.amountArc')>0 AND (
 (NEW.purpose IN ('GENESIS_RESERVE','ISSUE_RESERVE') AND da.kind='ISSUANCE_CONTROL' AND ca.kind='PLATFORM_RESERVE') OR
 (NEW.purpose='RETIRE_RESERVE' AND da.kind='PLATFORM_RESERVE' AND ca.kind='ISSUANCE_CONTROL') OR
 (NEW.purpose IN ('CLUB_OPENING','REWARD','CAPITAL_PURCHASE') AND da.kind='PLATFORM_RESERVE' AND ca.kind='CLUB_TREASURY') OR
 (NEW.purpose='PAYROLL_HUMAN' AND da.kind='CLUB_TREASURY' AND ca.kind='USER_WALLET') OR
 (NEW.purpose='PAYROLL_AI' AND da.kind='CLUB_TREASURY' AND ca.kind='PLATFORM_RESERVE') OR
 (NEW.purpose='YOUTH_PURCHASE' AND da.kind='USER_WALLET' AND ca.kind='PLATFORM_RESERVE') OR
 (NEW.purpose='SPORTING_TRANSFER' AND da.kind='CLUB_TREASURY' AND ca.kind='CLUB_TREASURY') OR
 (NEW.purpose='ARC_ACQUISITION' AND da.kind='PLATFORM_RESERVE' AND ca.kind='USER_WALLET')))
 THEN RAISE(ABORT,'economic invalid route') END;
 SELECT CASE WHEN NEW.purpose='GENESIS_RESERVE' AND
 (SELECT MAX(json_extract(value,'$.amountArc')) FROM json_each(NEW.lines_json))<>
 (SELECT genesis_reserve_arc FROM economic_policy_versions WHERE version=NEW.config_version)
 THEN RAISE(ABORT,'economic invalid genesis') END;
 SELECT CASE WHEN NEW.purpose='CLUB_OPENING' AND NOT EXISTS(
 SELECT 1 FROM json_each(NEW.lines_json) j JOIN economic_accounts a ON a.id=json_extract(j.value,'$.accountId')
 JOIN economic_policy_versions p ON p.version=NEW.config_version
 JOIN json_each(p.club_opening_json) seed ON seed.key=a.owner_id
 WHERE a.kind='CLUB_TREASURY' AND a.owner_id=NEW.source_id AND seed.type='integer'
 AND seed.value=json_extract(j.value,'$.amountArc') AND seed.value>0)
 THEN RAISE(ABORT,'economic invalid opening capital') END;
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM json_each(NEW.lines_json) j JOIN economic_balances b ON b.id=json_extract(j.value,'$.accountId')
 WHERE b.kind='ISSUANCE_CONTROL' AND json_extract(j.value,'$.amountArc')<0
 AND -(b.balance_arc+json_extract(j.value,'$.amountArc'))>
 (SELECT issuance_limit_arc FROM economic_policy_versions WHERE version=NEW.config_version))
 THEN RAISE(ABORT,'economic issuance ceiling') END;
 SELECT CASE WHEN NEW.purpose='REVERSAL' AND (
 NOT EXISTS(SELECT 1 FROM economic_transactions t WHERE t.id=NEW.reversal_of AND t.purpose<>'REVERSAL')
 OR EXISTS(SELECT 1 FROM json_each(NEW.lines_json) j WHERE NOT EXISTS(
 SELECT 1 FROM economic_entries e WHERE e.transaction_id=NEW.reversal_of
 AND e.account_id=json_extract(j.value,'$.accountId') AND e.amount_arc=-json_extract(j.value,'$.amountArc'))))
 THEN RAISE(ABORT,'economic invalid reversal') END;
END;
CREATE TRIGGER economic_entries_insert_guard BEFORE INSERT ON economic_entries
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_entries WHERE transaction_id=NEW.transaction_id
 AND (line_no=NEW.line_no OR account_id=NEW.account_id))
 OR NOT EXISTS(SELECT 1 FROM economic_transactions t JOIN json_each(t.lines_json) j
 WHERE t.id=NEW.transaction_id AND j.key=NEW.line_no
 AND json_extract(j.value,'$.accountId')=NEW.account_id
 AND json_extract(j.value,'$.amountArc')=NEW.amount_arc)
 THEN RAISE(ABORT,'economic entry not in sealed envelope') END;
END;
CREATE TRIGGER economic_materialize_entries AFTER INSERT ON economic_transactions
BEGIN
 INSERT INTO economic_entries(transaction_id,line_no,account_id,amount_arc)
 SELECT NEW.id,j.key,json_extract(j.value,'$.accountId'),json_extract(j.value,'$.amountArc')
 FROM json_each(NEW.lines_json) j;
END;
CREATE TRIGGER economic_transaction_no_update BEFORE UPDATE ON economic_transactions
BEGIN SELECT RAISE(ABORT,'economic transaction immutable'); END;
CREATE TRIGGER economic_transaction_no_delete BEFORE DELETE ON economic_transactions
BEGIN SELECT RAISE(ABORT,'economic transaction immutable'); END;
CREATE TRIGGER economic_entry_no_update BEFORE UPDATE ON economic_entries
BEGIN SELECT RAISE(ABORT,'economic entry immutable'); END;
CREATE TRIGGER economic_entry_no_delete BEFORE DELETE ON economic_entries
BEGIN SELECT RAISE(ABORT,'economic entry immutable'); END;
