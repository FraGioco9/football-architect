import test from "node:test";
import assert from "node:assert/strict";
import {measureRouteDeclaredAssets,resolveLocalAsset} from "../tools/measure-declared-assets.mjs";

test("deduplicate declared assets and retain source order",()=>{
 const result=measureRouteDeclaredAssets(["x.html"],()=>'<script src="/assets/a.js"></script><script src="/assets/a.js"></script><link rel="stylesheet" href="/assets/b.css">',p=>({"assets/a.js":10,"assets/b.css":20})[p]);
 assert.equal(result[0].declaredReferences,3);
 assert.equal(result[0].rawBytes,30);
 assert.deepEqual(result[0].assets.map(a=>a.path),["assets/a.js","assets/b.css"]);
});
test("query versions and hashes share one underlying file",()=>{
 const result=measureRouteDeclaredAssets(["x.html"],()=>'<script src="/assets/a.js?v=2"></script><script src="/assets/a.js#fragment"></script>',()=>10);
 assert.equal(result[0].declaredReferences,2);
 assert.equal(result[0].uniqueResources,1);
 assert.equal(result[0].rawBytes,10);
});
test("guide relative references resolve safely and are measurable",()=>{
 assert.equal(resolveLocalAsset("guide/index.html","../assets/landing.css"),"assets/landing.css");
 const result=measureRouteDeclaredAssets(["guide/index.html"],()=>'<link rel="stylesheet" href="../assets/landing.css">',()=>120);
 assert.equal(result[0].rawBytes,120);
});
test("external URLs and path traversal cannot masquerade as local assets",()=>{
 assert.equal(resolveLocalAsset("guide/index.html","https://other.invalid/assets/a.js"),null);
 assert.equal(resolveLocalAsset("guide/index.html","/assets/../secret.js"),null);
 assert.equal(resolveLocalAsset("guide/index.html","//other.invalid/assets/a.js"),null);
});
test("missing and invalid byte sizes remain unresolved",()=>{
 const result=measureRouteDeclaredAssets(["x.html"],()=>'<script src="/assets/good.js"></script><script src="/assets/missing.js"></script>',p=>p==="assets/good.js"?100:NaN);
 assert.equal(result[0].rawBytes,100);
 assert.deepEqual(result[0].unresolved,["assets/missing.js"]);
});
test("actual app and Guide pages resolve declared local assets",()=>{
 for(const route of ["dashboard/index.html","calendar/index.html","settings/index.html","competitions/index.html","clubs/index.html","competitions/it-1/index.html","guide/index.html"]){
  const [result]=measureRouteDeclaredAssets([route]);
  assert.deepEqual(result.unresolved,[],route);
  assert.ok(result.rawBytes>0,route);
 }
});
