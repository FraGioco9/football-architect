import {loadSeasonOnePreview} from '../tools/load-season-one-preview.mjs';
import test from 'node:test';
import {runInNewContext as vmRunInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {request} from 'node:http';
import {clubViews,clubSubpage} from '../assets/subpage-routes.mjs';
import {publicRequestFile,isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clubs=JSON.parse(read('data/clubs.json'));

test('CLUB-01 all 320 identities and 1600 subpages resolve to one public template',()=>{
 for(const c of clubs)for(const view of clubViews){
  const path=clubSubpage(c.countryId.toLowerCase(),String(c.clubId),view);
  assert.equal(publicRequestFile(path),'clubs/_shared/index.html');
  assert.ok(isAllowlistedPublicPath(publicRequestFile(path)));
 }
 for(const path of ['/clubs/xx/1/overview','/clubs/it/0/overview','/clubs/it/41/overview','/clubs/it/01/overview','/clubs/it/1/unknown','/app/clubs/it/1/overview'])
  assert.equal(isAllowlistedPublicPath(publicRequestFile(path)),false,path);
});
test('PAGE-LOAD-04 B01: the synchronous club shell has tabs, static labels and anonymous values only',()=>{
 const html=read('clubs/_shared/index.html'),manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const script=html.match(/<script data-fa-club-first-paint>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'synchronous route-only bootstrap');
 assert.ok(script.includes("dataset.clubShellReady='true'"));
 assert.ok(!script.includes('clubIdentityReady'),'identity must only be ready after the manifest');
 assert.ok(html.includes('class="club-fp-bar club-fp-header-name"'));
 assert.ok(html.includes('class="club-fp-bar club-fp-header-location"'));
 for(const view of clubViews)assert.ok(html.includes('data-club-first-paint-tab="'+view+'"'),view);
 assert.equal((html.match(/data-club-first-paint-tab="/g)||[]).length,5);
 for(const field of ['nameLabel','country','city','abbr','nickname','stadium'])assert.ok(html.includes('data-club-first-paint-label="'+field+'"'));
 for(const value of ['nameLabel','country','city'])assert.ok(html.includes('data-club-first-paint-value="'+value+'"><span class="club-fp-bar"'));
 assert.equal(manifest.clubs.length,320);
 assert.ok(!script.includes('const identities='));
 assert.ok(!script.includes('crestAssets'));
 for(const c of manifest.clubs)assert.ok(!html.includes(c.fullName),'no preloaded club identity: '+c.countryId+'-'+c.clubId);
 assert.ok(html.includes('club-first-paint-panel" aria-busy="true"'),'preserved overview structure');
 assert.ok(brotliCompressSync(html).length<50000,'first-paint HTML compressed-size budget');
});
test('CLUB-01 derived manifest preserves canonical fields and provisional placement',()=>{
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const descriptions=JSON.parse(read('data/club-descriptions.i18n.json'));
 const allocations=loadSeasonOnePreview();
 assert.equal(manifest.clubs.length,320);
 assert.equal(manifest.approved,false);
 for(const c of clubs){
  const derived=manifest.clubs.find(d=>d.countryId===c.countryId&&d.clubId===c.clubId);
  for(const [key,value] of Object.entries(c))assert.deepEqual(derived[key],value,key);
  const native={DE:'de',ENG:'en',ES:'es',FR:'fr',IT:'it',PT:'pt',NL:'nl',BR:'pt'}[c.countryId];
  assert.deepEqual(derived.descriptions,{...descriptions[c.countryId][c.clubId],[native]:c.description});
  const allocation=allocations.allocations.find(a=>a.divisionId.startsWith(c.countryId+'-')&&a.clubIds.includes(c.clubId));
  assert.equal(derived.divisionId,allocation?.divisionId??null);
 }
 assert.equal(manifest.clubs.filter(c=>c.divisionId===null).length,64);
});
test('CLUB-01 DEV redirects legacy URLs and serves all club views with shared Debug Settings and the DEV summary',async()=>{
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=path=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
   let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,location:res.headers.location,body}));
  });req.on('error',reject);req.end();
 });
 try{
  const entrypoint=await get('/__fa_dev__/debug-settings.mjs');
  assert.equal(entrypoint.status,200);
  const config=await get('/__fa_dev__/dev-debug-config.mjs');
  assert.equal(config.status,200);assert.equal(config.body,read('tools/dev-debug-config.mjs'));
  assert.match(entrypoint.body,/import "\.\/standings-client\.mjs"/);
  for(const c of clubs){
   const base='/clubs/'+c.countryId.toLowerCase()+'/'+String(c.clubId);
   assert.equal((await get(base)).location,base+'/overview');
   for(const view of clubViews){
    const page=await get(base+'/'+view);assert.equal(page.status,200);
    assert.match(page.body,/data-fa-dev-club-summary/);
    assert.match(page.body,/__fa_dev__\/debug-settings\.mjs/);
    assert.doesNotMatch(page.body,/data-fa-dev-preview|standings-client/);
   }
  }
  for(const [path,target] of [
   ['/clubs/it/1/?view=stats&season=2&matchday=7','/clubs/it/1/stats?season=2&matchday=7'],
   ['/clubs/it/1/index.html?view=fixtures&season=3','/clubs/it/1/fixtures?season=3'],
   ['/clubs/it/1/overview?season=2&matchday=5','/clubs/it/1/overview'],
   ['/clubs/it/1/history/?season=3','/clubs/it/1/history'],
   ['/clubs/br/40/stats/?season=2','/clubs/br/40/stats?season=2']]){
    const page=await get(path);assert.equal(page.status,308);assert.equal(page.location,target);
  }
  for(const path of ['/clubs/it/41/overview','/clubs/it/1/wrong','/clubs/it/01','/app/clubs/it/1'])assert.equal((await get(path)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('CLUB-01 generation is deterministic and canonical inputs are unchanged',()=>{
 const paths=['data/clubs.json','data/divisions.json','backend/catalogues/season-1.participants.json','data/club-descriptions.i18n.json'];
 const fingerprint=()=>paths.map(path=>createHash('sha256').update(read(path)).digest('hex'));
 const before=fingerprint();
 execFileSync(process.execPath,['tools/generate-app-pages.mjs','--check']);
 assert.deepEqual(fingerprint(),before);
});

test('CLUB-01 presentation uses every canonical identity in all five languages',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 for(const c of manifest.clubs)for(const lang of ['en','de','es','fr','it']){
  const base='/clubs/'+c.countryId.toLowerCase()+'/'+String(c.clubId);
  for(const view of clubViews){
   const selected=model.route(base+'/'+view),html=model.render(manifest,selected,lang,'?season=2&matchday=7');
   assert.ok(html.includes('aria-current="page"'));
   assert.equal((html.match(/class="app-competition-tab(?: |")/g)||[]).length,view==='roster'?10:5);
   assert.equal((html.match(/class="app-competition-tabs club-tabs"/g)||[]).length,1);
   assert.ok(html.includes(base+'/roster"'));
   assert.ok(html.includes(model.copies[lang][view]));
   assert.ok(html.includes(base+'/overview"'));
   assert.ok(html.includes(base+'/history"'));
   assert.ok(html.includes(base+'/fixtures?season=2&matchday=7'));
   if(view==='overview'){
    for(const field of ['abbr','primaryColor','secondaryColor'])assert.ok(html.includes(c[field]));
    if(c.divisionId){assert.ok(html.includes('/competitions/'+c.divisionId.toLowerCase()+'/standings'));assert.equal((html.match(/data-club-division-link/g)||[]).length,1,'Only one division link in Competitions');assert.doesNotMatch(html,/club-header-division/);}
    else assert.ok(html.includes(model.copies[lang].outside));
   }else assert.ok(html.includes(view==='history'?'club-history-row-loading':view==='fixtures'?'club-fixtures':view==='roster'?'club-roster':'club-empty'));
   // Roster uses a canonical direct Info subview; only /app/ links are invalid.
   assert.doesNotMatch(html,/href="\/app\//);
  }
 }
 const poisoned={...manifest,clubs:manifest.clubs.map((c,i)=>i?c:{...c,primaryName:'<script>alert(1)</script>'})};
 const c=poisoned.clubs[0];
 assert.doesNotMatch(model.render(poisoned,model.route('/clubs/'+c.countryId.toLowerCase()+'/1/overview')),/<script>/);
});

test('CLUB-01 public rewrites cover exactly the declared IDs and five subpages',()=>{
 const config=JSON.parse(read('vercel.json'));
 const rule=config.rewrites.find(r=>r.destination==='/clubs/_shared/index.html');
 assert.ok(rule);
 const pattern=rule.source.replace(':country(it|eng|es|de|fr|pt|nl|br)','(?<country>it|eng|es|de|fr|pt|nl|br)')
  .replace(':club([1-9]|[1-3][0-9]|40)','(?<club>[1-9]|[1-3][0-9]|40)')
  .replace(':view(overview|roster|fixtures|stats|history)','(?<view>overview|roster|fixtures|stats|history)');
 const regex=new RegExp('^'+pattern+'$');
 for(const c of clubs)for(const view of clubViews)assert.ok(regex.test(clubSubpage(c.countryId.toLowerCase(),String(c.clubId),view)));
 for(const path of ['/clubs/it/01/overview','/clubs/it/41/overview','/clubs/it/1/wrong','/clubs/xx/1/overview','/clubs/it/1/overview/'])assert.equal(regex.test(path),false);
});

test('CLUB-01 public legacy redirects converge for all 320 clubs',()=>{
 const {redirects}=JSON.parse(read('vercel.json'));
 const compile=source=>new RegExp('^'+source
  .replace(':country(it|eng|es|de|fr|pt|nl|br)','(?<country>it|eng|es|de|fr|pt|nl|br)')
  .replace(':club([1-9]|[1-3][0-9]|40)','(?<club>[1-9]|[1-3][0-9]|40)')
  .replace(':view(overview|roster|fixtures|stats|history)','(?<view>overview|roster|fixtures|stats|history)')+'$');
 const clubRules=redirects.filter(r=>r.source.startsWith('/clubs/')).map(rule=>({...rule,regex:compile(rule.source)}));
 const target=(path,view=null)=>{
  for(const rule of clubRules){
   const match=rule.regex.exec(path);
   if(match&&(!rule.has||rule.has.every(h=>h.type==='query'&&h.key==='view'&&h.value===view))){
    assert.equal(rule.permanent,true);
    return rule.destination.replace(/:(country|club|view)/g,(_,key)=>match.groups[key]);
   }
  }
  return null;
 };
 for(const c of clubs){
  const base='/clubs/'+c.countryId.toLowerCase()+'/'+String(c.clubId);
  for(const suffix of ['','/','/index.html']){
   assert.equal(target(base+suffix),base+'/overview');
   for(const view of clubViews)assert.equal(target(base+suffix,view),base+'/'+view);
  }
  for(const view of clubViews){
   assert.equal(target(base+'/'+view+'/'),base+'/'+view);
   assert.equal(target(base+'/'+view+'/index.html'),base+'/'+view);
   assert.equal(target(base+'/'+view),null,'Canonical paths must not redirect again');
  }
 }
});

test('CLUB-ID-01 CSV/JSON identities and rivalry references use unpadded canonical IDs',()=>{
 const registry=read('data/clubs-registry.csv').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const rivalries=JSON.parse(read('data/club-rivalries.json'));
 const rivalryCsv=read('data/club-rivalries.csv').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const ids=new Set(clubs.map(c=>c.countryId+'-'+c.clubId));
 assert.equal(clubs.length,320);
 assert.equal(registry.length,321);
 for(const club of clubs)assert.ok(Number.isInteger(club.clubId)&&club.clubId>=1&&club.clubId<=40);
 for(const line of registry.slice(1))assert.match(line,/^(?:IT|ENG|ES|DE|FR|PT|NL|BR),(?:[1-9]|[1-3][0-9]|40),/);
 assert.equal(rivalries.length,352);
 assert.equal(rivalryCsv.length,353);
 for(const rivalry of rivalries){
  assert.ok(ids.has(rivalry.clubAId));assert.ok(ids.has(rivalry.clubBId));
  assert.equal(rivalry.rivalryId,rivalry.clubAId+'__'+rivalry.clubBId);
  assert.doesNotMatch(rivalry.rivalryId,/(?:^|-)0[1-9](?:_|$)/);
 }
 assert.deepEqual(rivalryCsv.slice(1).map(line=>line.split(',').slice(0,2)),rivalries.map(r=>[r.rivalryId,r.clubAId]));
});

test('CLUB-OVERVIEW-02: all 320 clubs expose original descriptions, translations, rivalries and kits reserve',()=>{
 const {runInNewContext}=requireVm();
 const sandbox={faRoutesRegistry:routeRegistry,module:{exports:{}},URLSearchParams};
 runInNewContext(read('assets/club-model.js'),sandbox);
 const model=sandbox.module.exports;
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 assert.equal(manifest.rivalries.length,352);
 for(const c of manifest.clubs){
  const selected=model.route('/clubs/'+c.countryId.toLowerCase()+'/'+c.clubId+'/overview');
  assert.ok(selected);
  const html=model.render(manifest,selected,'it');
  assert.match(html,/club-overview-layout/);
  assert.match(html,/club-kits/);
  assert.match(html,/club-rivalries/);
  assert.match(html,/data-original-description=/);
  assert.ok(html.includes(c.primaryName.replaceAll('&','&amp;')),'Canonical name not rendered');
  const native={IT:'it',ENG:'en',ES:'es',DE:'de',FR:'fr',PT:'pt',BR:'pt',NL:'nl'}[c.countryId];
  assert.equal(html.includes('data-translate-club'),native!=='it');
  assert.ok(c.description.trim());
  for(const lang of ['en','de','es','fr','it'])assert.ok(c.descriptions[lang]?.trim());
 }
});
function requireVm(){return {runInNewContext:vmRunInNewContext}}


test('CLUB-FLAGS-54: all countries reuse the competition SVG with independent clip IDs',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 assert.equal(Object.keys(manifest.countryFlags||{}).length,8);
 for(const country of ['IT','ENG','ES','DE','FR','PT','NL','BR']){
  const source=manifest.countryFlags[country];
  assert.match(source,/viewBox="0 0 5 4"/);
  const club=manifest.clubs.find(c=>c.countryId===country);
  const html=model.render(manifest,model.route(`/clubs/${country.toLowerCase()}/${club.clubId}/overview`));
  assert.equal((html.match(/class="app-world-flag club-country-flag"/g)||[]).length,2);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'Header and identity flags need independent SVG IDs');
  assert.doesNotMatch(html,/<img[^>]+assets\/flags\//);
  assert.doesNotMatch(html,/ns1:href=/);
  for(const [,target] of html.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert.ok(ids.includes(target),'Unresolved SVG fragment '+target);
 }
});


test('CLUB-COMPETITION-02: active cards show localized metrics and inactive cards have one message',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const labels={en:'Status',de:'Status',es:'Estado',fr:'Statut',it:'Stato'};
 for(const c of manifest.clubs)for(const [lang,label] of Object.entries(labels)){
  const html=model.render(manifest,model.route(`/clubs/${c.countryId.toLowerCase()}/${c.clubId}/overview`),lang);
  const box=html.match(/<section class="app-panel club-competition"[\s\S]*?<\/section>/)?.[0];
  assert.ok(box,'Every Overview has the competition panel');
  if(c.divisionId){
   assert.ok(box.includes('<dt>'+label+'</dt>'));
   assert.match(box,/data-club-position>—</);
   assert.doesNotMatch(box,/data-club-points/);
   assert.ok(box.includes('href="/competitions/'+c.divisionId.toLowerCase()+'/standings"'));
   assert.equal((box.match(/class="club-competition-logo"/g)||[]).length,1);
   assert.ok(!box.includes(model.copies[lang].provisional));
  }else{
   assert.equal(box.split(model.copies[lang].outside).length-1,1,'Inactive clubs show one status message');
   assert.doesNotMatch(box,/<img|<a |club-competition-layout|club-competition-status/);
  }
 }
});

const a03Baseline=JSON.parse(read('tests/fixtures/a03-browser-routes.json'));
test('A03-04C: club parser retains strict canonical acceptance and caller-facing shape',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 for(const row of a03Baseline.clubParser)assert.deepEqual(model.route(row.input),row.expected,row.input);
});
test('A03-04C: active and inactive club tabs transfer only temporal context to Fixtures and Stats',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 for(const path of ['/clubs/it/1/overview','/clubs/br/40/overview']){
  const selected=model.route(path);
  const html=model.render(manifest,selected,'en','?view=history&season=3&matchday=7&x=1');
  const nav=html.match(/<nav class="app-competition-tabs club-tabs"[^>]*>(.*?)<\/nav>/)[1];
  const hrefs=[...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
  assert.deepEqual(hrefs,[selected.base+'/overview',selected.base+'/roster',selected.base+'/fixtures?season=3&matchday=7',selected.base+'/stats?season=3&matchday=7',selected.base+'/history']);
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
  if(path.includes('/40/'))assert.doesNotMatch(html,/href="\/competitions\//,'Unallocated club cannot invent a competition link');
  else assert.ok(html.includes('href="/competitions/it-1/standings?season=3"'));
 }
});

import routeRegistry from '../assets/routes-registry.js';
test('A03-04E: club parser and rendered links delegate to the real shared registry',()=>{
 const calls=[];
 const registry=Object.freeze({...routeRegistry,
  parseRoute(path){calls.push(['parse',path]);return routeRegistry.parseRoute(path)},
  buildRoute(identity){calls.push(['build',identity.kind]);return routeRegistry.buildRoute(identity)}});
 const sandbox={faRoutesRegistry:registry,module:{exports:{}},URLSearchParams};
 vmRunInNewContext(read('assets/club-model.js'),sandbox);
 const model=sandbox.module.exports,selected=model.route('/clubs/it/1/overview');
 assert.equal(model.route('/clubs/it/1'),null,'Registry redirect candidates remain rejected by the club caller');
 assert.equal(model.route('/clubs/it/1/overview/'),null);
 const html=model.render(JSON.parse(read('clubs/_shared/manifest.json')),selected,'en','?season=3&matchday=7');
 assert.ok(html.includes('href="/clubs/it/1/fixtures?season=3&matchday=7"'));
 assert.ok(html.includes('href="/competitions/it-1/standings?season=3"'));
 assert.ok(calls.some(([kind,path])=>kind==='parse'&&path==='/clubs/it/1/overview'));
 assert.ok(calls.some(([kind,family])=>kind==='build'&&family==='club'));
 assert.ok(calls.some(([kind,family])=>kind==='build'&&family==='competition'));
});

test('A03-04E: all 1600 strict club routes retain canonical caller shapes',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 for(const country of ['it','eng','es','de','fr','pt','nl','br'])for(let id=1;id<=40;id++)for(const view of ['overview','roster','fixtures','stats','history']){
  const base='/clubs/'+country+'/'+id,path=base+'/'+view;
  assert.deepEqual(model.route(path),{countryId:country.toUpperCase(),clubId:id,view,base});
  assert.equal(model.route(path+'/'),null,'Caller must not accept a redirect candidate: '+path);
 }
 assert.throws(()=>model.route(null),TypeError);
});

