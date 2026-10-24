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

import {existsSync,readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as esm from '../assets/routes-registry.mjs';
test('A03-04D: classic and CommonJS route cores expose the same immutable pure API as ESM',()=>{
 const file=new URL('../assets/routes-registry.js',import.meta.url);
 assert.ok(existsSync(file),'Shared classic route core must exist');
 const source=readFileSync(file,'utf8'),window={};
 runInNewContext(source,{window});
 const common={module:{exports:{}}};runInNewContext(source,common);
 const plain=value=>JSON.parse(JSON.stringify(value));
 const paths=['/competitions/it-1','/competitions/it-1/fixtures/','/competitions/int-1/fixtures','/competitions/int-2/history','/clubs/br/40/history','/clubs/it/01/overview','/clubs/it/%31/overview','/competitions/int-1','/dashboard','bad//path'];
 for(const api of [window.faRoutesRegistry,common.module.exports]){
  assert.ok(Object.isFrozen(api));
  for(const key of ['countries','competitionViews','cupViews','clubViews','pages']){
   assert.ok(Object.isFrozen(api[key]));assert.deepEqual(plain(api[key]),esm[key]);
  }
  for(const path of paths){
   assert.deepEqual(plain(api.parseRoute(path)),esm.parseRoute(path),path);
   assert.deepEqual(plain(api.resolveRouteIdentity(path)),esm.resolveRouteIdentity(path),path);
   assert.equal(api.canonicalizeRoute(path),esm.canonicalizeRoute(path),path);
  }
  for(const identity of [{kind:'club',country:'br',id:40,view:'history'},{kind:'competition',id:'it-1',view:'overview'},{kind:'cup',id:'int-2',view:'fixtures'},{kind:'page',id:'calendar'}])assert.equal(api.buildRoute(identity),esm.buildRoute(identity));
  assert.throws(()=>api.buildRoute({kind:'cup',id:'int-1',view:'teams'}),{name:'TypeError'});
  assert.throws(()=>api.buildRoute({kind:'club',country:'it',id:'01'}),{name:'TypeError'});
  const before=api.buildRoute;assert.equal(Reflect.set(api,'buildRoute',null),false);assert.equal(api.buildRoute,before);
 }
});
