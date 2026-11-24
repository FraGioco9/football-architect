import assert from 'node:assert/strict';
import {test} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {marketValueIndexVersion,refreshMarketValueIndexBatch,marketValueIndexReadiness,marketValueIndexWrite,marketValueIndexUpdate} from '../src/player-market-value-index.ts';
import {readPublicPlayer,readPublicPlayers} from '../src/public-players-read.ts';
import {readPublicClubRoster} from '../src/public-club-roster-read.ts';
import {calculatePlayerMarketValueArc,MARKET_VALUE_CONFIG} from '../src/player-market-value.mjs';
import {FORECAST_EXPOSURES} from '../src/player-market-value-forecast-data.mjs';
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
 let batches=0;
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
    if(sql.includes('COUNT(*)'))return {results:[{n:1}],meta:{changes:0}};
    return {results:[{id:42,payload_json:JSON.stringify(stored),club_key:clubKey}],meta:{changes:0}};
   },
   async run(){return {results:[],meta:{changes:0}}}
  });
  return statement([]);
 },async batch(statements:Array<{all:()=>Promise<unknown>}>){
  batches++;return Promise.all(statements.map(statement=>statement.all()));
 }} as unknown as Database;
 return {db,calls,batches:()=>batches};
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
 assert.match(page.sql,/SELECT p\.id,p\.payload_json,a\.club_key FROM generated_players p LEFT JOIN \(\s*SELECT c\.player_id,c\.club_key,c\.id AS contract_id\s+FROM player_signed_contracts/);
 assert.doesNotMatch(page.sql,/player_club_affiliations/);
 assert.deepEqual(page.params,[50,0]);
 await assert.rejects(readPublicPlayers(mockDb('BAD-99').db,1),/players_unavailable/);
});

