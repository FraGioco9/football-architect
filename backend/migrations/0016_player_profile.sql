-- Additive only: existing accounts retain their identities and credentials.
ALTER TABLE player_accounts ADD COLUMN username TEXT COLLATE NOCASE
 CHECK (username IS NULL OR (length(username) BETWEEN 3 AND 24 AND username NOT GLOB '*[^A-Za-z0-9_]*'));
ALTER TABLE player_accounts ADD COLUMN nationality TEXT
 CHECK (nationality IS NULL OR (length(nationality)=2 AND nationality NOT GLOB '*[^A-Z]*'));
ALTER TABLE player_accounts ADD COLUMN city TEXT
 CHECK (city IS NULL OR length(city) BETWEEN 1 AND 100);
-- SQLite NOCASE is sufficient for the deliberately ASCII username alphabet.
-- Unique index arbitrates concurrent registrations; multiple legacy NULLs remain valid.
CREATE UNIQUE INDEX player_accounts_username_unique ON player_accounts(username COLLATE NOCASE);
