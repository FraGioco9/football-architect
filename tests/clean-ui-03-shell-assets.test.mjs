import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shellAssetInventory} from "../tools/audit-shell-assets.mjs";

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
