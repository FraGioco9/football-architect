import test from "node:test";
import assert from "node:assert/strict";
import {inventoryCss} from "../tools/audit-css-cascade.mjs";
import {readFileSync} from "node:fs";

test("same selector and declaration in same media scope is a candidate",()=>{
  const result=inventoryCss("@media(max-width:620px){.x{display:none}}@media(max-width:620px){.x{display:none}}");
  assert.equal(result.identicalContextGroups.length,1);
  assert.equal(result.leafRules,2);
});
test("different responsive contexts and keyframe names cannot be coalesced",()=>{
  const result=inventoryCss("@media(max-width:620px){.x{width:2px}}@media(min-width:621px){.x{width:2px}}@keyframes a{to{opacity:1}}@keyframes b{to{opacity:1}}");
  assert.equal(result.identicalContextGroups.length,0);
});
test("braces in quoted content and CSS comments do not become blocks",()=>{
  const result=inventoryCss('.x{content:"{ }";color:red}/* { ignored } */.x{content:"{ }";color:red}');
  assert.equal(result.identicalContextGroups.length,1);
});
test("invalid unbalanced input fails closed",()=>{
  assert.throws(()=>inventoryCss(".x{color:red"),/Unbalanced/);
});
test("production CSS is parsable for reporting without rewriting",()=>{
  const css=readFileSync(new URL("../assets/app.css",import.meta.url),"utf8");
  const result=inventoryCss(css);
  assert.ok(result.leafRules>500);
  assert.ok(Array.isArray(result.identicalContextGroups));
});

test("same leaf selector in differently named supports and container rules is not duplicate",()=>{
  const css="@supports(display:grid){.x{gap:8px}}@supports(display:flex){.x{gap:8px}}"+
    "@container card (min-width:300px){.x{gap:8px}}";
  assert.equal(inventoryCss(css).identicalContextGroups.length,0);
});
test("repeated rules report their own source lines and surrounding context",()=>{
  const css="@media(max-width:620px){\n.x{color:red}\n}\n@media(max-width:620px){\n.x{color:red}\n}";
  const groups=inventoryCss(css).identicalContextGroups;
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].context,["@media(max-width:620px)"]);
  assert.deepEqual(groups[0].lines,[2,5]);
});
test("unmatched delimiters fail closed, not silently accepted",()=>{
  for(const source of [".x{color:red}}", ".x[attr=ok]]{color:red}", ".x:not(.y)){color:red}"]){
    assert.throws(()=>inventoryCss(source),/Unmatched/);
  }
});
