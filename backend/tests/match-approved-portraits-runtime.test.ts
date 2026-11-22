import {test} from 'vitest';
import assert from 'node:assert/strict';
import type {Database} from '../src/database.ts';
import type {MatchStatistics,MatchPlayerStatistics} from '../src/match-player-statistics.mjs';
import {approvedMatchPortraitKeys} from '../src/match-approved-portraits.ts';
const player=(id:number,started:boolean):MatchPlayerStatistics=>({
 playerId:id,name:null,nationality:null,role:'CM',started,
 startingSlot:started?1:null,startingRole:started?'CM':null,
 subAppearances:null,minutes:90,goals:0,assists:null,yellowCards:null,
 redCards:null,cleanSheets:null,rating:null
});
const stats=(a:MatchPlayerStatistics[],b:MatchPlayerStatistics[]):MatchStatistics=>({
 mvp:{status:'unavailable'},ratingVersion:null,
 home:{kind:'real_xi',formation:null,unattributedGoals:0,players:a},
 away:{kind:'real_xi',formation:null,unattributedGoals:0,players:b}
});
test('one batch read for both sides, only started IDs and approval booleans',async()=>{
 const sqls:string[]=[],bindings:unknown[][]=[];
 const db={prepare(sql:string){sqls.push(sql);return{bind(...ids:unknown[]){
  bindings.push(ids);return{async all(){return{results:[{player_id:44}]}}};
 }}}} as unknown as Database;
 const output=await approvedMatchPortraitKeys(db,stats([player(44,true),player(66,false)],[player(45,true)]));
 assert.equal(sqls.length,1);
 assert.deepEqual(bindings,[[44,45]]);
 for(const x of ["status='approved'","schema_version='player-portraits-v5'",
  "prompt_version='player-portrait-v4.2'","asset_key=('assets/players/portraits/' || player_id || '.webp')"])
  assert.ok(sqls[0].includes(x));
 assert.equal(output.home.players[0].portraitApproved,true);
 assert.equal(output.home.players[1].portraitApproved,false);
 assert.equal(output.away.players[0].portraitApproved,false);
 assert.ok(sqls[0].includes('SELECT player_id FROM player_portrait_profiles'));
 assert.doesNotMatch(JSON.stringify(output),/portraitAssetKey|assets\/players\/portraits\//);
});
test('no starters means no portrait DB read',async()=>{
 const db={prepare(){throw Error('Unexpected DB read')}} as unknown as Database;
 assert.deepEqual((await approvedMatchPortraitKeys(db,stats([],[]))).home.players,[]);
});
test('unrequested approval never authorizes another player',async()=>{
 const db={prepare(){return{bind(){return{async all(){return{results:[
  {player_id:45}]}}}}}}} as unknown as Database;
 await assert.rejects(approvedMatchPortraitKeys(db,stats([player(44,true)],[])),/Invalid approved/);
});