test('A01-10 memoized renderer retains all 320 club identities and per-manifest isolation',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 for(const club of manifest.clubs){const selected=model.route('/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview');const html=model.render(manifest,selected,'en');assert.equal(model.render(manifest,selected,'en'),html);assert.ok(html.includes('data-club-crest="'+club.countryId+'-'+club.clubId+'"'));}
 const club=manifest.clubs[0],selected=model.route('/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview');
 const changed={...manifest,clubs:manifest.clubs.map((c,i)=>i===0?{...c,fullName:'A01-10 alternate name'}:c)};
 assert.ok(model.render(changed,selected).includes('A01-10 alternate name'));
 assert.ok(!model.render(manifest,selected).includes('A01-10 alternate name'));
});

test('PAGE-LOAD-04 B02: club directory displays 16 anonymous card skeletons before catalog hydration',()=>{
 const html=read('clubs/index.html'),manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 assert.equal(manifest.clubs.length,320);
 assert.equal((html.match(/class="nav01-card nav01-skeleton-card"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-crest nav01-skeleton-crest"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-skeleton-crest-disc"/g)||[]).length,16,'one explicit crest circle per anonymous card');
 assert.equal((html.match(/class="nav01-skeleton-name"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-skeleton-bar nav01-skeleton-name-bar"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-club-location nav01-skeleton-location"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-skeleton-bar nav01-skeleton-flag"/g)||[]).length,16);
 assert.equal((html.match(/class="nav01-skeleton-bar nav01-skeleton-city"/g)||[]).length,16);
 assert.match(html,/class="nav01-skeleton-bar nav01-skeleton-count"/);
 assert.doesNotMatch(html,/data-nav01-filter-first-paint|data-nav01-loading-first-paint/);
 assert.doesNotMatch(html,/data-search="|<a class="nav01-card"/,'no catalog search keys or links until the manifest loads');
 assert.ok(html.includes('data-nav01-search-first-paint'),'static search input remains');
 assert.ok(html.includes('class="nav01-flag-sprite"'),'static flag definitions remain available');
 for(const c of manifest.clubs)assert.ok(!html.includes(c.fullName),'no pre-rendered club data: '+c.countryId+'-'+c.clubId);
});
test('PAGE-LOAD-04 B02: directory only paints one crest skeleton and visible name/flag/city bars',()=>{
 const css=read('assets/clubs-directory.css'),html=read('clubs/index.html'),source=read('tools/generate-app-pages.mjs');
 assert.match(css,/\.nav01-card\.nav01-skeleton-card>\.nav01-skeleton-crest::before,/);
 assert.match(css,/\.nav01-card\.nav01-skeleton-card>\.nav01-skeleton-crest::after\{content:none;display:none\}/);
 assert.match(css,/\.nav01-skeleton-crest-disc\{display:block;[^}]*border-radius:50%;background:/);
 assert.match(css,/\.nav01-card\.nav01-skeleton-card \.nav01-skeleton-bar\{display:block;[^}]*background:/);
 assert.match(css,/\.nav01-card\.nav01-skeleton-card>\.nav01-skeleton-copy\{display:block;/);
 assert.ok(source.includes('nav01-skeleton-crest-disc'),'generator owns the checked-in HTML shape');
 assert.match(html,/<strong class="nav01-skeleton-name"><span class="nav01-skeleton-bar nav01-skeleton-name-bar"><\/span><\/strong>/,'name skeleton reserves the actual strong line box');
 assert.match(html,/<small class="nav01-club-location nav01-skeleton-location">/,'flag/city skeleton reuses the actual small metadata row');
 assert.match(css,/\.nav01-card\.nav01-skeleton-card \.nav01-skeleton-name\{display:flex;align-items:center;min-height:1\.35em/);
 assert.match(css,/\.nav01-card\.nav01-skeleton-card \.nav01-skeleton-location\{display:flex;align-items:center;gap:8px;min-height:1\.6em;line-height:1\.6;margin-top:9px/);
 assert.match(css,/\.nav01-card\.nav01-skeleton-card \.nav01-skeleton-city\{width:clamp\(38px,30%,72px\);max-width:72px;/,'short city bar, never longer than 72px');
 assert.equal((html.match(/class="nav01-skeleton-crest-disc"/g)||[]).length,16);
 for(const cls of ['nav01-skeleton-name-bar','nav01-skeleton-flag','nav01-skeleton-city'])
  assert.equal((html.match(new RegExp('class="nav01-skeleton-bar '+cls+'"','g'))||[]).length,16,cls);
});
test('CLUBS-CREST: first-paint and image-pending logos use the same circular skeleton',()=>{
 const css=read('assets/clubs-directory.css');
 const shared=css.match(/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before,\s*\.nav01-skeleton-crest-disc\{([^}]+)\}/)?.[1];
 assert.ok(shared,'one CSS rule must style both crest loading phases');
 for(const declaration of ['width:85%','aspect-ratio:1','border-radius:50%','background:var(--fa-crest-skeleton-fill)','opacity:1'])
  assert.ok(shared.includes(declaration),'shared crest skeleton missing '+declaration);
 assert.match(css,/\.nav01-crest\[data-club-crest-loaded="true"\]::before\{display:none\}/,'loaded crest must hide skeleton');
 assert.match(css,/\.nav01-card\.nav01-skeleton-card>\.nav01-skeleton-crest::after\{content:none;display:none\}/,'anonymous cards must not draw a second layer');
});
test('CLUBS-CREST: shield fallback is only shown for absent or failed crest assets',()=>{
 const css=read('assets/clubs-directory.css'),js=read('assets/clubs-directory.js');
 assert.match(css,/\.nav01-crest::before\{content:"";position:absolute;display:none\}/,
  'default crest slot must not show a shield while the SVG is being resolved');
 assert.match(css,/\.nav01-crest\[data-club-crest-fallback="true"\]::before\{display:block;/,
  'only explicit fallback state enables the neutral shield');
 assert.match(css,/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before\{display:block;/,
  'known SVGs show only the shared circular loading skeleton');
 assert.ok(js.includes(' data-club-crest-fallback="true"'),
  'cards with no catalogued asset are explicitly marked for fallback');
 assert.ok(js.includes("slot.dataset.clubCrestFallback='true';image.remove()"),
  'failed image loads enable fallback');
 assert.ok(js.includes('delete slot.dataset.clubCrestFallback;slot.dataset.clubCrestLoaded'),
  'successful image loads clear fallback');
});
test('PAGE-LOAD-04 B02: Club and Fixtures reuse the standings circular crest loading primitive',()=>{
 const shell=read('clubs/_shared/index.html'),styles=read('assets/app.css'),club=read('assets/club-model.js');
 assert.match(shell,/club-crest fa-crest-loading/,'anonymous Club header reserves a shared circular crest');
 assert.match(club,/club-crest fa-crest-loading/,'hydrated Club header keeps the loading slot');
 assert.match(styles,/--fa-crest-skeleton-fill/,'shared token defines the circle');
 assert.match(styles,/app-fixtures-skeleton-crest::before/,'Fixtures uses the same primitive');
 assert.match(read('assets/competition-fixtures.js'),/app-world-club-crest-placeholder fa-crest-loading/,'loaded Fixtures use the same shape before the asset resolves');
 assert.match(read('assets/club-crests.js'),/fa-crest-loading/,'missing crests fall back to a shield only on confirmed absence');
});
test('PAGE-LOAD-04 B02: Club History renders only verified seasons without guessed records',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/1/history'),clubKey='IT-1';
 const pending=model.render(manifest,selected,'en','',null,2,{source:'loading'});
 assert.match(pending,/club-history-row-loading/);
 assert.doesNotMatch(pending,/data-club-history-summary=/);
 const verified={source:'authoritative',clubKey,coverage:'complete',seasons:[{season:1,memberships:[{
  competitionId:'IT-1',category:'domestic',season:1,position:3,points:56,name:'IT-1',
  stats:{played:30,won:17,drawn:5,lost:8,goalsFor:53,goalsAgainst:35,goalDifference:18,cleanSheets:9}
 }]}]};
 const html=model.render(manifest,selected,'en','',null,2,verified);
 assert.match(html,/data-club-history-summary="1"/);
 assert.match(html,/data-history-competition-row="IT-1"/);
 assert.match(html,/standings\?season=1/);
 assert.match(html,/56/);
 assert.doesNotMatch(html,/data-club-history-summary="2"/);
 assert.match(model.render(manifest,selected,'it','',null,2,verified),
  /<th scope="col" class="club-history-season-col" aria-label="Stagione"><\/th>/,
  'Season heading remains accessible but visually blank');
 assert.match(model.render(manifest,selected,'en','',null,2,{source:'unavailable'}),/role="status"/);
});
test('club competition links open Standings with the displayed season and no fixture round',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json')),selected=model.route('/clubs/it/1/overview');
 const snapshot={source:'dev',divisionId:'IT-1',clubId:1,season:3,position:2,points:12,nextMatch:null};
 const href=(search,summary)=>model.render(manifest,selected,'en',search,summary).match(/class="club-competition-name"><a[^>]*href="([^"]+)"/)?.[1];
 assert.equal(href('',snapshot),'/competitions/it-1/standings');
 assert.equal(href('?season=2&matchday=7',null),'/competitions/it-1/standings?season=2');
 assert.equal(href('',null),'/competitions/it-1/standings');
 assert.equal(href('?season=bad',null),'/competitions/it-1/standings');
});

test('SAF-05 club league links open the selected season without an unparameterized stop',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/1/overview');
 const html=model.render(manifest,selected,'en','',null,3);
 assert.equal((html.match(/data-club-division-link href="\/competitions\/it-1\/standings"/g)||[]).length,1);
 const requested=model.render(manifest,selected,'en','?season=2',null,3);
 assert.equal((requested.match(/data-club-division-link href="\/competitions\/it-1\/standings\?season=2"/g)||[]).length,1);
 assert.match(read('assets/club-page.js'),/sessionStorage\.getItem\('football-architect:standings-dev-season'\)/);
});

test('FE-03: directory filters reuse keyed cards once hydrated without parsing on each filter',()=>{
 const source=read('assets/clubs-directory.js');
 assert.match(source,/const cardCache=new Map/);
 assert.match(source,/const cacheHits=typeof cardCache==='undefined'\?\[\]:hits\.map\(c=>cardCache\.get\(/);
 assert.match(source,/const reuseCached=hits\.length>0&&cacheHits\.length===hits\.length&&cacheHits\.every\(Boolean\)/);
 assert.match(source,/const staging=reuseCached\?null:/);
 assert.match(source,/if\(staging\)staging\.innerHTML=/,'missing cards and empty results retain the fallback');
 assert.match(source,/const nodes=reuseCached\?cacheHits\.map/);
 assert.match(source,/out\.insertBefore/,'card identity must survive filtering and reorder');
});

test('PAGE-LOAD-04 B02: directory reserves name, flag, city skeletons and hydrates a clean metadata row',()=>{
 const html=read('clubs/index.html'),js=read('assets/clubs-directory.js'),css=read('assets/clubs-directory.css'),generator=read('tools/generate-app-pages.mjs');
 const cards=[...html.matchAll(/<div class="nav01-card nav01-skeleton-card" aria-hidden="true">([\s\S]*?)<\/div>/g)].map(m=>m[1]);
 assert.equal(cards.length,16);
 for(const card of cards){
  for(const part of ['nav01-skeleton-name','nav01-skeleton-location','nav01-skeleton-flag','nav01-skeleton-city'])
   assert.ok(card.includes(part),'Missing first-paint skeleton: '+part);
  assert.doesNotMatch(card,/ · |nav01-country-flag|<svg/,'no visible identities while awaiting the manifest');
 }
 assert.ok(generator.includes('nav01-skeleton-flag')&&generator.includes('nav01-skeleton-city'),'HTML is generated from the same skeleton contract');
 assert.ok(css.includes('.nav01-card.nav01-skeleton-card>.nav01-skeleton-copy{display:block'),'loading bars are not hidden by normal card styling');
 assert.ok(js.includes('class="nav01-club-location"><svg'),'real flag is first on the metadata row');
 assert.match(js,/class="nav01-club-city">'\+safe\(c\.city\)/,'city is the only visible metadata text');
 assert.ok(!js.includes("safe(c.city)+' · ")&&!js.includes('dm.has(c.divisionId)'),'no separating dot or league name');
});
test('UI-409 PAGE-LOAD-04: anonymous crest slots are replaced only after the club manifest resolves',()=>{
 const html=read('clubs/index.html'),manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 assert.equal((html.match(/class="nav01-card nav01-skeleton-card"/g)||[]).length,16,'sixteen anonymous directory cards');
 assert.equal((html.match(/class="nav01-crest nav01-skeleton-crest"/g)||[]).length,16,'sixteen reserved crest footprints');
 assert.equal((html.match(/<img class="nav01-crest-image"/g)||[]).length,0,'no crest URL before manifest');
 assert.ok(Object.keys(manifest.clubCrests).length>0,'canonical crest mapping remains in fetched catalog');
 assert.match(read('assets/clubs-directory.js'),/m\.clubCrests\?\.\[c\.countryId/,'crests populated from fetched manifest');
 assert.match(read('assets/clubs-directory.css'),/\.nav01-skeleton-crest/,'shape preserved while loading');
});





test('CLUB-HISTORY-04: each season has one expandable total row and hidden competition details',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/1/history');
 const stats={played:32,won:18,drawn:8,lost:6,goalsFor:59,goalsAgainst:31,goalDifference:28,cleanSheets:11};
 const memberships=[
  {competitionId:'IT-1',category:'domestic',name:'Italy First',season:1,position:5,points:45,cupStatus:null,nextMatch:null,stats},
  {competitionId:'int-1',category:'international',name:'Sovereign Cup',season:1,position:8,points:9,cupStatus:'quarterfinals',nextMatch:null,
   stats:{played:8,won:4,drawn:2,lost:2,goalsFor:12,goalsAgainst:8,goalDifference:4,cleanSheets:3}}
 ];
 const second={competitionId:'IT-2',category:'domestic',name:'Italy Second',season:2,position:2,points:62,cupStatus:null,nextMatch:null,stats};
 const verified={source:'authoritative',clubKey:'IT-1',coverage:'complete',
  seasons:[{season:1,memberships},{season:2,memberships:[second]}]};
 const html=model.render(manifest,selected,'it','',null,2,verified);
 assert.equal((html.match(/<table /g)||[]).length,1,'one table with all seasons');
 assert.doesNotMatch(html,/<h2>Storia<\/h2>/,'History heading removed');
 assert.doesNotMatch(html,/<h2>History<\/h2>/);
 const liveStats={played:2,won:1,drawn:1,lost:0,goalsFor:3,goalsAgainst:1,goalDifference:2,cleanSheets:1};
 const active={...verified,seasons:[...verified.seasons,{season:3,ongoing:true,memberships:[{
  competitionId:'IT-1',category:'domestic',name:'Italy First',position:4,points:4,stats:liveStats,
  cupStatus:null,nextMatch:null
 }]}]};
 const live=model.render(manifest,selected,'en','',null,3,active);
 const devHistory={...active,source:'dev',schemaVersion:1,provenance:{
  kind:'fictional',sourceRef:'dev-fictional-preview',approved:false
 }};
 const dev=model.render(manifest,selected,'en','',null,3,devHistory);
 assert.match(dev,/data-club-history-summary="3"/,'valid isolated DEV history is rendered');
 const untrusted=model.render(manifest,selected,'en','',null,3,{
  ...devHistory,provenance:{kind:'fictional',sourceRef:'public-spoof',approved:false}
 });
 assert.doesNotMatch(untrusted,/data-club-history-summary="3"/,'untrusted DEV history must be rejected');

 assert.deepEqual([...live.matchAll(/data-club-history-summary="(\d+)"/g)].map(m=>Number(m[1])),[3,2,1],
  'live season appears first, ahead of sealed history');
 assert.match(live,/data-history-competition-row="IT-1" hidden/);
 const liveCup=model.render(manifest,selected,'en','',null,3,{
  ...verified,seasons:[{season:3,ongoing:true,memberships:[{
   competitionId:'int-1',category:'international',name:'Sovereign Cup',position:4,points:4,
   cupStatus:null,nextMatch:null,stats:liveStats
  }]}]});
 assert.match(liveCup,/<td title="Group Stage">Group Stage<\/td>/,'ongoing international phase is Group Stage when no result stage has been reached');
 const noGames=model.render(manifest,selected,'en','',null,1,{
  source:'authoritative',clubKey:'IT-1',coverage:'empty',seasons:[{season:1,ongoing:true,memberships:[{
   competitionId:'IT-1',category:'domestic',name:'Italy First',position:null,points:0,cupStatus:null,
   stats:{played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0},nextMatch:null
  }]}]});
 assert.match(noGames,/>No games played<\/p>/);
 assert.doesNotMatch(noGames,/<table /,'empty history has no fake zero-game rows');

 assert.match(html,/<section class="club-history" aria-busy="false">/,'History has no surrounding app-panel box');
 assert.doesNotMatch(html,/app-panel club-history|Match totals include|Spielstatistiken aus allen Phasen|Estadísticas de todas las fases|Statistiques de toutes les phases|Statistiche di tutte le fasi/,'no footnote or box');
 assert.match(html,/<colgroup><col class="club-history-col-season"><col class="club-history-col-name"><col class="club-history-col-position">/);
 assert.equal((html.match(/<col class="club-history-col-number">/g)||[]).length,8,'exactly eight aligned numeric statistic columns');
 assert.equal((html.match(/data-club-history-summary="/g)||[]).length,2,'exactly one total per closed season');
 assert.equal((html.match(/data-history-competition-row="/g)||[]).length,3,'all official competitions are included');
 assert.equal((html.match(/data-club-history-toggle="/g)||[]).length,2,'one disclosure per season');
 assert.equal((html.match(/data-club-history-detail="1"/g)||[]).length,2);
 assert.equal((html.match(/data-club-history-detail="2"/g)||[]).length,1);
 assert.equal((html.match(/data-history-competition-row="[^"]+" hidden/g)||[]).length,3,'every competition row is collapsed initially');
 assert.match(html,/data-club-history-toggle="1" aria-expanded="false"/);
 assert.match(html,/data-history-competition-row="int-1" hidden/);
 for(const [cls,accessible] of [['season','Stagione'],['name','Competizione'],['position','Pos.']]){
  const head=html.match(new RegExp('<th scope="col" class="club-history-'+cls+'-col" aria-label="([^"]+)"></th>'));
  assert.equal(head?.[1],accessible,'first three headings are visually empty but remain accessible');
 }
 assert.doesNotMatch(html,/<th scope="col"[^>]*>(Stagione|Competizione|Pos\.)<\/th>/,'remove visible first three labels');
 assert.match(html,/<th scope="col"[^>]*>PG<\/th>/);
 assert.match(html,/<th scope="col"[^>]*>GS<\/th>/);
 assert.doesNotMatch(html,/<th scope="col">(CS|PP)<\/th>/);
 assert.doesNotMatch(html,/<select|data-club-history-select|club-history-choice|class="club-history-summary"/);
 const yearRows=[...html.matchAll(/data-club-history-summary="(\d+)"/g)].map(match=>Number(match[1]));
 assert.deepEqual(yearRows,[2,1],'most recent season shown first');
 const seasonOne=html.match(/<tr class="club-history-season-row" data-club-history-summary="1">([\s\S]*?)<\/tr>/)?.[1];
 assert.ok(seasonOne,'Season 1 aggregate row');
 assert.match(seasonOne,/>Stagione 1<\/button>/);
 assert.match(seasonOne,/>Totale<\/td><td><\/td>/,'aggregate position is blank');
 for(const number of ['40','22','10','8','71','39','+32'])
  assert.ok(seasonOne.includes('>'+number+'</td>'),'Season 1 verified total '+number);
 assert.ok(seasonOne.endsWith('<td>+32</td><td></td>'),'aggregate points must remain blank');
 assert.doesNotMatch(seasonOne,/Sovereign Cup|Italy First|Quarti di finale/,'club competition names only in expansion');
 const seasonWithNoMemberships=model.render(manifest,selected,'en','',null,3,{
  ...verified,seasons:[{season:1,memberships},{season:3,ongoing:true,memberships:[]}]
 });
 const emptySeason=seasonWithNoMemberships.match(/<tr data-club-history-summary="3" class="club-history-season-row">([\s\S]*?)<\/tr>/)?.[1];
 assert.ok(emptySeason?.includes('No games played'),'unplayed current season remains visible after a played season');
 assert.equal((emptySeason.match(/<td><\/td>/g)||[]).length,9,'all absent statistic cells stay blank');
 const historySection=html.match(/<section class="club-history"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(historySection,'History renders its own section');
 assert.ok(!historySection.includes('—'),'no dash placeholders remain anywhere in History');
 assert.match(html,/data-history-competition-row="IT-1" hidden/);
 assert.match(html,/data-history-competition-row="int-1" hidden/);
 assert.match(html,/\/competitions\/int-1\/standings\?season=1/);
 assert.match(html,/class="club-history-competition-link"/,'competition names use a dedicated plain-text link');
 assert.doesNotMatch(html,/<th scope="row" class="club-history-competition-value"><a class="app-link"/,'no globally boxed app-link for competition rows');
 const styles=read('assets/club-page.css');
 assert.match(styles,/\.club-history-table \.club-history-competition-value a\.club-history-competition-link\{display:inline-block;width:fit-content;max-width:100%;min-width:0;min-height:0;margin:0;padding:0;border:0/,'competition links remain text-sized and unboxed instead of occupying the full cell');
 assert.doesNotMatch(styles,/\.club-history-table \.club-history-competition-row:hover \.club-history-competition-text/,'row hover must not underline the competition text');
 assert.match(styles,/text-decoration-line:underline;text-underline-offset:3px/,'match regular site link behavior');
 assert.match(html,/<td title="Quarti di finale">Quarti di finale<\/td>/,'international Pos. is the verified knockout stage, not the league position');
 assert.doesNotMatch(html,/<td>8º<\/td>/,'international position must never display the league stage rank');
 assert.doesNotMatch(html,/Historical overview|Seasons played|Best league finish/);
 const loading=model.render(manifest,selected,'it','',null,2,{source:'loading'});
 assert.match(loading,/aria-busy="true"/);
 assert.match(loading,/club-history-row-loading/);
 const loadingRow=loading.match(/<tr class="club-history-season-row club-history-row-loading" aria-hidden="true">([\s\S]*?)<\/tr>/)?.[1];
 assert.ok(loadingRow,'loading uses the identical row type as the final Season X total');
 assert.match(loadingRow,/<th scope="row" class="club-history-season-value"><span class="club-history-expand club-history-skeleton-label"><span class="club-history-chevron-space" aria-hidden="true"><\/span>/,
  'loading reserves the chevron position without drawing the arrow');
 assert.doesNotMatch(loadingRow,/class="club-history-chevron"/,'the chevron must not appear before the season is loaded');
 assert.match(seasonOne,/<span class="club-history-chevron" aria-hidden="true"><\/span>/,
  'the chevron appears only on a loaded expandable season');
 assert.match(loadingRow,/<td class="club-history-total-label"><span class="club-fp-bar"/,
  'the Total skeleton occupies the real left-aligned cell');
 assert.equal((loadingRow.match(/<td><\/td>/g)||[]).length,2,'Pos. and season Pts remain blank while loading');
 assert.equal((loadingRow.match(/<td><span class="club-fp-bar"/g)||[]).length,7,'exactly seven real numeric totals have centered skeleton bars');
 assert.equal((loadingRow.match(/club-fp-bar/g)||[]).length,9,'one Season, one Total and seven aggregate values');
 assert.ok(loadingRow.endsWith('<td></td>'),'season Pts has no placeholder even while pending');
 assert.equal((loading.match(/<table /g)||[]).length,1);
 assert.doesNotMatch(loading,/>0<\/td>/);
 const empty=model.render(manifest,selected,'it','',null,1,{...verified,coverage:'empty',seasons:[]});
 assert.match(empty,/Nessuna partita giocata/);
 assert.doesNotMatch(empty,/club-history-row-loading/);
 const absent=model.render(manifest,selected,'it','',null,2,
  {...verified,seasons:[{season:1,memberships:[]}]});
 assert.match(absent,/Nessuna partita giocata/);
 assert.doesNotMatch(absent,/data-club-history-toggle/);
 const unavailable=model.render(manifest,selected,'it','',null,2,{source:'unavailable'});
 assert.match(unavailable,/temporaneamente non disponibile/);
 assert.doesNotMatch(unavailable,/club-history-row-loading/);
 for(const lang of ['en','de','es','fr','it']){
  const localized=model.render(manifest,selected,lang,'',null,2,verified);
  assert.equal((localized.match(/<table /g)||[]).length,1);
  assert.equal((localized.match(/data-club-history-summary="/g)||[]).length,2);
  assert.equal((localized.match(/data-history-competition-row="/g)||[]).length,3);
  assert.doesNotMatch(localized,/<select/);
 }
 const firstPaint=read('clubs/_shared/index.html'),script=read('assets/club-page.js'),css=read('assets/club-page.css');
 for(const key of ['season','competition','position','played','won','drawn','lost','gf','ga','gd','points'])
  assert.match(firstPaint,new RegExp('data-club-history-label="'+key+'"'));
 assert.match(firstPaint,/club-history-row-loading/);
 const parserRow=firstPaint.match(/<tr class="club-history-season-row club-history-row-loading" aria-hidden="true">([\s\S]*?)<\/tr>/)?.[1];
 assert.equal(parserRow,loadingRow,'parser-time skeleton is identical to hydrated pending row, cell-for-cell');
 assert.doesNotMatch(parserRow,/class="club-history-chevron"/,'the parser-time shell does not flash the chevron');
 assert.equal((parserRow.match(/<td><\/td>/g)||[]).length,2,'the parser-time Position and Pts cells are empty');
 assert.equal((firstPaint.match(/<table class="club-history-table"/g)||[]).length,1);
 assert.match(firstPaint,/<section class="club-history club-first-paint-panel club-first-paint-other"/,'first paint has the same flat layout');
 assert.doesNotMatch(firstPaint,/app-panel club-history/,'first paint has no extra box');
 assert.equal((firstPaint.match(/<col class="club-history-col-number">/g)||[]).length,8,'first-paint columns match hydrated layout');
 for(const [key,accessible] of [['season','Season'],['competition','Competition'],['position','Pos.']])
  assert.match(firstPaint,new RegExp('data-club-history-label="'+key+'" aria-label="'+accessible+'"></th>'),
   'first paint reserves an empty accessible header for '+key);
 assert.match(firstPaint,/if\(index<3\)\{label\.textContent='';label\.setAttribute\('aria-label',historyLabels\[locale\]\[index\]\);\}/,
  'first paint localizes nonvisual header labels without making text appear');
 assert.match(css,/table-layout:fixed/);
 assert.match(css,/--club-history-row-height:56px/,'fixed uniform height token');
 assert.match(css,/\.club-history-chevron,\.club-history-chevron-space\{box-sizing:border-box;width:8px;height:8px;flex:none\}/,
  'placeholder and loaded chevron reserve identical width and height');
 assert.match(css,/\.club-history-chevron-space\{border:0;visibility:hidden\}/,
  'loading chevron placeholder never renders an arrow');
 assert.match(css,/\.club-history-table \.club-history-row-loading \.club-history-skeleton-label \.club-fp-bar\{width:62px;min-width:0;margin:0\}/,
  'Season bar starts after its real chevron instead of the cell edge');
 assert.match(css,/\.club-history-table \.club-history-row-loading \.club-history-total-label \.club-fp-bar\{width:42px;min-width:0;margin-inline-start:0\}/,
  'Total skeleton starts at the same left edge as the loaded label');
 assert.match(css,/\.club-history-table tr\{height:var\(--club-history-row-height\)\}/,'all header, season, competition and loading rows share height');
 assert.match(css,/\.club-history-table th,\.club-history-table td\{box-sizing:border-box;height:var\(--club-history-row-height\)/,'table cells cannot increase the row height');
 assert.match(css,/\.club-history-table \.club-history-competition-value\{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis/,'long competition names cannot wrap rows');
 assert.match(css,/\.club-history-table \.club-history-competition-row td:nth-child\(3\)\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis/,'long international stages cannot wrap rows');
 assert.doesNotMatch(css,/\.club-history>h2\{/,'History title CSS removed');
 assert.match(firstPaint,/<section class="club-history club-first-paint-panel club-first-paint-other"[^>]*><div class="club-history-table-wrap">/,'first-paint table starts without a History heading');
 assert.doesNotMatch(firstPaint,/<h2 data-club-history-label="title">/,'no first-paint History title');
 assert.doesNotMatch(firstPaint,/data-club-history-shell/,'no nested first-paint wrapper to shift heading');
 const generator=read('tools/generate-club-pages.mjs');
 assert.doesNotMatch(generator,/data-club-history-shell/,'no regenerated wrapper');
 assert.match(generator,/other\.hidden=view!=='history'/,'History does not flash on the Roster, Fixtures or Stats first paint');
 assert.match(firstPaint,/other\.hidden=view!=='history'/,'generated first-paint bootstrap keeps History hidden outside its view');
 assert.match(html,/<section class="club-history" aria-busy="false"><div class="club-history-table-wrap">/,'hydrated table starts without a History heading');
 assert.doesNotMatch(html,/<section class="club-history"[^>]*><h2>/,'no hydrated History title');
 assert.match(html,/<a class="club-history-competition-link" href="[^"]+" title="[^"]+"><span class="club-history-competition-text">/,'inner text retains native underline without link overflow clipping');
 assert.match(css,/\.club-history-table \.club-history-competition-value a\.club-history-competition-link\{display:inline-block;width:fit-content;max-width:100%;[^}]*padding:0;[^}]*text-overflow:ellipsis;/,
  'the clickable area is a text-sized inline-block rather than the complete table cell');
 assert.match(css,/a\.club-history-competition-link:is\(:hover,:focus-visible\) \.club-history-competition-text\{text-decoration-line:underline;/,
  'competition hover and focus styling belongs only to its actual link');
 assert.doesNotMatch(css,/\.club-history-competition-row:(?:hover|focus-within) \.club-history-competition-text/,
  'hovering the row or the empty competition cell must never underline the name');
 assert.ok(script.includes("const row=event.target.closest?.('[data-club-history-summary]');"),
  'only season summary rows have delegated click handling');

 for(const width of ['club-history-col-season','club-history-col-name','club-history-col-position','club-history-col-number'])
  assert.match(css,new RegExp('\\.'+width+'\\{width:'),'one fixed width per aligned table column');
 assert.doesNotMatch(firstPaint,/data-club-history-label="cleanSheets"|<select|data-club-history-season="1"/);
 assert.doesNotMatch(firstPaint,/data-club-history-label="title"/,'first-paint translation has no title key');
 assert.doesNotMatch(generator,/data-club-history-label="title"/,'generated shell also has no History title');
 assert.match(script,/openHistorySeasons=new Set/);
 assert.match(script,/data-club-history-toggle/);
 assert.match(script,/data-club-history-detail/);
 assert.match(script,/historyTableScroll/);
 assert.match(script,/if\(selected\.view!=='overview'\)return;/,'non-Overview Club views do not fetch Overview APIs');
 assert.match(script,/createClubPublicReadCache/,'both Club readers reuse canonical per-world HTTP results');
 assert.doesNotMatch(script,/preferBatch|\/seasons\/.*\/overview/,'Club views use only the shared History endpoint');
 assert.match(read('backend/src/index.ts'),/readPublicClubHistory/,'backend exposes a dedicated club History projection');
 assert.match(read('assets/club-history-source.mjs'),/api\/clubs\/.*\/history/,'client reads the dedicated club History route');
 assert.match(script,/refreshClubHistory\(\);refreshClubOverview\(\)/,
  'tab navigation restores both data readers without redundant requests');
 assert.match(script,/if\(selected\.view!=='history'\)return;/,
  'leaving History does not abort/restart its in-flight world-verified read');
 const cacheSource=read('assets/club-public-read-cache.mjs');
 assert.match(cacheSource,/sourceRevision,w\.generation,w\.revision,w\.seasonNumber,w\.day,w\.phase/,
  'per-world caching fences generation, revision, sporting day and source switches');
 assert.match(read('assets/club-history-source.mjs'),/projectClubOverviewStats\(raw,clubKey,membership,season,world\)/,
  'History reuses verified totals in Club Overview instead of downloading each competition');
 assert.match(script,/current\.current\?\.season===0/,'DEV Season 0 immediately shows verified no-games notice');
 const devSeasonZero=model.render(manifest,selected,'en','',null,0,{
  source:'dev',schemaVersion:1,clubKey:'IT-1',coverage:'empty',seasons:[],
  provenance:{kind:'fictional',sourceRef:'dev-fictional-preview',approved:false}
 });
 assert.match(devSeasonZero,/role="status">No games played<\/p>/);
 assert.doesNotMatch(devSeasonZero,/<table /,'Season 0 has a notice, not an empty table');
 assert.match(css,/margin:0 0 14px/,'desktop name/location spacing');
 assert.match(css,/font-size:clamp\(1\.2rem,4\.8vw,1\.5rem\);margin-bottom:10px/,'mobile name/location spacing');
});

test('CLUB-FIXTURES renderer: localized controls, opponent-only rows, venues and shootouts',async()=>{
 const {default:fixtures}=await import('../assets/club-fixtures.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const row={id:'fixture-a',competitionId:'IT-1',season:1,day:12,round:4,phaseId:'league',opponentId:'IT-2',venue:'away',goalsFor:2,goalsAgainst:1,resolution:'penalties',penalties:{for:5,against:4}};
 for(const lang of ['en','de','es','fr','it']){
  const html=fixtures.render({manifest,lang,season:1,seasons:[0,1],snapshot:{coverage:'complete',day:12,rows:[row],competitions:[]}});
  assert.ok(html.includes('2–1'));assert.ok(html.includes('5–4'));assert.ok(html.includes('data-club-crest="IT-2"'));assert.ok(!html.includes('data-club-crest="IT-1"'));
  assert.ok(html.includes('data-club-venue="away"'));assert.ok(html.includes(fixtures.copy[lang].away));assert.ok(html.includes('role="combobox"'));
 }
 const unknown=fixtures.render({manifest,lang:'en',season:1,seasons:[1],snapshot:{coverage:'complete',day:0,rows:[{...row,opponentId:null,goalsFor:null,goalsAgainst:null,resolution:null,penalties:null}],competitions:[]}});
 assert.ok(unknown.includes('Opponent TBD'));assert.ok(!unknown.includes('2–1'));
});

test('CLUB-FIXTURES next-match action requires a verified unplayed future fixture in the current season',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 const future={id:'future',day:24,goalsFor:null,competitionId:'IT-1'};
 const played={id:'played',day:18,goalsFor:2,competitionId:'IT-1'};
 const snapshot={coverage:'complete',day:16,rows:[played,future],competitions:[]};
 const match=(snap,season,currentSeason)=>ui.nextFixture({snapshot:snap,season,currentSeason});
 assert.equal(match(snapshot,2,2),future,'active season with an upcoming match is actionable');
 assert.equal(match({...snapshot,coverage:'partial'},2,2),future,'partial source can still expose a verified fixture');
 for(const [description,snap,selected,current] of [
  ['historical season',snapshot,1,2],
  ['unstarted world',snapshot,1,0],
  ['unknown canonical season',snapshot,2,null],
  ['fully played schedule',{...snapshot,rows:[played,{...future,goalsFor:1}]},2,2],
  ['no future match',{...snapshot,day:30},2,2],
  ['pending read',{...snapshot,coverage:'loading'},2,2],
  ['error read',{...snapshot,coverage:'error'},2,2],
  ['unavailable read',{...snapshot,coverage:'unavailable'},2,2]
 ]){
  assert.equal(match(snap,selected,current),null,description);
  const html=ui.render({season:selected,currentSeason:current,snapshot:snap});
  assert.match(html,/data-club-fixtures-next disabled/,description+' button must be natively disabled');
  assert.doesNotMatch(html,/class="club-fixture-row is-next"/,description+' must not highlight a stale next fixture');
 }
 const html=ui.render({season:2,currentSeason:2,snapshot});
 assert.doesNotMatch(html,/data-club-fixtures-next disabled/);
 assert.match(html,/class="club-fixture-row is-next"/);
 const css=read('assets/club-page.css');
 assert.match(css,/@media\(max-width:620px\)\{[\s\S]*?\.club-fixture-row\{[^}]*padding:6px 10px/,'compact mobile row retains padding for the next-match highlight');
 assert.match(css,/\.club-fixture-opponent\{[^}]*line-height:16px;gap:7px;min-height:50px/,'three-line mobile opponent footprint remains reserved');
 assert.match(css,/\.club-fixture-meta\{[^}]*display:grid;grid-template-columns:max-content minmax\(0,1fr\);align-items:center;min-height:42px/,'mobile metadata stays in two compact stable columns');
 assert.match(css,/\.club-fixtures-next:disabled,\.club-fixtures-next:disabled:hover\{[^}]*opacity:\.45;cursor:default;pointer-events:none;[^}]*background:var\(--surface\);[^}]*box-shadow:none\}/,'disabled next-match action matches the muted Matchday controls and has no interactive hover treatment');
});

test('CLUB-FIXTURES DEV adapter uses the sporting calendar and masks future results',async()=>{
 const {createPreviewClubFixtures}=await import('../tools/dev-standings-preview-data.mjs');
 const manifest=JSON.parse(read('competitions/_shared/manifest.json')),division=manifest.divisions.find(d=>d.id==='IT-1');
 const snapshot=createPreviewClubFixtures(division,1,{season:1,matchdays:4},1,16);
 assert.equal(snapshot.rows.filter(r=>r.phaseId==='league').length,30);
 assert.ok(snapshot.rows.every(r=>r.day<=16||r.goalsFor===null));
 assert.equal(snapshot.rows[0].day,13);assert.equal(snapshot.provenance.kind,'fictional');
 assert.equal(createPreviewClubFixtures(division,1,{season:0,matchdays:0},0,0).coverage,'unstarted');
 assert.equal(createPreviewClubFixtures(division,1,{season:0,matchdays:0},1,0).coverage,'unstarted');
});

test('CLUB-FIXTURES: knockout links use configured phase and leg tokens',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 await import('../assets/competition-rules-view.js');
 const competitions=JSON.parse(read('competitions/_shared/manifest.json')).competitions;
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const row={id:'cup-leg-2',competitionId:'int-1',day:48,round:12,phaseId:'semifinals',leg:2,opponentId:'ENG-2',venue:'neutral',goalsFor:null,goalsAgainst:null};
 const html=ui.render({manifest,lang:'it',season:1,snapshot:{coverage:'complete',day:46,rows:[row],competitions}});
 assert.ok(html.includes('matchday=semifinals%3A2'));
 assert.ok(html.includes('Semifinali'));assert.ok(html.includes('Campo neutro'));
});

test('CLUB-FIXTURES: parser-time controls and region label are localized without a notice',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 assert.doesNotMatch(ui.render(),/club-fixtures-notice|Loading fixtures/);
 assert.match(ui.render(),/data-club-fixture-text="next"/);
 assert.match(read('tools/generate-club-pages.mjs'),/fixtures\.setAttribute\('aria-label',fixtureLabels\.competition\)/);
});

test('CLUB-FIXTURES: unknown canonical season shows its label without a selector skeleton',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 const markup=ui.render();
 assert.ok(!markup.includes('Season 1'));assert.doesNotMatch(markup,/club-fixture-season-loading/);
 assert.match(markup,/<span data-club-fixture-value>Season<\/span>/);
});

test('CLUB-FIXTURES: confirmed source failure does not retain a season loading skeleton',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 const markup=ui.render({season:null,snapshot:{coverage:'unavailable',rows:[],competitions:[]}});
 assert.ok(!markup.includes('club-fixture-season-loading'));assert.ok(markup.includes('data-club-fixtures-state="unavailable"'));assert.ok(!markup.includes('club-fixtures-notice'));
});

test('CLUB-FIXTURES: approved toolbar order and no notice in any data state',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 for(const coverage of ['loading','complete','partial','unstarted','unpublished','unavailable','error']){
  const markup=ui.render({season:1,seasons:[1],snapshot:{coverage,rows:[],competitions:[]}});
  assert.ok(markup.indexOf('data-club-fixtures-next')<markup.indexOf('data-club-fixture-control="competition"'));
  assert.ok(markup.indexOf('data-club-fixture-control="competition"')<markup.indexOf('data-club-fixture-control="season"'));
  assert.doesNotMatch(markup,/club-fixtures-notice|Loading fixtures|No fixtures are available|Fixture data is unavailable/);
  assert.ok(markup.includes('data-club-fixtures-state="'+coverage+'"'));
 }
});

test('CLUB-FIXTURES: viewed seasons follow Standings and clamp invalid or future links',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 for(const [current,expected] of [[0,[1]],[1,[1]],[2,[2,1]],[4,[4,3,2,1]]]){
  const result=ui.resolveSeason({current});assert.deepEqual(result.seasons,expected);assert.equal(result.season,Math.max(1,current));
 }
 assert.equal(ui.resolveSeason({current:2,requested:'1'}).season,1);
 for(const requested of ['0','-1','junk','01',''])assert.equal(ui.resolveSeason({current:2,requested}).season,2);
 for(const requested of ['3','999'])assert.equal(ui.resolveSeason({current:2,requested}).season,2);
 assert.equal(ui.resolveSeason({current:0,requested:'2'}).season,1);
 assert.equal(ui.resolveSeason({current:null,requested:'999'}).season,null,'unverified clock cannot clamp a future link');
 assert.deepEqual(ui.resolveSeason({current:null}).seasons,[]);
});

test('CLUB-FIXTURES: text-only hover and overview navigation, with sized skeleton slots',async()=>{
 const {default:ui}=await import('../assets/club-fixtures.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const row={id:'game',competitionId:'IT-1',day:12,round:4,phaseId:'league',opponentId:'IT-2',venue:'home',goalsFor:null,goalsAgainst:null};
 const rendered=ui.render({manifest,season:1,seasons:[1],snapshot:{coverage:'complete',rows:[row],competitions:[]}});
 assert.match(rendered,/class="club-fixture-opponent" href="\/clubs\/it\/2\/overview"/);
 assert.doesNotMatch(rendered,/\/clubs\/it\/2\/fixtures/);
 assert.match(rendered,/href="\/competitions\/it-1\/fixtures\?season=1&amp;matchday=4"/);
 const loading=ui.render();
 for(const part of ['day','league','name','venue','score','status'])
  assert.match(loading,new RegExp('club-fixture-skeleton-'+part));
 const css=read('assets/club-page.css');
 assert.match(css,/a\.club-fixture-opponent:is\(:hover,:focus-visible\)>span:last-child\{text-decoration:underline/);
 assert.match(css,/\.club-fixture-meta a:is\(:hover,:focus-visible\)\{text-decoration:underline/);
 assert.match(css,/\.club-fixture-opponent\{[^}]*width:fit-content/);
 assert.match(css,/\.club-fixture-select \[data-club-fixture-value\]\{[^}]*white-space:nowrap/);
 assert.match(css,/\.club-fixture-loading \.club-fixture-skeleton-venue\{inline-size:18px/);
 assert.match(loading,/class="club-fixture-skeleton-line"/);
 assert.match(loading,/class="club-fixture-result"><strong><span class="club-fp-bar club-fixture-skeleton-score"/);
 assert.match(css,/\.club-fixture-skeleton-line \.club-fp-bar,\s*\.club-fixture-loading \.club-fixture-result \.club-fp-bar\{display:inline-block;vertical-align:middle/);
 const expected=ui.render().replace('<section class="club-fixtures"',"<section hidden data-labels='"+JSON.stringify(ui.copy).replaceAll("'","&#39;")+"' class=\"club-fixtures\"");
 assert.ok(read('clubs/_shared/index.html').includes(expected),'first-paint fixtures are generated from the current renderer');
});

test('CLUB-FIXTURES: DEV season initializes from protected bootstrap, not a public guess',()=>{
 const generator=read('tools/generate-club-pages.mjs');
 const generated=read('clubs/_shared/index.html');
 assert.match(generator,/window\.faDevPreviewMode===true&&window\.faDebugEnabled!==false/);
 assert.match(generator,/sessionStorage\.getItem\('football-architect:standings-dev-season'\)/);
 assert.match(generator,/initial=params\.has\('season'\)\?\(valid\?Math\.min\(limit,initial\):1\):limit/);
 assert.match(generated,/sessionStorage\.getItem\('football-architect:standings-dev-season'\)/);
 assert.doesNotMatch(read('assets/club-page.css'),/club-fixture-season-loading/);
 assert.doesNotMatch(generated,/club-fixture-season-loading/);
 assert.match(generator,/const requested=params\.get\('season'\),valid=/);
 assert.match(read('assets/club-fixtures-controller.mjs'),/season:displaySeason,/);
 assert.match(read('assets/club-fixtures-controller.mjs'),/currentSeason:/);
 assert.match(read('assets/club-fixtures-controller.mjs'),/explicitSeason:/);
});
