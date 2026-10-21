import test from 'node:test';
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
test('CLUB-01 DEV redirects legacy URLs and serves all club views without DEV fixtures',async()=>{
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=path=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
   let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,location:res.headers.location,body}));
  });req.on('error',reject);req.end();
 });
 try{
  for(const c of clubs){
   const base='/clubs/'+c.countryId.toLowerCase()+'/'+String(c.clubId);
   assert.equal((await get(base)).location,base+'/overview');
   for(const view of clubViews){
    const page=await get(base+'/'+view);assert.equal(page.status,200);
    assert.doesNotMatch(page.body,/__fa_dev__|dev-debug|standings-client/);
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
