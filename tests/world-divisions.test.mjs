import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const divisions=JSON.parse(read("data/divisions.json")).divisions;
const countries=JSON.parse(read("data/divisions.json")).countries;
const allocation=JSON.parse(read("data/division-allocations.provisional.json"));
const clubs=JSON.parse(read("data/clubs.json")).clubs;
const primaryNames=JSON.parse(read("data/club-primary-names.documented.json")).names;
const manifest=JSON.parse(read("app/competitions/_shared/manifest.json"));
const logoIds=new Set(JSON.parse(read("data/division-assets.final.json")).divisions.map(d=>d.id));
const shared=read("app/competitions/_shared/index.html");
const index=read("app/competitions/index.html");
const routes=divisions.map(d=>({division:d,file:"app/competitions/"+d.id.toLowerCase()+"/index.html"}));
const cols=["standingsPosition","standingsClub","standingsPlayed","standingsWon",
 "standingsDrawn","standingsLost","standingsFor","standingsAgainst","standingsDifference",
 "standingsPoints","standingsForm"];
const views=["standings","fixtures","stats","history","rules","awards"];

test("COMPETITIONS-06 keeps the index and renders logos from the manifest",()=>{
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
  assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"'),division.id);
  assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"><span class="app-competition-logo-placeholder" aria-hidden="true">'+division.id+'</span>'),division.id);
 }
 assert.ok(index.includes('<script src="../../assets/division-logos.js" defer></script>'));
 assert.ok(!index.includes("assets/divisions/"),"logo asset paths must not be hardcoded in the HTML");
 const logoRenderer=read("assets/division-logos.js");
 assert.ok(logoRenderer.includes('fetch(manifestUrl'));
 assert.ok(logoRenderer.includes('division.visualAsset'));
 assert.ok(logoRenderer.includes('app-competition-logo-approved'));
 for(const division of manifest.divisions){
  if(logoIds.has(division.id))assert.ok(division.visualAsset,division.id);
 }
});

test("COMPETITIONS-06 replaces 16 full documents with tiny route entries",()=>{
 const common=["app/dashboard/index.html","app/calendar/index.html",
  "app/settings/index.html","app/competitions/index.html",
  "app/competitions/_shared/index.html"];
 for(const file of [...common,...routes.map(r=>r.file)]){
  const html=read(file),base=new URL("../"+file,import.meta.url);
  for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(href.startsWith("#")||href.startsWith("data:"))continue;
   assert.doesNotMatch(href,/^https?:/);
   const path=new URL(href,base);
   const filePath=path.pathname.endsWith("/")?new URL("index.html",path):path;
   assert.ok(existsSync(fileURLToPath(filePath)),file+" -> "+href);
  }
 }
 for(const {division,file} of routes){
  const html=read(file);
  assert.ok(html.length<1200,"route must remain small: "+file);
  assert.ok(html.includes('<meta name="fa-division" content="'+division.id+'">'),file);
  assert.ok(html.includes('<title>'+division.name.replaceAll("&","&amp;")+' — Football Architect</title>'),file);
  assert.ok(html.includes('src="../../../assets/competition-page.js" defer'),file);
  assert.ok(html.includes('role="status">Loading competition'),file);
  assert.ok(!html.includes('class="app-world-standing-table"'),file);
  assert.ok(!html.includes('class="fa-career-shell"'),file);
  assert.ok(!existsSync(new URL("../app/world/divisions/"+division.id.toLowerCase()+"/index.html",import.meta.url)));
 }
});

