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
function mockDb(clubKey:string|null=null){
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
    return {results:[{id:42,payload_json:JSON.stringify(stored),club_key:clubKey}],meta:{changes:0}};
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

test('public directory exposes verified current club identity on the same paginated query',async()=>{
 const free=await readPublicPlayers(mockDb(null).db,1);
 assert.equal(free.players[0].clubKey,null);
 assert.equal(free.players[0].clubName,null);
 const {db,calls}=mockDb('IT-1');
 const assigned=await readPublicPlayers(db,1);
 assert.equal(assigned.players[0].clubKey,'IT-1');
 assert.ok(typeof assigned.players[0].clubName==='string'&&assigned.players[0].clubName.length>0);
 assert.doesNotMatch(JSON.stringify(assigned.players[0]),/salary|expiry|contract_id|development_aptitude/);
 const page=calls.find(c=>c.sql.includes('LIMIT ? OFFSET ?'))!;
 assert.match(page.sql,/SELECT p\.id,p\.payload_json,a\.club_key FROM generated_players p LEFT JOIN player_club_affiliations a ON a\.player_id=p\.id/);
 assert.deepEqual(page.params,[50,0]);
 await assert.rejects(readPublicPlayers(mockDb('BAD-99').db,1),/players_unavailable/);
});

test('public directory count and pagination include persisted players independent of world generation',async()=>{
 const {db,calls}=mockDb();
 await readPublicPlayers(db,1);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY id DESC'))!;
 assert.doesNotMatch(count.sql,/world_generation|WHERE/);
 assert.doesNotMatch(page.sql,/world_generation|WHERE/);
 assert.doesNotMatch(count.sql,/json_extract/);
 assert.doesNotMatch(page.sql,/json_extract/);
 assert.deepEqual(count.params,[]);
 assert.deepEqual(page.params,[50,0]);
});
test('public directory rejects invalid page numbers before database reads',async()=>{
 const {db,calls}=mockDb();
 for(const page of [0,-1,1.5,10000,Number.NaN]){
  await assert.rejects(readPublicPlayers(db,page),/invalid_public_request/);
 }
 assert.equal(calls.length,0);
});

test('shared filter parser rejects duplicates, unknown inputs, encoded values and inverted ages',()=>{
 const valid=parsePublicPlayerQuery('?position=ST&nationality=ITA&ageMin=18&ageMax=24&foot=left&offset=50');
 assert.deepEqual(valid,{page:2,filters:{nationality:['ITA'],position:['ST'],ageMin:18,ageMax:24,foot:'left'}});
 assert.deepEqual(parsePublicPlayerQuery('?nationality=ITA%2CFRA&nationalityScope=any&position=ST%2CRW&positionScope=any&heightMin=175&heightMax=195').filters,
  {nationality:['ITA','FRA'],nationalityScope:'any',position:['ST','RW'],positionScope:'any',heightMin:175,heightMax:195});
 assert.deepEqual(parsePublicPlayerQuery(''),{page:1,filters:{}});
 assert.deepEqual(parsePublicPlayerQuery('?name=Andrea').filters,{name:'Andrea'});
 for(const raw of ['?page=1','?page=2','?page=0','?page=01','?page=10000','?nationality=ZZZ','?nationality=ita','?position=CF',
  '?foot=both','?ageMin=121','?ageMin=-1','?ageMin=01','?ageMin=22&ageMax=21','?ageMin=10&ageMin=20',
  '?view=overview','?page=1&page=2','?name=%25','?nationality=%49TA','?page=1&','?page=1#x',
  '?ageMax=21.5','?foot=right&foo=bar']){
  assert.throws(()=>parsePublicPlayerQuery(raw),/invalid_public_request/,raw);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+raw),false,raw);
 }
 assert.deepEqual(parsePublicPlayerQuery('?sort=age&order=desc').filters,{sort:'age',order:'desc'});
 assert.deepEqual(parsePublicPlayerQuery('?sort=passing').filters,{sort:'passing',order:'desc'});
 for(const bad of ['?sort=unknown','?sort=name&order=down','?order=asc','?sort=name&sort=age','?sort=name%20']){
  assert.throws(()=>parsePublicPlayerQuery(bad),/invalid_public_request/,bad);
  assert.equal(isAllowedPublicPlayersPath('/api/players'+bad),false,bad);
 }
 assert.equal(isAllowedPublicPlayersPath('/api/players?foot=right&ageMin=0'),true);
 assert.equal(isAllowedPublicPlayersPath('/api/players?offset=0'),true);
 assert.equal(isAllowedPublicPlayersPath('/api/players?page=1'),false);
 assert.equal(isAllowedPublicPlayersPath('/api/players/page/1'),false);
});
test('all filters are bound into COUNT and page queries before pagination, without leaking any private data',async()=>{
 const {db,calls}=mockDb();
 const filters=parsePublicPlayerQuery('?nationality=ITA&position=CM&ageMin=18&ageMax=30&foot=right').filters;
 const result=await readPublicPlayers(db,1,filters);
 assert.equal(result.count,1);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY id DESC'))!;
 for(const token of ["'$.nationality'","'$.primary_position'","'$.age'","'$.preferred_foot'"]){
  assert.ok(count.sql.includes(token),token);assert.ok(page.sql.includes(token),token);
 }
 assert.deepEqual(count.params,['ITA','CM',18,30,'right']);
 assert.deepEqual(page.params,['ITA','CM',18,30,'right',50,0]);
 assert.match(page.sql,/ORDER BY id DESC LIMIT \? OFFSET \?/);
 assert.doesNotMatch(JSON.stringify(result.players),/initial_age|development_aptitude|seed/);
});


