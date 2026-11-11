import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {repositoryRoot} from "../tools/publication-guard.mjs";

const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-cloudflare-dev-preview.yml"),"utf8");
test("G10-ACCESS-03: real Cloudflare source gate rejects unauthorized or stale releases",()=>{
 const start=workflow.indexOf("      - name: Validate owner, current main and latest exact-head CI");
 const run=workflow.indexOf("        run: |\n",start);
 const end=workflow.indexOf("      - uses: actions/checkout@v4",run);
 assert.ok(start>=0&&run>start&&end>run,"Extract checked-in release gate, not a test duplicate");
 const code=workflow.slice(run+"        run: |\n".length,end).replace(/^          /gm,"");
 assert.match(code,/GITHUB_ACTOR/);
 assert.match(code,/GITHUB_TRIGGERING_ACTOR/);
 assert.match(code,/GITHUB_SHA/);
 assert.match(code,/landing-checks\.yml/);
 assert.match(code,/int24-browser-qa\.yml/);
 const root=mkdtempSync(join(tmpdir(),"fa-cloudflare-source-gate-"));
 try{
  writeFileSync(join(root,"gh"),'#!/usr/bin/env node\n'+
   'const u=process.argv[3]||"";const sha="a".repeat(40),other="c".repeat(40);\n'+
   'if(u.includes("/commits/main")){console.log(process.env.MOVED?other:sha);process.exit(0)}\n'+
   'if(!u.includes("/actions/workflows/"))throw Error("Unexpected endpoint "+u);\n'+
   'const runs=process.env.NO_CI?[]:[{id:1,run_number:1,head_sha:sha,event:"push",head_branch:"main",status:"completed",conclusion:"success"}];\n'+
   'if(process.env.BAD_CI)runs.push({id:2,run_number:2,head_sha:sha,event:"push",head_branch:"main",status:process.env.BAD_CI==="pending"?"in_progress":"completed",conclusion:process.env.BAD_CI==="pending"?null:"failure"});\n'+
   'console.log(JSON.stringify({workflow_runs:runs}));\n',{mode:0o755});
  function check(overrides={}){
   return spawnSync("bash",["-c",code],{encoding:"utf8",env:{...process.env,
    PATH:root+":"+process.env.PATH,GITHUB_EVENT_NAME:"workflow_dispatch",
    GITHUB_REPOSITORY:"FraGioco9/football-architect",GITHUB_REF:"refs/heads/main",
    GITHUB_ACTOR:"FraGioco9",GITHUB_TRIGGERING_ACTOR:"FraGioco9",
    GITHUB_SHA:"a".repeat(40),EXPECTED_SHA:"a".repeat(40),...overrides}});
  }
  const good=check();assert.equal(good.status,0,good.stderr+good.stdout);
  for(const bad of [{GITHUB_ACTOR:"intruder"},{GITHUB_TRIGGERING_ACTOR:"intruder"},{GITHUB_TRIGGERING_ACTOR:""},
   {GITHUB_EVENT_NAME:"push"},{GITHUB_EVENT_NAME:"pull_request"},{GITHUB_REF:"refs/heads/feature"},
   {GITHUB_REPOSITORY:"other/repository"},{EXPECTED_SHA:"main"},{EXPECTED_SHA:"b".repeat(40)},
   {GITHUB_SHA:"b".repeat(40)},{MOVED:"1"},{NO_CI:"1"},{BAD_CI:"failure"},{BAD_CI:"pending"}]){
   const result=check(bad);assert.notEqual(result.status,0,JSON.stringify(bad));
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
test("G10-ACCESS-03: offline safety checks do not claim live hosted access",()=>{
 for(const name of ["g10-public-02-exposure-audit.md","g10-public-02-runtime-review.md"]){
  const doc=readFileSync(join(repositoryRoot,"docs",name),"utf8");
  assert.match(doc,/PUBLIC-04/);
 }
 assert.doesNotMatch(workflow,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
 assert.match(workflow,/^  workflow_dispatch:$/m);
});
