// DEBUG-DATA-01 I03 — opt-in loopback-only protected JSON projection.
// Disabled by default. Never proxy to /api/world or publish source archives.
import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {timingSafeEqual,randomBytes,createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {buildFiveSeasonCorpusCandidate} from "./debug-data-five-season-corpus.mjs";
import {createProtectedDebugSeasonReader} from "./debug-data-i04-reader.mjs";
import {readProtectedWorldCandidates} from "./debug-data-i05-world-reader.mjs";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const reply=(res,status,data,head=false)=>{res.writeHead(status,headers);res.end(head?"":JSON.stringify(data));};
let cached;
const sessions=new Map();
const SESSION_COOKIE="fa_i03_local_session";
const tokenHash=value=>createHash("sha256").update(value).digest("hex");
const allowedHost=host=>["localhost:2000","app.localhost:2000","127.0.0.1:2000"].includes(host);
const sameOrigin=req=>{const origin=req.headers.origin;return origin===`http://${req.headers.host}`&&req.headers["sec-fetch-site"]!=="cross-site";};
const sessionCookie=req=>(req.headers.cookie??"").split(";").map(p=>p.trim()).find(x=>x.startsWith(SESSION_COOKIE+"="))?.slice(SESSION_COOKIE.length+1)??"";
const validSession=req=>{const value=sessionCookie(req);return /^[a-f0-9]{64}$/.test(value)&&sessions.get(tokenHash(value))?.host===req.headers.host&&sessions.get(tokenHash(value))?.expires>Date.now();};
const load=async()=>{
 if(cached)return cached;
 const read=async name=>JSON.parse(await readFile(join(root,name),"utf8"));
 const [baseline,divisions,cupCatalog,clubCatalog]=await Promise.all([read("backend/catalogues/season-1.participants.json"),read("data/divisions.json"),read("data/international-competitions.json"),read("data/clubs.json")]);
 const corpus=buildFiveSeasonCorpusCandidate({baseline,divisions,cupCatalog,seed:"debug-data-v1-fresh",datasetId:"debug-corpus-v1"});
 const reader=createProtectedDebugSeasonReader({loadCorpus:async()=>corpus,divisions,cupCatalog});
 reader.activate({datasetId:corpus.datasetId});
 cached={corpus,divisions,cupCatalog,clubCatalog,reader};
 return cached;
};
export async function respondProtectedDebugProjection(req,res){
 const url=new URL(req.url??"/","http://localhost");
 if(!["/__fa_dev_private__/season-view","/__fa_dev_private__/world-view","/__fa_dev_private__/session"].includes(url.pathname))return false;
 const deny=(status,code)=>{reply(res,status,{error:{code}},req.method==="HEAD");return true;};
 if(process.env.FA_DEBUG_I03_PROTECTED!=="1"||process.env.NODE_ENV==="production"||process.env.CI==="true")return deny(404,"not_found");
 const remote=req.socket.remoteAddress;
 if(!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote))return deny(403,"forbidden");
 if(!allowedHost(req.headers.host))return deny(403,"forbidden");
 if(url.pathname==="/__fa_dev_private__/session"){
  if(req.method!=="POST")return deny(405,"method_not_allowed");
  if(!sameOrigin(req))return deny(403,"origin_forbidden");
  if(req.headers["content-type"]!=="application/json"||Number(req.headers["content-length"]??0)>128)return deny(415,"unsupported_media_type");
  const secret=process.env.FA_DEBUG_I03_TOKEN;
  const supplied=req.headers.authorization?.match(/^Bearer ([a-zA-Z0-9_-]{32,128})$/)?.[1];
  if(!secret||!supplied||secret.length!==supplied.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return deny(401,"unauthorized");
  const value=randomBytes(32).toString("hex");
  sessions.set(tokenHash(value),{host:req.headers.host,expires:Date.now()+3600_000});
  if(sessions.size>128)sessions.delete(sessions.keys().next().value);
  res.writeHead(204,{...headers,"Set-Cookie":`${SESSION_COOKIE}=${value}; Path=/__fa_dev_private__/; HttpOnly; SameSite=Strict; Max-Age=3600`});res.end();return true;
 }
 if(!["GET","HEAD"].includes(req.method))return deny(405,"method_not_allowed");
 const secret=process.env.FA_DEBUG_I03_TOKEN;
 const supplied=req.headers.authorization?.match(/^Bearer ([a-zA-Z0-9_-]{32,128})$/)?.[1];
 if(!validSession(req)&&(!secret||!supplied||secret.length!==supplied.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied))))return deny(401,"unauthorized");
 const params=url.searchParams;
 if(url.pathname==="/__fa_dev_private__/world-view"){
  if(params.size!==2||[...params.keys()].some(k=>!["season","day"].includes(k))||!/^[1-5]$/.test(params.get("season")??"")||!/^([1-9]|[1-4][0-9]|5[0-6])$/.test(params.get("day")??""))return deny(400,"invalid_query");
  try{const {reader}=await load();const value=await readProtectedWorldCandidates(reader,Number(params.get("season")),Number(params.get("day")));reply(res,200,value,req.method==="HEAD");}catch(error){console.error("[FA DEBUG I05] Protected world unavailable:",error?.message??"unknown");return deny(503,"world_unavailable");}
  return true;
 }
 if([...params.keys()].some(k=>!["season","day","competition"].includes(k))||params.size!==3)return deny(400,"invalid_query");
 const season=Number(params.get("season")),day=Number(params.get("day")),competitionId=params.get("competition");
 if(!/^[1-5]$/.test(params.get("season")??"")||!/^([1-9]|[1-4][0-9]|5[0-6])$/.test(params.get("day")??"")||!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$|^int-[12]$/.test(competitionId??""))return deny(400,"invalid_query");
 try{
  const {reader,clubCatalog}=await load();
  const result=await reader.read({seasonNumber:season,worldDay:day,competitionId});
  if(result.status!=="candidate"||result.acceptance!=="UNSEALED_NOT_FOR_RUNTIME")return deny(503,"projection_unavailable");
  const projection=result.projection;
  const byId=new Map(clubCatalog.map(club=>[club.countryId+"-"+club.clubId,club]));
  const clubs=projection.participants.map(id=>{const club=byId.get(id);if(!club)throw Error("Missing canonical club identity "+id);return {...club,canonicalId:id};});
  reply(res,200,{kind:"protected-debug-projection",status:"UNSEALED_NOT_FOR_RUNTIME",...projection,clubs},req.method==="HEAD");
 }catch(error){
  console.error("[FA DEBUG I03] Protected projection unavailable:",error?.message??"unknown");
  return deny(503,"projection_unavailable");
 }
 return true;
}
