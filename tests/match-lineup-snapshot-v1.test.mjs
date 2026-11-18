import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {readFrozenMatchRostersV1,planMatchSimulationReceiptV1} from '../backend/src/match-lineup-snapshot-v1.mjs';

const world={generation:'11111111-1111-4111-8111-111111111111',revision:9,seasonNumber:1,day:12,phase:'active'};
const match={matchId:19,season:1,day:13,fixtureId:'season:1:IT-1:N01:IT-1:IT-2',
 competitionId:'IT-1',homeClubId:'IT-1',awayClubId:'IT-2',sourceHash:'a'.repeat(64)};
const positions=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
const row=(id,club,role='CM',strength=61,status='active')=>({id,club_key:club,
 payload_json:JSON.stringify({career_status:status,first_name:'Frozen',last_name:'Player'+id,nationality:'ITA',primary_position:role,
  secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(a=>[a,strength])),
  development_aptitude:99})});
const home=()=>positions.map((role,i)=>row(i+1,'IT-1',role));

function makeDatabase(rows,options={}){
 const calls=[],firstReads=[];
 const slot='m1_'+'a'.repeat(32);
 const published=options.published??{id:19,slot_match_id:slot,
  generation:world.generation,season_number:world.seasonNumber};
 const league=options.league??{source_fixture_id:match.fixtureId,
  competition_id:match.competitionId,scheduled_day:13,
  home_club_id:'IT-1',away_club_id:'IT-2',source_hash:match.sourceHash};
 return {
  calls,firstReads,
  db:{
   batch(){throw new Error('standalone batch is forbidden')},
   prepare(sql){
    const statement={sql,values:[],bind(...values){this.values=values;return this},
     async first(){
      firstReads.push(sql);
      if(sql.startsWith('SELECT generation,revision'))return firstReads.filter(x=>x.startsWith('SELECT generation,revision')).length===2&&options.afterWorld?options.afterWorld:world;
      if(sql.includes('FROM public_match_numbers'))return published;
      if(sql.includes('FROM season_match_slots'))return league;
      throw new Error('Unexpected SELECT '+sql);
     },
     async all(){
      if(!sql.includes('FROM player_club_affiliations a'))throw new Error('Unexpected all '+sql);
      return {results:options.reverse?[...rows].reverse():rows};
     }};
    calls.push(statement);return statement;
   }
  }
 };
}
test('full unpaginated affiliation rows, deterministic digest, no hidden attribute leakage',async()=>{
 const rows=[...home(),row(101,'IT-2','GK')],a=makeDatabase(rows),b=makeDatabase(rows,{reverse:true});
 const x=await readFrozenMatchRostersV1(a.db,{homeClubId:'IT-1',awayClubId:'IT-2',world});
 const y=await readFrozenMatchRostersV1(b.db,{homeClubId:'IT-1',awayClubId:'IT-2',world});
 assert.equal(x.playerCount,12);
 assert.equal(x.homeRoster.length,11);
 assert.equal(x.awayRoster.length,1);
 assert.deepEqual(x.homeRoster,y.homeRoster);
 assert.equal(x.sourceDigest,y.sourceDigest);
 assert.equal(x.guards.length,14);
 assert.match(x.sourceDigest,/^[0-9a-f]{64}$/);
 assert.ok(!JSON.stringify(x.homeRoster).includes('development_aptitude'));
 assert.equal(a.calls.some(c=>/LIMIT|OFFSET/.test(c.sql)),false);
 assert.throws(()=>a.db.batch(),/standalone batch/);
});
test('incorrect world, changing world, malformed active player, duplicate fail closed',async()=>{
 const list=home();
 await assert.rejects(()=>readFrozenMatchRostersV1(makeDatabase(list).db,{
  homeClubId:'IT-1',awayClubId:'IT-1',world}),/club identity/);
 await assert.rejects(()=>readFrozenMatchRostersV1(makeDatabase([...list,list[0]]).db,{
  homeClubId:'IT-1',awayClubId:'IT-2',world}),/duplicate/);
 await assert.rejects(()=>readFrozenMatchRostersV1(makeDatabase([row(1,'IT-1','CM',0)]).db,{
  homeClubId:'IT-1',awayClubId:'IT-2',world}),/footballer data/);
 await assert.rejects(()=>readFrozenMatchRostersV1(makeDatabase(list,{afterWorld:{...world,revision:10}}).db,{
  homeClubId:'IT-1',awayClubId:'IT-2',world}),/world changed/);
});
test('candidate official insert is staged with player/fixture guards, never committed',async()=>{
 const rows=[...home(),row(101,'IT-2','GK')],{db,calls}=makeDatabase(rows);
 const planned=await planMatchSimulationReceiptV1(db,{match,world,seed:'temporary-sim-v1-test-seed',
  context:{mode:'regulation'},now:123456});
 assert.equal(planned.kind,'lineup_candidate');
 assert.equal(planned.writes.length,1);
 assert.ok(planned.guards.length>=rows.length+5);
 assert.match(planned.receiptHash,/^[0-9a-f]{64}$/);
 assert.equal(planned.receipt.authority,'official');
 assert.equal(planned.receipt.result.playerIdentityVersion,'player-identity-v1');
 assert.equal(planned.receipt.result.playerIdentities.length,11);
 assert.deepEqual(planned.receipt.result.playerIdentities[0],{playerId:1,name:'Frozen Player1',nationality:'ITA'});
 assert.ok(!JSON.stringify(planned.receipt.result.playerIdentities).includes('development_aptitude'));
 assert.ok(calls.some(c=>c.sql.includes('INSERT INTO match_lineup_result_receipts')));
 assert.ok(calls.some(c=>c.sql.includes('NOT EXISTS(SELECT 1 FROM match_lineup_result_receipts')));
});
test('two incomplete lineups still produce one immutable match receipt with no imaginary players',async()=>{
 const planned=await planMatchSimulationReceiptV1(makeDatabase([]).db,{
  match,world,seed:'temporary-sim-v1-test-seed',context:{mode:'regulation'},now:123456});
 assert.equal(planned.kind,'lineup_candidate');
 assert.equal(planned.writes.length,1);
 assert.equal(planned.receipt.algorithmVersion,'temporary-lineup-v1');
 assert.equal(planned.receipt.result.mode,'fallback_vs_fallback');
 assert.deepEqual(planned.receipt.result.home.appearances,[]);
 assert.deepEqual(planned.receipt.result.away.appearances,[]);
});
test('published number mismatch, source tampering, wrong kickoff day blocked',async()=>{
 const badNumber={id:19,slot_match_id:'m1_'+'a'.repeat(32),generation:'not-current',season_number:1};
 const badLeague={source_fixture_id:match.fixtureId,competition_id:match.competitionId,
  scheduled_day:13,home_club_id:'IT-1',away_club_id:'IT-2',source_hash:'b'.repeat(64)};
 for(const opts of [{published:badNumber},{league:badLeague}]){
  await assert.rejects(()=>planMatchSimulationReceiptV1(makeDatabase(home(),opts).db,{
   match,world,seed:'temporary-sim-v1-test-seed',context:{mode:'regulation'},now:123456}),/published/);
 }
 await assert.rejects(()=>planMatchSimulationReceiptV1(makeDatabase(home()).db,{
  match:{...match,day:14},world,seed:'temporary-sim-v1-test-seed',context:{mode:'regulation'},now:123456}),/metadata/);
});
