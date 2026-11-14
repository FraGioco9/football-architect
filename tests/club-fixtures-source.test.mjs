import test from 'node:test';
import assert from 'node:assert/strict';
import {readClubFixtures} from '../assets/club-fixtures-source.mjs';

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
 provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',
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
  {...packet(),provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'other-source'}}
 ])await assert.rejects(read(payload).run(),/Invalid authoritative club fixture payload/);
});

test('club fixtures source keeps unstarted/unpublished/unavailable states distinct without fan-out',async()=>{
 const zero={...world,revision:0,seasonNumber:0,day:0,phase:'unstarted'};
 const calls=[];
 const unstarted=await readClubFixtures({clubKey:'IT-1',season:1,world:zero,manifest,fetchJson:async path=>{calls.push(path);throw Error('unexpected request')}});
 assert.equal(unstarted.coverage,'unstarted');assert.deepEqual(calls,[]);
 const empty=packet();empty.status='empty';empty.reason='calendar-unpublished';empty.provenance={kind:'none',resultAuthority:null,sourceRef:null};empty.data=null;
 assert.equal((await read(empty).run()).coverage,'unpublished');
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
