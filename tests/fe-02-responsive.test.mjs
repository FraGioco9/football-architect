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
  "dataset.menuPlacement","requestAnimationFrame(position)",
  ".fa-shell-workspace .nav01-filter"])assert.ok(scoped.includes(feature),feature);
 for(const forbidden of ["setAttribute('aria-","setAttribute(\"aria-",
  "document.activeElement","preventDefault()","history.pushState"])
  assert.ok(!scoped.includes(forbidden),forbidden);
});
