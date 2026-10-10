import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateProvisionalAllocations} from "../tools/validate-provisional-allocations.mjs";

const load=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const manifest=load("data/division-allocations.provisional.json");
const divisions=load("data/divisions.json");
const clubs=load("data/clubs.json");
const clone=value=>structuredClone(value);

test("ALLOCATION-01 tracks 160 historical hints plus 160 derived assignments without canonical approval",()=>{
  const verified=validateProvisionalAllocations(manifest,divisions,clubs);
  assert.deepEqual(verified.counts,{total:320,historical:160,derived:160});
  assert.equal(verified.approved,false);
  assert.equal(verified.byDivision.size,16);
  for(const division of divisions.divisions){
    const roster=verified.byDivision.get(division.id);
    assert.equal(roster.length,20,division.id);
    assert.ok(roster.every(club=>club.countryId===division.countryId),division.id);
  }
});
test("ALLOCATION-02 fails closed on status, schema, source, duplicate, unknown and provenance errors",()=>{
  const reject=(change)=>{const changed=clone(manifest);change(changed);assert.throws(()=>validateProvisionalAllocations(changed,divisions,clubs),/Provisional division allocations:/);};
  reject(x=>{x.approved=true;});
  reject(x=>{x.status="canonical";});
  reject(x=>{x.schema="unknown";});
  reject(x=>{x.sources.clubs="different.json";});
  reject(x=>{x.allocations[0].clubIds[1]=x.allocations[0].clubIds[0];});
  reject(x=>{x.allocations[0].clubIds[0]=41;});
  reject(x=>{x.allocations[0].evidenceType="derived-complement";});
  reject(x=>{x.allocations[0].divisionId="IT-2";});
  reject(x=>{x.allocations[0].clubIds.pop();});
  const badClubs=clone(clubs);
  delete badClubs.clubs.find(c=>c.countryId==="IT"&&c.clubId===1).firstDivisionReference;
  assert.throws(()=>validateProvisionalAllocations(manifest,divisions,badClubs),/Provisional division allocations:/);
});
