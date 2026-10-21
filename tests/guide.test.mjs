import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const html = read("guide/index.html");
const css = read("assets/guide.css");
const js = read("assets/landing.js");
const source = JSON.parse(read("data/divisions.json"));
const clubs = JSON.parse(read("data/clubs.json"));
const options = [...html.matchAll(/<div class="language-option" role="option" id="([^"]+)" data-language="([^"]+)" aria-selected="(?:true|false)">([^<]+)<\/div>/g)];
function mock(dataset = {}, content = "") {
  return { dataset, textContent:content, hidden:false, listeners:{},attributes:{},
    addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(k,v){this.attributes[k]=v;},
    removeAttribute(k){delete this.attributes[k];},focus(){},fire(name,ev={}){this.listeners[name]?.({key:"",preventDefault(){},...ev});}
  };
}
function render(saved = null) {
  const controls = options.map(o => mock({language:o[2]},o[3]));
  const guideLinks = [];
  controls.forEach((c,i)=>c.id=options[i][1]);
  const labels=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>mock({i18n:m[1]}));
  const trigger=mock(), menu=mock(),value=mock(),container=mock();menu.hidden=true;
  container.contains=element => [container,trigger,menu,...controls].includes(element);
  const ids={"language-control":container,"site-language":trigger,"language-value":value,"language-options":menu,
    "page-title":labels.find(label=>label.dataset.i18n==="guideTitle")};
  const document={documentElement:{lang:"en"},title:html.match(/<title>([^<]+)<\/title>/)?.[1]??"",
    getElementById:id=>ids[id]||null,
    querySelectorAll:selector=>selector==="[data-language]"?controls:selector==="[data-i18n]"?labels:selector==="[data-destination]"?[]:selector==="[data-guide-section]"?guideLinks:[],
    addEventListener(){}};
  const store = new Map(saved === null ? [] : [["football-architect:language",saved]]);
  const callbacks = {};
  const window={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},location:{hash:""},addEventListener:(k,cb)=>{callbacks[k]=cb;}};
  runInNewContext(js,{document,window},{timeout:2000});
  return {document,controls,labels,trigger,menu,value,store,guideLinks,window,callbacks};
}
test("GUIDE-02 has an index and eight dedicated chapters",()=>{
  assert.equal((html.match(/class="guide-card"/g)||[]).length,8);
  for(const id of ["world","divisions","clubs","movement","calendar","cups","records","explore"]){
    assert.match(html,new RegExp('href="/guide/'+id+'"'));
  }
  assert.doesNotMatch(html,/<section class="guide-section"/);
});
test("division and club definitions follow documented design scope",()=>{
  assert.equal(new Set(source.map(d=>d.countryId)).size,8);
  assert.equal(source.length,16);
  assert.ok(source.every(d=>d.capacity===16&&[1,2].includes(d.tier)));
  assert.equal(clubs.length,320);
  assert.ok(clubs.every(c=>/^[A-Z]{3}$/.test(c.abbr)));
});
test("same Landing language menu supports all five translations on Guide",()=>{
  assert.deepEqual(options.map(o=>o[2]),["en","de","es","fr","it"]);
  const r=render();
  assert.equal(r.document.documentElement.lang,"en");
  assert.equal(r.value.textContent,"English");
  assert.match(r.labels.find(l=>l.dataset.i18n==="guideDivisionsHeading").textContent,/Divisions/);
  for(const [i,lang] of ["en","de","es","fr","it"].entries()){
    r.trigger.fire("click");
    r.controls[i].fire("click");
    assert.equal(r.document.documentElement.lang,lang);
    assert.equal(r.store.get("football-architect:language"),lang);
    for(const label of r.labels)assert.ok(label.textContent.length>0,label.dataset.i18n);
  }
  assert.equal(render("de").labels.find(l=>l.dataset.i18n==="guideClubsHeading").textContent,"Vereine");
  assert.equal(render("unsupported").document.documentElement.lang,"en");
});
test("index navigation preserves canonical chapter links",()=>{
  assert.match(html, /href="\/guide\/world"/);
  assert.match(html, /href="\/guide\/explore"/);
  assert.match(css, /guide-card-grid/);
});
test("navigation, responsive layout and no duplicate language logic",()=>{
  assert.match(html,/href="\/" aria-label="Football Architect home"/);
  assert.match(html,/src="\/assets\/landing\.js"/);
  assert.match(html,/href="\/favicon\.ico"/);
  assert.match(css,/max-width:700px/);
  assert.match(css,/position:sticky/);
  assert.match(css,/grid-template-columns:210px minmax\(0,1fr\)/);
  assert.match(css,/guide-sidebar-link\[aria-current="location"\]/);
  assert.match(css,/focus-visible/);
  assert.doesNotMatch(css,/overflow-y:\s*(?:auto|scroll)/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html,/<script[^>]+guide\.js/);
});

