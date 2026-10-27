import test from "node:test";
import assert from "node:assert/strict";
import {classifyImpact} from "../tools/ci-opt-01-impact.mjs";
test("impact groups permit only one bounded area",()=>{
 for(const [path,area] of [["calendar/index.html","calendar"],["clubs/fr/1/overview/index.html","clubs"],["competitions/it-1/standings/index.html","competitions"],["guide/index.html","guide"]]){
  const x=classifyImpact([path]);assert.equal(x.mode,"targeted");assert.equal(x.area,area);assert.ok(x.tests.length>0);
 }
});
test("mixed areas, shared assets and unknown paths require full",()=>{
 for(const xs of [["calendar/index.html","clubs/index.html"],["assets/app.css"],["assets/routes-registry.mjs"],["unexpected/new.mjs"],["calendar/index.html","assets/app.js"],[],["../bad"]])assert.equal(classifyImpact(xs).mode,"full");
});
test("docs stay FAST but changes to CI orchestration require FULL",()=>{
 assert.equal(classifyImpact(["docs/architecture/example.md"]).mode,"fast");
 assert.equal(classifyImpact([".github/workflows/int24-browser-qa.yml","tools/ci-opt-01-impact.mjs"]).mode,"full");
});

test("source files do not bypass scoped validation",()=>{
 const examples=["assets/app.css","assets/app.js","assets/routes-registry.mjs","assets/landing.js","tools/dev-standings-preview.mjs","tests/world-catalog.test.mjs"];
 for(const file of examples)assert.equal(classifyImpact([file]).mode,"full",file);
});
test("impact combinations fail closed and targeted test paths are deterministic",()=>{
 const candidates=[["calendar/index.html","calendar"],["clubs/it/1/overview/index.html","clubs"],["competitions/int-1/standings/index.html","competitions"],["guide/index.html","guide"]];
 for(const [file,area] of candidates){const result=classifyImpact([file,"docs/README.md"]);assert.equal(result.area,area);assert.equal(result.mode,"targeted");assert.ok(result.tests.every(x=>x.startsWith("tests/")&&x.endsWith(".test.mjs")));}
 assert.equal(classifyImpact(candidates.map(([file])=>file)).mode,"full");
});

test("workflow gates preserve final FULL and main browser safety",async()=>{
 const {readFileSync}=await import("node:fs");
 const node=readFileSync(new URL("../.github/workflows/landing-checks.yml",import.meta.url),"utf8");
 const browser=readFileSync(new URL("../.github/workflows/int24-browser-qa.yml",import.meta.url),"utf8");
 for(const workflow of [node,browser]){
  assert.match(workflow,/ready_for_review/);
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/echo "mode=full"/);
  assert.match(workflow,/github\.event\.pull_request\.draft/);
  assert.match(workflow,/github\.event_name == 'pull_request'/);
 }
 assert.match(node,/tests\/publication-gate\.test\.mjs/);
 assert.match(node,/tests\/arch-clean-02-security\.test\.mjs/);
 assert.match(node,/node tools\/ci-opt-01-node-runner\.mjs/);
 assert.match(browser,/node tests\/int24-browser-qa\.mjs/);
 assert.match(browser,/node tests\/clean-ui-03-webkit-iphone\.mjs/);
 assert.match(browser,/github\.event_name.*workflow_dispatch/);
 assert.match(browser,/PR_BASE_SHA=.*node tests\/clean-ui-03-css-parity\.mjs/);
});

test("every bounded TARGETED area selects existing nonempty test files",async()=>{
 const {existsSync}=await import("node:fs");
 for(const path of ["calendar/index.html","clubs/index.html","competitions/it-1/standings/index.html","guide/index.html"]){
  const selected=classifyImpact([path]);
  assert.equal(selected.mode,"targeted");
  assert.ok(selected.tests.length>0);
  for(const testFile of selected.tests)assert.ok(existsSync(new URL("../"+testFile,import.meta.url)),testFile);
 }
});

test("TARGETED browser installs only Playwright; FULL preserves image parity dependencies",async()=>{
 const {readFileSync}=await import("node:fs");
 const workflow=readFileSync(new URL("../.github/workflows/int24-browser-qa.yml",import.meta.url),"utf8");
 assert.match(workflow,/mode \}\}" = "targeted" ]; then\n            npm install --no-save --no-package-lock playwright@1\.58\.2/);
 assert.match(workflow,/pixelmatch@7\.1\.0 pngjs@7\.0\.0/);
 assert.match(workflow,/node tests\/clean-ui-03-webkit-iphone\.mjs/);
});

// A bounded area change must not omit its edited regression test.
test("TARGETED includes each changed area test as well as baseline contracts",()=>{
 for(const file of ["tests/world-calendar-model.test.mjs","tests/club-pages.test.mjs","tests/competition-rules-model.test.mjs"]){
  assert.ok(classifyImpact([file]).tests.includes(file),file);
 }
 for(const file of ["assets/world-calendar-model.js","assets/competition-model.js","assets/club-model.js"]){
  assert.equal(classifyImpact([file]).mode,"full",file+" is shared code");
 }
});

test("only obsolete FAST/TARGETED jobs can be cancelled, FULL is protected",async()=>{
 const {readFileSync}=await import('node:fs');
 for(const file of ['landing-checks.yml','int24-browser-qa.yml']){
  const source=readFileSync(new URL('../.github/workflows/'+file,import.meta.url),'utf8');
  assert.match(source,/cancel-in-progress:.*outputs.mode != 'full'/);
 }
});

test('area CSS changes preserve the exact-base screenshot parity gate',()=>{
 for(const file of ['assets/club-page.css','assets/competition-stats.css','assets/world-calendar.css','assets/guide-theme.css']){
  assert.equal(classifyImpact([file]).mode,'full',file);
 }
});
