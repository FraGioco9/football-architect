import test from 'node:test';
import assert from 'node:assert/strict';
import {readClubFixtures,attachPublishedClubMatchLinks} from '../assets/club-fixtures-source.mjs';

const generation='550e8400-e29b-41d4-a716-446655440000';
const world={schemaVersion:1,generation,revision:4,seasonNumber:1,day:13,phase:'active'};
const manifest={competitions:[{id:'IT-1',category:'domestic',name:'Italy First'}]};
const fixture=(day,result=null)=>({id:'season:1:IT-1:N01:IT-1:IT-2:'+day,competitionId:'IT-1',season:1,
 day,round:1,phaseId:'league',marker:'N01',tieId:null,leg:null,neutral:false,
 homeClubId:'IT-1',awayClubId:'IT-2',result});
const result={homeGoals:2,awayGoals:1,resolution:'regulation',extraTime:null,penalties:null,winnerClubId:'IT-1'};
const packet=(fixtures=[fixture(13,result),fixture(14)],w=world,season=1)=>({
 schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:season,world:w,
 status:'partial',reason:null,
 provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',
  sourceRef:'club-fixtures:'+w.generation+':season:'+season+':'+('a'.repeat(64))},
 data:{season,seasonState:{day:13,phase:'active'},competitions:['IT-1'],fixtures}
});
const read=(value,w=world)=>{const paths=[];return {paths,run:()=>readClubFixtures({clubKey:'IT-1',season:1,world:w,manifest,
 fetchJson:async path=>{paths.push(path);return value}})}};

test('club fixtures source uses one scoped endpoint and preserves fixture rendering fields',async()=>{
 const query=read(packet());const data=await query.run();
 assert.deepEqual(query.paths,['/api/clubs/IT-1/seasons/1/fixtures']);
 assert.equal(data.coverage,'complete');assert.equal(data.rows.length,2);
 assert.deepEqual(data.rows.map(r=>[r.day,r.goalsFor,r.goalsAgainst,r.venue]),[[13,2,1,'home'],[14,null,null,'home']]);
 assert.equal(data.competitions[0].id,'IT-1');
});

