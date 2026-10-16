import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";
import {ARTIFACT_CONTRACTS,assertArtifactContract,planProtectedDebugFiles,
 assertProtectedDebugArtifact,stageProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";

function sandbox() {
 const root=mkdtempSync(join(tmpdir(),"fa-protected-debug-"));
 const debugRoot=join(root,"fixtures");
 mkdirSync(join(debugRoot,"tools"),{recursive:true});
 for(const [name,content] of [
  ["dev-debug-settings.mjs","export const enabled = false;\n"],
  ["dev-standings-preview-client.mjs","export const client = true;\n"],
  ["dev-standings-preview-data.mjs","export const data = [];\n"],
  ["dev-debug-widget.mjs","export const widget = true;\n"]
 ])writeFileSync(join(debugRoot,"tools",name),content);
 return {root,debugRoot,protectedPath:join(root,"protected"),publicPath:join(root,"public")};
}

test("DEBUG-INFRA-01: contracts are explicit; protected files are never public",()=>{
 assert.deepEqual(ARTIFACT_CONTRACTS,["public","protected_debug"]);
 for(const value of ["",undefined,"preview","production","protected","PUBLIC"])
  assert.throws(()=>assertArtifactContract(value),/Unrecognized artifact contract/);
 assert.equal(assertArtifactContract("public"),"public");
 assert.equal(assertArtifactContract("protected_debug"),"protected_debug");
 for(const path of ["__fa_dev__/debug-settings.mjs","__fa_dev__/standings-client.mjs",
  "__fa_dev__/standings-data.mjs","__fa_dev__/debug-widget.mjs","__fa_dev__/artifact-manifest.json"])
  assert.equal(isAllowlistedPublicPath(path),false);
});

test("DEBUG-INFRA-02: protected contract is a separately verified, nonpublic artifact",()=>{
 const {root,debugRoot,protectedPath,publicPath}=sandbox();
 try {
  const planned=planProtectedDebugFiles(repositoryRoot,{debugRoot});
  const files=stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  assert.deepEqual(files,planned);
  assert.deepEqual(assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),planned);
  const manifest=JSON.parse(readFileSync(join(protectedPath,"__fa_dev__","artifact-manifest.json"),"utf8"));
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.contract,"protected_debug");
  assert.deepEqual(manifest.files.map(x=>x.path),planned.filter(p=>p!=="__fa_dev__/artifact-manifest.json"));
  for(const file of manifest.files)assert.match(file.sha256,/^[0-9a-f]{64}$/);
  const protectedHtml=readFileSync(join(protectedPath,"app","index.html"),"utf8");
  const originalHtml=readFileSync(join(repositoryRoot,"app","index.html"),"utf8");
  assert.doesNotMatch(originalHtml,/__fa_dev__\/debug-settings/);
  assert.equal(protectedHtml.split('src="/__fa_dev__/debug-settings.mjs"').length,2);
  assert.match(protectedHtml,/__fa_dev__\/debug-settings\.mjs/);
  const landing=readFileSync(join(protectedPath,"index.html"));
  assert.ok(landing.equals(readFileSync(join(repositoryRoot,"index.html"))));
  assert.throws(()=>assertPublicArtifact(protectedPath),/Not allowlisted/);
  const publicFiles=stagePublicArtifact(repositoryRoot,publicPath);
  assert.deepEqual(assertPublicArtifact(publicPath),publicFiles);
  assert.equal(existsSync(join(publicPath,"__fa_dev__")),false);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("DEBUG-INFRA-03: changes, missing files, and injections fail closed",()=>{
 const {root,debugRoot,protectedPath}=sandbox();
 try{
  stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  const page=join(protectedPath,"app","index.html");
  const original=readFileSync(page);
  writeFileSync(page,Buffer.concat([original,Buffer.from("tampered")]));
  assert.throws(()=>assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),/source mismatch/);
  writeFileSync(page,original);
  const manifest=join(protectedPath,"__fa_dev__","artifact-manifest.json");
  const savedManifest=readFileSync(manifest);
  writeFileSync(manifest,"{}\n");
  assert.throws(()=>assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),/source mismatch/);
  writeFileSync(manifest,savedManifest);
  const module=join(protectedPath,"__fa_dev__","debug-settings.mjs");
  unlinkSync(module);
  assert.throws(()=>assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),/exact manifest/);
  writeFileSync(module,readFileSync(join(debugRoot,"tools","dev-debug-settings.mjs")));
  const extra=join(protectedPath,"__fa_dev__","unexpected.js");
  writeFileSync(extra,"unsafe");
  assert.throws(()=>assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),/Not allowlisted/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("DEBUG-INFRA-04: missing DEV entry, bad roots, and overwrite are rejected",()=>{
 const {root,debugRoot,protectedPath}=sandbox();
 try{
  unlinkSync(join(debugRoot,"tools","dev-debug-settings.mjs"));
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot}),
   /Missing or unsafe protected Debug source/);
  assert.equal(existsSync(protectedPath),false);
  writeFileSync(join(debugRoot,"tools","dev-debug-settings.mjs"),"export default true;\n");
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,repositoryRoot,{debugRoot}),
   /Repository or Debug root/);
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,debugRoot,{debugRoot}),
   /Repository or Debug root/);
  stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot}),
   /Refusing to overwrite/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("DEBUG-INFRA-05: GitHub can stage Public, but protected publishing stays disabled",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github","workflows","manual-vercel-preview.yml"),"utf8");
 assert.match(workflow,/artifact_contract:/);
 assert.match(workflow,/stage-protected-debug:/);
 assert.match(workflow,/Protected Debug publication remains disabled/);
 assert.match(workflow,/exit 1/);
 assert.match(workflow,/approved-preview-public/);
 assert.match(workflow,/--target=preview/);
 assert.doesNotMatch(workflow,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
});


test("DEBUG-RUNTIME-01: protected browser imports resolve within artifact",()=>{
 const {root,debugRoot,protectedPath}=sandbox();
 try{
  for(const name of ["dev-debug-settings.mjs","dev-standings-preview-client.mjs","dev-standings-preview-data.mjs","dev-debug-widget.mjs"])
   writeFileSync(join(debugRoot,"tools",name),readFileSync(join(repositoryRoot,"tools",name)));
  stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  const directory=join(protectedPath,"__fa_dev__");
  for(const name of ["debug-settings.mjs","standings-client.mjs","standings-data.mjs","debug-widget.mjs"]){
   const source=readFileSync(join(directory,name),"utf8");
   for(const match of source.matchAll(/(?:import|export)\\s+(?:[^"'\\n]*?\\s+from\\s+)?["'](\\.[^"']+)["']/g))
    assert.equal(existsSync(join(directory,match[1])),true,name+" imports missing "+match[1]);
  }
 }finally{rmSync(root,{recursive:true,force:true})}
});
