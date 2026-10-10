// LOCAL-SHARED-PAGE-QA-01: exercise the real static renderer with isolated DOM stubs.
// This is deterministic runtime-contract QA, NOT a substitute for visual browser QA.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("assets/competition-page.js");
const manifest=JSON.parse(read("app/world/competitions/_shared/manifest.json"));
const sharedHtml=read("app/world/competitions/_shared/index.html");
const root="http://127.0.0.1:2000";
const ids=["app-divisions","app-competition-badge","app-competition-flag",
 "app-competition-country","app-competition-tier","app-competition-capacity",
 "app-competition-level","app-standings-body","app-search-dialog","division-detail-name"];

function node(tag){
 const children=[],attrs={};
 const n={
  tagName:tag,children,attrs,dataset:{},className:"",textContent:"",
  appendChild(item){children.push(item);return item},
  removeAttribute(name){delete attrs[name]},
  append(...items){children.push(...items)},
  replaceChildren(...items){children.splice(0,children.length,...items)},
  setAttribute(name,value){attrs[name]=value}
 };
 return n;
}

async function simulate({division,ending="/",data=manifest,shell=sharedHtml,fetchFailure=false}){
 const loaded=[],requested=[],fields=new Map();
 const selected=division?.id??"IT-1";
 const path="/app/world/competitions/"+selected.toLowerCase()+ending;
 const initial=node("main");
 fields.set("main-content",initial);
 const body=node("body");
 let bodyMarkup="";
 Object.defineProperty(body,"innerHTML",{
  get(){return bodyMarkup},
  set(value){
   bodyMarkup=value;
   for(const id of ids)fields.set(id,node("div"));
  }
 });
 const document={
  currentScript:{src:root+"/assets/competition-page.js"},
  head:{
   appendChild(script){
    loaded.push(new URL(script.src).pathname);
    // A loaded script is recorded here; it is not executed in this DOM stub.
    script.onload?.();
   }
  },
  body,
  querySelector(selector){
   return selector==='meta[name="fa-division"]'?{content:selected}:null;
  },
  getElementById(id){return fields.get(id)??null},
  createElement(tag){return node(tag)}
 };
 const location={href:root+path,pathname:path};
 const fakeFetch=async url=>{
  const u=new URL(url);
  requested.push(u.pathname);
  if(fetchFailure)return {ok:false};
  if(u.pathname==="/app/world/competitions/_shared/index.html")
   return {ok:true,text:async()=>shell};
  if(u.pathname==="/app/world/competitions/_shared/manifest.json")
   return {ok:true,json:async()=>data};
  return {ok:false};
 };
 class FakeDOMParser{
  parseFromString(html,mime){
   assert.equal(mime,"text/html");
   const bodyMatch=html.match(/<body class="([^"]+)">([\s\S]*?)<\/body>/);
   if(!bodyMatch)throw Error("Missing shared body");
   return {
    body:{className:bodyMatch[1],innerHTML:bodyMatch[2]},
    getElementById(id){return html.includes('id="'+id+'"')?{}:null},
    querySelectorAll(selector){assert.equal(selector,"script");return []}
   };
  }
 }
 runInNewContext(source,{document,window:{location},DOMParser:FakeDOMParser,URL,fetch:fakeFetch});
 // Flush fetch, DOM filling, and the four sequential script-load promises.
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 return {document,fields,loaded,requested,body};
}

test("SHARED-QA-01: all sixteen routes hydrate on direct load and refresh",async()=>{
 for(const division of manifest.divisions){
  for(const ending of ["/","/index.html"]){
   const r=await simulate({division,ending});
   assert.deepEqual(r.requested,[
    "/app/world/competitions/_shared/index.html",
    "/app/world/competitions/_shared/manifest.json"
   ],division.id+ending);
   assert.deepEqual(r.loaded,[
    "/assets/landing.js","/assets/app.js",
    "/assets/app-search.js","/assets/competition-tabs.js"
   ],division.id+ending);
   assert.equal(r.fields.get("division-detail-name").textContent,division.name);
   assert.equal(r.fields.get("app-competition-badge").textContent,division.id);
   assert.equal(r.fields.get("app-competition-flag").src,"../../../../"+division.flagAsset);
   assert.equal(r.fields.get("app-competition-country").dataset.worldCountry,division.countryId);
   assert.equal(r.fields.get("app-competition-tier").dataset.appI18n,
    division.tier===1?"divisionTier1":"divisionTier2");
   assert.equal(r.fields.get("app-competition-capacity").textContent,"20");
   assert.equal(r.fields.get("app-competition-level").textContent,String(division.tier));
   const rows=r.fields.get("app-standings-body").children;
   assert.equal(rows.length,20,division.id);
   for(let i=0;i<20;i++){
    const row=rows[i],club=division.clubs[i];
    assert.ok(club.primaryName,"Expected an approved primary club name");
    assert.equal(row.dataset.worldClub,club.countryId+"-"+club.clubId);
    assert.equal(row.children.length,11,division.id);
    assert.equal(row.children[1].children[0].textContent,club.abbr);
    if(club.primaryName){
     assert.equal(row.children[1].children.length,2);
     assert.equal(row.children[1].children[1].textContent,club.primaryName);
     assert.notEqual(row.children[1].children[1].textContent,club.fullName);
    }else{
     assert.equal(row.children[1].children.length,1);
     assert.equal(row.children[1].children[0].attrs["aria-hidden"],undefined);
    }
    assert.equal(row.children.filter(cell=>cell.textContent==="—").length,10);
   }
   assert.equal(r.body.className,"app-body");
   assert.ok(!r.body.children.some(child=>child.attrs.role==="alert"));
  }
 }
});

test("SHARED-QA-01: invalid, approved or unavailable data fails closed",async()=>{
 const approved=structuredClone(manifest);approved.approved=true;
 const repeated=structuredClone(manifest);repeated.divisions[1].clubs[0]=repeated.divisions[0].clubs[0];
 const short=structuredClone(manifest);short.divisions[0].clubs.pop();
 const badName=structuredClone(manifest);badName.divisions[0].clubs[0].primaryName=42;
 for(const options of [{data:approved},{data:repeated},{data:short},{data:badName},{fetchFailure:true},
  {shell:"<html><body class=\"app-body\"></body></html>"}]){
  const r=await simulate({division:manifest.divisions[0],...options});
  assert.equal(r.loaded.length,0,"no scripts should execute after a validation error");
  assert.equal(r.body.children.length,1);
  assert.equal(r.body.children[0].attrs.role,"alert");
  assert.equal(r.body.children[0].children[0].href,"../");
 }
});
