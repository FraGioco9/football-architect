import test from "node:test";
import assert from "node:assert/strict";
import {classifyImpact} from "../tools/ci-opt-01-impact.mjs";
test("impact groups permit only one bounded area",()=>{
 for(const [path,area] of [["calendar/index.html","calendar"],["clubs/fr/1/overview/index.html","clubs"],["competitions/it-1/standings/index.html","competitions"],["guide/index.html","guide"],["settings/index.html","admin"]]){
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
 const examples=["assets/app.css","assets/app.js","assets/routes-registry.mjs","assets/landing.js","tools/dev-standings-preview.mjs","tests/world-catalog.test.mjs","assets/club-crests.js","assets/competition-tabs.js","assets/competition-rules.js"];
 for(const file of examples)assert.equal(classifyImpact([file]).mode,"full",file);
});
test("impact combinations fail closed and targeted test paths are deterministic",()=>{
 const candidates=[["calendar/index.html","calendar"],["clubs/it/1/overview/index.html","clubs"],["competitions/int-1/standings/index.html","competitions"],["guide/index.html","guide"]];
 for(const [file,area] of candidates){const result=classifyImpact([file,"docs/README.md"]);assert.equal(result.area,area);assert.equal(result.mode,"targeted");assert.ok(result.tests.every(x=>x.startsWith("tests/")&&x.endsWith(".test.mjs")));}
 assert.equal(classifyImpact(candidates.map(([file])=>file)).mode,"full");
});

test("workflow gates preserve final FULL and main browser safety",async()=>{
 const {readFileSync}=await import("node:fs");
 const node=readFileSync(new URL("../.github/workflows/landing-checks.yml",import.meta.url),"utf8")+readFileSync(new URL("../tools/ci-selected.mjs",import.meta.url),"utf8");
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
 for(const path of ["calendar/index.html","clubs/index.html","competitions/it-1/standings/index.html","guide/index.html","settings/index.html"]){
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

test('area CSS changes retain mandatory FULL browser coverage',()=>{
 for(const file of ['assets/club-page.css','assets/competition-stats.css','assets/world-calendar.css','assets/guide-theme.css']){
  assert.equal(classifyImpact([file]).mode,'full',file);
 }
});

test("Admin World changes select bounded Settings contracts without skipping cross-cutting safety",()=>{
 for(const file of ["assets/admin-settings.js","settings/index.html","tests/admin-settings.test.mjs"]){
  const scope=classifyImpact([file]);
  assert.equal(scope.mode,"targeted",file);
  assert.equal(scope.area,"admin",file);
  assert.ok(scope.tests.includes("tests/admin-settings.test.mjs"));
  assert.ok(scope.tests.includes("tests/dev-admin-api-proxy.test.mjs"));
 }
 for(const files of [["assets/admin-settings.css"],["backend/src/http-admin.ts"],["data/divisions.json"],["assets/admin-settings.js","backend/src/reset-world-command.ts"]])
  assert.equal(classifyImpact(files).mode,"full",files.join(","));
});
test("Admin workflow keeps exact-head contract checks while deferring heavy draft runtime",async()=>{
 const {readFileSync}=await import("node:fs");
 const admin=readFileSync(new URL("../.github/workflows/admin-world-checks.yml",import.meta.url),"utf8");
 const site=readFileSync(new URL("../.github/workflows/landing-checks.yml",import.meta.url),"utf8")+readFileSync(new URL("../tools/ci-selected.mjs",import.meta.url),"utf8");
 assert.match(admin,/Test password and world contracts/);
 assert.match(admin,/Verify D1-compatible SQLite migration locally/);
 assert.match(admin,/Typecheck backend with pinned TypeScript/);
 assert.match(admin,/cancel-in-progress:.*github\.event\.action == 'synchronize'/);
 assert.match(admin,/if: \$\{\{ needs\.scope\.outputs\.mode == 'full' \}\}/);
 assert.match(admin,/admin-world-final-verification/);
 assert.match(site,/node --check assets\/admin-settings\.js/);
 assert.match(site,/tests\/admin-settings\.test\.mjs/);
});

test('Admin targeted contracts include approved Season2 controls; shared season authority remains FULL',()=>{
 const result=classifyImpact(['assets/admin-settings.js']);
 assert.equal(result.mode,'targeted');assert.ok(result.tests.includes('tests/season-two-controls.test.mjs'));
 for(const path of ['assets/authoritative-season.mjs','assets/authoritative-calendar.mjs','backend/tools/run-contracts.mjs','tests/admin-world-lifecycle-browser.mjs'])assert.equal(classifyImpact([path]).mode,'full',path);
});


test('CI-OPT-06: unrelated reviewed public-page Draft changes do not start heavy Admin checks',async()=>{
 const {classifyAdminScope}=await import('../tools/ci-opt-06-admin-impact.mjs');
 for(const file of ['calendar/index.html','clubs/it/1/overview/index.html',
   'competitions/it-1/standings/index.html','guide/index.html','docs/ci/notes.md']){
   assert.equal(classifyAdminScope([file]),'fast',file);
 }
 for(const file of ['assets/admin-settings.js','settings/index.html','tests/admin-settings.test.mjs']){
   assert.equal(classifyAdminScope([file]),'targeted',file);
 }
 for(const paths of [['assets/app.js'],['assets/app.css'],['assets/routes-registry.mjs'],
   ['backend/src/index.ts'],['tools/ci-opt-01-impact.mjs'],['.github/workflows/admin-world-checks.yml'],
   ['calendar/index.html','clubs/index.html'],['calendar/index.html','backend/src/index.ts'],[],['../bad']]){
   assert.equal(classifyAdminScope(paths),'full',paths.join(','));
 }
 const {readFileSync}=await import('node:fs');
 const admin=readFileSync(new URL('../.github/workflows/admin-world-checks.yml',import.meta.url),'utf8');
 assert.match(admin,/node tools\/ci-opt-06-admin-impact\.mjs >> "\$GITHUB_OUTPUT"/);
 assert.match(admin,/echo 'mode=full'/);
 assert.match(admin,/needs\.scope\.outputs\.mode == 'full'/);
 assert.match(admin,/admin-world-final-verification/);
});

test('CI-OPT-06: catalog tests are owned by Site FULL without separate launches',async()=>{
 const {readFileSync,existsSync}=await import('node:fs');
 const {buildPlan}=await import('../tools/ci-opt-01-node-runner.mjs');
 for(const file of ['players-names-catalog.yml','surnames-01.yml'])
   assert.equal(existsSync(new URL('../.github/workflows/'+file,import.meta.url)),false,file);
 const plan=buildPlan();
 for(const file of ['tests/players-names-catalog.test.mjs','tests/surnames-01-catalog.test.mjs'])
   assert.equal([...plan.parallel,...plan.serial].filter(p=>p===file).length,1,file);
 const site=readFileSync(new URL('../.github/workflows/landing-checks.yml',import.meta.url),'utf8');
 assert.ok(site.includes('node tools/ci-opt-01-node-runner.mjs'));
 assert.ok(site.includes('node tools/ci-opt-06-surname-scope.mjs'));
 assert.ok(site.includes('Restore SURNAMES-01 provenance for FULL contracts'));
 assert.ok(site.includes("needs.head-exact.outputs.mode == 'full'"));
});

test('CI-OPT-06: surname data scope keeps the original cross-catalog guard',async()=>{
 const {validateSurnameScope}=await import('../tools/ci-opt-06-surname-scope.mjs');
 for(const changed of [[],['docs/example.md'],['tests/surnames-01-catalog.test.mjs']])
   assert.equal(validateSurnameScope(changed),false);
 for(const changed of [['data/players/surnames/catalog-v1.json'],
   ['data/players/surnames/countries/ITA.json','tests/surnames-01-catalog.test.mjs','tools/ci-test-ownership.json'],
   ['data/players/surnames/README.md']])
   assert.equal(validateSurnameScope(changed),true);
 for(const changed of [
   ['data/players/surnames/catalog-v1.json','data/players/names/catalog-v1.json'],
   ['data/players/surnames/catalog-v1.json','assets/app.js'],
   ['data/players/surnames/unknown.json'],
   ['data/players/surnames/countries/ita.json'],
   ['data/players/surnames/catalog-v1.json','../bad'],
   [''],
 ])
   assert.throws(()=>validateSurnameScope(changed),/SURNAMES-01|Invalid/,changed.join(','));
});

test('CI-OPT-06: Match Engine checks only engine changes, never generic DEV preview',async()=>{
 const {readFileSync}=await import('node:fs');
 const me=readFileSync(new URL('../.github/workflows/match-engine-01.yml',import.meta.url),'utf8');
 const triggers=me.split('    paths:')[1]?.split('jobs:')[0];
 assert.ok(triggers);
 assert.ok(triggers.includes('match-engine/**'));
 assert.ok(triggers.includes('.github/workflows/match-engine-01.yml'));
 for(const unrelated of ['dev-standings-preview','ci-test-ownership','assets/'])
   assert.ok(!triggers.includes(unrelated),unrelated);
 assert.ok(me.includes('ref: ${{ github.event.pull_request.head.sha }}'));
 for(const mandatory of ['npm --prefix match-engine test','match-engine/tests/lab-viewport-browser.test.mjs',
   'npm --prefix match-engine run bench'])
   assert.ok(me.includes(mandatory),mandatory);
});

test('Browser matrix job concurrency isolates siblings and preserves FULL run identity',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 const lane=source.split('\n  chromium:')[1]?.split('\n  browser-result:')[0];
 assert.ok(lane);
 const group=lane.split('\n').find(line=>line.trimStart().startsWith('group:'));
 assert.ok(group?.includes('${{ matrix.lane }}'),'sibling lanes must have distinct concurrency keys');
 assert.ok(group.includes("needs.scope.outputs.mode != 'full'"));
 assert.ok(group.includes("format('run-{0}', github.run_id)"),'FULL is isolated by run');
 assert.match(lane,/cancel-in-progress:.*needs\.scope\.outputs\.mode != 'full'/);
});