test('club fixtures source rejects mismatched world, foreign fixtures, future result and extra memberships',async()=>{
 const foreign={...fixture(14),homeClubId:'IT-3',awayClubId:'IT-4'};
 const otherWorld={...world,revision:world.revision+1};
 for(const payload of [
  packet([foreign]),packet([fixture(14,result)]),
  {...packet(),world:otherWorld},
  {...packet(),data:{...packet().data,competitions:['IT-1','IT-1']}},
  {...packet(),data:{...packet().data,seasonState:{day:14,phase:'active'}}},
  {...packet(),provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1',sourceRef:'other-source'}}
 ])await assert.rejects(read(payload).run(),/Invalid authoritative club fixture payload/);
});

test('club fixtures source keeps unstarted/unpublished/unavailable states distinct without fan-out',async()=>{
 const zero={...world,revision:0,seasonNumber:0,day:0,phase:'unstarted'};
 const calls=[];
 const unstarted=await readClubFixtures({clubKey:'IT-1',season:1,world:zero,manifest,fetchJson:async path=>{calls.push(path);throw Error('unexpected request')}});
 assert.equal(unstarted.coverage,'unstarted');assert.deepEqual(calls,[]);
 const empty=packet();empty.status='empty';empty.reason='calendar-unpublished';empty.provenance={kind:'none',resultAuthority:null,sourceRef:null};empty.data=null;
 const unavailableBeforeDraw=await readClubFixtures({clubKey:'IT-1',season:1,world,manifest,fetchJson:async path=>{
  if(path.startsWith('/api/clubs/'))return empty;
  throw Error('Club Fixtures HTTP 404');
 }});
 assert.equal(unavailableBeforeDraw.coverage,'unpublished');
 const unavailable={...empty,status:'unavailable',reason:'unsupported-season'};
 assert.equal((await read(unavailable).run()).coverage,'unavailable');
});

test('club fixtures source accepts a closed historical season with verified results only',async()=>{
 const w={...world,seasonNumber:2,day:18,revision:5};
 const payload=packet([fixture(13,result),fixture(14,result)],w);
 payload.status='available';payload.data.seasonState={day:56,phase:'closed'};
 const loaded=await readClubFixtures({clubKey:'IT-1',season:1,world:w,manifest,fetchJson:async()=>payload});
 assert.equal(loaded.coverage,'complete');assert.equal(loaded.day,56);
 assert.equal(loaded.rows.every(r=>r.goalsFor!==null),true);
});


test('club fixtures renders a verified early draw using only one HTTP request',async()=>{
 const w={...world,revision:7,day:2};
 const early=Array.from({length:30},(_,i)=>({
  id:String(i+1),matchId:String(i+1),competitionId:'IT-1',season:1,
  day:13+i,round:i+1,phaseId:'league',marker:'N'+String(i+1).padStart(2,'0'),
  tieId:null,leg:null,neutral:false,
  homeClubId:i%2?'IT-2':'IT-1',awayClubId:i%2?'IT-1':'IT-2',result:null
 }));
 const draw={...packet(early,w),status:'partial',reason:null,
  provenance:{kind:'authoritative',resultAuthority:'published-draw-v1',
   sourceRef:'club-fixtures-draw:'+generation+':season:1:'+'a'.repeat(64)},
  data:{season:1,seasonState:{day:2,phase:'active'},competitions:['IT-1'],fixtures:early}};
 const first=read(draw,w),result=await first.run();
 assert.deepEqual(first.paths,['/api/clubs/IT-1/seasons/1/fixtures']);
 assert.equal(result.coverage,'partial');
 assert.equal(result.competitions.length,1);
 assert.equal(result.rows.length,30);
 assert.equal(result.rows[0].id,'1');
 assert.equal(result.rows.every(r=>r.goalsFor===null&&r.venue!=='neutral'),true);
 assert.equal(result.rows.every(r=>/^[1-9][0-9]*$/.test(r.matchId)),true);
 const cup=Array.from({length:6},(_,i)=>({
  ...early[i],id:String(241+i),matchId:String(241+i),competitionId:'int-1',
  day:15+i,round:i+1,marker:'I'+String(i+1).padStart(2,'0')
 }));
 const full={...draw,data:{...draw.data,competitions:['IT-1','int-1'],
  fixtures:[...early,...cup]}};
 const available=await readClubFixtures({clubKey:'IT-1',season:1,world:w,
  manifest:{competitions:[...manifest.competitions,{id:'int-1',category:'international',name:'Sovereign'}]},
  fetchJson:async path=>{assert.equal(path,'/api/clubs/IT-1/seasons/1/fixtures');return full;}});
 assert.equal(available.rows.length,36);
 assert.equal(available.competitions.length,2);
 for(const bad of [
  {...draw,provenance:{...draw.provenance,sourceRef:'unverified'}},
  {...draw,data:{...draw.data,fixtures:early.slice(1)}},
  {...draw,data:{...draw.data,fixtures:early.map((f,i)=>i===0?{...f,result:{homeGoals:1,awayGoals:0}}:f)}},
  {...draw,data:{...draw.data,fixtures:early.map((f,i)=>i===0?{...f,homeClubId:'IT-3',awayClubId:'IT-4'}:f)}},
  {...draw,data:{...draw.data,fixtures:early.map((f,i)=>i===0?{...f,id:'01',matchId:'01'}:f)}}
 ])await assert.rejects(read(bad,w).run(),/Invalid authoritative club fixture payload/);
});

test('#605 complete and historical club rows use published source fixture IDs (not pairings)',async()=>{
 const initial=await read(packet()).run(),fixtureId=initial.rows[0].id;
 const collection={schemaVersion:1,providerId:'authoritative-world',status:'published',
  season:1,competitionId:'IT-1',provenance:{kind:'authoritative'},
  fixtures:[{matchId:'785',sourceFixtureId:fixtureId,phaseId:'league',marker:'N01',day:13,
   round:1,homeClubId:'IT-1',awayClubId:'IT-2'}]};
 const requests=[];
 const linked=await attachPublishedClubMatchLinks(initial,{fetchJson:async url=>{requests.push(url);return collection}});
 assert.deepEqual(requests,['/api/matches/seasons/1/competitions/IT-1']);
 assert.equal(linked.rows[0].matchId,'785');
 assert.equal(linked.rows[1].matchId,null,'unmapped fixtures stay text-only');
 assert.equal(linked.linkAuthority,'published-match-index-v1');
 const invalid=await attachPublishedClubMatchLinks(initial,{fetchJson:async()=>({...collection,season:2})});
 assert.ok(invalid.rows.every(row=>row.matchId===null));
 const missing=await attachPublishedClubMatchLinks(initial,{fetchJson:async()=>{throw Error('404')}});
 assert.ok(missing.rows.every(row=>row.matchId===null));
 const changed=await attachPublishedClubMatchLinks(initial,{fetchJson:async()=>({...collection,fixtures:[{...collection.fixtures[0],day:14}]})});
 assert.ok(changed.rows.every(row=>row.matchId===null));
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(attachPublishedClubMatchLinks(initial,{signal:aborted.signal,fetchJson:async()=>collection}),/Cancelled/);
});
