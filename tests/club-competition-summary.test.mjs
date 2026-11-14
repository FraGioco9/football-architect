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

const escapeMarkup=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const englishOrdinal=n=>n+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));

test('Club competition cards render current own-club snapshots for every division and locale',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const clubs=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 const languages=['en','de','es','fr','it'];
 assert.equal(manifest.divisions.length,16,'eight countries and both domestic tiers');
 const card=(selected,summary,lang='en')=>{
  const output=model.render(clubs,selected,lang,'',summary);
  const panel=output.match(/<section class="app-panel club-competition"[\s\S]*?<\/section>/)?.[0];
  assert.ok(panel,selected.countryId+'-'+selected.clubId+' '+lang+' panel');
  return panel;
 };
 for(const division of manifest.divisions){
  const club=division.clubs[0],label=division.id+' club '+club.clubId;
  const selected=model.route('/clubs/'+division.countryId.toLowerCase()+'/'+club.clubId+'/overview');
  assert.ok(selected,label+' has a canonical route');
  const snapshot=preview.createPreviewClubSummary(division,club.clubId,{season:3,matchdays:15});
  const next=snapshot.nextMatch;
  assert.ok(next,label+' has a next fixture');
  const home=division.clubs.find(c=>c.clubId===next.homeId),away=division.clubs.find(c=>c.clubId===next.awayId);
  assert.ok(home&&away,label+' fixture participants are canonical');
  const names=escapeMarkup(home.primaryName+' – '+away.primaryName);
  const finished=preview.createPreviewClubSummary(division,club.clubId,{season:3,matchdays:33});
  for(const lang of languages){
   const context=label+' '+lang;
   const empty=card(selected,null,lang),html=card(selected,snapshot,lang);
   assert.doesNotMatch(empty,/>Division</,context+' no legacy division heading');
   assert.match(empty,/data-club-position>—<\/dd>/,context+' blank rank');
   assert.doesNotMatch(empty,/data-club-points/,context+' no speculative points');
   assert.ok(empty.includes('>'+model.copies[lang].statusLabel+'</dt>'),context+' status is localized');
   assert.ok(empty.includes(model.copies[lang].noScheduledMatch),context+' no invented fixture');
   assert.ok(html.includes('/competitions/'+division.id.toLowerCase()+'/standings"'),context+' current standings route');
   assert.doesNotMatch(html,/data-club-position><a/,context+' rank is not a link');
   assert.doesNotMatch(html,/data-club-points/,context+' no points');
   assert.ok(html.includes('fixtures?matchday=16'),context+' round 16 link');
   assert.ok(html.includes(names),context+' actual fixture names safely escaped');
   assert.ok(html.includes('>'+model.copies[lang].nextMatchLabel+'</span>'),context+' next match localized');
   if(lang==='en')assert.ok(html.includes('data-club-position>'+englishOrdinal(snapshot.position)+'</dd>'),context+' ordinal rank');
   assert.ok(card(selected,finished,lang).includes(model.copies[lang].noUpcomingMatch),context+' ended season');
  }
  const empty=card(selected,null);
  assert.equal(card(selected,{...snapshot,clubId:division.clubs[1].clubId}),empty,label+' rejects a foreign club summary');
  assert.equal(card(selected,{...snapshot,points:-1}),empty,label+' invalid points keep the empty card');
 }
});

test('A01-10 repeated rendering keeps identical snapshots and rejects foreign clubs across all 16 divisions',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const clubs=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.divisions.length,16);
 for(const division of manifest.divisions){
  const club=division.clubs[0],selected=model.route('/clubs/'+division.countryId.toLowerCase()+'/'+club.clubId+'/overview');
  const snapshot=preview.createPreviewClubSummary(division,club.clubId,{season:3,matchdays:15});
  const html=model.render(clubs,selected,'en','?season=3&matchday=15',snapshot);
  assert.equal(model.render(clubs,selected,'en','?season=3&matchday=15',snapshot),html,division.id+' stable repeated output');
  assert.notEqual(model.render(clubs,selected,'en','?season=3&matchday=15',{...snapshot,clubId:division.clubs[1].clubId}),html,division.id+' wrong-club summary');
 }
});
