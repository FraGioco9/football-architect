import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
import rulesView from '../assets/competition-rules-view.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const panel=html=>html.slice(html.indexOf('id="competition-panel-rules"'),html.indexOf('id="competition-panel-awards"'));
const value=(html,key)=>html.match(new RegExp('<dd[^>]*data-rule-metric="'+key+'"[^>]*>([^<]*)</dd>'))?.[1];
test('RULES-04: generated domestic pages retain approved league and decisive tie outcomes',()=>{
 for(const country of ['it','eng','es','de','fr','pt','nl','br'])for(const tier of [1,2]){
  const html=read('competitions/'+country+'-'+tier+'/index.html'),rules=panel(html);
  assert.equal(value(rules,'capacity'),'16');assert.equal(value(rules,'league.rounds'),'30');assert.equal(value(rules,'league.matches'),'240');
  assert.equal(value(rules,'points.win'),'3');assert.equal(value(rules,'points.draw'),'1');assert.equal(value(rules,'points.loss'),'0');
  assert.equal((html.match(/id="app-competition-capacity"/g)||[]).length,1);
  assert.equal((html.match(/id="app-competition-level"/g)||[]).length,1);
  assert.match(rules,new RegExp('id="app-competition-level" hidden>'+tier+'</strong>'));
  if(tier===1){assert.match(rules,/data-rule-kind="playout" data-rule-from="13" data-rule-to="14"/);assert.match(rules,/data-rule-loser="relegated"/);assert.match(rules,/data-rule-winner="remain"/);}
  else {assert.match(rules,/data-rule-kind="promoted" data-rule-from="1" data-rule-to="2"/);assert.match(rules,/data-rule-kind="promotionPlayoffs" data-rule-from="3" data-rule-to="6"/);assert.match(rules,/data-rule-winner="promoted"/);assert.doesNotMatch(rules,/data-rule-(?:kind|loser)="relegated"/);}
  assert.match(rules,/data-rule-home="higherOriginalTableRank"/);assert.match(rules,/data-rule-resolution="aggregateExtraTimePenalties"/);
  assert.doesNotMatch(rules,/postpon|reschedul|pending approval/i);
 }
});
test('RULES-04: neutral shell has no assigned sporting outcomes',()=>{
 const html=read('competitions/_shared/index.html'),rules=panel(html);
 assert.match(rules,/data-app-i18n="rulesNeutralOutcomes"/);assert.doesNotMatch(rules,/data-rule-kind=/);
 assert.equal((html.match(/id="app-competition-capacity"/g)||[]).length,1);
});
test('RULES-04: every supported locale renders its own complete rules vocabulary',()=>{
 const headings={en:'Competition format',de:'Wettbewerbsformat',es:'Formato de competición',fr:'Format de la compétition',it:'Formula della competizione'};
 for(const d of loadCompetitionCatalogue())for(const [lang,heading] of Object.entries(headings)){
  const html=rulesView.renderRules(d,lang);assert.ok(html.includes(heading));assert.doesNotMatch(html,/undefined|\[object Object\]/);
  if(lang!=='en')assert.doesNotMatch(html,/>Competition format</);
 }
});
test('RULES-04: domestic compatibility profile and provisional memberships stay unchanged',()=>{
 const manifest=JSON.parse(read('competitions/_shared/manifest.json'));
 assert.equal(manifest.approved,false);assert.equal(manifest.profile.rules.status,'undefined');assert.equal(manifest.divisions.length,16);
});
