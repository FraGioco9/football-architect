// DEBUG-DATA-01 I03 — opt-in loopback-only protected JSON projection.
// Disabled by default. Never proxy to /api/world or publish source archives.
import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {timingSafeEqual} from "node:crypto";
import {fileURLToPath} from "node:url";
import {buildFiveSeasonCorpusCandidate} from "./debug-data-five-season-corpus.mjs";
import {projectDebugWorldAtDay} from "./debug-data-projection.mjs";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const reply=(res,status,data,head=false)=>{res.writeHead(status,headers);res.end(head?"":JSON.stringify(data));};
let cached;
const load=async()=>{
 if(cached)return cached;
 const read=async name=>JSON.parse(await readFile(join(root,name),"utf8"));
 const [baseline,divisions,cupCatalog]=await Promise.all([read("backend/catalogues/season-1.participants.json"),read("data/divisions.json"),read("data/international-competitions.json")]);
 const corpus=buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,seed:"debug-data-v1-fresh",datasetId:"debug-corpus-v1"});
 cached={corpus,divisions,cupCatalog};
 return cached;
};
export async function respondProtectedDebugProjection(req,res){
 const url=new URL(req.url??"/","http://localhost");
 if(url.pathname!=="/__fa_dev_private__/season-view")return false;
 const deny=(status,code)=>{reply(res,status,{error:{code}},req.method==="HEAD");return true;};
 if(process.env.FA_DEBUG_I03_PROTECTED!=="1"||process.env.NODE_ENV==="production"||process.env.CI==="true")return deny(404,"not_found");
 const remote=req.socket.remoteAddress;
 if(!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote))return deny(403,"forbidden");
 if(!["localhost:2000","app.localhost:2000","127.0.0.1:2000"].includes(req.headers.host))return deny(403,"forbidden");
 if(!["GET","HEAD"].includes(req.method))return deny(405,"method_not_allowed");
 const secret=process.env.FA_DEBUG_I03_TOKEN;
 const supplied=req.headers.authorization?.match(/^Bearer ([a-zA-Z0-9_-]{32,128})$/)?.[1];
 if(!secret||!supplied||secret.length!==supplied.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return deny(401,"unauthorized");
 const params=url.searchParams;
 if([...params.keys()].some(k=>!["season","day","competition"].includes(k))||params.size!==3)return deny(400,"invalid_query");
 const season=Number(params.get("season")),day=Number(params.get("day")),competitionId=params.get("competition");
 if(!/^[1-5]$/.test(params.get("season")??"")||!/^([1-9]|[1-4][0-9]|5[0-6])$/.test(params.get("day")??"")||!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$|^int-[12]$/.test(competitionId??""))return deny(400,"invalid_query");
 try{
  const {corpus,divisions,cupCatalog}=await load();
  const projection=projectDebugWorldAtDay(corpus,{seasonNumber:season,worldDay:day,competitionId,divisions,cupCatalog});
  reply(res,200,{kind:"protected-debug-projection",status:"UNSEALED_NOT_FOR_RUNTIME",...projection},req.method==="HEAD");
 }catch(error){
  console.error("[FA DEBUG I03] Protected projection unavailable:",error?.message??"unknown");
  return deny(503,"projection_unavailable");
 }
 return true;
}
