import competitionModel from "../assets/competition-model.js";
// G10-PUBLIC-02: the staged bytes, not the repository root, define potential disclosure.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,posix} from "node:path";
import {createHash} from "node:crypto";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact} from "../tools/publication-guard.mjs";
import {stageProtectedDebugArtifact,assertProtectedDebugArtifact,CLUB_SUMMARY_INJECTION} from "../tools/dev-preview-artifact.mjs";

const DEBUG_PATHS=[
  "__fa_dev__/debug-settings.mjs",
  "__fa_dev__/standings-client.mjs",
  "__fa_dev__/debug-widget.mjs",
  "__fa_dev__/dev-world-clock.mjs",
  "__fa_dev__/standings-data.mjs",
  "__fa_dev__/dev-standings-preview-data.mjs",
  "__fa_dev__/stats-client.mjs",
  "__fa_dev__/stats-data.mjs",
  "__fa_dev__/artifact-manifest.json"
].sort();
const fields=(object,expected)=>assert.deepEqual(Object.keys(object).sort(),[...expected].sort());

test("G10-PUBLIC-02: staged Debug adds precisely nine protected-only paths",{timeout:20000},()=>{
 const root=mkdtempSync(join(tmpdir(),"fa-g10-content-"));
 try{
  const pubDir=join(root,"public"),debugDir=join(root,"debug");
  const pub=stagePublicArtifact(repositoryRoot,pubDir);
  const debug=stageProtectedDebugArtifact(repositoryRoot,debugDir);
  assert.deepEqual(assertPublicArtifact(pubDir),pub);
  assert.deepEqual(assertProtectedDebugArtifact(debugDir),debug);
  const extras=debug.filter(path=>!pub.includes(path));
  assert.deepEqual(extras,DEBUG_PATHS);
  assert.equal(debug.length,pub.length+DEBUG_PATHS.length);
  for(const path of pub){
   const publicBytes=readFileSync(join(pubDir,path));
   const debugBytes=readFileSync(join(debugDir,path));
   if(/^(?:dashboard|calendar|settings|competitions)\//.test(path)&&path.endsWith("/index.html")){
    assert.notDeepEqual(debugBytes,publicBytes,"App HTML intentionally gains Debug entrypoints: "+path);
    assert.match(debugBytes.toString("utf8"),/src="\/__fa_dev__\/debug-settings\.mjs"/,"Missing standings Debug entrypoint: "+path);
    assert.match(debugBytes.toString("utf8"),/src="\/__fa_dev__\/stats-client\.mjs"/,"Missing stats Debug entrypoint: "+path);
   }else if(path==="clubs/_shared/index.html"){
    assert.equal(debugBytes.toString("utf8").replace(CLUB_SUMMARY_INJECTION+"\n",""),publicBytes.toString("utf8"));
   }else assert.deepEqual(debugBytes,publicBytes,"Inherited asset must remain byte-for-byte unchanged: "+path);
  }
  for(const path of debug) {
   assert.ok(!/^(?:\.git|\.github|tools|tests|docs|templates)\//.test(path),path);
   assert.ok(!/(?:^|\/)(?:\.env|\.npmrc|credentials|secrets|private)\b/i.test(path),path);
  }
  const manifest=JSON.parse(readFileSync(join(debugDir,"__fa_dev__/artifact-manifest.json"),"utf8"));
  fields(manifest,["schemaVersion","contract","files"]);
  assert.equal(manifest.contract,"protected_debug");
  assert.equal(manifest.files.length,debug.length-1);
  assert.deepEqual(manifest.files.map(entry=>entry.path).sort(),
   debug.filter(path=>path!=="__fa_dev__/artifact-manifest.json").sort(),
   "Every staged file must be represented exactly once");
  for(const entry of manifest.files){
   fields(entry,["path","sha256"]);
   assert.match(entry.sha256,/^[a-f0-9]{64}$/);
   assert.equal(entry.sha256,createHash("sha256").update(readFileSync(join(debugDir,entry.path))).digest("hex"),
    "Manifest hash mismatch: "+entry.path);
  }
  // A static module import must resolve to one of the actual staged paths.
  for(const path of DEBUG_PATHS.filter(path=>path.endsWith(".mjs"))){
   const source=readFileSync(join(debugDir,path),"utf8");
   const refs=[...source.matchAll(/\b(?:import|export)\s+(?:[^;"']*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g)];
   for(const match of refs){
    const resolved=posix.normalize(posix.join(posix.dirname(path),match[1]));
    assert.ok(debug.includes(resolved),"Unresolved Debug import: "+path+" -> "+resolved);
   }
  }
  const publicManifest=JSON.parse(readFileSync(join(debugDir,"competitions/_shared/manifest.json"),"utf8"));
  fields(publicManifest,["schemaVersion","approved","profile","clubCrests","divisions","competitions"]);
  assert.deepEqual(publicManifest.profile,competitionModel.profile);
  assert.equal(competitionModel.validManifest(publicManifest),true);
  assert.equal(publicManifest.approved,false);
  assert.equal(publicManifest.divisions.length,16);
  assert.equal(publicManifest.competitions.length,18);
  const divFields=["id","name","countryId","countryName","flagAsset","tier","capacity","clubs"];
  const clubFields=["countryId","clubId","abbr","fullName","primaryName","stadiumName"];
  const allClubIds=new Set();
  for(const division of publicManifest.divisions){
   fields(division,divFields);
   assert.equal(division.clubs.length,16);
   for(const club of division.clubs){
    fields(club,clubFields);
    assert.equal(typeof club.primaryName,"string");
    assert.equal(typeof club.stadiumName,"string");
    const key=club.countryId+":"+club.clubId;
    assert.ok(!allClubIds.has(key),key);
    allClubIds.add(key);
   }
  }
  assert.equal(allClubIds.size,256);
  const divisionCatalogue=JSON.parse(readFileSync(join(debugDir,"data/divisions.json"),"utf8"));
  assert.equal(divisionCatalogue.length,16);
  for(const division of divisionCatalogue)
   fields(division,["id","countryId","countryName","tier","name","capacity",
    "primaryHex","secondaryHex","ivoryHex","rules"]);
  for(const division of divisionCatalogue)assert.equal(division.rules?.schemaVersion,1);
  const jsonPaths=debug.filter(path=>path.endsWith(".json")).sort();
  assert.deepEqual(jsonPaths,[
   "__fa_dev__/artifact-manifest.json",
   "clubs/_shared/manifest.json",
   "competitions/_shared/manifest.json",
   "data/divisions.json",
   "vercel.json"
  ]);
 }finally{rmSync(root,{recursive:true,force:true})}
});