test("ENG-ALL-ENGLISH-01 localizes Guide landmark names and document title", () => {
  for (const key of ["brandHome", "guideNavigation", "guideSections"]) {
    assert.match(html, new RegExp('data-i18n-aria="' + key + '"'));
  }
  assert.equal((html.match(/data-i18n-aria="guideSections"/g) || []).length, 2);
  assert.match(js, /document\.title = .*" — Football Architect"/);
  const words = {
    en: ["Guide", "Page navigation", "Guide sections"],
    de: ["Leitfaden", "Seitennavigation", "Leitfadenabschnitte"],
    es: ["Guía", "Navegación de la página", "Secciones de la guía"],
    fr: ["Guide", "Navigation de la page", "Sections du guide"],
    it: ["Guida", "Navigazione della pagina", "Sezioni della guida"]
  };
  for (const [lang, [title, nav, sections]] of Object.entries(words)) {
    assert.match(js, new RegExp('guideTitle:"' + title + '"'));
    assert.ok(js.includes('guideNavigation:"' + nav + '"'));
    assert.ok(js.includes('guideSections:"' + sections + '"'));
    assert.ok(["en","de","es","fr","it"].includes(lang));
  }
});

test("TITLE-FIX-01 localizes the Guide browser title on load and each language change", () => {
  assert.match(html, /<h1 id="page-title" data-i18n="guideTitle">Guide<\/h1>/);
  const titles = { en:"Guide", de:"Leitfaden", es:"Guía", fr:"Guide", it:"Guida" };
  const r = render();
  for (const [lang, title] of Object.entries(titles)) {
    r.trigger.fire("click");
    r.controls.find(option => option.dataset.language === lang).fire("click");
    assert.equal(r.document.documentElement.lang, lang);
    assert.equal(r.document.title, title + " — Football Architect", "selected " + lang);
    const stored = render(lang);
    assert.equal(stored.document.documentElement.lang, lang);
    assert.equal(stored.document.title, title + " — Football Architect", "saved " + lang);
  }
});

test("GUIDE-02 chapter copy exists across five languages",()=>{const ids=["guideIntro","guideWorldHeading","guideMovementHeading","guideCalendarHeading","guideCupsHeading","guideRecordsHeading","guideExploreHeading"];for(const id of ids){assert.match(html,new RegExp(`data-i18n="${id}"`));const r=render();for(const lang of ["en","de","es","fr","it"]){r.trigger.fire("click");r.controls.find(c=>c.dataset.language===lang).fire("click");assert.ok(r.labels.find(x=>x.dataset.i18n===id).textContent.length>0);}}});

test("GUIDE-02 complete translations and mobile layout",()=>{const keys=[...new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]))];for(const language of ["en","de","es","fr","it"]){const r=render(language);for(const key of keys){const labels=r.labels.filter(x=>x.dataset.i18n===key);assert.ok(labels.length,`${language}: ${key}`);for(const label of labels)assert.ok(label.textContent.trim(),`${language}: ${key} must not be empty`);}}assert.match(css,/@media\(max-width:700px\)/);assert.match(css, /max-width:350px/);});

test("GUIDE-02 world facts and stand-alone chapter paths",()=>{for(const id of ["world","divisions","clubs","movement","calendar","cups","records","explore"]){const page=read(`guide/${id}/index.html`);assert.match(page,new RegExp(`href="/guide/${id}"`));assert.match(page,/aria-current="page"/);assert.match(page,/<main class="guide-main/);assert.match(page,/assets\/landing\.js/);}const world=read("guide/world/index.html");for(const n of ["256","64","320","16"])assert.ok(world.includes(n));});

test("GUIDE-02 domestic divisions catalogue and translation hooks",()=>{const page=read("guide/divisions/index.html");const divisions=JSON.parse(read("data/divisions.json"));assert.equal((page.match(/class="guide-division-country"/g)||[]).length,8);assert.equal((page.match(/class="guide-tier-card"/g)||[]).length,16);for(const d of divisions){assert.ok(page.includes(d.name));assert.ok(page.includes('href="/competitions/'+d.countryId.toLowerCase()+'-'+d.tier+'"'));}for(const id of ["guideDivDetailFormat","guideDivDetailCaution","guideDivDetailCatalogueTitle","guideDivTier1","guideDivTier2"])assert.ok(page.includes('data-i18n="'+id+'"'));assert.match(css,/guide-tier-diagram/);assert.match(css,/guide-division-list/);});
