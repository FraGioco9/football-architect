import competitionModel from "../assets/competition-model.js";
// LOCAL-SHARED-PAGE-QA-01: exercise the real static renderer with isolated DOM stubs.
// This is deterministic runtime-contract QA, NOT a substitute for visual browser QA.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {it1Demo} from "./fixtures/it-1-demo.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("assets/competition-page.js");
// The hook exists only in this Node VM, never in the browser-served code.
const marker="  start().catch(fail);";
assert.equal(source.split(marker).length,2);
const demoSource=source.replace(marker,
  "  window.__faFixtureHooks = { createStandingsRow, attachFormTooltips };\n"+marker);
const manifest=JSON.parse(read("app/competitions/_shared/manifest.json"));
const root="http://127.0.0.1:2000";
const ids=["app-divisions","app-competition-badge","app-competition-flag",
 "app-competition-country","app-competition-tier","app-competition-capacity",
 "app-competition-level","app-standings-body","app-standings-caption",
 "app-standings-compact","app-standings-compact-list","app-standings-full",
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

async function simulate({division,ending="/",data=manifest,shell=null,fetchFailure=false,demo=false}){
 const loaded=[],requested=[],fields=new Map();
 const selected=division?.id??"IT-1";
 shell??=read("app/competitions/"+selected.toLowerCase()+"/index.html");
 const path="/competitions/"+selected.toLowerCase()+ending;
 const initial=node("main");
 fields.set("main-content",initial);
 const body=node("body");
 const topbar=node("header");
 topbar.rect={left:0,right:390,top:0,bottom:60,width:390,height:60};
 fields.set("fa-shell-topbar",topbar);
 let bodyMarkup="";
 Object.defineProperty(body,"innerHTML",{
  get(){return bodyMarkup},
  set(value){
   bodyMarkup=value;
   for(const id of ids)fields.set(id,node(id==="app-competition-flag"?"svg":"div"));
   fields.get("app-competition-flag").closest=selector=>selector===".app-world-flag-frame"?node("span"):null;

  }
 });
 // The real browser starts with the complete generated route, including its logo.
 body.innerHTML=shell;
 body.className="app-body";
 for(const id of ids)if(!shell.includes('id="'+id+'"')&&!id.startsWith('app-standings-compact')&&id!=='app-standings-full')fields.delete(id);
 const standings=node("div");
 let standingsMarkup=shell.match(/<div class="app-world-standings">[\s\S]*?<\/table>\s*<\/div>\s*<\/div>/)?.[0];
 Object.defineProperty(standings,"outerHTML",{get(){return standingsMarkup},set(value){standingsMarkup=value;for(const id of ['app-standings-compact','app-standings-compact-list','app-standings-full'])fields.set(id,node('div'));}});
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
   if(selector==='meta[name="fa-division"]')return {content:selected};
   if(selector===".fa-shell-topbar")return topbar;
   if(selector===".app-world-standings")return standingsMarkup?standings:null;
   return null;
  },
  getElementById(id){return fields.get(id)??null},
  createElement(tag){return node(tag)}
 };
 const location={href:root+path,pathname:path};
 const fakeFetch=async url=>{
  const u=new URL(url);
  requested.push(u.pathname);
  if(fetchFailure)return {ok:false};
  if(u.pathname==="/competitions/_shared/manifest.json")
   return {ok:true,json:async()=>data};
  return {ok:false};
 };
 const window={faCompetitionModel:competitionModel,location,innerWidth:390,innerHeight:600,events:{},
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
  emit(name,event){for(const fn of this.events[name]??[])fn(event)}};
 runInNewContext(demo?demoSource:source,{document,window,URL,fetch:fakeFetch});
 // Flush fetch, DOM filling, and the four sequential script-load promises.
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 if(demo){
  assert.equal(selected,"IT-1");
  assert.ok(window.__faFixtureHooks,"VM-only hooks must be present");
  const clubs=new Map(division.clubs.map(club=>[club.clubId,club]));
  assert.equal(it1Demo.length,16);
  const rows=it1Demo.map((sample,index)=>
   window.__faFixtureHooks.createStandingsRow(clubs.get(sample[0]),sample,index+1));
  fields.get("app-standings-body").replaceChildren(...rows);
  window.__faFixtureHooks.attachFormTooltips(clubs);
  const caption=fields.get("app-standings-caption");
  caption.dataset.appI18n="standingsFilledCaption";
  caption.textContent="League standings and recent form.";
 }
 return {document,fields,loaded,requested,body,window};
}

