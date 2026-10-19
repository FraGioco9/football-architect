import model from "../assets/competition-model.js";
import { publicRequestFile } from "../tools/publication-guard.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const divisions=JSON.parse(read("data/divisions.json"));
const countries=[...new Map(divisions.map(d=>[d.countryId,{id:d.countryId,name:{en:d.countryName},flagAsset:"assets/flags/"+(d.countryId==="ENG"?"gb-eng":d.countryId.toLowerCase())+".svg"}])).values()];
const allocation=JSON.parse(read("data/division-allocations.provisional.json"));
const clubs=JSON.parse(read("data/clubs.json"));
const manifest=JSON.parse(read("app/competitions/_shared/manifest.json"));
const shared=read("app/competitions/_shared/index.html");
const index=read("app/competitions/index.html");
const routes=divisions.map(d=>({division:d,file:"app/competitions/"+d.id.toLowerCase()+"/index.html"}));
const cols=["standingsPosition","standingsClub","standingsPlayed","standingsWon",
 "standingsDrawn","standingsLost","standingsFor","standingsAgainst","standingsDifference",
 "standingsPoints","standingsForm"];
const views=model.views.map(view=>view.id);

test("COMPETITIONS-06 keeps the index and renders approved SVG at first paint",()=>{
 assert.equal(countries.length,8);
 assert.equal(divisions.length,16);
 assert.equal((index.match(/class="app-division-card"/g)||[]).length,16);
 assert.ok(index.includes('data-app-i18n="navCompetitions">Competitions'));
 assert.ok(index.includes("<title>Competitions — Football Architect</title>"));
 assert.ok(!index.includes("world/competitions/"));
 assert.ok(!existsSync(new URL("../app/world/divisions/index.html",import.meta.url)));
 assert.ok(!existsSync(new URL("../app/world/competitions/index.html",import.meta.url)));
 for(const c of countries)assert.ok(index.includes('id="world-country-'+c.id.toLowerCase()+'"'));
 for(const {division} of routes){
  assert.ok(index.includes('href="/competitions/'+division.id.toLowerCase()+'?season=1&amp;view=standings"'),division.id);
  assert.ok(index.includes('href="/competitions/'+division.id.toLowerCase()+'?season=1&amp;view=standings">'),division.id);
 }
 assert.equal((index.match(/data-division-variant="compact"/g)||[]).length,16);
 assert.equal((index.match(/shadowrootmode="open"/g)||[]).length,16);
 for(const division of manifest.divisions)assert.equal(division.visualAsset,undefined);

});

test("COMPETITIONS-06 generates 16 complete routes with inline Compact logos",()=>{
 const common=["app/dashboard/index.html","app/calendar/index.html",
  "app/settings/index.html","app/competitions/index.html",
  "app/competitions/_shared/index.html"];
 for(const file of [...common,...routes.map(r=>r.file)]){
  const html=read(file),base=new URL("../"+file,import.meta.url);
  for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(href.startsWith("#")||href.startsWith("data:"))continue;
   assert.doesNotMatch(href,/^https?:/);
   const pathname = new URL(href, "https://fa.invalid/"+file).pathname;
   const localPath = new URL("../"+publicRequestFile(pathname),import.meta.url);
   assert.ok(existsSync(fileURLToPath(localPath)),file+" -> "+href);
  }
 }
 for(const {division,file} of routes){
  const html=read(file);
  assert.equal((html.match(/shadowrootmode="open"/g)||[]).length,1,file);
  assert.ok(html.includes('<meta name="fa-division" content="'+division.id+'">'),file);
  assert.ok(html.includes('<title>'+division.name.replaceAll("&","&amp;")+' — Football Architect</title>'),file);
  assert.ok(html.includes('src="/assets/competition-page.js" defer'),file);
  assert.ok(html.includes('data-division-variant="compact"'),file);
  assert.ok(html.includes('class="app-world-standing-table"'),file);
  assert.ok(html.includes('class="fa-career-shell"'),file);
  assert.ok(!existsSync(new URL("../app/world/divisions/"+division.id.toLowerCase()+"/index.html",import.meta.url)));
 }
});

