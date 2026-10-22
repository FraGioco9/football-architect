import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicRequestFile,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const script=read("assets/international-cups.js");
const index=read("competitions/index.html");
const names=["sovereign-cup","federation-cup"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];

test("INT-24: both cup routes resolve to public allowlisted HTML",()=>{
  for(const slug of names){
    const route="/competitions/"+slug;
    const file=publicRequestFile(route);
    assert.equal(file,"competitions/"+slug+"/index.html");
    assert.ok(isAllowlistedPublicPath(file));
    assert.ok(index.includes('href="'+route+'"'));
    const html=read(file);
    assert.ok(html.includes('<h1 class="app-page-title" id="divisions-title"'));
    assert.ok(html.includes('aria-labelledby="divisions-title"'));
    assert.ok(html.includes('class="app-competition-header"'));
    assert.ok(html.includes('id="app-competition-season"'));
    assert.ok(html.includes('src="/assets/competition-tabs.js"'));
    for(const view of views){
      assert.ok(html.includes('id="competition-tab-'+view+'"'),slug+" "+view);
      assert.ok(html.includes('id="competition-panel-'+view+'"'));
      assert.equal(publicRequestFile(route+"/"+view),file);
    }
  }
  assert.ok(isAllowlistedPublicPath("assets/international-cups.js"));
  assert.equal((index.match(/class="app-division-card" href="\/competitions\/[a-z]{2,3}-[12]\/standings/g)||[]).length,16);
});

test("INT-24: five language dictionaries and empty states, no fabricated results",()=>{
  for(const locale of ["en","de","es","fr","it"])assert.match(script,new RegExp('"'+locale+'":\\['));
  assert.ok(script.includes('document.documentElement.lang'));
  assert.ok(script.includes('MutationObserver'));

  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('id="app-standings-body"'));
    assert.ok(!html.includes('data-world-country="IT"'));
    assert.ok(!html.includes('data-fa-score='));
  }
});

test("INT-24: shared theme controls and responsive CSS exist",()=>{
  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('src="/assets/theme.js"'));
    assert.ok(html.includes('href="/assets/app.css"'));
    assert.ok(html.includes('class="app-competition-tabs"'));
    assert.ok(!html.includes('class="app-international-tabs"'));
  }
});
