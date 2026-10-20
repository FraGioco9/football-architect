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
 assert.ok(awards.includes('id==="assists"?"0 0.85 32 32":"0 0 32 32"'),"Top Assists bounding box optically centered; Golden Boot remains geometrically centered");
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
 const previous={"champion":["M4 10l6.5 6L16 6l5.5 10L28 10l-2.5 14h-19Z","M7 27h18","M5.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M17.3 5a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z","M29.3 9a1.3 1.3 0 1 0-2.6 0 1.3 1.3 0 1 0 2.6 0Z"],"promotion":["M16 3L7 13h6v16h6V13h6z"],"playoff":["M4.5 5h7v7H4.5z","M4.5 20h7v7H4.5z","M11.5 8.5h5V16h5","M11.5 23.5h5V16","M24.5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"],"defender":["M16 3l11 4.5V16c0 6-4 10.5-11 13-7-2.5-11-7-11-13V7.5z","M10 17l4 4 8-9"],"midfielder":["M16 3l13 13-13 13L3 16z","M16 8v16M8 16h16","M12 12l8 8m0-8-8 8"],"forward":["M4 26L27 4l-4 13-6-6z","M4 18v9h9","M11 25l9-9"]};
 for(const [id,paths] of Object.entries(previous))assert.deepEqual(get(id),paths,id);
 assert.deepEqual(get("boot"),["M14.93,0.00 C14.10,0.05,12.68,0.29,11.87,0.50 C11.14,0.68,9.92,1.11,9.25,1.43 C8.47,1.80,7.19,2.56,6.50,3.06 C6.01,3.40,5.24,4.08,4.81,4.50 C4.54,4.75,4.10,5.21,3.87,5.50 C3.36,6.12,2.53,7.24,2.12,7.93 C1.76,8.54,1.26,9.65,1.00,10.31 C0.86,10.65,0.66,11.26,0.56,11.62 C0.41,12.17,0.19,13.12,0.12,13.68 C0.01,14.57,-0.05,16.11,0.00,17.00 C0.05,17.83,0.28,19.25,0.50,20.06 C0.69,20.82,1.16,22.10,1.50,22.81 C1.85,23.55,2.58,24.76,3.06,25.43 C3.40,25.92,4.08,26.69,4.50,27.12 C4.75,27.39,5.21,27.82,5.50,28.06 C6.12,28.57,7.24,29.40,7.93,29.81 C8.54,30.17,9.65,30.67,10.31,30.93 C10.72,31.09,11.44,31.32,11.87,31.43 C12.35,31.56,13.19,31.75,13.68,31.81 C14.57,31.92,16.11,31.99,17.00,31.93 C17.83,31.88,19.25,31.64,20.06,31.43 C20.82,31.23,22.10,30.77,22.81,30.43 C23.55,30.08,24.76,29.35,25.43,28.87 C25.92,28.52,26.69,27.84,27.12,27.43 C27.39,27.18,27.82,26.72,28.06,26.43 C28.57,25.81,29.40,24.69,29.81,24.00 C30.17,23.39,30.67,22.28,30.93,21.62 C31.09,21.21,31.32,20.49,31.43,20.06 C31.56,19.57,31.75,18.74,31.81,18.25 C31.92,17.36,31.97,15.82,31.93,14.93 C31.92,14.49,31.82,13.74,31.75,13.31 C31.67,12.85,31.50,12.07,31.37,11.62 C31.18,10.97,30.79,9.86,30.50,9.25 C30.13,8.47,29.37,7.20,28.87,6.50 C28.54,6.03,27.89,5.29,27.50,4.87 C27.21,4.57,26.69,4.07,26.37,3.81 C25.76,3.31,24.67,2.52,24.00,2.12 C23.39,1.76,22.28,1.26,21.62,1.00 C21.27,0.86,20.67,0.66,20.31,0.56 C19.76,0.41,18.81,0.19,18.25,0.12 C17.36,0.01,15.82,-0.05,14.93,0.00 Z M8.68,29.06 C8.68,29.06,8.91,29.00,9.00,29.00 C10.49,28.98,13.11,29.55,14.56,30.00 C15.10,30.16,16.50,30.87,16.50,30.87 C16.50,30.87,15.12,30.97,14.62,30.93 C14.01,30.89,12.97,30.71,12.37,30.56 C11.75,30.40,10.71,30.06,10.12,29.81 C9.72,29.64,8.68,29.06,8.68,29.06 Z M7.62,19.25 C7.62,19.25,9.99,19.83,10.87,20.00 C11.54,20.12,13.37,20.37,13.37,20.37 L16.81,26.18 L14.68,29.06 L7.56,27.81 C7.56,27.81,6.95,27.09,6.75,26.81 C6.44,26.40,5.95,25.68,5.68,25.25 C5.42,24.82,4.81,23.62,4.81,23.62 L7.62,19.25 Z M30.87,17.12 C30.87,17.12,30.85,17.99,30.81,18.31 C30.74,18.77,30.56,19.55,30.43,20.00 C30.28,20.53,29.96,21.42,29.75,21.93 C29.57,22.35,29.23,23.05,29.00,23.43 C28.59,24.10,27.81,25.21,27.31,25.81 C26.94,26.24,26.24,26.93,25.81,27.31 C25.55,27.53,24.81,28.06,24.81,28.06 L24.68,27.93 C24.68,27.93,24.61,27.20,24.56,26.93 C24.48,26.57,24.18,25.62,24.18,25.62 L27.81,18.93 C27.81,18.93,29.11,18.33,29.56,18.06 C29.93,17.83,30.87,17.12,30.87,17.12 Z M24.00,13.93 C24.00,13.93,25.03,15.42,25.37,16.00 C25.80,16.71,26.81,18.75,26.81,18.75 L23.31,25.18 C23.31,25.18,22.17,25.38,21.75,25.43 C21.04,25.52,19.83,25.65,19.12,25.68 C18.72,25.70,17.62,25.68,17.62,25.68 L14.18,19.81 C14.18,19.81,14.22,19.58,14.25,19.50 C14.72,18.14,16.75,14.75,16.75,14.75 C16.75,14.75,17.20,14.59,17.37,14.56 C19.12,14.22,24.00,13.93,24.00,13.93 Z M2.75,10.37 L6.37,12.56 C6.37,12.56,6.42,14.71,6.50,15.50 C6.57,16.31,6.93,18.50,6.93,18.50 L4.12,22.81 C4.12,22.81,3.33,22.33,3.06,22.12 C2.70,21.84,1.81,21.00,1.81,21.00 C1.81,21.00,1.18,18.73,1.06,17.87 C0.97,17.30,0.92,16.32,0.93,15.75 C0.96,14.90,1.03,13.40,1.31,12.62 C1.54,11.96,2.75,10.37,2.75,10.37 Z M15.25,3.62 C15.25,3.62,17.39,3.36,18.18,3.31 C18.81,3.27,20.50,3.25,20.50,3.25 C20.50,3.25,20.96,3.60,21.12,3.75 C22.41,4.97,25.50,8.68,25.50,8.68 C25.50,8.68,25.11,9.97,24.93,10.43 C24.68,11.12,23.87,12.93,23.87,12.93 L17.00,13.68 L13.18,9.50 C13.18,9.50,14.32,5.27,15.06,3.87 C15.10,3.80,15.25,3.62,15.25,3.62 Z M21.62,2.18 L21.81,2.12 C21.81,2.12,23.11,2.72,23.56,3.00 C24.20,3.38,25.24,4.14,25.81,4.62 C26.24,4.99,26.93,5.69,27.31,6.12 C27.58,6.42,28.02,6.97,28.25,7.31 C28.65,7.92,29.56,9.68,29.56,9.68 C29.56,9.68,29.42,9.70,29.37,9.68 C28.84,9.54,28.07,8.87,27.56,8.62 C27.23,8.46,26.60,8.32,26.31,8.12 C24.77,7.05,21.56,2.81,21.56,2.81 L21.62,2.18 Z M14.18,3.43 L12.31,8.93 C12.31,8.93,11.34,9.28,11.00,9.43 C10.41,9.69,9.43,10.18,8.87,10.50 C8.33,10.79,6.93,11.68,6.93,11.68 L3.31,9.56 C3.31,9.56,3.86,7.85,4.12,7.25 C4.28,6.88,4.57,6.25,4.81,5.93 C5.25,5.35,6.23,4.51,6.81,4.06 C7.31,3.66,8.24,3.05,8.81,2.75 C9.40,2.42,11.12,1.75,11.12,1.75 C11.12,1.75,12.28,2.21,12.68,2.43 C13.11,2.67,14.18,3.43,14.18,3.43 Z"],"Golden Boot approved Bezier reference");
 assert.deepEqual(get("glove"),["M194 402.5 L69.6 260.6 C56.5 246 58.3 226.6 71.5 211.3 C84.8 195.8 106.4 193.3 121.9 208.4 L175.3 269.7 L155.4 97.6 C153.1 78.7 165.1 63.9 182.3 62.4 C199.5 61.1 214 74.3 216 91.3 L230.6 220.3 L230.6 50.9 C230.6 33.2 244.5 20 261.1 20 C277.8 20 291.3 33.2 291.3 51 L291.3 217.2 L305 91.5 C307 73.4 320.6 62.3 337.5 62.3 C354.5 62.3 367.3 76.1 365 94.8 L349.2 249.5 L375.6 131.7 C379.7 113.8 395.5 103.9 411.8 107.2 C428.6 110.6 437.5 125 433.9 142.5 L406 266.3 L395.6 402.1 C395.3 405.7 393.3 407.7 389.4 407.7 H201.8 C198.7 407.7 196.6 406.1 194 402.5 Z","M205 421.4 H388.8 V440 H319.4 Q314 440 314 445.7 V454.7 Q314 460 319.4 460 H388.8 V476.7 Q388.8 481.8 383.8 481.8 H210 Q205 481.8 205 476.8 Z"],"Golden Glove matches approved 512 SVG");
 assert.deepEqual(get("assists"),["M0.18,12.06 C0.10,12.37,0.02,12.92,0.00,13.25 C-0.04,13.88,-0.00,14.98,0.06,15.62 C0.18,16.76,0.50,18.73,0.87,19.81 C0.94,20.02,1.11,20.38,1.25,20.56 C1.36,20.71,1.59,20.96,1.75,21.06 C2.03,21.24,2.60,21.43,2.93,21.50 C3.23,21.56,4.06,21.56,4.06,21.56 C4.06,21.56,4.22,21.73,4.25,21.81 C4.41,22.22,4.43,23.50,4.43,23.50 C4.43,23.50,4.60,23.70,4.68,23.75 C4.77,23.80,4.95,23.85,5.06,23.87 C5.34,23.92,5.85,23.94,6.12,23.87 C6.28,23.83,6.68,23.56,6.68,23.56 L7.00,21.68 L8.00,21.75 C8.00,21.75,8.04,23.09,8.25,23.50 C8.29,23.58,8.42,23.70,8.50,23.75 C8.58,23.80,8.77,23.85,8.87,23.87 C9.15,23.92,9.66,23.93,9.93,23.87 C10.08,23.84,10.33,23.72,10.43,23.62 C10.51,23.54,10.59,23.35,10.62,23.25 C10.70,22.96,10.63,22.42,10.68,22.12 C10.70,22.02,10.81,21.75,10.81,21.75 L20.18,21.81 C20.18,21.81,20.29,21.99,20.31,22.06 C20.40,22.39,20.32,23.04,20.43,23.37 C20.46,23.46,20.62,23.68,20.62,23.68 C20.62,23.68,20.98,23.84,21.12,23.87 C21.38,23.92,21.86,23.92,22.12,23.87 C22.26,23.84,22.62,23.68,22.62,23.68 C22.62,23.68,22.83,23.28,22.87,23.12 C22.94,22.81,22.93,21.93,22.93,21.93 L23.06,21.81 L24.00,21.81 C24.00,21.81,24.10,22.03,24.12,22.12 C24.18,22.40,24.12,22.91,24.18,23.18 C24.21,23.31,24.37,23.62,24.37,23.62 C24.37,23.62,24.77,23.84,24.93,23.87 C25.19,23.92,25.67,23.91,25.93,23.87 C26.04,23.85,26.22,23.80,26.31,23.75 C26.41,23.67,26.57,23.49,26.62,23.37 C26.77,23.01,26.62,22.24,26.75,21.87 C26.76,21.81,26.87,21.68,26.87,21.68 C26.87,21.68,28.17,21.41,28.62,21.25 C29.11,21.06,29.94,20.67,30.37,20.37 C30.69,20.15,31.21,19.69,31.43,19.37 C31.62,19.10,31.88,18.56,31.93,18.25 C31.98,18.00,31.94,17.55,31.87,17.31 C31.84,17.20,31.75,17.02,31.68,16.93 C31.54,16.75,31.20,16.49,31.00,16.37 C30.84,16.28,30.54,16.17,30.37,16.12 C29.52,15.87,27.99,15.71,27.12,15.50 C26.68,15.38,25.92,15.17,25.50,15.00 C21.70,13.45,11.93,8.06,11.93,8.06 C11.93,8.06,11.64,8.12,11.56,8.18 C11.00,8.58,9.93,10.31,9.93,10.31 C9.93,10.31,9.91,10.50,9.93,10.56 C9.96,10.63,10.06,10.76,10.12,10.81 C10.56,11.17,12.06,11.75,12.06,11.75 C12.06,11.75,11.79,11.95,11.68,12.00 C11.23,12.20,10.37,12.39,9.87,12.50 C9.49,12.57,8.82,12.66,8.43,12.68 C8.01,12.71,7.29,12.71,6.87,12.68 C6.51,12.66,5.91,12.57,5.56,12.50 C5.27,12.43,4.77,12.29,4.50,12.18 C4.25,12.09,3.85,11.88,3.62,11.75 C3.44,11.64,3.15,11.44,3.00,11.31 C2.59,10.96,2.07,10.13,1.62,9.87 C1.56,9.84,1.37,9.81,1.37,9.81 C1.37,9.81,0.93,10.29,0.81,10.50 C0.58,10.88,0.30,11.62,0.18,12.06 Z M20.50,14.37 L15.37,19.12 L13.00,19.06 L18.68,13.87 L20.50,14.37 Z M17.56,12.75 L10.62,19.12 L8.12,19.06 L15.75,12.25 L17.56,12.75 Z"],"Top Assists approved Bezier reference");
 for(const id of ["manager","young","xi"])assert.ok(get(id).length>=2,id);
 assert.equal(get("player").length,1,"approved star is one closed path");
 assert.ok(css.includes(".fa-awards-card-assists .fa-awards-symbol{fill:currentColor;fill-rule:evenodd;stroke:none}"));
 assert.ok(css.includes(".fa-awards-card-boot .fa-awards-symbol{fill:currentColor;fill-rule:evenodd;stroke:none}"));
 assert.ok(css.includes(".fa-awards-card-glove .fa-awards-symbol{fill:currentColor;stroke:none}"));
 assert.ok(awards.includes('id==="glove"?"0 0 512 512"'));
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
