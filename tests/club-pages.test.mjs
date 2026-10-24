import test from 'node:test';
import {runInNewContext as vmRunInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
test('CLUB-01 derived manifest preserves canonical fields and provisional placement',()=>{
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const descriptions=JSON.parse(read('data/club-descriptions.i18n.json'));
 const allocations=JSON.parse(read('data/division-allocations.provisional.json'));
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
 execFileSync(process.execPath,['tools/generate-app-pages.mjs','--check']);
 assert.equal(execFileSync('git',['diff','--','data/clubs.json','data/divisions.json','data/division-allocations.provisional.json','data/club-descriptions.i18n.json','assets/clubs'],{encoding:'utf8'}),'');
});

test('CLUB-01 presentation uses every canonical identity in all five languages',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 for(const c of manifest.clubs)for(const lang of ['en','de','es','fr','it']){
  const base='/clubs/'+c.countryId.toLowerCase()+'/'+String(c.clubId);
  for(const view of clubViews){
   const selected=model.route(base+'/'+view),html=model.render(manifest,selected,lang,'?season=2&matchday=7');
   assert.ok(html.includes('aria-current="page"'));
   assert.equal((html.match(/class="app-competition-tab(?: |")/g)||[]).length,5);
   assert.ok(html.includes(model.copies[lang][view]));
   assert.ok(html.includes(base+'/overview"'));
   assert.ok(html.includes(base+'/history"'));
   assert.ok(html.includes(base+'/fixtures?season=2&matchday=7'));
   if(view==='overview'){
    for(const field of ['abbr','primaryColor','secondaryColor'])assert.ok(html.includes(c[field]));
    if(c.divisionId)assert.ok(html.includes('/competitions/'+c.divisionId.toLowerCase()+'/overview'));
    else assert.ok(html.includes(model.copies[lang].outside));
   }else assert.ok(html.includes('club-empty'));
   assert.doesNotMatch(html,/\?view=|href="\/app\//);
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
 const sandbox={module:{exports:{}},URLSearchParams};
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
   assert.ok(box.includes('href="/competitions/'+c.divisionId.toLowerCase()+'/overview"'));
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
  else assert.ok(html.includes('href="/competitions/it-1/overview"'));
 }
});
