import test from "node:test";
import assert from "node:assert/strict";
import {competitionViews,clubViews,resolveSubpage,competitionSubpage,clubSubpage} from "../assets/subpage-routes.mjs";

test("ROUTE-02 competition routes have explicit canonical subpages",()=>{
 for(const country of ["it","eng","es","de","fr","pt","nl","br"])
  for(const tier of ["1","2"]){
   const base="/competitions/"+country+"-"+tier;
   assert.equal(resolveSubpage(base)?.canonical,base+"/overview");
   assert.equal(resolveSubpage(base)?.redirect,true);
   for(const view of competitionViews){
    const path=competitionSubpage(country+"-"+tier,view);
    assert.deepEqual(resolveSubpage(path),{kind:"competition",base,view,canonical:path,redirect:false});
   }
  }
});
test("ROUTE-02 club routes cover 320 IDs and five views",()=>{
 for(const country of ["it","eng","es","de","fr","pt","nl","br"])
  for(let n=1;n<=40;n++){
   const id=String(n).toString();
   const base="/clubs/"+country+"/"+id;
   assert.equal(resolveSubpage(base)?.canonical,base+"/overview");
   for(const view of clubViews)assert.equal(resolveSubpage(clubSubpage(country,id,view))?.redirect,false);
  }
});
test("ROUTE-02 unknown and malformed routes fail closed",()=>{
 for(const path of ["/competitions/it-3","/competitions/it-1/unknown","/clubs/it/0","/clubs/it/41","/clubs/it/01","/clubs/it/1/unknown","/app/competitions/it-1","/clubs/xx/1/overview"])
  assert.equal(resolveSubpage(path),null,path);
 assert.throws(()=>competitionSubpage("it-3","rules"));
 assert.throws(()=>clubSubpage("it","41"));
});

test("ROUTE-02 resolves slash variants to one canonical resource",()=>{
  const c=resolveSubpage("/competitions/it-1/fixtures/");
  assert.equal(c.canonical,"/competitions/it-1/fixtures");
  assert.equal(c.redirect,true);
  const club=resolveSubpage("/clubs/br/40/history/");
  assert.equal(club.canonical,"/clubs/br/40/history");
  assert.equal(club.redirect,true);
});

test("ROUTE-02 publication resolves explicit competition views to allowlisted shells",async()=>{
 const {publicRequestFile,isAllowlistedPublicPath}=await import("../tools/publication-guard.mjs");
 for(const country of ["it","eng","es","de","fr","pt","nl","br"])
  for(const tier of [1,2])
   for(const view of competitionViews){
    const path=competitionSubpage(country+"-"+tier,view);
    const file=publicRequestFile(path);
    assert.equal(file,"competitions/"+country+"-"+tier+"/index.html");
    assert.equal(isAllowlistedPublicPath(file),true);
   }
 assert.equal(isAllowlistedPublicPath(publicRequestFile("/competitions/it-1/invalid")),false);
});
test("ROUTE-02 hosting has exact explicit view rewrites and base redirect",async()=>{
 const {readFileSync}=await import("node:fs");
 const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
 assert.ok(config.redirects.some(rule=>rule.source.includes(":division")&&rule.destination==="/competitions/:division/overview"));
 assert.ok(config.rewrites.some(rule=>rule.source.includes(":view(")&&rule.destination==="/competitions/:division/index.html"));
 assert.equal(config.rewrites.some(rule=>rule.destination.includes("/app/")),false);
});

test("ROUTE-02 DEV routes redirect base and serve explicit views",async()=>{
 const {once}=await import("node:events");
 const {request}=await import("node:http");
 const {createPreviewServer}=await import("../tools/dev-standings-preview.mjs");
 const server=createPreviewServer();server.listen(0,"127.0.0.1");await once(server,"listening");
 const get=path=>new Promise((resolve,reject)=>{
  const req=request({host:"127.0.0.1",port:server.address().port,path,headers:{host:"127.0.0.1:2000"}},res=>{
   res.resume();res.on("end",()=>resolve({status:res.statusCode,location:res.headers.location}));
  });req.on("error",reject);req.end();
 });
 try{
  assert.deepEqual(await get("/competitions/it-1"),{status:308,location:"/competitions/it-1/overview"});
  assert.deepEqual(await get("/competitions/it-1?season=2&view=fixtures&matchday=7"),{status:308,location:"/competitions/it-1/fixtures?season=2&matchday=7"});
  assert.deepEqual(await get("/competitions/it-1?season=4&view=history&matchday=9"),{status:308,location:"/competitions/it-1/history?season=4"});
  assert.deepEqual(await get("/competitions/it-1?season=3&view=rules"),{status:308,location:"/competitions/it-1/rules"});
  for(const view of ["standings","fixtures","stats","history","rules","awards","postseason"])
   assert.equal((await get("/competitions/it-1/"+view)).status,200,view);
  assert.deepEqual(await get("/competitions/it-1/fixtures/?season=2"),{status:308,location:"/competitions/it-1/fixtures?season=2"});
  assert.equal((await get("/competitions/it-1/not-a-view")).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test("A03-04B: DEV redirect and security oracle",async()=>{
 const {once}=await import("node:events");
 const {request}=await import("node:http");
 const {createPreviewServer}=await import("../tools/dev-standings-preview.mjs");
 const server=createPreviewServer();server.listen(0,"127.0.0.1");await once(server,"listening");
 const get=path=>new Promise((resolve,reject)=>{const req=request({host:"127.0.0.1",port:server.address().port,path,headers:{host:"127.0.0.1:2000"}},res=>{res.resume();res.on("end",()=>resolve({status:res.statusCode,location:res.headers.location??null}));});req.on("error",reject);req.end();});
 try{
  for(const [path,status,location] of [
   ["/competitions/it-1",308,"/competitions/it-1/overview"],
   ["/competitions/it-1?season=2&view=fixtures&matchday=7",308,"/competitions/it-1/fixtures?season=2&matchday=7"],
   ["/competitions/it-1?season=4&view=history&matchday=9",308,"/competitions/it-1/history?season=4"],
   ["/competitions/it-1/fixtures/?season=2",308,"/competitions/it-1/fixtures?season=2"],
   ["/clubs/it/1?view=stats",308,"/clubs/it/1/stats"],
   ["/clubs/it/%31/overview",403,null],
   ["/competitions/it-3",404,null],
   ["/competitions/int-1",200,null]
  ])assert.deepEqual(await get(path),{status,location},path);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
