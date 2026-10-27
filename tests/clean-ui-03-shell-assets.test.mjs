import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shellAssetInventory,classifyAssetReferences,comparePageAssetInventory,auditGeneratedPages,summarizeRouteAssets,inspectStaticScriptReferences,traceLiteralPageImports} from "../tools/audit-shell-assets.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("shell asset inventory preserves ordering and duplicates without changes",()=>{
  const html='<head><script src="/x.js"></script><link rel="stylesheet" href="/x.css"><script src="/x.js"></script></head>';
  assert.deepEqual(shellAssetInventory(html),[{url:"/x.js",kind:"script"},{url:"/x.css",kind:"link"},{url:"/x.js",kind:"script"}]);
});
test("shared template retains required bootstrap resources",()=>{
  const assets=shellAssetInventory(read("templates/app-page.html"));
  const urls=assets.map(x=>x.url);
  for(const path of ["/assets/theme.js","/assets/landing.css","/assets/app.css","/assets/landing.js","/assets/app.js","/assets/app-search.js"]){
    assert.ok(urls.includes(path),"missing baseline dependency: "+path);
  }
  assert.ok(urls.indexOf("/assets/theme.js")<urls.indexOf("/assets/app.js"));
});

test("asset presence is distinct from reachability or dead-code classification",()=>{
  const urls=["/assets/app.css","/assets/missing.js","/favicon.svg","/assets/app.css?v=1"];
  const list=classifyAssetReferences(urls,["assets/app.css"]);
  assert.deepEqual(list.map(x=>x.classification),["present","unresolved","non-asset","present"]);
  assert.equal(list[0].path,"assets/app.css");
});
test("head parser does not include asset markup from body",()=>{
  const html='<head><script src="/assets/app.js"></script></head><body><script src="/assets/late.js"></script></body>';
  assert.deepEqual(shellAssetInventory(html).map(x=>x.url),["/assets/app.js"]);
});

test("asset presence correctly strips leading URL slash",()=>{
  const [item]=classifyAssetReferences(["/assets/app.css"],["assets/app.css"]);
  assert.equal(item.classification,"present");
  assert.equal(item.path,"assets/app.css");
});
test("page dependency comparison distinguishes common and route-specific scripts",()=>{
  const report=comparePageAssetInventory([
    {route:"/calendar",html:'<head><script src="/assets/app.js"></script><script src="/assets/calendar.js"></script></head>'},
    {route:"/fixtures",html:'<head><script src="/assets/app.js"></script><script src="/assets/fixtures.js"></script></head>'}
  ]);
  assert.deepEqual(report.shared.map(x=>x.url),["/assets/app.js"]);
  assert.deepEqual(report.routeSpecific.map(x=>x.url),["/assets/calendar.js","/assets/fixtures.js"]);
  assert.equal(report.pages.length,2);
});
test("page asset inventory does not label missing direct links as unused",()=>{
  const report=comparePageAssetInventory([{route:"/",html:"<head></head>"}]);
  assert.equal(report.shared.length,0);
  assert.equal(report.routeSpecific.length,0);
});

test("real generated app routes share baseline dependencies",()=>{
  const report=auditGeneratedPages([
    "dashboard/index.html","calendar/index.html","settings/index.html",
    "competitions/index.html","clubs/index.html"
  ],path=>read(path));
  assert.equal(report.pages.length,5);
  const common=report.shared.map(x=>x.url);
  for(const required of ["/assets/app.css","/assets/app.js"]){
    assert.ok(common.includes(required),"not common to app pages: "+required);
  }
  assert.ok(report.routeSpecific.length>0,"expected page-specific dependencies");
});
test("route comparison keeps page membership and does not rewrite generated HTML",()=>{
  const pages=["dashboard/index.html","calendar/index.html"];
  const before=pages.map(read);
  const report=auditGeneratedPages(pages,path=>read(path));
  assert.deepEqual(pages.map(read),before);
  assert.deepEqual(report.pages.map(x=>x.route),pages);
  for(const asset of [...report.shared,...report.routeSpecific]){
    assert.ok(asset.routes.every(route=>pages.includes(route)));
  }
});

test("per-route dependency summary preserves common vs unique URLs",()=>{
  const result=comparePageAssetInventory([
    {route:"/a",html:'<head><script src="/shared.js"></script><script src="/a.js"></script><link href="/common.css"></head>'},
    {route:"/b",html:'<head><script src="/shared.js"></script><script src="/b.js"></script><link href="/common.css"></head>'}
  ]);
  const [a,b]=summarizeRouteAssets(result);
  assert.deepEqual([a.scriptCount,a.linkCount,a.sharedCount],[2,1,2]);
  assert.deepEqual(a.routeSpecificAssets,["/a.js"]);
  assert.deepEqual(b.routeSpecificAssets,["/b.js"]);
});

test("static script scanner reports literal imports without claiming dynamic resolution",()=>{
  const refs=inspectStaticScriptReferences('import x from "./x.mjs"; import("./lazy.js"); require("./old.cjs");');
  assert.deepEqual(refs.map(x=>x.kind),["static-import","dynamic-import-literal","require-literal"]);
  assert.deepEqual(refs.map(x=>x.specifier),["./x.mjs","./lazy.js","./old.cjs"]);
});
test("scanner excludes computed dynamic imports from proven dependency list",()=>{
  assert.deepEqual(inspectStaticScriptReferences('import("./"+name+".js")'),[]);
});

test("page import traversal resolves literal relative JS dependencies transitively",()=>{
  const report=comparePageAssetInventory([{route:"/dashboard",html:'<head><script src="/assets/app.js"></script></head>'}]);
  const result=traceLiteralPageImports(report,{
    "/assets/app.js":'import "./shared.js";',
    "/assets/shared.js":'import "./leaf.js";',
    "/assets/leaf.js":"export const ok=true;"
  });
  assert.deepEqual(result[0].visited,["/assets/app.js","/assets/shared.js","/assets/leaf.js"]);
  assert.deepEqual(result[0].unresolved,[]);
});
test("unavailable and package-style imports are explicitly unresolved",()=>{
  const report=comparePageAssetInventory([{route:"/x",html:'<head><script src="/assets/app.js"></script></head>'}]);
  const result=traceLiteralPageImports(report,{"/assets/app.js":'import "pkg"; import "./missing.js";'});
  assert.deepEqual(result[0].unresolved.map(x=>x.reason),["non-relative-import","source-unavailable"]);
});
test("import cycles do not cause infinite traversal",()=>{
  const report=comparePageAssetInventory([{route:"/x",html:'<head><script src="/assets/a.js"></script></head>'}]);
  const result=traceLiteralPageImports(report,{"/assets/a.js":'import "./b.js";',"/assets/b.js":'import "./a.js";'});
  assert.deepEqual(result[0].visited,["/assets/a.js","/assets/b.js"]);
});
