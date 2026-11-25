-- #775 inert additive guards for the explicit genesis protocol. No seed, funds or new tables.
-- Legacy/synthetic policies without genesisProtocol remain compatible; no runtime
-- activation route exists. Genesis consumers must require this view, not control alone.
CREATE VIEW economic_genesis_status AS
SELECT p.version, json_extract(p.rules_json,'$.genesisGeneration') AS generation,
 json_extract(p.rules_json,'$.rewardVersion') AS reward_version,
 json_extract(p.rules_json,'$.annualRewardsArc') AS annual_rewards_arc,
 json_extract(p.rules_json,'$.freeReserveArc') AS free_reserve_arc,
 c.posting_enabled,
 (SELECT COUNT(*) FROM economic_transactions t WHERE t.purpose='CLUB_OPENING' AND t.config_version=p.version) AS funded_clubs,
 CASE WHEN EXISTS(SELECT 1 FROM economic_holds h WHERE h.id='reward-budget:'||json_extract(p.rules_json,'$.genesisGeneration')||':1:'||json_extract(p.rules_json,'$.rewardVersion')
 AND h.source_id=h.id AND h.account_id='reserve' AND h.purpose='REWARD_BUDGET' AND h.config_version=p.version
 AND h.actor_id='reward-settlement-v1' AND h.amount_arc=json_extract(p.rules_json,'$.annualRewardsArc')) THEN 1 ELSE 0 END AS completed
FROM economic_control c JOIN economic_policy_versions p ON p.version=c.active_version
WHERE json_extract(p.rules_json,'$.genesisProtocol')=1;

CREATE TRIGGER economic_genesis_control_guard BEFORE INSERT ON economic_control
WHEN EXISTS(SELECT 1 FROM economic_policy_versions p WHERE p.version=NEW.active_version AND json_extract(p.rules_json,'$.genesisProtocol')=1)
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_transactions) OR EXISTS(SELECT 1 FROM economic_holds)
 OR NOT EXISTS(SELECT 1 FROM economic_policy_versions p JOIN world_state w ON w.id=1
 WHERE p.version=NEW.active_version AND w.phase='unstarted' AND w.season_number=0 AND w.day=0 AND w.revision=0
 AND json_extract(p.rules_json,'$.genesisGeneration')=w.generation
 AND json_type(p.rules_json,'$.rewardVersion')='text' AND length(json_extract(p.rules_json,'$.rewardVersion'))>0
 AND json_type(p.rules_json,'$.annualRewardsArc')='integer' AND json_extract(p.rules_json,'$.annualRewardsArc')>0
 AND json_type(p.rules_json,'$.freeReserveArc')='integer' AND json_extract(p.rules_json,'$.freeReserveArc')>=0
 AND (SELECT COUNT(*) FROM json_each(p.club_opening_json))=320
 AND (SELECT COUNT(DISTINCT key) FROM json_each(p.club_opening_json))=320
 AND (SELECT COUNT(*) FROM economic_accounts WHERE kind='CLUB_TREASURY')=320
 AND NOT EXISTS(SELECT 1 FROM json_each(p.club_opening_json) j WHERE j.type<>'integer' OR j.value NOT BETWEEN 1 AND 1000000000000
 OR NOT EXISTS(SELECT 1 FROM economic_accounts a WHERE a.kind='CLUB_TREASURY' AND a.owner_id=j.key))
 AND (SELECT SUM(value) FROM json_each(p.club_opening_json))+json_extract(p.rules_json,'$.annualRewardsArc')+json_extract(p.rules_json,'$.freeReserveArc')=p.genesis_reserve_arc
 AND EXISTS(SELECT 1 FROM economic_accounts WHERE id='reserve') AND EXISTS(SELECT 1 FROM economic_accounts WHERE id='issuance'))
 THEN RAISE(ABORT,'economic invalid genesis root') END;
END;

-- Pin the sole policy for this bounded implementation; policy evolution is a later explicit gate.
CREATE TRIGGER economic_genesis_policy_pin BEFORE UPDATE OF active_version ON economic_control
WHEN OLD.active_version<>NEW.active_version AND
 (EXISTS(SELECT 1 FROM economic_genesis_status) OR EXISTS(SELECT 1 FROM economic_policy_versions WHERE version=NEW.active_version AND json_extract(rules_json,'$.genesisProtocol')=1))
BEGIN SELECT RAISE(ABORT,'economic genesis policy pinned'); END;

