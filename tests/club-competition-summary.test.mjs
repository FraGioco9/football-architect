import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as preview from '../tools/dev-standings-preview-data.mjs';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
test('Club summary uses the current standings and never exposes unplayed scores',()=>{
 assert.equal(typeof preview.createPreviewClubSummary,'function');
 for(const division of manifest.divisions)for(const season of [1,4])for(const played of [0,12,29,30,31,32,33]){
  const table=preview.createPreviewStandings(division,Math.min(played,30),season);
  for(const club of [table.rows[0].club,table.rows[12].club]){
   const summary=preview.createPreviewClubSummary(division,club.clubId,{season,matchdays:played});
   const index=table.rows.findIndex(r=>r.club.clubId===club.clubId);
   assert.equal(summary.season,season);assert.equal(summary.points,table.rows[index].pts);
   assert.equal(summary.position,played===0?null:index+1);
   assert.equal(summary.clubId,club.clubId);assert.equal(summary.divisionId,division.id);
   assert.doesNotMatch(JSON.stringify(summary),/Goals|penalties|winnerId/);
   if(played<30){
    const next=preview.createPreviewStandings(division,30,season).fixtures.find(f=>f.round===played+1&&(f.homeId===club.clubId||f.awayId===club.clubId));
    assert.deepEqual(summary.nextMatch,{round:next.round,homeId:next.homeId,awayId:next.awayId});
   }
   if(played===33)assert.equal(summary.nextMatch,null);
  }
 }
});
test('Club next match includes only reached post-season pairings',()=>{
 assert.equal(typeof preview.createPreviewClubSummary,'function');
 for(const division of manifest.divisions){
  const rows=preview.createPreviewStandings(division,30,2).rows;
  const places=division.tier===1?[13,14]:[3,4,5,6];
  for(const position of places){
   const id=rows[position-1].club.clubId;
   for(const matchdays of [30,31]){
    const next=preview.createPreviewClubSummary(division,id,{season:2,matchdays}).nextMatch;
    assert.equal(next.round,matchdays+1);assert.ok([next.homeId,next.awayId].includes(id));
   }
  }
  assert.equal(preview.createPreviewClubSummary(division,rows[0].club.clubId,{season:2,matchdays:30}).nextMatch,null);
  if(division.tier===2){
   const final=preview.createPreviewPostseason(division,32,2).final;
   assert.deepEqual(preview.createPreviewClubSummary(division,final.homeId,{season:2,matchdays:32}).nextMatch,{round:33,homeId:final.homeId,awayId:final.awayId});
  }
 }
});
test('Club progress derives national rounds from the existing world day without writing storage',()=>{
 assert.equal(typeof preview.readPreviewClubProgress,'function');
 const values=new Map([['football-architect:standings-dev-season','3'],['football-architect:standings-dev-matchdays','20'],['football-architect:calendar-dev-world-day','13']]);
 const storage={getItem:key=>values.get(key)??null,setItem(){throw Error('No storage writes allowed')}};
 assert.deepEqual(preview.readPreviewClubProgress(storage),{season:3,matchdays:1});
 values.set('football-architect:calendar-dev-world-day','54');assert.deepEqual(preview.readPreviewClubProgress(storage),{season:3,matchdays:33});
 values.delete('football-architect:calendar-dev-world-day');assert.deepEqual(preview.readPreviewClubProgress(storage),{season:3,matchdays:20});
});

test('Club card renders rank, points and next fixture only from its own current snapshot',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const clubs=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 const selected=model.route('/clubs/it/1/overview');
 const division=manifest.divisions.find(d=>d.id==='IT-1');
 const snapshot=preview.createPreviewClubSummary(division,1,{season:3,matchdays:15});
 const card=summary=>model.render(clubs,selected,'en','',summary).match(/<section class="app-panel club-competition"[\s\S]*?<\/section>/)[0];
 const empty=card(null);
 assert.doesNotMatch(empty,/>Division</);
 assert.match(empty,/data-club-position>—</);
 assert.doesNotMatch(empty,/data-club-points/);
 assert.match(empty,/>Status</);
 assert.ok(empty.includes('No scheduled match available.'));
 const html=card(snapshot);
 assert.doesNotMatch(html,/standings\?season=|data-club-position><a/);
 assert.doesNotMatch(html,/data-club-points/);
 assert.ok(html.includes('data-club-position>'+snapshot.position+'th</dd>'));
 assert.ok(html.includes('fixtures?season=3&amp;matchday=16'));
 for(const id of [snapshot.nextMatch.homeId,snapshot.nextMatch.awayId])
  assert.ok(html.includes(division.clubs.find(c=>c.clubId===id).primaryName));
 assert.equal(card({...snapshot,clubId:2}),empty,'A different club cannot supply the current summary');
 assert.equal(card({...snapshot,points:-1}),empty,'Malformed data keeps the empty state');
 const ended=card(preview.createPreviewClubSummary(division,1,{season:3,matchdays:33}));
 assert.ok(ended.includes('No upcoming match.'));
});

test('A01-10 repeated rendering keeps identical competition snapshot output',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const clubs=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 const division=manifest.divisions.find(d=>d.id==='IT-1'),selected=model.route('/clubs/it/1/overview');
 const snap=preview.createPreviewClubSummary(division,1,{season:3,matchdays:15});
 const html=model.render(clubs,selected,'en','?season=3&matchday=15',snap);
 assert.equal(model.render(clubs,selected,'en','?season=3&matchday=15',snap),html);
 assert.notEqual(model.render(clubs,selected,'en','?season=3&matchday=15',{...snap,clubId:2}),html);
});
