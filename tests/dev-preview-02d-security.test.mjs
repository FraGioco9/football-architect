import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {repositoryRoot,listFiles,stagePublicArtifact,assertPublicArtifact} from "../tools/publication-guard.mjs";
import {stageProtectedDebugArtifact,assertProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";

function sandbox(fn) {
 const root=mkdtempSync(join(tmpdir(),"fa-02d-"));
 try {fn(root);} finally {rmSync(root,{recursive:true,force:true});}
}
test("02D: public artifact rejects injected DEV-only content and extra files",()=>{
 sandbox(root=>{
  const out=join(root,"public");
  stagePublicArtifact(repositoryRoot,out);
  const target=join(out,"index.html");
  writeFileSync(target,readFileSync(target,"utf8")+"\n<script src='/__fa_dev__/debug-settings.mjs'></script>");
  assert.throws(()=>assertPublicArtifact(out),/mismatch|Private development fixture/);
 });
 sandbox(root=>{
  const out=join(root,"public");
  stagePublicArtifact(repositoryRoot,out);
  mkdirSync(join(out,"__fa_dev__"),{recursive:true});
  writeFileSync(join(out,"__fa_dev__","secret.js"),"secret");
  assert.throws(()=>assertPublicArtifact(out),/Not allowlisted/);
 });
});
test("02D: protected artifact fails closed for unexpected assets and missing files",()=>{
 sandbox(root=>{
  const out=join(root,"debug");
  stageProtectedDebugArtifact(repositoryRoot,out);
  writeFileSync(join(out,"unexpected.txt"),"unexpected");
  assert.throws(()=>assertProtectedDebugArtifact(out),/Not allowlisted/);
 });
 sandbox(root=>{
  const out=join(root,"debug");
  stageProtectedDebugArtifact(repositoryRoot,out);
  rmSync(join(out,"__fa_dev__","debug-settings.mjs"));
  assert.throws(()=>assertProtectedDebugArtifact(out),/manifest|mismatch/);
 });
});
test("02D: protected source symlinks and absent sources fail before artifact creation",()=>{
 sandbox(root=>{
  const source=join(root,"source");
  mkdirSync(join(source,"tools"),{recursive:true});
  symlinkSync(join(repositoryRoot,"tools","dev-debug-settings.mjs"),join(source,"tools","dev-debug-settings.mjs"));
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,join(root,"debug"),{debugRoot:source}),/Missing or unsafe protected Debug source/);
 });
 sandbox(root=>{
  const source=join(root,"empty");
  mkdirSync(source);
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,join(root,"debug"),{debugRoot:source}),/Missing or unsafe protected Debug source/);
 });
});
test("02D: downloaded public and Debug payloads fail closed",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
 const code=workflow.match(/\/\/ PUBLIC03_VERIFY_ARTIFACT_BEGIN\n([\s\S]*?)\n\s*\/\/ PUBLIC03_VERIFY_ARTIFACT_END/)?.[1]?.replace(/^          /gm,"");
 assert.ok(code,"Workflow must contain independent post-download verifier");
 for(const contract of ["public","protected_debug"]){
  function attempt(mutate,expected=true){sandbox(root=>{
   const site=join(root,"site");
   (contract==="public"?stagePublicArtifact:stageProtectedDebugArtifact)(repositoryRoot,site);
   const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
   const debugHash=contract==="protected_debug"?hash(readFileSync(join(site,"__fa_dev__/artifact-manifest.json"))):"";
   const manifest={schemaVersion:1,contract,sourceSha:"a".repeat(40),files:listFiles(site).map(path=>({path,sha256:hash(readFileSync(join(site,path)))}))};
   const env={...process.env,ARTIFACT_ROOT:site,INVENTORY_PATH:join(root,"publication-manifest.json"),EXPECTED_SHA:manifest.sourceSha,ARTIFACT_CONTRACT:contract,EXPECTED_DEBUG_MANIFEST_SHA256:debugHash};
   function inventory(){writeFileSync(env.INVENTORY_PATH,JSON.stringify(manifest)+"\n");env.EXPECTED_INVENTORY_SHA256=hash(readFileSync(env.INVENTORY_PATH));}
   inventory();
   if(mutate)mutate({site,manifest,env,inventory,hash,root});
   const result=spawnSync(process.execPath,["--input-type=module","-e",code],{env,encoding:"utf8"});
   assert.equal(result.status===0,expected,contract+": "+result.stderr);
  });}
  attempt();
  attempt(({site})=>writeFileSync(join(site,"index.html"),"tampered"),false);
  attempt(({site})=>rmSync(join(site,"assets/competition-page.js")),false);
  attempt(({site})=>writeFileSync(join(site,"extra.txt"),"extra"),false);
  attempt(({site})=>{rmSync(join(site,"index.html"));symlinkSync(join(repositoryRoot,"index.html"),join(site,"index.html"));},false);
  attempt(({env})=>env.EXPECTED_INVENTORY_SHA256="b".repeat(64),false);
  attempt(({env})=>env.EXPECTED_SHA="b".repeat(40),false);
  attempt(({env})=>env.ARTIFACT_CONTRACT="production",false);
  attempt(({manifest,inventory})=>{manifest.files.push(manifest.files[0]);inventory();},false);
  attempt(({manifest,inventory})=>{manifest.files[0].path="../escape";inventory();},false);
  attempt(({site,manifest,inventory,hash})=>{mkdirSync(join(site,".vercel"));writeFileSync(join(site,".vercel/project.json"),"{}");manifest.files.push({path:".vercel/project.json",sha256:hash("{}")});manifest.files.sort((a,b)=>a.path<b.path?-1:1);inventory();},false);
  if(contract==="protected_debug"){
   // A forged transport inventory must still fail against the owner-approved internal manifest.
   attempt(({site,manifest,inventory,hash})=>{const path="__fa_dev__/debug-settings.mjs";writeFileSync(join(site,path),"tampered");manifest.files.find(f=>f.path===path).sha256=hash("tampered");inventory();},false);
   attempt(({env})=>env.EXPECTED_DEBUG_MANIFEST_SHA256="",false);
   attempt(({env})=>env.EXPECTED_DEBUG_MANIFEST_SHA256="b".repeat(64),false);
   attempt(({site,manifest,inventory,hash})=>{const path="__fa_dev__/artifact-manifest.json";writeFileSync(join(site,path),"{}");manifest.files.find(f=>f.path===path).sha256=hash("{}");inventory();},false);
  }else{
   attempt(({site,manifest,inventory,hash})=>{const bytes="<script src='/__fa_dev__/debug-settings.mjs'></script>";writeFileSync(join(site,"index.html"),bytes);manifest.files.find(f=>f.path==="index.html").sha256=hash(bytes);inventory();},false);
  }
 }
});