CREATE TRIGGER economic_genesis_post_guard BEFORE INSERT ON economic_transactions
WHEN EXISTS(SELECT 1 FROM economic_genesis_status)
BEGIN
 SELECT CASE WHEN NEW.purpose='ISSUE_RESERVE' OR
 (NEW.purpose='REVERSAL' AND EXISTS(SELECT 1 FROM economic_transactions t WHERE t.id=NEW.reversal_of AND t.purpose IN ('GENESIS_RESERVE','CLUB_OPENING')))
 OR (EXISTS(SELECT 1 FROM economic_genesis_status WHERE completed=0) AND (
 NEW.purpose NOT IN ('GENESIS_RESERVE','CLUB_OPENING') OR NEW.actor_kind<>'system' OR NEW.actor_id<>'economic-genesis-v1'
 OR NEW.request_key<>NEW.business_key OR NEW.generation IS NOT NULL OR NEW.hold_id IS NOT NULL
 OR (NEW.purpose='GENESIS_RESERVE' AND (NEW.business_key<>'economic-genesis:reserve' OR NEW.source_id<>'economic-genesis'))
 OR (NEW.purpose='CLUB_OPENING' AND (NEW.business_key<>'economic-genesis:club:'||NEW.source_id OR NOT EXISTS(SELECT 1 FROM economic_transactions WHERE purpose='GENESIS_RESERVE')))
 )) OR (EXISTS(SELECT 1 FROM economic_genesis_status WHERE completed=1) AND NEW.purpose IN ('GENESIS_RESERVE','CLUB_OPENING'))
 OR (NEW.purpose='REWARD' AND NOT EXISTS(SELECT 1 FROM economic_holds h WHERE h.id=NEW.hold_id AND h.purpose='REWARD_BUDGET' AND h.id='reward-budget:'||NEW.generation||':'||NEW.season||':'||(SELECT reward_version FROM economic_genesis_status)))
 THEN RAISE(ABORT,'economic genesis or reward guard') END;
END;

-- First canonical hold seals funding; subsequent holds cover exactly the next season.
CREATE TRIGGER economic_genesis_hold_guard BEFORE INSERT ON economic_holds
WHEN EXISTS(SELECT 1 FROM economic_genesis_status)
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_genesis_status WHERE completed=0) AND
 (NEW.purpose<>'REWARD_BUDGET' OR NOT EXISTS(SELECT 1 FROM economic_genesis_status g JOIN economic_policy_versions p ON p.version=g.version
 JOIN world_state w ON w.id=1 WHERE g.funded_clubs=320 AND w.phase='unstarted' AND w.generation=g.generation
 AND NEW.id='reward-budget:'||g.generation||':1:'||g.reward_version
 AND (SELECT COUNT(*) FROM economic_transactions)=321
 AND (SELECT balance_arc FROM economic_balances WHERE id='reserve')=g.free_reserve_arc+g.annual_rewards_arc
 AND (SELECT balance_arc FROM economic_balances WHERE id='issuance')=-p.genesis_reserve_arc
 AND NOT EXISTS(SELECT 1 FROM json_each(p.club_opening_json) j WHERE NOT EXISTS(SELECT 1 FROM economic_balances b WHERE b.id='club:'||j.key AND b.balance_arc=j.value))
 AND NOT EXISTS(SELECT 1 FROM economic_balances WHERE kind='USER_WALLET' AND balance_arc<>0)))
 THEN RAISE(ABORT,'economic genesis incomplete') END;
 SELECT CASE WHEN NEW.purpose='REWARD_BUDGET' AND NOT EXISTS(
 SELECT 1 FROM economic_genesis_status g JOIN world_state w ON w.id=1
 WHERE w.generation=g.generation AND NEW.config_version=g.version AND NEW.account_id='reserve'
 AND NEW.source_id=NEW.id AND NEW.actor_id='reward-settlement-v1' AND NEW.amount_arc=g.annual_rewards_arc
 AND w.phase IN ('unstarted','closed') AND NEW.id='reward-budget:'||w.generation||':'||(w.season_number+1)||':'||g.reward_version
 AND (w.season_number=0 OR EXISTS(SELECT 1 FROM economic_open_holds h WHERE h.id='reward-budget:'||w.generation||':'||w.season_number||':'||g.reward_version AND h.remaining_arc=0)))
 THEN RAISE(ABORT,'economic invalid annual reward hold') END;
END;

CREATE TRIGGER economic_genesis_reward_release_guard BEFORE INSERT ON economic_hold_releases
WHEN EXISTS(SELECT 1 FROM economic_genesis_status) AND EXISTS(SELECT 1 FROM economic_holds WHERE id=NEW.hold_id AND purpose='REWARD_BUDGET')
AND (NEW.transaction_id IS NULL OR NOT EXISTS(SELECT 1 FROM economic_transactions WHERE id=NEW.transaction_id AND purpose='REWARD' AND hold_id=NEW.hold_id))
BEGIN SELECT RAISE(ABORT,'economic reward budget release forbidden'); END;

-- No second clock. A funded economy may only prepare/start with the full season earmark.
CREATE TRIGGER economic_genesis_season_guard BEFORE UPDATE OF season_number,phase ON world_state
WHEN EXISTS(SELECT 1 FROM economic_genesis_status)
 AND NEW.phase IN ('preparing','active') AND (OLD.phase<>NEW.phase OR OLD.season_number<>NEW.season_number)
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM economic_genesis_status g JOIN economic_open_holds h
 ON h.id='reward-budget:'||NEW.generation||':'||NEW.season_number||':'||g.reward_version
 WHERE g.completed=1 AND g.posting_enabled=1 AND g.generation=NEW.generation AND h.remaining_arc=g.annual_rewards_arc)
 THEN RAISE(ABORT,'economic annual funding required') END;
END;
