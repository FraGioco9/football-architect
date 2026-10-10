import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const html = read("guide/index.html");
const css = read("assets/guide.css");
const js = read("assets/landing.js");
const source = JSON.parse(read("data/divisions.json"));
const clubs = JSON.parse(read("data/clubs.json")).clubs;
const options = [...html.matchAll(/<div class="language-option" role="option" id="([^"]+)" data-language="([^"]+)" aria-selected="(?:true|false)">([^<]+)<\/div>/g)];
function mock(dataset = {}, content = "") {
  return { dataset, textContent:content, hidden:false, listeners:{},attributes:{},
    addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(k,v){this.attributes[k]=v;},
    removeAttribute(k){delete this.attributes[k];},focus(){},fire(name,ev={}){this.listeners[name]?.({key:"",preventDefault(){},...ev});}
  };
}
function render(saved = null) {
  const controls = options.map(o => mock({language:o[2]},o[3]));
  const guideLinks = ["divisions","clubs"].map(id=>mock({guideSection:id},id));
  controls.forEach((c,i)=>c.id=options[i][1]);
  const labels=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>mock({i18n:m[1]}));
  const trigger=mock(), menu=mock(),value=mock(),container=mock();menu.hidden=true;
  container.contains=element => [container,trigger,menu,...controls].includes(element);
  const ids={"language-control":container,"site-language":trigger,"language-value":value,"language-options":menu};
  const document={documentElement:{lang:"en"},getElementById:id=>ids[id]||null,
    querySelectorAll:selector=>selector==="[data-language]"?controls:selector==="[data-i18n]"?labels:selector==="[data-destination]"?[]:selector==="[data-guide-section]"?guideLinks:[],
    addEventListener(){}};
  const store = new Map(saved === null ? [] : [["football-architect:language",saved]]);
  const callbacks = {};
  const window={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},location:{hash:""},addEventListener:(k,cb)=>{callbacks[k]=cb;}};
  runInNewContext(js,{document,window},{timeout:2000});
  return {document,controls,labels,trigger,menu,value,store,guideLinks,window,callbacks};
}
test("simple concept guide has only Divisions and Clubs",()=>{
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.equal((html.match(/<section class="guide-section"/g)||[]).length,2);
  assert.equal((html.match(/<h2\b/g)||[]).length,2);
  for(const key of ["guideDivisionsHeading","guideDivisionsText1","guideDivisionsText2","guideClubsHeading","guideClubsText1","guideClubsText2"]) assert.match(html,new RegExp('data-i18n="'+key+'"'));
  assert.doesNotMatch(html,/catalog-search|country-filter|type-filter|atlas-results|country-index|documented clubs|data\/clubs\.json|data\/divisions\.json/i);
  assert.doesNotMatch(js,/fetch\(|querySelectorAll\("\.club/);
});
test("division and club definitions follow documented design scope",()=>{
  assert.equal(source.countries.length,8);
  assert.equal(source.divisions.length,16);
  assert.ok(source.divisions.every(d=>d.capacity===20&&[1,2].includes(d.tier)));
  assert.equal(clubs.length,320);
  assert.ok(clubs.every(c=>/^[A-Z]{3}$/.test(c.abbr)));
});
test("same Landing language menu supports all five translations on Guide",()=>{
  assert.deepEqual(options.map(o=>o[2]),["en","de","es","fr","it"]);
  const r=render();
  assert.equal(r.document.documentElement.lang,"en");
  assert.equal(r.value.textContent,"English");
  assert.match(r.labels.find(l=>l.dataset.i18n==="guideDivisionsText1").textContent,/first division/);
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
test("sidebar links, selection and hash navigation are synchronized",()=>{
  assert.match(html,/<aside class="guide-sidebar"/);
  assert.match(html,/<nav class="guide-sidebar-nav"/);
  for(const id of ["divisions","clubs"]){
    assert.match(html,new RegExp('href="#'+id+'" data-guide-section="'+id+'"'));
    assert.match(html,new RegExp('<section class="guide-section" id="'+id+'"'));
  }
  const r=render();
  assert.equal(r.guideLinks[0].attributes["aria-current"],"location");
  assert.equal(r.guideLinks[1].attributes["aria-current"],undefined);
  r.guideLinks[1].fire("click");
  assert.equal(r.guideLinks[1].attributes["aria-current"],"location");
  assert.equal(r.guideLinks[0].attributes["aria-current"],undefined);
  r.window.location.hash="#divisions";
  r.callbacks.hashchange();
  assert.equal(r.guideLinks[0].attributes["aria-current"],"location");
  r.window.location.hash="#unknown";
  r.callbacks.hashchange();
  assert.equal(r.guideLinks[0].attributes["aria-current"],"location");
});
test("navigation, responsive layout and no duplicate language logic",()=>{
  assert.match(html,/href="\.\.\/"/);
  assert.match(html,/src="\.\.\/assets\/landing\.js"/);
  assert.match(html,/href="\.\.\/favicon\.ico"/);
  assert.match(css,/max-width:700px/);
  assert.match(css,/position:sticky/);
  assert.match(css,/grid-template-columns:210px minmax\(0,1fr\)/);
  assert.match(css,/guide-sidebar-link\[aria-current="location"\]/);
  assert.match(css,/focus-visible/);
  assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
  assert.doesNotMatch(html,/<script[^>]+guide\.js/);
});

test("ENG-ALL-ENGLISH-01 localizes Guide landmark names and document title", () => {
  for (const key of ["brandHome", "guideNavigation", "guideSections"]) {
    assert.match(html, new RegExp('data-i18n-aria="' + key + '"'));
  }
  assert.equal((html.match(/data-i18n-aria="guideSections"/g) || []).length, 2);
  assert.match(js, /document\.title = copy\.guideTitle \+ " — Football Architect"/);
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
