import routeRegistry from '../assets/routes-registry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const definitions=loadCompetitionCatalogue();
const walk=node=>[node,...node.children.flatMap(walk)];
function fixture(registry=routeRegistry){
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
 const window={faRoutesRegistry:registry,faAppRenderLanguage(){},matchMedia:()=>({matches:true}),dispatchEvent(){},requestAnimationFrame:fn=>fn()};
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
test('STATS-LABEL: goal contributions per 90 remains consistent across first paint and locale keys',()=>{
 const r=fixture();
 assert.ok(r.api.renderSkeleton('players').includes('Goal contributions per 90'));
 assert.ok(!r.api.renderSkeleton('players').includes('Goals + assists per 90'));
 const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.deepEqual([...app.matchAll(/statsDevGoalsAssists90:"([^"]+)"/g)].map(m=>m[1]),[
  'Goal contributions per 90','Torbeiträge pro 90','Contribuciones de gol por 90',
  'Contributions aux buts par 90','Contributi ai gol per 90'
 ]);
 for(const d of definitions){
  const html=readFileSync(new URL('../competitions/'+d.slug+'/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('Goal contributions per 90'),d.slug+' first-paint skeleton');
  assert.ok(!html.includes('Goals + assists per 90'),d.slug+' avoids stale label');
 }
});
test('STATS-PUBLIC: domestic and both cup contexts expose 3/7/9 empty cards with no fake zero values',()=>{
 for(const id of ['IT-1','int-1','int-2']){
  const r=fixture();assert.equal(typeof r.api?.mount,'function');
  r.api.mount(r.panel,context(id));
  assert.equal(buttons(r).length,3);assert.equal(byClass(r,'fa-dev-stats-card').length,3);
  assert.equal(byClass(r,'app-competition-stat-value').length,0);
  buttons(r)[1].emit('click');assert.equal(byClass(r,'fa-dev-stats-team-card').length,7);
  assert.equal(byClass(r,'fa-dev-stats-top').length,0);
  buttons(r)[2].emit('click');assert.equal(byClass(r,'fa-dev-stats-leader-card').length,9);
  assert.equal(byClass(r,'fa-dev-stats-expand').length,0);
 }
});
test('QA-11: loading-shell Stats selection survives hydration and season changes across competitions',()=>{
 for(const id of ['IT-1','int-1','int-2']){
  const r=fixture();r.panel.dataset.faStatsSelectedView='players';
  const mounted=r.api.mount(r.panel,context(id));
  assert.equal(r.panel.dataset.faStatsSelectedView,'players');
  assert.equal(byClass(r,'fa-dev-stats-leader-card').length,9);
  r.panel.emit('fa:stats-shell-selection',{detail:'teams'});
  assert.equal(r.panel.dataset.faStatsSelectedView,'teams');
  assert.equal(byClass(r,'fa-dev-stats-team-card').length,7);
  const ready=supplied(id,id==='IT-1'?16:24);ready.revision=2;mounted.update(ready);
  assert.equal(r.panel.dataset.faStatsSelectedView,'teams');
  assert.equal(byClass(r,'fa-dev-stats-top').length,7);
  r.panel.emit('fa:stats-shell-selection',{detail:'players'});
  assert.equal(byClass(r,'fa-dev-stats-leader-card').length,9);
  mounted.update({...ready,revision:3,selectedSeason:2,seasonData:null});
  assert.equal(r.panel.dataset.faStatsSelectedView,'players');
  assert.equal(byClass(r,'fa-dev-stats-top').length,0);
 }
});
test('QA-11: Teams and Players loading crests match the Standings circular skeleton, not the missing-logo shield',()=>{
 const r=fixture();
 for(const [view,count] of [['teams',35],['players',45]]){
  const markup=r.api.renderSkeleton(view);
  assert.equal((markup.match(/class="app-view-skeleton-crest-slot"/g)||[]).length,count,view+' reserves one circle per pending row');
  assert.equal((markup.match(/app-world-club-crest-placeholder/g)||[]).length,0,view+' loading never renders the no-logo shield');
 }
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.app-view-skeleton-crest-slot\{[^}]*width:48px;height:48px;border-radius:50%;background:var\(--fa-crest-skeleton-fill\)/,
  'desktop crest skeleton must use the same shape, fill and geometry as Standings');
 assert.match(css,/@media\(max-width:620px\)\{\.app-view-skeleton-crest-slot\{flex-basis:40px;width:40px;height:40px\}\}/,
  'mobile crest skeleton must use the same 40px footprint as Standings');
 assert.doesNotMatch(css,/:is\(\.app-fixtures-skeleton-crest,\.app-view-skeleton-crest-slot\)\{[^}]*background:transparent/,
  'fixture loading must never hide the Stats crest skeleton');
});
test('QA-11: Stats skeleton cards reserve Show all size before hydration in domestic and international shells',()=>{
 const r=fixture();
 for(const [view,count] of [['teams',7],['players',9]]){
  const markup=r.api.renderSkeleton(view);
  assert.equal((markup.match(/class="fa-dev-stats-expand app-view-skeleton-stats-expand"/g)||[]).length,count,view+' reserves one footer per card');
  assert.equal((markup.match(/class="app-view-skeleton-stats-expand-label" data-app-i18n="statsDevShowAll">Show all<\/span>/g)||[]).length,count,view+' reserves translated button text metrics');
  for(const d of definitions){
   const page=readFileSync(new URL('../competitions/'+d.slug+'/index.html',import.meta.url),'utf8');
   const template=page.match(new RegExp('<template data-competition-skeleton="stats-'+view+'">([\\s\\S]*?)<\\/template>'))?.[1];
   assert.ok(template,d.slug+' includes '+view+' template');
   assert.equal((template.match(/class="fa-dev-stats-expand app-view-skeleton-stats-expand"/g)||[]).length,count,d.slug+' '+view+' footer count');
  }
 }
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.app-competition-view-skeleton \.app-view-skeleton-stats-expand-label\{visibility:hidden\}/);
 assert.match(css,/\.app-competition-view-skeleton \.app-view-skeleton-stats-expand>\.app-skeleton-bar\{[^}]*position:absolute;/);
 assert.match(css,/\.fa-dev-stats-expand\{[^}]*margin:10px auto 0;padding:5px 9px/);
});

