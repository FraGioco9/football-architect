import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as data from '../tools/dev-standings-preview-data.mjs';
const divisions=JSON.parse(readFileSync(new URL('../app/competitions/_shared/manifest.json',import.meta.url))).divisions;

test('POSTSEASON-DATA: eight countries reveal each stage only on days 31, 32 and 33',()=>{
 assert.equal(typeof data.createPreviewPostseason,'function');
 let extraTime=0,shootouts=0;
 for(const division of divisions)for(const season of [1,2,3,4]){
  const finalRows=data.createPreviewStandings(division,30,season).rows;
  for(const day of [0,29,30,31,32,33]){
   const result=data.createPreviewPostseason(division,day,season);
   assert.deepEqual(result,data.createPreviewPostseason(division,day,season),'deterministic');
   assert.equal(result.ties.length,day<30?0:division.tier===1?1:2);
   let games=0;
   for(const tie of result.ties){
    const [better,lower]=tie.seedPositions.map(p=>finalRows[p-1].club.clubId);
    assert.deepEqual(tie.clubIds,[better,lower]);
    assert.equal(Boolean(tie.legs[0]),day>=31);assert.equal(Boolean(tie.legs[1]),day>=32);
    if(tie.legs[0]){assert.equal(tie.legs[0].homeId,lower);assert.equal(tie.legs[0].awayId,better);games++;}
    if(tie.legs[1]){assert.equal(tie.legs[1].homeId,better);assert.equal(tie.legs[1].awayId,lower);games++;}
    assert.equal(tie.winnerId!==null,day>=32);
    if(day>=31){
     const sums=tie.clubIds.map(id=>tie.legs.filter(Boolean).reduce((n,g)=>n+(g.homeId===id?g.homeGoals:g.awayGoals),0));
     assert.deepEqual(tie.aggregate,sums,'shoot-outs excluded from aggregate');
    }
    if(day===33){
     assert.ok(tie.clubIds.includes(tie.winnerId));
     extraTime+=Number(tie.legs[1].afterExtraTime);shootouts+=Number(Boolean(tie.legs[1].penalties));
    }
   }
   assert.equal(Boolean(result.final),division.tier===2&&day>=32);
   if(result.final){
    const winners=result.ties.map(t=>t.winnerId);
    const rank=id=>finalRows.findIndex(row=>row.club.clubId===id);
    assert.ok(winners.includes(result.final.homeId)&&winners.includes(result.final.awayId));
    assert.ok(rank(result.final.homeId)<rank(result.final.awayId),'better finalist hosts');
    assert.equal(result.final.homeGoals!==null,day>=33);
    if(day>=33){games++;extraTime+=Number(result.final.afterExtraTime);shootouts+=Number(Boolean(result.final.penalties));}
   }
   assert.equal(games,day<31?0:division.tier===1?Math.min(day-30,2):day===31?2:day===32?4:5);
   assert.equal(result.winnerId!==null,day>=(division.tier===1?32:33));
   if(day>=31){
    const previous=data.createPreviewPostseason(division,day-1,season);
    for(let i=0;i<previous.ties.length;i++)if(previous.ties[i].legs[0])assert.deepEqual(result.ties[i].legs[0],previous.ties[i].legs[0]);
   }
  }
 }
 assert.ok(extraTime>0,'cover extra time');assert.ok(shootouts>0,'cover penalties');
});

test('POSTSEASON-PROGRESS: Debug extends to 33 while league/history stay bounded to 30',()=>{
 assert.equal(data.DEBUG_MAX_MATCHDAY,33);
 for(const day of [30,31,32,33]){
  const progress={season:2,matchdays:day};
  assert.equal(data.previewSeasonProgress(1,progress),33);
  assert.equal(data.previewSeasonProgress(2,progress),day);
  assert.equal(data.previewSeasonProgress(3,progress),0);
  assert.equal(data.previewSeasonMatchdays(2,progress),30);
  assert.equal(data.previewCurrentMatchday(2,progress),null);
  const history=data.createPreviewHistory(divisions[0],2,day);
  assert.equal(history.completed.length,2);assert.ok(history.played.every(s=>s.rows.every(r=>r.played===30)));
  const storage={getItem:key=>key.endsWith('matchdays')?String(day):'2'};
  assert.equal(data.readPreviewProgress(storage).matchdays,day);
 }
 for(const day of [-1,34,1.5])assert.throws(()=>data.createPreviewPostseason(divisions[0],day,1),/Invalid/);
});
