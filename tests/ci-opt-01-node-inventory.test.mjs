import test from "node:test";import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
test("static Node isolation inventory covers all test files without writing outputs",()=>{
 const raw=execFileSync(process.execPath,["tools/ci-opt-01-node-inventory.mjs","--json"],{encoding:"utf8"});
 const result=JSON.parse(raw);
 assert.ok(result.total>=91);
 assert.equal(result.rows.length,result.total);
 assert.equal(result.reviewRequired+result.candidates,result.total);
 assert.equal(new Set(result.rows.map(x=>x.file)).size,result.total);
 assert.ok(result.rows.every(x=>x.classification==="review-required"||x.classification==="candidate-only"));
 assert.ok(result.rows.some(x=>x.file==="tests/club-pages-browser.test.mjs"&&x.signals.includes("network")));
});
