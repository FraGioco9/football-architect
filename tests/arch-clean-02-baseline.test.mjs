import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const json=path=>JSON.parse(read(path).toString('utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const clubs=json('data/clubs.json');
const divisions=json('data/divisions.json');
const cups=json('data/international-competitions.json');
const allocations=json('data/division-allocations.provisional.json');
const rivalries=json('data/club-rivalries.json');
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];

test('ARCH-CLEAN-02 baseline: canonical identity and provisional membership cardinalities',()=>{
  assert.equal(clubs.length,320);
  assert.equal(new Set(clubs.map(c=>c.countryId+'-'+c.clubId)).size,320);
  assert.equal(divisions.length,16);
  assert.equal(cups.length,2);
  assert.equal(new Set([...divisions,...cups].map(c=>c.id)).size,18);
  for(const country of countries){
    assert.deepEqual(clubs.filter(c=>c.countryId===country).map(c=>c.clubId).sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));
    assert.equal(divisions.filter(d=>d.countryId===country).length,2);
  }
  assert.equal(allocations.status,'provisional');
  assert.equal(allocations.approved,false);
  assert.equal(allocations.allocations.length,16);
  assert.equal(allocations.allocations.reduce((sum,a)=>sum+a.clubIds.length,0),256);
  const ids=new Set();
  for(const allocation of allocations.allocations){
    const d=divisions.find(x=>x.id===allocation.divisionId);
    assert.ok(d);
    assert.equal(allocation.clubIds.length,16);
    for(const id of allocation.clubIds)assert.equal(ids.has(d.countryId+'-'+id),false),ids.add(d.countryId+'-'+id);
  }
  assert.equal(ids.size,256);
  assert.equal(clubs.filter(c=>!ids.has(c.countryId+'-'+c.clubId)).length,64);
});

test('ARCH-CLEAN-02 baseline: rivalry identities and cross-border coverage',()=>{
  assert.equal(rivalries.length,352);
  const members=new Set(clubs.map(c=>c.countryId+'-'+c.clubId));
  const pairs=new Set();
  for(const r of rivalries){
    assert.ok(members.has(r.clubAId)&&members.has(r.clubBId));
    assert.notEqual(r.clubAId,r.clubBId);
    const pair=[r.clubAId,r.clubBId].sort().join('__');
    assert.equal(pairs.has(pair),false);
    pairs.add(pair);
  }
  assert.equal(rivalries.filter(r=>r.clubAId.split('-')[0]!==r.clubBId.split('-')[0]).length,4);
});

test('ARCH-CLEAN-02 baseline: approved rule profiles and round totals',()=>{
  const definitions=loadCompetitionCatalogue();
  assert.equal(definitions.length,18);
  assert.equal(definitions.filter(c=>c.rules.version==='domestic-top-v1').length,8);
  assert.equal(definitions.filter(c=>c.rules.version==='domestic-second-v1').length,8);
  assert.equal(definitions.filter(c=>c.rules.version==='international-int24-v1').length,2);
  for(const c of definitions){
    if(c.category==='domestic'){
      assert.equal(c.capacity,16);
      assert.equal(c.metrics.phases.league.rounds,30);
      assert.equal(c.metrics.phases.league.matches,240);
    }else{
      assert.equal(c.capacity,24);
      assert.equal(c.metrics.phases.league.matches,72);
      assert.equal(c.metrics.totalMatches,93);
    }
  }
});

test('ARCH-CLEAN-02 baseline: input files are readable and independently fingerprintable',()=>{
  for(const path of ['data/clubs.json','data/divisions.json','data/international-competitions.json','data/division-allocations.provisional.json','data/club-rivalries.json','data/club-descriptions.i18n.json','vercel.json']){
    assert.match(digest(read(path)),/^[0-9a-f]{64}$/);
  }
});
