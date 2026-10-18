import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {repositoryRoot} from "../tools/publication-guard.mjs";

const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
test("G10-ACCESS-03: actual source gate rejects unauthorized or stale releases",()=>{
 const code=workflow.match(/# PUBLIC03_SOURCE_GATE_BEGIN\n([\s\S]*?)\n\s*# PUBLIC03_SOURCE_GATE_END/)?.[1]?.replace(/^          /gm,"");
 assert.ok(code,"Extract real workflow source gate");
 const root=mkdtempSync(join(tmpdir(),"fa-source-gate-"));
 try{
  // Stub only the GitHub transport; execute the real Bash/jq policy without credentials.
  writeFileSync(join(root,"gh"),'#!/usr/bin/env node\n'+`const u=process.argv[3];const sha="a".repeat(40),head="c".repeat(40);let data;
if(u.includes("/pulls/"))data={state:"closed",merged_at:"date",base:{ref:"main"},head:{sha:head,repo:{full_name:"FraGioco9/football-architect"}},merge_commit_sha:process.env.BAD_PR?head:sha};
else if(u.includes("/compare/"))data={status:process.env.DIVERGED?"diverged":"identical"};
else if(u.includes("/commits/main")) { console.log(process.env.MOVED?head:sha);process.exit(0); }
else if(u.includes("/runs?")){const pr=u.includes("event=pull_request");const s=pr?head:sha;data={workflow_runs:[{id:1,run_number:1,head_sha:s,event:pr?"pull_request":"push",head_branch:pr?"feature":"main",status:"completed",conclusion:"success"}]};if(process.env.BAD_CI)data.workflow_runs.push({id:2,run_number:2,head_sha:s,event:pr?"pull_request":"push",head_branch:pr?"feature":"main",status:process.env.BAD_CI==="pending"?"in_progress":"completed",conclusion:"failure"});if(process.env.NO_CI)data.workflow_runs=[];}
else throw Error("Unexpected GitHub URL: "+u);
console.log(JSON.stringify(data));`,{mode:0o755});
  function run(overrides={}){return spawnSync("bash",["-c",code],{encoding:"utf8",env:{...process.env,PATH:root+":"+process.env.PATH,GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",GITHUB_ACTOR:"FraGioco9",GITHUB_TRIGGERING_ACTOR:"FraGioco9",GITHUB_REPOSITORY:"FraGioco9/football-architect",GITHUB_SHA:"a".repeat(40),EXPECTED_SHA:"a".repeat(40),SOURCE:"main",PR_NUMBER:"203",...overrides}});}
  for(const source of ["main","merged_pr"]){
   const good=run({SOURCE:source});assert.equal(good.status,0,good.stderr+good.stdout);
   for(const bad of [{GITHUB_ACTOR:"other"},{GITHUB_TRIGGERING_ACTOR:"other"},{GITHUB_TRIGGERING_ACTOR:""},{GITHUB_EVENT_NAME:"push"},{GITHUB_EVENT_NAME:"pull_request"},{GITHUB_REF:"refs/heads/feature"},{EXPECTED_SHA:"main"},{EXPECTED_SHA:"b".repeat(40)},{SOURCE:"unknown"},{BAD_CI:"failure"},{BAD_CI:"pending"},{NO_CI:"1"},{DIVERGED:"1"},{MOVED:"1"}]){
    assert.notEqual(run({SOURCE:source,...bad}).status,0,JSON.stringify(bad));
   }
  }
  assert.notEqual(run({SOURCE:"merged_pr",BAD_PR:"1"}).status,0);
  assert.notEqual(run({SOURCE:"merged_pr",PR_NUMBER:"0"}).status,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test("G10-ACCESS-03: offline gates make no hosted access claim",()=>{
 for(const name of ["g10-public-02-exposure-audit.md","g10-public-02-runtime-review.md"]){
  const doc=readFileSync(join(repositoryRoot,"docs",name),"utf8");
  assert.match(doc,/PUBLIC-04/);
 }
 assert.doesNotMatch(workflow,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
});
