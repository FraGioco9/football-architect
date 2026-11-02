// I03 isolated transport and browser-import gate. No external network or D1.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {respondProtectedDebugProjection} from "../tools/debug-data-private-adapter.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=async path=>readFile(resolve(root,path),"utf8");
test("I03 protected endpoints are disabled unless explicitly enabled",async()=>{
 const old=process.env.FA_DEBUG_I03_PROTECTED;
 delete process.env.FA_DEBUG_I03_PROTECTED;
 try{
  for(const path of ["/__fa_dev_private__/season-view?season=1&day=1&competition=IT-1",
    "/__fa_dev_private__/world-view?season=1&day=1",
    "/__fa_dev_private__/history-view?season=2"]){
   let status=null,body="";
   const res={writeHead(n){status=n},end(value=""){body=value}};
   const req={url:path,method:"GET",headers:{host:"localhost:2000"},
    socket:{remoteAddress:"127.0.0.1"}};
   assert.equal(await respondProtectedDebugProjection(req,res),true);
   assert.equal(status,404);
   assert.equal(JSON.parse(body).error.code,"not_found");
  }
 }finally{if(old===undefined)delete process.env.FA_DEBUG_I03_PROTECTED;else process.env.FA_DEBUG_I03_PROTECTED=old}
});
test("I03 protected browser module imports resolve to DEV local files",async()=>{
 const files=["tools/dev-protected-i05-bootstrap.mjs","tools/dev-protected-debug-source.mjs",
  "tools/dev-protected-domestic-controller.mjs","tools/dev-protected-domestic-presenter.mjs",
  "tools/dev-protected-domestic-presentation.mjs","tools/dev-protected-page-bridge.mjs",
  "tools/dev-protected-world-source.mjs","tools/dev-protected-world-presenter.mjs",
  "tools/dev-protected-stats-controller.mjs","tools/dev-protected-history-controller.mjs",
  "tools/dev-protected-international-controller.mjs"];
 for(const file of files){
  const body=await source(file);
  for(const match of body.matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+)["']/g)){
   const target=resolve(dirname(resolve(root,file)),match[1]);
   await assert.doesNotReject(readFile(target));
  }
 }
});
test("I03 local bootstrap is not a public HTML script",async()=>{
 const bootstrap=await source("tools/dev-standings-preview.mjs");
 assert.match(bootstrap,/FA_DEBUG_I05_BROWSER_BRIDGE/);
 assert.match(bootstrap,/__fa_dev__\/dev-protected-i05-bootstrap\.mjs/);
 for(const file of ["calendar/index.html","clubs/_shared/index.html","competitions/it-1/index.html"]){
  assert.doesNotMatch(await source(file),/__fa_dev__\/dev-protected-i05-bootstrap/);
 }
});
