import test from "node:test";
import assert from "node:assert/strict";
import {inventoryCss,formatCssAuditSummary} from "../tools/audit-css-cascade.mjs";
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

test("repeated selectors across responsive contexts are flagged but never called safe duplicates",()=>{
  const css="@media(max-width:620px){.x{padding:2px}}@media(min-width:621px){.x{padding:2px}}";
  const result=inventoryCss(css);
  assert.equal(result.identicalContextGroups.length,0);
  assert.equal(result.crossContextCandidates.length,1);
  assert.deepEqual(result.crossContextCandidates[0].occurrences.map(x=>x.context[0]),
    ["@media(max-width:620px)","@media(min-width:621px)"]);
});
test("same-selector different declarations are visible in contextual audit",()=>{
  const result=inventoryCss(".x{color:red}@media(max-width:620px){.x{color:blue}}");
  assert.equal(result.crossContextCandidates.length,1);
  assert.equal(result.crossContextCandidates[0].occurrences.length,2);
});
test("viewport height fallback declarations remain ordered and untouched",()=>{
  const css=readFileSync(new URL("../assets/app.css",import.meta.url),"utf8");
  for(const selector of [".app-body",".fa-career-shell",".fa-shell-sidebar"]){
    const block=css.slice(css.indexOf(selector+"{")).split("}")[0];
    assert.ok(block.indexOf("height:100vh")>=0);
    assert.ok(block.indexOf("height:100svh")>block.indexOf("height:100vh"));
    assert.ok(block.indexOf("height:100dvh")>block.indexOf("height:100svh"));
  }
});

test("audit summarizes media ownership without moving or changing declarations",()=>{
  const css=".x{color:red}@media(max-width:620px){.x{color:blue}.y{display:none}}"+
    "@media(min-width:621px){.z{display:flex}}";
  const report=inventoryCss(css);
  assert.equal(report.leafRules,4);
  assert.equal(report.scopedRuleCounts["(unscoped)"],1);
  assert.equal(report.scopedRuleCounts["@media(max-width:620px)"],2);
  assert.equal(report.scopedRuleCounts["@media(min-width:621px)"],1);
  assert.equal(report.identicalContextGroups.length,0);
});
test("read-only auditor does not mutate CSS input",()=>{
  const css="@media(max-width:620px){.x{display:none}}";
  const saved=css;
  inventoryCss(css);
  assert.equal(css,saved);
});

test("CSS audit summary sorts highest-ownership media contexts first",()=>{
  const css=".base{color:red}@media(max-width:620px){.a{color:blue}.b{color:red}}@media(min-width:621px){.c{display:grid}}";
  const report=formatCssAuditSummary(inventoryCss(css));
  assert.equal(report.totalLeafRules,4);
  assert.equal(report.topScopes[0].context,"@media(max-width:620px)");
  assert.equal(report.topScopes[0].count,2);
  assert.equal(report.exactDuplicateGroups,0);
});
test("candidate summary does not mark different media contexts as duplicate",()=>{
  const css="@media(max-width:620px){.x{color:red}}@media(min-width:621px){.x{color:red}}";
  const report=formatCssAuditSummary(inventoryCss(css));
  assert.equal(report.exactDuplicateGroups,0);
  assert.equal(report.crossContextSelectorGroups,1);
});
