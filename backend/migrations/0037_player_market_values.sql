-- #763: derived read model, never an authoritative player field or balance.
-- Explicit local-first migration; do not apply automatically to remote D1.
CREATE TABLE player_market_values (
 player_id INTEGER PRIMARY KEY REFERENCES generated_players(id) ON DELETE CASCADE,
 input_revision INTEGER NOT NULL DEFAULT 0 CHECK(input_revision>=0),
 config_version TEXT,
 market_value_arc INTEGER CHECK(market_value_arc IS NULL OR (market_value_arc>=0 AND market_value_arc<=9007199254740991)),
 CHECK(config_version IS NOT NULL OR market_value_arc IS NULL)
);
CREATE INDEX player_market_values_desc ON player_market_values(config_version,(market_value_arc IS NULL),market_value_arc DESC,player_id ASC);
CREATE INDEX player_market_values_asc ON player_market_values(config_version,(market_value_arc IS NULL),market_value_arc ASC,player_id ASC);
CREATE INDEX player_market_values_range ON player_market_values(config_version,market_value_arc,player_id);
-- Existing records start pending. A bounded maintenance operation computes values
-- with the same canonical JavaScript calculator, never a second SQL wage formula.
INSERT INTO player_market_values(player_id) SELECT id FROM generated_players;
CREATE TRIGGER player_market_values_insert AFTER INSERT ON generated_players
BEGIN
 INSERT INTO player_market_values(player_id) VALUES(NEW.id);
END;
CREATE TRIGGER player_market_values_inputs_changed AFTER UPDATE OF payload_json ON generated_players
WHEN json_extract(OLD.payload_json,'$.age') IS NOT json_extract(NEW.payload_json,'$.age')
 OR json_extract(OLD.payload_json,'$.career_status') IS NOT json_extract(NEW.payload_json,'$.career_status')
 OR json_extract(OLD.payload_json,'$.primary_position') IS NOT json_extract(NEW.payload_json,'$.primary_position')
 OR json_extract(OLD.payload_json,'$.secondary_positions') IS NOT json_extract(NEW.payload_json,'$.secondary_positions')
 OR json_extract(OLD.payload_json,'$.attributes') IS NOT json_extract(NEW.payload_json,'$.attributes')
BEGIN
 UPDATE player_market_values SET input_revision=input_revision+1,config_version=NULL,market_value_arc=NULL WHERE player_id=NEW.id;
END;