test('validated name search and sparse public attributes keep COUNT and page SQL parameterized',async()=>{
 const query=parsePublicPlayerQuery('?name=Andrea+Rossi&attributes=passing_70_x%2Cvision_x_90&ageMin=18');
 assert.deepEqual(query,{page:1,filters:{name:'Andrea Rossi',attributes:[{key:'passing',min:70},{key:'vision',max:90}],ageMin:18}});
 const {db,calls}=mockDb();
 await readPublicPlayers(db,1,query.filters);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY id DESC'))!;
 for(const stmt of [count,page]){
  assert.match(stmt.sql,/json_extract\(payload_json,'\$\.attributes\.passing'\)>=\?/);
  assert.match(stmt.sql,/json_extract\(payload_json,'\$\.attributes\.vision'\)<=\?/);
  assert.match(stmt.sql,/LIKE \? ESCAPE/);
  assert.doesNotMatch(stmt.sql,/Andrea Rossi|passing_70_x/,'never interpolate player-supplied filters');
 }
 assert.deepEqual(count.params,['%Andrea Rossi%',70,90,18]);
 assert.deepEqual(page.params,['%Andrea Rossi%',70,90,18,50,0]);
 for(const bad of [
  '?name=%25','?name=%5F','?name=Andrea%20Rossi','?name=%20Andrea',
  '?attributes=passing_x_x','?attributes=passing_0_99','?attributes=passing_70_100',
  '?attributes=passing_90_70','?attributes=vision_20_x%2Cvision_80_x',
  '?attributes=unknown_20_x','?attributes=vision_x_50%2cpassing_50_x'
 ])assert.throws(()=>parsePublicPlayerQuery(bad),/invalid_public_request/,bad);
});


test('Players server-side sorting uses an allowlisted SQL expression with stable id tie breaks',async()=>{
 for(const [sort,order,path] of [
  ['age','desc',"'$.age'"],['name','asc',"'$.display_name'"],['positions','asc',"'$.primary_position'"],
  ['height','asc',"'$.height_cm'"],['foot','asc',"'$.preferred_foot'"],
  ['nationality','asc',"'$.nationality'"],['gk_positioning','desc',"'$.attributes.gk_positioning'"]
 ]){
  const {db,calls}=mockDb();
  const parsed=parsePublicPlayerQuery('?sort='+sort+'&order='+order);
  await readPublicPlayers(db,1,parsed.filters);
  const page=calls.find(c=>c.sql.includes('ORDER BY'))!;
  const count=calls.find(c=>c.sql.includes('COUNT(*)'))!;
  assert.ok(page.sql.includes(path),sort);
  assert.ok(page.sql.includes(' '+order.toUpperCase()+', id ASC LIMIT ? OFFSET ?'),sort);
  assert.doesNotMatch(page.sql,/ORDER BY \?/,'cannot parameterize SQL column identifiers');
  assert.deepEqual(count.params,[],sort+' does not change the number of records');
  assert.deepEqual(page.params,[50,0]);
 }
});
