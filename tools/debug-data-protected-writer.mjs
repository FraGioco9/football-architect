// DEBUG-DATA-01: protected local candidate writer, deliberately non-activating.
// Only explicitly invoked by an offline DEV operator, never by builds or HTTP routes.
import {mkdir,open,rename,rm,realpath,lstat} from "node:fs/promises";
import {resolve,join,relative,sep,basename} from "node:path";
import {randomUUID} from "node:crypto";
import {hash} from "./debug-data-schema.mjs";
import {planProtectedDebugExport} from "./debug-data-export-plan.mjs";
const fail=msg=>{throw new Error("DEBUG-DATA-01 protected writer: "+msg)};
const safeSegment=value=>typeof value==="string"&&/^[a-z0-9][a-z0-9._-]{0,100}$/.test(value)&&value!=="."&&value!=="..";
const within=(root,path)=>{const rel=relative(root,path);return rel!==""&&!rel.startsWith(".."+sep)&&rel!==".."&&!resolve(rel).startsWith("//")};
export async function writeProtectedCandidate({corpus,protectedRoot,explicitDevApproval=false}){
 if(!explicitDevApproval||process.env.NODE_ENV==="production"||process.env.CI==="true")fail("explicit local DEV approval required");
 if(!protectedRoot||typeof protectedRoot!=="string")fail("protected root required");
 if(!safeSegment(corpus?.datasetId))fail("unsafe dataset identity");
 const plan=planProtectedDebugExport(corpus);
 if(plan.manifest.status!=="UNSEALED_NOT_FOR_RUNTIME")fail("candidate must stay unsealed");
 const base=resolve(protectedRoot);
 if(basename(base)!=="debug-data-private")fail("only dedicated debug-data-private root allowed");
 const rootInfo=await lstat(base).catch(()=>null);
 if(!rootInfo?.isDirectory()||rootInfo.isSymbolicLink())fail("protected root must be existing real directory");
 const canonical=await realpath(base);
 if(canonical!==base)fail("protected root alias forbidden");
 const destination=join(base,corpus.datasetId);
 if(!within(base,destination))fail("unsafe destination");
 if(await lstat(destination).catch(()=>null))fail("immutable candidate already exists");
 const staging=join(base,".staging-"+randomUUID());
 await mkdir(staging,{mode:0o700});
 let published=false;
 try{
  for(const file of plan.files){
   if(!/^season-0[1-5]\/(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]\.json$|^season-0[1-5]\/int-[12]\.json$/.test(file.path))fail("unexpected export path");
   const path=join(staging,...file.path.split("/"));
   if(!within(staging,path))fail("path escapes staging");
   await mkdir(resolve(path,".."),{recursive:true,mode:0o700});
   const bytes=JSON.stringify(file.content);
   if(hash(bytes)!==file.sha256||Buffer.byteLength(bytes)!==file.bytes)fail("hash mismatch");
   const handle=await open(path,"wx",0o600);
   try{await handle.writeFile(bytes,"utf8");await handle.sync()}finally{await handle.close()}
  }
  const manifestPath=join(staging,"manifest.json");
  const manifestBytes=JSON.stringify(plan.manifest);
  if(hash(manifestBytes)!==plan.manifestHash)fail("manifest mismatch");
  const handle=await open(manifestPath,"wx",0o600);
  try{await handle.writeFile(manifestBytes,"utf8");await handle.sync()}finally{await handle.close()}
  await rename(staging,destination);
  published=true;
  return {directory:destination,manifestHash:plan.manifestHash,files:plan.files.length,status:"UNSEALED_NOT_FOR_RUNTIME"};
 }finally{if(!published)await rm(staging,{recursive:true,force:true})}
}
