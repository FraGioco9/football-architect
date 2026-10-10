import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const divisions=JSON.parse(read("data/divisions.json")).divisions;
const countries=JSON.parse(read("data/divisions.json")).countries;
const allocation=JSON.parse(read("data/division-allocations.provisional.json"));
const clubs=JSON.parse(read("data/clubs.json")).clubs;
const manifest=JSON.parse(read("app/world/competitions/_shared/manifest.json"));
const shared=read("app/world/competitions/_shared/index.html");
const index=read("app/world/competitions/index.html");
const routes=divisions.map(d=>({division:d,file:"app/world/competitions/"+d.id.toLowerCase()+"/index.html"}));
const cols=["standingsPosition","standingsClub","standingsPlayed","standingsWon",
 "standingsDrawn","standingsLost","standingsFor","standingsAgainst","standingsDifference",
 "standingsPoints","standingsForm"];
const views=["standings","fixtures","stats","history","rules","awards"];

test("COMPETITIONS-06 keeps the index and 16 deep links",()=>{
 assert.equal(countries.length,8);
 assert.equal(divisions.length,16);
 assert.equal((index.match(/class="app-division-card"/g)||[]).length,16);
 assert.ok(index.includes('data-app-i18n="navCompetitions">Competitions'));
 assert.ok(index.includes("<title>Competitions — Football Architect</title>"));
 assert.ok(!existsSync(new URL("../app/world/divisions/index.html",import.meta.url)));
 for(const c of countries)assert.ok(index.includes('id="world-country-'+c.id.toLowerCase()+'"'));
 for(const {division} of routes){
  assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"'),division.id);
  assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"><span class="app-competition-logo-placeholder" aria-hidden="true">'+division.id+'</span>'),division.id);
 }
});

test("COMPETITIONS-06 replaces 16 full documents with tiny route entries",()=>{
 const common=["app/dashboard/index.html","app/calendar/index.html",
  "app/settings/index.html","app/world/competitions/index.html",
  "app/world/competitions/_shared/index.html"];
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
  assert.ok(html.includes('src="../../../../assets/competition-page.js" defer'),file);
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
   assert.deepEqual(record,{countryId:club.countryId,clubId:club.clubId,abbr:club.abbr,fullName:club.fullName});
   assert.ok(!seen.has(key),"duplicate "+key);
   seen.add(key);
  }
 }
 assert.equal(seen.size,320);
});

