import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("assets/app.js"),awards=read("assets/competition-awards.js"),css=read("assets/competition-awards.css");
const keys=["awardsExcellence","awardsPerformance","awardsXi","awardsPending","awardsPitchAria","awardsChampion","awardsPromotion","awardsPlayoff","awardsManager","awardsPlayer","awardsYoung","awardsBoot","awardsAssists","awardsGlove","awardsDefender","awardsMidfielder","awardsForward"];
test("AWARDS-02-UI-QA-01: all five existing app dictionaries provide every award label",()=>{
 const markers=["en","de","es","fr","it"].map(x=>app.indexOf("    "+x+": {"));
 assert.ok(markers.every(x=>x>=0));
 for(let i=0;i<markers.length;i++){
  const body=app.slice(markers[i],markers[i+1]??app.indexOf("  function ",markers[i]));
  for(const key of keys)assert.match(body,new RegExp("\\b"+key+":\\s*\""),"missing "+key+" in "+["en","de","es","fr","it"][i]);
 }
});
test("AWARDS-02-UI-QA-01: rendered labels and accessible pitch use shared i18n",()=>{
 assert.match(awards,/node\.dataset\.appI18n=key/);
 assert.match(awards,/pitch\.dataset\.appAria="awardsPitchAria"/);
 assert.match(awards,/window\.faAppRenderLanguage\?\.\(\)/);
 for(const key of keys.filter(k=>k!=="awardsPitchAria"))assert.ok(awards.includes('"'+key+'"'),"unbound award label "+key);
});
test("AWARDS-02-UI-QA-01: mobile layout and light theme are scoped",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:1fr/);
 assert.match(css,/html\[data-theme="light"\] #competition-panel-awards \.fa-awards/);
 assert.match(css,/html\[data-theme="light"\] #competition-panel-awards \.fa-awards-card-title/);
});

test("AWARDS-02-UI-QA-02: no legacy ceremony labels or unverified recipient placeholders",()=>{
 assert.doesNotMatch(awards,/Season Honours|Season Awards|Awards Ceremony|No verified recipient available/);
 for(const key of ["awardsHonours","awardsHeading","awardsCeremony","awardsUnverified"])assert.doesNotMatch(app,new RegExp("\\b"+key+":" ));
});
test("AWARDS-02-UI-QA-02: all award identities are SVG and medallions center consistently",()=>{
 for(const id of ["champion","promotion","playoff","manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"])assert.match(awards,new RegExp("\\b"+id+":\\["));
 assert.match(awards,/createElementNS\(svgNS,"svg"\)/);
 assert.match(awards,/medallion\.append\(createIcon\(award\.id\)\)/);
 assert.match(css,/\.fa-awards-medallion\{[^}]*align-self:center/);
 assert.match(css,/\.fa-awards-symbol\{[^}]*width:100%;height:100%/);
});

test("AWARDS-02-UI-QA-03: initial Awards panels never flash obsolete fallback",()=>{
 const generator=read("tools/render-competition-page.mjs");
 assert.doesNotMatch(generator,/No season awards are available\./);
 assert.match(generator,/if\(id==="awards"\)return/);
 for(const country of ["br","de","eng","es","fr","it","nl","pt"]){
  for(const tier of [1,2]){
   const markup=read("app/competitions/"+country+"-"+tier+"/index.html");
   assert.doesNotMatch(markup,/No season awards are available\./);
   assert.match(markup,/id="competition-panel-awards"/);
  }
 }
 assert.doesNotMatch(read("app/competitions/_shared/index.html"),/No season awards are available\./);
});

test("AWARDS-02-UI-QA-04: no global pending notice or award-card hover animation",()=>{
 assert.doesNotMatch(awards,/AWARDS PENDING|Winners and candidates will appear/);
 assert.ok(!app.includes('awardsStatus:')&&!app.includes('awardsNotice:'));
 assert.ok(!css.includes('.fa-awards-card:hover')&&!css.includes('transition:border-color'));
 assert.ok(!css.includes('text-transform:uppercase'));
 assert.ok(awards.includes('Individual Excellence'));
});
test("AWARDS-02-UI-QA-04: all ten renewed award SVG definitions are present",()=>{
 const renewed=["manager","player","young","boot","assists","glove","defender","midfielder","forward","xi"];
 for(const id of renewed)assert.ok(awards.includes(' '+id+':['),id);
 assert.ok(css.includes('align-self:center'));
});

