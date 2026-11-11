import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {repositoryRoot,planPublicFiles,assertPublicArtifact,stagePublicArtifact} from "../tools/publication-guard.mjs";

test("PLAYER-AUTH public artifact includes only the approved account pages and scripts",()=>{
 const files=planPublicFiles();
 const pages=["account/index.html","account/login/index.html","account/recover/index.html","account/register/index.html","account/verify-email/index.html"];
 const scripts=["account-login.js","account-onboarding.js","account-recovery.js","account-settings.js","account-verification.js"].map(name=>"assets/"+name);
 for(const path of [...pages,...scripts])assert.ok(files.includes(path),"missing approved account asset: "+path);
 for(const path of ["backend/src/http-player.ts","backend/src/player-auth.ts","backend/wrangler.toml","backend/migrations/0013_player_auth.sql"])
  assert.ok(!files.includes(path),"backend data must stay private: "+path);
 const routing=JSON.parse(readFileSync(join(repositoryRoot,"vercel.json"),"utf8"));
 assert.deepEqual(routing.headers,[{source:"/account/:path*",headers:[
  {key:"Cache-Control",value:"private, no-store, max-age=0"},
  {key:"Referrer-Policy",value:"no-referrer"},
  {key:"X-Robots-Tag",value:"noindex, nofollow"},
  {key:"X-Content-Type-Options",value:"nosniff"}
 ]}]);
});

