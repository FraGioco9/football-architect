import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import model from '../assets/competition-model.js';
import {createRequire} from 'node:module';
const clubModel=createRequire(import.meta.url)('../assets/club-model.js');
import {isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
import {clubCrestAssets} from '../tools/club-crest-assets.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=()=>JSON.parse(read('competitions/_shared/manifest.json'));
const expected={'BR-1':'assets/clubs/BR/1/crest.svg','DE-1':'assets/clubs/DE/1/crest.svg','PT-1':'assets/clubs/PT/1/crest.svg'};


test('all canonical crest assets are published consistently and unsafe paths are rejected',()=>{
 const {catalog}=clubCrestAssets();
 const competitions=manifest().clubCrests;
 const clubs=JSON.parse(read('clubs/_shared/manifest.json')).clubCrests;
 const identities=new Set(JSON.parse(read('data/clubs.json')).map(c=>c.countryId+'-'+c.clubId));
 assert.deepEqual(competitions,catalog,'competition crest registry matches discovered assets');
 assert.deepEqual(clubs,catalog,'club crest registry matches discovered assets');
 for(const [id,path] of Object.entries(catalog)){
  const [country,number]=id.split('-');
  assert.ok(identities.has(id),'unknown crest identity: '+id);
  assert.equal(path,'assets/clubs/'+country+'/'+number+'/crest.svg');
  assert.equal(isAllowlistedPublicPath(path),true,'allowed published crest: '+id);
  assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,'missing SVG: '+id);
 }
 for(const path of ['assets/clubs/ZZ/1/crest.svg','assets/clubs/DE/41/crest.svg','assets/clubs/DE/1/source.zip'])
  assert.equal(isAllowlistedPublicPath(path),false,'unexpected public path: '+path);
});

test('competition validation rejects arbitrary crest URLs and mismatched club paths',()=>{
 assert.equal(model.validManifest(manifest()),true);
 for(const catalog of [{'DE-1':'https://example.test/logo.svg'},{'DE-1':'assets/clubs/PT/1/crest.svg'},
  {'IT-41':'assets/clubs/IT/41/crest.svg'},{'XX-1':'assets/clubs/XX/1/crest.svg'},null,[]]){
  assert.equal(model.validManifest({...manifest(),clubCrests:catalog}),false);
 }
});

function host(id){
 return {dataset:{clubCrest:id},children:[],matches:()=>true,querySelectorAll(selector){return selector==='.app-club-crest-image'?this.children.filter(node=>node.className==='app-club-crest-image'):[]},
  append(node){this.children.push(node);node.parent=this},contains(node){return this.children.includes(node)}};
}
function setup(catalog=expected){
 const source=new URL('../assets/club-crests.js',import.meta.url);
 assert.ok(existsSync(source),'Shared club crest renderer must exist');
 const hosts=[host('DE-1'),host('BR-1'),host('PT-1'),host('IT-1')],requests=[];let observe;
 const document={body:{},querySelectorAll:()=>hosts,createElement(){
  const image={events:{},addEventListener(name,fn){this.events[name]=fn},remove(){this.parent.children=this.parent.children.filter(node=>node!==this)},
   set src(value){this.url=value;requests.push(value)},get src(){return this.url}};return image;
 }};
 runInNewContext(read('assets/club-crests.js'),{document,window:{faClubCrests:catalog},
  MutationObserver:class{constructor(fn){observe=fn}observe(){}}});
 return {hosts,requests,insert(node){hosts.push(node);observe([{type:'childList',addedNodes:[node]}])},
  repeat(node){observe([{type:'childList',addedNodes:[node]}])},
  change(node,id){node.dataset.clubCrest=id;observe([{type:'attributes',target:node}])}};
}

