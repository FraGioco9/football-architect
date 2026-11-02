import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCupPreview} from '../tools/dev-international-preview.mjs';
import competitionModel from '../assets/competition-model.js';
const manifest=JSON.parse(readFileSync(new URL('../competitions/_shared/manifest.json',import.meta.url),'utf8'));
for(const id of ['int-1','int-2']){
 test('A04 international DEV '+id+' follows world day and season with valid INT-24 league fixtures',()=>{
  const definition=competitionModel.competitionById(manifest,id);
  const pending=buildCupPreview(manifest,definition,1,1);
  const partial=buildCupPreview(manifest,definition,1,19);
  const complete=buildCupPreview(manifest,definition,1,31);
  const nextSeason=buildCupPreview(manifest,definition,2,19);
  for(const snapshot of [pending,partial,complete,nextSeason]){
   assert.equal(snapshot.participants.length,24);
   assert.equal(new Set(snapshot.participants.map(c=>c.countryId+'-'+c.clubId)).size,24);
   assert.equal(snapshot.fixtures.length,72);
   assert.equal(snapshot.statistics.standings.length,24);
   assert.deepEqual([...new Set(snapshot.fixtures.map(g=>g.round))],[1,2,3,4,5,6]);
   for(let round=1;round<=6;round++){
    const games=snapshot.fixtures.filter(g=>g.round===round);
    assert.equal(games.length,12);
    assert.equal(new Set(games.flatMap(g=>[g.homeId,g.awayId])).size,24);
   }
   const clubs=new Map(snapshot.participants.map(c=>[c.countryId+'-'+c.clubId,c]));
   const home=new Map(),away=new Map(),rivals=new Map();
   for(const game of snapshot.fixtures){
    assert.notEqual(clubs.get(game.homeId).countryId,clubs.get(game.awayId).countryId);
    home.set(game.homeId,(home.get(game.homeId)||0)+1);
    away.set(game.awayId,(away.get(game.awayId)||0)+1);
    for(const [one,two] of [[game.homeId,game.awayId],[game.awayId,game.homeId]]){
     const set=rivals.get(one)||new Set();assert.ok(!set.has(two));set.add(two);rivals.set(one,set);
    }
   }
   for(const club of clubs.keys()){assert.equal(home.get(club),3);assert.equal(away.get(club),3);assert.equal(rivals.get(club).size,6)}
  }
  assert.equal(pending.results.length,0);
  assert.equal(partial.results.length,24);
  assert.equal(complete.results.length,72);
  assert.notDeepEqual(partial.results,nextSeason.results);
 });
}
test('A04 cup preview is linked to Debug source events, not just popup visibility',()=>{
 const source=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
 assert.match(source,/const cupPath=/);
 assert.match(source,/mountCupDebugPreview\(/);
 assert.match(source,/fa:dev-world-day-change/);
 assert.match(source,/fa:debug-mode-change/);
 assert.match(source,/fa:competition-route-change/);
});

test('A04: DEV virtual modules expose all cup preview imports so Debug Settings mounts',()=>{
 const server=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
 assert.match(client,/from "\.\/dev-international-preview\.mjs"/);
 assert.match(server,/"\/__fa_dev__\/dev-international-preview\.mjs": "dev-international-preview\.mjs"/);
});

for(const id of ['int-1','int-2']){
 test('A04 '+id+' completes configured knockout rounds and its final on world schedule',()=>{
  const definition=competitionModel.competitionById(manifest,id);
  const count=day=>buildCupPreview(manifest,definition,2,day).results.filter(result=>result.id);
  const checkpoints=[[31,0],[36,4],[38,4],[41,8],[43,8],[46,10],[48,10],[id==='int-1'?53:54,id==='int-1'?10:11]];
  for(const [day,min] of checkpoints)assert.ok(count(day).length>=min,id+' day '+day);
  const final=count(id==='int-1'?54:53);
  assert.equal(final.length,11);
  assert.ok(final.every(tie=>tie.winnerId));
  assert.equal(final.reduce((n,tie)=>n+tie.legs.length,0),21);
 });
}
test('A04 fixture knockout labels do not include middle dot and Final has no leg suffix',()=>{
 const source=readFileSync(new URL('../assets/competition-fixtures.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/textContent\+=' · '\+selectedChoice\.round/);
 assert.match(source,/choice\.phaseId!=='final'/);
 assert.match(source,/selectedChoice\.phaseId!=='final'/);
});

test('A04 shared fixture picker keeps full knockout round labels on one line',()=>{
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.app-fixtures-select\{width:250px;flex:0 0 250px/);
 assert.match(css,/#app-fixtures-round-number,\.app-fixtures-picker \.language-option\{white-space:nowrap\}/);
 assert.match(css,/@media\(max-width:360px\)\{\.app-fixtures-select\{width:230px;flex-basis:230px/);
});

test('A04 menu and selected knockout labels use identical translated leg names',()=>{
 const source=readFileSync(new URL('../assets/competition-fixtures.js',import.meta.url),'utf8');
 assert.match(source,/word\(choice\.round===1\?'postseasonFirstLeg':'postseasonSecondLeg'/);
 assert.match(source,/word\(selectedChoice\.round===1\?'postseasonFirstLeg':'postseasonSecondLeg'/);
 assert.doesNotMatch(source,/choice\.round\+'\/'/);
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.app-fixtures-trigger\{[^}]*justify-content:center/);
 assert.match(css,/\.app-fixtures-trigger>\.language-chevron\{position:absolute/);
});
