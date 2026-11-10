// FE-02 (#366): source/first-paint and FE-04 ownership guard.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("assets/app.css"),nav=read("assets/sidebar-evolution.js");
test("FE-02 retains FE-01 tokens, seven Calendar columns and data boundaries",()=>{
 const theme=read("assets/landing.css");
 assert.ok(theme.includes("--fa-control-height-regular:44px"));
 assert.ok(app.includes(".calendar-week-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))"));
 assert.ok(app.includes(".app-fixture-stadium{min-width:0;width:320px;max-width:none;white-space:nowrap}"));
 assert.ok(app.includes("@media(min-width:621px) and (max-width:800px)"));
 assert.ok(app.includes(".app-fixture-club>.app-fixture-name.app-world-standing-club-link{flex-shrink:1}"));
 assert.ok(app.includes("@media(max-width:390px)"));
 for(const route of ["competitions/it-1/index.html","competitions/int-1/index.html",
  "clubs/index.html","calendar/index.html","settings/index.html"]){
  const html=read(route);
  assert.ok(html.includes("/assets/sidebar-evolution.js"),route);
  assert.ok(html.includes("/assets/app.css"),route);
 }
});
test("FE-02 grows controls only in the approved mobile layout",()=>{
 for(const rule of [".fa-shell-link{height:var(--fa-control-height-regular)",
  ".app-fixtures-trigger{height:44px;min-height:44px}",
  ".app-fixtures-arrow{width:40px;min-width:40px!important}",
  "#world-calendar #calendar-controls{box-sizing:border-box;padding-inline-end:44px}",
  ".app-fixtures-picker .language-option{min-height:44px"])
  assert.ok(app.includes(rule),rule);
 assert.ok(app.includes("/* FE-02 (#366)"));
});
test("FE-02 menu positioning does not acquire FE-04 interaction semantics",()=>{
 const a=nav.indexOf("/* FE-02: viewport-only geometry");
 const b=nav.indexOf("if(nav.dataset.nav01Bound==='true'){");
 assert.ok(a>0&&b>a);
 const scoped=nav.slice(a,b);
 for(const feature of ["window.visualViewport","getBoundingClientRect",
  "dataset.menuPlacement","requestAnimationFrame(positionOpenDropdowns)",
  ".fa-shell-workspace .nav01-filter"])assert.ok(scoped.includes(feature),feature);
 for(const forbidden of ["setAttribute('aria-","setAttribute(\"aria-",
  "document.activeElement","preventDefault()","history.pushState"])
  assert.ok(!scoped.includes(forbidden),forbidden);
});

test("SAF-01 Fixtures and Calendar Week keep the current shortcut on the same line",()=>{
 assert.ok(app.includes("#competition-panel-fixtures .app-fixtures-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 44px"));
 assert.ok(app.includes("#competition-panel-fixtures .app-fixtures-current{position:static;grid-column:2;grid-row:1"));
 assert.ok(app.includes("#world-calendar #calendar-controls .app-fixtures-select{flex-basis:104px;width:104px"));
 assert.ok(app.includes("#world-calendar #calendar-controls #calendar-week-menu{width:100%"));
});
test("SAF-02/04 both competition and club fades initialize during parsing",()=>{
 for(const path of ["competitions/it-1/index.html","competitions/int-1/index.html","competitions/_shared/index.html"]){
  const html=read(path);
  assert.match(html,/data-fa-competition-tabs-scroll-first-paint/);
  assert.match(html,/tabs\.dataset\.canScrollLeft=String/);
  assert.match(html,/tabs\.dataset\.canScrollRight=String/);
 }
 const club=read("clubs/_shared/index.html");
 assert.match(club,/data-fa-club-first-paint/);
 assert.match(club,/class="app-competition-tabs club-tabs"/);
 assert.match(club,/club-first-paint-header/);
 assert.match(club,/tabs\.dataset\.canScrollRight=String/);
});
test("Calendar first paint resolves the stored DEV season, including the selected Week",()=>{
 for(const path of ["tools/render-world-calendar.mjs","calendar/index.html"]){
  const html=read(path);
  assert.match(html,/window\.faDebugEnabled !== false\s*&&\s*\(window\.faDevPreviewMode === true/);
  assert.match(html,/sessionStorage\.getItem\('football-architect:standings-dev-season'\)/);
  assert.doesNotMatch(html,/const limit=window\.faDevCalendarClockSnapshot\?\.source\?\.kind==='dev'/);
 }
 assert.match(read("assets/calendar-simplified.js"),/selectedSeason=Number\(document\.documentElement\.dataset\.calendarSeason\)\|\|null/);
});

test("SAF-05 selectors retain centered labels and right-edge chevrons",()=>{
 assert.match(app,/#competition-panel-fixtures \.app-fixtures-trigger-label\{flex:1 1 auto;justify-content:center;text-align:center\}/);
 assert.match(app,/#world-calendar #calendar-controls #calendar-week-trigger>\.language-chevron\{position:absolute;inset-inline-end:8px/);
 assert.match(app,/#world-calendar #calendar-controls #calendar-week-value\{display:block;flex:1 1 auto/);
});
test("QA-16 club first paint visibly reserves panels with anonymous skeletons",()=>{
 const html=read("clubs/_shared/index.html"),css=read("assets/club-page.css");
 const club=html.slice(html.indexOf('<div id="club-page"'),html.indexOf("</div><noscript>"));
 assert.match(club,/club-first-paint-overview/);
 assert.match(club,/club-first-paint-panel" aria-busy="true"/);
 assert.match(club,/class="club-fp-bar"/);
 assert.match(css,/\.club-first-paint-panel\{min-height:160px;visibility:visible\}/);
 assert.doesNotMatch(css,/\.club-first-paint-panel\{[^}]*visibility:hidden/);
});
test("SAF-05 competition tab refresh preserves the saved horizontal offset",()=>{
 const tabs=read("assets/competition-tabs.js");
 assert.match(tabs,/if\(savedTabScroll===null\)revealSelectedTab\(\);else syncTabOverflow\(\)/);
 assert.match(tabs,/let previousTabWidth=tablist\.clientWidth/);
 assert.match(tabs,/if\(changed&&!restoringTabScroll\)revealSelectedTab\(\)/);
 assert.match(tabs,/previousView!==undefined&&previousView!==state\.view/);
 assert.doesNotMatch(tabs,/if\(focus\|\|!restoringTabScroll\)revealSelectedTab\(\)/);
});
