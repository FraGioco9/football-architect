// RENDER-02 SIZE-GATE-03: isolated, read-only benchmark. Writes only to os.tmpdir().
import {readFile,mkdir,writeFile,rm,mkdtemp,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {performance} from "node:perf_hooks";
import {gzipSync,brotliCompressSync,constants as z} from "node:zlib";
import {createHash} from "node:crypto";
import "../assets/club-model.js";
const root=resolve(import.meta.dirname,"..");
const [template,manifestText,routingText,guardText]=await Promise.all([
 "clubs/_shared/index.html","clubs/_shared/manifest.json","vercel.json","tools/publication-guard.mjs"
].map(p=>readFile(join(root,p),"utf8")));
const manifest=JSON.parse(manifestText),routing=JSON.parse(routingText);
const model=globalThis.faClubModel;
if(!model||manifest.clubs.length!==320)throw Error("Canonical model or 320 clubs unavailable");
const views=["overview","roster","fixtures","stats","history"];
const marker='<div id="club-page" aria-live="polite"></div>';
if(!template.includes(marker))throw Error("Template anchor missing");
const temp=await mkdtemp(join(tmpdir(),"fa-render02-size-"));
let result;
try {
 const stats={count:0,uncompressedBytes:0,gzipBytes:0,brotliBytes:0,byView:{},samples:[],artifactFiles:0};
 const hasher=createHash("sha256");
 let renderMs=0,writeMs=0,compressionMs=0;
 const totalStart=performance.now();
 for(const club of manifest.clubs)for(const view of views){
  const base="/clubs/"+club.countryId.toLowerCase()+"/"+club.clubId;
  const selected={countryId:club.countryId,clubId:club.clubId,view,base};
  const t0=performance.now();
  const markup=model.render(manifest,selected,"en","",null);
  const html=template.replace(marker,'<div id="club-page" aria-live="polite">'+markup+"</div>");
  renderMs+=performance.now()-t0;
  if(!html.includes('id="club-title"')||!html.includes('aria-current="page"'))throw Error("Missing static contract: "+base+"/"+view);
  const bytes=Buffer.from(html,"utf8");
  const z0=performance.now();
  const gz=gzipSync(bytes,{level:9});
  const br=brotliCompressSync(bytes,{params:{[z.BROTLI_PARAM_QUALITY]:11}});
  compressionMs+=performance.now()-z0;
  const path=join(temp,base,view,"index.html");
  const w0=performance.now();
  await mkdir(resolve(path,".."),{recursive:true});
  await writeFile(path,bytes);
  writeMs+=performance.now()-w0;
  hasher.update(base+"/"+view+"\n");hasher.update(bytes);
  stats.count++;stats.uncompressedBytes+=bytes.length;stats.gzipBytes+=gz.length;stats.brotliBytes+=br.length;
  stats.byView[view]??={count:0,bytes:0,gzipBytes:0,brotliBytes:0};
  const v=stats.byView[view];v.count++;v.bytes+=bytes.length;v.gzipBytes+=gz.length;v.brotliBytes+=br.length;
  if([1,20,40].includes(club.clubId)&&["IT","DE","BR"].includes(club.countryId))stats.samples.push({club:club.countryId+"-"+club.clubId,view,bytes:bytes.length,gzipBytes:gz.length,brotliBytes:br.length});
 }
 const disk=await stat(join(temp,"clubs","it","1","overview","index.html"));
 if(!disk.isFile()||stats.count!==1600)throw Error("Not all files written");
 stats.artifactFiles=stats.count;
 stats.renderMs=renderMs;stats.writeMs=writeMs;stats.compressionMs=compressionMs;stats.wallMs=performance.now()-totalStart;
 stats.sha256=hasher.digest("hex");
 const rewrite=routing.rewrites.find(r=>r.source.includes("/clubs/:country")&&r.source.includes("/:view"));
 const expectedShared=rewrite?.destination==="/clubs/_shared/index.html";
 const guardShared=guardText.includes('return "clubs/_shared/index.html"');
 const exactManifest=guardText.includes("Public artifact does not match exact approved manifest");
 stats.routingGuard={existingClubRewrite:rewrite,existingPointsToShared:expectedShared,existingGuardPointsToShared:guardShared,failClosedArtifactGuard:exactManifest,physicalPagesCurrentlyCompatible:!expectedShared&&!guardShared};
 if(!expectedShared||!guardShared||!exactManifest)throw Error("Baseline routing/guard contract unexpectedly changed");
 result=stats;
 console.log("FA_RENDER02_SIZE_GATE "+JSON.stringify(result));
}finally{await rm(temp,{recursive:true,force:true})}
const out=process.argv[2];
if(out)await writeFile(out,JSON.stringify(result,null,2)+"\n");
