import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateProvisionalAllocations} from "../tools/validate-provisional-allocations.mjs";
const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const manifest=read("data/division-allocations.provisional.json");
const divisions=read("data/divisions.json");
const clubs=read("data/clubs.json");
const clone=value=>JSON.parse(JSON.stringify(value));
test("ALLOCATION-01: preserve v1 data and 320 identities; use 16+16+8 national groups",()=>{
  assert.equal(manifest.schema,"football-architect-provisional-division-allocation-v1");
  assert.equal(manifest.status,"provisional");
  assert.equal(manifest.approved,false);
  const verified=validateProvisionalAllocations(manifest,divisions,clubs);
  assert.deepEqual(verified.counts,{total:256,tier1:128,tier2:128,excluded:64,catalog:320});
  assert.equal(verified.approved,false);
  assert.equal(verified.byDivision.size,16);
  for(const division of divisions.divisions){
    const roster=verified.byDivision.get(division.id);
    const start=division.tier===1?1:17;
    assert.equal(division.capacity,16);
    assert.equal(roster.length,16);
    assert.deepEqual(roster.map(c=>c.clubId),Array.from({length:16},(_,i)=>start+i));
  }
  assert.equal(clubs.clubs.length,320);
  for(const country of divisions.countries){
    const national=clubs.clubs.filter(c=>c.countryId===country.id);
    assert.equal(national.length,40);
    assert.deepEqual(national.map(c=>c.clubId).sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));
  }
});
test("ALLOCATION-02: invalid memberships, origin and history fail closed",()=>{
  const reject=change=>{
    const modified=clone(manifest);change(modified);
    assert.throws(()=>validateProvisionalAllocations(modified,divisions,clubs),/Provisional division allocations:/);
  };
  reject(x=>{x.approved=true;});
  reject(x=>{x.schema="invalid-schema";});
  reject(x=>{x.status="approved";});
  reject(x=>{x.sources.clubs="other.json";});
  reject(x=>{x.allocations[0].clubIds.pop();});
  reject(x=>{x.allocations[0].clubIds[0]=33;});
  reject(x=>{x.allocations[0].clubIds[1]=1;});
  reject(x=>{x.allocations[1].clubIds[0]=16;});
  reject(x=>{x.allocations[0].divisionId="IT-2";});
  reject(x=>{x.allocations[0].evidenceType="historical-first-division-reference";});
  const corrupt=clone(clubs);
  delete corrupt.clubs.find(c=>c.countryId==="IT"&&c.clubId===1).firstDivisionReference;
  assert.throws(()=>validateProvisionalAllocations(manifest,divisions,corrupt),/Provisional division allocations:/);
});