test('CLUB-01: cached prepaint crest is settled after passive renderer initialization',()=>{
 // The native image can finish decoding before club-crests.js is loaded;
 // complete/naturalWidth alone are not proof the host has been reconciled.
 const image={
  className:'app-club-crest-image',complete:true,naturalWidth:70,
  getAttribute:name=>name==='src'?'/assets/clubs/IT/1/crest.svg':null,
  remove(){throw Error('A decoded SVG must not be removed')}
 };
 const crest={
  dataset:{clubCrest:'IT-1',clubCrestPending:'true'},classList:{contains:name=>name==='club-crest'},
  matches:selector=>selector==='[data-club-crest]',
  querySelector:selector=>selector==='.app-club-crest-image'?image:null,
  querySelectorAll:selector=>selector==='.app-club-crest-image'?[image]:[],
  contains:node=>node===image
 };
 assert.equal(image.complete,true);
 assert.equal(crest.dataset.clubCrestPending,'true','prepaint can be pending before its JS observer runs');
 const document={body:{},
  querySelectorAll:selector=>selector==='[data-club-crest]'?[crest]:[],
  createElement(){throw Error('Cached prepaint crest must not trigger another image')}
 };
 runInNewContext(read('assets/club-crests.js'),{
  document,window:{faClubCrests:{'IT-1':'assets/clubs/IT/1/crest.svg'}},
  MutationObserver:class{observe(){}}
 });
 assert.equal(crest.dataset.clubCrestLoaded,'true','renderer acknowledges already decoded image');
 assert.equal(crest.dataset.clubCrestPending,undefined,'pending attribute is removed on reconciliation');
 assert.equal(crest.querySelector('.app-club-crest-image'),image,'decoded image node remains stable');
});

test('known crests reserve a blank slot while loading; missing or failed images keep the fallback',()=>{
 const s=setup();
 assert.deepEqual([...s.requests].sort(),Object.values(expected).map(path=>'/'+path).sort());
 assert.equal(s.hosts[3].children.length,0,'Missing crest causes no guessed asset request');
 const [de,br,pt]=s.hosts;
 assert.equal(de.dataset.clubCrestLoaded,undefined);
 assert.equal(de.dataset.clubCrestPending,'true','Known crest starts in a blank loading state');
 assert.equal(s.hosts[3].dataset.clubCrestPending,undefined,'Absent crests retain their placeholder');
 assert.equal(de.children[0].alt,'');
 de.children[0].events.load();assert.equal(de.dataset.clubCrestLoaded,'true');assert.equal(de.dataset.clubCrestPending,undefined);
 br.children[0].events.error();assert.equal(br.dataset.clubCrestLoaded,undefined);assert.equal(br.dataset.clubCrestPending,undefined);assert.equal(br.children.length,0);
 s.repeat(br);assert.equal(s.requests.length,3,'Broken image must not trigger an observer retry loop');
 pt.children[0].events.load();assert.equal(pt.dataset.clubCrestLoaded,'true');
});

test('crests also render in dynamically inserted fixtures, Stats and History content',()=>{
 const s=setup();
 for(const view of ['fixtures','stats','history']){
  const node=host('DE-1');s.insert(node);
  assert.equal(node.children.length,1,view);
  assert.equal(node.children[0].src,'/assets/clubs/DE/1/crest.svg');
  node.children[0].events.load();assert.equal(node.dataset.clubCrestLoaded,'true',view);
  s.repeat(node);assert.equal(node.children.length,1,'Repeated observation keeps one image');
 }
});

test('reusing an identity host replaces its image and ignores stale load events',()=>{
 const s=setup(),node=s.hosts[0],previous=node.children[0];
 s.change(node,'BR-1');
 assert.equal(node.children.length,1);
 assert.equal(node.children[0].src,'/assets/clubs/BR/1/crest.svg');
 previous.events.load();assert.equal(node.dataset.clubCrestLoaded,undefined);
 node.children[0].events.load();assert.equal(node.dataset.clubCrestLoaded,'true');
 s.change(node,'IT-1');
 assert.equal(node.children.length,0);assert.equal(node.dataset.clubCrestLoaded,undefined);assert.equal(node.dataset.clubCrestPending,undefined);
 assert.equal(s.requests.length,4,'Unknown identities retain the placeholder without probing a URL');
});



test('club pages show one accessible, loadable crest per view and locale with a missing-asset fallback',()=>{
 const full=JSON.parse(read('clubs/_shared/manifest.json'));
 const entries=Object.entries(manifest().clubCrests);
 const cases=[entries[0],entries.at(-1)];
 assert.ok(cases.every(Boolean),'expected representative published crest fixtures');
 for(const [id,path] of cases){
  const original=full.clubs.find(c=>c.countryId+'-'+c.clubId===id);
  assert.ok(original,'published crest must resolve a canonical club: '+id);
  const club={...original,divisionId:null};
  const base={clubs:[club],divisions:[],countryFlags:full.countryFlags,clubCrests:{[id]:path}};
  const routeBase='/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId;
  const route=view=>({countryId:club.countryId,clubId:club.clubId,view,base:routeBase});
  for(const view of clubModel.views){
   for(const lang of ['en','de','es','fr','it']){
    const html=clubModel.render(base,route(view),lang);
    const hosts=[...html.matchAll(/<span class="app-world-club-crest-placeholder club-crest fa-crest-loading"[^>]*>(?:<img[^>]*>)?<\/span>/g)].map(match=>match[0]);
    assert.equal(hosts.length,1,id+' / '+view+' / '+lang+' has one crest host');
    const host=hosts[0];
    assert.ok(host.includes('data-club-crest="'+id+'"'),id+' points to the right asset');
    assert.ok(host.includes('data-club-crest-pending="true"'),id+' has a reserved image slot');
    const accessible=host.match(/aria-label="([^"]+)"/)?.[1];
    assert.ok(accessible?.includes(club.primaryName),id+' / '+lang+' accessible club identity');
    assert.doesNotMatch(accessible,/placeholder|provisional|Segnaposto|Platzhalter/i);
   }
  }
  const missing=clubModel.render({...base,clubCrests:{}},route('overview'),'en');
  assert.equal((missing.match(/data-club-crest-pending="true"/g)||[]).length,0,id+' missing asset falls back');
 }
});

