// G10-PUBLIC-02: the staged bytes, not the repository root, define potential disclosure.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact} from "../tools/publication-guard.mjs";
import {stageProtectedDebugArtifact,assertProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";

const DEBUG_PATHS=[
  "__fa_dev__/debug-settings.mjs",
  "__fa_dev__/standings-client.mjs",
  "__fa_dev__/debug-widget.mjs",
  "__fa_dev__/standings-data.mjs",
  "__fa_dev__/dev-standings-preview-data.mjs",
  "__fa_dev__/stats-client.mjs",
  "__fa_dev__/stats-data.mjs",
  "__fa_dev__/artifact-manifest.json"
].sort();
const fields=(object,expected)=>assert.deepEqual(Object.keys(object).sort(),[...expected].sort());

test("G10-PUBLIC-02: staged Debug adds precisely eight public-intended paths",{timeout:20000},()=>{
 const root=mkdtempSync(join(tmpdir(),"fa-g10-content-"));
 try{
  const pubDir=join(root,"public"),debugDir=join(root,"debug");
  const pub=stagePublicArtifact(repositoryRoot,pubDir);
  const debug=stageProtectedDebugArtifact(repositoryRoot,debugDir);
  assert.deepEqual(assertPublicArtifact(pubDir),pub);
  assert.deepEqual(assertProtectedDebugArtifact(debugDir),debug);
  const extras=debug.filter(path=>!pub.includes(path));
  assert.deepEqual(extras,DEBUG_PATHS);
  assert.equal(debug.length,pub.length+8);
  for(const path of pub)assert.deepEqual(
   readFileSync(join(debugDir,path)).length>=0,true,
   "Missing staged inherited asset: "+path);
  for(const path of debug) {
   assert.ok(!/^(?:\.git|\.github|tools|tests|docs|templates)\//.test(path),path);
   assert.ok(!/(?:^|\/)(?:\.env|\.npmrc|credentials|secrets|private)\b/i.test(path),path);
  }
  const manifest=JSON.parse(readFileSync(join(debugDir,"__fa_dev__/artifact-manifest.json"),"utf8"));
  fields(manifest,["schemaVersion","contract","files"]);
  assert.equal(manifest.contract,"protected_debug");
  assert.equal(manifest.files.length,debug.length-1);
  const publicManifest=JSON.parse(readFileSync(join(debugDir,"app/competitions/_shared/manifest.json"),"utf8"));
  fields(publicManifest,["schemaVersion","approved","divisions"]);
  assert.equal(publicManifest.approved,false);
  assert.equal(publicManifest.divisions.length,16);
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
    "primaryHex","secondaryHex","ivoryHex","clubIds"]);
  const jsonPaths=debug.filter(path=>path.endsWith(".json")).sort();
  assert.deepEqual(jsonPaths,[
   "__fa_dev__/artifact-manifest.json",
   "app/competitions/_shared/manifest.json",
   "data/divisions.json"
  ]);
 }finally{rmSync(root,{recursive:true,force:true})}
});