test('public directory count and pagination include persisted players independent of world generation',async()=>{
 const {db,calls}=mockDb();
 await readPublicPlayers(db,1);
 const count=calls.find(x=>x.sql.includes('COUNT(*)'))!;
 const page=calls.find(x=>x.sql.includes('ORDER BY id DESC'))!;
 assert.doesNotMatch(count.sql,/world_generation|WHERE/);
 // Only the derived contract relation is generation/active-status filtered, not the persisted player page.
 assert.match(page.sql,/w\.generation=c\.world_generation/);
 assert.match(page.sql,/json_extract\(g\.payload_json,'\$\.career_status'\)='active'/);
 assert.match(page.sql,/\) a ON a\.player_id=p\.id ORDER BY id DESC LIMIT \? OFFSET \?/);
 assert.doesNotMatch(count.sql,/json_extract/);
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


/** #532 acceptance: run the real public read against a deterministic, read-only
 * DB adapter. Vary the result cardinality without relying on remote D1 state.
 */
function mockSizedDirectory(size:number,changeGeneration=false){
 const calls:{sql:string;params:unknown[]}[]=[];
 let worldReads=0,batches=0;
 const statement=(sql:string,params:unknown[])=>({
  bind(...next:unknown[]){return statement(sql,next)},
  async first(){
   calls.push({sql,params});
   if(sql.includes('FROM world_state')){
    worldReads++;
    return {schema_version:1,
     generation:changeGeneration&&worldReads>1?'550e8400-e29b-41d4-a716-446655440001':generation,
     revision:0,season_number:0,day:0,phase:'unstarted'};
   }
   if(sql.includes('COUNT(*)'))return {n:size};
   return null;
  },
  async all(){
   calls.push({sql,params});
   if(sql.includes('COUNT(*)'))return {results:[{n:size}],meta:{changes:0}};
   const limit=Number(params[params.length-2]),offset=Number(params[params.length-1]);
   return {results:Array.from({length:Math.max(0,Math.min(limit,size-offset))},(_,i)=>({
    id:size-offset-i,payload_json:JSON.stringify(stored),club_key:null
   })),meta:{changes:0}};
  },
  async run(){return {results:[],meta:{changes:0}}}
 });
 const db={prepare(sql:string){return statement(sql,[])},
  async batch(statements:Array<{all:()=>Promise<unknown>}>){
   batches++;return Promise.all(statements.map(s=>s.all()));
  }} as unknown as Database;
 return {db,calls,batches:()=>batches};
}

test('#532 directory returns correct 0/1/50/51 cardinalities and page boundaries',async()=>{
 for(const count of [0,1,50,51]){
  const {db,calls,batches}=mockSizedDirectory(count);
  const first=await readPublicPlayers(db,1);
  const second=await readPublicPlayers(db,2);
  assert.equal(batches(),1,'first page count and data share one D1 batch; later pages stay sequential');
  assert.equal(first.count,count);
  assert.equal(first.page,1);
  assert.equal(first.pageSize,50);
  assert.equal(first.totalPages,Math.max(1,Math.ceil(count/50)));
  assert.equal(first.players.length,Math.min(50,count));
  assert.equal(second.page,2);
  assert.equal(second.players.length,Math.max(0,count-50));
  assert.equal(new Set(first.players.concat(second.players).map(p=>p.id)).size,count);
  assert.equal(first.players[0]?.id,count||undefined);
  const pageReads=calls.filter(call=>call.sql.includes('LIMIT ? OFFSET ?'));
  assert.equal(pageReads.length,count===51?2:1,'avoid fetching beyond the final page');
  assert.equal(Number(pageReads[0].params.at(-1)),0);
  if(count===51)assert.equal(Number(pageReads[1].params.at(-1)),50);
  assert.equal(calls.filter(call=>call.sql.includes('COUNT(*)')).length,2,
   'each request currently recomputes COUNT(*); profile this before optimizing');
 }
});

test('#532 directory rejects a world-generation transition between count and read',async()=>{
 const {db,calls}=mockSizedDirectory(51,true);
 await assert.rejects(readPublicPlayers(db,1),/stale_world/);
 assert.equal(calls.filter(call=>call.sql.includes('FROM world_state')).length,2);
});


test('#734 Players first page batches COUNT and rows while preserving before/after world reads',async()=>{
 const {db,calls,batches}=mockDb('IT-1');
 const result=await readPublicPlayers(db,1);
 assert.equal(batches(),1);
 assert.equal(result.count,1);assert.equal(result.players.length,1);
 assert.equal(result.players[0].clubKey,'IT-1');
 assert.deepEqual(calls.map(x=>x.sql.includes('FROM world_state')?'world':
  x.sql.includes('COUNT(*)')?'count':'page'),['world','count','page','world']);
});

test('#734 Players paginated reads still recount and skip expired pages',async()=>{
 const {db,calls,batches}=mockSizedDirectory(51);
 const second=await readPublicPlayers(db,2);
 assert.equal(batches(),0);
 assert.equal(second.count,51);assert.deepEqual(second.players.map(p=>p.id),[1]);
 const expired=await readPublicPlayers(db,3);
 assert.equal(expired.count,51);assert.deepEqual(expired.players,[]);
 assert.equal(calls.filter(x=>x.sql.includes('COUNT(*)')).length,2);
 assert.equal(calls.filter(x=>x.sql.includes('LIMIT ? OFFSET ?')).length,1);
});

test('#734 Players malformed D1 batch results never publish a false empty directory',async()=>{
 const {db}=mockDb();
 db.batch=async()=>[{results:[],meta:{changes:0}},{results:[],meta:{changes:0}}];
 await assert.rejects(readPublicPlayers(db,1),/players_unavailable/);
});

test('market value query allows inclusive integer bounds and global sort',()=>{
 assert.deepEqual(parsePublicPlayerQuery('?valueMin=0&valueMax=1200&sort=market_value_arc&offset=50'),{page:2,filters:{sort:'market_value_arc',order:'desc',valueMin:0,valueMax:1200}});
 for(const raw of ['?valueMin=-1','?valueMin=1.2','?valueMin=01','?valueMax=9007199254740992','?valueMin=2&valueMax=1'])assert.throws(()=>parsePublicPlayerQuery(raw),/invalid_public_request/);
});
test('#763 indexed valuation: actual local D1 global ordering, range, parity and invalidation',async()=>{
 const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
 const db=bindings.DB;
 await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
 const world=(await db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>())!;
 const batch=crypto.randomUUID(),now=1800000000,version=await marketValueIndexVersion();
 const input=Array.from({length:103},(_,i)=>({...stored,age:i===101?40:24,career_status:i===102?'retired':'active',
  attributes:Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map(k=>[k,30+(i%9)*7]))}));
 await db.prepare("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,0,'fixture','{}','[]',?,'fixture','committed',?,?,?)").bind(batch,world.generation,input.length,now,now+3600,now).run();
 try{
  await db.prepare('INSERT INTO generated_players(batch_id,world_generation,entry_season,payload_json,created_at) SELECT ?,?,0,j.value,? FROM json_each(?) j').bind(batch,world.generation,now,JSON.stringify(input)).run();
  const rows=(await db.prepare('SELECT id,payload_json FROM generated_players WHERE batch_id=? ORDER BY id').bind(batch).all<{id:number;payload_json:string}>()).results;
  const expected=rows.map(row=>({id:row.id,value:calculatePlayerMarketValueArc(JSON.parse(row.payload_json))}));
  const id=rows[0].id;
  await assert.rejects(readPublicPlayers(db,1,{sort:'market_value_arc'}),/players_unavailable/);
  assert.equal((await refreshMarketValueIndexBatch(db)).updated,103);
  assert.equal((await refreshMarketValueIndexBatch(db)).ready,true);
  const sorted=(order:string)=>[...expected].sort((a,b)=>a.value===null||b.value===null?a.value===b.value?a.id-b.id:a.value===null?1:-1:(order==='asc'?a.value-b.value:b.value-a.value)||a.id-b.id);
  for(const order of ['desc','asc'] as const){
   const pages=await Promise.all([1,2,3].map(page=>readPublicPlayers(db,page,{sort:'market_value_arc',order})));
   assert.deepEqual(pages.map(p=>p.players.length),[50,50,3]);
   assert.deepEqual(pages.flatMap(p=>p.players.map(x=>x.id)),sorted(order).map(x=>x.id));
   assert.ok(pages.every(p=>p.count===103&&p.totalPages===3));
   assert.equal(pages[2].players.at(-1)?.market_value_arc,null);
  }
  const zero=await readPublicPlayers(db,1,{valueMin:0,valueMax:0});
  assert.deepEqual(zero.players.map(p=>p.id),[rows[102].id]);
  const bound=expected[10].value!;
  const exact=await readPublicPlayers(db,1,{valueMin:bound,valueMax:bound,position:['CM'],sort:'market_value_arc'});
  assert.equal(exact.count,expected.filter(p=>p.value===bound).length);
  assert.ok(exact.players.every(p=>p.market_value_arc===bound));
  const empty=await readPublicPlayers(db,4,{sort:'market_value_arc'});
  assert.deepEqual(empty.players,[]);
  const detail=await readPublicPlayer(db,id),roster=await readPublicClubRoster(db,'IT-1');
  assert.equal(detail.player.clubKey,null,'unsigned player has no club');
  assert.equal(roster.count,0,'unsigned player is not a roster member');
  assert.equal(detail.player.market_value_arc,expected[0].value);
  assert.equal((await marketValueIndexReadiness(db,version).first<{ready:number}>())?.ready,1,'contract-free reads do not invalidate value');
  await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.retirement_seed','private','$.retirement_age',37,'$.development_aptitude',42) WHERE id=?").bind(id).run();
  assert.equal((await marketValueIndexReadiness(db,version).first<{ready:number}>())?.ready,1,'hidden fields do not invalidate value');
  const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([MARKET_VALUE_CONFIG,FORECAST_EXPOSURES])));
 assert.equal(version,'market-value-index-v1:'+Array.from(new Uint8Array(fingerprint),n=>n.toString(16).padStart(2,'0')).join(''));
 const prior=marketValueIndexUpdate(id,0,version,JSON.parse(rows[0].payload_json));
  await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.age',33) WHERE id=?").bind(id).run();
  assert.equal((await marketValueIndexWrite(db,version,[prior]).run()).meta.changes,0,'stale revision cannot resurrect a value');
  await assert.rejects(readPublicPlayers(db,1,{valueMin:0}),/players_unavailable/);
  assert.equal((await refreshMarketValueIndexBatch(db)).updated,1);
  assert.equal((await refreshMarketValueIndexBatch(db)).ready,true);
  // Each public sporting input must independently invalidate the cache.
  for(const [path,value] of [['career_status','"retired"'],['primary_position','"RW"'],['secondary_positions','["LW"]'],['attributes.passing','99']]){
   const old=(await db.prepare('SELECT input_revision FROM player_market_values WHERE player_id=?').bind(id).first<{input_revision:number}>())!;
   await db.prepare('UPDATE generated_players SET payload_json=json_set(payload_json,?,json(?)) WHERE id=?').bind('$.'+path,value,id).run();
   const pending=await db.prepare('SELECT input_revision,config_version,market_value_arc FROM player_market_values WHERE player_id=?').bind(id).first();
   assert.deepEqual(pending,{input_revision:old.input_revision+1,config_version:null,market_value_arc:null});
   await assert.rejects(readPublicPlayers(db,1,{sort:'market_value_arc'}),/players_unavailable/);
   assert.equal((await refreshMarketValueIndexBatch(db)).updated,1);
   assert.equal((await refreshMarketValueIndexBatch(db)).ready,true);
   const fresh=await readPublicPlayer(db,id);
   assert.equal(fresh.player.market_value_arc,0,'retired remains true zero');
  }
  await db.prepare("UPDATE player_market_values SET config_version='old-config' WHERE player_id=?").bind(id).run();
  await assert.rejects(readPublicPlayers(db,1,{sort:'market_value_arc'}),/players_unavailable/);
  assert.equal((await refreshMarketValueIndexBatch(db)).updated,1);
  assert.equal((await refreshMarketValueIndexBatch(db)).ready,true);
  for(const [order,index] of [['ASC','asc'],['DESC','desc']]){
   const plan=(await db.prepare('EXPLAIN QUERY PLAN SELECT player_id FROM player_market_values WHERE config_version=? ORDER BY market_value_arc IS NULL ASC,market_value_arc '+order+',player_id ASC LIMIT 50').bind(version).all<{detail:string}>()).results;
   assert.ok(plan.some(p=>p.detail.includes('player_market_values_'+index)),JSON.stringify(plan));
   assert.ok(!plan.some(p=>p.detail.includes('TEMP B-TREE')),JSON.stringify(plan));
  }
 }finally{
  await db.prepare('DELETE FROM generated_players WHERE batch_id=?').bind(batch).run();
  await db.prepare('DELETE FROM player_generation_drafts WHERE id=?').bind(batch).run();
 }
});

