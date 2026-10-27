import test from "node:test";
import assert from "node:assert/strict";
import {inventoryAssetReferences,planAssetRemoval} from "../tools/audit-repository-assets.mjs";
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

test("classification never marks unreferenced asset safe to remove",()=>{
 const files={"assets/legacy.bin":"x","assets/flags/it.svg":"<svg/>","index.html":"text"};
 const report=inventoryAssetReferences(".",fake(files));
 assert.deepEqual(report.classification.map(x=>x.status),["dynamic-or-catalogue","unresolved"]);
 assert.deepEqual(report.provenUnused,[]);
});

test("dynamic classification includes specific provenance and no deletion authorization",()=>{
 const report=inventoryAssetReferences(".",fake({"assets/flags/gb-eng.svg":"<svg/>","assets/clubs/FR/1/crest.svg":"<svg/>","assets/divisions/it-1.svg":"<svg/>"}));
 assert.equal(report.provenUnused.length,0);
 for(const entry of report.classification){assert.equal(entry.status,"dynamic-or-catalogue");assert.ok(entry.evidence[0].startsWith("tools/"));}
});

test("P5 deletion gate rejects every unresolved or dynamic asset",()=>{
 const result=planAssetRemoval({classification:[
  {path:"assets/flag.svg",status:"dynamic-or-catalogue",evidence:[]},
  {path:"assets/unknown.svg",status:"unresolved",evidence:[]},
  {path:"assets/proven.svg",status:"proven-unused",evidence:["generator-check-pass"]}
 ]});
 assert.equal(result.decision,"retain-all");
 assert.deepEqual(result.allowed,[]);
 assert.equal(result.blocked.length,3);
});
test("P5 deletion gate still requires separate approval after every proof",()=>{
 const result=planAssetRemoval({classification:[{path:"assets/test.svg",status:"proven-unused",evidence:["generator-check-pass","publication-boundary-pass","runtime-reference-pass"]}]});
 assert.deepEqual(result.allowed,["assets/test.svg"]);
 assert.equal(result.decision,"requires-explicit-removal-approval");
});