test('STATS-OVERVIEW: three metrics keep localized numeric formats and stable empty/skeleton tracks',()=>{
 const r=fixture(),c=supplied('IT-1',16);
 c.seasonData.statistics.overview={matchesPlayed:12345,totalGoals:30987,goalsPerMatch:2.507};
 const mounted=r.api.mount(r.panel,c);
 const numbers=()=>byClass(r,'app-competition-stat-value').map(n=>n.textContent);
 assert.deepEqual(numbers(),['12,345','30,987','2.51'],'English groups integer totals and prints two decimal places');
 r.document.documentElement.lang='it';
 mounted.update({...c,revision:2});
 assert.deepEqual(numbers(),['12.345','30.987','2,51'],'Italian grouping and decimal separators follow document language');
 r.document.documentElement.lang='de';
 mounted.update({...c,revision:3});
 assert.deepEqual(numbers(),['12.345','30.987','2,51'],'German separators follow document language');
 const empty={...c,revision:4,seasonData:null};mounted.update(empty);
 assert.equal(byClass(r,'fa-dev-stats-card').length,3);
 assert.equal(byClass(r,'fa-dev-stats-empty').length,3);
 assert.equal(byClass(r,'app-competition-stat-value').length,0,'unknown values are never formatted as zero');
 const markup=r.api.renderSkeleton('overview');
 assert.equal((markup.match(/class="app-competition-stat-value"/g)||[]).length,3);
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-dev-stats-card \.app-competition-stat-value\{[^}]*align-items:center[^}]*height:50px;min-height:0/);
 assert.match(css,/\.fa-dev-stats-grid \.fa-dev-stats-card>\.fa-dev-stats-empty\{[^}]*height:50px;min-height:0;box-sizing:border-box/);
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
  const ranks=walk(dialog).filter(n=>n.className==='fa-dev-stats-rank').map(n=>Number(n.textContent));
  assert.deepEqual(ranks.slice(0,3),[1,2,3],'recorded GD breaks equal-goals ties');
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
  assert.equal((panel.match(/<button[^>]*data-stats-view=/g)||[]).length,6,d.slug+' shell and runtime buttons');
  const [firstPaint,emptyView]=panel.split('id="fa-dev-stats"');
  assert.equal((firstPaint.match(/<button[^>]*data-stats-view=/g)||[]).length,3,d.slug+' clickable prepaint buttons');
  assert.equal((emptyView.match(/<button[^>]*data-stats-view=/g)||[]).length,3,d.slug+' runtime buttons');
  const skeleton=html.match(/<template data-competition-skeleton="stats-overview">([\s\S]*?)<\/template>/)?.[1];
  assert.ok(emptyView&&skeleton,d.slug+' has static Overview and reusable skeleton');
  assert.equal((firstPaint.match(/fa-dev-stats-card"/g)||[]).length,3,d.slug+' first-paint cards');
  assert.equal((emptyView.match(/fa-dev-stats-card"/g)||[]).length,3,d.slug+' empty Overview cards');
  assert.equal((skeleton.match(/fa-dev-stats-card"/g)||[]).length,3,d.slug+' template cards');
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
test('STATS-PLAYERS: qualified recorded contributions populate rankings without fabricated metrics',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.players=[{playerId:1,name:'Supplied Player',clubKey:'IT-1',appearances:5,starts:5,minutes:450,goals:1}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 assert.equal(byClass(r,'fa-dev-stats-leader-card').length,9);
 assert.ok(contents(r.panel).includes('450'));assert.ok(contents(r.panel).includes('Supplied Player'));
 assert.deepEqual(byClass(r,'fa-dev-stats-leader-title').map(n=>n.dataset.appI18n),['statsDevAverageRating','statsDevGoals','statsDevAssists','statsDevGoalsAssists90','statsDevCleanSheets','statsDevStartsSubstitutes','statsDevRedCards','statsDevMinutes','statsDevMvpAwards']);
 assert.equal(byClass(r,'fa-dev-stats-top')[0].children[0].children.at(-1).textContent,'1','only recorded scoring contributions qualify');
 assert.equal(r.nodes().filter(n=>n.tagName==='li').length,3);
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
 buttons(r)[2].emit('click');assert.equal(byClass(r,'fa-dev-stats-leader-card').length,9);
});

test('A03-04E2: supplied domestic and cup rankings link verified player IDs and recorded clubs',()=>{
 for(const [id,count] of [['IT-1',16],['int-1',24],['int-2',24]]){
  const calls=[],registry=Object.freeze({...routeRegistry,buildRoute(identity){calls.push(identity);return routeRegistry.buildRoute(identity)}});
  const r=fixture(registry),c=supplied(id,count);
  c.seasonData.statistics.players=[{playerId:1,name:'Supplied Player',clubKey:'IT-1',appearances:5,starts:5,minutes:450,goals:1}];
  r.api.mount(r.panel,c);buttons(r)[1].emit('click');byClass(r,'fa-dev-stats-expand')[0].emit('click');
  const links=walk(byClass(r,'fa-dev-stats-dialog')[0]).filter(n=>n.tagName==='a').map(n=>n.href).sort();
  const expected=c.seasonData.participants.map(club=>'/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview').sort();
  assert.deepEqual(links,expected,id);assert.ok(calls.length>=count);
  buttons(r)[2].emit('click');assert.equal(r.nodes().filter(n=>n.tagName==='a'&&n.href==='/players/1').length,3);
  assert.equal(byClass(r,'fa-dev-stats-club-link').length,3);
  assert.equal(byClass(r,'fa-dev-stats-club-link')[0].tagName,'a');
  assert.equal(byClass(r,'fa-dev-stats-club-link')[0].textContent,'Team 01');
  assert.ok(byClass(r,'fa-dev-stats-club-link').every(n=>n.href==='/clubs/it/1/overview'),id+' player rows and team labels navigate independently');
 }
});

test('COMP-STATS-643: numeric ID breaks equal-name ties; show all preserves ranks and recorded clubs',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.players=Array.from({length:7},(_,i)=>({
  playerId:7-i,name:'Same Name',clubKey:i===0?'IT-2':'IT-1',appearances:5,starts:5,minutes:450,goals:1
 }));
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 const first=byClass(r,'fa-dev-stats-top')[0];
 assert.deepEqual(first.children.map(n=>n.children[1].children[1].children[0].href),[1,2,3,4,5].map(id=>'/players/'+id));
 assert.deepEqual(first.children.map(n=>n.children[0].textContent),Array(5).fill('1'));
 byClass(r,'fa-dev-stats-expand')[0].emit('click');
 const dialog=byClass(r,'fa-dev-stats-dialog')[0];
 assert.equal(walk(dialog).filter(n=>n.tagName==='li').length,7);
 assert.ok(walk(dialog).some(n=>n.className==='fa-dev-stats-club-link'&&n.textContent==='Team 02'));
 const clubLinks=walk(dialog).filter(n=>n.tagName==='a'&&n.className==='fa-dev-stats-club-link');
 assert.equal(clubLinks.length,7,'Show all preserves a separate club link per player');
 assert.equal(clubLinks.filter(n=>n.href==='/clubs/it/2/overview').length,1);
 assert.equal(clubLinks.filter(n=>n.href==='/clubs/it/1/overview').length,6);
});
test('COMP-STATS-643: missing name shows numeric identity; duplicate club/player pairs and malformed metrics fail closed',()=>{
 const record={playerId:58,name:null,clubKey:'IT-1',appearances:1,starts:1,minutes:75,goals:1};
 const r=fixture(),c=supplied('int-1',24);c.seasonData.statistics.players=[record];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 assert.ok(contents(r.panel).includes('#58'));
 assert.equal(r.nodes().filter(n=>n.tagName==='a'&&n.href==='/players/58').length,2,'scorer qualifies in Goals and Starts, without duplicate links within a card');
 for(const bad of [{playerId:'58'},{playerId:0},{starts:2},{minutes:null},{goals:-1},{name:''}]){
  const f=fixture(),next=supplied('int-1',24);next.seasonData.statistics.players=[{...record,...bad}];
  f.api.mount(f.panel,next);assert.ok(contents(f.panel).includes('Statistics are unavailable.'));
 }
 const dup=fixture();c.seasonData.statistics.players=[record,record];dup.api.mount(dup.panel,c);
 assert.ok(contents(dup.panel).includes('Statistics are unavailable.'));
 // The same player may have separate frozen contribution rows after a club change.
 const changed=fixture();c.seasonData.statistics.players=[record,{...record,clubKey:'IT-2'}];changed.api.mount(changed.panel,c);
 buttons(changed)[2].emit('click');assert.equal(changed.nodes().filter(n=>n.tagName==='li').length,4,'two club-specific records qualify in Goals and Starts');
});

test('COMP-STATS-643: circular face photos use generic player paths and an honest missing-photo silhouette',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.players=[{playerId:58,name:'Recorded Player',clubKey:'IT-1',appearances:1,starts:1,minutes:90,goals:1}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 const portraits=byClass(r,'fa-dev-stats-player-portrait');assert.equal(portraits.length,3,'recorded scorer appears in Goals, Starts and Minutes');
 for(const portrait of portraits){
  assert.equal(portrait.tagName,'span');assert.equal(portrait.href,undefined);
  assert.equal(portrait.dataset.portraitState,'loading');
  const photo=portrait.children[0];assert.equal(photo.src,'/assets/players/portraits/58.webp');
  assert.equal(photo.alt,'');assert.equal(photo.loading,'lazy');
  photo.onload();assert.equal(portrait.dataset.portraitState,'ready');
  photo.onerror();assert.equal(portrait.dataset.portraitState,'missing');
 }
 assert.equal(r.nodes().filter(n=>n.dataset.clubCrest).length,0,'player cards must not display club logos');
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-dev-stats-player-portrait\{[^}]*overflow:hidden[^}]*width:48px;height:48px[^}]*border-radius:50%/);
 assert.match(css,/\.fa-dev-stats-player-portrait img\{[^}]*width:280%[^}]*height:auto[^}]*left:50%;top:0/);
});


test('COMP-STATS-643: player rows have no hover titles; metric-sized skeletons reserve name, club and value slots',()=>{
 const r=fixture(),c=supplied('IT-1',16);
 c.seasonData.statistics.players=[{playerId:58,name:'Recorded Player',clubKey:'IT-1',appearances:1,starts:1,minutes:90,goals:1}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 const labels=byClass(r,'fa-dev-stats-player-label');
 assert.ok(labels.length>=1,'at least one eligible recorded player row');
 for(const label of labels){
  assert.equal(label.children[0].title,undefined,'player link has no native hover tooltip');
  assert.equal(label.children[1].title,undefined,'club label has no native hover tooltip');
 }
 const markup=r.api.renderSkeleton('players');
 assert.equal((markup.match(/class="fa-dev-stats-player-label"/g)||[]).length,45,'five player identities per card');
 assert.equal((markup.match(/class="fa-dev-stats-club-link"/g)||[]).length,45,'club label keeps its own second row');
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.app-competition-view-skeleton \.fa-dev-stats-leader-card:not\(\.fa-dev-stats-team-card\):nth-child\(1\)\{--fa-stats-skeleton-value-width:8\.5ch\}/);
 assert.match(css,/\.app-competition-view-skeleton \.fa-dev-stats-leader-card:not\(\.fa-dev-stats-team-card\):nth-child\(5\)\{--fa-stats-skeleton-value-width:7\.5ch\}/);
 assert.match(css,/\.app-competition-view-skeleton \.fa-dev-stats-player-label \.fa-dev-stats-team-name\{[^}]*width:min\(var\(--fa-stats-skeleton-player-name\),100%\);height:1\.3em/);
 assert.match(css,/\.app-competition-view-skeleton \.fa-dev-stats-player-label \.fa-dev-stats-club-link\{[^}]*width:min\(var\(--fa-stats-skeleton-club-name\),100%\);height:1\.3em/);
 assert.deepEqual([...css.matchAll(/--fa-stats-skeleton-club-name:(\d+)ch/g)].map(match=>Number(match[1])),[11,15,13,9,14],'club skeleton widths vary deterministically by rank');
 assert.match(css,/\.app-competition-view-skeleton \.fa-dev-stats-team-card \.fa-dev-stats-team-name\{width:min\(var\(--fa-stats-skeleton-club-name\),100%\)\}/,'Teams and Players share the club-width pattern');
});

test('COMP-STATS: rating and GK clean sheets show appearances while missing metrics stay unavailable',()=>{
 const r=fixture(),c=supplied('int-1',24);
 c.seasonData.statistics.players=[{playerId:58,name:'Keeper',nationality:'ITA',clubKey:'IT-1',appearances:13,starts:10,subAppearances:3,minutes:900,goals:0,assists:null,cleanSheets:6,redCards:null,averageRating:7.25,ratedAppearances:5}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 const cards=byClass(r,'fa-dev-stats-leader-card');
 assert.equal(cards[0].children[1].children[0].children.at(-1).textContent,'7.3 (5)');
 assert.equal(cards[4].children[1].children[0].children.at(-1).textContent,'6 (13)');
 assert.equal(cards[5].children[1].children[0].children.at(-1).textContent,'10 (3)');
 for(const i of [2,3,6])assert.equal(cards[i].children[1].textContent,'No players');
 assert.equal(cards[1].children[1].textContent,'No players');
 assert.ok(!byClass(r,'fa-dev-stats-leader-title').some(n=>/yellow/i.test(n.dataset.appI18n)));
});

test('COMP-STATS-643: scoring zeros and low-coverage ratings do not enter rankings',()=>{
 for(const [competition,capacity,minRated] of [['IT-1',16,5],['int-1',24,3]]){
  const r=fixture(),c=supplied(competition,capacity);
  c.seasonData.statistics.teams.find(team=>team.clubKey==='IT-1').mp=competition==='IT-1'?10:6;
  c.seasonData.statistics.players=[
   {playerId:1,name:'One Match',clubKey:'IT-1',appearances:1,starts:1,minutes:90,goals:0,assists:0,redCards:0,cleanSheets:0,averageRating:9.9,ratedAppearances:1,goalsAssistsPer90:0},
   {playerId:2,name:'Qualified',clubKey:'IT-1',appearances:minRated,starts:minRated,minutes:90*minRated,goals:2,assists:1,redCards:1,cleanSheets:1,averageRating:7.25,ratedAppearances:minRated,goalsAssistsPer90:0.6}
  ];
  r.api.mount(r.panel,c);buttons(r)[2].emit('click');
  const cards=byClass(r,'fa-dev-stats-leader-card');
  assert.equal(cards.length,9);
  for(let i=0;i<8;i++){
   const list=cards[i].children[1];
   assert.equal(list.tagName,'ol',competition+' category '+i);
   assert.equal(list.children.length,1);
   assert.ok(contents(list).includes('Qualified'));
   assert.ok(!contents(list).includes('One Match'));
  }
  assert.equal(byClass(r,'fa-dev-stats-expand-placeholder').length,9);
  assert.equal(r.nodes().filter(n=>n.tagName==='a'&&n.href==='/players/2').length,8);
  assert.equal(r.nodes().filter(n=>n.tagName==='a'&&n.href==='/clubs/it/1/overview').length,8,'every qualified player leaderboard row links its recorded club');
 }
});
test('COMP-STATS-643: empty player cards and first-paint Overview skeleton preserve metric geometry',()=>{
 const r=fixture(),c=supplied('IT-1',16);r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 assert.equal(byClass(r,'fa-dev-stats-expand-placeholder').length,9);
 assert.equal(byClass(r,'fa-dev-stats-empty').length,9);
 assert.ok(byClass(r,'fa-dev-stats-empty').every(n=>n.textContent==='No players'));
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-dev-stats-player-label\{display:grid;grid-template-rows:1\.3em 1\.3em/);
 assert.match(css,/calc\(var\(--fa-stats-row-height\)\*5\) 36px/);
 for(const width of ['3ch','4ch','4.5ch'])assert.ok(css.includes('width:'+width));
 assert.equal((r.api.renderSkeleton('overview').match(/app-competition-stat-value/g)||[]).length,3);
});

test('COMP-STATS-643: percentages use each recorded club own played matches and update with season revision',()=>{
 for(const [competition,capacity] of [['IT-1',16],['int-1',24]]){
  const r=fixture(),c=supplied(competition,capacity);
  c.seasonData.statistics.teams.find(team=>team.clubKey==='IT-1').mp=10;
  c.seasonData.statistics.teams.find(team=>team.clubKey==='IT-2').mp=4;
  const short={playerId:101,name:'Four of ten',clubKey:'IT-1',appearances:4,starts:4,minutes:359,goals:1,assists:1,redCards:1,cleanSheets:1,averageRating:9.7,ratedAppearances:4,goalsAssistsPer90:0.50};
  const qualified={playerId:102,name:'Five of ten',clubKey:'IT-1',appearances:5,starts:5,minutes:450,goals:2,assists:1,redCards:1,cleanSheets:1,averageRating:7.1,ratedAppearances:5,goalsAssistsPer90:0.6};
  const other={playerId:103,name:'Two of four',clubKey:'IT-2',appearances:2,starts:2,minutes:180,goals:1,assists:1,redCards:1,cleanSheets:1,averageRating:7.2,ratedAppearances:2,goalsAssistsPer90:1};
  c.seasonData.statistics.players=[short,qualified,other];
  const mounted=r.api.mount(r.panel,c);buttons(r)[2].emit('click');
  const cards=byClass(r,'fa-dev-stats-leader-card');
  const names=index=>contents(cards[index].children[1]);
  for(const index of [0,4,5,7]){
   assert.ok(!names(index).includes('Four of ten'),competition+' category '+index+' below 50%');
   assert.ok(names(index).includes('Five of ten')&&names(index).includes('Two of four'),competition+' thresholds follow club games');
  }
  for(const index of [1,2,6])assert.ok(names(index).includes('Four of ten'),'event counts stay at one');
  assert.ok(!names(3).includes('Four of ten'),'per-90 minutes require 40% of club games');
  assert.ok(names(3).includes('Two of four'),'per-90 minutes scale with club coverage');
  const next=structuredClone(c.seasonData);
  next.statistics.teams.find(team=>team.clubKey==='IT-1').mp=12;
  mounted.update({...c,revision:2,seasonData:next});
  const later=byClass(r,'fa-dev-stats-leader-card');
  assert.ok(!contents(later[0].children[1]).includes('Five of ten'),'50% threshold rises as team plays');
  assert.ok(contents(later[0].children[1]).includes('Two of four'),'other club threshold is unchanged');
  assert.ok(contents(later[1].children[1]).includes('Four of ten'),'fixed one-goal requirement does not change');
 }
});

test('STATS-TIEBREAK-TEAMS: all seven cards apply first and second criteria to positions',()=>{
 const cases=[
  ['gf',{gf:4,mp:2},{gf:4,mp:4},{gf:4,mp:2,gd:4},{gf:4,mp:2,gd:2}],
  ['ga',{ga:2,mp:4},{ga:2,mp:2},{ga:2,mp:2,cs:2},{ga:2,mp:2,cs:1}],
  ['w',{w:2,mp:2},{w:2,mp:4},{w:2,mp:2,gd:4},{w:2,mp:2,gd:2}],
  ['cs',{cs:2,mp:2},{cs:2,mp:4},{cs:2,mp:2,ga:1},{cs:2,mp:2,ga:3}],
  ['ppg',{ppg:1.5,gd:4,mp:2},{ppg:1.5,gd:4,mp:4},{ppg:1.5,gd:4,mp:2,gf:5},{ppg:1.5,gd:4,mp:2,gf:3}],
  ['gd',{gd:4,mp:2},{gd:4,mp:4},{gd:4,mp:2,gf:6},{gd:4,mp:2,gf:4}],
  ['unbeatenStreak',{unbeatenStreak:3,ppg:2},{unbeatenStreak:3,ppg:1.5},{unbeatenStreak:3,ppg:2,gd:4},{unbeatenStreak:3,ppg:2,gd:2}]
 ];
 const keys=['gf','ga','w','cs','ppg','gd','unbeatenStreak'];
 for(const [key,...variants] of cases)for(let t=0;t<2;t++){
  const r=fixture(),c=supplied('IT-1',16);
  c.seasonData.statistics.teams.forEach((team,i)=>{team.mp=i<2?2:0});
  const [a,b]=variants.slice(2*t,2*t+2);
  Object.assign(c.seasonData.statistics.teams[0],{clubName:'Zulu',...a});
  Object.assign(c.seasonData.statistics.teams[1],{clubName:'Alpha',...b});
  r.api.mount(r.panel,c);buttons(r)[1].emit('click');
  const card=byClass(r,'fa-dev-stats-team-card')[keys.indexOf(key)];
  const rows=walk(card).filter(n=>n.tagName==='li');
  assert.equal(rows.length,2,key+' criterion '+t);
  assert.equal(walk(rows[0]).find(n=>n.tagName==='a').href,'/clubs/it/1/overview',key+' criterion '+t+' overrides alphabetic ordering');
  assert.deepEqual(rows.map(n=>n.children[0].textContent),['1','2'],key+' criterion '+t+' assigns distinct ranks');
 }
});

test('STATS-TIEBREAK-PLAYERS: the eight original cards use recorded player metrics, not player names',()=>{
 const base={clubKey:'IT-1',appearances:2,starts:2,subAppearances:0,minutes:180,goals:1,
  assists:1,yellowCards:1,redCards:1,cleanSheets:1,ratedAppearances:2,averageRating:7.25,goalsAssistsPer90:1};
 const cases=[
  [{ratedAppearances:2},{ratedAppearances:1}],
  [{minutes:90},{minutes:180}],
  [{minutes:90},{minutes:180}],
  [{goals:1,assists:1,minutes:180},{goals:1,assists:0,minutes:90}],
  [{appearances:1,starts:1,minutes:90,ratedAppearances:1},{appearances:2,starts:2,minutes:180}],
  [{appearances:2,starts:1,subAppearances:1,minutes:180},{appearances:1,starts:1,subAppearances:0,minutes:90,ratedAppearances:1}],
  [{yellowCards:2},{yellowCards:1}],
  [{starts:2},{starts:1,subAppearances:1}]
 ];
 for(const [i,[a,b]] of cases.entries()){
  const r=fixture(),c=supplied('IT-1',16);
  c.seasonData.statistics.players=[{...base,...a,playerId:9,name:'Zulu'},{...base,...b,playerId:8,name:'Alpha'}];
  r.api.mount(r.panel,c);buttons(r)[2].emit('click');
  const rows=walk(byClass(r,'fa-dev-stats-leader-card')[i]).filter(n=>n.tagName==='li');
  assert.equal(rows.length,2,'player card '+i);
  assert.equal(walk(rows[0]).find(n=>n.tagName==='a').href,'/players/9','player card '+i+' resolves ties before alphabetic names');
  assert.deepEqual(rows.map(n=>n.children[0].textContent),['1','2'],'player card '+i+' assigns distinct ranks');
 }
});

test('STATS-TIEBREAK: visible decimal precision, equal ranks, missing evidence, Show all',()=>{
 const prepare=(people,team=false)=>{
  const r=fixture(),c=supplied('IT-1',16);
  if(team){
   c.seasonData.statistics.teams.forEach((row,i)=>{row.mp=i<2?2:0});
   people.forEach((row,i)=>Object.assign(c.seasonData.statistics.teams[i],row));
  }else c.seasonData.statistics.players=people;
  r.api.mount(r.panel,c);buttons(r)[team?1:2].emit('click');return r;
 };
 const team=prepare([{clubName:'Zulu',ppg:1.231,gd:4},{clubName:'Alpha',ppg:1.234,gd:2}],true);
 const ppg=walk(byClass(team,'fa-dev-stats-team-card')[4]).filter(n=>n.tagName==='li');
 assert.equal(walk(ppg[0]).find(n=>n.tagName==='a').href,'/clubs/it/1/overview');
 assert.deepEqual(ppg.map(n=>n.children.at(-1).textContent),['1.23','1.23']);
 assert.deepEqual(ppg.map(n=>n.children[0].textContent),['1','2']);
 const base={clubKey:'IT-1',appearances:2,starts:2,subAppearances:0,minutes:180,goals:1,
  assists:1,redCards:0,cleanSheets:0,ratedAppearances:2,averageRating:7.25};
 const rating=prepare([{...base,playerId:9,name:'Zulu',averageRating:7.251,ratedAppearances:2},
  {...base,playerId:8,name:'Alpha',averageRating:7.254,ratedAppearances:1}]);
 const rated=walk(byClass(rating,'fa-dev-stats-leader-card')[0]).filter(n=>n.tagName==='li');
 assert.equal(walk(rated[0]).find(n=>n.tagName==='a').href,'/players/9','equal displayed rating prioritizes coverage');
 assert.deepEqual(rated.map(n=>n.children.at(-1).textContent),['7.3 (2)','7.3 (1)']);
 const rates=prepare([
  {...base,playerId:9,name:'Zulu',appearances:3,starts:3,goals:2,assists:1,minutes:271,goalsAssistsPer90:270/271},
  {...base,playerId:8,name:'Alpha',appearances:3,starts:3,goals:2,assists:1,minutes:269,goalsAssistsPer90:270/269}
 ]);
 const contrib=walk(byClass(rates,'fa-dev-stats-leader-card')[3]).filter(n=>n.tagName==='li');
 assert.equal(walk(contrib[0]).find(n=>n.tagName==='a').href,'/players/9','equal displayed contributions choose more minutes');
 assert.deepEqual(contrib.map(n=>n.children.at(-1).textContent),['1.00','1.00']);
 const incomplete=prepare([
  {...base,playerId:9,name:'Zulu',redCards:1,yellowCards:null,minutes:90},
  {...base,playerId:8,name:'Alpha',redCards:1,yellowCards:0,minutes:180}
 ]);
 const reds=walk(byClass(incomplete,'fa-dev-stats-leader-card')[6]).filter(n=>n.tagName==='li');
 assert.equal(walk(reds[0]).find(n=>n.tagName==='a').href,'/players/8','missing yellow data never counts as zero');
 const same=prepare([{...base,playerId:9,name:'Zulu'},{...base,playerId:8,name:'Alpha'}]);
 const tied=walk(byClass(same,'fa-dev-stats-leader-card')[1]).filter(n=>n.tagName==='li');
 assert.deepEqual(tied.map(n=>n.children[0].textContent),['1','1'],'identical metrics share first rank');
 assert.equal(walk(tied[0]).find(n=>n.tagName==='a').href,'/players/8','names only stabilize visual order');
 const seven=prepare(Array.from({length:7},(_,i)=>({...base,playerId:i+1,name:'Same',goals:1,minutes:90+10*i})));
 const goals=byClass(seven,'fa-dev-stats-leader-card')[1];
 assert.deepEqual(walk(goals).filter(n=>n.tagName==='li').map(n=>n.children[0].textContent),['1','2','3','4','5']);
 walk(goals).find(n=>n.className==='fa-dev-stats-expand').emit('click');
 const dialog=byClass(seven,'fa-dev-stats-dialog')[0];
 assert.deepEqual(walk(dialog).filter(n=>n.tagName==='li').map(n=>n.children[0].textContent),['1','2','3','4','5','6','7']);
 assert.deepEqual(walk(dialog).filter(n=>n.tagName==='a'&&n.href?.startsWith('/players/')).map(n=>n.href),
  [1,2,3,4,5,6,7].map(id=>'/players/'+id),'Show all mirrors top-five rankings');
});

test('COMP-STATS-643: unavailable and low-coverage metrics always show the same No players message',()=>{
 const r=fixture(),c=supplied('IT-1',16);
 c.seasonData.statistics.teams.find(team=>team.clubKey==='IT-1').mp=20;
 c.seasonData.statistics.players=[{playerId:99,name:'Recorded',clubKey:'IT-1',appearances:1,starts:1,minutes:90,goals:0,assists:null,redCards:null,cleanSheets:null,averageRating:9.0,ratedAppearances:1,goalsAssistsPer90:null}];
 r.api.mount(r.panel,c);buttons(r)[2].emit('click');
 assert.equal(byClass(r,'fa-dev-stats-empty').length,9);
 assert.ok(byClass(r,'fa-dev-stats-empty').every(el=>el.dataset.appI18n==='statsDevNoPlayerData'&&el.textContent==='No players'));
 const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-dev-stats-leader-grid\{--fa-stats-row-height:60px/);
 assert.match(css,/@media\(max-width:620px\)\{\.fa-dev-stats-leader-grid\{--fa-stats-row-height:52px\}/);
 assert.match(css,/\.fa-dev-stats-leader-card>\.fa-dev-stats-empty\{[^}]*height:calc\(var\(--fa-stats-row-height\)\*5\);min-height:0;box-sizing:border-box/);
});
