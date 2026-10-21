import * as fs from "node:fs";
import test from "node:test";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,unlinkSync} from "node:fs";
import {join} from "node:path";
import {runInNewContext} from "node:vm";
import {tmpdir} from "node:os";
import {repositoryRoot,planPublicFiles,stagePublicArtifact,assertPublicArtifact,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";
import {ARTIFACT_CONTRACTS,DEBUG_SEASONS,assertArtifactContract,planProtectedDebugFiles,
 assertProtectedDebugArtifact,stageProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";

function sandbox() {
 const root=mkdtempSync(join(tmpdir(),"fa-protected-debug-"));
 const debugRoot=join(root,"fixtures");
 mkdirSync(join(debugRoot,"tools"),{recursive:true});
 for(const [name,content] of [
  ["dev-debug-settings.mjs","export const enabled = false;\n"],
  ["dev-standings-preview-client.mjs","export const client = true;\n"],
  ["dev-standings-preview-data.mjs","export const data = [];\n"],
  ["dev-debug-widget.mjs","export const widget = true;\n"],
  ["dev-competition-stats-client.mjs","export const statsClient = true;\n"],
  ["dev-competition-stats-data.mjs","export const statsData = true;\n"]
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
  "__fa_dev__/standings-data.mjs","__fa_dev__/dev-standings-preview-data.mjs",
  "__fa_dev__/stats-client.mjs","__fa_dev__/stats-data.mjs","__fa_dev__/club-summary.mjs",
  "__fa_dev__/debug-widget.mjs","__fa_dev__/artifact-manifest.json"])
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
  const protectedHtml=readFileSync(join(protectedPath,"dashboard","index.html"),"utf8");
  const originalHtml=readFileSync(join(repositoryRoot,"dashboard","index.html"),"utf8");
  assert.doesNotMatch(originalHtml,/__fa_dev__\/debug-settings|faDebugPending/);
  assert.match(protectedHtml,/faDebugPending/);
  assert.equal(protectedHtml.split('src="/__fa_dev__/debug-settings.mjs"').length,2);
  assert.match(protectedHtml,/__fa_dev__\/debug-settings\.mjs/);
  assert.match(protectedHtml,/__fa_dev__\/stats-client\.mjs/);
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
  const page=join(protectedPath,"dashboard","index.html");
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

test("DEBUG-INFRA-05: both contracts use isolated staging and approved transfer inventory",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github","workflows","manual-vercel-preview.yml"),"utf8");
 assert.match(workflow,/artifact_contract:/);
 assert.match(workflow,/stage-preview:/);
 assert.match(workflow,/expected_debug_manifest_sha256:/);
 assert.match(workflow,/stageProtectedDebugArtifact/);
 assert.match(workflow,/assertProtectedDebugArtifact/);
 assert.match(workflow,/exit 1/);
 assert.match(workflow,/approved-preview-bundle/);
 assert.match(workflow,/--target=preview/);
 assert.doesNotMatch(workflow,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
});


test("DEBUG-RUNTIME-01: protected browser imports resolve within artifact",()=>{
 const {root,debugRoot,protectedPath}=sandbox();
 try{
  for(const name of ["dev-debug-settings.mjs","dev-standings-preview-client.mjs","dev-standings-preview-data.mjs",
   "dev-debug-widget.mjs","dev-competition-stats-client.mjs","dev-competition-stats-data.mjs"])
   writeFileSync(join(debugRoot,"tools",name),readFileSync(join(repositoryRoot,"tools",name)));
  stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  const directory=join(protectedPath,"__fa_dev__");
  for(const name of ["debug-settings.mjs","standings-client.mjs","standings-data.mjs",
   "dev-standings-preview-data.mjs","debug-widget.mjs","stats-client.mjs","stats-data.mjs"]){
   const source=readFileSync(join(directory,name),"utf8");
   for(const match of source.matchAll(/(?:import|export)\\s+(?:[^"'\\n]*?\\s+from\\s+)?["'](\\.[^"']+)["']/g))
    assert.equal(existsSync(join(directory,match[1])),true,name+" imports missing "+match[1]);
  }
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('DEBUG-FIRST-PAINT: DEV defaults are gated synchronously and failure cannot leave data hidden',async()=>{
 const {DEBUG_FIRST_PAINT}=await import('../tools/dev-preview-artifact.mjs');
 assert.equal(typeof DEBUG_FIRST_PAINT,'string');
 const {runInNewContext}=await import('node:vm');
 const script=DEBUG_FIRST_PAINT.match(/<script>([\s\S]+)<\/script>/)[1];
 for(const value of ['on',null]){
  const document={documentElement:{dataset:{}}};const window={};let timeout;
  runInNewContext(script,{document,window,location:{pathname:'/competitions/eng-1'},sessionStorage:{getItem:()=>value},setTimeout:fn=>{timeout=fn;return 1},clearTimeout(){}});
  assert.equal(document.documentElement.dataset.faDebugPending,'true');
  timeout();assert.equal(document.documentElement.dataset.faDebugPending,undefined)
 }
 const document={documentElement:{dataset:{}}};let release;
 runInNewContext(script,{document,window:{},location:{pathname:'/competitions/it-1'},sessionStorage:{getItem(){throw Error('blocked')}},clearTimeout(){},setTimeout(fn){release=fn}});
 assert.equal(document.documentElement.dataset.faDebugPending,'true');
 release();assert.equal(document.documentElement.dataset.faDebugPending,undefined);
});

test("DEBUG-SEASONS-01: protected Preview supports four fictional seasons without changing public bytes",()=>{
 const {root,debugRoot,protectedPath,publicPath}=sandbox();
 try{
  assert.deepEqual(DEBUG_SEASONS,[1,2,3,4]);
  const staged=stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  assert.deepEqual(assertProtectedDebugArtifact(protectedPath,{sourceRoot:repositoryRoot,debugRoot}),staged);
  stagePublicArtifact(repositoryRoot,publicPath);
  assertPublicArtifact(publicPath);
  const directory="competitions";
  const index=readFileSync(join(protectedPath,directory,"index.html"),"utf8");
  assert.doesNotMatch(index,/data-dev-latest-season/);
  assert.equal((index.match(/\/standings\?season=1/g)||[]).length,16);
  const originalIndex=readFileSync(join(publicPath,directory,"index.html"),"utf8");
  assert.doesNotMatch(originalIndex,/data-dev-latest-season|__fa_dev__/);
  assert.equal((originalIndex.match(/\/standings\?season=1/g)||[]).length,16);
  for(const division of ["it","eng","es","de","fr","pt","nl","br"])
   for(const tier of [1,2]){
    const path=join(directory,division+"-"+tier,"index.html");
    const html=readFileSync(join(protectedPath,path),"utf8");
    const original=readFileSync(join(publicPath,path),"utf8");
    const season='document.documentElement.dataset.faDevSeasons="1,2,3,4"';
    assert.ok(html.includes(season),path+" must bootstrap DEV seasons");
    assert.ok(html.indexOf(season)<html.indexOf('src="/__fa_dev__/debug-settings.mjs"'),
      path+" must bootstrap seasons before Debug modules");
    assert.ok(!original.includes("faDevSeasons")&&!original.includes("/__fa_dev__/"),
      path+" public HTML must remain clean");
   }
  for(const path of ["dashboard/index.html","settings/index.html"]){
   assert.ok(!readFileSync(join(protectedPath,path),"utf8").includes("faDevSeasons"),
    path+" must not enable competition seasons");
  }
 }finally{rmSync(root,{recursive:true,force:true})}
});

test("DEBUG-SEASONS-02: standings and Stats route resolvers agree on Seasons 1–4",()=>{
 function sourceFunction(source,name){
  const from=source.indexOf("function "+name+"()");
  assert.ok(from>=0,name+" must exist");
  const start=source.indexOf("{",from);let depth=0;
  for(let i=start;i<source.length;i++){
   if(source[i]==="{")depth++;
   if(source[i]==="}"&&--depth===0&&source[i]==="}")return source.slice(from,i+1);
  }
  throw Error("Incomplete resolver "+name);
 }
 const standings=readFileSync(join(repositoryRoot,"tools","dev-standings-preview-client.mjs"),"utf8");
 const stats=readFileSync(join(repositoryRoot,"tools","dev-competition-stats-client.mjs"),"utf8");
 const standingFunctions=sourceFunction(standings,"availablePreviewSeasons")+"\n"+sourceFunction(standings,"selectedSeason");
 const statsFunction=sourceFunction(stats,"selectedSeason");
 const resolve=(script,season,routed,override=null,data="1,2,3,4")=>{
  const url=new URL("https://example.test/competitions/it-1?season="+season);
  return runInNewContext("let routeSeasonOverride="+JSON.stringify(override)+";\n"+script+"\nselectedSeason()",{
   URL,URLSearchParams,document:{documentElement:{dataset:{faDevSeasons:data}}},
   window:{location:{href:url.href},faCompetitionRoute:{get:()=>({season:routed})}},
   location:{href:url.href,search:url.search}
  });
 };
 for(const season of [1,2,3,4]){
  assert.equal(resolve(standingFunctions,season,1),season);
  assert.equal(resolve(statsFunction,season,1),season);
  assert.equal(resolve(standingFunctions,season,season,season),season);
 }
 assert.equal(resolve(standingFunctions,99,4),4);
 assert.equal(resolve(statsFunction,99,4),4);
 assert.equal(resolve(standingFunctions,99,99,null,""),1);
 assert.equal(resolve(statsFunction,99,99,null,""),1);
});


test("PUBLIC-03: execute the actual staging script for both approval contracts",()=>{
 const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
 const code=workflow.match(/# PUBLIC03_STAGE_BEGIN\n([\s\S]*?)\n\s*# PUBLIC03_STAGE_END/)?.[1]?.replace(/^          /gm,"");
 assert.ok(code);
 const root=mkdtempSync(join(tmpdir(),"fa-workflow-stage-"));
 try{
  const source=join(root,"source");mkdirSync(source);
  // Copy a source fixture; the staging script must import real builders and verify their output.
  for(const path of ["assets","dashboard","calendar","settings","competitions","clubs","data","guide","tools","vercel.json","index.html","favicon.svg","favicon.ico"])
   fs.cpSync(join(repositoryRoot,path),join(source,path),{recursive:true});
  const debug=join(root,"expected-debug");stageProtectedDebugArtifact(repositoryRoot,debug);
  const approved=createHash("sha256").update(readFileSync(join(debug,"__fa_dev__/artifact-manifest.json"))).digest("hex");
  const output=join(root,"outputs");
  function run(contract,hash=""){
   rmSync(join(source,"preview-bundle"),{recursive:true,force:true});
   return spawnSync("bash",["-c",code],{cwd:source,encoding:"utf8",env:{...process.env,ARTIFACT_CONTRACT:contract,EXPECTED_SHA:"a".repeat(40),EXPECTED_DEBUG_MANIFEST_SHA256:hash,GITHUB_OUTPUT:output}});
  }
  for(const [contract,hash,count] of [["public","",planPublicFiles().length],["protected_debug",approved,planProtectedDebugFiles().length]]){
   const result=run(contract,hash);assert.equal(result.status,0,result.stderr);
   const bytes=readFileSync(join(source,"preview-bundle/publication-manifest.json"));
   const manifest=JSON.parse(bytes);assert.equal(manifest.contract,contract);assert.equal(manifest.files.length,count);
   assert.ok(readFileSync(output,"utf8").includes("inventory_sha256="+createHash("sha256").update(bytes).digest("hex")));
   if(contract==="public")assert.equal(fs.existsSync(join(source,"preview-bundle/site/__fa_dev__")),false);
  }
  for(const [contract,hash] of [["protected_debug",""],["protected_debug","b".repeat(64)],["public",approved],["production",""],["unknown",""]])
   assert.notEqual(run(contract,hash).status,0,contract+" must reject invalid approval");
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('Club competition summaries are injected only into DEV/protected club HTML',()=>{
 const {root,debugRoot,protectedPath,publicPath}=sandbox();
 try{
  stagePublicArtifact(repositoryRoot,publicPath);
  stageProtectedDebugArtifact(repositoryRoot,protectedPath,{debugRoot});
  const publicHtml=readFileSync(join(publicPath,'clubs/_shared/index.html'),'utf8');
  const privateHtml=readFileSync(join(protectedPath,'clubs/_shared/index.html'),'utf8');
  assert.doesNotMatch(publicHtml,/__fa_dev__|data-fa-dev-club-summary/);
  assert.match(privateHtml,/data-fa-dev-club-summary/);
  assert.match(privateHtml,/__fa_dev__\/debug-settings\.mjs/);
  assert.doesNotMatch(privateHtml,/__fa_dev__\/standings-client/);
  assert.equal(existsSync(join(publicPath,'__fa_dev__/club-summary.mjs')),false);
  assert.equal(existsSync(join(protectedPath,'__fa_dev__/stats-client.mjs')),true);
 }finally{rmSync(root,{recursive:true,force:true})}
});
