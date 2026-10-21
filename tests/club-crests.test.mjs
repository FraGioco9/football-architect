import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import model from '../assets/competition-model.js';
import {createRequire} from 'node:module';
const clubModel=createRequire(import.meta.url)('../assets/club-model.js');
import {isAllowlistedPublicPath} from '../tools/publication-guard.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=()=>JSON.parse(read('competitions/_shared/manifest.json'));
const expected={'BR-1':'assets/clubs/BR/1/crest.svg','DE-1':'assets/clubs/DE/1/crest.svg','PT-1':'assets/clubs/PT/1/crest.svg'};

test('uploaded club crests are catalogued and explicitly included in public artifacts',()=>{
 for(const [id,path] of Object.entries(expected)){
  assert.equal(manifest().clubCrests[id],path);
  assert.equal(isAllowlistedPublicPath(path),true,path);
 }
 for(const path of ['assets/clubs/ZZ/1/crest.svg','assets/clubs/DE/41/crest.svg','assets/clubs/DE/1/source.zip'])
  assert.equal(isAllowlistedPublicPath(path),false,path);
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


test('FR-2 FC Massalia crest is present in generated manifest and public allowlist',()=>{
 const path='assets/clubs/FR/2/crest.svg';
 assert.equal(manifest().clubCrests['FR-2'],path);
 assert.equal(isAllowlistedPublicPath(path),true);
 assert.equal(existsSync(new URL('../'+path,import.meta.url)),true);
});

test('FR-2 crest loads once, retains the accessible host and falls back on failure',()=>{
 const frPath='assets/clubs/FR/2/crest.svg';
 const s=setup({...expected,'FR-2':frPath});
 const fr=host('FR-2');
 s.insert(fr);
 assert.equal(fr.dataset.clubCrestPending,'true');
 assert.equal(fr.children.length,1);
 assert.equal(fr.children[0].src,'/'+frPath);
 assert.equal(fr.children[0].alt,'');
 fr.children[0].events.load();
 assert.equal(fr.dataset.clubCrestLoaded,'true');
 assert.equal(fr.dataset.clubCrestPending,undefined);
 s.repeat(fr);
 assert.equal(fr.children.length,1,'Re-observation must not duplicate crest images');
 const broken=host('FR-2');
 s.insert(broken);
 assert.equal(broken.children.length,1);
 broken.children[0].events.error();
 assert.equal(broken.children.length,0);
 assert.equal(broken.dataset.clubCrestLoaded,undefined);
 assert.equal(broken.dataset.clubCrestPending,undefined);
});

test('FR-2 club pages suppress first-paint placeholder and label the real crest in every language',()=>{
 const club={countryId:'FR',clubId:2,primaryName:'FC Massalia',fullName:'Football Club Massalia',compactName:'Massalia',abbr:'MAS',nickname:'Les Phocéens',city:'Marseille',primaryColor:'#6C5B93',secondaryColor:'#C6814F',stadiumName:'Stade du Vieux-Port',
 descriptions:{en:'Club',de:'Club',es:'Club',fr:'Club',it:'Club'},divisionId:null};
 const base={clubs:[club],divisions:[],clubCrests:{'FR-2':'assets/clubs/FR/2/crest.svg'}};
 for(const view of clubModel.views){
  for(const lang of ['en','de','es','fr','it']){
   const html=clubModel.render(base,{countryId:'FR',clubId:2,view,base:'/clubs/fr/2'},lang);
   const hosts=[...html.matchAll(/<span class="app-world-club-crest-placeholder club-crest"[^>]*><\/span>/g)].map(x=>x[0]);
   assert.equal(hosts.length,view==='overview'?2:1,view+' '+lang);
   for(const crest of hosts){
    assert.match(crest,/data-club-crest="FR-2"/);
    assert.match(crest,/data-club-crest-pending="true"/);
    assert.match(crest,/aria-label="[^"]*FC Massalia"/);
    assert.doesNotMatch(crest.match(/aria-label="([^"]*)"/)?.[1]||'',/placeholder|provisional|Segnaposto|Platzhalter/i);
   }
  }
 }
 const missing=clubModel.render({...base,clubCrests:{}},{countryId:'FR',clubId:2,view:'overview',base:'/clubs/fr/2'},'en');
 assert.equal((missing.match(/data-club-crest-pending="true"/g)||[]).length,0,'Unknown crests keep their visible fallback');
});
