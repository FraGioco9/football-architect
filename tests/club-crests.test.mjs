import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {isAllowlistedPublicPath,planPublicFiles} from "../tools/publication-guard.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const known=["BR-1","DE-1","PT-1"];
function node(key){
 const classes=new Set(),events={};
 return {dataset:key?{clubCrest:key}:{},children:[],style:{},
  classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),
   toggle(x,on){if(on)classes.add(x);else classes.delete(x)},contains:x=>classes.has(x)},
  setAttribute(){},removeAttribute(){},
  matches(selector){return selector==="[data-club-crest]"&&Boolean(this.dataset.clubCrest)},
  querySelectorAll(){return this.children.filter(n=>n.dataset?.clubCrest)},
  append(child){this.children.push(child);child.remove=()=>this.children.splice(this.children.indexOf(child),1)},
  addEventListener(name,fn){events[name]=fn},emit(name){events[name]?.()}
 };
}
async function render({keys=[...known,"IT-1","PT-2"],manifest=known,fail=false}={}){
 const crests=keys.map(node),observers=[],requests=[];
 const fields=new Map();
 const document={currentScript:{src:"https://app.example/assets/app.js"},
  documentElement:{lang:"en",dataset:{}},body:node(),
  getElementById(id){if(!fields.has(id))fields.set(id,node());return fields.get(id)},
  querySelectorAll(selector){return selector==="[data-club-crest]"?crests:[]},
  createElement(){return node()}
 };
 const window={location:{hostname:"app.example",protocol:"https:",pathname:"/competitions/pt-1"}};
 class MutationObserver{constructor(callback){this.callback=callback}observe(target,options){observers.push({callback:this.callback,options})}}
 runInNewContext(read("assets/app.js"),{document,window,MutationObserver,URL,
  fetch:async url=>{requests.push(String(url));if(fail)throw Error("Offline");return {ok:true,json:async()=>manifest}}});
 await new Promise(resolve=>setImmediate(resolve));
 return {crests,requests,add(key){const crest=node(key);crests.push(crest);
  for(const observer of observers.filter(o=>o.options.childList))observer.callback([{addedNodes:[crest]}]);return crest}};
}
test("CLUB-CRESTS: available identities load their canonical SVG, unknown clubs keep placeholders",async()=>{
 const {crests,requests}=await render();
 assert.deepEqual(requests,["https://app.example/assets/clubs/manifest.json"]);
 for(const [i,key] of known.entries()){
  const image=crests[i].children[0];assert.ok(image,"available crest: "+key);
  assert.equal(image.src,"https://app.example/assets/clubs/"+key.replace("-","/")+"/crest.svg");
  assert.equal(image.alt,"");assert.equal(crests[i].classList.contains("app-world-club-crest-loaded"),false);
  image.emit("load");assert.equal(crests[i].classList.contains("app-world-club-crest-loaded"),true);
 }
 assert.equal(crests[3].children.length,0);assert.equal(crests[4].children.length,0);
});
test("CLUB-CRESTS: failed images retain the placeholder and dynamic rows receive one image",async()=>{
 const state=await render();
 const crest=state.crests[0],image=crest.children[0];assert.ok(image);
 image.emit("error");assert.equal(crest.children.length,0);
 assert.equal(crest.classList.contains("app-world-club-crest-loaded"),false);
 const added=state.add("PT-1");assert.equal(added.children.length,1);
 state.add("../PT-1");assert.equal(state.crests.at(-1).children.length,0);
 assert.equal(state.requests.length,1);
});
test("CLUB-CRESTS: unavailable or invalid manifests fail back to placeholders",async()=>{
 for(const options of [{fail:true},{manifest:{}},{manifest:["../PT-1"]},{manifest:["PT-1","PT-1"]}]){
  const {crests}=await render(options);assert.ok(crests.every(n=>n.children.length===0));
 }
});
test("CLUB-CRESTS: checked-in index matches canonical artwork and only approved paths are public",()=>{
 const clubs=JSON.parse(read("data/clubs.json"));
 const expected=clubs.filter(c=>existsSync(new URL(`../assets/clubs/${c.countryId}/${c.clubId}/crest.svg`,import.meta.url)))
  .map(c=>c.countryId+"-"+c.clubId).sort();
 assert.deepEqual(JSON.parse(read("assets/clubs/manifest.json")),expected);
 const files=planPublicFiles();
 assert.ok(files.includes("assets/clubs/manifest.json"));
 for(const key of expected){const path="assets/clubs/"+key.replace("-","/")+"/crest.svg";assert.ok(files.includes(path),path)}
 for(const path of ["assets/clubs/PT/1/source.png","assets/clubs/PT/1/report.md","assets/clubs/XX/1/crest.svg","assets/clubs/PT/41/crest.svg"])
  assert.equal(isAllowlistedPublicPath(path),false,path);
});
