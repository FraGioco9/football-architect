import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorldCatalog,parseClubId} from '../assets/world-catalog.mjs';
import {loadWorldCatalog} from '../tools/load-world-catalog.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const sources=()=>({clubs:load('clubs.json'),divisions:load('divisions.json'),internationalCompetitions:load('international-competitions.json'),provisionalAllocations:load('division-allocations.provisional.json'),rivalries:load('club-rivalries.json'),descriptions:load('club-descriptions.i18n.json')});
test('A01 canonical cardinalities and namespace separation',()=>{
 const c=loadWorldCatalog();
 assert.equal(c.clubs.length,320);assert.equal(c.divisions.length,16);assert.equal(c.competitions.length,18);assert.equal(c.rivalries.length,352);
 assert.equal(c.getClub('IT-1').primaryName,'AC Meneghina');
 assert.equal(c.getDivision('IT-1').tier,1);
 assert.equal(c.getCompetition('int-1').capacity,24);
 assert.equal(c.getClubsByCountry('IT').length,40);
 assert.equal(c.getClubsByDivision('IT-1').length,16);
 assert.equal(c.getDivisionForClub('IT-33'),null);
 assert.equal(c.getProvisionalAllocation('IT-1').approved,false);
 assert.equal(c.getRivalries('IT-1').length,3);
 assert.deepEqual(parseClubId('ENG-40'),{countryId:'ENG',clubId:40});
 assert.equal(parseClubId('int-1'),null);assert.equal(parseClubId('IT-01'),null);
});
test('A01 localization, reverse relations, defensive immutability',()=>{
 const c=loadWorldCatalog(),r=c.getRivalries('IT-1')[0];
 assert.ok(c.getRivalries(r.clubBId).some(other=>other.rivalryId===r.rivalryId));
 for(const lang of ['en','de','es','fr','it'])assert.ok(c.getDescription('IT-1',lang));
 assert.equal(c.getDescription('IT-1','xx'),null);
 assert.throws(()=>{c.getClub('IT-1').primaryName='mutated'},TypeError);
 assert.throws(()=>{c.getClubsByDivision('IT-1').push(null)},TypeError);
});
test('A01 rejects duplicate clubs, invalid provisional approval, unknown rivalry, missing translation',()=>{
 let s=sources();s.clubs[1]={...s.clubs[0]};assert.throws(()=>createWorldCatalog(s),/duplicate/);
 s=sources();s.provisionalAllocations.approved=true;assert.throws(()=>createWorldCatalog(s),/provisional/);
 s=sources();s.rivalries[0].clubBId='IT-99';assert.throws(()=>createWorldCatalog(s),/rivalry endpoints/);
 s=sources();delete s.descriptions.IT['1'].en;assert.throws(()=>createWorldCatalog(s),/missing localization/);
});
