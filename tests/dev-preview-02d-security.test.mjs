import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact} from "../tools/publication-guard.mjs";
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
test("02D: workflow keeps protected publication disabled",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github","workflows","manual-vercel-preview.yml"),"utf8");
 assert.match(workflow,/artifact_contract == 'protected_debug'/);
 assert.match(workflow,/Block protected Debug until independent G10 deployment authorization/);
 assert.match(workflow,/exit 1/);
});
