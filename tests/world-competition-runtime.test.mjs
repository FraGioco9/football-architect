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
 "app-competition-level","app-standings-body","app-standings-caption",
 "app-search-dialog","division-detail-name"];

function node(tag){
 const children=[],attrs={};
 const n={
  tagName:tag,children,attrs,dataset:{},className:"",textContent:"",style:{},
  offsetWidth:300,offsetHeight:124,events:{},
  appendChild(item){children.push(item);return item},
  removeAttribute(name){delete attrs[name]},
  append(...items){children.push(...items)},
  replaceChildren(...items){children.splice(0,children.length,...items)},
  setAttribute(name,value){attrs[name]=value},
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
  emit(name,event={}){for(const fn of this.events[name]??[])fn(event)},
  getBoundingClientRect(){return this.rect??{left:150,right:166,top:220,bottom:236,width:16,height:16}}
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

  }
 });
 const document={
  events:{},activeElement:null,
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
  emit(name,event){for(const fn of this.events[name]??[])fn(event)},
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
 const window={location,innerWidth:390,innerHeight:600,events:{},
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
  emit(name,event){for(const fn of this.events[name]??[])fn(event)}};
 runInNewContext(source,{document,window,DOMParser:FakeDOMParser,URL,fetch:fakeFetch});
 // Flush fetch, DOM filling, and the four sequential script-load promises.
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 return {document,fields,loaded,requested,body,window};
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
     if(i===0)assert.deepEqual(
      form.children.map(dot=>dot.className.split(" ").find(cls=>/^app-world-form-[wdl]$/.test(cls)).slice(-1).toUpperCase()),
      ["W","D","W","W","W"],"demo order must be newest first");
     for(const [index,dot] of form.children.entries()){
      assert.equal(dot.tagName,"button");
      assert.equal(dot.type,"button");
      assert.ok(dot.events.focus?.length);
      assert.ok(dot.events.click?.length);
      assert.ok(dot.events.pointerenter?.length);
      assert.match(dot.className,/app-world-form-(w|d|l)/);
      assert.ok(dot.dataset.appI18n);
      assert.ok(dot.dataset.appAria);
      assert.equal(dot.className.includes("app-world-form-last"),index===0,
       "only the leftmost form square is the most recent match");
      assert.equal(dot.dataset.appAria.endsWith("Latest"),index===0);
      assert.equal(dot.attrs["aria-label"].includes("latest match"),index===0);
     }
    }else{
     assert.equal(row.children.filter(cell=>cell.textContent==="—").length,10);
    }
   }
   assert.equal(r.fields.get("app-standings-caption").dataset.appI18n,
    division.id==="IT-1"?"standingsFilledCaption":undefined);
   assert.equal(r.body.children.filter(node=>node.attrs.role==="tooltip").length,preview?1:0);
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
 assert.ok(!preview.bodyMarkup?.includes("app-standings-demo"));
 const other=await simulate({division:manifest.divisions.find(d=>d.id==="IT-2")});
 assert.equal(other.fields.get("app-standings-caption").dataset.appI18n,undefined);
 assert.ok(other.fields.get("app-standings-body").children.every(
  row=>row.children.filter(cell=>cell.textContent==="—").length===10));
});

test("DEMO-TOOLTIP-01: match context, hover, focus, tap, viewport clipping and dismissal",async()=>{
 const r=await simulate({division:manifest.divisions.find(d=>d.id==="IT-1")});
 const tooltip=r.body.children.find(child=>child.attrs.role==="tooltip");
 assert.ok(tooltip,"one tooltip is outside both scrolling containers");
 assert.equal(tooltip.id,"app-world-form-tooltip");
 assert.equal(tooltip.hidden,true);
 const rows=r.fields.get("app-standings-body").children;
 const squares=rows[0].children[10].children[0].children;
 assert.equal(squares.length,5);
 const newest=squares[0],oldest=squares[4];
 const metadata=tooltip.children[0],scoreline=tooltip.children[1],context=tooltip.children[2];
 assert.equal(metadata.children.length,1);
 assert.equal(metadata.children[0].children[0].dataset.appI18n,"standingsTooltipRound");
 assert.equal(context.children.length,2);
 newest.emit("pointerenter",{pointerType:"mouse"});
 assert.equal(tooltip.hidden,false);
 assert.equal(newest.attrs["aria-describedby"],"app-world-form-tooltip");
 assert.equal(metadata.children[0].children[1].textContent,"19");
 assert.equal(scoreline.children[1].textContent,"1 – 2");
 assert.ok(scoreline.children[0].textContent);
 assert.ok(scoreline.children[2].textContent);
 assert.notEqual(scoreline.children[0].textContent,scoreline.children[2].textContent);
 assert.notEqual(context.children[0].hidden,context.children[1].hidden);
 assert.ok(Number.parseInt(tooltip.style.left,10)>=8);
 assert.ok(Number.parseInt(tooltip.style.top,10)>=8);
 // Reselecting the oldest sample updates the round and keeps a single description.
 oldest.emit("focus");
 assert.equal(newest.attrs["aria-describedby"],undefined);
 assert.equal(oldest.attrs["aria-describedby"],"app-world-form-tooltip");
 assert.equal(metadata.children[0].children[1].textContent,"15");
 oldest.emit("blur");
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 assert.equal(tooltip.hidden,false,"closing animation must complete before hiding");
 assert.equal(tooltip.attrs["aria-hidden"],"true");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 assert.equal(oldest.attrs["aria-describedby"],undefined);
 // A tap opens and a second tap on the same button closes.
 newest.emit("pointerdown",{pointerType:"touch"});
 newest.emit("focus");
 newest.emit("click");
 assert.equal(tooltip.hidden,false);
 newest.emit("pointerdown",{pointerType:"touch"});
 newest.emit("click");
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 newest.emit("focus");
 let stopped=false;
 r.document.emit("keydown",{key:"Escape",stopPropagation(){stopped=true}});
 assert.ok(stopped);
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 newest.emit("focus");
 r.document.emit("pointerdown",{target:rows[0]});
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 // Fixed portal stays within the viewport despite a button next to an edge.
 newest.rect={left:375,right:390,top:3,bottom:19,width:15,height:16};
 newest.emit("focus");
 assert.equal(tooltip.style.left,"82px");
 assert.equal(tooltip.style.top,"27px");
 r.window.emit("resize");
 assert.equal(tooltip.hidden,false);
 newest.rect={left:400,right:416,top:220,bottom:236,width:16,height:16};
 r.window.emit("scroll");
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing","off-screen tooltip animates out");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true,"off-screen tooltip dismissed");
 assert.equal(newest.attrs["aria-describedby"],undefined);
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
