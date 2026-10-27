import test from "node:test";
import assert from "node:assert/strict";
import {scanRouteDependencyFiles} from "../tools/audit-page-dependencies.mjs";

test("relative imports are traced transitively from a generated page",()=>{
  const files={
    "dashboard/index.html":'<head><script src="/assets/a.js"></script></head>',
    "assets/a.js":'import "./b.js";',
    "assets/b.js":"export const ok=true;"
  };
  const result=scanRouteDependencyFiles(["dashboard/index.html"],p=>{if(!(p in files))throw Error(p);return files[p]});
  assert.deepEqual(result[0].visited,["/assets/a.js","/assets/b.js"]);
  assert.deepEqual(result[0].unresolved,[]);
  assert.equal(result[0].confidence,"literal-imports-only");
});
test("unsafe or external paths are never read",()=>{
  const reads=[];
  const result=scanRouteDependencyFiles(["calendar/index.html"],p=>{
    reads.push(p);
    if(p==="calendar/index.html")return '<head><script src="https://third.party/a.js"></script><script src="/assets/../private.js"></script></head>';
    throw Error("Unexpected source read");
  });
  assert.deepEqual(reads,["calendar/index.html"]);
  assert.equal(result[0].unresolved.length,2);
});
test("missing and package imports remain unresolved",()=>{
  const files={"settings/index.html":'<head><script src="/assets/a.js"></script></head>',"assets/a.js":'import "package"; import "./missing.js";'};
  const result=scanRouteDependencyFiles(["settings/index.html"],p=>{if(!(p in files))throw Error(p);return files[p]});
  assert.deepEqual(result[0].unresolved.map(x=>x.reason),["nonrelative-import","missing-source"]);
});
test("real checked-in pages can be inventoried without code changes",()=>{
  const routes=["dashboard/index.html","calendar/index.html","settings/index.html"];
  const result=scanRouteDependencyFiles(routes);
  assert.equal(result.length,3);
  assert.ok(result.every(x=>x.roots.length>0&&x.confidence==="literal-imports-only"));
});
