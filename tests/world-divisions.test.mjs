import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const divisions=JSON.parse(read("data/divisions.json")).divisions;
const countries=JSON.parse(read("data/divisions.json")).countries;
const allocation=JSON.parse(read("data/division-allocations.provisional.json"));
const clubs=JSON.parse(read("data/clubs.json")).clubs;
const indexPath="app/world/competitions/index.html";
const index=read(indexPath);
const routes=divisions.map(d=>({division:d,file:"app/world/competitions/"+d.id.toLowerCase()+"/index.html"}));

test("COMPETITIONS-02 lists eight countries, sixteen compact links and no old route",()=>{
 assert.equal(countries.length,8);
 assert.equal(divisions.length,16);
 assert.equal((index.match(/class="app-division-card"/g)||[]).length,16);
 assert.ok(index.includes('data-app-i18n="navCompetitions">Competitions'));
 assert.ok(index.includes("<title>Competitions — Football Architect</title>"));
 assert.ok(!existsSync(new URL("../app/world/divisions/index.html",import.meta.url)));
 for(const country of countries)assert.ok(index.includes('id="world-country-'+country.id.toLowerCase()+'"'));
 for(const {division} of routes)assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"'));
 assert.doesNotMatch(index,/app-world-hero|app-world-facts/);
 assert.equal((index.match(/class="app-competition-logo-placeholder"/g)||[]).length,16);
 for(const {division} of routes){
  assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"><span class="app-competition-logo-placeholder" aria-hidden="true">'+division.id+'</span>'),division.id);
 }
 assert.match(read("assets/app.css"),/\.app-competition-logo-placeholder\{/);
});

test("COMPETITIONS-02 keeps direct routes and all local navigation targets resolving",()=>{
 const pages=["app/dashboard/index.html","app/calendar/index.html","app/settings/index.html",indexPath,...routes.map(x=>x.file)];
 for(const file of pages){
  const html=read(file),base=new URL("../"+file,import.meta.url);
  for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(href.startsWith("#")||href.startsWith("data:"))continue;
   assert.doesNotMatch(href,/^https?:/);
   const path=new URL(href,base),candidate=path.pathname.endsWith("/")?new URL("index.html",path):path;
   assert.ok(existsSync(fileURLToPath(candidate)),file+" -> "+href);
  }
  assert.ok(html.includes('data-app-i18n="navCompetitions">Competitions'));
  assert.ok(html.includes('id="app-nav-divisions"'));
  assert.ok(html.includes('id="app-search-trigger"'));
 }
 for(const {division,file} of routes){
  assert.ok(existsSync(new URL("../"+file,import.meta.url)));
  assert.ok(!existsSync(new URL("../app/world/divisions/"+division.id.toLowerCase()+"/index.html",import.meta.url)));
  assert.ok(read(file).includes("id=\"division-detail-name\""));
 }
});