test("COMPETITIONS-06 shared manifest exactly reflects the canonical provisional data",()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.approved,false);
 assert.equal(allocation.approved,false);
 assert.equal(manifest.divisions.length,16);
 const seen=new Set();
 const manifestById=new Map(manifest.divisions.map(d=>[d.id,d]));
 const allocationById=new Map(allocation.allocations.map(d=>[d.divisionId,d]));
 assert.equal(manifestById.size,16);
 assert.equal(allocationById.size,16);
 for(let i=0;i<divisions.length;i++){
  const d=divisions[i],m=manifestById.get(d.id),source=allocationById.get(d.id);
  const country=countries.find(c=>c.id===d.countryId);
  assert.ok(country);assert.equal(m.id,d.id);
  assert.equal(m.name,d.name);assert.equal(m.tier,d.tier);
  assert.equal(m.capacity,d.capacity);assert.equal(m.countryId,d.countryId);
  assert.equal(m.countryName,country.name.en);assert.equal(m.flagAsset,country.flagAsset);
  assert.equal(source.divisionId,d.id);
  assert.equal(m.clubs.length,16);
  assert.deepEqual(m.clubs.map(c=>c.clubId),source.clubIds);
  for(const record of m.clubs){
   const club=clubs.find(c=>c.countryId===record.countryId&&c.clubId===record.clubId);
   const key=record.countryId+"-"+record.clubId;
   assert.ok(club,key);
   assert.deepEqual(record,{countryId:club.countryId,clubId:club.clubId,abbr:club.abbr,fullName:club.fullName,primaryName:club.primaryName,stadiumName:club.stadiumName});
   assert.ok(!seen.has(key),"duplicate "+key);
   seen.add(key);
  }
 }
 assert.equal(seen.size,256);
  for(const club of clubs)
    assert.equal(seen.has(club.countryId+"-"+club.clubId),club.clubId<=32,"asset-only club must not appear in standings");
});

