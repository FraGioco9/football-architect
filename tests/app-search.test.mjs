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
    assert.match(source, /<dialog id="app-search-dialog"[^>]+aria-describedby="app-search-scope"/);
    assert.match(source, /<p id="app-search-scope" class="sr-only">/);
  }
});

test("SEARCH-01 responsive and accessible animation contracts",()=>{
  for(const key of [".fa-shell-search",".app-search-trigger",".app-search-dialog",".app-search-panel",
    ".app-search-results",".app-search-result:focus-visible","@keyframes app-search-in",
    "@keyframes app-search-out","@media(max-width:390px)",
    "@media(prefers-reduced-motion:reduce)"]) assert.ok(css.includes(key),key);
  assert.match(css,/\.app-search-trigger span\{display:none\}/);
  assert.match(css,/\.app-search-dialog\{width:min\(460px,calc\(100vw - 28px\)\);max-width:460px;max-height:min\(72dvh,490px\)/);
  assert.match(css,/\.app-search-panel\{[^}]*max-height:min\(72dvh,490px\)/);
  assert.match(css,/\.app-search-result:hover\{background:#203c3d\}/);
  assert.match(css,/\.app-search-input-row:focus-within\{box-shadow:inset 0 -2px #718c83\}/);
  assert.doesNotMatch(css,/\.app-search-description\{/);
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
  assert.match(script,/trigger\.querySelector\("span"\)/);
  assert.doesNotMatch(script,/link\.append\(kind,label,desc\)/);
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
      emit(name,extra={}){listeners.get(this)?.[name]?.({target:this,preventDefault(){},stopPropagation(){},...extra})},
      setAttribute(k,v){this.attributes[k]=v},
      append(...items){this.children.push(...items)},
      replaceChildren(...items){this.children=items},
      focus(){document.activeElement=this},
      click(){this.clicked=true;this.emit("click")},
      closest(selector){return selector==="a.app-search-result"&&this.tagName==="A"?this:null},
      querySelectorAll(selector){return selector==="a.app-search-result"?this.children.flatMap(n=>n.children).filter(n=>n.className==="app-search-result"):[]},
      querySelector(selector){return selector==="span"?this.visibleLabel??null:null},
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
  trigger.visibleLabel={textContent:"Search the app"};
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


test("SEARCH-01 closes on a pointer backdrop tap and tolerates small movement",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.dialog.emit("pointerdown",{pointerId:1,clientX:32,clientY:45});
  app.dialog.emit("pointermove",{pointerId:1,clientX:34,clientY:47});
  app.dialog.emit("pointerup",{pointerId:1,clientX:34,clientY:47});
  app.dialog.emit("click");
  assert.equal(app.dialog.open,false);
  assert.equal(app.document.activeElement,app.trigger);
});

test("SEARCH-01 ignores internal pointer clicks on search, X and results",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.input.value="calendar";
  app.input.emit("input");
  for(const target of [app.input,app.nodes["app-search-close"],app.links()[0]]){
    app.dialog.emit("pointerdown",{target,pointerId:2,clientX:220,clientY:180});
    app.dialog.emit("pointerup",{target,pointerId:2,clientX:220,clientY:180});
    app.dialog.emit("click",{target});
    assert.equal(app.dialog.open,true);
  }
});

test("SEARCH-01 rejects inside-outside and outside-inside dragged clicks",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.dialog.emit("pointerdown",{target:app.input,pointerId:3,clientX:230,clientY:150});
  app.dialog.emit("pointerup",{target:app.dialog,pointerId:3,clientX:30,clientY:30});
  app.dialog.emit("click",{target:app.dialog});
  assert.equal(app.dialog.open,true);
  app.dialog.emit("pointerdown",{target:app.dialog,pointerId:4,clientX:30,clientY:30});
  app.dialog.emit("pointermove",{target:app.input,pointerId:4,clientX:230,clientY:150});
  app.dialog.emit("pointerup",{target:app.input,pointerId:4,clientX:230,clientY:150});
  app.dialog.emit("click",{target:app.dialog});
  assert.equal(app.dialog.open,true);
});

test("SEARCH-01 ignores dragged backdrop, mismatched pointer, and cancellation",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.dialog.emit("pointerdown",{pointerId:10,clientX:10,clientY:10});
  app.dialog.emit("pointermove",{pointerId:10,clientX:60,clientY:10});
  app.dialog.emit("pointerup",{pointerId:10,clientX:60,clientY:10});
  app.dialog.emit("click");
  assert.equal(app.dialog.open,true);
  app.dialog.emit("pointerdown",{pointerId:11,clientX:10,clientY:10});
  app.dialog.emit("pointerup",{pointerId:12,clientX:10,clientY:10});
  app.dialog.emit("click");
  assert.equal(app.dialog.open,true);
  app.dialog.emit("pointerdown",{pointerId:13,clientX:10,clientY:10});
  app.dialog.emit("pointercancel",{pointerId:13});
  app.dialog.emit("click");
  assert.equal(app.dialog.open,true);
});

test("SEARCH-01 first Escape dismisses filled native search without clearing query",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.input.value="calendar";
  app.input.emit("input");
  let prevented=false,stopped=false;
  app.dialog.emit("keydown",{target:app.input,key:"Escape",
    preventDefault(){prevented=true},stopPropagation(){stopped=true}});
  assert.equal(prevented,true);
  assert.equal(stopped,true);
  assert.equal(app.dialog.open,false);
  assert.equal(app.document.activeElement,app.trigger);
  assert.equal(app.input.value,"calendar");
});

test("SEARCH-01 focused-result Escape, X and native cancel still close correctly",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.input.emit("keydown",{key:"ArrowDown"});
  const target=app.links()[0];
  assert.equal(app.document.activeElement,target);
  app.dialog.emit("keydown",{target,key:"Escape"});
  assert.equal(app.dialog.open,false);
  app.trigger.emit("click");
  app.nodes["app-search-close"].emit("click");
  assert.equal(app.dialog.open,false);
  app.trigger.emit("click");
  app.dialog.emit("cancel");
  assert.equal(app.dialog.open,false);
});

test("SEARCH-01 leaves Tab and Shift+Tab to native modal focus management",()=>{
  const app=simulate();
  app.trigger.emit("click");
  assert.equal(app.document.activeElement,app.input);
  for(const shiftKey of [false,true]){
    let prevented=false;
    app.dialog.emit("keydown",{target:app.input,key:"Tab",shiftKey,
      preventDefault(){prevented=true}});
    assert.equal(prevented,false);
    assert.equal(app.dialog.open,true);
  }
  assert.match(script,/dialog\.showModal\(\)/);
  assert.match(script,/dialog\.addEventListener\("keydown",[\s\S]*?,true\)/);
});

test("SEARCH-01 Enter, native result clicks, and focus restoration remain functional",()=>{
  const app=simulate();
  app.trigger.emit("click");
  app.input.value="calendar";
  app.input.emit("input");
  const result=app.links()[0];
  app.input.emit("keydown",{key:"Enter"});
  assert.equal(result.clicked,true);
  app.list.emit("click",{target:result});
  assert.equal(app.dialog.open,false);
  assert.equal(app.document.activeElement,app.trigger);
});

test("SEARCH-01 compact results show only label and kind, with descriptions still searchable",()=>{
  const app=simulate();
  app.trigger.emit("click");
  const first=app.links()[0];
  assert.equal(first.children.length,2);
  assert.equal(first.children[0].className,"app-search-name");
  assert.equal(first.children[1].className,"app-search-kind");
  app.input.value="320 documented clubs";
  app.input.emit("input");
  assert.equal(app.links()[0].href,"/app/#world-heading");
});

test("SEARCH-01 translates the visible desktop search trigger",()=>{
  const app=simulate();
  app.document.documentElement.lang="it";
  app.changeLanguage();
  assert.equal(app.trigger.visibleLabel.textContent,"Cerca nell’app");
  app.document.documentElement.lang="de";
  app.changeLanguage();
  assert.equal(app.trigger.visibleLabel.textContent,"App durchsuchen");
});
