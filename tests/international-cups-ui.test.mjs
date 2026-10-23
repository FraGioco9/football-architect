import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicRequestFile,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const script=read("assets/international-cups.js");
const index=read("competitions/index.html");
const names=["sovereign-cup","federation-cup"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];

test("INT-24: both cup routes resolve to public allowlisted HTML",()=>{
  for(const slug of names){
    const route="/competitions/"+slug;
    const file=publicRequestFile(route);
    assert.equal(file,"competitions/"+slug+"/index.html");
    assert.ok(isAllowlistedPublicPath(file));
    assert.ok(index.includes('href="'+route+'"'));
    const html=read(file);
    assert.ok(html.includes('<h1 class="app-page-title" id="divisions-title"'));
    assert.ok(html.includes('aria-labelledby="divisions-title"'));
    assert.ok(html.includes('class="app-competition-header"'));
    assert.ok(html.includes('id="app-competition-season"'));
    assert.ok(html.includes('src="/assets/competition-page.js"'));
    for(const view of views){
      assert.ok(html.includes('id="competition-tab-'+view+'"'),slug+" "+view);
      assert.ok(html.includes('id="competition-panel-'+view+'"'));
      assert.equal(publicRequestFile(route+"/"+view),file);
    }
  }
  assert.ok(isAllowlistedPublicPath("assets/international-cups.js"));
  assert.equal((index.match(/class="app-division-card" href="\/competitions\/[a-z]{2,3}-[12]\/standings/g)||[]).length,16);
});

test("INT-24: five language dictionaries and empty states, no fabricated results",()=>{
  for(const locale of ["en","de","es","fr","it"])assert.match(script,new RegExp('"'+locale+'":\\['));
  assert.ok(script.includes('document.documentElement.lang'));
  assert.ok(script.includes('MutationObserver'));

  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('id="app-standings-body"'));
    assert.ok(!html.includes('data-world-country="IT"'));
    assert.ok(!html.includes('data-fa-score='));
  }
});

test("INT-24: shared theme controls and responsive CSS exist",()=>{
  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('src="/assets/theme.js"'));
    assert.ok(html.includes('href="/assets/app.css"'));
    assert.ok(html.includes('class="app-competition-tabs"'));
    assert.ok(!html.includes('class="app-international-tabs"'));
  }
});

test('INT-24 cup knockout tab uses its own label without changing domestic playoffs',()=>{
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  assert.match(html,/id="competition-tab-postseason"[^>]+data-app-i18n="competitionTabKnockouts">Knockouts<\/button>/);
  assert.doesNotMatch(html,/\/__fa_dev__\//);
 }
 assert.match(read('competitions/it-1/index.html'),/data-app-i18n="competitionTabPlayout">Playout/);
});

test('INT-24 DEV injects shared Debug controls on cup root and subpage routes',async()=>{
 const {createPreviewServer}=await import('../tools/dev-standings-preview.mjs');
 const {once}=await import('node:events');
 const {request}=await import('node:http');
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=path=>new Promise((resolve,reject)=>{
  request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,body}));
  }).on('error',reject).end();
 });
 try{
  for(const slug of names)for(const suffix of ['',...views.map(v=>'/'+v)]){
   const response=await get('/competitions/'+slug+suffix+'?season=99');
   assert.equal(response.status,200);
   assert.match(response.body,/data-fa-dev-preview src="\/__fa_dev__\/standings-client.mjs"/);
   assert.match(response.body,/dataset.faDevSeasons="1,2,3,4"/);
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('INT-24: generated cup identity enters the same loader without a domestic identity',()=>{
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  assert.match(html,new RegExp('<meta name="fa-competition" content="'+slug+'">'));
  assert.doesNotMatch(html,/<meta name="fa-division"/);
  assert.equal((html.match(/src="\/assets\/competition-page.js"/g)||[]).length,1);
  assert.doesNotMatch(html,/<script src="\/assets\/(?:app|competition-tabs|competition-history|competition-fixtures|competition-awards)\.js"/);
 }
});

test('INT-24: Knockouts uses a localized cup empty state instead of domestic instructions',async()=>{
 const {runInNewContext}=await import('node:vm');
 const app=read('assets/app.js');
 const dictionaries=app.slice(app.indexOf('  const copies ='),app.indexOf('  const worldCountryNames'));
 const renderer=app.slice(app.indexOf('  function renderLanguage()'),app.indexOf('  function renderView()'));
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  const panel=html.split('id="competition-panel-postseason"')[1].split('id="competition-panel-fixtures"')[0];
  assert.match(panel,/data-app-i18n="cupKnockoutsEmpty"/);
  assert.doesNotMatch(panel,/postseasonNeutral|Select a division/);
 }
 for(const [lang,expected] of Object.entries({en:'No knockout results available yet.',de:'Noch keine Ergebnisse der K.-o.-Phase verfügbar.',es:'Todavía no hay resultados de las eliminatorias.',fr:'Aucun résultat des phases à élimination directe disponible.',it:'Nessun risultato della fase a eliminazione diretta ancora disponibile.'})){
  const message={dataset:{appI18n:'cupKnockoutsEmpty'},textContent:'old domestic instruction'};
  const format={dataset:{appI18n:'rulesCupFormat'},textContent:'untranslated'};
  runInNewContext(dictionaries+renderer+'renderLanguage()',{language:()=>lang,words:()=>[message,format],accessible:()=>[],worldCountryNames:{},activeView:()=> 'divisions',document:{getElementById:()=>null,querySelectorAll:()=>[]}});
  assert.equal(message.textContent,expected);assert.notEqual(format.textContent,'untranslated');
 }
});
