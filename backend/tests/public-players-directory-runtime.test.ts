import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readPublicPlayers} from '../src/public-players-read.ts';
import {parsePublicPlayerQuery,isAllowedPublicPlayersPath} from '../src/public-players-filters.mjs';
import {PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS} from '../src/footballer-public-projection.ts';
import type {Database} from '../src/database.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const attrs=Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map((key,i)=>[key,i+1]));
const stored={first_name:'Andrea',last_name:'Rossi',nationality:'ITA',secondary_nationality:'FRA',
 age:18,initial_age:16,career_status:'active',height_cm:180,preferred_foot:'right',primary_position:'CM',
 secondary_positions:['DM'],attributes:attrs,development_aptitude:99,seed:'never-expose'};
function mockDb(){
 const calls:{sql:string;params:unknown[]}[]=[];
 const db={prepare(sql:string){
  const statement=(params:unknown[])=>({
   bind(...values:unknown[]){return statement(values)},
   async first(){
    calls.push({sql,params});
    if(sql.includes('FROM world_state'))return {schema_version:1,generation,revision:0,season_number:0,day:0,phase:'unstarted'};
    if(sql.includes('COUNT(*)'))return {n:1};
    return null;
   },
   async all(){
    calls.push({sql,params});
    return {results:[{id:42,payload_json:JSON.stringify(stored)}],meta:{changes:0}};
   },
   async run(){return {results:[],meta:{changes:0}}}
  });
  return statement([]);
 },async batch(){return []}} as unknown as Database;
 return {db,calls};
}
test('public page uses persisted numeric IDs, includes approved JSON and excludes internals',async()=>{
 const {db}=mockDb();
 const result=await readPublicPlayers(db,1);
 assert.equal(result.count,1);
 assert.equal(result.pageSize,50);
 assert.equal(result.players.length,1);
 const player=result.players[0];
 assert.equal(player.id,42);
 assert.equal(player.first_name,'Andrea');
 assert.equal(player.last_name,'Rossi');
 assert.equal(player.secondary_nationality,'FRA');
 assert.deepEqual(player.attributes,attrs);
 assert.deepEqual(Object.keys(player.attributes),PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS);
 assert.doesNotMatch(JSON.stringify(player),/initial_age|development_aptitude|seed|preview_id|known_as/);
});

test('public directory count and pagination use only current world generation and bounded page size',async()=>{
 const {db,calls}=mockDb();
 await readPublicPlayers(db,1);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY created_at'))!;
 assert.match(count.sql,/WHERE world_generation=\?/);
 assert.match(page.sql,/WHERE world_generation=\?/);
 assert.doesNotMatch(count.sql,/json_extract/);
 assert.doesNotMatch(page.sql,/json_extract/);
 assert.deepEqual(count.params,[generation]);
 assert.deepEqual(page.params,[generation,50,0]);
});
test('public directory rejects invalid page numbers before database reads',async()=>{
 const {db,calls}=mockDb();
 for(const page of [0,-1,1.5,10000,Number.NaN]){
  await assert.rejects(readPublicPlayers(db,page),/invalid_public_request/);
 }
 assert.equal(calls.length,0);
});

test('shared filter parser rejects duplicates, unknown inputs, encoded values and inverted ages',()=>{
 const valid=parsePublicPlayerQuery('?position=ST&nationality=ITA&ageMin=18&ageMax=24&foot=left&page=2');
 assert.deepEqual(valid,{page:2,filters:{nationality:'ITA',position:'ST',ageMin:18,ageMax:24,foot:'left'}});
 assert.deepEqual(parsePublicPlayerQuery(''),{page:1,filters:{}});
 for(const raw of ['?page=0','?page=01','?page=10000','?nationality=ZZZ','?nationality=ita','?position=CF',
  '?foot=both','?ageMin=121','?ageMin=-1','?ageMin=01','?ageMin=22&ageMax=21','?ageMin=10&ageMin=20',
  '?view=overview','?page=1&page=2','?name=Andrea','?nationality=%49TA','?page=1&','?page=1#x',
  '?ageMax=21.5','?foot=right&foo=bar']){
  assert.throws(()=>parsePublicPlayerQuery(raw),/invalid_public_request/,raw);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+raw),false,raw);
 }
 assert.equal(isAllowedPublicPlayersPath('/api/players?foot=right&ageMin=0'),true);
 assert.equal(isAllowedPublicPlayersPath('/api/players?page=1'),true);
 assert.equal(isAllowedPublicPlayersPath('/api/players/page/1'),false);
});
test('all filters are bound into COUNT and page queries before pagination, without leaking any private data',async()=>{
 const {db,calls}=mockDb();
 const filters=parsePublicPlayerQuery('?nationality=ITA&position=CM&ageMin=18&ageMax=30&foot=right').filters;
 const result=await readPublicPlayers(db,1,filters);
 assert.equal(result.count,1);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY created_at'))!;
 for(const token of ["'$.nationality'","'$.primary_position'","'$.age'","'$.preferred_foot'"]){
  assert.ok(count.sql.includes(token),token);assert.ok(page.sql.includes(token),token);
 }
 assert.deepEqual(count.params,[generation,'ITA','CM',18,30,'right']);
 assert.deepEqual(page.params,[generation,'ITA','CM',18,30,'right',50,0]);
 assert.match(page.sql,/ORDER BY created_at DESC,id ASC LIMIT \? OFFSET \?/);
 assert.doesNotMatch(JSON.stringify(result.players),/initial_age|development_aptitude|seed/);
});
