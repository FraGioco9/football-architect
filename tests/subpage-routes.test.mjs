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
   const id=String(n).padStart(2,"0");
   const base="/clubs/"+country+"/"+id;
   assert.equal(resolveSubpage(base)?.canonical,base+"/overview");
   for(const view of clubViews)assert.equal(resolveSubpage(clubSubpage(country,id,view))?.redirect,false);
  }
});
test("ROUTE-02 unknown and malformed routes fail closed",()=>{
 for(const path of ["/competitions/it-3","/competitions/it-1/unknown","/clubs/it/00","/clubs/it/41","/clubs/it/1","/clubs/it/01/unknown","/app/competitions/it-1","/clubs/xx/01/overview"])
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
  for(const view of ["standings","fixtures","stats","history","rules","awards","postseason"])
   assert.equal((await get("/competitions/it-1/"+view)).status,200,view);
  assert.deepEqual(await get("/competitions/it-1/fixtures/?season=2"),{status:308,location:"/competitions/it-1/fixtures?season=2"});
  assert.equal((await get("/competitions/it-1/not-a-view")).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test("ROUTE-02 client renderer accepts only declared division subpages",async()=>{
 const {readFileSync}=await import("node:fs");
 const client=readFileSync(new URL("../assets/competition-page.js",import.meta.url),"utf8");
 assert.match(client,/divisionSegment!==routeId\.toLowerCase\(\)/);
 assert.match(client,/allowedViews\.has\(viewSegment\)/);
 assert.match(client,/segments\[0\]!=="competitions"/);
});