test("COMPETITIONS-06 shared manifest exactly reflects the canonical provisional data",()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.equal(manifest.approved,false);
 assert.equal(allocation.approved,false);
 assert.equal(manifest.divisions.length,16);
 const seen=new Set();
 for(let i=0;i<divisions.length;i++){
  const d=divisions[i],m=manifest.divisions[i],source=allocation.allocations[i];
  const country=countries.find(c=>c.id===d.countryId);
  assert.ok(country);assert.equal(m.id,d.id);
  assert.equal(m.name,d.name);assert.equal(m.tier,d.tier);
  assert.equal(m.capacity,d.capacity);assert.equal(m.countryId,d.countryId);
  assert.equal(m.countryName,country.name.en);assert.equal(m.flagAsset,country.flagAsset);
  assert.equal(source.divisionId,d.id);
  assert.equal(m.clubs.length,20);
  assert.deepEqual(m.clubs.map(c=>c.clubId),source.clubIds);
  for(const record of m.clubs){
   const club=clubs.find(c=>c.countryId===record.countryId&&c.clubId===record.clubId);
   const key=record.countryId+"-"+record.clubId;
   assert.ok(club,key);
   assert.deepEqual(record,{countryId:club.countryId,clubId:club.clubId,abbr:club.abbr,fullName:club.fullName,primaryName:club.approvedShortName||primaryNames[record.countryId+":"+record.clubId]||null});
   assert.ok(!seen.has(key),"duplicate "+key);
   seen.add(key);
  }
 }
 assert.equal(seen.size,320);
});

