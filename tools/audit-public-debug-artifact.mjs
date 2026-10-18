// G10-PUBLIC-02: local-only, fail-closed static inventory. Never deploy or print matching secret values.
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,posix,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {stageProtectedDebugArtifact,assertProtectedDebugArtifact} from "./dev-preview-artifact.mjs";
import {repositoryRoot,stagePublicArtifact,assertPublicArtifact} from "./publication-guard.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
if(root!==repositoryRoot)throw Error("Repository root mismatch");
const temp=mkdtempSync(join(tmpdir(),"fa-public-debug-audit-"));
const reasons=[];
const checks=[
 ["credential_assign", /(?:api[_-]?key|secret|password|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*["'`][^"'`\s]{8,}/ig],
 ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
 ["bearer", /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/ig],
 ["write_method", /(?:\bmethod\s*:\s*["\'`](?:POST|PUT|PATCH|DELETE)["\'`]|\.open\s*\(\s*["\'`](?:POST|PUT|PATCH|DELETE)["\'`])/ig],
 // Ordinary fetch() is a network read unless an explicit unsafe method is specified.\n ["write_api", /\b(?:sendBeacon|XMLHttpRequest|WebSocket)\s*\(/g],
 ["sensitive_reference", /(?:process\.env\b|import\.meta\.env\b|\bAuthorization\s*:|\/api\/(?:admin|internal|private)\b)/ig],
 ["dynamic_execution", /\b(?:eval|new\s+Function)\s*\(/g]
];
const textFile=p=>/\.(?:html?|m?js|css|json|svg|txt|xml|map|webmanifest)$/i.test(p);
const digest=b=>createHash("sha256").update(b).digest("hex");
function audit(){
 const debugDir=join(temp,"debug"),publicDir=join(temp,"public");
 const debug=stageProtectedDebugArtifact(root,debugDir);
 const pub=stagePublicArtifact(root,publicDir);
 assertProtectedDebugArtifact(debugDir);
 assertPublicArtifact(publicDir);
 const files=new Set(debug);
 const publicFiles=new Set(pub);
 for(const p of pub){if(p.startsWith("__fa_dev__/"))reasons.push({path:p,rule:"public_debug_asset"});}
 const manifestPath="__fa_dev__/artifact-manifest.json";
 if(!files.has(manifestPath))reasons.push({path:manifestPath,rule:"missing_manifest"});
 const manifest=JSON.parse(readFileSync(join(debugDir,manifestPath),"utf8"));
 if(manifest.contract!=="protected_debug"||manifest.schemaVersion!==1)reasons.push({path:manifestPath,rule:"invalid_contract"});
 if(!Array.isArray(manifest.files)||manifest.files.length!==debug.length-1)reasons.push({path:manifestPath,rule:"manifest_file_count"});
 for(const entry of manifest.files||[]){
  if(!files.has(entry.path)||digest(readFileSync(join(debugDir,entry.path)))!==entry.sha256)
   reasons.push({path:entry.path,rule:"manifest_digest"});
 }
 const records=[];
 for(const path of debug){
  const bytes=readFileSync(join(debugDir,path));
  const record={path,bytes:bytes.length,sha256:digest(bytes),kind:textFile(path)?"text":"binary"};
  records.push(record);
  if(!textFile(path))continue;
  const body=bytes.toString("utf8");
  if(body.includes("\uFFFD"))reasons.push({path,rule:"invalid_utf8"});
  for(const [rule,re] of checks){
   re.lastIndex=0;
   let match,n=0;
   while((match=re.exec(body))!==null){
    const line=body.slice(0,match.index).split("\n").length;
    reasons.push({path,line,rule});
    if(++n>=100){reasons.push({path,rule:rule+"_truncated"});break;}
    if(match[0].length===0)re.lastIndex++;
   }
  }
  if(/\.(?:m?js)$/i.test(path)){
   // Literal static relative imports: fail closed for missing local imports and nonliteral dynamic loading.
   const refs=[...body.matchAll(/\b(?:import|export)\s+(?:[^;"']*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g)].map(x=>x[1]);
   const dynamic=[...body.matchAll(/\bimport\s*\(/g)];
   for(const x of dynamic)reasons.push({path,line:body.slice(0,x.index).split("\n").length,rule:"dynamic_import_requires_review"});
   for(const ref of refs){
    const resolved=posix.normalize(posix.join(posix.dirname(path),ref.split("?")[0].split("#")[0]));
    if(resolved.startsWith("../")||!files.has(resolved))reasons.push({path,rule:"missing_module_import",target:resolved});
   }
  }
 }
 const report={schemaVersion:1,sourceSha:process.env.G10_EXPECTED_SHA||"UNPINNED",fullArtifactGenerated:true,artifactIntegrityChecked:true,
  debugFileCount:debug.length,publicFileCount:pub.length,records,findings:reasons,
  decision:reasons.length?"HOLD_FINDINGS_REQUIRE_MANUAL_REVIEW":"HOLD_MANUAL_REVIEW_REQUIRED",
  note:"Pattern matching is heuristic; zero findings is NOT G10-PUBLIC-02 PASS. Never publish this report without privacy review."};
 process.stdout.write(JSON.stringify(report,null,2)+"\n");
 process.exitCode=reasons.length?1:0;
}
try{audit()}catch(error){process.stderr.write("G10 offline audit failed: "+error.message+"\n");process.exitCode=1}
finally{rmSync(temp,{recursive:true,force:true})}
