import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("generated app routes preserve shared shell resources",()=>{
 for(const path of ["dashboard/index.html","calendar/index.html","settings/index.html","competitions/index.html","clubs/index.html","competitions/it-1/index.html","competitions/int-1/index.html"]){
  const html=read(path);
  for(const asset of ["app.css","landing.css","theme.js","sidebar-evolution.js"])assert.ok(html.includes("/assets/"+asset),path+": "+asset);
 }
});
test("competition detail pages use competition-specific JS without general app bootstrap",()=>{
 for(const path of ["competitions/it-1/index.html","competitions/int-1/index.html"]){
  const html=read(path);
  assert.ok(html.includes("/assets/competition-model.js"));
  assert.ok(html.includes("/assets/competition-page.js"));
  for(const file of ["app.js","landing.js","app-search.js"])assert.ok(!html.includes('src="/assets/'+file+'"'),path+": "+file);
 }
});
test("Calendar model, clock and presentation scripts retain declaration order",()=>{
 const html=read("calendar/index.html");
 const offsets=["world-calendar-model.js","world-clock-adapter.js","world-calendar.js","calendar-simplified.js"].map(file=>html.indexOf('src="/assets/'+file+'"'));
 assert.ok(offsets.every(x=>x>=0));
 assert.deepEqual(offsets,[...offsets].sort((a,b)=>a-b));
});
test("competition and club generated manifests retain catalogue boundaries",()=>{
 const competition=JSON.parse(read("competitions/_shared/manifest.json"));
 const clubs=JSON.parse(read("clubs/_shared/manifest.json"));
 for(const key of ["competitions","divisions","clubCrests"])assert.ok(key in competition,key);
 for(const key of ["clubs","countryFlags","rivalries","clubCrests"])assert.ok(key in clubs,key);
});
test("generated-page drift detection is clean",()=>{
 const run=spawnSync(process.execPath,["tools/generate-app-pages.mjs","--check"],{cwd:root,encoding:"utf8",timeout:120000});
 assert.equal(run.status,0,run.stderr||run.stdout||run.error?.message);
});
test("search, canonical routes and publication boundary regression suites are present",()=>{
 for(const file of ["tests/publication-gate.test.mjs","tests/app-search.test.mjs","tests/app-canonical-routes.test.mjs","tests/a05-11-dev-publication-boundaries.test.mjs"])assert.match(read(file),/test\(/);
});
