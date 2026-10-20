import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {validateProvisionalAllocations} from "../tools/validate-provisional-allocations.mjs";
const read=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const manifest=read("data/division-allocations.provisional.json");
const divisions=read("data/divisions.json");
const countries=[...new Set(divisions.map(d=>d.countryId))].map(id=>({id}));
const clubs=read("data/clubs.json");
const clone=value=>JSON.parse(JSON.stringify(value));

test("CLUB-REGISTRY-01: all approved identities use the flat twelve-field catalogue",()=>{
  assert.ok(Array.isArray(clubs), "club catalogue must be a flat array");
  const fields=["countryId","clubId","city","primaryName","fullName","compactName","abbr","nickname","description","primaryColor","secondaryColor","stadiumName"];
  assert.equal(clubs.length,320);
  assert.equal(new Set(clubs.map(c=>c.countryId+":"+c.clubId)).size,320);
  assert.equal(new Set(clubs.map(c=>c.abbr)).size,320);
  assert.equal(new Set(clubs.map(c=>c.fullName)).size,320);
  for(const c of clubs){
    assert.deepEqual(Object.keys(c),fields);
    assert.ok(Number.isInteger(c.clubId)&&c.clubId>=1&&c.clubId<=40);
    for(const key of fields.filter(k=>k!=="clubId"))assert.ok(typeof c[key]==="string"&&c[key].trim(),key);
    assert.match(c.abbr,/^[A-Z]{3}$/);
    assert.match(c.primaryColor,/^#[0-9A-Fa-f]{6}$/);
    assert.match(c.secondaryColor,/^#[0-9A-Fa-f]{6}$/);
  }
});

test("CLUB-REGISTRY-02: CSV bytes and all JSON values match the owner-approved source",()=>{
  const hash=value=>createHash("sha256").update(value).digest("hex");
  assert.equal(hash(readFileSync(new URL("../data/clubs-registry.csv",import.meta.url))),"84fee0879d625848dbbca89a68cf0a51b56a9911c6e65517acef1b6ba61df727");
  assert.equal(hash(JSON.stringify(clubs)),"e14816ef1f9490b17f459917675c52476a3810f115380e54c70ffe58b9de1e01");
});

test("REGISTRY-01: CSV and JSON use the same flat division fields and records",()=>{
  const lines=readFileSync(new URL("../data/divisions-registry.csv",import.meta.url),"utf8").trimEnd().split(/\r?\n/);
  const headers=lines[0].split(",");
  assert.equal(divisions.length,16);
  assert.equal(lines.length,17);
  assert.deepEqual(Object.keys(divisions[0]),headers);
  assert.equal(new Set(divisions.map(d=>d.id)).size,16);
  assert.equal(new Set(divisions.map(d=>d.countryId)).size,8);
  assert.equal(new Set(divisions.map(d=>d.primaryHex)).size,16);
  for(let i=0;i<divisions.length;i++){
    const cells=lines[i+1].split(",");
    assert.equal(cells.length,headers.length);
    const row=Object.fromEntries(headers.map((key,j)=>[key,cells[j]]));
    for(const key of headers){
      if(key==="clubIds")assert.deepEqual(divisions[i][key],[]);
      else if(key==="tier"||key==="capacity")assert.equal(divisions[i][key],Number(row[key]),divisions[i].id+"."+key);
      else assert.equal(divisions[i][key],row[key],divisions[i].id+"."+key);
    }
    for(const key of ["primaryHex","secondaryHex","ivoryHex"])
      assert.match(row[key],/^#[0-9A-Fa-f]{6}$/);
    assert.equal(row.secondaryHex,"#243039");
    assert.equal(row.ivoryHex,"#F5F1E8");
  }
});

test("ALLOCATION-01: preserve v1 data and 320 identities; use 16+16+8 national groups",()=>{
  assert.equal(manifest.schema,"football-architect-provisional-division-allocation-v1");
  assert.equal(manifest.status,"provisional");
  assert.equal(manifest.approved,false);
  const verified=validateProvisionalAllocations(manifest,divisions,clubs);
  assert.deepEqual(verified.counts,{total:256,tier1:128,tier2:128,excluded:64,catalog:320});
  assert.equal(verified.approved,false);
  assert.equal(verified.byDivision.size,16);
  for(const division of divisions){
    const roster=verified.byDivision.get(division.id);
    const start=division.tier===1?1:17;
    assert.equal(division.capacity,16);
    assert.equal(roster.length,16);
    assert.deepEqual(roster.map(c=>c.clubId),Array.from({length:16},(_,i)=>start+i));
  }
  assert.equal(clubs.length,320);
  for(const country of countries){
    const national=clubs.filter(c=>c.countryId===country.id);
    assert.equal(national.length,40);
    assert.deepEqual(national.map(c=>c.clubId).sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));
  }
});
test("ALLOCATION-02: invalid memberships, origin and identities fail closed",()=>{
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
  delete corrupt.find(c=>c.countryId==="IT"&&c.clubId===1).primaryName;
  assert.throws(()=>validateProvisionalAllocations(manifest,divisions,corrupt),/Provisional division allocations:/);
});
