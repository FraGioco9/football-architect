import test from "node:test";
import assert from "node:assert/strict";
import {measureRouteDeclaredAssets} from "../tools/measure-declared-assets.mjs";
test("deduplicates resource bytes but retains declared link count",()=>{
 const a=measureRouteDeclaredAssets(["x.html"],()=>'<head><script src="/assets/a.js"></script><script src="/assets/a.js"></script><link href="/assets/b.css"></head>',p=>({"assets/a.js":10,"assets/b.css":20})[p]);
 assert.equal(a[0].declaredReferences,3);assert.equal(a[0].rawBytes,30);assert.equal(a[0].uniqueResources,2);
});
test("missing asset remains unresolved rather than treated as zero",()=>{
 const a=measureRouteDeclaredAssets(["x.html"],()=>'<script src="/assets/missing.js"></script>',()=>{throw Error("missing")});
 assert.deepEqual(a[0].unresolved,["assets/missing.js"]);
});
test("real page families have locally resolvable declared assets",()=>{
 const routes=["dashboard/index.html","calendar/index.html","settings/index.html","competitions/index.html","clubs/index.html","competitions/it-1/index.html"];
 const report=measureRouteDeclaredAssets(routes);
 assert.equal(report.length,6);
 for(const entry of report){assert.deepEqual(entry.unresolved,[],entry.route);assert.ok(entry.rawBytes>0);assert.ok(entry.declaredReferences>=5)}
});

test("a missing or invalid size does not silently poison the byte total",()=>{
 const result=measureRouteDeclaredAssets(["x.html"],()=>'<head><script src="/assets/existing.js"></script><script src="/assets/missing.js"></script></head>',p=>p==="assets/existing.js"?100:undefined);
 assert.equal(result[0].rawBytes,100);
 assert.deepEqual(result[0].unresolved,["assets/missing.js"]);
});
test("negative and non-finite sizes are unresolved rather than valid savings",()=>{
 const result=measureRouteDeclaredAssets(["x.html"],()=>'<script src="/assets/a.js"></script><script src="/assets/b.js"></script>',p=>p==="assets/a.js"?-1:NaN);
 assert.equal(result[0].rawBytes,0);
 assert.deepEqual(result[0].unresolved,["assets/a.js","assets/b.js"]);
});
