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

test("COMPETITIONS-02 keeps 320 unique unranked clubs in simplified four-column tables",()=>{
 const seen=new Set();
 for(const {division,file} of routes){
  const html=read(file),entry=allocation.allocations.find(e=>e.divisionId===division.id);
  assert.ok(entry);assert.equal(entry.clubIds.length,20);
  assert.ok(html.includes('<table class="app-world-standing-table">'));
  assert.equal((html.match(/<th scope="col"/g)||[]).length,4);
  assert.equal((html.match(/<tr data-world-club="/g)||[]).length,20);
  assert.ok(html.includes('data-app-i18n="standingsEmpty"'));
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

test("COMPETITIONS-04 implements eight navigable views on every detail page",()=>{
 const slugs=["standings","fixtures","clubs","players","stats","history","rules","awards"];
 const app=read("assets/app.js");
 const code=read("assets/competition-tabs.js");
 const css=read("assets/app.css");
 const expectedKeys=["competitionViews",...slugs.map(id=>"competitionTab"+id[0].toUpperCase()+id.slice(1)),"competitionClubsNote",
  "competitionFixturesEmpty","competitionPlayersEmpty","competitionStatsEmpty","competitionHistoryEmpty","competitionRulesEmpty","competitionAwardsEmpty"];
 for(const key of expectedKeys)
  assert.equal((app.match(new RegExp("\\b"+key+":","g"))||[]).length,5,key);
 assert.ok(code.includes('event.key === "ArrowRight"'));
 assert.ok(code.includes('event.key === "ArrowLeft"'));
 assert.ok(code.includes('event.key === "Home"'));
 assert.ok(code.includes('event.key === "End"'));
 assert.ok(css.includes(".app-competition-panel[hidden]{display:none}"));
 assert.ok(css.includes(".app-competition-tabs{display:flex"));
 for(const {division,file} of routes){
  const html=read(file);
  assert.equal((html.match(/role="tab"/g)||[]).length,8,file);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,8,file);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1,file);
  assert.equal((html.match(/aria-selected="false"/g)||[]).length,7,file);
  assert.ok(html.includes('role="tablist" aria-label="Competition views" data-app-aria="competitionViews"'),file);
  for(const slug of slugs){
   assert.ok(html.includes('id="competition-tab-'+slug+'"'),file);
   assert.ok(html.includes('aria-controls="competition-panel-'+slug+'"'),file);
   assert.ok(html.includes('id="competition-panel-'+slug+'"'),file);
   assert.ok(html.includes('aria-labelledby="competition-tab-'+slug+'"'),file);
  }
  assert.ok(html.includes('id="competition-panel-standings" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-standings" tabindex="0"'),file);
  assert.ok(html.includes('id="competition-panel-awards" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-awards" tabindex="0" hidden'),file);
  assert.ok(html.includes('src="../../../../assets/competition-tabs.js" defer'),file);
  assert.equal((html.match(/<li data-world-club="/g)||[]).length,20,file);
  assert.ok(html.includes('data-app-i18n="competitionRulesEmpty"'),file);
  assert.ok(html.includes('data-app-i18n="capacityLabel">Planned club places</dt><dd>'+division.capacity+'</dd>'),file);
  assert.ok(html.includes('data-app-i18n="tierLabel">Tier</dt><dd>'+division.tier+'</dd>'),file);
  assert.ok(!html.includes("2026 champion"),file);
 }
});

test("COMPETITIONS-04 keyboard and click controls isolate one selected tab",async()=>{
 const {runInNewContext}=await import("node:vm");
 const tabs=Array.from({length:8},(_,i)=>{
  const listeners={};
  const selected={};
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
  getElementById(id){const n=Number(id.slice("competition-panel-".length));return panels[n]??null}
 };
 runInNewContext(read("assets/competition-tabs.js"),{document:doc});
 assert.deepEqual(panels.map(panel=>panel.hidden),[false,true,true,true,true,true,true,true]);
 tabs[5].listeners.click();
 assert.equal(tabs[5].selected["aria-selected"],"true");
 assert.equal(tabs[0].selected["aria-selected"],"false");
 assert.equal(panels[5].hidden,false);
 assert.equal(panels[0].hidden,true);
 let prevented=false;
 tabs[5].listeners.keydown({key:"ArrowRight",preventDefault(){prevented=true}});
 assert.ok(prevented);
 assert.equal(tabs[6].focused,true);
 assert.equal(tabs[6].scrolled,true);
 assert.equal(panels[6].hidden,false);
 tabs[6].listeners.keydown({key:"Home",preventDefault(){}});
 assert.equal(panels[0].hidden,false);
 tabs[0].listeners.keydown({key:"ArrowLeft",preventDefault(){}});
 assert.equal(panels[7].hidden,false);
 assert.equal(panels.filter(panel=>!panel.hidden).length,1);
});