test('#763 large-world local Worker/D1 valuation benchmark (synthetic, no remote access)',async()=>{
 const bindings=env as unknown as {DB:Database;TEST_MIGRATIONS:Parameters<typeof applyD1Migrations>[1]};
 const db=bindings.DB;
 await applyD1Migrations(db as Parameters<typeof applyD1Migrations>[0],bindings.TEST_MIGRATIONS);
 const world=(await db.prepare('SELECT generation FROM world_state WHERE id=1').first<{generation:string}>())!;
 const batch=crypto.randomUUID(),now=1800000000,version=await marketValueIndexVersion();
 const start=(await db.prepare("SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0) AS n").first<{n:number}>())!.n;
 // Repeating canonical synthetic profiles keeps fixture construction cheap;
 // query timing includes actual local D1 and the real Worker read/projection.
 const profiles=Array.from({length:120},(_,i)=>({...stored,age:i===119?40:16+i%24,
  career_status:i%23===0?'retired':'active',primary_position:['CM','ST','CB','RW'][i%4],
  secondary_positions:i%4===0?['DM']:[],attributes:Object.fromEntries(PUBLIC_FOOTBALLER_ATTRIBUTE_KEYS.map((k,j)=>[k,35+(i*7+j*3)%51]))}));
 const profileJson=JSON.stringify(profiles),expected=profiles.map(p=>calculatePlayerMarketValueArc(p)),valueJson=JSON.stringify(expected);
 // The draft is fixture provenance only; no production generation endpoint is exercised.
 await db.prepare("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,0,'fixture','{}','[]',103,'fixture','committed',?,?,?)").bind(batch,world.generation,now,now+3600,now).run();
 let populated=0;
 const timings:unknown[]=[];
 try{
  for(const population of [6400,8001,10000,30000]){
   for(let offset=populated;offset<population;offset+=1000){
    const size=Math.min(1000,population-offset),first=start+offset+1;
    await db.batch([
     db.prepare("WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM seq WHERE i+1<?) INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) SELECT ?+i,?,?,0,json_extract(?,'$['||CAST((?+i)%120 AS INTEGER)||']'),? FROM seq").bind(size,first,batch,world.generation,profileJson,offset,now),
     db.prepare("UPDATE player_market_values SET config_version=?,market_value_arc=json_extract(?,'$['||CAST((player_id-?-1)%120 AS INTEGER)||']') WHERE player_id>=? AND player_id<?").bind(version,valueJson,start,first,first+size)
    ]);
   }
   populated=population;
   assert.equal((await marketValueIndexReadiness(db,version).first<{ready:number}>())?.ready,1);
   const scenarios=['?sort=market_value_arc&order=desc','?sort=market_value_arc&order=asc','?sort=market_value_arc&order=asc&valueMin=100&valueMax=5000','?position=CM&sort=market_value_arc&order=asc&valueMin=100&valueMax=5000','?valueMin=100&valueMax=5000&sort=age&order=asc'];
   for(const query of scenarios){
    const filters=parsePublicPlayerQuery(query).filters;
    const samples:number[]=[];let responseBytes=0;
    const expectedRows=Array.from({length:population},(_,i)=>({id:start+i+1,p:profiles[i%120],value:expected[i%120]})).filter(x=>
     (!filters.position||filters.position.includes(x.p.primary_position as never))&&
     (filters.valueMin===undefined||(x.value!==null&&x.value>=filters.valueMin))&&
     (filters.valueMax===undefined||(x.value!==null&&x.value<=filters.valueMax)));
    expectedRows.sort((a,b)=>{
     if(filters.sort==='age')return a.p.age-b.p.age||a.id-b.id;
     if(a.value===null||b.value===null)return a.value===b.value?a.id-b.id:a.value===null?1:-1;
     return (filters.order==='asc'?a.value-b.value:b.value-a.value)||a.id-b.id;
    });
    const sample=async(page:number)=>{
     const t=performance.now(),result=await readPublicPlayers(db,page,filters);
     responseBytes=new TextEncoder().encode(JSON.stringify(result)).length;
     const elapsed=performance.now()-t;
     assert.equal(result.count,expectedRows.length);
     assert.deepEqual(result.players.map(p=>p.id),expectedRows.slice((page-1)*50,page*50).map(p=>p.id));
     return elapsed;
    };
    const first=await sample(1);
    for(const page of [1,2,1,2,1,2,1,2,1])samples.push(await sample(page));
    samples.sort((a,b)=>a-b);
    const concurrentStart=performance.now();
    await Promise.all([1,2,3,4].map(sample));
    timings.push({population,query,firstMs:first,warmP50Ms:samples[4],warmP95Ms:samples[8],fourConcurrentMs:performance.now()-concurrentStart,responseBytes});
   }
  }
  console.log('MARKET_VALUE_LOCAL_D1_BENCHMARK '+JSON.stringify(timings));
 }finally{
  await db.prepare('DELETE FROM generated_players WHERE batch_id=?').bind(batch).run();
  await db.prepare('DELETE FROM player_generation_drafts WHERE id=?').bind(batch).run();
 }
},120000);
