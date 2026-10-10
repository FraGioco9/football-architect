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
 assert.ok(css.includes(".app-competition-header{display:flex"));
 assert.ok(css.includes(".app-competition-header{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;margin:0}"));
 assert.ok(css.includes(".app-competition-identity .app-page-title{margin:0;color:#f2f7f4;"));
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
