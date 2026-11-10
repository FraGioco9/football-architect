import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const css=read("assets/app.css");
const template=read("templates/app-page.html");

function count(text,needle) {
  return text.split(needle).length-1;
}

// Match declarations only inside their actual media block, never across a closing brace.
function mediaBlocks(condition) {
  const prefix="@media("+condition+"){";
  const result=[];
  let cursor=0;
  while((cursor=css.indexOf(prefix,cursor))!==-1){
    const start=cursor+prefix.length;
    let depth=1, end=start;
    for(;end<css.length&&depth>0;end++){
      if(css[end]==="{")depth++;
      else if(css[end]==="}")depth--;
    }
    assert.equal(depth,0,"unterminated media block");
    result.push(css.slice(start,end-1));
    cursor=end;
  }
  return result;
}

function mediaHas(condition,declaration){
  return mediaBlocks(condition).some(block=>block.includes(declaration));
}

test("CLEAN-UI-03: History mobile hide remains once in its max-width 620 block",()=>{
  assert.equal(count(css,".app-history-dev-archive-head{display:none}"),1,
    "duplicated History mobile hide must not regress");
  assert.ok(mediaHas("max-width:620px",".app-history-dev-archive-head{display:none}"));
});

test("CLEAN-UI-03: canonical competition logo breakpoint values remain single-sourced",()=>{
  assert.equal(count(css,".app-competition-header{--app-competition-logo-size:64px}"),2);
  assert.equal(count(css,".app-competition-header{--app-competition-logo-size:58px}"),2);
  assert.ok(mediaHas("max-width:620px",".app-competition-header{--app-competition-logo-size:64px}"));
  assert.ok(mediaHas("max-width:360px",".app-competition-header{--app-competition-logo-size:58px}"));
  assert.match(css,/\.app-competition-header\{--app-competition-logo-size:82px\}/);
});

test("CLEAN-UI-03: shared app shell retains its runtime dependencies until measured split",()=>{
  for(const asset of ["theme.js","landing.css","app.css","landing.js","app.js","app-search.js"]){
    assert.ok(template.includes("/assets/"+asset),"missing shared-shell dependency: "+asset);
  }
});

