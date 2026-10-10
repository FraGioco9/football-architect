import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../assets/landing.css",import.meta.url),"utf8");
const js=readFileSync(new URL("../assets/landing.js",import.meta.url),"utf8");
function render(saved=null,deny=false){
 const stored=new Map(),navigated=[];
 if(saved!==null)stored.set("football-architect:language",saved);
 const labels=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(x=>({dataset:{i18n:x[1]},textContent:""}));
 const control=(destination)=>({dataset:{destination},events:{},addEventListener(name,fn){this.events[name]=fn},fire(name){this.events[name]()}});
 const select=control(null),status={hidden:true},statusMessage={textContent:""},close=control(null),app=control("app"),guide=control("guide");
 close.setAttribute=function(name,value){this[name]=value};
 select.value="en";
 const document={
   documentElement:{lang:"en"},
   getElementById(id){return id==="site-language"?select:id==="action-status"?status:id==="action-status-message"?statusMessage:id==="status-close"?close:null},
   querySelectorAll(query){return query==="[data-i18n]"?labels:query==="[data-destination]"?[app,guide]:[]}
 };
 const localStorage={
   getItem(k){if(deny)throw Error("blocked");return stored.get(k)??null},
   setItem(k,v){if(deny)throw Error("blocked");stored.set(k,v)}
 };
 runInNewContext(js,{document,window:{localStorage,location:{assign(url){navigated.push(url)}}}},{timeout:2000});
 return {stored,labels,document,select,status,statusMessage,close,app,guide};
}
test("semantic single-title layout and native five-language selector",()=>{
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<h1 id="page-title">Football Architect<\/h1>/);
 assert.deepEqual([...html.matchAll(/<option value="(\w+)"/g)].map(m=>m[1]),["en","de","es","fr","it"]);
 assert.match(html,/<select id="site-language"/);
 assert.match(html,/<html lang="en">/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.doesNotMatch(html,/href="\/(?:app|guide)"/);
 for(const n of ["8","16","320"])assert.match(html,new RegExp('class="number">'+n+'<'));
});
test("default, restored, invalid, inaccessible storage",()=>{
 assert.equal(render().select.value,"en");
 assert.equal(render("de").labels.find(x=>x.dataset.i18n==="enter").textContent,"App öffnen");
 assert.equal(render("unlisted").select.value,"en");
 assert.equal(render(null,true).select.value,"en");
});
test("language changes all text without reload and persists under a shared key",()=>{
 const r=render();
 for(const lang of ["de","es","fr","it","en"]){
   r.select.value=lang;r.select.fire("change");
   assert.equal(r.document.documentElement.lang,lang);
   assert.equal(r.stored.get("football-architect:language"),lang);
   for(const label of r.labels)assert.ok(label.textContent.length>0);
 }
 const denied=render(null,true);denied.select.value="fr";denied.select.fire("change");
 assert.equal(denied.document.documentElement.lang,"fr");
});
test("unavailable app announces status; Guide navigates to the atlas",()=>{
 const r=render();r.app.fire("click");
 assert.equal(r.status.hidden,false);
 assert.match(r.statusMessage.textContent,/not available yet/);
 r.select.value="it";r.select.fire("change");
 assert.match(r.statusMessage.textContent,/non è ancora disponibile/);
 r.guide.fire("click");assert.match(r.statusMessage.textContent,/^La guida/);
 r.close.fire("click");assert.equal(r.status.hidden,true);
 r.select.value="en";r.select.fire("change");assert.equal(r.status.hidden,true);
 r.app.fire("click");assert.equal(r.status.hidden,false);
 assert.equal(r.close["aria-label"],"Dismiss notice");
});
test("responsive, keyboard focus, reduced motion and equal-width CTA contracts",()=>{
 for(const match of [/max-width:600px/,/\.cta\{width:100%\}/,/focus-visible/,/min-height:44px/,/prefers-reduced-motion:reduce/,/#101A1D/,/#216E56/,/width:260px/])assert.match(css,match);
 assert.doesNotMatch(css,/overflow-x:\s*hidden/);
});

test("site dropdown, non-reflow notices and favicon assets",()=>{
 assert.match(css,/appearance:\s*none/);
 assert.match(css,/\.language-control select option\s*\{[^}]*background:var\(--surface\)/s);
 assert.match(css,/\.action-status\s*\{[^}]*position:fixed/s);
 assert.match(css,/\.action-status\[hidden\]\s*\{display:none\}/);
 assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg">/);
 assert.match(html,/<link rel="alternate icon" type="image\/x-icon" href="\.\/favicon\.ico">/);
 assert.match(html,/<button type="button" class="status-close" id="status-close"/);
 const ico=readFileSync(new URL("../favicon.ico",import.meta.url));
 assert.equal(ico.readUInt16LE(0),0);
 assert.equal(ico.readUInt16LE(2),1);
 assert.ok(ico.length>100);
 assert.match(readFileSync(new URL("../favicon.svg",import.meta.url),"utf8"),/<svg[^>]*viewBox="0 0 64 64"/);
});
