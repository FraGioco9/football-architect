import assert from 'node:assert/strict';
import {test} from 'vitest';
import {compactPublicMatchContext} from '../src/public-match-context.ts';
import worker from '../src/index.ts';
import type {Env} from '../src/index.ts';

const world={generation:'550e8400-e29b-41d4-a716-446655440000',
 revision:9,seasonNumber:1,day:12,phase:'active'};
const comp='IT-1',season=1,matchId='900';
const fixture=(n:number,day:number,home:string,away:string,result:{homeGoals:number,awayGoals:number}|null)=>{
 const id='season:1:IT-1:N'+String(n).padStart(2,'0')+':'+home+':'+away;
 return {id,day,round:n,competitionId:comp,homeClubId:home,awayClubId:away,result};
};
function sources(){
 // Seven prior matches on each side, then one future fixture with a
 // deliberately poisoned score. Only the last five per side can be returned.
 const home=Array.from({length:7},(_,i)=>fixture(i+1,i+1,'IT-1','IT-'+(i+3),{homeGoals:i%3,awayGoals:1}));
 const away=Array.from({length:7},(_,i)=>fixture(i+8,i+1,'IT-2','IT-'+(i+11),{homeGoals:0,awayGoals:2}));
 const target=fixture(15,13,'IT-1','IT-2',null);
 const future=fixture(16,14,'IT-1','IT-2',{homeGoals:99,awayGoals:99});
 const fixtures=[...home,...away,target,future];
 const published={schemaVersion:1,providerId:'authoritative-world',world,
  status:'published',season,competitionId:comp,provenance:{kind:'authoritative'},
  fixtures:fixtures.map((f,i)=>({matchId:f===target?matchId:String(i+1),
   sourceFixtureId:f.id,phaseId:'league',marker:'N'+String(i+1).padStart(2,'0'),
   day:f.day,round:f.round,homeClubId:f.homeClubId,awayClubId:f.awayClubId}))};
 const sporting={schemaVersion:1,providerId:'authoritative-world',
  world,competitionId:comp,selectedSeason:season,status:'partial',
  provenance:{kind:'authoritative'},data:{season,seasonState:{day:12,phase:'active'},
   fixtures,standings:{rows:[{clubId:'IT-1',rank:3,played:7},{clubId:'IT-2',rank:5,played:7},
    {clubId:'IT-3',rank:9,played:7}]}}};
 return {sporting,published};
}
test('match context uses one scope and sends only two clubs last five VERIFIED prior fixtures',()=>{
 const {sporting,published}=sources();
 const result=compactPublicMatchContext(sporting,published,matchId,season,comp);
 assert.equal(result.matchId,matchId);
 assert.equal(result.day,13);
 assert.deepEqual(result.projection.data.standings.rows.map((r:Record<string,unknown>)=>r.clubId),['IT-1','IT-2']);
 assert.equal(result.projection.data.fixtures.length,10);
 assert.equal(result.published?.fixtures.length,10);
 assert.ok(result.projection.data.fixtures.every(f=>Number(f.day)<13));
 assert.ok(result.projection.data.fixtures.every(f=>f.result.homeGoals!==99));
 assert.equal(new Set(result.projection.data.fixtures.map(f=>f.id)).size,10);
 assert.ok(JSON.stringify(result).length<JSON.stringify({sporting,published}).length,
  'small auxiliary response avoids full season and entire published competition');
 assert.equal(result.projection.data.seasonState.day,12,
  'retain the original rank-before-match fence');
});
test('unavailable publication, absent ID and mismatched fixture identity fail closed',()=>{
 const {sporting,published}=sources();
 assert.throws(()=>compactPublicMatchContext(sporting,
  {...published,fixtures:published.fixtures.filter(f=>f.matchId!==matchId)},
  matchId,season,comp),/not_found/);
 assert.throws(()=>compactPublicMatchContext(sporting,
  {...published,fixtures:published.fixtures.map(f=>f.matchId===matchId?{...f,homeClubId:'IT-9'}:f)},
  matchId,season,comp),/match_context_unavailable/);
 assert.throws(()=>compactPublicMatchContext(sporting,{...published,status:'unpublished'},matchId,season,comp),/match_context_unavailable/);
});
test('concurrent generation/revision change never combines a stale sporting season with new match IDs',()=>{
 const {sporting,published}=sources();
 for(const key of ['generation','revision','seasonNumber','day','phase']){
  const value=key==='generation'?'other':key==='phase'?'closed':(world as Record<string,string|number>)[key]===9?10:14;
  assert.throws(()=>compactPublicMatchContext(sporting,
   {...published,world:{...world,[key]:value}},matchId,season,comp),
   /match_context_unavailable/,key);
 }
});
test('historical or early results never expose future score from a later day',()=>{
 const {sporting,published}=sources();
 sporting.data.fixtures.push(fixture(19,12,'IT-1','IT-2',null));
 const result=compactPublicMatchContext(sporting,published,matchId,season,comp);
 assert.equal(result.projection.data.fixtures.length,10);
 assert.ok(result.projection.data.fixtures.every(f=>Number(f.result.homeGoals)<99));
});

test('compact Match Context HTTP contract rejects invalid query shape and write methods',async()=>{
 const env={DB:{prepare:()=>({first:async()=>null})}} as unknown as Env;
 const url=(path:string)=>'https://example.invalid'+path;
 for(const query of [
  '', '?season=1', '?season=1&competition=IT-1&unexpected=1',
  '?season=0&competition=IT-1', '?season=1&competition=IT-3',
  '?season=1&season=2&competition=IT-1',
  '?season=1&competition=IT-1&competition=IT-2'
 ]){
  const response=await worker.fetch(new Request(url('/api/matches/123/context'+query)),env);
  assert.equal(response.status,422,query);
 }
 const denied=await worker.fetch(new Request(url('/api/matches/123/context?season=1&competition=IT-1'),{method:'POST'}),env);
 assert.equal(denied.status,405);
});
