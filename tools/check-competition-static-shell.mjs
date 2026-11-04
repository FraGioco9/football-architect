// PAGE-LOAD-02: verify generated competition routes preserve the canonical
// inline crests while exposing the permanent view rail before async bootstrap.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const countries=["br","de","eng","es","fr","it","nl","pt"];
const ids=[...countries.flatMap(code=>[1,2].map(tier=>code+"-"+tier)),"int-1","int-2"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];
const main='<main class="app-main" id="main-content" tabindex="-1">';
const section='<section id="app-divisions" class="app-view app-world-view" aria-labelledby="divisions-title">';

for(const id of ids){
 const html=read("competitions/"+id+"/index.html");
 const where=(needle)=>html.indexOf(needle);
 assert.ok(where(main)>=0,"Missing main: "+id);
 assert.ok(where(main+"\n        "+section)>=0,"Competition section must be first inside main: "+id);
 const tab=where('class="app-competition-tabs"'),header=where('class="app-competition-header"');
 assert.ok(tab>where(main)&&tab<header,"Tabs must precede the crest/header in the parse path: "+id);
 assert.ok(where('          <script>(()=>{const view=document.documentElement.dataset.competitionView')>tab,"Missing immediate static view selection: "+id);
 assert.ok(where('data-fa-competition-shell')>=0&&where('data-fa-competition-shell')<where('</head>'),"Missing critical layout CSS in head: "+id);
 assert.ok(where("data-fa-competition-first-paint-init")>=0&&where("data-fa-competition-first-paint-init")<where("</head>"),"Missing prepaint gate before body: "+id);
 assert.ok(where("data-fa-competition-first-paint-ready")>header,"Prepaint gate must clear immediately after static header: "+id);
 assert.ok(where("data-fa-competition-first-paint-ready")<where("class=\"app-competition-panel\""),"Prepaint gate must clear before dynamic panels: "+id);
 assert.ok(where('order:0')>=0&&where('order:1')>=0&&where('order:2')>=0&&html.includes('border-bottom:1px solid var(--line)'),"Missing visible header/tab/panel order or underline: "+id);
 for(const view of views){
  const token='id="competition-tab-'+view+'"';
  assert.equal(html.split(token).length-1,1,"Missing/duplicated "+view+" tab: "+id);
 }
 assert.ok(where('<script src="/assets/competition-page.js" defer>')>=0,"Missing dynamic bootstrap: "+id);
 if(!id.startsWith("int-")){
  const badgeStart=where('id="app-competition-badge"');
  const badgeEnd=html.indexOf("</template>",badgeStart);
  assert.ok(badgeStart>=0&&badgeEnd>badgeStart,"Missing canonical inline division crest: "+id);
  const badge=html.slice(badgeStart,badgeEnd+"</template>".length);
  assert.ok(badge.includes('<template shadowrootmode="open">'),"Original inline crest missing: "+id);
  assert.ok(badge.includes('</template>'),"Original inline crest incomplete: "+id);
  assert.ok(!badge.includes('app-competition-logo-image'),"Unexpected external crest replacement: "+id);
 }
}
console.log("Competition static first paint structure: "+ids.length+"/"+ids.length+" PASS; inline division crests preserved");