test("AWARDS-02-UI-QA-05: only four emblems redesigned; nine originals retained",()=>{
 const lines=awards.slice(awards.indexOf("const iconPaths="),awards.indexOf("const createIcon="));
 const get=id=>{const line=lines.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);return JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1));};
 const previous={"champion":["M5 18h22l3-14-10 7-4-9-4 9L2 4z","M7 23h18v4H7z"],"promotion":["M16 3L7 13h6v16h6V13h6z"],"playoff":["M16 2l4.4 9 9.9 1.4-7.2 7 1.7 9.9L16 24.7l-8.8 4.6 1.7-9.9-7.2-7 9.9-1.4z"],"boot":["M8 4h9v10l4 5h7v7H4v-6l4-4z","M4 26h24","M9 9h8m-8 5h8"],"assists":["M4 24l8-9 5 4L28 7","M20 7h8v8","M4 6h10v7H4z"],"glove":["M8 28V14c0-2.5 3.5-2.5 3.5 0V6c0-2.5 3.5-2.5 3.5 0v7-5c0-2.5 3.5-2.5 3.5 0v5-2c0-2.5 3.5-2.5 3.5 0v10c0 5-4 8-9 8z","M12 19l4 3 4-3"],"defender":["M16 3l11 4.5V16c0 6-4 10.5-11 13-7-2.5-11-7-11-13V7.5z","M10 17l4 4 8-9"],"midfielder":["M16 3l13 13-13 13L3 16z","M16 8v16M8 16h16","M12 12l8 8m0-8-8 8"],"forward":["M4 26L27 4l-4 13-6-6z","M4 18v9h9","M11 25l9-9"]};
 for(const [id,paths] of Object.entries(previous))assert.deepEqual(get(id),paths,id);
 for(const id of ["manager","player","young","xi"])assert.ok(get(id).length>=2,id);
});

test("AWARDS-02-UI-QA-06: team eleven uses approved optical offset at unchanged size and weight",()=>{
 const match=awards.match(/ xi:(\[[^\n]+\])/);
 assert.ok(match);
 assert.deepEqual(JSON.parse(match[1]),["M6.5 12l5-4v16","M17.5 12l5-4v16"]);
 assert.match(css,/\.fa-awards-card-xi \.fa-awards-symbol\{stroke-width:3\.5\}/);
});

test("AWARDS-02-UI-QA-07: only three human award emblems use filled silhouette treatment",()=>{
 const section=awards.slice(awards.indexOf("const iconPaths="),awards.indexOf("const createIcon="));
 const ids=["manager","player","young"];
 for(const id of ids){const line=section.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);assert.equal(JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1)).length,3,id);assert.ok(css.includes("fa-awards-card-"+id+" .fa-awards-symbol"),id);}
 assert.match(css,/fill:currentColor;stroke:none/);
});

test("AWARDS-02-UI-QA-08: approved manager stays frozen while player and young receive distinct football silhouettes",()=>{
 const lines=awards.slice(awards.indexOf("const iconPaths="),awards.indexOf("const createIcon="));
 const get=id=>{const line=lines.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);return JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1));};
 assert.deepEqual(get("manager"),["M16 2.8a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z","M9.3 15.4c-4.6.5-6.8 3.4-6.8 7.7v5.7c0 1.2 1 2.2 2.2 2.2h22.6c1.2 0 2.2-1 2.2-2.2v-5.7c0-4.3-2.2-7.2-6.8-7.7l-5.1 13.1c-.6 1.4-2.6 1.4-3.2 0Z","M14.4 15.5h3.2l1 1.9-2.1 2.7.8 4.3-1.3 3.3-1.3-3.3.8-4.3-2.1-2.7Z"]);
 assert.deepEqual(get("player"),["M16 2.7a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2Z","M10.2 15.2 4.7 18c-.8.4-1.4 1-1.7 1.9L1.5 24l5.8 2.2 2.1-4.1V30h13.2v-7.9l2.1 4.1 5.8-2.2-1.5-4.1c-.3-.9-.9-1.5-1.7-1.9l-5.5-2.8-2.7 3.5h-6.2Z","M13 15.4l3 3.4 3-3.4-1.1-.8h-3.8Z"]);
 assert.deepEqual(get("young"),["M15.2 3.5a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Z","M9.6 15.3l-5.1 2.8c-.6.3-1 .9-1.3 1.5L2 23.6l5.2 2 2-3.7V29h12v-7.1l2 3.7 5.2-2-1.2-4c-.2-.6-.7-1.2-1.3-1.5l-5.1-2.8-2.6 3.1h-6Z","M25 5l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4Z"]);
 assert.notDeepEqual(get("player"),get("young"));
});
