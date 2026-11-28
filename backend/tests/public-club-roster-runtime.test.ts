import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readPublicClubRoster,readPublicClubRosterContracts} from '../src/public-club-roster-read.ts';
import worker from '../src/index.ts';
import {PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS} from '../src/footballer-public-projection.ts';
import type {Database} from '../src/database.ts';
import type {Env} from '../src/index.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const attrs=Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map((key,index)=>[key,index+1]));
const footballer=(id:number)=>({
 first_name:'First'+id,last_name:'Last'+id,nationality:'ITA',secondary_nationality:'FRA',
 age:17,initial_age:15,career_status:'active',height_cm:180,preferred_foot:'left',
 primary_position:'CM',secondary_positions:['DM'],attributes:attrs,
 development_aptitude:99,seed:'private-seed',batch_id:'private-batch'
});
function fixture(count:number,clubKey='IT-1'){
 const queries:{sql:string;args:unknown[]}[]=[];
 let worldGeneration=generation,advanceDuringRead=false;
 const rows=Array.from({length:count},(_,i)=>({
  id:i+1,club_key:clubKey,payload_json:JSON.stringify(footballer(i+1)),start_tick:0,end_tick:112,effective_salary_arc:125
 }));
 const db={
  prepare(sql:string){
   const statement=(args:unknown[])=>({
    bind(...values:unknown[]){return statement(values)},
    async first(){
     queries.push({sql,args});
     if(sql.includes('FROM world_state'))
      return {schema_version:1,generation:worldGeneration,revision:0,season_number:0,day:0,phase:'unstarted'};
     if(sql.includes('FROM sqlite_schema')&&args[0]==='opening_world_staging')return null;
     throw Error('unexpected first');
    },
    async all(){
     queries.push({sql,args});
     if(!sql.includes('FROM player_signed_contracts'))throw Error('unexpected roster query');
     if(advanceDuringRead)worldGeneration='3e5f71a2-229e-49dd-8fb5-021ba741f6d9';
     return {results:rows.filter(row=>row.club_key===args[0]).sort((a,b)=>a.id-b.id),
      meta:{changes:0}};
    },
    async run(){throw Error('Public GET attempted a write')}
   });
   return statement([]);
  },
  async batch(){throw Error('Public GET attempted a transaction')}
 } as unknown as Database;
 return {db,queries,rows,mutateWorld:()=>{advanceDuringRead=true}};
}
test('Contract roster includes 0, 1 and >50 members with no pagination, sorted numeric IDs',async()=>{
 for(const count of [0,1,73]){
  const {db,queries}=fixture(count);
  const result=await readPublicClubRoster(db,'IT-1');
  assert.deepEqual(Object.keys(result),['clubKey','count','players']);
  assert.equal(result.clubKey,'IT-1');
  assert.equal(result.count,count);
  assert.equal(result.players.length,count);
  assert.deepEqual(result.players.map(x=>x.id),Array.from({length:count},(_,i)=>i+1));
  const rosterSql=queries.filter(q=>q.sql.includes('FROM player_signed_contracts'));
  assert.equal(rosterSql.length,1);
  assert.deepEqual(rosterSql[0].args,['IT-1']);
  assert.match(rosterSql[0].sql,/INNER JOIN generated_players|INNER JOIN\s+generated_players/);
  assert.match(rosterSql[0].sql,/ORDER BY p.id ASC/);
  assert.doesNotMatch(rosterSql[0].sql,/\bLIMIT\b|\bOFFSET\b|player_club_affiliations/i);
  assert.match(rosterSql[0].sql,/w\.generation=c\.world_generation/);
  assert.ok(queries.every(q=>!/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(q.sql)));
 }
});
test('an inactive canonical club is valid and only effective signed terms appear',async()=>{
 const {db}=fixture(3,'IT-40');
 const full=await readPublicClubRoster(db,'IT-40');
 const empty=await readPublicClubRoster(db,'IT-1');
 assert.equal(full.count,3);
 assert.equal(empty.count,0);
 assert.deepEqual(empty.players,[]);
 for(const invalid of ['IT-41','IT-01','it-40','unknown','BR-0','', 'IT-1/2']){
  await assert.rejects(readPublicClubRoster(db,invalid),/club_not_found/);
 }
});
test('roster uses the strict public Players record without clubKey or private generation fields',async()=>{
 const {db}=fixture(1);
 const result=await readPublicClubRoster(db,'IT-1');
 assert.equal(result.players[0].display_name,'First1 Last1');
 assert.deepEqual(result.players[0].attributes,attrs);
 assert.deepEqual(result.players[0].secondary_positions,['DM']);
 assert.deepEqual(Object.keys(result.players[0].attributes),PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS);
 assert.doesNotMatch(JSON.stringify(result),/initial_age|development_aptitude|private-seed|batch_id|world_generation|draft|preview_id/);
 assert.equal(Object.hasOwn(result.players[0],'clubKey'),false);
});
test('world changing during a roster read fails closed without changing stored player rows',async()=>{
 const {db,rows,mutateWorld}=fixture(53);
 const previous=JSON.stringify(rows);
 mutateWorld();
 await assert.rejects(readPublicClubRoster(db,'IT-1'),/stale_world/);
 assert.equal(JSON.stringify(rows),previous);
});
test('public Worker roster route rejects query/pagination/mutations and unknown clubs',async()=>{
 const {db}=fixture(57);
 const env={DB:db} as Env;
 const call=(path:string,method='GET')=>worker.fetch(new Request('https://example.invalid'+path,{method}),env);
 const ok=await call('/api/clubs/IT-1/roster');
 assert.equal(ok.status,200);
 assert.match(ok.headers.get('cache-control')??'',/no-store/);
 const payload=await ok.json() as {clubKey:string;count:number;players:unknown[]};
 assert.equal(payload.count,57);
 assert.equal(payload.players.length,57);
 assert.deepEqual(Object.keys(payload),['clubKey','count','players']);
 for(const query of ['?page=1','?pageSize=50','?season=2','?limit=1']){
  assert.equal((await call('/api/clubs/IT-1/roster'+query)).status,422);
 }
 assert.equal((await call('/api/clubs/IT-1/roster','POST')).status,405);
 const invalid=await call('/api/clubs/IT-41/roster');
 assert.equal(invalid.status,404);
 assert.deepEqual(await invalid.json(),{error:{code:'club_not_found'}});
});

