-- Opening membership is pinned to the approved Season 1 catalogue. All 320
-- treasuries and amounts are reconciled, including those with no transfer.
DROP TRIGGER economic_genesis_control_guard;
DROP TRIGGER economic_genesis_hold_guard;
DROP VIEW economic_genesis_status;

CREATE VIEW economic_genesis_status AS
SELECT p.version, json_extract(p.rules_json,'$.genesisGeneration') AS generation,
 json_extract(p.rules_json,'$.rewardVersion') AS reward_version,
 json_extract(p.rules_json,'$.annualRewardsArc') AS annual_rewards_arc,
 json_extract(p.rules_json,'$.freeReserveArc') AS free_reserve_arc,
 c.posting_enabled,
 (SELECT COUNT(*) FROM json_each(p.club_opening_json) WHERE value>0) AS expected_funded_clubs,
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
 AND NOT EXISTS(SELECT 1 FROM json_each(p.club_opening_json) j WHERE j.type<>'integer' OR j.value NOT BETWEEN 0 AND 1000000000000
 OR (j.value=0 AND j.key NOT IN (
   'BR-33','BR-34','BR-35','BR-36','BR-37','BR-38','BR-39','BR-40',
   'DE-33','DE-34','DE-35','DE-36','DE-37','DE-38','DE-39','DE-40',
   'ENG-33','ENG-34','ENG-35','ENG-36','ENG-37','ENG-38','ENG-39','ENG-40',
   'ES-33','ES-34','ES-35','ES-36','ES-37','ES-38','ES-39','ES-40',
   'FR-33','FR-34','FR-35','FR-36','FR-37','FR-38','FR-39','FR-40',
   'IT-33','IT-34','IT-35','IT-36','IT-37','IT-38','IT-39','IT-40',
   'NL-33','NL-34','NL-35','NL-36','NL-37','NL-38','NL-39','NL-40',
   'PT-33','PT-34','PT-35','PT-36','PT-37','PT-38','PT-39','PT-40'
 ))
 OR NOT EXISTS(SELECT 1 FROM economic_accounts a WHERE a.kind='CLUB_TREASURY' AND a.owner_id=j.key))
 AND (SELECT SUM(value) FROM json_each(p.club_opening_json))+json_extract(p.rules_json,'$.annualRewardsArc')+json_extract(p.rules_json,'$.freeReserveArc')=p.genesis_reserve_arc
 AND EXISTS(SELECT 1 FROM economic_accounts WHERE id='reserve') AND EXISTS(SELECT 1 FROM economic_accounts WHERE id='issuance'))
 THEN RAISE(ABORT,'economic invalid genesis root') END;
END;

CREATE TRIGGER economic_genesis_hold_guard BEFORE INSERT ON economic_holds
WHEN EXISTS(SELECT 1 FROM economic_genesis_status)
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM economic_genesis_status WHERE completed=0) AND
 (NEW.purpose<>'REWARD_BUDGET' OR NOT EXISTS(SELECT 1 FROM economic_genesis_status g JOIN economic_policy_versions p ON p.version=g.version
 JOIN world_state w ON w.id=1 WHERE g.funded_clubs=g.expected_funded_clubs AND w.phase='unstarted' AND w.generation=g.generation
 AND NEW.id='reward-budget:'||g.generation||':1:'||g.reward_version
 AND (SELECT COUNT(*) FROM economic_transactions)=1+g.expected_funded_clubs
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
