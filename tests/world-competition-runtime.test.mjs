// LOCAL-SHARED-PAGE-QA-01: exercise the real static renderer with isolated DOM stubs.
// This is deterministic runtime-contract QA, NOT a substitute for visual browser QA.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("assets/competition-page.js");
const manifest=JSON.parse(read("app/competitions/_shared/manifest.json"));
const sharedHtml=read("app/competitions/_shared/index.html");
const root="http://127.0.0.1:2000";
const ids=["app-divisions","app-competition-badge","app-competition-flag",
 "app-competition-country","app-competition-tier","app-competition-capacity",
 "app-competition-level","app-standings-body","app-standings-demo","app-standings-caption",
 "app-search-dialog","division-detail-name"];

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
 const path="/app/competitions/"+selected.toLowerCase()+ending;
 const initial=node("main");
 fields.set("main-content",initial);
 const body=node("body");
 let bodyMarkup="";
 Object.defineProperty(body,"innerHTML",{
  get(){return bodyMarkup},
  set(value){
   bodyMarkup=value;
   for(const id of ids)fields.set(id,node("div"));
   fields.get("app-standings-demo").hidden=true;
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
  if(u.pathname==="/app/competitions/_shared/index.html")
   return {ok:true,text:async()=>shell};
  if(u.pathname==="/app/competitions/_shared/manifest.json")
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
    "/app/competitions/_shared/index.html",
    "/app/competitions/_shared/manifest.json"
   ],division.id+ending);
   assert.deepEqual(r.loaded,[
    "/assets/landing.js","/assets/app.js",
    "/assets/app-search.js","/assets/competition-tabs.js"
   ],division.id+ending);
   assert.equal(r.fields.get("division-detail-name").textContent,division.name);
   assert.equal(r.fields.get("app-competition-badge").textContent,division.id);
   assert.equal(r.fields.get("app-competition-flag").src,"../../../"+division.flagAsset);
   assert.equal(r.fields.get("app-competition-country").dataset.worldCountry,division.countryId);
   assert.equal(r.fields.get("app-competition-tier").dataset.appI18n,
    division.tier===1?"divisionTier1":"divisionTier2");
   assert.equal(r.fields.get("app-competition-capacity").textContent,"20");
   assert.equal(r.fields.get("app-competition-level").textContent,String(division.tier));
   const rows=r.fields.get("app-standings-body").children;
   assert.equal(rows.length,20,division.id);
   const preview=division.id==="IT-1";
   const clubs=preview ? new Map(division.clubs.map(c=>[c.clubId,c])) : null;
   for(let i=0;i<20;i++){
    const row=rows[i],club=preview ? clubs.get(Number(row.dataset.worldClub.split("-")[1])) : division.clubs[i];
    assert.ok(club.primaryName,"Expected an approved primary club name");
    assert.equal(row.dataset.worldClub,club.countryId+"-"+club.clubId);
    assert.equal(row.children.length,11,division.id);
    assert.equal(row.children[1].children.length,1);
    const identity=row.children[1].children[0];
    assert.equal(identity.className,"app-world-club-identity");
    assert.equal(identity.children.length,2);
    const crest=identity.children[0],name=identity.children[1];
    assert.equal(crest.className,"app-world-club-crest-placeholder");
    assert.equal(crest.dataset.clubCrest,club.countryId+"-"+club.clubId);
    assert.equal(crest.attrs["aria-hidden"],"true");
    assert.equal(name.className,"app-world-club-name");
    assert.equal(name.textContent,club.primaryName);
    assert.notEqual(name.textContent,club.fullName);
    if(preview){
     assert.equal(row.children[0].textContent,String(i+1));
     assert.equal(row.children[2].textContent,"19");
     const numbers=row.children.slice(3,10).map(cell=>Number(cell.textContent));
     const [w,d,l,gf,ga,gd,pts]=numbers;
     assert.equal(w+d+l,19);
     assert.equal(gd,gf-ga);
     assert.equal(row.children[8].className,"app-world-stat-value");
     assert.equal(pts,3*w+d);
     const form=row.children[10].children[0];
     assert.equal(form.className,"app-world-form-strip");
     assert.equal(form.children.length,5);
     for(const dot of form.children){
      assert.match(dot.className,/app-world-form-(w|d|l)/);
      assert.ok(dot.dataset.appI18n);
      assert.ok(dot.dataset.appAria);
     }
    }else{
     assert.equal(row.children.filter(cell=>cell.textContent==="—").length,10);
    }
   }
   assert.equal(r.fields.get("app-standings-demo").hidden,division.id!=="IT-1");
   assert.equal(r.fields.get("app-standings-caption").dataset.appI18n,
    division.id==="IT-1"?"standingsDemoCaption":undefined);
   assert.equal(r.body.className,"app-body");
   assert.ok(!r.body.children.some(child=>child.attrs.role==="alert"));
  }
 }
});

test("DEMO-IT1: illustrative ranking is internally consistent and isolated",async()=>{
 const preview=await simulate({division:manifest.divisions.find(d=>d.id==="IT-1")});
 const rows=preview.fields.get("app-standings-body").children;
 assert.equal(rows.length,20);
 assert.deepEqual([...rows].map(row=>Number(row.children[0].textContent)),
  Array.from({length:20},(_,i)=>i+1));
 const idsSeen=new Set(rows.map(row=>row.dataset.worldClub));
 assert.equal(idsSeen.size,20);
 let wins=0,losses=0,goalsFor=0,goalsAgainst=0,draws=0;
 let previousPoints=Infinity;
 for(const row of rows){
  const numbers=row.children.slice(3,10).map(cell=>Number(cell.textContent));
  const [w,d,l,gf,ga,gd,points]=numbers;
  wins+=w;draws+=d;losses+=l;goalsFor+=gf;goalsAgainst+=ga;
  assert.ok(points<=previousPoints,"demo is ranked by sample points");
  previousPoints=points;
 }
 assert.equal(wins,losses);
 assert.equal(goalsFor,goalsAgainst);
 assert.equal(draws%2,0);
 assert.ok(!preview.fields.get("app-standings-demo").hidden);
 const other=await simulate({division:manifest.divisions.find(d=>d.id==="IT-2")});
 assert.equal(other.fields.get("app-standings-demo").hidden,true);
 assert.ok(other.fields.get("app-standings-body").children.every(
  row=>row.children.filter(cell=>cell.textContent==="—").length===10));
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
