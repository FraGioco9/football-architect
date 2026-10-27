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
test("docs and CI-only changes remain fast during drafts",()=>{
 assert.equal(classifyImpact(["docs/architecture/example.md"]).mode,"fast");
 assert.equal(classifyImpact([".github/workflows/int24-browser-qa.yml","tools/ci-opt-01-impact.mjs"]).mode,"fast");
});