test("INT24-PUBLIC: shared rules and stats are self-contained public dependencies",()=>{
 const publicFiles=planPublicFiles();
 const assets=["competition-model.js","competition-rules.js","competition-rules-view.js","competition-stats.js","competition-history.js","competition-page.js"];
 for(const name of assets){
  const path="assets/"+name;
  assert.ok(publicFiles.includes(path),"missing shared runtime "+path);
  const source=readFileSync(join(repositoryRoot,path),"utf8");
  assert.doesNotMatch(source,/\/__fa_dev__\/|(?:from\s*|require\s*\()\s*["\x27][^"\x27]*(?:tools\/dev-|dev-competition-stats|dev-standings-preview)/,"protected provider imported by "+path);
 }
 for(const path of ["tools/competition-catalogue.mjs","data/international-competitions.json","backend/catalogues/season-1.participants.json","backend/catalogues/season-1.candidate.json","backend/catalogues/season-1.approval.json","backend/src/approved-season-one.ts","backend/tools/season-one-candidate.mts","tools/dev-competition-stats-data.mjs"]){
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
                    "tools/publication-guard.mjs","backend/catalogues/season-1.participants.json","backend/catalogues/season-1.candidate.json","backend/catalogues/season-1.approval.json","backend/src/approved-season-one.ts","backend/tools/season-one-candidate.mts"])
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
 assert.ok(!existsSync(join(dir,"manual-vercel-preview.yml")),"Retired Vercel publisher must be absent");
 for(const file of readdirSync(dir).filter(f=>/\.ya?ml$/.test(f))){
  const source=readFileSync(join(dir,file),"utf8");
  if(file==="cloudflare-preview-package.yml"){
   // Explicitly audited read-only exception: it stages a hashed Worker + allowlisted
   // public assets, but cannot publish, deploy, or access Cloudflare credentials.
   for(const required of [
    /^  pull_request:$/m,
    /github\.event\.pull_request\.head\.sha/,
    /persist-credentials: false/,
    /backend\/tools\/prepare-preview\.mts/,
    /verifyPreviewPackage/,
    /publicationAuthorized!==false/,
    /actions\/upload-artifact@v4/,
    /preview\.football-architect\.workers\.dev/,
    /6a6c7803-56d3-4e7f-bd01-752d06a32341/
   ])assert.match(source,required,"Cloudflare package gate missing: "+required);
   assert.doesNotMatch(source,/^  (?:push|workflow_dispatch|schedule|workflow_run|repository_dispatch):/m);
   assert.doesNotMatch(source,/secrets\.|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|--remote\b|npm.*wrangler.*deploy|npx.*wrangler.*deploy|\bwrangler\s+deploy\s+(?!.*--dry-run)/i);
  }else if(file==="manual-cloudflare-dev-preview.yml"){
   // Explicit nonproduction Worker + static-assets release, audited under
   // PUBLIC-03. All other unaudited publishing workflows still fail closed.
   assert.match(source,/^  workflow_dispatch:$/m);
   assert.doesNotMatch(source,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
   for(const required of [
    /GITHUB_ACTOR/,/GITHUB_TRIGGERING_ACTOR/,/GITHUB_REF/,
    /inputs\.expected_sha/,/GITHUB_SHA/,/commits\/main/,
    /landing-checks\.yml/,/int24-browser-qa\.yml/,
    /persist-credentials: false/,/backend\/tools\/prepare-preview\.mts/,
    /verifyPreviewPackage/,/publicationAuthorized!==false/,
    /actions\/upload-artifact@v4/,/actions\/download-artifact@v4/,
    /preview\.football-architect\.workers\.dev/,
    /e20c88bb42826f59efea469af0f82f96/,
    /6a6c7803-56d3-4e7f-bd01-752d06a32341/,
    /CLOUDFLARE_PREVIEW_API_TOKEN/,/wrangler@4\.153\.0/,/c\.name!=='preview'/,
    /--no-autoconfig --keep-vars/,/Read-only same-origin smoke checks/
   ])assert.match(source,required,"Cloudflare manual release gate missing: "+required);
   const stage=source.split("  package:")[1]?.split("\n  deploy:")[0];
   const publish=source.split("  deploy:")[1];
   assert.ok(stage&&publish,"Cloudflare manual release must have distinct staging and publishing jobs");
   assert.doesNotMatch(stage,/secrets\.|CLOUDFLARE_API_TOKEN|wrangler\s+deploy\s+(?!.*--dry-run)/i);
   assert.doesNotMatch(publish,/actions\/checkout@|git\s+clone\b|npm\s+ci\b/i);
   const verify=publish.indexOf("Independently verify artifact hashes");
   const token=publish.indexOf("secrets.CLOUDFLARE_PREVIEW_API_TOKEN");
   const release=publish.indexOf("Deploy only to existing DEV/Preview Worker");
   assert.ok(verify>=0&&token>verify&&release>verify,"Verify package integrity before credentials and release");
   assert.match(publish,/c\.d1_databases\[0\]\.database_id!==db/);
   assert.match(publish,/c\.assets\?\.run_worker_first!==true/);
   assert.match(publish,/\/api\/environment \/api\/world \/api\/players\/page\/1 \/account\/login \/players/);
   assert.match(publish,/\/api\/player\/session \/api\/player\/permissions/);
   assert.doesNotMatch(source,/--prod\b|--target=production|\bwrangler\s+d1\b|d1\s+execute\b|d1\s+migrations\s+apply\b|db\.prepare\(/i);
  }else{
   assert.doesNotMatch(source,/\b(deploy|publish|upload-pages-artifact|actions\/deploy-pages)\b/i,
    "Workflow must use audited public artifact: "+file);
  }
 }
});


test("PUBLIC-03: only Cloudflare manual Preview uses the canonical origin and Worker",()=>{
 const dir=join(repositoryRoot,".github","workflows");
 assert.equal(existsSync(join(dir,"manual-vercel-preview.yml")),false);
 const source=readFileSync(join(dir,"manual-cloudflare-dev-preview.yml"),"utf8");
 assert.match(source,/^  workflow_dispatch:$/m);
 assert.doesNotMatch(source,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
 for(const gate of [/GITHUB_ACTOR/,/GITHUB_TRIGGERING_ACTOR/,/GITHUB_REF/,/commits\/main/,/landing-checks\.yml/,/int24-browser-qa\.yml/])
  assert.match(source,gate);
 assert.match(source,/--origin https:\/\/preview\.football-architect\.workers\.dev/);
 assert.match(source,/PREVIEW_ORIGIN: https:\/\/preview\.football-architect\.workers\.dev/);
 assert.match(source,/c\.name!=='preview'/);
 assert.doesNotMatch(source,/football-architect-preview\.giocolifrancesco\.workers\.dev|football-architect-preview\.football-architect\.workers\.dev|VERCEL_TOKEN|vercel alias set|--prod\b/);
});
test("PUBLIC-03: Cloudflare release verifies downloaded bytes before token exposure",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-cloudflare-dev-preview.yml"),"utf8");
 const stage=workflow.split("\n  package:")[1]?.split("\n  deploy:")[0];
 const publisher=workflow.split("\n  deploy:")[1];
 assert.ok(stage&&publisher,"Credential-free stage and separate publisher required");
 assert.match(stage,/verifyPreviewPackage/);
 assert.match(stage,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(stage,/secrets\.|CLOUDFLARE_API_TOKEN/);
 assert.doesNotMatch(publisher,/actions\/checkout|git clone|npm ci/);
 const verify=publisher.indexOf("Independently verify artifact hashes and Worker/D1 binding");
 const token=publisher.indexOf("secrets.CLOUDFLARE_PREVIEW_API_TOKEN");
 const deploy=publisher.indexOf("Deploy only to existing DEV/Preview Worker");
 assert.ok(verify>=0&&token>verify&&deploy>verify,"Verify all package bytes before credentials and deploy");
 for(const gate of [/sha256/,/f\.sha256/,/c\.d1_databases\[0\]\.database_id!==db/,/c\.name!=='preview'/,/c\.vars\?\.PLAYER_ORIGIN!==process\.env\.PREVIEW_ORIGIN/,/--no-autoconfig --keep-vars/])
  assert.match(publisher,gate);
 assert.doesNotMatch(workflow,/\bwrangler\s+d1\b|\bd1\s+migrations\s+apply\b|--prod\b|--target=production/i);
});
test("PUBLIC-03: same-origin Worker serves native login, world and public assets",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-cloudflare-dev-preview.yml"),"utf8");
 const builder=readFileSync(join(repositoryRoot,"backend/tools/prepare-preview.mts"),"utf8");
 const launcher=readFileSync(join(repositoryRoot,"tools/dev.mjs"),"utf8");
 assert.match(builder,/t\.origin!=='https:\/\/preview\.football-architect\.workers\.dev'/);
 assert.match(builder,/name:'preview'/);
 assert.doesNotMatch(builder,/name:t\.origin===|football-architect-preview/);
 assert.match(launcher,/SHARED_PREVIEW_TARGET='https:\/\/preview\.football-architect\.workers\.dev'/);
 assert.match(workflow,/\/api\/environment \/api\/world \/api\/players\/page\/1 \/account\/login \/players/);
 assert.match(workflow,/\/api\/player\/session \/api\/player\/permissions/);
 assert.match(workflow,/c\.assets\?\.run_worker_first!==true/);
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
