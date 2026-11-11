import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,symlinkSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
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
test("02D: downloaded canonical Cloudflare Preview package fails closed on tampering",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-cloudflare-dev-preview.yml"),"utf8");
 const code=workflow.match(/      - name: Independently verify artifact hashes and Worker\/D1 binding \(no credentials used\)\n        run: \|\n          set -euo pipefail\n          node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/)?.[1]?.replace(/^          /gm,"");
 assert.ok(code,"Extract the exact, credential-free publishing verifier from the workflow");
 const sha="a".repeat(40),origin="https://preview.football-architect.workers.dev";
 const account="e20c88bb42826f59efea469af0f82f96",db="6a6c7803-56d3-4e7f-bd01-752d06a32341";
 const hash=data=>createHash("sha256").update(data).digest("hex");
 function attempt(mutate,expected=true){sandbox(root=>{
  const target=join(root,"cloudflare-package");
  mkdirSync(join(target,"bundle"),{recursive:true});
  mkdirSync(join(target,"assets/account/login"),{recursive:true});
  mkdirSync(join(target,"assets/players"),{recursive:true});
  const sources={
   "bundle/preview.js":"export default {fetch(){return new Response('ok')}};",
   "assets/account/login/index.html":"<html>Football Architect login</html>",
   "assets/players/index.html":"<html>Football Architect Players</html>"
  };
  for(let i=0;i<20;i++)sources["assets/fixture-"+i+".txt"]="fixture "+i;
  const config={name:"preview",account_id:account,main:"./bundle/preview.js",
   no_bundle:true,workers_dev:true,vars:{PLAYER_MODE:"preview",PLAYER_ORIGIN:origin,
    PLAYER_TRUSTED_SOURCE:"cloudflare",PREVIEW_SOURCE_SHA:sha},
   d1_databases:[{binding:"DB",database_name:"football-architect-dev",database_id:db}],
   assets:{directory:"./assets",binding:"ASSETS",run_worker_first:true}};
  sources["wrangler.json"]=JSON.stringify(config);
  for(const [path,data] of Object.entries(sources))writeFileSync(join(target,path),data);
  const manifest={schemaVersion:1,sourceSha:sha,pool:"dev-preview",publicationAuthorized:false,
   origin,target:{accountId:account,databaseId:db},
   files:Object.entries(sources).map(([path,data])=>({path,sha256:hash(data),bytes:Buffer.byteLength(data)}))};
  const save=()=>writeFileSync(join(target,"manifest.json"),JSON.stringify(manifest));
  save();
  if(mutate)mutate({target,manifest,config,save});
  const result=spawnSync(process.execPath,["--input-type=module","-e",code],{
   cwd:root,encoding:"utf8",env:{...process.env,EXPECTED_SHA:sha,PREVIEW_ORIGIN:origin,CLOUDFLARE_ACCOUNT_ID:account}});
  assert.equal(result.status===0,expected,result.stderr+"\n"+result.stdout);
 });}
 attempt();
 attempt(({target})=>writeFileSync(join(target,"bundle/preview.js"),"tampered"),false);
 attempt(({target})=>writeFileSync(join(target,"assets/extra.js"),"unlisted"),false);
 attempt(({target})=>rmSync(join(target,"assets/players/index.html")),false);
 attempt(({target})=>{const path=join(target,"bundle/preview.js");rmSync(path);symlinkSync(join(repositoryRoot,"index.html"),path);},false);
 attempt(({manifest,save})=>{manifest.sourceSha="b".repeat(40);save();},false);
 attempt(({manifest,save})=>{manifest.origin="https://production.example.invalid";save();},false);
 attempt(({manifest,save})=>{manifest.pool="production";save();},false);
 attempt(({manifest,save})=>{manifest.publicationAuthorized=true;save();},false);
 attempt(({manifest,save})=>{manifest.target.databaseId="00000000-0000-4000-8000-000000000001";save();},false);
 attempt(({manifest,save})=>{manifest.files[0].sha256="b".repeat(64);save();},false);
 attempt(({manifest,save})=>{manifest.files[0].path="../escape";save();},false);
 attempt(({target,config})=>{config.name="football-architect-preview";writeFileSync(join(target,"wrangler.json"),JSON.stringify(config));},false);
 attempt(({target,config})=>{config.d1_databases[0].database_id="00000000-0000-4000-8000-000000000001";writeFileSync(join(target,"wrangler.json"),JSON.stringify(config));},false);
 attempt(({target,config})=>{config.assets.run_worker_first=false;writeFileSync(join(target,"wrangler.json"),JSON.stringify(config));},false);
});
