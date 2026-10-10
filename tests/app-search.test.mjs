import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read = file => readFileSync(new URL("../"+file,import.meta.url),"utf8");
const pages = ["app/index.html","app/calendar/index.html","app/settings/index.html"];
const html = Object.fromEntries(pages.map(path => [path,read(path)]));
const script = read("assets/app-search.js");
const css = read("assets/app.css");

test("SEARCH-01 identical searchable top bar and native dialog on all three static pages",()=>{
  for(const [path,source] of Object.entries(html)){
    for(const id of ["app-search-trigger","app-search-dialog","app-search-input","app-search-close","app-search-results","app-search-status","app-search-empty","app-search-heading"]){
      assert.equal((source.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,path+" "+id);
    }
    assert.match(source, /<dialog id="app-search-dialog"[^>]+aria-labelledby="app-search-heading"/);
    assert.match(source, /aria-haspopup="dialog" aria-controls="app-search-dialog"/);
    assert.match(source, /role="status" aria-live="polite"/);
    assert.ok(source.includes('src="'+(path==="app/index.html"?"../":"../../")+'assets/app-search.js" defer'));
    assert.match(source, /<div class="fa-shell-search">[\s\S]*?<div class="fa-shell-time"/);
    assert.doesNotMatch(source, /href="[^"]*#(?:calendar|settings)"/);
  }
});

test("SEARCH-01 responsive and accessible animation contracts",()=>{
  for(const key of [".fa-shell-search",".app-search-trigger",".app-search-dialog",".app-search-panel",
    ".app-search-results",".app-search-result:focus-visible","@keyframes app-search-in",
    "@keyframes app-search-out","@media(max-width:390px)",
    "@media(prefers-reduced-motion:reduce)"]) assert.ok(css.includes(key),key);
  assert.match(css,/\.app-search-trigger span\{display:none\}/);
  assert.match(css,/\.fa-shell-search\{flex:0 1 330px;min-width:0\}/);
  assert.match(css,/@media\(min-width:1025px\)\{\.fa-shell-club,\.fa-shell-time\{flex:1 1 0\}\.fa-shell-time\{justify-content:flex-end\}\}/);
  assert.match(css,/@media\(max-width:1024px\)\{\s*\.fa-shell-search\{flex:0 0 38px\}/);
  assert.match(css,/\.app-search-results\[hidden\]\{display:none\}/);
  assert.match(css,/\.app-search-dialog\.is-closing \.app-search-panel/);
  assert.match(css,/-webkit-user-select:text;user-select:text;-webkit-touch-callout:default/);
  assert.doesNotMatch(css,/\.fa-shell-search\{[^}]*position:fixed/);
});

test("SEARCH-01 search destinations are limited to real internal routes and heading anchors",()=>{
  const destinations=[...script.matchAll(/\["(page|section)","([^"]+)","([^"]+)","([^"]+)"\]/g)];
  assert.equal(destinations.length,9);
  const known=new Set(pages);
  for(const [,kind,id,description,url] of destinations){
    assert.match(url,/^\/app\/(?:calendar\/|settings\/)?(?:#[a-z-]+)?$/);
    const [pathname,fragment] = url.slice(1).split("#");
    const file=pathname+"index.html";
    assert.ok(known.has(file),url);
    const target=html[file];
    assert.ok(target.includes('id="'+id+'"'),id);
    assert.ok(target.includes('data-app-i18n="'+description+'"'),description);
    if(fragment) assert.ok(target.includes('id="'+fragment+'"'),fragment);
    assert.ok(kind==="page" || kind==="section");
  }
});

test("SEARCH-01 supports exactly five UI locales and avoids unimplemented data/search shortcuts",()=>{
  for(const lang of ["en","de","es","fr","it"]) assert.match(script,new RegExp("\\b"+lang+": \\{trigger:"));
  assert.doesNotMatch(script,/fetch\(|indexedDB|localStorage|sessionStorage|Ctrl\+K|metaKey|ctrlKey|fakeFixtures/);
  assert.match(script,/new MutationObserver\(translate\)/);
  assert.match(script,/normalize\("NFD"\)/);
  assert.match(script,/dialog\.showModal\(\)/);
  assert.match(script,/dialog\.addEventListener\("cancel"/);
  assert.match(script,/trigger\.focus\(\{preventScroll:true\}\)/);
});

function simulate(language="en"){
  const listeners=new Map();
  const el=(id,tag="DIV")=>{
    const e={
      id,tagName:tag,children:[],textContent:"",value:"",hidden:false,open:false,attributes:{},
      classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)}},
      addEventListener(name,callback){if(!listeners.has(this))listeners.set(this,{});listeners.get(this)[name]=callback},
      emit(name,extra={}){listeners.get(this)?.[name]?.({target:this,preventDefault(){},...extra})},
      setAttribute(k,v){this.attributes[k]=v},
      append(...items){this.children.push(...items)},
      replaceChildren(...items){this.children=items},
      focus(){document.activeElement=this},
      click(){this.clicked=true;this.emit("click")},
      closest(selector){return selector==="a.app-search-result"&&this.tagName==="A"?this:null},
      querySelectorAll(selector){return selector==="a.app-search-result"?this.children.flatMap(n=>n.children).filter(n=>n.className==="app-search-result"):[]},
      showModal(){this.open=true},
      close(){this.open=false;this.emit("close")}
    };
    return e;
  };
  const ids=["app-search-trigger","app-search-dialog","app-search-input","app-search-results",
    "app-search-status","app-search-empty","app-search-close","app-search-heading","app-search-scope",
    "dashboard-title","calendar-title","settings-title","career-status-heading","world-heading",
    "app-language-heading","app-career-heading","app-data-heading","app-about-heading"];
  const nodes=Object.fromEntries(ids.map(id=>[id,el(id)]));
  const labels={
    "dashboard-title":"Dashboard","calendar-title":"Calendar","settings-title":"Settings",
    "career-status-heading":"Career status","world-heading":"World foundations",
    "app-language-heading":"Language","app-career-heading":"Your career",
    "app-data-heading":"Data management","app-about-heading":"About the game"
  };
  const descriptions={
    careerStatusText:"No active career. Club selection is not available.",
    calendarStatusText:"Match scheduling is not available.",
    languageHelp:"Choose the interface language.",
    worldText:"8 countries, 16 divisions and 320 documented clubs.",
    dataText:"Save export and import are not available.",
    aboutText:"Football Architect is a fictional football universe."
  };
  Object.entries(labels).forEach(([key,value])=>nodes[key].textContent=value);
  const document={
    documentElement:{lang:language},activeElement:null,
    getElementById(id){return nodes[id]??null},
    querySelector(selector){
      const m=selector.match(/^\[data-app-i18n="([^"]+)"\]$/);
      return m&&descriptions[m[1]]?{textContent:descriptions[m[1]]}:null;
    },
    createElement(tag){return el("",tag.toUpperCase())}
  };
  let onLanguageChange=()=>{};
  class MutationObserver{
    constructor(callback){onLanguageChange=callback}
    observe(element,options){assert.equal(element,document.documentElement);assert.deepEqual([...options.attributeFilter],["lang"])}
  }
  runInNewContext(script,{document,window:{matchMedia(){return {matches:true}}},MutationObserver,
    setTimeout(){throw Error("reduced motion must not schedule closing animation")},clearTimeout(){}},{timeout:2000});
  const trigger=nodes["app-search-trigger"],dialog=nodes["app-search-dialog"],input=nodes["app-search-input"],list=nodes["app-search-results"];
  const links=()=>list.querySelectorAll("a.app-search-result");
  return {nodes,labels,document,trigger,dialog,input,list,links,changeLanguage:()=>onLanguageChange()};
}

test("SEARCH-01 opens with three real page suggestions, focuses input, and closes back to trigger",()=>{
  const app=simulate();
  app.trigger.emit("click");
  assert.equal(app.dialog.open,true);
  assert.equal(app.document.activeElement,app.input);
  assert.deepEqual(app.links().map(a=>a.href),["/app/","/app/calendar/","/app/settings/"]);
  app.dialog.emit("cancel");
  assert.equal(app.dialog.open,false);
  assert.equal(app.document.activeElement,app.trigger);
  assert.equal(app.nodes["app-search-status"].textContent,"3 suggestions");
});

test("SEARCH-01 filters immediately, matches accents, and reports empty results",()=>{
  const app=simulate("fr");
  app.nodes["settings-title"].textContent="Paramètres";
  app.trigger.emit("click");
  app.input.value="parametres";
  app.input.emit("input");
  assert.equal(app.links()[0].href,"/app/settings/");
  app.input.value="zz__unknown__zz";
  app.input.emit("input");
  assert.equal(app.links().length,0);
  assert.equal(app.nodes["app-search-empty"].hidden,false);
  app.input.value="calendar";
  app.input.emit("input");
  assert.equal(app.links()[0].href,"/app/calendar/");
});

test("SEARCH-01 Arrow keys and Enter work without a global shortcut",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.input.emit("keydown",{key:"ArrowDown"});
  assert.equal(app.document.activeElement,app.links()[0]);
  app.list.emit("keydown",{key:"ArrowDown"});
  assert.equal(app.document.activeElement,app.links()[1]);
  app.list.emit("keydown",{key:"ArrowUp"});
  assert.equal(app.document.activeElement,app.links()[0]);
  app.list.emit("keydown",{key:"ArrowUp"});
  assert.equal(app.document.activeElement,app.input);
  app.input.value="calendar";
  app.input.emit("input");
  app.input.emit("keydown",{key:"Enter"});
  assert.equal(app.links()[0].clicked,true);
});

test("SEARCH-01 follows shared language changes while open",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.document.documentElement.lang="it";
  app.nodes["settings-title"].textContent="Impostazioni";
  app.changeLanguage();
  assert.equal(app.input.placeholder,"Cerca pagina o impostazione…");
  assert.equal(app.trigger.attributes["aria-label"],"Cerca nell’app");
  app.input.value="impostazioni";
  app.input.emit("input");
  assert.equal(app.links()[0].href,"/app/settings/");
});