test("SHARED-QA-01: all sixteen routes hydrate on direct load and refresh",async()=>{
 for(const division of manifest.divisions){
  for(const ending of ["","/","/index.html"]){
   const r=await simulate({division,ending});
   assert.deepEqual(r.requested,[
    "/competitions/_shared/manifest.json"
   ],division.id+ending);
   assert.deepEqual(r.loaded,[
    "/assets/landing.js","/assets/app.js",
    "/assets/app-search.js","/assets/club-crests.js","/assets/competition-tabs.js","/assets/competition-history.js","/assets/competition-fixtures.js"
   ],division.id+ending);
   assert.equal(r.fields.get("division-detail-name").textContent,division.name);
   assert.ok(r.fields.get("app-competition-badge"),"initial logo host is preserved");
   assert.equal(r.fields.get("app-competition-flag").tagName,"svg");
   assert.ok(r.fields.get("app-competition-flag").closest(".app-world-flag-frame"));
   assert.ok(r.body.innerHTML.includes('id="app-competition-flag" aria-hidden="true" focusable="false" width="24" height="16"'));
   assert.equal(r.fields.get("app-competition-country").dataset.worldCountry,division.countryId);
   assert.equal(r.fields.get("app-competition-tier").dataset.appI18n,
    division.tier===1?"divisionTier1":"divisionTier2");
   assert.equal(r.fields.get("app-competition-capacity").textContent,"16");
   assert.equal(r.fields.get("app-competition-level").textContent,String(division.tier));
   const rows=r.fields.get("app-standings-body").children;
   assert.equal(rows.length,16,division.id);
   const mobileRows=r.fields.get("app-standings-compact-list").children;
   assert.equal(mobileRows.length,16,"mobile rows match canonical table");
   assert.deepEqual(mobileRows.map(x=>x.dataset.worldClub),
     rows.map(x=>x.dataset.worldClub));
   assert.ok(!r.body.innerHTML.includes('id="app-standings-layout-switch"'));
   assert.ok(!r.body.innerHTML.includes('id="app-standings-show-full"'));
   for (const [width,isMobile] of [[320,true],[390,true],[620,true],[621,false],[800,false]]) {
     r.window.innerWidth=width;
     r.window.emit("resize");
     assert.equal(r.fields.get("app-standings-compact").hidden,!isMobile,division.id+" "+width);
     assert.equal(r.fields.get("app-standings-full").hidden,isMobile,division.id+" "+width);
   }
   r.window.innerWidth=390;
   r.window.emit("resize");
   assert.equal(mobileRows[0].children[0].tagName,"details");
   assert.equal(mobileRows[0].children[0].children[0].tagName,"summary");
   for(let i=0;i<mobileRows.length;i++){
    const identity=mobileRows[i].children[0].children[0].children[1];
    assert.equal(identity.children[0]?.dataset.clubCrest,division.countryId+'-'+division.clubs[i].clubId,'Mobile identity exposes its crest host');
    assert.equal(identity.children[1]?.textContent,division.clubs[i].primaryName,'Mobile club name remains beside its crest');
   }
   const detailsPanel=mobileRows[0].children[0].children[1];
   assert.equal(detailsPanel.children.length,1,"mobile expansion includes stats only");
   assert.equal(detailsPanel.children[0].className,"app-world-mobile-stats");
   assert.equal(detailsPanel.children[0].children.length,8);
   assert.equal(mobileRows[0].children[0].children[0].children[2].textContent,"—");
   const preview=false; // ordinary pages never render sample results
   const clubs=preview ? new Map(division.clubs.map(c=>[c.clubId,c])) : null;
   for(let i=0;i<16;i++){
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
    // Approved primary and full names may legitimately be identical.
    if(preview){
     assert.equal(row.children[0].textContent,String(i+1));
     assert.equal(row.children[2].textContent,"15");
     const numbers=row.children.slice(3,10).map(cell=>Number(cell.textContent));
     const [w,d,l,gf,ga,gd,pts]=numbers;
     assert.equal(w+d+l,15);
     assert.equal(gd,gf-ga);
     assert.equal(row.children[8].className,"app-world-stat-value");
     assert.equal(pts,3*w+d);
     const form=row.children[10].children[0];
     assert.equal(form.className,"app-world-form-strip");
     assert.equal(form.children.length,5);
     if(i===0)assert.deepEqual(
      form.children.map(dot=>dot.className.split(" ").find(cls=>/^app-world-form-[wdl]$/.test(cls)).slice(-1).toUpperCase()),
      it1Demo[0][6].split("").reverse(),"demo order must be newest first");
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
   assert.equal(r.fields.get("app-standings-caption").dataset.appI18n,undefined);
   assert.equal(r.body.children.filter(node=>node.attrs.role==="tooltip").length,0);
   assert.equal(r.body.className,"app-body");
   assert.ok(!r.body.children.some(child=>child.attrs.role==="alert"));
  }
 }
});

test("DEMO-IT1: isolated fixture ranking is internally consistent",async()=>{
 const preview=await simulate({division:manifest.divisions.find(d=>d.id==="IT-1"),demo:true});
 const rows=preview.fields.get("app-standings-body").children;
 assert.equal(rows.length,16);
 assert.deepEqual([...rows].map(row=>Number(row.children[0].textContent)),
  Array.from({length:16},(_,i)=>i+1));
 const idsSeen=new Set(rows.map(row=>row.dataset.worldClub));
 assert.equal(idsSeen.size,16);
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
 const r=await simulate({division:manifest.divisions.find(d=>d.id==="IT-1"),demo:true});
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
 assert.equal(metadata.children[0].children[1].textContent,"15");
 assert.match(scoreline.children[1].textContent,/^(?:1 – 2|2 – 1|1 – 1)$/);
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
 assert.equal(metadata.children[0].children[1].textContent,"11");
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
 // A trigger near the topbar must open below it, never across the header.
 newest.rect={left:375,right:390,top:146,bottom:162,width:15,height:16};
 newest.emit("focus");
 assert.equal(tooltip.style.left,"82px");
 assert.equal(tooltip.style.top,"170px");
 assert.ok(Number.parseInt(tooltip.style.top,10)>=r.fields.get("fa-shell-topbar").rect.bottom+8);
 r.window.emit("resize");
 assert.equal(tooltip.hidden,false);
 // Responsive topbar heights are measured dynamically on each scroll/resize.
 r.fields.get("fa-shell-topbar").rect.bottom=78;
 newest.rect={left:150,right:166,top:220,bottom:236,width:16,height:16};
 r.window.emit("scroll");
 assert.equal(tooltip.style.top,"88px");
 assert.ok(Number.parseInt(tooltip.style.top,10)>=78+8);
 // At the very top, the trigger is occluded by the fixed header.
 newest.rect={left:150,right:166,top:28,bottom:44,width:16,height:16};
 r.window.emit("scroll");
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 assert.equal(newest.attrs["aria-describedby"],undefined);
 // A short viewport which cannot fit the full fixed-height tooltip fails closed.
 r.window.innerHeight=200;
 newest.rect={left:150,right:166,top:105,bottom:121,width:16,height:16};
 newest.emit("focus");
 assert.equal(tooltip.className,"app-world-form-tooltip is-closing");
 tooltip.emit("animationend",{target:tooltip,animationName:"app-world-tooltip-out"});
 assert.equal(tooltip.hidden,true);
 r.window.innerHeight=600;
 r.fields.get("fa-shell-topbar").rect.bottom=60;
 // At narrow and desktop widths the horizontal position stays within bounds.
 for (const viewport of [320,390,1280]) {
  r.window.innerWidth=viewport;
  newest.rect={left:viewport-15,right:viewport,top:146,bottom:162,width:15,height:16};
  newest.emit("focus");
  assert.equal(tooltip.style.top,"170px");
  assert.ok(Number.parseInt(tooltip.style.left,10)>=8);
  assert.ok(Number.parseInt(tooltip.style.left,10)+tooltip.offsetWidth<=viewport-8);
 }
 newest.rect={left:400,right:416,top:220,bottom:236,width:16,height:16};
 r.window.innerWidth=390;
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
 const badProfile=structuredClone(manifest);badProfile.profile.format.phases.push({id:"final",type:"knockout"});
 const badRules=structuredClone(manifest);badRules.profile.rules.promotion=3;
 const badName=structuredClone(manifest);badName.divisions[0].clubs[0].primaryName=42;
 for(const options of [{data:badProfile},{data:badRules},{data:approved},{data:repeated},{data:short},{data:badName},{fetchFailure:true},
  {shell:"<html><body class=\"app-body\"></body></html>"}]){
  const r=await simulate({division:manifest.divisions[0],...options});
  assert.equal(r.loaded.length,0,"no scripts should execute after a validation error");
  assert.equal(r.body.children.length,1);
  assert.equal(r.body.children[0].attrs.role,"alert");
  assert.equal(r.body.children[0].children[0].href,"../");
 }
});
