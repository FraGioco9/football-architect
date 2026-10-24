import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {buildRoute} from "../assets/routes-registry.mjs";

const read = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");
const script = read("competitions/int-1/index.html").match(/<script>(\(\(\)=>\{const u=new URL\(location\.href\)[\s\S]*?\}\)\(\);)<\/script>/)?.[1];

test("A03-04G baseline: cup synchronous first-paint preserves exact root, view, season, query and hash",()=>{
 assert.ok(script, "existing inline bootstrap must be present");
 const samples=[
  ["/competitions/int-1","/competitions/int-1/standings?season=1"],
  ["/competitions/int-2/?view=fixtures&season=3#round","/competitions/int-2/fixtures?season=3#round"],
  ["/competitions/int-1/index.html?view=history#archive","/competitions/int-1/history#archive"],
  ["/competitions/int-2?view=rules&lang=it","/competitions/int-2/rules?lang=it"],
  ["/competitions/int-1?view=invalid&lang=de","/competitions/int-1/standings?lang=de&season=1"]
 ];
 for(const [input,expected] of samples){
  let replaced;
  const u=new URL(input,"https://fa.example");
  runInNewContext(script,{URL,location:{href:u.href},history:{replaceState:(_state,_title,path)=>{replaced=path;}}});
  assert.equal(replaced,expected,input);
 }
});
test("A03-04G baseline: search links remain domestic roots and shared registry can construct matching identities",()=>{
 const source=read("assets/app-search.js");
 assert.match(source,/faRoutesRegistry\?\.buildRoute\(/);
 for(const country of ["it","eng","es","de","fr","pt","nl","br"])for(const tier of [1,2]){
  const id=country+"-"+tier;
  assert.equal(buildRoute({kind:"competition",id,view:"standings"}).replace(/\/standings$/,""),"/competitions/"+id);
 }
});
