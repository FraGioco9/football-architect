import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scanRouteDependencyFiles} from "../tools/audit-page-dependencies.mjs";

test("dependency report covers actual generated app entrypoints without broken local root files",()=>{
 const routes=["dashboard/index.html","calendar/index.html","settings/index.html","competitions/index.html","clubs/index.html"];
 const results=scanRouteDependencyFiles(routes);
 assert.equal(results.length,routes.length);
 for(const page of results){
   assert.ok(page.roots.length>0,page.route);
   assert.ok(page.visited.length>=page.roots.length,page.route);
   assert.equal(page.unresolved.filter(x=>x.reason==="missing-source"&&page.roots.includes(x.url)).length,0,"missing root "+page.route);
 }
});
test("scan has no file writes or template edits",()=>{
 const route="calendar/index.html";
 const before=readFileSync(new URL("../"+route,import.meta.url),"utf8");
 scanRouteDependencyFiles([route]);
 assert.equal(readFileSync(new URL("../"+route,import.meta.url),"utf8"),before);
});
