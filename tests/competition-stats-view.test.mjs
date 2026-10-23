import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const definitions=loadCompetitionCatalogue();
const walk=node=>[node,...node.children.flatMap(walk)];
function fixture(){
 const document={activeElement:null};
 function element(tag='div'){
  const node={tagName:tag,children:[],dataset:{},attrs:{},events:{},className:'',textContent:'',style:{},open:false,hidden:false,
   append(...items){for(const item of items){item.parentElement=this;this.children.push(item)}},appendChild(item){this.append(item);return item},
   replaceChildren(...items){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...items)},
   remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null},
   setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},removeAttribute(k){delete this.attrs[k]},
   addEventListener(k,fn){(this.events[k]??=[]).push(fn)},removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(f=>f!==fn)},
   emit(k,extra={}){const event={target:this,button:0,detail:1,preventDefault(){},...extra};for(const fn of this.events[k]||[])fn(event)},
   focus(){document.activeElement=this},blur(){if(document.activeElement===this)document.activeElement=null},
   showModal(){this.open=true},close(){this.open=false;this.emit('close')},
   getBoundingClientRect(){return {left:10,right:300,top:10,bottom:500}},scrollBy(){},scrollTo(){},
   matches(){return true},querySelectorAll(selector){return walk(this).slice(1).filter(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):selector==='button'?n.tagName==='button':false)},
   querySelector(selector){return this.querySelectorAll(selector)[0]||null},get isConnected(){return this===document.body||Boolean(this.parentElement?.isConnected)}
  };
  node.classList={add(...names){node.className=[...new Set([...node.className.split(' ').filter(Boolean),...names])].join(' ')},remove(name){node.className=node.className.split(' ').filter(n=>n!==name).join(' ')},toggle(name,on){on?this.add(name):this.remove(name)}};
  return node;
 }
 document.createElement=element;document.body=element('body');document.documentElement={lang:'en'};
 const panel=element('section');document.body.append(panel);
 const window={faAppRenderLanguage(){},matchMedia:()=>({matches:true}),dispatchEvent(){},requestAnimationFrame:fn=>fn()};
 let source='';try{source=readFileSync(new URL('../assets/competition-stats.js',import.meta.url),'utf8')}catch{}
 runInNewContext(source,{window,document,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),Event:class{constructor(type){this.type=type}}});
 return {api:window.faCompetitionStats,document,panel,window,nodes:()=>walk(document.body)};
}
const context=(id='IT-1',revision=1)=>({definition:definitions.find(d=>d.id===id),selectedSeason:1,revision,seasonData:null});
const contents=node=>node.textContent+node.children.map(contents).join('');
const buttons=r=>r.nodes().filter(n=>n.tagName==='button'&&n.dataset.statsView);
const byClass=(r,cls)=>r.nodes().filter(n=>n.className.split(' ').includes(cls));
function supplied(id,count){
 const c=context(id),countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const participants=Array.from({length:count},(_,i)=>({countryId:count===16?'IT':countries[Math.floor(i/3)],clubId:count===16?i+1:i%3+1,primaryName:'Team '+String(i+1).padStart(2,'0')}));
 const teams=participants.map((club,i)=>({clubKey:club.countryId+'-'+club.clubId,clubName:club.primaryName,mp:2,gf:i<2?5:count-i,ga:2,w:1,cs:1,ppg:1,gd:i<2?3:count-i-2,unbeatenStreak:1}));
 c.seasonData={season:1,rulesVersion:c.definition.rules.version,participants,fixtures:null,results:null,status:'partial',statistics:{overview:{matchesPlayed:12,totalGoals:36,goalsPerMatch:3},teams,players:[]}};
 return c;
}
test('STATS-PUBLIC: domestic and both cup contexts expose 3/7/4 empty cards with no fake zero values',()=>{
 for(const id of ['IT-1','int-1','int-2']){
  const r=fixture();assert.equal(typeof r.api?.mount,'function');
  r.api.mount(r.panel,context(id));
  assert.equal(buttons(r).length,3);assert.equal(byClass(r,'fa-dev-stats-card').length,3);
  assert.equal(byClass(r,'app-competition-stat-value').length,0);
  buttons(r)[1].emit('click');assert.equal(byClass(r,'fa-dev-stats-team-card').length,7);
  assert.equal(byClass(r,'fa-dev-stats-top').length,0);
  buttons(r)[2].emit('click');assert.equal(byClass(r,'fa-dev-stats-leader-card').length,4);
  assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
 }
});
test('STATS-SUPPLIED: averages retain two decimals and Show all uses actual 16/24 identities and tied ranks',()=>{
 for(const [id,count] of [['IT-1',16],['int-1',24]]){
  const r=fixture();assert.equal(typeof r.api?.mount,'function');const c=supplied(id,count);
  c.seasonData.statistics.teams.forEach(team=>team.gf=5);
  r.api.mount(r.panel,c);
  assert.equal(byClass(r,'app-competition-stat-value')[2].textContent,'3.00');
  buttons(r)[1].emit('click');assert.equal(byClass(r,'fa-dev-stats-expand').length,7);
  const open=byClass(r,'fa-dev-stats-expand')[0];open.focus();open.emit('click');
  const dialog=byClass(r,'fa-dev-stats-dialog')[0];assert.equal(dialog.open,true);
  assert.equal(walk(dialog).filter(n=>n.tagName==='li').length,count);
  assert.ok(walk(dialog).filter(n=>n.className==='fa-dev-stats-rank').every(n=>n.textContent==='1'));
  const crests=walk(dialog).filter(n=>n.dataset.clubCrest).map(n=>n.dataset.clubCrest);
  assert.equal(new Set(crests).size,count);if(count===24){assert.ok(crests.includes('IT-1'));assert.ok(crests.includes('ENG-1'))}
  assert.ok(walk(dialog).filter(n=>n.tagName==='a').every(n=>/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/[1-9]\d?\/overview$/.test(n.href)));
  dialog.emit('cancel');assert.equal(byClass(r,'fa-dev-stats-dialog').length,0);assert.equal(r.document.activeElement,open);
 }
});
test('STATS-LIFECYCLE: mount is idempotent, keyboard changes subviews, revisions reject stale data, updates close old dialogs',()=>{
 const r=fixture();assert.equal(typeof r.api?.mount,'function');const c=supplied('int-1',24);
 const mounted=r.api.mount(r.panel,c);assert.equal(r.api.mount(r.panel,c),mounted);assert.equal(buttons(r).length,3);
 buttons(r)[0].emit('keydown',{key:'ArrowRight'});assert.equal(byClass(r,'fa-dev-stats-team-card').length,7);assert.equal(r.document.activeElement,buttons(r)[1]);
 byClass(r,'fa-dev-stats-expand')[0].emit('click');assert.equal(byClass(r,'fa-dev-stats-dialog').length,1);
 const empty={...c,revision:3,selectedSeason:2,seasonData:null};mounted.update(empty);
 assert.equal(byClass(r,'fa-dev-stats-dialog').length,0);assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
 mounted.update({...c,revision:2});assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
 mounted.destroy();assert.equal(r.panel.children.length,0);
});
test('STATS-VALIDATION: escaped names and malformed or foreign team records never manufacture rankings',()=>{
 const r=fixture();assert.equal(typeof r.api?.mount,'function');const c=supplied('int-1',24);
 c.seasonData.statistics.teams[0].clubName='<img onerror=x>';
 const mounted=r.api.mount(r.panel,c);buttons(r)[1].emit('click');
 assert.equal(r.nodes().filter(n=>n.tagName==='img').length,0);assert.ok(contents(r.panel).includes('<img onerror=x>'));
 let revision=2;
 for(const change of [c=>c.seasonData.statistics.teams[0].clubKey='IT-99',c=>c.seasonData.statistics.teams[0].ppg=NaN,c=>c.seasonData.statistics.teams[1].clubKey=c.seasonData.statistics.teams[0].clubKey]){
  const invalid=supplied('int-1',24);invalid.revision=revision++;change(invalid);mounted.update(invalid);assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
 }
});
test('STATS-FIRST-PAINT: all 18 generated routes contain the full empty Overview interface',()=>{
 for(const d of definitions){
  const html=readFileSync(new URL('../competitions/'+d.slug+'/index.html',import.meta.url),'utf8');
  const panel=html.split('id="competition-panel-stats"')[1].split('id="competition-panel-history"')[0];
  assert.ok(panel.includes('id="fa-dev-stats"'));
  assert.equal((panel.match(/data-stats-view=/g)||[]).length,3);
  assert.equal((panel.match(/fa-dev-stats-card"/g)||[]).length,3);
 }
});
test('STATS-SEASON: mismatched season/rules and reused revision cannot restore old statistics',()=>{
 const r=fixture(),c=supplied('int-1',24),mounted=r.api.mount(r.panel,c);
 mounted.update({...c,revision:2,selectedSeason:2,seasonData:null});
 mounted.update({...c,revision:2});assert.equal(byClass(r,'app-competition-stat-value').length,0);
 mounted.update({...c,revision:3,selectedSeason:2});assert.equal(byClass(r,'app-competition-stat-value').length,0);
 const changed=supplied('int-1',24);changed.revision=4;changed.seasonData.rulesVersion='unknown';mounted.update(changed);
 assert.equal(byClass(r,'app-competition-stat-value').length,0);
});
test('STATS-PLAYERS: only supplied player records populate the four existing categories',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.players=[{playerId:'p1',name:'Supplied Player',clubKey:'IT-1',appearances:2,goals:0,assists:1,averageRating:7,cleanSheets:0}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 assert.equal(byClass(r,'fa-dev-stats-leader-card').length,4);
 assert.ok(contents(r.panel).includes('7.00'));assert.ok(contents(r.panel).includes('Supplied Player'));
 assert.equal(r.nodes().filter(n=>n.tagName==='li').length,4);
});
test('STATS-PARTIAL: unplayed teams do not erase played statistics or enter rankings',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.teams.forEach((team,i)=>{team.mp=i<2?1:0;});
 r.api.mount(r.panel,c);
 assert.equal(byClass(r,'app-competition-stat-value').length,3);
 buttons(r)[1].emit('click');
 assert.equal(byClass(r,'fa-dev-stats-top').length,7);
 assert.equal(r.nodes().filter(n=>n.tagName==='li').length,14);
 assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
});
test('STATS-RECOVERY: malformed contexts clear totals and dialogs, expose an error, then recover',()=>{
 for(const invalid of [c=>delete c.definition,c=>c.definition={},c=>c.revision='bad']){
  const r=fixture(),c=supplied('int-1',24),mounted=r.api.mount(r.panel,c);
  buttons(r)[1].emit('click');byClass(r,'fa-dev-stats-expand')[0].emit('click');
  const next={...c,revision:2};invalid(next);
  assert.doesNotThrow(()=>mounted.update(next));
  assert.equal(byClass(r,'fa-dev-stats-dialog').length,0);
  assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
  assert.ok(r.nodes().some(node=>node.dataset.appI18n==='statsDevUnavailable'));
  mounted.update({...c,revision:3});assert.equal(byClass(r,'fa-dev-stats-expand').length,7);
 }
 const r=fixture(),mounted=r.api.mount(r.panel,{revision:1,definition:{}});
 assert.equal(buttons(r).length,3);assert.ok(contents(r.panel).includes('Statistics are unavailable.'));
 mounted.update({...supplied('int-1',24),revision:2});
 assert.equal(byClass(r,'app-competition-stat-value').length,3);
});
test('STATS-ERROR: invalid supplied records differ from an ordinary empty season',()=>{
 const r=fixture(),c=supplied('int-1',24);c.seasonData.statistics.teams[0].clubKey='IT-99';
 r.api.mount(r.panel,c);
 assert.ok(r.nodes().some(node=>node.dataset.appI18n==='statsDevUnavailable'));
 assert.equal(byClass(r,'app-competition-stat-value').length,0);
 buttons(r)[2].emit('click');assert.equal(byClass(r,'fa-dev-stats-leader-card').length,4);
});
