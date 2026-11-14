import {loadSeasonOnePreview} from '../tools/load-season-one-preview.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorldCatalog,parseClubId} from '../assets/world-catalog.mjs';
import {loadWorldCatalog} from '../tools/load-world-catalog.mjs';

const languages=['en','de','es','fr','it'];
const nativeLanguage={IT:'it',ENG:'en',ES:'es',DE:'de',FR:'fr',PT:'pt',NL:'nl',BR:'pt'};
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const sources=()=>({
 clubs:load('clubs.json'),
 divisions:load('divisions.json'),
 internationalCompetitions:load('international-competitions.json'),
 provisionalAllocations:loadSeasonOnePreview(),
 rivalries:load('club-rivalries.json'),
 descriptions:load('club-descriptions.i18n.json')
});

test('A01 canonical cardinalities and all-country division, allocation and identity lookups',()=>{
 const source=sources(),catalog=loadWorldCatalog();
 assert.equal(catalog.clubs.length,320);
 assert.equal(catalog.divisions.length,16);
 assert.equal(catalog.competitions.length,18);
 assert.equal(catalog.rivalries.length,352);
 const byCountry=new Map(),allocationFor=new Map();
 for(const division of source.divisions){
  const allocation=source.provisionalAllocations.allocations.find(a=>a.divisionId===division.id);
  assert.ok(allocation,division.id+' provisional membership');
  const members=allocation.clubIds.map(id=>division.countryId+'-'+id);
  assert.equal(catalog.getDivision(division.id)?.tier,division.tier,division.id);
  assert.equal(catalog.getCompetition(division.id),catalog.getDivision(division.id),division.id);
  assert.deepEqual(catalog.getClubsByDivision(division.id).map(c=>c.countryId+'-'+c.clubId),members,division.id);
  assert.equal(catalog.getProvisionalAllocation(division.id)?.approved,false,division.id);
  for(const id of members){
   assert.ok(!allocationFor.has(id),'duplicate active club '+id);
   allocationFor.set(id,division.id);
  }
  byCountry.set(division.countryId,(byCountry.get(division.countryId)||0)+1);
 }
 assert.equal(allocationFor.size,256);
 assert.equal(byCountry.size,8);
 for(const [countryId,divisions] of byCountry){
  assert.equal(divisions,2,countryId);
  assert.deepEqual(catalog.getClubsByCountry(countryId).map(c=>c.clubId),Array.from({length:40},(_,index)=>index+1),countryId);
 }
 let inactive=0;
 for(const reference of source.clubs){
  const id=reference.countryId+'-'+reference.clubId;
  assert.equal(catalog.getClub(id)?.primaryName,reference.primaryName,id);
  assert.deepEqual(parseClubId(id),{countryId:reference.countryId,clubId:reference.clubId},id);
  assert.equal(catalog.getDivisionForClub(id),allocationFor.get(id)??null,id);
  if(!allocationFor.has(id))inactive++;
 }
 assert.equal(inactive,64);
 for(const cup of source.internationalCompetitions)
  assert.equal(catalog.getCompetition(cup.id)?.capacity,cup.capacity,cup.id);
 assert.equal(catalog.getClubsByCountry('XX').length,0);
 for(const invalid of ['int-1','IT-01','IT-0','IT-41','XX-1',null])
  assert.equal(parseClubId(invalid),null,String(invalid));
});

test('A01 all-club localization, bidirectional rivalries and defensive immutability',()=>{
 const source=sources(),catalog=loadWorldCatalog();
 for(const club of source.clubs){
  const id=club.countryId+'-'+club.clubId;
  const expected={...source.descriptions[club.countryId][club.clubId],[nativeLanguage[club.countryId]]:club.description};
  const descriptions=catalog.getDescriptions(id);
  assert.ok(Object.isFrozen(descriptions),id+' descriptions immutable');
  for(const lang of languages){
   assert.equal(catalog.getDescription(id,lang),expected[lang],id+' '+lang);
   assert.ok(expected[lang]?.trim(),id+' '+lang+' must not be blank');
  }
  assert.equal(catalog.getDescription(id,'xx'),null,id);
 }
 for(const rivalry of source.rivalries){
  for(const id of [rivalry.clubAId,rivalry.clubBId])
   assert.ok(catalog.getRivalries(id).some(r=>r.rivalryId===rivalry.rivalryId),id+' reverse rivalry '+rivalry.rivalryId);
 }
 assert.equal(catalog.getRivalries('XX-1').length,0);
 const first=source.clubs[0],id=first.countryId+'-'+first.clubId;
 assert.throws(()=>{catalog.getClub(id).primaryName='mutated'},TypeError);
 assert.throws(()=>{catalog.getClubsByDivision(source.divisions[0].id).push(null)},TypeError);
});

test('A01 rejects duplicate clubs, invalid provisional approval, unknown rivalry and missing translation',()=>{
 let s=sources();s.clubs[1]={...s.clubs[0]};assert.throws(()=>createWorldCatalog(s),/duplicate/);
 s=sources();s.provisionalAllocations.approved=true;assert.throws(()=>createWorldCatalog(s),/provisional/);
 s=sources();s.rivalries[0].clubBId='XX-99';assert.throws(()=>createWorldCatalog(s),/rivalry endpoints/);
 s=sources();
 const club=s.clubs[0],missing=languages.find(lang=>lang!==nativeLanguage[club.countryId]);
 delete s.descriptions[club.countryId][club.clubId][missing];
 assert.throws(()=>createWorldCatalog(s),/missing localization/);
});
