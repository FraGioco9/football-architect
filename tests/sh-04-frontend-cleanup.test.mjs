import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const count=(src,part)=>src.split(part).length-1;
const css=read("assets/clubs-directory.css");

test("SH-04: Clubs directory and heading have their single final unscoped cascade rule",()=>{
 assert.equal(count(css,".nav01-directory{"),1);
 assert.equal(count(css,".nav01-directory .app-page-title{"),1);
 assert.ok(css.includes(".nav01-directory{max-width:none;width:100%;margin:0;min-width:0}"));
 assert.ok(css.includes(".nav01-directory .app-page-title{margin:0;padding:0;border:0;font-size:var(--app-page-title-size);line-height:1.2;letter-spacing:-.035em}"));
 for(const obsolete of ["max-width:1200px","max-width:1320px","padding-bottom:15px;font-size:29px"])assert.ok(!css.includes(obsolete));
});
test("SH-04: necessary responsive restore layers remain intact",()=>{
 // 440px original + 500px before and after intervening unscoped overrides.
 assert.equal(count(css,".nav01-filters{grid-template-columns:1fr}"),3);
 assert.ok(css.includes("@media(max-width:720px){.nav01-filters{"));
 const club=read("assets/club-page.css");
 // The canonical Club Competition grid replaces obsolete repeated 56px rules.
 assert.match(club,/@media\(max-width:760px\)\{[\s\S]*?\.club-competition-list \.club-competition-logo,[\s\S]*?width:44px;height:44px;flex-basis:44px;/);
 assert.match(club,/\.club-competition-list \.club-competition-next-content>a\.app-link,[\s\S]*?font-size:13px;line-height:1\.25;/);
 assert.match(club,/\.club-competition-list \.club-competition-entry\{[^}]*grid-template-columns:minmax\(180px,1fr\)/);
});
test("SH-04: generated HTML has one link normalization pass after sidebar insertion",()=>{
 const source=read("tools/generate-app-pages.mjs");
 assert.equal(count(source,"normalizeRouteLinks("),1);
 assert.ok(source.includes("content=normalizeRouteLinks(renderSidebar(content),path);"));
 assert.ok(source.includes("writeOutput(page.path,html);"));
 assert.ok(source.includes("writeOutput(output.path,output.content);"));
});
test("SH-04: checked-in generated HTML and manifests are byte-identical",()=>{
 const stdout=execFileSync(process.execPath,["tools/generate-app-pages.mjs","--check"],{
  cwd:new URL("../",import.meta.url),encoding:"utf8",timeout:120000,maxBuffer:1048576
 });
 assert.match(stdout,/Static HTML matches checked-in pages/);
});
test("SH-04: all 18 competition shells preserve first paint and view hosts",()=>{
 const ids=["br-1","br-2","de-1","de-2","eng-1","eng-2","es-1","es-2",
  "fr-1","fr-2","it-1","it-2","nl-1","nl-2","pt-1","pt-2","int-1","int-2"];
 for(const id of ids){
  const html=read("competitions/"+id+"/index.html");
  for(const part of ['data-fa-competition-first-paint-init','class="app-competition-tabs"',
   'id="competition-panel-fixtures"','id="competition-panel-standings"',
   '/assets/competition-page.js','data-nav01-static'])assert.ok(html.includes(part),id+" missing "+part);
 }
 const html=read("clubs/index.html");
 assert.ok(html.includes('class="nav01-card nav01-skeleton-card"'),'directory starts anonymous');
 assert.ok(!html.includes('data-nav01-filter-first-paint'),'legacy preloaded club filtering removed');
 assert.ok(html.includes('class="nav01-grid" aria-busy="true"'));
});
