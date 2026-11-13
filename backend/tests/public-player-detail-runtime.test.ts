import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readPublicPlayer} from '../src/public-players-read.ts';
import type {Database} from '../src/database.ts';
import {PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS} from '../src/footballer-public-projection.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const payload={first_name:'Andrea',last_name:'Rossi',nationality:'ITA',secondary_nationality:'FRA',
 age:18,initial_age:16,career_status:'active',height_cm:180,preferred_foot:'right',primary_position:'CM',
 secondary_positions:['DM'],attributes:Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map((k,i)=>[k,i+1])),
 development_aptitude:99,seed:'never-public',preview_id:'not-persisted'};
function fixture(found=true,changed=false,clubKey:string|null=null){
 let worldReads=0;
 const calls:{sql:string;args:unknown[]}[]=[];
 const db={prepare(sql:string){
  const stmt=(args:unknown[])=>({
   bind(...next:unknown[]){return stmt(next)},
   async first(){
    calls.push({sql,args});
    if(sql.includes('FROM world_state'))return {schema_version:1,generation:changed&&++worldReads>1?'650e8400-e29b-41d4-a716-446655440000':generation,revision:0,season_number:0,day:0,phase:'unstarted'};
    if(sql.includes('FROM generated_players p'))return found?{id:42,payload_json:JSON.stringify(payload),club_key:clubKey}:null;
    throw Error('Unexpected SQL: '+sql);
   },
   async all(){return {results:[],meta:{changes:0}}},
   async run(){return {results:[],meta:{changes:0}}}
  });return stmt([]);
 },async batch(){return []}} as unknown as Database;
 return {db,calls};
}
test('GET player profile projects the same permitted fields as the directory and never leaks internal generator data',async()=>{
 const {db,calls}=fixture();
 const result=await readPublicPlayer(db,42);
 assert.equal(result.player.id,42);
 assert.equal(result.player.display_name,'Andrea Rossi');
 assert.equal(result.player.age,18);
 assert.equal(result.player.clubKey,null);
 assert.equal(result.player.nationality,'ITA');
 assert.equal(result.player.secondary_nationality,'FRA');
 assert.equal(result.player.attributes.shooting,8);
 const json=JSON.stringify(result);
 for(const forbidden of ['initial_age','development_aptitude','seed','preview_id','batch_id','identity_sources'])
  assert.equal(json.includes(forbidden),false,forbidden);
 const statement=calls.find(x=>x.sql.includes('FROM generated_players'));
 assert.deepEqual(statement?.args,[42]);
 assert.match(statement!.sql,/LEFT JOIN player_club_affiliations/);
 assert.doesNotMatch(statement!.sql,/world_generation/,'Player identity persists across world reset');
});
test('player detail strictly validates positive integer IDs before any database read',async()=>{
 const {db,calls}=fixture();
 for(const id of [0,-1,1.5,Number.NaN,Number.MAX_SAFE_INTEGER+1])
  await assert.rejects(readPublicPlayer(db,id),{status:422,code:'invalid_public_request'});
 assert.equal(calls.length,0);
});
test('missing player returns real 404; concurrent reset fences result',async()=>{
 await assert.rejects(readPublicPlayer(fixture(false).db,42),{status:404,code:'player_not_found'});
 await assert.rejects(readPublicPlayer(fixture(true,true).db,42),{status:409,code:'stale_world'});
});

test('public player detail exposes only verified current affiliation key, never generator internals',async()=>{
 const {db,calls}=fixture(true,false,'IT-1');
 const output=await readPublicPlayer(db,42);
 assert.equal(output.player.clubKey,'IT-1');
 assert.equal(output.player.display_name,'Andrea Rossi');
 assert.ok(!('club_name' in output.player)&&!('crest' in output.player));
 assert.deepEqual(calls.find(x=>x.sql.includes('FROM generated_players p'))?.args,[42]);
});
