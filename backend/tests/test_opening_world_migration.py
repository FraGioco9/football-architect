"""Opening World: full SQLite migration chain, clean and late 0042. No network."""
import json
import sqlite3
import unittest
from pathlib import Path

MIGRATIONS=Path(__file__).resolve().parents[1]/'migrations'

class OpeningWorldMigrationTest(unittest.TestCase):
    def test_clean_and_late_opening_migration(self):
        files=sorted(MIGRATIONS.glob('*.sql'))
        opening=next(p for p in files if p.name.startswith('0042_'))
        for order in (files,[p for p in files if p!=opening]+[opening]):
            with self.subTest(late=order[-1]==opening):
                db=sqlite3.connect(':memory:')
                try:
                    db.execute('PRAGMA foreign_keys=ON')
                    for path in order:
                        db.executescript(path.read_text(encoding='utf-8'))
                    self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                    generation=db.execute('SELECT generation FROM world_state WHERE id=1').fetchone()[0]
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM opening_world_staging').fetchone()[0],0)
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM economic_genesis_status').fetchone()[0],0)
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM opening_world_contract_slots').fetchone()[0],0)
                    root='a'*64
                    body={'schema':'opening-persistence-v2','runKey':root,'worldGeneration':generation,'worldRevision':0,'slotCount':6400,'batchSize':25,'initialHighWater':0,
                          'batchIntentHashes':['b'*64]*256,'contractClubs':['club-'+str(i) for i in range(256)],'contractTerms':[1]*6400,'baseline':[]}
                    db.execute('INSERT INTO opening_world_runs VALUES(?,?,-1,?,0,0,?,NULL,1)',(root,generation,root,json.dumps(body)))
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM opening_world_staging').fetchone()[0],1)
                    for statement in ["UPDATE world_state SET revision=1 WHERE id=1",
                                      "UPDATE world_state SET season_number=1,phase='preparing',revision=1 WHERE id=1",
                                      "DELETE FROM opening_world_runs"]:
                        with self.assertRaises(sqlite3.IntegrityError):
                            db.execute(statement)
                    with self.assertRaises(sqlite3.IntegrityError):
                        db.execute('INSERT INTO opening_world_runs VALUES(?,?,256,?,0,0,?,NULL,1)',(root,generation,'c'*64,json.dumps({'schema':'opening-publication-v1','runKey':root})))
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM opening_world_staging').fetchone()[0],1)
                    self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                finally:
                    db.close()

    def test_upgrade_preserves_existing_player_and_sporting_generation(self):
        files=sorted(MIGRATIONS.glob('*.sql'))
        prefix=[p for p in files if int(p.name[:4])<=41]
        later=[p for p in files if int(p.name[:4])>=42]
        for order in (later,later[1:]+later[:1]):
            with self.subTest(late=order[-1].name.startswith('0042_')):
                db=sqlite3.connect(':memory:')
                try:
                    db.execute('PRAGMA foreign_keys=ON')
                    for path in prefix:
                        db.executescript(path.read_text(encoding='utf-8'))
                    generation=db.execute('SELECT generation FROM world_state WHERE id=1').fetchone()[0]
                    db.execute("INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES('fixture','fixture@example.invalid','synthetic',1,1,'active',1,1)")
                    db.execute("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES('00000000-0000-4000-8000-000000000042',?,0,'fixture','{}','[{}]',1,'fixture','committed',1,2,1)",(generation,))
                    payload=json.dumps({'id':193,'age':18,'initial_age':18,'retirement_age':39,'first_name':'Synthetic','last_name':'Player','career_status':'active','nationality':'ITA','attributes':{'speed':50}})
                    db.execute("INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(193,'00000000-0000-4000-8000-000000000042',?,0,?,1)",(generation,payload))
                    portrait=json.dumps({'schema_version':'player-portraits-v5','prompt_version':'player-portrait-v4.2','player_id':193,'appearance_fingerprint':'abcdef0123456789'})
                    db.execute("INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at) VALUES(193,'player-portraits-v5','player-portrait-v4.2',?,'approved','synthetic/193.webp',1)",(portrait,))
                    db.execute("UPDATE player_market_values SET config_version='fixture',market_value_arc=123 WHERE player_id=193")
                    db.execute("UPDATE world_state SET season_number=1,revision=1,phase='preparing' WHERE id=1")
                    db.commit()
                    queries=['SELECT * FROM world_state','SELECT * FROM generated_players','SELECT * FROM player_generation_drafts','SELECT * FROM player_portrait_profiles','SELECT * FROM player_market_values',"SELECT seq FROM sqlite_sequence WHERE name='generated_players'"]
                    original=[db.execute(q).fetchall() for q in queries]
                    for path in order:
                        db.executescript(path.read_text(encoding='utf-8'))
                    self.assertEqual([db.execute(q).fetchall() for q in queries],original)
                    self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM opening_world_staging').fetchone()[0],0)
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM economic_genesis_status').fetchone()[0],0)
                finally:
                    db.close()

if __name__=='__main__':
    unittest.main()