test('Stats defaults to the canonical season, retains every current member and distinguishes future data',async()=>{
 const {db}=fixture(73);
 const get=(query:string)=>worker.fetch(new Request('https://example.invalid/api/clubs/IT-1/roster/stats'+query),{DB:db} as Env);
 const current=await get('');
 assert.equal(current.status,200);
 const data=await current.json() as {season:number;players:Array<{stats:unknown}>};
 assert.equal(data.season,0);
 assert.equal(data.players.length,73);
 assert.deepEqual(data.players[72].stats,{
  appearances:0,starts:0,subAppearances:0,minutes:0,goals:0,assists:0,
  cleanSheets:0,yellowCards:0,redCards:0,ratedAppearances:0,averageRating:null,goalsAssistsPer90:null,
  mvpAwards:0,mvpCoveredAppearances:0
 });
 const future=await (await get('?season=2')).json() as typeof data;
 assert.equal(future.players.length,73);
 assert.equal(future.players[0].stats,null);
 assert.equal((await get('?season=2&season=1')).status,422);
});

test('public Contracts roster adds only actual seasonal wage and expiry to canonical rows',async()=>{
 const {db,queries,rows}=fixture(3);
 rows[1].end_tick=56;rows[1].effective_salary_arc=300;
 const result=await readPublicClubRosterContracts(db,'IT-1');
 assert.equal(result.count,3);
 assert.deepEqual(result.players.map(p=>p.contract),[
  {expiresSeason:2,currentSeasonalSalaryArc:125},
  {expiresSeason:1,currentSeasonalSalaryArc:300},
  {expiresSeason:2,currentSeasonalSalaryArc:125}
 ]);
 const sql=queries.find(q=>q.sql.includes('FROM player_signed_contracts'))!.sql;
 assert.match(sql,/c.id=a.contract_id/);assert.match(sql,/player_contract_promotion_salary/);
 assert.doesNotMatch(sql,/player_club_affiliations|payroll_claim|player_agent_mandates/);
 assert.doesNotMatch(JSON.stringify(result),/effective_salary_arc|start_tick|end_tick|private-seed/);
 rows[0].effective_salary_arc=0;
 await assert.rejects(readPublicClubRosterContracts(db,'IT-1'),/roster_unavailable/);
});
test('Contracts route is anonymous read-only, strict and fails closed on stale world',async()=>{
 const {db,mutateWorld}=fixture(1);
 const call=(path:string,method='GET')=>worker.fetch(new Request('https://example.invalid'+path,{method}),{DB:db} as Env);
 const path='/api/clubs/IT-1/roster/contracts';
 const ok=await call(path);assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control')??'',/no-store/);
 assert.equal((await call(path+'?season=2')).status,422);
 assert.equal((await call(path,'POST')).status,405);
 assert.equal((await call('/api/clubs/IT-41/roster/contracts')).status,404);
 mutateWorld();assert.equal((await call(path)).status,409);
});