test("COMPETITIONS-06 shares one full shell, 11 standings columns and six tabs",()=>{
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
 assert.ok(shared.includes('class="app-competition-return app-link app-link-secondary" href="../" data-app-i18n="allDivisions"'));
 assert.equal((shared.match(/<th scope="col"/g)||[]).length,11);
 for(const key of cols)assert.ok(shared.includes('data-app-i18n="'+key+'"'),key);
 assert.equal((shared.match(/<tr data-world-club="/g)||[]).length,0);
 assert.equal((shared.match(/role="tab"/g)||[]).length,6);
 assert.equal((shared.match(/role="tabpanel"/g)||[]).length,6);
 assert.equal((shared.match(/role="tab"[^>]*aria-selected="true"/g)||[]).length,1);
 assert.equal((shared.match(/role="tab"[^>]*aria-selected="false"/g)||[]).length,5);
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
 assert.ok(css.includes("width:var(--app-form-tooltip-width);height:calc(var(--app-form-tooltip-width) * 0.4129032258064516);aspect-ratio:155/64;overflow:hidden;"));
 assert.ok(css.includes("pointer-events:none;padding:clamp(9px,3vw,13.5px) clamp(10px,3.4vw,15.8px);border:1px solid #537369"));
 assert.ok(css.includes("font-size:clamp(10px,2.8vw,12.5px);"));
 assert.ok(css.includes(".app-world-form-tooltip-score{font-size:clamp(15px,4.5vw,20.3px);"));
 // Aspect ratio must be determined by viewport width alone, never the names.
 const responsiveTooltipWidth=viewport=>Math.max(240,Math.min(0.8*viewport,350));
 for(const [viewport,expectedWidth] of [[1280,350],[390,312],[320,256]]){
  const width=responsiveTooltipWidth(viewport);
  const height=width*64/155;
  assert.equal(width,expectedWidth);
  assert.ok(Math.abs(width/height-155/64)<1e-10);
  assert.ok(width<=viewport-16);
 }
 assert.ok(css.includes(".app-world-form-tooltip[hidden]{display:none}"));
 assert.ok(css.includes(".app-world-form-tooltip.is-closing{animation:app-world-tooltip-out 130ms ease-in both}"));
 assert.ok(css.includes("@keyframes app-world-tooltip-in{from{opacity:0;transform:translateY(6px) scale(.97)}"));
 assert.ok(css.includes("@keyframes app-world-tooltip-out{from{opacity:1;transform:translateY(0) scale(1)}"));
 assert.ok(css.includes("@media(prefers-reduced-motion:reduce){.app-world-form-tooltip,.app-world-form-tooltip.is-closing{animation:none!important}"));
 assert.ok(css.includes(".app-world-form-tooltip-team{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"));
 assert.ok(renderer.includes('tooltip.setAttribute("role","tooltip")'));
 assert.ok(renderer.includes('document.body.appendChild(tooltip)'));
 assert.ok(renderer.includes('active.setAttribute("aria-describedby",tooltip.id)'));
 assert.ok(renderer.includes('attachFormTooltips(clubs)'));
 assert.ok(renderer.includes('if (event.key === "Escape" && active)'));
 assert.ok(renderer.includes('isLatest ? " app-world-form-last" : ""'));
 assert.ok(renderer.includes("for (let i = form.length - 1; i >= 0; i--)"));
 assert.ok(renderer.includes("data.approved !== false"));
 assert.ok(renderer.includes("clubs.size === 320"));
 assert.ok(renderer.includes('document.createElement("tr")'));
 assert.ok(renderer.includes("name.textContent = club.primaryName"));
 assert.ok(!renderer.includes("name.textContent = club.fullName"));
 assert.ok(renderer.includes("name.textContent = club.primaryName || club.abbr"));
 assert.ok(renderer.includes('crest.dataset.clubCrest = tr.dataset.worldClub'));
 assert.ok(renderer.includes('crest.setAttribute("aria-hidden", "true")'));
 assert.ok(renderer.includes("sourceUrl = document.currentScript?.src"));
 assert.ok(renderer.includes('script of ["landing.js","app.js","app-search.js","competition-tabs.js"]'));
 assert.ok(renderer.includes("start().catch(fail)"));
 assert.ok(code.includes("tabs.length !== 6"));
 for(const key of ["ArrowRight","ArrowLeft","Home","End"])assert.ok(code.includes('event.key === "'+key+'"'));
 assert.ok(css.includes(".app-world-standing-scroll{max-width:100%;overflow-x:auto"));
 assert.ok(css.includes(".app-world-standing-table tr>*:first-child{position:sticky"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(2){position:sticky"));
 assert.ok(css.includes(".app-competition-panel[hidden]{display:none}"));
 assert.ok(css.includes(".app-world-flag{width:28px;height:20px;object-fit:contain;flex:none;border-radius:6px}"));
 assert.ok(read("assets/flags/LICENSE").includes("MIT License"));
});

test("COMPETITIONS-06 keyboard and click controls still isolate one of six tabs",async()=>{
 const {runInNewContext}=await import("node:vm");
 const tabs=Array.from({length:6},(_,i)=>{
  const listeners={},selected={};
  return {
   listeners,selected,tabIndex:i===0?0:-1,focused:false,scrolled:false,
   classList:{toggle(name,on){selected[name]=on}},
   getAttribute(name){return name==="aria-controls"?"competition-panel-"+i:null},
   setAttribute(name,value){selected[name]=value},
   addEventListener(name,listener){listeners[name]=listener},
   focus(){this.focused=true},scrollIntoView(){this.scrolled=true}
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
 let prevented=false;
 tabs[3].listeners.keydown({key:"ArrowRight",preventDefault(){prevented=true}});
 assert.ok(prevented);assert.equal(tabs[4].focused,true);
 assert.equal(tabs[4].scrolled,true);assert.equal(panels[4].hidden,false);
 tabs[4].listeners.keydown({key:"Home",preventDefault(){}});
 assert.equal(panels[0].hidden,false);
 tabs[0].listeners.keydown({key:"ArrowLeft",preventDefault(){}});
 assert.equal(panels[5].hidden,false);
 assert.equal(panels.filter(p=>!p.hidden).length,1);
});

test("COMPETITIONS-06 loader parses as JavaScript and its route cannot bypass validation",async()=>{
 const {Script}=await import("node:vm");
 const runtime=read("assets/competition-page.js");
 assert.doesNotThrow(()=>new Script(runtime,{filename:"competition-page.js"}));
 assert.ok(runtime.includes('routeId.toLowerCase()'));
 assert.ok(runtime.includes("data.approved !== false"));
 assert.ok(runtime.includes("clubs.size === 320"));
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
 assert.equal((page.match(/role="tab"/g)||[]).length,6);
 assert.equal((page.match(/<th scope="col"/g)||[]).length,11);
});

test("STANDINGS-LOGO-01 keeps one shared, responsive crest placeholder per club",()=>{
 const css=read("assets/app.css"),renderer=read("assets/competition-page.js");
 const generator=read("tools/generate-app-pages.mjs");
 const page=read("app/competitions/_shared/index.html");
 assert.ok(css.includes(".app-world-club-crest-placeholder{display:grid;place-items:center"));
 assert.ok(css.includes(".app-world-club-crest-placeholder::before{content:\"\";"));
 assert.ok(css.includes("@media(max-width:360px){.app-world-standing-table"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(10){background:#26473e"));
 assert.ok(css.includes(".app-world-standing-table tr>*:first-child{position:sticky"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(2){position:sticky"));
 assert.ok(renderer.includes('crest.dataset.clubCrest = tr.dataset.worldClub'));
 assert.ok(renderer.includes('crest.setAttribute("aria-hidden", "true")'));
 assert.ok(renderer.includes("name.textContent = club.primaryName || club.abbr"));
 assert.ok(!renderer.includes("name.textContent = club.fullName"));
 assert.ok(generator.includes('class="app-world-club-crest-placeholder" data-club-crest='));
 assert.equal((page.match(/<th scope="col"/g)||[]).length,11);
 assert.ok(!page.includes("app-world-club-crest-placeholder"));
 assert.equal((page.match(/<tr data-world-club=/g)||[]).length,0);
 for(const {division,file} of routes){
  const html=read(file);
  assert.ok(html.length<1200,division.id);
  assert.ok(!html.includes("app-world-club-crest-placeholder"),division.id);
 }
});

test("STANDINGS-RESPONSIVE-02 keeps compact rows, crests and narrow sticky columns",()=>{
 const css=read("assets/app.css");
 assert.ok(css.includes(".app-world-standing-table{width:100%;min-width:766px;table-layout:fixed;"));
 assert.ok(css.includes(".app-world-standings{width:100%;max-width:100%;"));
  assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(n+3):nth-child(-n+10){width:55px;min-width:55px;max-width:55px}"));
  assert.ok(css.includes(".app-world-standing-table tr>*:last-child{width:140px;min-width:140px;max-width:140px}"));
  assert.ok(css.includes(".app-world-standing-table{min-width:696px}"));
  assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(n+3):nth-child(-n+10){width:50px;min-width:50px;max-width:50px}"));
  assert.ok(css.includes(".app-world-standing-table{min-width:686px}"));
  assert.ok(css.includes(".app-world-standing-table tbody tr>*{height:40px"));
 assert.ok(css.includes(".app-world-standing-table tbody tr>*{height:38px}"));
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
 assert.ok(css.includes("flex:0 0 26px;width:26px;height:28px"));
 assert.ok(css.includes("flex-basis:24px;width:24px;height:26px"));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(10){background:#26473e"));
 assert.equal(manifest.divisions.flatMap(d=>d.clubs).length,320);
});

test("COMPETITIONS-08 uses only documented primary names, never inferred shortened names",()=>{
 const canonical=clubs;
 const byId=new Map(canonical.map(c=>[c.countryId+":"+c.clubId,c]));
 const explicit=canonical.filter(c=>c.approvedShortName);
 assert.equal(Object.keys(primaryNames).length,315);
 assert.equal(explicit.length,6);
 let named=0,abbreviationOnly=0;
 for(const d of manifest.divisions){
  for(const c of d.clubs){
   const key=c.countryId+":"+c.clubId,source=byId.get(key);
   assert.ok(source);
   assert.equal(c.primaryName,source.approvedShortName||primaryNames[key]||null,key);
   assert.equal(c.fullName,source.fullName,key);
   if(c.primaryName)named++;else abbreviationOnly++;
  }
 }
 assert.equal(named,320);
 assert.equal(abbreviationOnly,0);
 for(const [key,name] of Object.entries(primaryNames)){
  assert.ok(byId.has(key),key);
  assert.ok(typeof name==="string"&&name.trim(),key);
  const source=byId.get(key);
  if(source.approvedShortName)assert.equal(name,source.approvedShortName,key);
 }
});

test("CLUB-PRIMARY-239-01 preserves six reconciliations and an independent A03 audit",()=>{
 const catalog=read("data/clubs.json");
 const source=JSON.parse(catalog).clubs;
 const primary=JSON.parse(read("data/club-primary-names.documented.json"));
 const unique=new Set();
 assert.equal(primary.schemaVersion,1);
 assert.equal(Object.keys(primary.names).length,315);
 assert.equal(source.length,320);
 const expectedSix={
  "IT:1":"US Velaria Torino","IT:2":"AC Rinascenti Bologna",
  "FR:27":"FC Émaux","FR:33":"CS Garrigues",
  "PT:34":"AC Fontes","BR:16":"EC Falésia Clara"
 };
 assert.deepEqual(Object.fromEntries(source.filter(c=>c.approvedShortName)
   .map(c=>[c.countryId+":"+c.clubId,c.approvedShortName])),expectedSix);
 for(const c of source){
  const key=c.countryId+":"+c.clubId,name=c.approvedShortName||primary.names[key];
  assert.ok(typeof name==="string"&&name.trim(),key);
  const normalized=name.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  assert.ok(!unique.has(normalized),"Duplicate primary label: "+name);
  unique.add(normalized);
 }
 assert.equal(unique.size,320);
 const audit=read("docs/clubs/a03-label-variants.en.md");
 const differences=[...audit.matchAll(/^\|\s*((?:ENG|ES|DE)-\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm)];
 assert.equal(differences.length,41);
 assert.equal(differences.filter(x=>x[1].startsWith("ENG-")).length,2);
 assert.equal(differences.filter(x=>x[1].startsWith("ES-")).length,19);
 assert.equal(differences.filter(x=>x[1].startsWith("DE-")).length,20);
 assert.equal(new Set(differences.map(x=>x[1])).size,41);
 assert.ok(!/^\|\s*IT-02\s*\|/m.test(audit));
 const it02=manifest.divisions.flatMap(d=>d.clubs).find(c=>c.countryId==="IT"&&c.clubId===2);
 assert.equal(it02?.primaryName,"AC Rinascenti Bologna");
 assert.equal(it02?.abbr,"RIN");
});

test("COMPETITIONS-ROUTE-02 resolves flags from the three-level competition path",()=>{
 const shared=read("app/competitions/_shared/index.html"),loader=read("assets/competition-page.js");
 const generator=read("tools/generate-app-pages.mjs");
 assert.ok(shared.includes('id="app-competition-flag" alt="" src="../../../assets/flags/it.svg"'));
 assert.ok(!shared.includes('id="app-competition-flag" alt="" src="../../../../'));
 assert.ok(loader.includes('document.getElementById("app-competition-flag").src = "../../../" + division.flagAsset'));
 assert.ok(generator.includes('id="app-competition-flag" alt="" src="../../../'));
});

test("COMPETITION-TABS-UNIFORM-01: all six tabs have identical widths in five languages",()=>{
 const css=read("assets/app.css"),app=read("assets/app.js");
 assert.ok(css.includes(".app-competition-tab{flex:0 0 112px;box-sizing:border-box;width:112px;min-width:112px;max-width:112px;"));
 assert.ok(css.includes("overflow:hidden;text-overflow:ellipsis;text-align:center"));
 assert.ok(css.includes(".app-competition-tabs{display:flex;gap:4px;overflow-x:auto"));
 assert.ok(css.includes("@media(max-width:620px){.app-competition-tabs{--app-competition-tab-mobile-width:clamp(92px,24.5vw,108px)}"));
 assert.ok(css.includes(".app-competition-tab{flex:0 0 var(--app-competition-tab-mobile-width);width:var(--app-competition-tab-mobile-width);min-width:var(--app-competition-tab-mobile-width);max-width:var(--app-competition-tab-mobile-width);min-height:34px;padding:7px 4px;font-size:clamp(10px,2.55vw,11px)"));
 const mobileWidth=vw=>Math.max(92,Math.min(vw*.245,108));
 assert.equal(mobileWidth(320),92);
 assert.ok(Math.abs(mobileWidth(390)-95.55)<.01);
 assert.equal(mobileWidth(620),108);
 for(const key of ["Standings","Fixtures","Stats","History","Rules","Awards"])
  assert.equal((app.match(new RegExp("competitionTab"+key+":","g"))||[]).length,5,key);
});

test("COMPETITION-MOBILE-RETURN-01: all-competitions back link is desktop-only",()=>{
 const css=read("assets/app.css"),shared=read("app/competitions/_shared/index.html");
 assert.ok(css.includes(".app-competition-return{display:inline-flex;"),"desktop link unchanged");
 assert.ok(css.includes("@media(max-width:620px){.app-competition-header{"));
 assert.ok(css.includes(".app-competition-return{display:none}"),"hidden on mobile");
 assert.ok(shared.includes('class="app-competition-return app-link app-link-secondary" href="../"'));
});
