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

test("AWARDS-02-UI-QA-05: playoff bracket replaces trophy; seven original emblems retained",()=>{
 const lines=awards.slice(awards.indexOf("const iconPaths="),awards.indexOf("const createIcon="));
 const get=id=>{const line=lines.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);return JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1));};
 const previous={"champion":["M4 10l6.5 6L16 6l5.5 10L28 10l-2.5 14h-19Z","M7 27h18","M5.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M17.3 5a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M29.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z"],"promotion":["M16 3L7 13h6v16h6V13h6z"],"playoff":["M4.5 5h7v7H4.5z","M4.5 20h7v7H4.5z","M11.5 8.5h5V16h5","M11.5 23.5h5V16","M24.5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"],"glove":["M8 28V14c0-2.5 3.5-2.5 3.5 0V6c0-2.5 3.5-2.5 3.5 0v7-5c0-2.5 3.5-2.5 3.5 0v5-2c0-2.5 3.5-2.5 3.5 0v10c0 5-4 8-9 8z","M12 19l4 3 4-3"],"defender":["M16 3l11 4.5V16c0 6-4 10.5-11 13-7-2.5-11-7-11-13V7.5z","M10 17l4 4 8-9"],"midfielder":["M16 3l13 13-13 13L3 16z","M16 8v16M8 16h16","M12 12l8 8m0-8-8 8"],"forward":["M4 26L27 4l-4 13-6-6z","M4 18v9h9","M11 25l9-9"]};
 for(const [id,paths] of Object.entries(previous))assert.deepEqual(get(id),paths,id);
 assert.deepEqual(get("boot"),["M16 2.5a13.5 13.5 0 1 0 0 27a13.5 13.5 0 1 0 0-27Z","M16 9l6.5 4.6-2.5 7.6h-8l-2.5-7.6Z","M16 9V2.5","M22.5 13.6l6.3-2","M20 21.2l4 5.4","M12 21.2l-4 5.4","M9.5 13.6l-6.3-2"],"Golden Boot is the approved symmetric football");
 assert.deepEqual(get("assists"),["M1.5 11.6C2.1 10.1 2.6 9.6 3.2 10.3C5.6 13.6 8.7 13.8 11.8 13.6C13.5 13.5 15 13 16.2 12.3L13.3 11C12.6 10.6 12.5 10.1 13 9.5L14.3 7.8C14.8 7.2 15.3 7.1 16.1 7.5L25.3 12.1C27.1 13 29.1 13.2 30.5 13.6C31.8 14 32 14.8 31.9 15.6C31.6 17.7 29.4 19 26.7 19.4L26.6 21C26.6 22.1 26.3 22.3 25.6 22.3H24.9C24.1 22.3 23.9 21.9 23.8 20.9L23.7 19.7H22.8L22.7 21C22.6 22 22.4 22.3 21.6 22.3H20.9C20.2 22.3 20 21.9 19.9 20.9L19.8 19.6H10.8L10.6 20.9C10.6 22 10.3 22.3 9.6 22.3H8.8C8.1 22.3 8 21.9 7.9 21L7.8 19.6H7L6.8 21C6.8 22 6.5 22.3 5.8 22.3H5.1C4.4 22.3 4.2 21.8 4.1 20.9L4 19.5C2.4 19.4 1.4 19.1 1 18.1C.3 16.3.6 13.5 1.5 11.6Z M15.8 12.4L8.1 17.5H10.7L18 13.6Z M18.7 13.9L13 17.5H15.4L20.5 14.7Z"],"Top Assists boot silhouette remains stable");
 for(const id of ["manager","young","xi"])assert.ok(get(id).length>=2,id);
 assert.equal(get("player").length,1,"approved star is one closed path");
 assert.ok(css.includes(".fa-awards-card-assists .fa-awards-symbol{fill:currentColor;fill-rule:evenodd;stroke:none}"));
});

test("AWARDS-02-UI-QA-06: team eleven uses approved optical offset at unchanged size and weight",()=>{
 const match=awards.match(/ xi:(\[[^\n]+\])/);
 assert.ok(match);
 assert.deepEqual(JSON.parse(match[1]),["M6.5 12l5-4v16","M17.5 12l5-4v16"]);
 assert.match(css,/\.fa-awards-card-xi \.fa-awards-symbol\{stroke-width:3\.5\}/);
});

test("AWARDS-02-UI-QA-07: manager frozen, player star filled and young U21 outlined",()=>{
 const section=awards.slice(awards.indexOf("const iconPaths="),awards.indexOf("const createIcon="));
 const get=id=>{const line=section.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);return JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1));};
 assert.deepEqual(get("manager"),["M16 2.8a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z","M9.3 15.4c-4.6.5-6.8 3.4-6.8 7.7v5.7c0 1.2 1 2.2 2.2 2.2h22.6c1.2 0 2.2-1 2.2-2.2v-5.7c0-4.3-2.2-7.2-6.8-7.7l-5.1 13.1c-.6 1.4-2.6 1.4-3.2 0Z","M14.4 15.5h3.2l1 1.9-2.1 2.7.8 4.3-1.3 3.3-1.3-3.3.8-4.3-2.1-2.7Z"]);
 assert.deepEqual(get("player"),["M16 2.7 20.1 11l9.2 1.3-6.7 6.5 1.6 9.2L16 23.7 7.9 28l1.6-9.2-6.7-6.5L12 11Z"]);
 assert.deepEqual(get("young"),["M4 8v10c0 3.8 1.8 6 4.6 6s4.6-2.2 4.6-6V8","M16 12c0-2.7 1.5-4.3 3.9-4.3s3.9 1.6 3.9 4c0 2-1.2 3.5-3.3 5.6L16 24h8","M26 10l2-2v16"]);
 assert.match(css,/fa-awards-card-manager \.fa-awards-symbol,.fa-awards-card-player \.fa-awards-symbol\{fill:currentColor;stroke:none\}/);
 assert.match(css,/fa-awards-card-young \.fa-awards-symbol\{fill:none;stroke:currentColor;stroke-width:2\.5\}/);
});

test("AWARDS-02-UI-QA-09: playoff bracket optically centered with symmetric 7x7 squares and circle, distinct from the frozen player star",()=>{
 const get=id=>{const line=awards.split("\n").find(s=>s.startsWith(" "+id+":"));assert.ok(line,id);return JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1));};
 assert.deepEqual(get("playoff"),["M4.5 5h7v7H4.5z","M4.5 20h7v7H4.5z","M11.5 8.5h5V16h5","M11.5 23.5h5V16","M24.5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"]);
 assert.notDeepEqual(get("playoff"),get("player"));
 assert.equal(get("player").length,1,"approved player star unchanged");
});

test("AWARDS-02-UI-QA-10: section headings are 16px and champion uses approved crown A",()=>{
 assert.match(css,/\.fa-awards-section-title\{font-size:16px;margin:0 0 14px\}/);
 const line=awards.split("\n").find(s=>s.startsWith(" champion:"));
 assert.ok(line);
 assert.deepEqual(JSON.parse(line.slice(line.indexOf("["),line.lastIndexOf("]")+1)),["M4 10l6.5 6L16 6l5.5 10L28 10l-2.5 14h-19Z","M7 27h18","M5.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M17.3 5a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M29.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z"]);
});
