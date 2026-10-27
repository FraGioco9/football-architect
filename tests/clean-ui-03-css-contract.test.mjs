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
