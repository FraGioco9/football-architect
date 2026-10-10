import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read = file => readFileSync(new URL("../"+file,import.meta.url),"utf8");
const html=read("guide/index.html");
const js=read("assets/guide.js");
const css=read("assets/guide.css");
const divisions=JSON.parse(read("data/divisions.json"));
const catalogue=JSON.parse(read("data/clubs.json"));

test("the atlas uses actual catalogue inventory and unique stable IDs",()=>{
 assert.equal(divisions.countries.length,8);
 assert.equal(divisions.divisions.length,16);
 assert.equal(catalogue.count,320);
 assert.equal(catalogue.clubs.length,320);
 const countryIds=divisions.countries.map(c=>c.id);
 assert.equal(new Set(countryIds).size,8);
 assert.equal(new Set(divisions.divisions.map(d=>d.id)).size,16);
 assert.equal(new Set(catalogue.clubs.map(c=>c.countryId+"-"+c.clubId)).size,320);
 for(const country of divisions.countries){
   assert.equal(divisions.divisions.filter(d=>d.countryId===country.id).length,2);
   assert.equal(catalogue.clubs.filter(c=>c.countryId===country.id).length,40);
   assert.ok(existsSync(new URL("../"+country.flagAsset,import.meta.url)));
 }
 for(const d of divisions.divisions){
   assert.ok([1,2].includes(d.tier));
   assert.equal(d.capacity,20);
 }
});
test("club names and historical references keep their provenance",()=>{
 assert.equal(catalogue.clubs.filter(c=>c.firstDivisionReference).length,160);
 assert.equal(catalogue.clubs.filter(c=>c.abbr && /^[A-Z]{3}$/.test(c.abbr)).length,320);
 assert.equal(new Set(catalogue.clubs.map(c=>c.abbr)).size,320);
 const expected=[["IT",1,"VEL","US Velaria Torino"],["IT",2,"RIN","AC Rinascenti Bologna"],["FR",27,"EMX","FC Émaux"],["FR",33,"GRG","CS Garrigues"],["PT",34,"FTS","AC Fontes"],["BR",16,"FCL","EC Falésia Clara"]];
 for(const [countryId,clubId,abbr,short] of expected){
   const club=catalogue.clubs.find(c=>c.countryId===countryId&&c.clubId===clubId);
   assert.ok(club);
   assert.equal(club.abbr,abbr);
   assert.equal(club.approvedShortName,short);
 }
});
test("guide is a separate accessible route with native filtering",()=>{
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<html lang="en">/);
 assert.match(html,/href="\.\.\/assets\/guide\.css"/);
 assert.match(html,/src="\.\.\/assets\/guide\.js"/);
 assert.match(html,/<main\b[^>]*id="main-content"/);
 assert.match(html,/id="catalog-search" type="search"/);
 assert.match(html,/id="country-filter"/);
 assert.match(html,/id="type-filter"/);
 assert.match(html,/id="result-summary" role="status" aria-live="polite"/);
 assert.deepEqual([...html.matchAll(/<option value="(en|de|es|fr|it)"/g)].map(m=>m[1]),["en","de","es","fr","it"]);
});
test("shared language, verified data fetch, no fabricated division assignments or untrusted HTML",()=>{
 for(const word of ["football-architect:language","../data/divisions.json","../data/clubs.json","approvedShortName","firstDivisionReference","legacyTitle","noAssignment","emblemPending","loadError","changeLanguage","normalize(","typeSelect.value","countrySelect.value","search.value"]) assert.ok(js.includes(word),word);
 assert.match(js,/const languages = \["en", "de", "es", "fr", "it"\]/);
 assert.match(js,/language:"en"/);
 assert.match(js,/\.textContent\s*=/);
 assert.doesNotMatch(js,/\.innerHTML\s*=/);
 assert.doesNotMatch(js,/localStorage\.clear|indexedDB|window\.open/);
 assert.doesNotMatch(html,/src="https?:\/\//);
});
test("responsive and focus-visible styling without internal scroll containers",()=>{
 for(const rule of ["max-width:900px","max-width:600px","focus-visible",".division-grid",".club-list",".country-index",".atlas-filters"]) assert.ok(css.includes(rule),rule);
 assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
 assert.doesNotMatch(css,/overflow-x:\s*hidden/);
});
