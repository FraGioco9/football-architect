import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = read("assets/theme.js");
const shells = ["app/dashboard/index.html","app/calendar/index.html",
  "app/settings/index.html","app/competitions/index.html",
  "app/competitions/_shared/index.html"];
const countries = ["br","de","eng","es","fr","it","nl","pt"];
const routes = countries.flatMap(country=>[1,2].map(tier=>
  "app/competitions/"+country+"-"+tier+"/index.html"));

function boot(value,blocked=false) {
  const attrs={};
  const buttons=["dark","light"].map(themeChoice=>({
    dataset:{themeChoice},attrs:{},handlers:{},
    setAttribute(name,value){this.attrs[name]=value;},
    addEventListener(name,fn){this.handlers[name]=fn;}
  }));
  const img={
    src:"../../assets/brand/symbol-dark.svg",
    getAttribute(name){return name==="src"?this.src:null;},
    setAttribute(name,value){if(name==="src")this.src=value;}
  };
  const meta={setAttribute(name,value){attrs[name]=value;}};
  const events={};
  const storage=new Map(value===undefined?[]:[["football-architect:theme",value]]);
  const window={
    localStorage:{
      getItem:key=>{if(blocked)throw Error("Storage blocked");return storage.get(key)??null;},
      setItem:(key,value)=>{if(blocked)throw Error("Storage blocked");storage.set(key,value);}
    },
    addEventListener:(type,callback)=>events[type]=callback
  };
  const document={
    readyState:"loading",
    documentElement:{setAttribute:(key,value)=>attrs[key]=value},
    querySelector:()=>meta,
    querySelectorAll:selector=>selector==="[data-theme-choice]"?buttons:
      selector===".brand-image, .app-brand-symbol"?[img]:[],
    addEventListener:(type,callback)=>events[type]=callback
  };
  runInNewContext(source,{window,document},{timeout:1000});
  return {attrs,buttons,img,events,storage,window};
}

test("theme defaults to dark, with invalid or inaccessible saved values",()=>{
  for(const value of [undefined,"auto","LIGHT",""]) {
    const s=boot(value);
    assert.equal(s.attrs["data-theme"],"dark");
    assert.equal(s.attrs.content,"#101A1D");
    s.events.DOMContentLoaded();
    assert.equal(s.buttons[0].attrs["aria-pressed"],"true");
    assert.equal(s.buttons[1].attrs["aria-pressed"],"false");
  }
  const blocked=boot("light",true);
  assert.equal(blocked.attrs["data-theme"],"dark");
  blocked.events.DOMContentLoaded();
  assert.doesNotThrow(()=>blocked.buttons[1].handlers.click());
  assert.equal(blocked.attrs["data-theme"],"light");
  assert.doesNotMatch(source,/prefers-color-scheme|matchMedia/);
});

test("saved Light applies before document-ready, persists, and follows other tabs",()=>{
  const s=boot("light");
  assert.equal(s.attrs["data-theme"],"light");
  assert.equal(s.attrs.content,"#F4F7F4");
  s.events.DOMContentLoaded();
  assert.equal(s.img.src,"../../assets/brand/symbol-light.svg");
  assert.equal(s.buttons[1].attrs["aria-pressed"],"true");
  s.buttons[0].handlers.click();
  assert.equal(s.storage.get("football-architect:theme"),"dark");
  assert.equal(s.img.src,"../../assets/brand/symbol-dark.svg");
  s.events.storage({key:"football-architect:theme",newValue:"light"});
  assert.equal(s.attrs["data-theme"],"light");
  assert.equal(s.storage.get("football-architect:theme"),"dark");
  assert.equal(s.buttons[1].attrs["aria-pressed"],"true");
  assert.equal(typeof s.window.faThemeRebind,"function");
  assert.doesNotThrow(()=>s.window.faThemeRebind());
});

test("all published static pages bootstrap theme ahead of their first stylesheet",()=>{
  const pages=["index.html","guide/index.html",...shells,...routes];
  assert.equal(pages.length,23);
  for(const path of pages) {
    const html=read(path),script=html.indexOf("assets/theme.js");
    assert.ok(script>=0,path);
    assert.ok(script<html.indexOf("assets/landing.css"),path);
    assert.equal((html.match(/assets\/theme\.js/g)||[]).length,1,path);
  }
  const generator=read("tools/generate-app-pages.mjs");
  assert.match(read("templates/app-page.html"),/assets\/theme\.js/);
});

test("Settings theme control is accessible and localized in all five languages",()=>{
  for(const path of shells) {
    const markup=read(path);
    assert.match(markup,/role="group" aria-labelledby="app-theme-heading"/);
    for(const value of ["dark","light"])
      assert.match(markup,new RegExp('data-theme-choice="'+value+'" aria-pressed="(?:true|false)"'));
  }
  const js=read("assets/app.js");
  for(const key of ["themeHeading","themeHelp","themeDark","themeLight"])
    assert.equal((js.match(new RegExp(key+":","g"))||[]).length,5,key);
  assert.match(read("assets/landing.css"),/:root\[data-theme="light"\]/);
  assert.match(read("assets/app.css"),/html\[data-theme="light"\] \.app-search-panel/);
  assert.match(read("assets/app.css"),/\.app-theme-choice:focus-visible/);
});

test("late competition hydration explicitly rebinds stored-theme brand and controls",()=>{
  assert.ok(read("assets/competition-page.js").includes("window.faThemeRebind?.()"));
  const state=boot("light");
  state.events.DOMContentLoaded();
  state.window.faThemeRebind();
  assert.equal(state.img.src,"../../assets/brand/symbol-light.svg");
  assert.equal(state.buttons[1].attrs["aria-pressed"],"true");
});
