import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shellAssetInventory,classifyAssetReferences} from "../tools/audit-shell-assets.mjs";

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
