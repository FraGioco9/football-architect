import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {repositoryRoot,planPublicFiles,assertPublicArtifact,stagePublicArtifact} from "../tools/publication-guard.mjs";

test("PUBLIC-01: only explicit public assets are eligible; demo fixture is excluded",()=>{
 const files=planPublicFiles();
 assert.ok(files.includes("assets/theme.js"),"runtime theme bootstrap must be public");
 assert.equal(files.filter(p=>/^app\/competitions\/(?:it|eng|es|de|fr|pt|nl|br)-[12]\/index\.html$/.test(p)).length,16);
 for(const path of ["tests/fixtures/it-1-demo.mjs","tests/world-competition-runtime.test.mjs",
                    "tools/publication-guard.mjs","data/division-allocations.provisional.json"])
  assert.ok(!files.includes(path),"not public: "+path);
 assert.ok(existsSync(join(repositoryRoot,"tests/fixtures/it-1-demo.mjs")));
 const fixture=readFileSync(join(repositoryRoot,"tests/fixtures/it-1-demo.mjs"),"utf8");
 assert.equal((fixture.match(/^\s*\[\d+,\d+,\d+,\d+,\d+,\d+,"[WDL]{5}"\],?$/gm)||[]).length,16);
 for(const path of files.filter(x=>/\.(?:js|css|html|json)$/.test(x)))
  assert.doesNotMatch(readFileSync(join(repositoryRoot,path),"utf8"),
   /\bit1Demo\b|__faFixtureHooks|tests\/fixtures\/it-1-demo/,path);
});
test("PUBLIC-02: reject repository-root hosting and injected test files",()=>{
 assert.throws(()=>assertPublicArtifact(repositoryRoot),/Repository root/);
 const root=mkdtempSync(join(tmpdir(),"fa-public-gate-"));
 try{
  const destination=join(root,"public");
  const files=stagePublicArtifact(repositoryRoot,destination);
  assert.deepEqual(assertPublicArtifact(destination),files);
  const themePath=join(destination,"assets","theme.js");
  assert.ok(existsSync(themePath),"staged artifact contains theme bootstrap");
  unlinkSync(themePath);
  assert.throws(()=>assertPublicArtifact(destination),/Public artifact does not match exact approved manifest/);
  assert.throws(()=>planPublicFiles(destination),/Required public asset missing: assets\/theme\.js/);
  writeFileSync(themePath,readFileSync(join(repositoryRoot,"assets","theme.js")));
  assert.deepEqual(assertPublicArtifact(destination),files);
  const injected=join(destination,"tests","fixtures","it-1-demo.mjs");
  mkdirSync(join(destination,"tests","fixtures"),{recursive:true});
  writeFileSync(injected,"example private sample");
  assert.throws(()=>assertPublicArtifact(destination),/Not allowlisted/);
  rmSync(join(destination,"tests"),{recursive:true,force:true});
  writeFileSync(join(destination,"assets","competition-page.js"),"it1Demo");
  assert.throws(()=>assertPublicArtifact(destination),/source mismatch|fixture/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test("PUBLIC-03: no repository-controlled deployment bypasses the artifact gate",()=>{
 // External provider settings cannot be verified from repository contents.
 const configs=["vercel.json","netlify.toml","railway.json","railway.toml",
  "wrangler.toml","wrangler.json","Dockerfile","firebase.json"];
 for(const file of configs)
  assert.ok(!existsSync(join(repositoryRoot,file)),"inspect new deployment config: "+file);
 const dir=join(repositoryRoot,".github","workflows");
 for(const file of readdirSync(dir).filter(f=>/\.ya?ml$/.test(f))){
  const source=readFileSync(join(dir,file),"utf8");
  if(file==="manual-vercel-preview.yml"){
   // An explicit, owner-triggered Preview is the only audited publication exception.
   assert.match(source,/^  workflow_dispatch:$/m);
   assert.doesNotMatch(source,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
   for(const gate of [
    /GITHUB_ACTOR/,/inputs\.expected_sha/,/\.head\.sha == \$sha/,
    /landing-checks\.yml\/runs\?head_sha=/,/node --test tests\/\*\.test\.mjs/,
    /stagePublicArtifact/,/assertPublicArtifact/,/actions\/upload-artifact@v4/,
    /needs: stage-public/,/actions\/download-artifact@v4/,
    /secrets\.VERCEL_TOKEN/,/--target=preview/,/VERCEL_PROJECT_ID/,
    /readyState == "READY"/,/vercel alias set/,
    /STABLE_PREVIEW_ALIAS: football-architect-preview\.vercel\.app/,
    /alias_status/,/Alias belongs to another project/,
    /\.deploymentId == \$deployment/
   ])assert.match(source,gate,"Manual preview gate missing: "+gate);
   assert.doesNotMatch(source,/--prod\b|--target=production|vercel\s+promote|vercel\s+rollback/i);
   assert.doesNotMatch(source,/deploy-pages|upload-pages-artifact|actions\/deploy-pages/i);
  }else{
   assert.doesNotMatch(source,/\b(deploy|publish|upload-pages-artifact|actions\/deploy-pages)\b/i,
    "Workflow must use audited public artifact: "+file);
  }
 }
});
