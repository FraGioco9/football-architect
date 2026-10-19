import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const divisions=['it-1','it-2','eng-1','eng-2','es-1','es-2','de-1','de-2','fr-1','fr-2','pt-1','pt-2','nl-1','nl-2','br-1','br-2'];
const rulesPanel=html=>html.slice(html.indexOf('id="competition-panel-rules"'),html.indexOf('id="competition-panel-awards"'));
const keys=html=>[...new Set([...html.matchAll(/data-app-i18n="(rules[A-Za-z0-9]+)"/g)].map(m=>m[1]))];

test('RULES-04: all 16 division pages have correct shared and tier-specific regulations',()=>{
 for(const id of divisions){
  const html=read('app/competitions/'+id+'/index.html'),rules=rulesPanel(html),tier=id.endsWith('-1')?1:2;
  assert.ok(rules.startsWith('id="competition-panel-rules"'),id);
  for(const key of ['rulesClubs','rulesRounds','rulesLegs','rulesMatches','rulesFormatBody','rulesRankingBody'])
   assert.ok(rules.includes('data-app-i18n="'+key+'"'),id+' missing '+key);
  assert.equal((html.match(/id="app-competition-capacity"/g)||[]).length,1,id);
  assert.equal((html.match(/id="app-competition-level"/g)||[]).length,1,id);
  assert.ok(rules.includes('id="app-competition-level" hidden>'+tier+'</strong>'),id);
  assert.doesNotMatch(rules,/<h2|rulesTier"|rulesSeason|rules-season|The tie takes place|Away goals carry/i,id);
  assert.ok(rules.indexOf('rulesFormatBody')<rules.indexOf('app-rules-metrics'),id+' format must precede boxes');
  assert.equal(rules.includes('data-app-i18n="rulesPlayoutBody"'),tier===1,id);
  assert.equal(rules.includes('data-app-i18n="rulesPlayoffsBody"'),tier===2,id);
  assert.equal(rules.includes('data-app-i18n="rulesTier1Champion"'),tier===1,id);
  assert.equal(rules.includes('data-app-i18n="rulesTier2Promoted"'),tier===2,id);
  assert.equal(rules.includes('data-app-i18n="rulesNoThirdTier"'),tier===2,id);
  assert.doesNotMatch(rules,/approved|postpon|reschedul|neutral venue|pending approval/i,id);
 }
});

test('RULES-04: neutral shared document is not assigned tier-specific sporting outcomes',()=>{
 const html=read('app/competitions/_shared/index.html'),rules=rulesPanel(html);
 assert.match(rules,/data-app-i18n="rulesNeutralOutcomes"/);
 assert.doesNotMatch(rules,/data-app-i18n="rulesPlayoutBody"|data-app-i18n="rulesPlayoffsBody"/);
 assert.equal((html.match(/id="app-competition-capacity"/g)||[]).length,1);
 assert.equal((html.match(/id="app-competition-level"/g)||[]).length,1);
});

test('RULES-04: every displayed rule has translations in all five locales',()=>{
 const dictionary=read('assets/app.js');
 const sample=['it-1','it-2','_shared'].map(id=>read('app/competitions/'+id+'/index.html'));
 const all=new Set(sample.flatMap(x=>keys(rulesPanel(x))));
 assert.ok(all.size>=23,'Expected complete regulations vocabulary');
 for(const key of all){
  const matches=dictionary.match(new RegExp('^      '+key+':','gm'))||[];
  assert.equal(matches.length,5,key+' requires exactly five locale entries');
 }
 assert.doesNotMatch(read('tools/render-competition-page.mjs'),/competitionRulesEmpty/);
});

test('RULES-04: non-Rules runtime and provisional manifest contracts are unchanged',()=>{
 const model=read('assets/competition-model.js');
 assert.match(model,/rules:\{status:"undefined",points:null,tiebreakers:null,promotion:null,relegation:null\}/);
 const manifest=JSON.parse(read('app/competitions/_shared/manifest.json'));
 assert.equal(manifest.approved,false);
 assert.equal(manifest.profile.rules.status,'undefined');
 assert.equal(manifest.divisions.length,16);
});
