import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const require=createRequire(import.meta.url);
let view;try{view=require('../assets/competition-rules-view.js')}catch{}
const catalogue=loadCompetitionCatalogue();
const get=id=>structuredClone(catalogue.find(d=>d.id===id));
const metric=(html,key)=>html.match(new RegExp('<dd[^>]*data-rule-metric="'+key+'"[^>]*>([^<]*)</dd>'))?.[1];
// A fixed paragraph or metric, ignored rank edits, or guessed fallback must fail here.
test('RULES-CONFIG: all 18 definitions derive their metrics, rank bands and ordered criteria',()=>{
 assert.equal(typeof view?.renderRules,'function');
 for(const d of catalogue){
  const html=view.renderRules(d,'en');
  assert.equal(metric(html,'capacity'),d.category==='domestic'?'16':'24');
  assert.equal(metric(html,'league.rounds'),d.category==='domestic'?'30':'6');
  assert.equal(metric(html,'league.matches'),d.category==='domestic'?'240':'72');
  if(d.category==='international'){
   assert.equal(metric(html,'totalMatches'),'93');
   assert.doesNotMatch(html,/relegat|promotion|play-out/i);
   assert.match(html,/neutral/i);
  }
  let previous=-1;
  for(const criterion of d.rules.phases[0].tiebreakers){
   const index=html.indexOf('data-rule-criterion="'+criterion+'"');assert.ok(index>previous);previous=index;
  }
  for(const band of d.rules.phases[0].rankOutcomes){
   assert.ok(html.includes('data-rule-kind="'+band.kind+'" data-rule-from="'+band.from+'" data-rule-to="'+band.to+'"'));
  }
  for(const phase of d.rules.phases.filter(p=>p.type==='knockout'))for(const tie of phase.ties){
   assert.ok(html.includes('data-rule-home="'+tie.homePolicy+'"'));
   assert.ok(html.includes('data-rule-resolution="'+tie.resolution+'"'));
  }
 }
});
test('RULES-CONFIG: points and valid outcome edits change text and metadata in every locale',()=>{
 assert.equal(typeof view?.renderRules,'function');
 const d=get('IT-1');d.rules.phases[0].points.win=2;
 d.rules.phases[0].rankOutcomes[0].to=2;d.rules.phases[0].rankOutcomes[1].from=3;
 for(const lang of ['en','de','es','fr','it']){
  const html=view.renderRules(d,lang);
  assert.equal(metric(html,'points.win'),'2');
  assert.match(html,/data-rule-kind="champion" data-rule-from="1" data-rule-to="2"[^>]*><strong[^>]*>1–2</);
  assert.doesNotMatch(html,/data-app-i18n="rulesFormatBody"|data-app-i18n="rulesTier1Champion"/);
  assert.match(html,/data-rule-template=/);assert.match(html,/data-rule-params=/);
 }
});
test('RULES-CONFIG: unsafe identities are escaped, invalid rules and unknown templates fail closed',()=>{
 assert.equal(typeof view?.renderRules,'function');
 const d=get('IT-1');d.name='A <script>alert("x")</script> & B';
 const html=view.renderRules(d,'en');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 for(const change of [x=>x.rules.phases[0].points.win='2',x=>x.rules.phases[0].type='executable',x=>x.rules.phases[0].labelKey='<img onerror=x>',x=>x.rules.awards=['unknown-award'],x=>x.rules.html='<script>x</script>',x=>x.rules.phases[1].ties[0].winnerOutcome='execute']){
  const invalid=get('IT-1');change(invalid);assert.throws(()=>view.renderRules(invalid,'it'));
 }
});
test('RULES-CONFIG: award IDs retain existing honours and performance presentation explicitly',()=>{
 for(const d of catalogue){
  assert.ok(d.rules.awards.includes('champion'));assert.ok(d.rules.awards.includes('manager'));assert.ok(d.rules.awards.includes('xi'));
  assert.equal(d.rules.awards.includes('promotion'),d.category==='domestic'&&d.tier===2);
  assert.equal(d.rules.awards.includes('playoff'),d.category==='domestic'&&d.tier===2);
 }
});