test('QA-15: known directory crests have a skeleton and missing or failed crests show borderless shields',()=>{
 const app=read('assets/app.css'),detail=read('assets/club-page.css'),directory=read('assets/clubs-directory.css');
 assert.match(app,/--fa-crest-shield-shape:polygon\(/);
 assert.match(app,/html\[data-theme="light"\]\{--fa-crest-shield-fill:/);
 assert.match(app,/\.app-world-club-crest-placeholder\{[^}]*border:0;border-radius:0;background:transparent/);
 assert.match(app,/\.app-world-club-crest-placeholder\[data-club-crest-loaded="true"\]::before\{display:none\}/);
 assert.match(app,/\.app-world-club-crest-placeholder\[data-club-crest-pending="true"\]::before,\s*\.app-world-club-crest-placeholder\[data-club-crest-loaded="true"\]::before\{display:none\}/);
 assert.match(detail,/\.club-first-paint-header \.club-crest\{visibility:visible\}/);
 assert.match(app,/\.app-world-club-crest-placeholder\.fa-crest-loading::before/,'shared anonymous crest loads as a circle');
 assert.match(directory,/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before\{display:block;left:50%;top:50%;transform:translate\(-50%,-50%\);clip-path:none\}/);
 assert.match(directory,/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before,\s*\.nav01-skeleton-crest-disc\{[^}]*background:var\(--fa-crest-skeleton-fill\)/);
 assert.match(directory,/\.nav01-crest\[data-club-crest-fallback="true"\]::before\{display:block;/,'only missing/failed crests may show a shield');
 assert.match(directory,/\.nav01-crest\[data-club-crest-loaded="true"\]::before\{display:none\}/);
 assert.match(directory,/\.nav01-crest-image\{position:absolute;inset:0;[^}]*object-fit:contain/);
 for(const selector of ['app-fixtures-skeleton-crest','app-view-skeleton-crest-slot'])
  assert.ok(app.includes(selector),'first-paint reserved crest slot '+selector);
 assert.doesNotMatch(app,/:is\(\.app-fixtures-skeleton-crest,\.app-view-skeleton-crest-slot\)::before\{/,'identity-free skeleton slots must remain blank');
});

test('QA-15: Clubs scales the Standings circular crest skeleton to its own logo slot',()=>{
 const app=read('assets/app.css'),directory=read('assets/clubs-directory.css');
 const standingsDesktop=app.match(/\.app-standings-skeleton tr>:nth-child\(2\) :is\([^}]+\)::before\{([^}]*)\}/)?.[1];
 const standingsMobile=app.match(/\.app-standings-skeleton \.app-world-mobile-name:is\([^}]+\)::before\{([^}]*)\}/)?.[1];
 const clubsPending=directory.match(/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before\{([^}]*)\}/)?.[1];
 const clubsShared=directory.match(/\.nav01-crest:has\(>\.nav01-crest-image\):not\(\[data-club-crest-loaded="true"\]\)::before,\s*\.nav01-skeleton-crest-disc\{([^}]*)\}/)?.[1];
 assert.ok(standingsDesktop&&standingsMobile&&clubsPending&&clubsShared,'both pages expose crest skeleton styles');
 assert.match(standingsDesktop,/flex:0 0 48px;height:48px;border-radius:50%/);
 assert.match(standingsMobile,/flex:0 0 40px;height:40px;border-radius:50%/);
 for(const style of [standingsDesktop,standingsMobile,clubsShared])
  assert.match(style,/background:(?:color-mix\(in srgb,var\(--muted\) 12%,var\(--surface\)\)|var\(--fa-crest-skeleton-fill\))/);
 assert.match(clubsPending,/left:50%;top:50%;transform:translate\(-50%,-50%\);clip-path:none/);
 assert.match(clubsShared,/width:85%;height:auto;max-height:100%;aspect-ratio:1;border-radius:50%/);
 for(const slot of ['width:82px;height:88px','width:68px;height:74px','width:64px;height:70px'])
  assert.ok(directory.includes('.nav01-crest{'+slot),'directory crest slots remain responsive: '+slot);
 assert.doesNotMatch(directory,/@media\(max-width:620px\)\{\.nav01-crest:has\(>\.nav01-crest-image\)/,
  'skeleton follows its host instead of hard-coding Standings widths');
 assert.match(directory,/\.nav01-crest\[data-club-crest-loaded="true"\]::before\{display:none\}/);
});
test('QA-15 PAGE-LOAD-04: shared country flag sprites are static, club flags are hydrated from manifest',()=>{
 const html=read('clubs/index.html'),generator=read('tools/generate-app-pages.mjs'),client=read('assets/clubs-directory.js');
 const countries=['it','gb-eng','es','de','fr','pt','nl','br'];
 const symbols=[...html.matchAll(/<symbol id="fa-directory-flag-([a-z-]+)" viewBox="0 0 5 4">/g)].map(m=>m[1]);
 assert.deepEqual(symbols,countries,'all eight reusable vectors are ready at first paint');
 for(const country of countries){
  assert.ok(html.includes('id="fa-competition-flag-'+country+'"'),'same vector artwork as Competitions: '+country);
  assert.ok(!html.includes('<use href="#fa-directory-flag-'+country+'"></use>'),'no per-club country flags before catalog: '+country);
 }
 assert.equal((html.match(/<svg class="nav01-country-flag"/g)||[]).length,0);
 assert.equal((html.match(/nav01-skeleton-card"/g)||[]).length,16,'sixteen anonymous cards');
 assert.ok(html.indexOf('class="nav01-flag-sprite"')<html.indexOf('class="nav01-card nav01-skeleton-card'),'sprite precedes cards');
 assert.match(generator,/const directoryFlagSprite=/);
 assert.match(client,/<use href="#fa-directory-flag-/,'hydrated club cards reuse the same vectors');
 assert.doesNotMatch(client,/<img class="nav01-country-flag"/);
});
test('UI-409: directory image state is idempotent and failed requests retain the shield',()=>{
 const source=read('assets/clubs-directory.js');
 const start=source.indexOf('const settleCrest=('),end=source.indexOf("\ngrid.addEventListener('load'",start);
 assert.ok(start>=0&&end>start,'image events are bound before manifest loading');
 const settle=runInNewContext(source.slice(start,end)+';settleCrest',{});
 const slot={dataset:{},classList:{contains:name=>name==='nav01-crest'}};
 const image={parentElement:slot,complete:false,naturalWidth:0,matches:selector=>selector==='img.nav01-crest-image',
  removed:0,remove(){this.removed++}};
 settle(image);
 assert.equal(slot.dataset.clubCrestLoaded,undefined,'pending image leaves the skeleton visible');
 image.complete=true;image.naturalWidth=70;settle(image);
 assert.equal(slot.dataset.clubCrestLoaded,'true','loaded image keeps the shield hidden');
 settle(image);
 assert.equal(image.removed,0,'cache hit must not discard loaded node');
 const failed={...image,naturalWidth:0,removed:0,remove(){this.removed++}};
 settle(failed,true);
 assert.equal(slot.dataset.clubCrestLoaded,undefined,'failed image must reveal the shared shield');
 assert.equal(failed.removed,1,'broken image icon is removed without reloading');
});



test('every published crest has accessible canonical vector metadata and no embedded executable content',()=>{
 const byId=new Map(JSON.parse(read('data/clubs.json')).map(c=>[c.countryId+'-'+c.clubId,c]));
 for(const [id,path] of Object.entries(manifest().clubCrests)){
  const svg=read(path),club=byId.get(id);
  assert.ok(club,'missing canonical club for '+id);
  assert.match(svg,/<svg\b[^>]*viewBox="[-.\d\s]+"/,id+' vector viewBox');
  const title=svg.match(/<title\b[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  assert.ok(title,'missing accessible SVG title for '+id);
  assert.ok(title===club.primaryName||title===club.fullName||title.startsWith(club.primaryName+' '),
   id+' title must identify the source club, found '+title);
  assert.doesNotMatch(svg,/<(?:image|text|script|foreignObject)\b/i,id+' must use safe paths, not embedded images/scripts/text');
 }
});

