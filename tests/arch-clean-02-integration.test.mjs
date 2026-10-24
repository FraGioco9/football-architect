import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import {resolveSubpage,competitionSubpage,clubSubpage,clubViews,competitionViews} from '../assets/subpage-routes.mjs';
import model from '../assets/competition-model.js';
import '../assets/world-calendar-model.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));

test('ARCH-CLEAN-02 integration: each domestic identity resolves all existing canonical views',()=>{
  const definitions=loadCompetitionCatalogue();
  for(const competition of definitions.filter(d=>d.category==='domestic')){
    const id=competition.id.toLowerCase();
    for(const view of competitionViews){
      const pathname=competitionSubpage(id,view);
      const route=resolveSubpage(pathname);
      assert.deepEqual(route,{kind:'competition',base:'/competitions/'+id,view,canonical:pathname,redirect:false});
    }
  }
});

test('ARCH-CLEAN-02 integration: every club has five canonical routes',()=>{
  const clubs=read('data/clubs.json');
  for(const club of clubs)for(const view of clubViews){
    const pathname=clubSubpage(club.countryId.toLowerCase(),String(club.clubId),view);
    const route=resolveSubpage(pathname);
    assert.equal(route?.kind,'club');
    assert.equal(route?.canonical,pathname);
    assert.equal(route?.redirect,false);
  }
});

test('ARCH-CLEAN-02 integration: international cup final markers match their identity',()=>{
  for(const competition of loadCompetitionCatalogue().filter(c=>c.category==='international')){
    const final=competition.rules.phases.find(p=>p.id==='final');
    assert.deepEqual(final.calendarEvents,[competition.id==='int-1'?'SOVEREIGN-FINAL':'FEDERATION-FINAL']);
  }
});

test('ARCH-CLEAN-02 integration: historical rules resolution is immutable and rejects unknown versions',()=>{
  const definition=loadCompetitionCatalogue().find(c=>c.id==='IT-1');
  const snapshot=JSON.parse(JSON.stringify(definition.rules));
  const season={season:1,divisionId:definition.id,rulesVersion:snapshot.version,rulesSnapshot:snapshot};
  const resolved=model.resolveSeasonRules(definition,season);
  assert.ok(resolved);
  assert.equal(Object.isFrozen(resolved),true);
  assert.equal(Object.isFrozen(resolved.phases[0]),true);
  assert.equal(model.resolveSeasonRules(definition,{...season,rulesVersion:'unknown-v99'}),null);
});

test('ARCH-CLEAN-02 integration: calendar projection is deterministic and keeps both cup finals',()=>{
  const m=globalThis.faWorldCalendarModel;
  assert.ok(m);
  const one=m.createSeason(1),again=m.createSeason(1);
  assert.deepEqual(one,again);
  assert.equal(one.days.length,56);
  const finals=one.days.flatMap(day=>day.events.map(e=>({day:day.day,marker:e.marker}))).filter(x=>x.marker.endsWith('-FINAL'));
  assert.deepEqual(finals,[{day:53,marker:'FEDERATION-FINAL'},{day:54,marker:'SOVEREIGN-FINAL'}]);
});