test("COMPETITIONS-06 shares one full shell, 11 standings columns and six tabs",()=>{
 assert.ok(shared.includes('<main class="app-main" id="main-content" tabindex="-1">'));
 assert.ok(shared.includes('id="app-nav-divisions"'));
 assert.ok(shared.includes('id="app-search-dialog"'));
 assert.ok(shared.includes('id="division-detail-name">Competition</span>'));
 for(const id of ["app-competition-badge","app-competition-flag","app-competition-country",
  "app-competition-tier","app-competition-capacity","app-competition-level","app-standings-body"]){
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
 for(const key of ["standingsForm","standingsTable","competitionViews"]){
  assert.equal((app.match(new RegExp("\\b"+key+":","g"))||[]).length,5,key);
 }
 assert.ok(renderer.includes("data.approved !== false"));
 assert.ok(renderer.includes("clubs.size === 320"));
 assert.ok(renderer.includes('document.createElement("tr")'));
 assert.ok(renderer.includes("name.textContent = club.fullName"));
 assert.ok(renderer.includes("abbr.textContent = club.abbr"));
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

test("COMPETITIONS-07 highlights points and exposes shared, translated standings filters",()=>{
 const page=read("app/world/competitions/_shared/index.html");
 const css=read("assets/app.css"),app=read("assets/app.js");
 const groups={leg:["all","first","second"],venue:["all","home","away"],form:["all","last5","last10"]};
 const labels=["standingFilters","standingFilterLeg","standingFilterVenue","standingFilterForm",
  "standingFilterAll","standingFilterFirst","standingFilterSecond","standingFilterHome",
  "standingFilterAway","standingFilterLast5","standingFilterLast10","standingFilterUnavailable"];
 for(const key of labels)
  assert.equal((app.match(new RegExp("\\b"+key+":","g"))||[]).length,5,key);
 for(const [group,values] of Object.entries(groups)){
  for(const value of values){
   assert.equal((page.match(new RegExp('data-standing-filter="'+group+'" data-standing-value="'+value+'"',"g"))||[]).length,1,group+":"+value);
  }
 }
 assert.equal((page.match(/class="app-standing-filter-group"/g)||[]).length,3);
 assert.equal((page.match(/aria-pressed="true"/g)||[]).length,3);
 assert.equal((page.match(/aria-pressed="false"/g)||[]).length,6);
 assert.ok(page.includes('id="app-standing-filter-status" role="status" data-app-i18n="standingFilterUnavailable" hidden'));
 assert.ok(page.includes('data-app-i18n="standingsPoints">Pts</th>'));
 assert.ok(css.includes(".app-world-standing-table tr>*:nth-child(10){background:#26473e"));
 assert.ok(css.includes(".app-standing-filter-button:focus-visible"));
 assert.ok(css.includes("@media(max-width:620px){.app-standing-filters"));
 for(const division of divisions){
  const route=read("app/world/competitions/"+division.id.toLowerCase()+"/index.html");
  assert.ok(!route.includes("app-standing-filters"),division.id);
 }
});

test("COMPETITIONS-07 scopes filter selections without fabricating match data",async()=>{
 const {runInNewContext}=await import("node:vm");
 const selected={},labels={},groups=["leg","venue","form"];
 const buttons=groups.flatMap(group=>(group==="leg"?["all","first","second"]:group==="venue"?["all","home","away"]:["all","last5","last10"]).map(value=>{
  const events={},state={active:value==="all",pressed:value==="all"?"true":"false"};
  const button={
   dataset:{standingFilter:group,standingValue:value},events,state,
   classList:{toggle(name,on){if(name==="is-active")state.active=on}},
   setAttribute(name,v){if(name==="aria-pressed")state.pressed=v},
   addEventListener(name,fn){events[name]=fn}
  };
  labels[group+":"+value]=button;
  return button;
 }));
 const tabs=Array.from({length:6},(_,i)=>{
  const attrs={},events={};
  return {events,tabIndex:i===0?0:-1,classList:{toggle(){}},getAttribute(){return "panel-"+i},
   setAttribute(name,value){attrs[name]=value},addEventListener(name,fn){events[name]=fn}};
 });
 const panels=Array.from({length:6},()=>({hidden:false})),status={hidden:true};
 const document={
  querySelector(selector){
   if(selector===".app-competition-tabs")return {querySelectorAll(){return tabs}};
   if(selector===".app-standing-filters")return {querySelectorAll(){return buttons}};
   return null;
  },
  getElementById(id){
   return id==="app-standing-filter-status"?status:panels[Number(id.replace("panel-",""))]??null;
  }
 };
 runInNewContext(read("assets/competition-tabs.js"),{document});
 labels["leg:first"].events.click();
 assert.equal(labels["leg:first"].state.pressed,"true");
 assert.equal(labels["leg:all"].state.pressed,"false");
 assert.equal(status.hidden,false);
 labels["venue:away"].events.click();
 labels["form:last5"].events.click();
 assert.equal(labels["venue:away"].state.active,true);
 assert.equal(labels["form:last5"].state.active,true);
 assert.equal(labels["leg:first"].state.active,true);
 labels["leg:all"].events.click();
 labels["venue:all"].events.click();
 assert.equal(status.hidden,false);
 labels["form:all"].events.click();
 assert.equal(status.hidden,true);
 for(const group of groups)
  assert.equal(buttons.filter(b=>b.dataset.standingFilter===group&&b.state.pressed==="true").length,1,group);
 assert.equal(panels.filter(x=>!x.hidden).length,1);
});
