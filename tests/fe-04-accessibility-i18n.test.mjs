import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("FE-04 preserves native labels, keyboard bypass and visible focus tokens",()=>{
 const theme=read("assets/theme.js"),site=read("assets/landing.js"),css=read("assets/landing.css");
 assert.doesNotMatch(theme,/target\.closest\('label'\)/);
 assert.match(site,/mainContent\.focus\(\)/);
 assert.match(site,/skip\.dataset\.i18n = "skipMain"/);
 assert.match(css,/\.fa-skip-link:focus-visible\{transform:none;outline:2px solid var\(--focus\)/);
 assert.match(css,/html body \.app-search-trigger\.app-search-escape-return:focus-visible\{outline:2px solid var\(--focus\)/);
 for(const name of ["Skip to main content","Zum Hauptinhalt springen","Saltar al contenido principal","Aller au contenu principal","Vai al contenuto principale"])assert.ok(site.includes('skipMain:"'+name+'"'),name);
});
test("FE-04 shared combobox Escape restores trigger focus and Tab uses native traversal",()=>{
 const source=read("assets/competition-tabs.js");
 assert.doesNotMatch(source,/trigger\.blur\(\)|search\?\.blur\(\)/);
 const handlers={},doc={activeElement:null,documentElement:{lang:"en"},querySelector:()=>null,addEventListener(){}},context={window:{},document:doc};
 const attrs=new Map(),trigger={disabled:false,addEventListener(k,fn){handlers[k]=fn},setAttribute(k,v){attrs.set(k,v)},getAttribute(k){return attrs.get(k)},removeAttribute(k){attrs.delete(k)},focus(){doc.activeElement=this}};
 const menu={hidden:true},option={hidden:false,id:"fe04-option",dataset:{menuValue:"1"},textContent:"Season 1",scrollIntoView(){},addEventListener(){}};
 runInNewContext(source,context);
 trigger.focus();context.window.faBindCompetitionMenu(trigger,menu,[option],()=>{}, {contains:()=>true});
 handlers.click();assert.equal(menu.hidden,false);
 handlers.keydown({key:"Escape",preventDefault(){},target:trigger});
 assert.equal(menu.hidden,true);assert.equal(attrs.get("aria-expanded"),"false");assert.equal(doc.activeElement,trigger);
 handlers.click();handlers.keydown({key:"Tab",target:trigger});assert.equal(menu.hidden,true);
});
test("FE-04 separates five-locale fixture accessible list name from displayed count",()=>{
 const app=read("assets/app.js"),fixtures=read("assets/competition-fixtures.js");
 assert.equal([...app.matchAll(/^\s{6}fixturesMatches:/gm)].length,5);
 assert.equal([...app.matchAll(/^\s{6}fixturesMatchUnit:/gm)].length,5);
 assert.match(fixtures,/word\('fixturesMatchUnit','matches'\)/);
 for(const id of ["it-1","int-1"]){const html=read("competitions/"+id+"/index.html");assert.match(html,/data-app-aria="fixturesMatches"/);assert.equal((html.match(/role="tab" /g)||[]).length,7)}
});
test("FE-04 localizes early errors, singular counters and Calendar marker names",()=>{
 const fail=read("assets/competition-page.js"),search=read("assets/app-search.js"),club=read("assets/clubs-directory.js"),cal=read("assets/calendar-simplified.js");
 assert.doesNotMatch(fail,/document\.createElement\("main"\)/);assert.match(fail,/message\.setAttribute\("role", "alert"\)/);
 for(const name of ["Competition unavailable.","Wettbewerb nicht verfügbar.","Competición no disponible.","Compétition indisponible.","Competizione non disponibile."])assert.ok(fail.includes(name));
 assert.match(search,/matches\.length === 1 \? strings\.resultSingular : strings\.results/);
 assert.match(search,/matches\.length === 1 \? strings\.suggestionSingular : strings\.suggestions/);
 assert.match(club,/labels\[hits\.length===1\?9:7\]/);
 assert.match(cal,/refreshMarkerLabels\(\)/);assert.match(cal,/Federation Cup '\+calendarTexts\(\)\.final/);
 assert.match(cal,/marker\.addEventListener\('focusin',\(\)=>\{if\(!window\.matchMedia/);
});
