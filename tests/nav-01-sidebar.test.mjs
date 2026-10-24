import {runInNewContext} from 'node:vm';
import routeRegistry from '../assets/routes-registry.js';
// NAV-01: canonical navigation regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSubpage} from '../assets/subpage-routes.mjs';
import {publicRequestFile} from '../tools/publication-guard.mjs';
const directory=readFileSync(new URL('../assets/clubs-directory.js',import.meta.url),'utf8');
const sidebar=readFileSync(new URL('../assets/sidebar-evolution.js',import.meta.url),'utf8');
test('NAV-01B directory links use canonical country/id/overview paths',()=>{
 const m=JSON.parse(readFileSync(new URL('../clubs/_shared/manifest.json',import.meta.url),'utf8'));
 const start=directory.indexOf('function paint(){'),end=directory.indexOf('// Warm the same crest URL',start);
 assert.ok(start>=0&&end>start,'Actual directory paint function must be available');
 const header={},out={innerHTML:'',querySelectorAll:()=>[]},input={value:'',setAttribute(){}},count={};
 const select=options=>({value:'',options,get selectedOptions(){return [options[0]]},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]}});
 const selects=[select([{textContent:''}]),select([{textContent:''},{textContent:''},{textContent:''}])];
 const filters=selects.map(select=>({trigger:{setAttribute(){}},value:{},options:select.options.map(()=>({})),binding:{sync(){}}}));
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 runInNewContext(directory.slice(start,end)+';paint()',{
  m,input,selects,out,count,filters,safe,indexed:new Map(),dm:new Map(m.divisions.map(d=>[d.id,d])),
  tr:()=>['Search','All countries','All divisions','','','','Clubs','clubs','No clubs found'],
  filterLabels:{en:['Country','Division']},countryNames:{en:[]},codes:[],tierNames:{en:['First','Second']},normalizeSearch:v=>v,
  root:{querySelector:()=>header},document:{documentElement:{lang:'en'}},window:{faRoutesRegistry:routeRegistry}
 });
 const hrefs=[...out.innerHTML.matchAll(/class="nav01-card" href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(hrefs.length,320);
 assert.deepEqual([...hrefs].sort(),m.clubs.map(c=>'/clubs/'+c.countryId.toLowerCase()+'/'+c.clubId+'/overview').sort());
 for(const href of hrefs){const route=resolveSubpage(href);assert.equal(route?.kind,'club');assert.equal(route?.redirect,false);assert.equal(publicRequestFile(href),'clubs/_shared/index.html');}
});
test('NAV-01A sidebar keeps five language keys and accessible expansion',()=>{
 for(const code of ['en','de','es','fr','it'])assert.ok(sidebar.includes(code+':['));
 assert.ok(sidebar.includes("button.addEventListener('click'"));
 assert.ok(sidebar.includes('aria-expanded'));
 assert.ok(sidebar.includes('sessionStorage'));
});

test('NAV-01C localized accessible controls in five languages',()=>{
 for(const code of ['en','de','es','fr','it']){
  assert.ok(sidebar.includes(code+':'));
  assert.ok(directory.includes(code+':'));
 }
 assert.ok(sidebar.includes('expandLabels'));
 assert.ok(sidebar.includes('collapseLabels'));
 assert.ok(directory.includes("setAttribute('aria-label',filterLabels"));
});

test('NAV-01C public server resolves the extensionless directory route',()=>{
 assert.equal(publicRequestFile('/clubs'),'clubs/index.html');
 assert.equal(publicRequestFile('/clubs/'),'clubs/index.html');
});

test('NAV-01 first paint ships complete navigation before deferred scripts',()=>{
 for(const file of ['dashboard/index.html','calendar/index.html','settings/index.html','competitions/index.html','competitions/_shared/index.html','clubs/index.html','clubs/_shared/index.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const nav=html.slice(html.indexOf('<nav class="fa-shell-nav"'),html.indexOf('</nav>'));
  for(const href of ['/clubs','/guide','/competitions#domestic','/competitions#international'])assert.ok(nav.includes('href="'+href+'"'),file+' lacks initial '+href);
  assert.match(nav,/aria-expanded="false"[^>]*aria-controls="nav01-children"/);
  assert.ok(html.indexOf('<script data-nav01-bootstrap>')>html.indexOf('</nav>'));
  assert.ok(html.indexOf('<script data-nav01-bootstrap>')<html.indexOf('<main'));
 }
});

test('NAV-01 World and Explore labels and submenu icons are present in initial HTML',()=>{
 const html=readFileSync(new URL('../competitions/index.html',import.meta.url),'utf8');
 const nav=html.slice(html.indexOf('<nav class="fa-shell-nav"'),html.indexOf('</nav>'));
 assert.match(nav,/data-nav01="0">World/);
 assert.match(nav,/data-nav01="6">Competitions/);
 assert.match(nav,/data-nav01="3">Explore/);
 for(const hash of ['domestic','international'])assert.match(nav,new RegExp('href="/competitions#'+hash+'"[^>]*><svg[^>]+aria-hidden="true"'));
 assert.ok(!nav.includes('data-app-i18n="navCompetitions"'),'Sidebar World label must not be overwritten by the Competitions page dictionary');
});

test('NAV-01 fragments are aligned before revealing the central pane',()=>{
 const html=readFileSync(new URL('../competitions/index.html',import.meta.url),'utf8');
 for(const id of ['domestic','international'])assert.match(html,new RegExp('<section id="'+id+'"[^>]+aria-labelledby="'+id+'-heading"'));
 assert.match(html,/id="domestic-heading" data-nav01-section="1">Domestic/);
 assert.match(html,/id="international-heading" data-nav01-section="2">International/);
 assert.ok(html.indexOf('data-nav01-fragment-state')<html.indexOf('<body'));
 assert.ok(html.indexOf('data-nav01-fragment-align')>html.indexOf('</main>'));
});


test('Site chevrons and Clubs filters are present in initial HTML',()=>{
 const html=readFileSync(new URL('../clubs/index.html',import.meta.url),'utf8');
 assert.match(html,/<button[^>]+class="nav01-expand"[^>]*><svg/);
 for(const name of ['country','division']){
  assert.match(html,new RegExp('id="nav01-'+name+'-trigger"[^>]+role="combobox"'));
  assert.match(html,new RegExp('id="nav01-'+name+'-menu"[^>]+role="listbox"'));
 }
 assert.ok(html.indexOf('/assets/competition-tabs.js')<html.indexOf('/assets/clubs-directory.js'));
});