import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
const awardsSource=readFileSync(new URL('../assets/competition-awards.js',import.meta.url),'utf8');
function awardsFixture(definition,seasonData=null){
 const make=tag=>({tagName:tag,children:[],dataset:{},className:'',textContent:'',attrs:{},classList:{add(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=[...nodes]},insertBefore(node,before){this.children.splice(this.children.indexOf(before),0,node)}});
 const panel=make('section'),events={};
 const window={faCompetitionContext:{definition,selectedSeason:1,revision:1,seasonData},faCompetitionRulesView:view,faAppRenderLanguage(){},addEventListener(k,fn){events[k]=fn}};
 runInNewContext(awardsSource,{window,location:{pathname:'/competitions/it-2/awards'},document:{getElementById:()=>panel,createElement:make,createElementNS:(ns,tag)=>make(tag)}});
 const walk=n=>[n,...n.children.flatMap(walk)];
 return {panel,window,events,nodes:()=>walk(panel),cards:()=>walk(panel).filter(n=>/^fa-awards-card fa-awards-card-/.test(n.className))};
}
test('AWARDS-CONFIG: configured order overrides route tier and retains only applicable award cards',()=>{
 const d=get('int-1');d.rules.awards=['boot','champion','assists'];
 const r=awardsFixture(d);
 assert.deepEqual(r.cards().map(n=>n.className.split('fa-awards-card-')[1]),['boot','champion','assists']);
 assert.ok(r.nodes().filter(n=>n.className==='fa-awards-chip').every(n=>n.textContent==='PENDING'));
});
test('AWARDS-CONFIG: only supplied recipients appear and season changes clear stale winners',()=>{
 const d=get('int-1');d.rules.awards=['champion'];
 const r=awardsFixture(d,{awards:{champion:{recipients:[{name:'A <script> & B'}]}}});
 assert.ok(r.nodes().some(n=>n.textContent==='A <script> & B'));
 r.window.faCompetitionContext={...r.window.faCompetitionContext,selectedSeason:2,revision:2,seasonData:null};
 r.events['fa:competition-context-change']({detail:r.window.faCompetitionContext});
 assert.ok(!r.nodes().some(n=>n.textContent==='A <script> & B'));
 assert.ok(r.nodes().some(n=>n.textContent==='PENDING'));
});
test('RULES-CONFIG: browser language refresh rebuilds changed parameters without stale paragraphs',()=>{
 assert.equal(typeof view?.update,'function');
 const d=get('IT-1');let writes=0,html='';
 const panel={set innerHTML(value){html=value;writes++},get innerHTML(){return html}};
 view.update(panel,d,'en');assert.match(html,/Competition format/);
 view.update(panel,d,'en');assert.equal(writes,1,'unchanged rules preserve existing DOM');
 d.rules.phases[0].points.win=2;
 view.update(panel,d,'it');assert.match(html,/Formula della competizione/);assert.equal(metric(html,'points.win'),'2');
 assert.doesNotMatch(html,/Competition format/);
});

test('RULES-CONFIG: decisive tie outcomes remain explicit rather than inferred from tier',()=>{
 const top=get('IT-1'),second=get('IT-2'),cup=get('int-1');
 assert.equal(top.rules.phases[1].ties[0].winnerOutcome,'remain');
 assert.equal(top.rules.phases[1].ties[0].loserOutcome,'relegated');
 assert.equal(second.rules.phases[1].ties.at(-1).winnerOutcome,'promoted');
 assert.equal(cup.rules.phases.at(-1).ties[0].winnerOutcome,'champion');
 for(const d of [top,second,cup]){
  const html=view.renderRules(d,'en');
  for(const phase of d.rules.phases.filter(p=>p.type==='knockout'))for(const tie of phase.ties){
   if(tie.winnerOutcome)assert.ok(html.includes('data-rule-winner="'+tie.winnerOutcome+'"'));
   if(tie.loserOutcome)assert.ok(html.includes('data-rule-loser="'+tie.loserOutcome+'"'));
  }
 }
});

test('RULES-CONFIG: the actual app language refresh uses configured rules without fixed paragraph overrides',()=>{
 const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const dictionaries=app.slice(app.indexOf('  const copies ='),app.indexOf('  const worldCountryNames'));
 const renderer=app.slice(app.indexOf('  function renderLanguage()'),app.indexOf('  function renderView()'));
 const d=get('IT-1');d.rules.phases[0].points.win=2;
 const panel={innerHTML:''};
 for(const lang of ['en','de','es','fr','it']){
  runInNewContext(dictionaries+renderer+'renderLanguage()',{window:{faCompetitionContext:{definition:d},faCompetitionRulesView:view},language:()=>lang,words:()=>[],accessible:()=>[],worldCountryNames:{},activeView:()=> 'divisions',document:{getElementById:id=>id==='competition-panel-rules'?panel:null,querySelectorAll:()=>[]}});
  assert.equal(metric(panel.innerHTML,'points.win'),'2');
  assert.doesNotMatch(panel.innerHTML,/data-app-i18n="rulesFormatBody"/);
 }
});

test('RULES-CONFIG: destinations follow configured phase references in every locale',()=>{
 const d=get('int-1');d.rules.phases[0].rankOutcomes[0].targetPhaseId='semifinals';
 const labels={en:'Semi-finals',de:'Halbfinale',es:'Semifinales',fr:'Demi-finales',it:'Semifinali'};
 for(const [lang,label] of Object.entries(labels)){
  const html=view.renderRules(d,lang);
  assert.ok(html.includes('data-rule-target="semifinals"'));
  assert.ok(html.includes('<span>'+label+'</span>'));
 }
});
test('RULES-CONFIG: unsupported nested keys and non-JSON values fail closed before normalization',()=>{
 for(const change of [
  d=>d.rules.phases[0].points.bonus=1,
  d=>d.rules.phases[0].rankOutcomes[0].html='<script>x</script>',
  d=>d.rules.phases[1].ties[0].participants[0].html='<script>x</script>',
  d=>d.rules.phases[1].ties[0].participants[0].tieId='other',
  d=>d.rules.executable=()=>{},
  d=>d.rules.phases[0].points.toJSON=()=>({win:3,draw:1,loss:0})
 ]){const d=get('IT-1');change(d);assert.throws(()=>view.renderRules(d));}
});