test("CLEAN-UI-03: Calendar navigation and Fixtures retain distinct shared control states",()=>{
  for(const selector of [
    "#world-calendar #calendar-controls #calendar-week-trigger{",
    ".app-fixtures-navigation :is(.app-fixtures-trigger,.app-fixtures-arrow)",
    ".calendar-arrow:has(>svg.site-chevron)",
    ".app-fixtures-navigation .app-fixtures-arrow:has(>svg.site-chevron)"
  ]) assert.ok(css.includes(selector),"missing shared-control contract: "+selector);
  assert.match(css,/#world-calendar #calendar-controls #calendar-week-trigger:is\(:hover,:active\):not\(:disabled\)\{border-color:var\(--border\)!important\}/);
  assert.match(css,/\.app-fixtures-navigation :is\(\.app-fixtures-trigger,\.app-fixtures-arrow\)[^\n]*:is\(:hover,:active\):not\(:disabled\)\{border-color:var\(--border\)!important\}/);
});

test("CLEAN-UI-03: Calendar touch and reduced-motion guards remain",()=>{
  assert.ok(mediaHas("prefers-reduced-motion:reduce",".calendar-marker-tooltip{animation:none}"));
  assert.ok(mediaHas("prefers-reduced-motion:reduce","#world-calendar #calendar-controls button{transition:none!important}"));
  assert.match(css,/@media\(hover:none\),\(pointer:coarse\)\{\.calendar-event:hover\{filter:none;outline:none\}\.calendar-marker-tooltip\{display:none!important\}\}/);
});

test("CLEAN-UI-03: History responsive constraints retain their dedicated scopes",()=>{
  assert.ok(mediaHas("max-width:620px",".app-history-dev-archive-head{display:none}"));
  assert.ok(mediaHas("max-width:360px",".app-history-dev-season-button{padding:10px}"));
  assert.match(css,/#competition-panel-history \.app-history-dev-record-entry:has\(\.app-history-dev-season-link\)/);
});

test("CLEAN-UI-03: protected Calendar event palette retains four types and light-theme overrides",()=>{
  for(const type of ["national","international","postseason","final"]){
    const marker='.calendar-event-dialog .calendar-event-code[data-event-type="'+type+'"]';
    assert.ok(css.includes(marker+"{"),"missing event palette: "+type);
    assert.ok(css.includes('html[data-theme="light"] '+marker+"{"),"missing light palette: "+type);
  }
});

// Nested context duplicates must not reappear after consolidation.
test("identical standings declarations are not duplicated in nested contexts",()=>{
 const css=readFileSync(new URL("../assets/app.css",import.meta.url),"utf8");
 assert.equal(css.split(".app-world-standing-table tbody tr>*{height:68px}").length-1,1);
});

test("Calendar enabled selector consolidation retains full four-ID contract",()=>{
  const selector="#world-calendar #calendar-controls :is(#calendar-previous,#calendar-next,#calendar-week-trigger,#calendar-current-week):not(:disabled)";
  assert.ok(css.includes(selector+"{cursor:pointer;opacity:1;transform:none;transition:background-color .18s ease,border-color .18s ease,color .18s ease}"));
  assert.equal(count(css,selector+"{"),1);
  for(const id of ["calendar-previous","calendar-next","calendar-week-trigger","calendar-current-week"]){
    assert.ok(selector.includes("#"+id),"missing navigation control "+id);
  }
});
test("Calendar and Fixtures chevrons retain matching shared geometry with independent host selectors",()=>{
  const pairs=[
    ".calendar-arrow:has(> .site-chevron),.app-fixtures-navigation .app-fixtures-arrow:has(> .site-chevron){position:relative}",
    ".calendar-arrow> .site-chevron,.app-fixtures-navigation .app-fixtures-arrow> .site-chevron{position:absolute;inset-block-start:50%;inset-inline-start:50%;translate:-50% -50%;margin:0;flex:none;display:block}",
    ".calendar-arrow:has(>svg.site-chevron),.app-fixtures-navigation .app-fixtures-arrow:has(>svg.site-chevron){position:relative;box-sizing:border-box;padding:0!important}",
    ".calendar-arrow>svg.site-chevron,.app-fixtures-navigation .app-fixtures-arrow>svg.site-chevron{position:absolute;inset:0;margin:auto;width:20px;height:20px;translate:none;display:block;flex:none}"
  ];
  for(const declaration of pairs)assert.ok(css.includes(declaration),"shared arrow geometry changed");
});

test("CLEAN-UI-03: safe CSS dedupes preserve repeated responsive competition-logo overrides",()=>{
 const css=read("assets/app.css");
 const declarations=[
  ".app-world-standing-table tbody tr>*{height:68px}",
  ".app-history-dev-archive-head{display:none}"
 ];
 for(const declaration of declarations)assert.equal(count(css,declaration),1,declaration);
 assert.ok(css.includes("#world-calendar #calendar-controls :is(#calendar-previous,#calendar-next,#calendar-week-trigger,#calendar-current-week):not(:disabled){"));
});

test("Postseason generated first paint connects same-row brackets only",()=>{
 for(const country of ["br","de","eng","es","fr","it","nl","pt"]){
  const html=read("competitions/"+country+"-2/index.html");
  assert.match(html,/<svg class="fa-bracket-links" data-bracket-layout="2"/,country);
  assert.doesNotMatch(html,/<div class="fa-bracket-links"/,country);
  assert.equal((html.match(/data-bracket-link=/g)||[]).length,2,country+" links");
 }
 for(const cup of ["int-1","int-2"]){
  const html=read("competitions/"+cup+"/index.html");
  assert.equal((html.match(/data-bracket-layout="2"/g)||[]).length,2,cup+" two-column row links");
  assert.equal((html.match(/data-bracket-layout="4"/g)||[]).length,3,cup+" four-column links");
  assert.equal((html.match(/data-bracket-link=/g)||[]).length,16,cup+" responsive variants");
  assert.match(html,/data-bracket-link="s1:final" d="M 0 102 H 7 V 175 H 14"/,cup+" second row aligns");
  assert.doesNotMatch(html,/<div class="fa-bracket-links"/,cup);
 }
});

test("Postseason cards have fluid tracks, source-anchored links and no duplicate controls",()=>{
 const css=read("assets/app.css"),view=read("assets/competition-rules-view.js");
 assert.ok(/\.fa-bracket-card\{[^}]*height:120px/.test(css),"stable card height");
 assert.match(css,/\.fa-bracket-board\{[^}]*grid-template-columns:minmax\(0,1fr\)/,"fluid card tracks");
 assert.match(css,/@container \(min-width:540px\)/,"at least ~260px per card before enabling two columns");
 assert.match(css,/@container \(min-width:820px\)/,"three columns require readable cards");
 assert.match(css,/@container \(min-width:1100px\)/,"four columns require readable cards");
 assert.match(css,/\.fa-bracket-links\{[^}]*inset-inline-start:100%/,"connector anchored to source edge");
 assert.match(view,/data-bracket-layout/,"links per responsive row layout");
 assert.doesNotMatch(view,/data-postseason-(filter|help|outcome)|postseasonTie/);
 assert.match(view,/data-bracket-feeders/);
 assert.match(css,/\.fa-bracket-card\{[^}]*padding-inline-end:calc\(var\(--fa-bracket-score-inset\) - 1px\)/);
 assert.match(css,/\.fa-bracket-resolution\{[^}]*margin-inline-end:var\(--fa-bracket-score-inset\)/);
 assert.doesNotMatch(view,/fa-bracket-leg-headings/);
 assert.match(css,/data-fa-standings-loading="true"[^\n]*fa-bracket-team[^\n]*::before/);
 assert.match(css,/data-fa-standings-loading="true"[^\n]*fa-bracket-team[^\n]*::after/);
});
