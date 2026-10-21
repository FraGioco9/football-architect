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
