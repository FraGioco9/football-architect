import test from 'node:test';
import assert from 'node:assert/strict';
import {closedClubHistorySeasons,readClubHistory} from '../assets/club-history-source.mjs';

const world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:20,seasonNumber:2,day:20,phase:'active'};
const payload=(season,clubKey='IT-17')=>({
 schemaVersion:1,providerId:'authoritative-world',clubKey,selectedSeason:season,world,
 status:'available',reason:null,
 provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'club:'+world.generation+':season:'+season+':verified'},
 data:{season,memberships:[{competitionId:'IT-1',category:'domestic',season,position:5,points:45,cupStatus:null,nextMatch:null}]}
});

test('PAGE-LOAD-04 B02: Club History enumerates only closed, supported public seasons',()=>{
 assert.deepEqual(closedClubHistorySeasons({...world,seasonNumber:0,day:0,revision:0,phase:'unstarted'}),[]);
 assert.deepEqual(closedClubHistorySeasons({...world,seasonNumber:1,phase:'active'}),[]);
 assert.deepEqual(closedClubHistorySeasons(world),[1]);
 assert.deepEqual(closedClubHistorySeasons({...world,phase:'closed',day:56}),[1,2]);
 assert.throws(()=>closedClubHistorySeasons({...world,seasonNumber:3}),/Unsupported authoritative/);
});

test('PAGE-LOAD-04 B02: Club History accepts only validated closed-season membership data',async()=>{
 const urls=[];
 const records=await readClubHistory({clubKey:'IT-17',world,fetchJson:async path=>{urls.push(path);return payload(1)}});
 assert.deepEqual(urls,['/api/clubs/IT-17/seasons/1/overview']);
 assert.equal(records.coverage,'complete');
 assert.deepEqual(records.seasons.map(x=>x.season),[1]);
 assert.deepEqual(records.seasons[0].memberships.map(x=>[x.competitionId,x.position,x.points]),[['IT-1',5,45]]);
 assert.equal(Object.isFrozen(records.seasons),true);
 await assert.rejects(()=>readClubHistory({clubKey:'IT-17',world,fetchJson:async()=>payload(1,'IT-18')}),/Invalid authoritative/);
 await assert.rejects(()=>readClubHistory({clubKey:'IT-17',world,fetchJson:async()=>({...payload(1),status:'empty',reason:'calendar-unpublished',provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null})}),/Unverified closed club season/);
});

test('PAGE-LOAD-04 B02: Season 0 Club History verifies empty state with zero API reads',async()=>{
 let calls=0;
 const result=await readClubHistory({clubKey:'IT-17',world:{...world,seasonNumber:0,day:0,revision:0,phase:'unstarted'},fetchJson:async()=>{calls++;throw Error('unexpected')}});
 assert.equal(result.coverage,'empty');
 assert.equal(result.seasons.length,0);assert.equal(calls,0);
});
