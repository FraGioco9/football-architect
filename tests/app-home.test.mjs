import { publicRequestFile } from "../tools/publication-guard.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync, readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const paths = {
  dashboard: "dashboard/index.html",
  calendar: "calendar/index.html",
  settings: "settings/index.html"
};
const pages = Object.fromEntries(Object.entries(paths).map(([name,path]) => [name,read(path)]));
const css = read("assets/app.css");
const js = read("assets/app.js");

test("HOME-01 uses canonical static pages rather than legacy hash routing", () => {
  const expectedLinks = {
    dashboard: ["/dashboard","/calendar","/settings"],
    calendar: ["/dashboard","/calendar","/settings"],
    settings: ["/dashboard","/calendar","/settings"]
  };
  for (const [page,markup] of Object.entries(pages)) {
    assert.match(markup, /class="fa-career-shell"/);
    assert.match(markup, /class="fa-shell-sidebar"/);
    assert.match(markup, /class="fa-shell-topbar"/);
    assert.match(markup, /id="app-calendar"/);
    assert.match(markup, /id="app-nav-world-title"/);
    assert.match(markup, /id="app-nav-divisions"/);
    assert.match(markup, /id="app-settings"/);
    assert.match(markup, /id="app-divisions"/);
    const [dashboardLink,calendarLink,settingsLink] = expectedLinks[page];
    assert.ok(markup.includes('id="app-nav-dashboard" href="'+dashboardLink+'"'));
    assert.ok(markup.includes('id="app-nav-calendar" href="'+calendarLink+'"'));
    assert.ok(markup.includes('id="app-nav-settings" href="'+settingsLink+'"'));
    assert.doesNotMatch(markup, /#calendar|#settings|app-nav-general-title/);
    assert.match(markup, /class="app-continue" type="button" disabled/);
    assert.equal((markup.match(/aria-current="page"/g) || []).length,1);
    assert.match(markup,new RegExp('id="app-nav-'+page+'"[^>]*aria-current="page"'));
  }
  assert.doesNotMatch(js, /#calendar|#settings|hashchange|window\.location\.hash|location\.replace/);
  for(const route of ["calendar","settings","dashboard"])
    assert.ok(js.includes('path === "/'+route+'"'),route);
});

test("HOME-01 all three standalone pages resolve icons, scripts, CSS and destination links", () => {
  for (const [page,path] of Object.entries(paths)) {
    const markup = pages[page];
    const base = new URL("../"+path,import.meta.url);
    for (const [,target] of markup.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (target.startsWith("#")) continue;
      const file = new URL("../"+publicRequestFile(new URL(target,"https://fa.invalid/"+path).pathname),import.meta.url);
      assert.ok(existsSync(fileURLToPath(file)),page+": missing "+target);
    }
    assert.match(markup, /assets\/brand\/symbol-dark\.svg/);
    assert.match(markup, /assets\/brand\/favicon-32\.png/);
    assert.match(markup, /assets\/app\.js/);
    assert.match(markup, /assets\/app\.css/);
    assert.match(markup, /assets\/landing\.js/);
    assert.match(markup, /assets\/landing\.css/);
  }
});

test("HOME-01 has one global title and spacing system, with no page pretitle or subtitle", () => {
  for (const [view,markup] of Object.entries(pages)) {
    assert.doesNotMatch(markup,/class="app-eyebrow"|class="app-intro"/);
    assert.match(markup, /<main class="app-main" id="main-content" tabindex="-1">/);
    for (const label of ["dashboard","calendar","settings","divisions"]) {
      assert.match(markup,new RegExp('<h1 class="app-page-title" id="'+label+'-title"'));
    }
    assert.match(markup,new RegExp('<section id="app-'+view+'"[^>]*aria-labelledby="'+view+'-title"(?![^>]*hidden)'));
    assert.equal((markup.match(/class="app-page-title"/g)||[]).length,4);
  }
  for(const token of ["--app-page-pad-inline","--app-page-pad-top","--app-page-pad-bottom","--app-page-section-gap","--app-page-title-size"]) {
    assert.ok(css.includes(token),token);
  }
  assert.match(css,/\.app-main\{width:100%;max-width:none/);
  assert.match(css,/\.app-view>\.app-page-title\{[^}]*text-align:left/);
  assert.match(css,/\.app-panels\{[^}]*margin-top:var\(--app-page-section-gap\)/);
  assert.match(css,/\.app-calendar-empty\{[^}]*margin-top:var\(--app-page-section-gap\)/);
  assert.match(css,/\.app-settings-grid\{[^}]*margin-top:var\(--app-page-section-gap\)/);
  assert.doesNotMatch(css,/\.app-eyebrow|\.app-intro/);
});

test("HOME-02 TOPBAR-B keeps the topbar above the shared inset scroll area", () => {
  assert.match(css,/\.fa-shell-topbar\{position:sticky;top:0;z-index:20;flex-shrink:0;/);
  assert.match(css,/\.fa-shell-sidebar\{[^}]*position:sticky;top:0;z-index:12/);
  assert.match(css,/html\{scroll-padding-top:72px\}/);
  assert.match(css,/@media\(max-width:720px\)\{\s*html\{scroll-padding-top:66px\}/);
  assert.doesNotMatch(css,/\.fa-shell-topbar\{[^}]*overflow(?:-[xy])?:/);
  assert.match(css,/html:has\(>body\.app-body\)\{overflow:hidden;scrollbar-gutter:auto\}/);
  assert.match(css,/\.app-body\{[^}]*height:100dvh;overflow:hidden;/);
  assert.match(css,/\.fa-career-shell\{[^}]*height:100dvh;overflow:hidden\}/);
  assert.match(css,/\.fa-shell-workspace\{[^}]*height:100%;overflow:hidden\}/);
  assert.match(css,/\.fa-shell-content-scroll\{[^}]*min-height:0;overflow-y:auto;[^}]*scrollbar-width:thin;/);
  assert.match(css,/\.fa-shell-content-scroll::-webkit-scrollbar-track\{background:transparent\}/);
  for (const markup of Object.values(pages)) {
    assert.match(markup,/<header class="fa-shell-topbar">/);
    assert.match(markup,/<\/header>\s*<div class="fa-shell-content-scroll">\s*<main class="app-main"/);
    assert.match(markup,/<\/main>\s*<footer class="app-footer">[^]*?<\/footer>\s*<\/div>\s*<\/div>/);
    assert.match(markup,/<main class="app-main" id="main-content" tabindex="-1">/);
    assert.doesNotMatch(markup,/class="app-skip"/);
    assert.match(markup,/id="app-search-trigger"/);
  }
});

test("HOME-01 retains bottom Settings sidebar, a clean top bar, and old shell widths", () => {
  for (const markup of Object.values(pages)) {
    const bar = markup.split('<header class="fa-shell-topbar">')[1].split("</header>")[0];
    assert.doesNotMatch(bar,/language-control|site-language|language-trigger/);
    assert.match(bar,/class="fa-shell-club"/);
    assert.match(bar,/class="fa-shell-time"/);
    assert.match(bar,/class="fa-shell-primary"/);
    assert.match(markup,/class="fa-shell-nav-group fa-shell-nav-secondary"/);
    assert.doesNotMatch(markup,/id="app-nav-general-title"/);
    assert.match(markup,/id="app-nav-settings"/);
    assert.match(markup,/id="language-control"/);
    assert.equal((markup.match(/id="language-control"/g)||[]).length,1);
  }
  assert.match(css,/\.fa-shell-nav\{display:flex;flex:1 1 auto/);
  assert.match(css,/\.fa-shell-nav-secondary\{margin-top:auto/);
  for(const width of [210,180,58,52]) {
    assert.match(css,new RegExp("grid-template-columns:"+width+"px minmax"));
  }
  assert.match(css,/\.app-panels,\.app-settings-grid\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(css.replace(/\.app-world-form-tooltip\{[^}]*\}/g,""),/overflow-x:\s*hidden/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("HOME-01 keeps five localized language options only in Settings and does not fake gameplay", () => {
  for(const markup of Object.values(pages)) {
    for (const lang of ["en","de","es","fr","it"]) {
      assert.match(markup,new RegExp('data-language="'+lang+'"'));
      assert.match(js,new RegExp('(?:^|\\s)'+lang+': \\{'));
    }
    assert.match(markup,/id="app-language-heading"/);
    assert.match(markup,/id="app-career-heading"/);
    assert.match(markup,/id="app-data-heading"/);
    assert.match(markup,/id="app-about-heading"/);
  }
  assert.doesNotMatch(js,/indexedDB|fetch\(|localStorage\.setItem|simulateMatch/);
  assert.doesNotMatch(pages.settings,/data-action="(?:import|export|delete-career)"/);
});

function simulateApp(pathname,fragment="") {
  const page = pathname.includes("/calendar") ? "calendar" : pathname.includes("/settings") ? "settings" : "dashboard";
  const markup = pages[page];
  const nodes = {};
  const translated = [...markup.matchAll(/data-app-i18n="([^"]+)"/g)].map(([,key]) => ({
    dataset:{appI18n:key},textContent:""
  }));
  const labeled = [...markup.matchAll(/data-app-aria="([^"]+)"/g)].map(([,key]) => ({
    dataset:{appAria:key},attributes:{},
    setAttribute(key,value){this.attributes[key]=value;}
  }));
  for(const id of ["app-dashboard","app-calendar","app-settings","app-nav-dashboard","app-nav-calendar","app-nav-settings"]) {
    const classes = new Set();
    nodes[id] = {
      hidden:false,attributes:{},
      classList:{toggle(key,value){if(value)classes.add(key);else classes.delete(key);},
                 contains(key){return classes.has(key);}},
      setAttribute(key,value){this.attributes[key]=value;},
      removeAttribute(key){delete this.attributes[key];}
    };
  }
  const document = {
    title:"",documentElement:{lang:"en",dataset:{}},
    querySelectorAll(selector){return selector==="[data-app-i18n]"?translated:selector==="[data-app-aria]"?labeled:[];},
    getElementById(id){return nodes[id]??null;}
  };
  const window = {location:{pathname,hash:fragment},addEventListener(){}};
  let changed;
  class MutationObserver {
    constructor(callback){changed=callback;}
    observe(target,options){
      assert.equal(target,document.documentElement);
      assert.deepEqual(Array.from(options.attributeFilter),["lang"]);
    }
  }
  runInNewContext(js,{document,window,MutationObserver},{timeout:2000});
  return {nodes,translated,labeled,document,window,changed};
}

test("HOME-01 selects the actual page from pathname, including after refresh and unrelated URL fragments", () => {
  const locations=[
    ["/dashboard/","dashboard"],["/dashboard","dashboard"],["/calendar/","calendar"],["/settings/","settings"],
    ["/calendar","calendar"],["/settings","settings"]
  ];
  for(const [path,current] of locations) {
    const app=simulateApp(path);
    for(const name of ["dashboard","calendar","settings"]) {
      assert.equal(app.nodes["app-"+name].hidden,name!==current);
      assert.equal(app.nodes["app-nav-"+name].attributes["aria-current"],name===current?"page":undefined);
    }
    // Fragments are not application routes. Existing section anchors remain supported.
    const fragmentApp=simulateApp(path,"#world-heading");
    assert.equal(fragmentApp.nodes["app-"+current].hidden,false);
  }
  // Former hashes are ignored, not redirected or treated as routes.
  assert.equal(simulateApp("/dashboard/","#calendar").nodes["app-dashboard"].hidden,false);
  assert.equal(simulateApp("/dashboard/","#settings").nodes["app-dashboard"].hidden,false);
});

test("HOME-01 translates all three page titles across five supported languages", () => {
  const titles={
    dashboard:{en:"Dashboard",de:"Dashboard",es:"Panel",fr:"Tableau de bord",it:"Dashboard"},
    calendar:{en:"Calendar",de:"Kalender",es:"Calendario",fr:"Calendrier",it:"Calendario"},
    settings:{en:"Settings",de:"Einstellungen",es:"Ajustes",fr:"Paramètres",it:"Impostazioni"}
  };
  for (const [view,labels] of Object.entries(titles)) {
    const app=simulateApp("/"+view+"/");
    for(const [lang,title] of Object.entries(labels)) {
      app.document.documentElement.lang=lang;
      app.changed();
      assert.equal(app.document.title,title+" — Football Architect");
      assert.ok(app.translated.some(x=>x.dataset.appI18n===view&&x.textContent===title));
      assert.ok(app.labeled.some(x=>x.dataset.appAria==="continueDisabled"&&x.attributes["aria-label"]));
    }
  }
});


test("HOME-02 obsolete application entry point is absent",()=>{
  assert.equal(existsSync(new URL("../app/index.html",import.meta.url)),false);
  assert.match(read("dashboard/index.html"),/id="app-dashboard"/);
});


test("A11Y-NO-SKIP-01: skip link is absent without disturbing accessible landmarks",()=>{
 const competitionDir=new URL("../competitions/",import.meta.url);
 const generated=["competitions/index.html",...readdirSync(competitionDir,{withFileTypes:true}).filter(item=>item.isDirectory()).map(item=>"competitions/"+item.name+"/index.html")];
 for(const path of generated)assert.doesNotMatch(read(path),/class="app-skip"|data-app-i18n="skip"|Skip to main content/,path);
 for(const markup of Object.values(pages)){
  assert.doesNotMatch(markup,/class="app-skip"|data-app-i18n="skip"|Skip to main content/);
  assert.equal((markup.match(/id="main-content"/g)||[]).length,1);
  assert.match(markup,/<main class="app-main" id="main-content" tabindex="-1">/);
  assert.match(markup,/id="career-status-heading"/);
  assert.match(markup,/id="world-heading"/);
  assert.match(markup,/id="app-language-heading"/);
  assert.match(markup,/id="app-search-heading" class="sr-only"/);
 }
 assert.doesNotMatch(css,/\.app-skip/);
 assert.doesNotMatch(js,/\bskip:"(?:Skip to main content|Zum Hauptinhalt springen|Saltar al contenido principal|Aller au contenu principal|Vai al contenuto principale)"/);
});

test("ENG-ALL-ENGLISH-01 localizes the app brand accessibility label", () => {
  for (const markup of Object.values(pages)) {
    assert.match(markup, /aria-label="Football Architect home" data-app-aria="brandHome"/);
    assert.equal((markup.match(/data-app-aria="brandHome"/g) || []).length, 1);
  }
  for (const label of [
    "Football Architect home", "Football Architect – Startseite",
    "Inicio de Football Architect", "Accueil de Football Architect",
    "Home di Football Architect"
  ]) assert.ok(js.includes('brandHome:"' + label + '"'));
  assert.match(js, /node\.setAttribute\("aria-label", strings\[node\.dataset\.appAria\]\)/);
});

test("CLEAN-OPT generated app shells match checked-in HTML across LF/CRLF checkouts", () => {
  const generator = fileURLToPath(new URL("../tools/generate-app-pages.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [generator, "--check"], {encoding:"utf8"});
  assert.match(output, /Static HTML matches checked-in pages: 23\/23/);
});

test("APP-HOST-URL-01: production app subdomain and local static preview routes",()=>{
 const source=read("assets/app.js");
 const match=source.match(/  function appHref\(route\) \{[\s\S]*?\n  \}/);
 assert.ok(match,"shared app URL resolver exists");
 const resolve=(hostname,pathname,protocol="https:")=>
  runInNewContext(match[0]+"\nappHref("+JSON.stringify(pathname)+")",
   {document:{documentElement:{dataset:{}}},window:{location:{hostname,protocol}}});
 for(const [host,path,expected] of [
  ["football.example","/dashboard/","https://app.football.example/dashboard"],
  ["www.football.example","/competitions/it-1","https://app.football.example/competitions/it-1"],
  ["app.football.example","/competitions/it-1","/competitions/it-1"],
  ["app.football.example","/settings#app-language-heading","/settings#app-language-heading"],
  ["localhost","/competitions/it-1","/competitions/it-1"],
  ["localhost","/competitions/it-1/?season=2&view=fixtures#matchday","/competitions/it-1?season=2&view=fixtures#matchday"],
  ["football.example","/settings/#app-language-heading","https://app.football.example/settings#app-language-heading"],
  ["localhost","/settings/?next=/guide/#section/","/settings?next=/guide/#section/"],
  ["football.example","/settings/?next=/guide/#section/","https://app.football.example/settings?next=/guide/#section/"],
  ["192.168.1.90","/calendar","/calendar"],
  ["football-architect.vercel.app","/calendar","/calendar"]
 ]) assert.equal(resolve(host,path),expected,host);
});


test("SITE-HOST-URL: app-subdomain links preserve a bare origin, queries and fragments",()=>{
 const match=js.match(/  function siteHref\(path\) \{[\s\S]*?\n  \}/);
 assert.ok(match);
 const resolve=path=>runInNewContext(match[0]+"\nsiteHref("+JSON.stringify(path)+")",
  {document:{documentElement:{dataset:{}}},window:{location:{hostname:"app.football.example",protocol:"https:"}}});
 assert.equal(resolve("/"),"https://football.example");
 assert.equal(resolve("/guide/"),"https://football.example/guide");
 assert.equal(resolve("/guide/?lang=it#clubs"),"https://football.example/guide?lang=it#clubs");
 assert.equal(resolve("/guide/?next=/clubs/#section/"),"https://football.example/guide?next=/clubs/#section/");
});

test("COMPETITION-LINK: DEV season metadata preserves a valid division path",()=>{
 const hrefs={href:"/competitions/it-1?season=1&view=standings","data-dev-latest-season":"2"};
 const card={getAttribute:key=>hrefs[key],setAttribute:(key,value)=>{hrefs[key]=value;}};
 const code=["appHref","siteHref","rewriteAppLinks"].map(name=>{
  const match=js.match(new RegExp("  function "+name+"\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}"));
  assert.ok(match,name);return match[0];
 }).join("\n");
 runInNewContext(code+"\nrewriteAppLinks()",{
  window:{location:{hostname:"localhost",protocol:"http:"}},links:{},
  document:{documentElement:{dataset:{}},querySelectorAll:selector=>selector==="a.app-division-card"?[card]:[]}
 });
 assert.equal(hrefs.href,"/competitions/it-1?season=2&view=standings");
});