test("COMPETITIONS-02 preserves 320 unique provisional clubs across 11-column standings",()=>{
 const seen=new Set();
 for(const {division,file} of routes){
  const html=read(file),entry=allocation.allocations.find(e=>e.divisionId===division.id);
  assert.ok(entry);assert.equal(entry.clubIds.length,20);
  assert.ok(html.includes('<table class="app-world-standing-table">'));
  assert.equal((html.match(/<th scope="col"/g)||[]).length,11);
  assert.equal((html.match(/<tr data-world-club="/g)||[]).length,20);
  assert.ok(!html.includes('data-app-i18n="standingsEmpty"'),file);
  assert.ok(!html.includes('data-app-i18n="standingsHeading"'),file);
  assert.ok(!html.includes('class="app-world-standings-heading"'),file);
  assert.ok(!html.includes('class="app-world-standings-count"'),file);
  assert.ok(!html.includes('class="app-world-standings-note"'),file);
  assert.ok(!html.includes('division-standings-heading'),file);
  assert.ok(html.includes('<div class="app-world-standings">'),file);
  assert.ok(html.includes('data-app-i18n="competitionTabStandings">Standings</button>'),file);
  assert.ok(html.includes('href="../" data-app-i18n="allDivisions"'));
  const other=divisions.find(d=>d.countryId===division.countryId&&d.id!==division.id);
  assert.ok(!html.includes('href="../'+other.id.toLowerCase()+'/"'),file);
  assert.ok(!html.includes('class="app-world-related"'),file);
  assert.doesNotMatch(html,/app-world-hero|app-world-facts|division-fixtures-heading|division-clubs-heading/);
  assert.doesNotMatch(html,/<td[^>]*>\d+<\/td>/,"no fabricated stats");
  for(const id of entry.clubIds){
   const club=clubs.find(c=>c.countryId===division.countryId&&c.clubId===id),key=division.countryId+"-"+id;
   assert.ok(club);assert.ok(html.includes('data-world-club="'+key+'"'));
   assert.ok(html.includes(club.fullName.replaceAll("&","&amp;")));
   assert.ok(!seen.has(key),"duplicate club "+key);
   seen.add(key);
  }
 }
 assert.equal(seen.size,320);
});

test("COMPETITIONS-02 preserves five languages, rounded flags and accessible focus",()=>{
 const app=read("assets/app.js"),css=read("assets/app.css"),template=read("templates/app-page.html"),search=read("assets/app-search.js");
 for(const lang of ["en","de","es","fr","it"])assert.ok(app.includes("    "+lang+": {"),lang);
 assert.equal((app.match(/navCompetitions:/g)||[]).length,5);
 assert.ok(template.includes('data-app-i18n="navCompetitions">Competitions'));
 assert.ok(css.includes("border-radius:6px}"));
 assert.ok(css.includes(".app-division-card:focus-visible"));
 assert.match(css,/@media\(max-width:620px\)/);
 assert.ok(search.includes('../data/divisions.json'));
 assert.ok(search.includes("/app/world/competitions/"));
 assert.ok(read("assets/flags/LICENSE").includes("MIT License"));
});

test("COMPETITIONS-03 places title, logo, metadata and return button in one header on all pages",()=>{
 const css=read("assets/app.css");
 assert.ok(css.includes(".app-competition-header{--app-competition-heading-size:var(--app-page-title-size)"));
 assert.ok(css.includes("--app-competition-heading-size:var(--app-page-title-size)"));
 assert.ok(css.includes("--app-competition-logo-size:calc(var(--app-competition-heading-size) * 1.2 + 29px)"));
 assert.ok(css.includes(".app-competition-logo-placeholder-large{width:var(--app-competition-logo-size);height:var(--app-competition-logo-size)"));
 assert.ok(css.includes(".app-competition-identity .app-page-title{margin:0;color:#f2f7f4;font-size:var(--app-competition-heading-size)"));
 assert.ok(css.includes("--app-competition-heading-size:clamp(20px,6vw,26px)"));
 assert.ok(css.includes(".app-competition-identity{flex:1 1 calc(100% - var(--app-competition-logo-size) - 10px)"));
 assert.ok(css.includes(".app-world-grid .app-competition-logo-placeholder{width:32px;height:32px"));
 assert.ok(!css.includes(".app-competition-logo-placeholder-large{width:52px;height:52px"));

 assert.ok(!css.includes(".app-world-related"));
 assert.ok(css.includes(".app-competition-return:focus-visible"));
 for(const {division,file} of routes){
  const html=read(file);
  assert.ok(html.includes('class="app-competition-header"'),file);
  assert.ok(html.includes('class="app-competition-logo-placeholder app-competition-logo-placeholder-large"'),file);
  assert.ok(html.includes('data-app-aria="crestPlaceholder">'+division.id+'</span>'),file);
  assert.ok(html.includes('id="division-detail-name">'+division.name.replaceAll("&","&amp;")+'</span>'),file);
  assert.ok(html.includes('data-world-country="'+division.countryId+'"'),file);
  assert.ok(html.includes('data-app-i18n="'+(division.tier===1?'divisionTier1':'divisionTier2')+'"'),file);
  assert.ok(html.includes('class="app-competition-return app-link app-link-secondary" href="../" data-app-i18n="allDivisions"'),file);
  assert.ok(html.indexOf('class="app-competition-logo-placeholder app-competition-logo-placeholder-large"')<html.indexOf('id="division-detail-name"'),file);
  assert.ok(html.indexOf('id="division-detail-name"')<html.indexOf('class="app-world-detail-meta"'),file);
  assert.ok(html.indexOf('class="app-world-detail-meta"')<html.indexOf('class="app-competition-return'),file);
  assert.ok(!html.includes('class="app-world-back"'),file);
  assert.equal((html.match(/<h1 class="app-page-title" id="divisions-title"/g)||[]).length,1,file);
 }
});

test("COMPETITIONS-04 keeps six accessible views in all competition pages",()=>{
 const slugs=["standings","fixtures","stats","history","rules","awards"];
 const app=read("assets/app.js"),code=read("assets/competition-tabs.js"),css=read("assets/app.css");
 const expectedKeys=["competitionViews",...slugs.map(id=>"competitionTab"+id[0].toUpperCase()+id.slice(1)),
  "competitionFixturesEmpty","competitionStatsEmpty","competitionHistoryEmpty","competitionRulesEmpty","competitionAwardsEmpty",
  "standingsForm","standingsTable"];
 for(const key of expectedKeys)assert.equal((app.match(new RegExp("\\b"+key+":","g"))||[]).length,5,key);
 for(const retired of ["competitionTabClubs","competitionTabPlayers","competitionClubsNote","competitionPlayersEmpty"])
  assert.equal((app.match(new RegExp("\\b"+retired+":","g"))||[]).length,0,retired);
 assert.ok(code.includes("tabs.length !== 6"));
 for(const key of ["ArrowRight","ArrowLeft","Home","End"])assert.ok(code.includes('event.key === "'+key+'"'));
 assert.ok(css.includes(".app-competition-panel[hidden]{display:none}"));
 assert.ok(css.includes(".app-competition-tabs{display:flex"));
 for(const {division,file} of routes){
  const html=read(file);
  assert.equal((html.match(/role="tab"/g)||[]).length,6,file);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,6,file);
  assert.equal((html.match(/role="tab"[^>]*aria-selected="true"/g)||[]).length,1,file);
  assert.equal((html.match(/role="tab"[^>]*aria-selected="false"/g)||[]).length,5,file);
  assert.ok(html.includes('role="tablist" aria-label="Competition views" data-app-aria="competitionViews"'),file);
  for(const slug of slugs){
   assert.ok(html.includes('id="competition-tab-'+slug+'"'),file);
   assert.ok(html.includes('aria-controls="competition-panel-'+slug+'"'),file);
   assert.ok(html.includes('id="competition-panel-'+slug+'"'),file);
   assert.ok(html.includes('aria-labelledby="competition-tab-'+slug+'"'),file);
  }
  for(const old of ["clubs","players"]){
   assert.ok(!html.includes('id="competition-tab-'+old+'"'),file);
   assert.ok(!html.includes('id="competition-panel-'+old+'"'),file);
  }
  assert.ok(html.includes('id="competition-panel-standings" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-standings" tabindex="0"'),file);
  assert.ok(html.includes('id="competition-panel-awards" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-awards" tabindex="0" hidden'),file);
  assert.ok(html.includes('src="../../../../assets/competition-tabs.js" defer'),file);
  assert.equal((html.match(/<li data-world-club="/g)||[]).length,0,file);
  assert.ok(html.includes('data-app-i18n="competitionRulesEmpty"'),file);
  assert.ok(html.includes('data-app-i18n="capacityLabel">Planned club places</dt><dd>'+division.capacity+'</dd>'),file);
  assert.ok(html.includes('data-app-i18n="tierLabel">Tier</dt><dd>'+division.tier+'</dd>'),file);
 }
});

test("COMPETITIONS-05 shows all key league statistics with no fabricated data",()=>{
 const columns=["standingsPosition","standingsClub","standingsPlayed","standingsWon","standingsDrawn",
  "standingsLost","standingsFor","standingsAgainst","standingsDifference","standingsPoints","standingsForm"];
 const css=read("assets/app.css");
 for(const cls of [".app-world-standings-heading",".app-world-standings-count",".app-world-standings-note"])assert.ok(!css.includes(cls),cls);
 assert.ok(css.includes(".app-world-standing-scroll{max-width:100%;overflow-x:auto"));
 assert.ok(css.includes(".app-world-standing-table tr>*:first-child{position:sticky"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(2){position:sticky"));
 assert.ok(css.includes(".app-world-standing-table{width:100%;min-width:1030px"));
 assert.ok(css.includes(".app-world-standing-scroll{max-width:100%;overflow-x:auto;overflow-y:hidden;"));
 for(const {division,file} of routes){
  const html=read(file);
  assert.ok(html.includes('role="region" aria-label="Standings statistics" data-app-aria="standingsTable"'),file);
  assert.equal((html.match(/<th scope="col"/g)||[]).length,11,file);
  for(const key of columns)assert.ok(html.includes('data-app-i18n="'+key+'"'),file+": "+key);
  const rows=[...html.matchAll(/<tr data-world-club="([^"]+)">([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,20,file);
  for(const [,id,body] of rows){
   assert.equal((body.match(/<td class="app-world-stat-unknown">—<\/td>/g)||[]).length,10,id);
   assert.equal((body.match(/<th scope="row" class="app-world-standing-club">/g)||[]).length,1,id);
   assert.doesNotMatch(body,/<td[^>]*>\d+<\/td>/,id);
  }
 }
});

test("COMPETITIONS-05 keyboard and click controls isolate one of six selected tabs",async()=>{
 const {runInNewContext}=await import("node:vm");
 const tabs=Array.from({length:6},(_,i)=>{
  const listeners={},selected={};
  return {
   listeners,selected,tabIndex:i===0?0:-1,focused:false,scrolled:false,
   classList:{toggle(name,on){selected[name]=on}},
   getAttribute(name){return name==="aria-controls"?"competition-panel-"+i:null},
   setAttribute(name,value){selected[name]=value},
   addEventListener(name,listener){listeners[name]=listener},
   focus(){this.focused=true},
   scrollIntoView(){this.scrolled=true}
  };
 });
 const panels=tabs.map(()=>({hidden:false}));
 const doc={
  querySelector(selector){return selector===".app-competition-tabs"?{querySelectorAll(){return tabs}}:null},
  getElementById(id){return panels[Number(id.slice("competition-panel-".length))]??null}
 };
 runInNewContext(read("assets/competition-tabs.js"),{document:doc});
 assert.deepEqual(panels.map(p=>p.hidden),[false,true,true,true,true,true]);
 tabs[3].listeners.click();
 assert.equal(panels[3].hidden,false);
 assert.equal(tabs[3].selected["aria-selected"],"true");
 assert.equal(tabs[0].selected["aria-selected"],"false");
 let prevented=false;
 tabs[3].listeners.keydown({key:"ArrowRight",preventDefault(){prevented=true}});
 assert.ok(prevented);
 assert.equal(tabs[4].focused,true);
 assert.equal(tabs[4].scrolled,true);
 assert.equal(panels[4].hidden,false);
 tabs[4].listeners.keydown({key:"Home",preventDefault(){}});
 assert.equal(panels[0].hidden,false);
 tabs[0].listeners.keydown({key:"ArrowLeft",preventDefault(){}});
 assert.equal(panels[5].hidden,false);
 tabs[5].listeners.keydown({key:"End",preventDefault(){}});
 assert.equal(panels.filter(p=>!p.hidden).length,1);
});
