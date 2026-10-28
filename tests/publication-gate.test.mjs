import {spawnSync} from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {repositoryRoot,planPublicFiles,assertPublicArtifact,stagePublicArtifact} from "../tools/publication-guard.mjs";

test("INT24-PUBLIC: shared rules and stats are self-contained public dependencies",()=>{
 const publicFiles=planPublicFiles();
 const assets=["competition-model.js","competition-rules.js","competition-rules-view.js","competition-stats.js","competition-history.js","competition-page.js"];
 for(const name of assets){
  const path="assets/"+name;
  assert.ok(publicFiles.includes(path),"missing shared runtime "+path);
  const source=readFileSync(join(repositoryRoot,path),"utf8");
  assert.doesNotMatch(source,/\/__fa_dev__\/|(?:from\s*|require\s*\()\s*["\x27][^"\x27]*(?:tools\/dev-|dev-competition-stats|dev-standings-preview)/,"protected provider imported by "+path);
 }
 for(const path of ["tools/competition-catalogue.mjs","data/international-competitions.json","backend/catalogues/season-1.participants.json","backend/catalogues/season-1.candidate.json","backend/tools/season-one-candidate.mts","tools/dev-competition-stats-data.mjs"]){
  assert.ok(!publicFiles.includes(path),"private source must not publish: "+path);
 }
 const root=mkdtempSync(join(tmpdir(),"int24-public-contract-"));
 try{
  const target=join(root,"public");
  const staged=stagePublicArtifact(repositoryRoot,target);
  assert.deepEqual(assertPublicArtifact(target),staged);
  for(const name of assets)assert.ok(existsSync(join(target,"assets",name)));
  assert.ok(!existsSync(join(target,"__fa_dev__")));
  assert.ok(!existsSync(join(target,"tools")));
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("PUBLIC-01: only explicit public assets are eligible; demo fixture is excluded",()=>{
 const files=planPublicFiles();
  const divisionAssets=files.filter(p=>p.startsWith("assets/divisions/"));
  assert.equal(divisionAssets.length,32);
  assert.ok(divisionAssets.every(p=>p.endsWith("/primary.svg")||p.endsWith("/compact.svg")));
  assert.ok(!files.includes("assets/division-logos.js"));
 assert.ok(files.includes("assets/theme.js"),"runtime theme bootstrap must be public");
 assert.equal(files.filter(p=>/^competitions\/(?:it|eng|es|de|fr|pt|nl|br)-[12]\/index\.html$/.test(p)).length,16);
 for(const path of ["__fa_dev__/debug-settings.mjs","__fa_dev__/artifact-manifest.json",
                    "tools/dev-debug-settings.mjs","tools/dev-preview-artifact.mjs",
                    "tests/fixtures/it-1-demo.mjs","tests/world-competition-runtime.test.mjs",
                    "tools/publication-guard.mjs","backend/catalogues/season-1.participants.json","backend/catalogues/season-1.candidate.json","backend/tools/season-one-candidate.mts"])
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
  const routingPath=join(destination,"vercel.json"),routing=readFileSync(routingPath,"utf8");
  writeFileSync(routingPath,JSON.stringify({...JSON.parse(routing),public:true}));
  assert.throws(()=>planPublicFiles(destination),/Unexpected competition routing/);
  writeFileSync(routingPath,routing);

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
 const configs=["netlify.toml","railway.json","railway.toml",
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
    /GITHUB_ACTOR/,/inputs\.expected_sha/,/\$SOURCE/,/current_main/,
    /\.merge_commit_sha == \$sha/,/PR_HEAD_SHA|pr_head_sha/,
    /landing-checks\.yml\/runs\?head_sha=/,/node --test tests\/\*\.test\.mjs/,
    /stagePublicArtifact/,/assertPublicArtifact/,/artifact_contract:/,
     /stage-preview:/,/expected_debug_manifest_sha256:/,
     /actions\/upload-artifact@v4/,
    /needs: stage-preview/,/actions\/download-artifact@v4/,
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


test("PUBLIC-03: publication job verifies downloaded bytes before credential exposure",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
 const publisher=workflow.split("  publish-preview:")[1];
 assert.ok(publisher);
 assert.doesNotMatch(publisher,/actions\/checkout|import .*tools\/|node --test/);
 const verify=publisher.indexOf("PUBLIC03_VERIFY_ARTIFACT_BEGIN");
 const token=publisher.indexOf("secrets.VERCEL_TOKEN");
 assert.ok(verify>=0&&token>verify);
 assert.match(publisher,/EXPECTED_INVENTORY_SHA256: \$\{\{ needs.stage-preview.outputs.inventory_sha256 \}\}/);
 assert.match(publisher,/npm install --global vercel@64\.5\.0/);
 assert.doesNotMatch(workflow,/--token\b|vercel@latest/);
 assert.match(workflow,/GITHUB_EVENT_NAME.*workflow_dispatch/);
 assert.match(workflow,/default: public/);
 assert.match(workflow,/bash "\$RUNNER_TEMP\/preview-source-gate.sh"/);
});


test("PUBLIC-03: publisher accepts only the fixed static routing configuration",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
 const predicate=workflow.match(/jq -e '([^{\n]*\. == \{[^\n]+)' preview-bundle\/site\/vercel.json/)?.[1];
 assert.ok(predicate,"Exact static routing predicate must exist");
 const config=JSON.parse(readFileSync(join(repositoryRoot,"vercel.json"),"utf8"));
 const run=value=>spawnSync("jq",["-e",predicate],{input:JSON.stringify(value),encoding:"utf8"}).status;
 assert.equal(run(config),0);
 for(const extra of [{public:true},{builds:[{use:"@vercel/node",src:"index.js"}]},{target:"production"},{functions:{"api.js":{}}},{rewrites:[]}])
  assert.notEqual(run({...config,...extra}),0,JSON.stringify(extra));
});

test("PUBLIC-03: provider checks reject Production, wrong project and alias identity",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
 const stageGate=workflow.match(/# PUBLIC03_SOURCE_GATE_BEGIN\n([\s\S]*?)\n\s*# PUBLIC03_SOURCE_GATE_END/)[1].replace(/^          /gm,"");
 const publisherGate=workflow.match(/<<'SOURCE_GATE'\n([\s\S]*?)\n\s*SOURCE_GATE/)[1].replace(/^          /gm,"");
 assert.equal(stageGate,publisherGate,"Both jobs must enforce the same source and latest-CI policy");
 const target=workflow.match(/jq -e --arg id "\$VERCEL_PROJECT_ID" '([\s\S]*?)' <<< "\$info"/)[1];
 const alias=workflow.match(/'(\.projectId == \$id and \.alias == \$alias and \.deploymentId == \$deployment)'/)[1];
 const accepts=(predicate,value)=>spawnSync("jq",["-e","--arg","id","project","--arg","alias","preview.vercel.app","--arg","deployment","deployment",predicate],{input:JSON.stringify(value),encoding:"utf8"}).status===0;
 for(const contract of ["public","protected_debug"]){
  const ready={projectId:"project",target:"preview",readyState:"READY",meta:{artifact_contract:contract}};
  assert.equal(accepts(target,ready),true);
  assert.equal(accepts(target,{...ready,target:"production"}),false);
  assert.equal(accepts(target,{...ready,projectId:"other"}),false);
  assert.equal(accepts(target,{...ready,readyState:"ERROR"}),false);
 }
 const correct={projectId:"project",alias:"preview.vercel.app",deploymentId:"deployment"};
 assert.equal(accepts(alias,correct),true);
 for(const wrong of [{projectId:"other"},{alias:"other.vercel.app"},{deploymentId:"old"}])
  assert.equal(accepts(alias,{...correct,...wrong}),false);
});

test('A03-04D: public staging includes only the pure classic route core, never its Node facade',()=>{
 const root=mkdtempSync(join(tmpdir(),'fa-routes-public-'));
 try{
  const target=join(root,'public'),files=stagePublicArtifact(repositoryRoot,target);
  assert.ok(files.includes('assets/routes-registry.js'));
  for(const path of ['assets/routes-registry.mjs','assets/subpage-routes.mjs','tools/dev-standings-preview.mjs'])assert.ok(!files.includes(path),path);
  assert.deepEqual(assertPublicArtifact(target),files);
  const core=join(target,'assets/routes-registry.js');
  assert.deepEqual(readFileSync(core),readFileSync(join(repositoryRoot,'assets/routes-registry.js')));
  unlinkSync(core);
  assert.throws(()=>assertPublicArtifact(target),/manifest|missing/i);
 }finally{rmSync(root,{recursive:true,force:true})}
});
