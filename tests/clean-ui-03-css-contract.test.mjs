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
  assert.equal(count(css,".app-competition-header{--app-competition-logo-size:64px}"),1);
  assert.equal(count(css,".app-competition-header{--app-competition-logo-size:58px}"),1);
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
test("identical standings/postseason declarations are not duplicated in nested contexts",()=>{
 const css=readFileSync(new URL("../assets/app.css",import.meta.url),"utf8");
 assert.equal(css.split(".app-world-standing-table tbody tr>*{height:68px}").length-1,1);
 assert.equal(css.split(".app-postseason-grid:not(.app-postseason-playout) .app-knockout-result::before{display:none}").length-1,1);
});
