import test from "node:test";
import assert from "node:assert/strict";
import {inventoryAssetReferences} from "../tools/audit-repository-assets.mjs";
function fake(files){
 return {
  readdirSync(dir){const prefix=dir==="."?"":dir+"/";const items=new Map();
   for(const path of Object.keys(files)){if(!path.startsWith(prefix))continue;const rem=path.slice(prefix.length),name=rem.split("/")[0];items.set(name,{name,isDirectory:()=>rem.includes("/"),isFile:()=>!rem.includes("/")})}
   return [...items.values()];
  },
  readFileSync(path){if(!(path in files))throw Error(path);return files[path]}
 }
}
test("explicit references are recorded without classifying unknown files unused",()=>{
 const files={"assets/app.js":"const ok=1","assets/clubs/FR/1/crest.svg":"<svg/>","index.html":'<script src="/assets/app.js"></script>'};
 const report=inventoryAssetReferences(".",fake(files));
 assert.equal(report.totalAssets,2);
 assert.equal(report.explicitlyReferenced,1);
 assert.deepEqual(report.unresolved.map(x=>x.reason),["crest-path-resolved-dynamically"]);
});
test("repo asset inventory is read only and tolerates files with no references",()=>{
 const files={"assets/orphan.bin":"x","README.md":"hello"};
 const before=JSON.stringify(files);
 const report=inventoryAssetReferences(".",fake(files));
 assert.equal(report.unresolved[0].reason,"requires-dynamic-and-publication-review");
 assert.equal(JSON.stringify(files),before);
});
