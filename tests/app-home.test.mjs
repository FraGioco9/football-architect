import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const paths = {
  dashboard: "app/dashboard/index.html",
  calendar: "app/calendar/index.html",
  settings: "app/settings/index.html"
};
const pages = Object.fromEntries(Object.entries(paths).map(([name,path]) => [name,read(path)]));
const css = read("assets/app.css");
const js = read("assets/app.js");

test("HOME-01 uses canonical static pages rather than legacy hash routing", () => {
  const expectedLinks = {
    dashboard: ["./","../calendar/","../settings/"],
    calendar: ["../dashboard/","./","../settings/"],
    settings: ["../dashboard/","../calendar/","./"]
  };
  for (const [page,markup] of Object.entries(pages)) {
    assert.match(markup, /class="fa-career-shell"/);
    assert.match(markup, /class="fa-shell-sidebar"/);
    assert.match(markup, /class="fa-shell-topbar"/);
    assert.match(markup, /id="app-calendar"/);
    assert.match(markup, /id="app-settings"/);
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
  assert.match(js, /path\.endsWith\("\/app\/calendar"\)/);
  assert.match(js, /path\.endsWith\("\/app\/settings"\)/);
  assert.match(js, /path\.endsWith\("\/app\/dashboard"\)/);
});

test("HOME-01 all three standalone pages resolve icons, scripts, CSS and destination links", () => {
  for (const [page,path] of Object.entries(paths)) {
    const markup = pages[page];
    const base = new URL("../"+path,import.meta.url);
    for (const [,target] of markup.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (target.startsWith("#")) continue;
      const loc = new URL(target,base);
      // Directory URLs are served as index.html by a normal static HTTP server.
      const file = loc.pathname.endsWith("/") ? new URL("index.html",loc) : loc;
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
    assert.match(markup, /class="app-main" id="main-content" tabindex="-1"/);
    for (const label of ["dashboard","calendar","settings"]) {
      assert.match(markup,new RegExp('<h1 class="app-page-title" id="'+label+'-title"'));
    }
    assert.match(markup,new RegExp('<section id="app-'+view+'"[^>]*aria-labelledby="'+view+'-title"(?![^>]*hidden)'));
    assert.equal((markup.match(/class="app-page-title"/g)||[]).length,3);
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
  assert.doesNotMatch(css,/overflow-x:\s*hidden/);
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
    title:"",documentElement:{lang:"en"},
    querySelectorAll(selector){return selector==="[data-app-i18n]"?translated:selector==="[data-app-aria]"?labeled:[];},
    getElementById(id){return nodes[id]??null;}
  };
  const window = {location:{pathname,hash:fragment}};
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
    ["/app/dashboard/","dashboard"],["/app/dashboard","dashboard"],["/app/calendar/","calendar"],["/app/settings/","settings"],
    ["/app/calendar","calendar"],["/app/settings","settings"]
  ];
  for(const [path,current] of locations) {
    const app=simulateApp(path);
    for(const name of ["dashboard","calendar","settings"]) {
      assert.equal(app.nodes["app-"+name].hidden,name!==current);
      assert.equal(app.nodes["app-nav-"+name].attributes["aria-current"],name===current?"page":undefined);
    }
    // Fragments are no longer application routes. The skip link remains a normal focus anchor.
    const fragmentApp=simulateApp(path,"#main-content");
    assert.equal(fragmentApp.nodes["app-"+current].hidden,false);
  }
  // Former hashes are ignored, not redirected or treated as routes.
  assert.equal(simulateApp("/app/dashboard/","#calendar").nodes["app-dashboard"].hidden,false);
  assert.equal(simulateApp("/app/dashboard/","#settings").nodes["app-dashboard"].hidden,false);
});

test("HOME-01 translates all three page titles across five supported languages", () => {
  const titles={
    dashboard:{en:"Dashboard",de:"Dashboard",es:"Panel",fr:"Tableau de bord",it:"Dashboard"},
    calendar:{en:"Calendar",de:"Kalender",es:"Calendario",fr:"Calendrier",it:"Calendario"},
    settings:{en:"Settings",de:"Einstellungen",es:"Ajustes",fr:"Paramètres",it:"Impostazioni"}
  };
  for (const [view,labels] of Object.entries(titles)) {
    const app=simulateApp(view==="dashboard"?"/app/dashboard/":"/app/"+view+"/");
    for(const [lang,title] of Object.entries(labels)) {
      app.document.documentElement.lang=lang;
      app.changed();
      assert.equal(app.document.title,title+" — Football Architect");
      assert.ok(app.translated.some(x=>x.dataset.appI18n===view&&x.textContent===title));
      assert.ok(app.labeled.some(x=>x.dataset.appAria==="continueDisabled"&&x.attributes["aria-label"]));
    }
  }
});


test("HOME-02 redirects /app/ to Dashboard, preserving query and fragment",()=>{
  const redirect=read("app/index.html");
  const dashboard=read("app/dashboard/index.html");
  assert.match(redirect,/window\.location\.replace\("\.\/dashboard\/" \+ window\.location\.search \+ window\.location\.hash\)/);
  assert.match(redirect,/<noscript><meta http-equiv="refresh" content="0;url=dashboard\/"><\/noscript>/);
  assert.match(redirect,/href="dashboard\/"/);
  assert.doesNotMatch(redirect,/class="fa-career-shell"/);
  assert.match(dashboard,/id="app-dashboard"/);
  const script=redirect.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for(const [search,hash,expected] of [["","","./dashboard/"],["?lang=it","#world-heading","./dashboard/?lang=it#world-heading"]]){
    const redirects=[];
    runInNewContext(script,{window:{location:{search,hash,replace(path){redirects.push(path)}}}},{timeout:2000});
    assert.deepEqual(redirects,[expected]);
  }
});
