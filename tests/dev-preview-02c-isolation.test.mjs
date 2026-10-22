import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync,cpSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {createHash} from "node:crypto";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact} from "../tools/publication-guard.mjs";
import {stageProtectedDebugArtifact,assertProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";

test("DEV-PREVIEW-02C: public isolation, deterministic manifest and tamper rejection", () => {
 const temp=mkdtempSync(join(tmpdir(),"fa-02c-"));
 const pub=join(temp,"public"),debug=join(temp,"debug"),debug2=join(temp,"debug2");
 try {
  const publicFiles=stagePublicArtifact(repositoryRoot,pub);
  assertPublicArtifact(pub);
  assert.ok(publicFiles.length>0);
  assert.equal(publicFiles.some(p=>p.startsWith("__fa_dev__/")),false);
  const debugFiles=stageProtectedDebugArtifact(repositoryRoot,debug);
  assertProtectedDebugArtifact(debug);
  assert.ok(debugFiles.includes("__fa_dev__/artifact-manifest.json"));
  assert.ok(debugFiles.includes("__fa_dev__/debug-settings.mjs"));
  for(const path of publicFiles) {
   const a=readFileSync(join(pub,path)),b=readFileSync(join(debug,path));
   if(!/^(?:dashboard|calendar|settings|competitions|clubs)\//.test(path)||!path.endsWith("/index.html"))assert.deepEqual(a,b,path);
  }
  const manifest=JSON.parse(readFileSync(join(debug,"__fa_dev__/artifact-manifest.json"),"utf8"));
  assert.equal(manifest.contract,"protected_debug");
  assert.deepEqual(manifest.files.map(x=>x.path),manifest.files.map(x=>x.path).sort());
  for(const {path,sha256} of manifest.files)
   assert.equal(createHash("sha256").update(readFileSync(join(debug,path))).digest("hex"),sha256,path);
  stageProtectedDebugArtifact(repositoryRoot,debug2);
  assert.deepEqual(readFileSync(join(debug,"__fa_dev__/artifact-manifest.json")),readFileSync(join(debug2,"__fa_dev__/artifact-manifest.json")));
  const victim=join(debug,"__fa_dev__/debug-settings.mjs");
  writeFileSync(victim,Buffer.concat([readFileSync(victim),Buffer.from("\n// tampered")]));
  assert.throws(()=>assertProtectedDebugArtifact(debug),/mismatch/);
  assert.throws(()=>stageProtectedDebugArtifact(repositoryRoot,debug2),/overwrite/);
  const publicVictim=join(pub,"index.html");
  writeFileSync(publicVictim,Buffer.concat([readFileSync(publicVictim),Buffer.from("\n<!-- tampered -->")]));
  assert.throws(()=>assertPublicArtifact(pub),/mismatch/);
 } finally {rmSync(temp,{recursive:true,force:true});}
});
