import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const landing=load("assets/landing.css"),app=load("assets/app.css"),account=load("assets/account.css");
const directory=load("assets/clubs-directory.css"),clubs=load("assets/club-page.css"),awards=load("assets/competition-awards.css"),admin=load("assets/admin-settings.css");
const has=(s,literal)=>assert.ok(s.includes(literal),"Missing FE-01 contract: "+literal);
test("FE-01: original Graphite & Petrol theme and shared field states",()=>{
 for(const token of ["--background:#101A1D","--surface:#182B2D","--primary:#216E56","--focus:#9CE8CE","--background:#F4F7F4","--surface:#FFFFFF","--primary:#17664E","--focus:#075A45"])has(landing,token);
 for(const token of ["--fa-field-hover-bg:#1a3738","--fa-field-hover-border:#506c64","--fa-field-focus-border:#84b8a4","--fa-field-error-color:#C68F8F","--fa-field-hover-bg:#E5F1E9","--fa-field-hover-border:#67917D","--fa-field-focus-border:#377F60","--fa-field-error-color:#8A4040"])has(landing,token);
 assert.ok(!app.includes(".app-body{--fa-field-hover-bg:"));
 assert.ok(!account.includes(".account-body{--fa-field-hover-bg:"));
 for(const s of [app,account])has(s,"border-color:var(--fa-field-focus-border);box-shadow:inset 0 0 0 1px var(--fa-field-focus-border);");
 has(account,"@media(hover:hover) and (pointer:fine)");
 has(account,":not(:disabled):not(:focus)");
 for(const s of [app,account])has(s,"@media(prefers-reduced-motion:reduce)");
});
test("FE-01: identical tokenized typography, spacing, size, radius, shadow and motion",()=>{
 for(const s of ["--fa-text-body:15px","--fa-text-control:14px","--fa-text-panel-heading:18px","--fa-space-3:12px","--fa-space-4:16px","--fa-radius-control:10px","--fa-radius-panel:14px","--fa-control-height-regular:44px","--fa-control-height-compact:32px","--fa-control-height-filter:48px","--fa-tab-width-regular:112px","--fa-field-transition:border-color 160ms ease,box-shadow 180ms ease,background-color 160ms ease"])has(landing,s);
 has(landing,"box-shadow:var(--fa-dropdown-shadow)");
 has(app,".app-panel{min-width:0;padding:clamp(17px,2.4vw,26px);border:1px solid var(--border);border-radius:var(--fa-radius-panel)");
 has(app,".app-competition-tab{flex:0 0 var(--fa-tab-width-regular)");
 has(clubs,".club-tabs .app-competition-tab{display:flex;align-items:center;justify-content:center;text-decoration:none;flex:0 0 var(--fa-tab-width-regular)");
 has(directory,".nav01-filters>input{min-height:var(--fa-control-height-filter)");
 has(directory,".nav01-filter .language-trigger{height:100%;min-height:var(--fa-control-height-filter)");
 has(awards,".fa-awards-card{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:var(--fa-space-3)");
 assert.equal((admin.match(/min-height:var\(--fa-control-height-regular\)/g)||[]).length,6); // #509: Contracts assignment control
});
test("FE-01: preserve scoped responsive, sport, focus and first-paint owners",()=>{
 for(const s of [".app-world-standing-table tbody tr>*{height:68px}","@media(max-width:620px){.app-world-standing-scroll{display:none!important}",".app-fixtures-arrow{width:var(--fa-control-height-compact)","@media(max-width:360px){.app-fixtures-select{width:100px","html[data-competition-view=\"awards\"] #competition-tab-awards",".app-standings-skeleton{display:none",".app-competition-view-skeleton{display:none","#world-calendar #calendar-controls #calendar-week-trigger:is(:hover,:active):not(:disabled)"])has(app,s);
 has(account,".account-body .language-trigger:hover{background:var(--surface);border-color:var(--border)}");
 has(directory,'.nav01-filters>input[type="search"]:focus-visible{outline:2px solid var(--focus);outline-offset:2px}');
 has(awards,"--award-gold:#d7bc78");
 has(awards,'html[data-theme="light"] #competition-panel-awards .fa-awards{--award-gold:#79591D');
});
test("FE-01: generated routes keep stylesheet precedence and seven static tabs",()=>{
 const slugs=["br-1","br-2","de-1","de-2","eng-1","eng-2","es-1","es-2","fr-1","fr-2","it-1","it-2","nl-1","nl-2","pt-1","pt-2","int-1","int-2"];
 for(const slug of slugs){const html=load("competitions/"+slug+"/index.html");
  assert.ok(html.indexOf("/assets/landing.css")>=0&&html.indexOf("/assets/landing.css")<html.indexOf("/assets/app.css"),slug);
  assert.equal((html.match(/id="competition-tab-(?:standings|postseason|fixtures|stats|history|rules|awards)"/g)||[]).length,7,slug);
 }
 for(const path of ["clubs/index.html","clubs/_shared/index.html","settings/index.html","account/login/index.html","dashboard/index.html"]){
  const html=load(path);assert.ok(html.includes("/assets/landing.css")&&html.includes("/assets/app.css"),path);
 }
});
