import test from "node:test";
import assert from "node:assert/strict";
import {parseRoute,buildRoute,canonicalizeRoute,resolveRouteIdentity,countries,competitionViews,cupViews,clubViews} from "../assets/routes-registry.mjs";
test("A03: all division, cup and club identities round-trip deterministically",()=>{
 for(const c of countries)for(const tier of [1,2])for(const v of competitionViews){const path=buildRoute({kind:"competition",id:c+"-"+tier,view:v});assert.equal(parseRoute(path).canonical,path);assert.equal(canonicalizeRoute(path+"/"),path);}
 for(const id of ["int-1","int-2"])for(const v of cupViews){const path=buildRoute({kind:"cup",id,view:v});assert.equal(parseRoute(path).canonical,path);}
 for(const c of countries)for(let n=1;n<=40;n++)for(const v of clubViews){const path=buildRoute({kind:"club",country:c,id:String(n),view:v});assert.equal(parseRoute(path).canonical,path);}
 assert.deepEqual(resolveRouteIdentity("/competitions/int-1/fixtures"),{kind:"cup",base:"/competitions/int-1",view:"fixtures"});
});
test("A03: malformed, unsupported and ambiguous URLs fail closed",()=>{
 for(const path of ["/competitions/it-3","/competitions/IT-1/fixtures","/competitions/int-1/overview","/competitions/int-1","/clubs/it/0","/clubs/it/01","/clubs/it/41","/clubs/zz/1/overview","/clubs/it/%31/overview","/clubs/it/1//overview","/app/competitions/it-1","/competitions/it-1/nope"])assert.equal(parseRoute(path),null,path);
 assert.throws(()=>buildRoute({kind:"cup",id:"int-1",view:"teams"}));
 assert.throws(()=>buildRoute({kind:"club",country:"it",id:"01",view:"overview"}));
});
