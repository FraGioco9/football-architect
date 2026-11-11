import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readPublicPlayers} from '../src/public-players-read.ts';
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
test('public nationality and primary-position filters apply to SQL count AND page, with parameters bound',async()=>{
 const {db,calls}=mockDb();
 await readPublicPlayers(db,1,{nationality:'ITA',position:'CM'});
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY created_at'))!;
 for(const entry of [count,page]){
  assert.match(entry.sql,/world_generation=\?/);
  assert.match(entry.sql,/json_extract\(payload_json, '\$.nationality'\)=\?/);
  assert.match(entry.sql,/json_extract\(payload_json, '\$.primary_position'\)=\?/);
  assert.deepEqual(entry.params.slice(0,3),[generation,'ITA','CM']);
 }
 assert.deepEqual(page.params.slice(-2),[50,0]);
});
test('public filtered read rejects unsafe filter values before database access',async()=>{
 const {db,calls}=mockDb();
 for(const filters of [{nationality:"ITA' OR 1=1"},{nationality:'ita'},{position:'INVALID'},{position:'ST;DROP'}]){
  await assert.rejects(readPublicPlayers(db,1,filters),{status:422,code:'invalid_public_request'});
 }
 assert.equal(calls.length,0);
});