test("COMPETITIONS-06 shares one full shell, 11 standings columns and seven tabs",()=>{
 for(const html of [index,shared]){
  assert.match(html,/<\/header>\s*<div class="fa-shell-content-scroll">\s*<main class="app-main"/);
  assert.match(html,/<\/main>\s*<footer class="app-footer">[^]*?<\/footer>\s*<\/div>\s*<\/div>/);
 }
 assert.ok(shared.includes('<main class="app-main" id="main-content" tabindex="-1">'));
 assert.ok(shared.includes('id="app-nav-divisions"'));
 assert.ok(shared.includes('id="app-search-dialog"'));
 assert.ok(shared.includes('id="division-detail-name">Competition</span>'));
 for(const id of ["app-competition-badge","app-competition-flag","app-competition-country",
  "app-competition-tier","app-competition-capacity","app-competition-level","app-standings-body",
  "app-standings-caption"]){
  assert.ok(shared.includes('id="'+id+'"'),id);
 }
 assert.ok(shared.includes('data-app-i18n="navCompetitions">Competitions'));
 assert.ok(shared.includes('class="app-competition-header"'));
 assert.ok(shared.includes('class="app-competition-logo-placeholder app-competition-logo-placeholder-large"'));
 assert.ok(shared.includes('class="app-competition-return app-link app-link-secondary" href="/competitions" data-app-i18n="allDivisions"'));
 assert.equal((shared.match(/<th scope="col"/g)||[]).length,11);
 for(const key of cols)assert.ok(shared.includes('data-app-i18n="'+key+'"'),key);
 assert.equal((shared.match(/<tr data-world-club="/g)||[]).length,0);
 assert.equal((shared.match(/role="tab"/g)||[]).length,7);
 assert.equal((shared.match(/role="tabpanel"/g)||[]).length,7);
 assert.equal((shared.match(/role="tab"[^>]*aria-selected="true"/g)||[]).length,1);
 assert.equal((shared.match(/role="tab"[^>]*aria-selected="false"/g)||[]).length,6);
 for(const slug of views){
  assert.ok(shared.includes('id="competition-tab-'+slug+'"'));
  assert.ok(shared.includes('aria-controls="competition-panel-'+slug+'"'));
  assert.ok(shared.includes('id="competition-panel-'+slug+'"'));
 }
 for(const old of ["clubs","players"])assert.ok(!shared.includes('id="competition-tab-'+old+'"'));
 assert.ok(!shared.includes('app-world-standings-heading'));
 assert.ok(!shared.includes('app-world-standings-note'));
 assert.ok(!shared.includes('app-world-standings-count'));
 assert.ok(!shared.includes('20 / 20'));
});

test("COMPETITIONS-06 common runtime preserves localization, data safety and controls",()=>{
 const app=read("assets/app.js"),code=read("assets/competition-tabs.js");
 const renderer=read("assets/competition-page.js"),css=read("assets/app.css");
 for(const lang of ["en","de","es","fr","it"])assert.ok(app.includes("    "+lang+": {"));
 assert.equal((app.match(/navCompetitions:/g)||[]).length,5);
 for(const key of ["standingsForm","standingsTable","competitionViews","standingsFilledCaption",
  "standingsDemoWinLetter","standingsDemoDrawLetter","standingsDemoLossLetter",
  "standingsDemoFormWin","standingsDemoFormDraw","standingsDemoFormLoss",
  "standingsDemoFormWinLatest","standingsDemoFormDrawLatest","standingsDemoFormLossLatest",
  "standingsTooltipRound","standingsTooltipHome","standingsTooltipAway"]){
  assert.equal((app.match(new RegExp("\\b"+key+":","g"))||[]).length,5,key);
 }
 assert.ok(shared.includes('id="app-standings-caption" data-app-i18n="standingsCaption"'));
 assert.ok(!renderer.includes('routeId === "IT-1"'));
 assert.ok(!renderer.includes("it1Demo"));
 assert.ok(!renderer.includes("__faFixtureHooks"));
 assert.ok(renderer.includes("tbody.replaceChildren(...division.clubs.map(club => createStandingsRow(club)))"));
 assert.ok(!shared.includes('app-standings-demo'));
 assert.ok(!read("tools/generate-app-pages.mjs").includes("app-standings-demo"));
 for(const text of [shared,read("tools/generate-app-pages.mjs"),app,renderer,css]){
  assert.ok(!/DEMO [—·]|DÉMO [—·]|Illustrative score|Not a real match|app-world-demo-note|standingsDemoNotice|standingsTooltipDisclaimer/.test(text),"no visible demo markers");
 }
 assert.ok(css.includes(".app-world-form-strip{display:inline-flex;align-items:center;justify-content:center;gap:5px;"));
 assert.ok(css.includes(".app-world-form-dot{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:16px;padding:0;border:0;border-radius:3px;"));
 assert.ok(css.includes(".app-world-form-last{outline:2px solid var(--focus);outline-offset:1px}"));
 assert.ok(css.includes(".app-world-form-tooltip{--app-form-tooltip-width:clamp(240px,80vw,350px);position:fixed;z-index:80;box-sizing:border-box;display:flex;flex-direction:column;"));
 assert.ok(css.includes("--app-form-tooltip-width:clamp(240px,80vw,350px);"));
 assert.ok(css.includes("box-sizing:border-box;display:flex;flex-direction:column;"));
 assert.ok(css.includes("min-height:clamp(100px,29vw,114px);height:auto;max-height:min(60vh,260px);aspect-ratio:auto"));
 assert.ok(css.includes("overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain"));
 assert.ok(css.includes("pointer-events:none;padding:clamp(9px,3vw,13.5px) clamp(10px,3.4vw,15.8px);border:1px solid #537369"));
 assert.ok(css.includes("font-size:clamp(10px,2.8vw,12.5px);"));
 assert.ok(css.includes(".app-world-form-tooltip-score{font-size:clamp(15px,4.5vw,20.3px);"));
 // Width follows the viewport while height adapts to content and remains bounded.
 const responsiveTooltipWidth=viewport=>Math.max(240,Math.min(0.8*viewport,350));
 for(const [viewport,expectedWidth] of [[1280,350],[390,312],[320,256]]){
  const width=responsiveTooltipWidth(viewport);
  assert.equal(width,expectedWidth);
  assert.ok(width<=viewport-16);
  assert.ok(width>=240);
 }
 assert.ok(css.includes(".app-world-form-tooltip[hidden]{display:none}"));
 assert.ok(css.includes(".app-world-form-tooltip.is-closing{animation:app-world-tooltip-out 130ms ease-in both}"));
 assert.ok(css.includes("@keyframes app-world-tooltip-in{from{opacity:0;transform:translateY(6px) scale(.97)}"));
 assert.ok(css.includes("@keyframes app-world-tooltip-out{from{opacity:1;transform:translateY(0) scale(1)}"));
 assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.app-world-form-tooltip,.app-world-form-tooltip.is-closing{animation:none!important}"));
 assert.ok(css.includes(".app-world-form-tooltip-team{min-width:0;overflow-wrap:anywhere;white-space:normal;"));
 assert.ok(renderer.includes('tooltip.setAttribute("role","tooltip")'));
 assert.ok(renderer.includes('document.body.appendChild(tooltip)'));
 assert.ok(renderer.includes('active.setAttribute("aria-describedby",tooltip.id)'));
 assert.ok(renderer.includes('attachFormTooltips(clubs)'));
 assert.ok(renderer.includes('if (event.key === "Escape" && active)'));
 assert.ok(renderer.includes('isLatest ? " app-world-form-last" : ""'));
 assert.ok(renderer.includes("for (let i = form.length - 1; i >= 0; i--)"));
 assert.ok(read("assets/competition-model.js").includes("data.approved!==false"));
 assert.ok(read("assets/competition-model.js").includes("clubs.size===participantCount"));
 assert.ok(renderer.includes('document.createElement("tr")'));
 assert.ok(!renderer.includes("name.textContent = club.fullName"));
 assert.ok(renderer.includes("name.textContent = club.primaryName || club.abbr"));
 assert.ok(renderer.includes('createCrestHost(tr.dataset.worldClub)'));
 assert.ok(renderer.includes('crest.setAttribute("aria-hidden","true")'));
 assert.ok(renderer.includes("sourceUrl = document.currentScript?.src"));
 assert.ok(renderer.includes('script of ["landing.js","app.js","app-search.js","club-crests.js","competition-tabs.js","competition-history.js","competition-fixtures.js"]'));
 assert.ok(renderer.includes("start().catch(fail)"));
 assert.ok(code.includes("tabs.length!==views.length"));
 for(const key of ["ArrowRight","ArrowLeft","Home","End"])assert.ok(code.includes('"'+key+'"'));
 assert.ok(css.includes(".app-world-standing-scroll{max-width:100%;overflow-x:auto"));
 assert.ok(css.includes(".app-world-standing-table tr>*:first-child{position:sticky"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(2){position:sticky"));
 assert.ok(css.includes(".app-competition-panel[hidden]{display:none}"));
 assert.ok(css.includes(".app-world-flag-frame{display:inline-flex;width:24px;height:16px;flex:none}"));
 assert.ok(css.includes(".app-world-flag{display:block;width:24px;height:16px;flex:none;object-fit:fill;border:0;border-radius:0;clip-path:none}"));
 assert.ok(read("assets/flags/SOURCE.md").includes("Hampus Borgos country-flags"));
 assert.ok(read("assets/flags/SOURCE.md").includes("public domain"));
});

test("COMPETITIONS-06 keyboard and click controls preserve seven-tab routing",()=>{
 const code=read("assets/competition-tabs.js");
 assert.ok(code.includes('const views=model.views.map(view=>view.id)'));
 assert.ok(code.includes('tabs.forEach((tab,index)=>'));
 assert.ok(code.includes('tab.addEventListener("click",()=>set({view:views[index]}))'));
 assert.ok(code.includes('tab.addEventListener("keydown",event=>'));
 for(const key of ["ArrowRight","ArrowLeft","Home","End"])
  assert.ok(code.includes('event.key==="'+key+'"'),key);
 assert.ok(code.includes('event.preventDefault();set({view:views[next]},{focus:true})'));
 assert.ok(code.includes('panels[i].hidden=!active||!available'));
});

test("COMPETITIONS-06 loader parses as JavaScript and its route cannot bypass validation",async()=>{
 const {Script}=await import("node:vm");
 const runtime=read("assets/competition-page.js");
 assert.doesNotThrow(()=>new Script(runtime,{filename:"competition-page.js"}));
 assert.ok(runtime.includes('routeId.toLowerCase()'));
 assert.ok(runtime.includes("model.validManifest(manifest)"));
 assert.ok(read("assets/competition-model.js").includes("clubs.size===participantCount"));
 assert.ok(runtime.includes("start().catch(fail)"));
});


test("COMPETITIONS-08 removes all provisional standings filters and highlights points",()=>{
 const page=read("app/competitions/_shared/index.html");
 const css=read("assets/app.css"),app=read("assets/app.js"),tabs=read("assets/competition-tabs.js");
 const generator=read("tools/generate-app-pages.mjs");
 for(const text of ["app-standing-filters","app-standing-filter-status","No match data for the selected filters",
  "data-standing-filter=","standing-filter-options"]){
  assert.ok(!page.includes(text),text);
  assert.ok(!generator.includes(text),text);
  assert.ok(!css.includes(text),text);
  assert.ok(!tabs.includes(text),text);
 }
 for(const key of ["standingFilters","standingFilterLeg","standingFilterVenue",
 "standingFilterForm","standingFilterAll","standingFilterFirst","standingFilterSecond",
 "standingFilterHome","standingFilterAway","standingFilterLast5","standingFilterLast10","standingFilterUnavailable"]){
  assert.ok(!app.includes(key+":"),key);
 }
 assert.ok(page.includes('data-app-i18n="standingsPoints">Pts</th>'));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(10){background:#26473e"));
 assert.equal((page.match(/role="tab"/g)||[]).length,7);
 assert.equal((page.match(/<th scope="col"/g)||[]).length,11);
});

test("STANDINGS-LOGO-01 keeps one shared, responsive crest placeholder per club",()=>{
 const css=read("assets/app.css"),renderer=read("assets/competition-page.js");
 const generator=read("tools/generate-app-pages.mjs");
 const page=read("app/competitions/_shared/index.html");
 assert.ok(css.includes(".app-world-club-crest-placeholder{display:grid;place-items:center"));
 assert.ok(css.includes(".app-world-club-crest-placeholder::before{content:\"\";"));
 assert.ok(css.includes("@media(max-width:360px){.app-world-standing-table"));
 assert.ok(css.includes(".app-world-standing-table tr>*:first-child{position:sticky"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(2){position:sticky"));
 assert.ok(renderer.includes('createCrestHost(tr.dataset.worldClub)'));
 assert.ok(renderer.includes('crest.setAttribute("aria-hidden","true")'));
 assert.ok(renderer.includes("name.textContent = club.primaryName || club.abbr"));
 assert.ok(!renderer.includes("name.textContent = club.fullName"));
 assert.ok(read("assets/competition-page.js").includes('createCrestHost(tr.dataset.worldClub)'));
 assert.ok(!page.includes("app-world-club-crest-placeholder"));
 assert.equal((page.match(/<tr data-world-club=/g)||[]).length,0);
 for(const {division,file} of routes){
  const html=read(file);
  assert.ok(html.includes('data-division-variant="compact"'),division.id);
  assert.ok(!html.includes("app-world-club-crest-placeholder"),division.id);
 }
});

test("STANDINGS-RESPONSIVE-02 keeps roomy rows, larger crests and narrow sticky columns",()=>{
 const css=read("assets/app.css");
 assert.ok(css.includes(".app-world-standing-table{width:100%;min-width:766px;table-layout:fixed;"));
 assert.ok(css.includes(".app-world-standings{width:100%;max-width:100%;"));
  assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(n+3):nth-child(-n+10){width:55px;min-width:55px;max-width:55px}"));
  assert.ok(css.includes(".app-world-standing-table tr>*:last-child{width:140px;min-width:140px;max-width:140px}"));
  assert.ok(css.includes(".app-world-standing-table{min-width:696px}"));
  assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(n+3):nth-child(-n+10){width:50px;min-width:50px;max-width:50px}"));
  assert.ok(css.includes(".app-world-standing-table{min-width:686px}"));
  assert.ok(css.includes(".app-world-standing-table tbody tr>*{height:68px"));
 assert.ok(css.includes(".app-world-standing-table tbody tr>*{height:64px}"));
 assert.ok(!css.includes(".app-world-stat-positive"));
 assert.ok(!css.includes(".app-world-stat-negative"));
 assert.ok(!read("assets/competition-page.js").includes("app-world-stat-positive"));
 assert.ok(!read("assets/competition-page.js").includes("app-world-stat-negative"));
 assert.ok(css.includes(".app-world-standing-table thead th{height:36px"));
 assert.ok(css.includes("tr>*:first-child{position:sticky;left:0;z-index:2;width:38px;min-width:38px;max-width:38px"));
 assert.ok(css.includes("tr>*:nth-child(2){position:sticky;left:38px;z-index:2;width:auto;min-width:148px"));
 assert.ok(css.includes("tr>*:first-child{width:30px;min-width:30px;max-width:30px}"));
 assert.ok(css.includes("tr>*:nth-child(2){left:30px;min-width:126px}"));
 assert.ok(css.includes("@media(max-width:360px){.app-world-standing-table{min-width:686px}.app-world-standing-table tr>*:nth-child(2){min-width:116px}"));
 assert.ok(css.includes("flex:0 0 48px;width:48px;height:48px"));
 assert.ok(css.includes("flex-basis:40px;width:40px;height:40px"));
 assert.equal(manifest.divisions.flatMap(d=>d.clubs).length,256);
});

test("COMPETITIONS-08 uses approved canonical primary names for all 256 participants",()=>{
 const byId=new Map(clubs.map(c=>[c.countryId+":"+c.clubId,c]));
 for(const division of manifest.divisions)for(const club of division.clubs){
  const source=byId.get(club.countryId+":"+club.clubId);
  assert.ok(source);
  assert.equal(club.primaryName,source.primaryName);
  assert.equal(club.fullName,source.fullName);
  assert.equal(club.abbr,source.abbr);
 }
 assert.equal(manifest.divisions.flatMap(d=>d.clubs).length,256);
});

test("COMPETITIONS-ROUTE-02 uses the same inline flag markup on detail routes",()=>{
 const shared=read("app/competitions/_shared/index.html"),loader=read("assets/competition-page.js");
 const generator=read("tools/generate-app-pages.mjs");
 assert.ok(shared.includes('class="app-world-flag" id="app-competition-flag" aria-hidden="true" focusable="false" width="24" height="16"'));
 assert.ok(shared.includes('class="app-world-flag-frame" aria-hidden="true"'));
 assert.ok(!shared.includes('id="app-competition-flag" alt="" src='));
 assert.ok(loader.includes('flag.tagName.toLowerCase() !== "svg"'));
 assert.ok(generator.includes("inlineCountryFlag(c)"));
});

test("COMPETITION-TABS-UNIFORM-01: all seven tabs have identical widths in five languages",()=>{
 const css=read("assets/app.css"),app=read("assets/app.js");
 assert.ok(css.includes(".app-competition-tab{flex:0 0 112px;box-sizing:border-box;width:112px;min-width:112px;max-width:112px;"));
 assert.ok(css.includes("overflow:hidden;text-overflow:ellipsis;text-align:center"));
 assert.ok(css.includes(".app-competition-tabs{display:flex;gap:4px;overflow-x:auto"));
 assert.ok(css.includes("@media(max-width:620px){.app-competition-tabs{--app-competition-tab-mobile-width:max(92px,calc((100% - 8px)/2.5))}"));
 assert.ok(css.includes(".app-competition-tab{flex:0 0 var(--app-competition-tab-mobile-width);width:var(--app-competition-tab-mobile-width);min-width:var(--app-competition-tab-mobile-width);max-width:var(--app-competition-tab-mobile-width);min-height:34px;padding:7px 4px;font-size:clamp(10px,2.55vw,11px)"));
 for(const key of ["Standings","Fixtures","Stats","History","Rules","Awards"])
  assert.equal((app.match(new RegExp("competitionTab"+key+":","g"))||[]).length,5,key);
});

test("COMPETITION-MOBILE-RETURN-01: all-competitions back link is desktop-only",()=>{
 const css=read("assets/app.css"),shared=read("app/competitions/_shared/index.html");
 assert.ok(css.includes(".app-competition-return{display:inline-flex;"),"desktop link unchanged");
 assert.ok(css.includes("@media(max-width:620px){.app-competition-header{"));
 assert.ok(css.includes(".app-competition-return{display:none}"),"hidden on mobile");
 assert.ok(shared.includes('class="app-competition-return app-link app-link-secondary" href="/competitions"'));
});
