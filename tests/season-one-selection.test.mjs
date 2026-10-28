import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSeasonOneSelection} from '../backend/catalogues/season-one-selection.mjs';
import {loadSeasonOnePreview} from '../tools/load-season-one-preview.mjs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const selection=JSON.parse(readFileSync(new URL('../backend/catalogues/season-1.participants.json',import.meta.url),'utf8'));
test('Season 1 source supplies all 18 canonical competitions while preview remains unapproved',()=>{
 validateSeasonOneSelection(selection);
 const definitions=loadCompetitionCatalogue();
 assert.equal(definitions.length,18);
 for(const binding of selection.bindings){
  const definition=definitions.find(d=>d.id===binding.competitionId);
  assert.ok(definition);assert.equal(binding.clubIds.length,definition.capacity);
 }
 const preview=loadSeasonOnePreview();
 assert.equal(preview.approved,false);assert.equal(selection.productionApproval,false);
 assert.equal(preview.allocations.length,16);
 assert.deepEqual(preview.allocations.find(a=>a.divisionId==='IT-1').clubIds,[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
 assert.deepEqual(selection.bindings.find(b=>b.competitionId==='int-2').clubIds.filter(id=>id.startsWith('IT-')),['IT-4','IT-5','IT-6']);
});
test('Season 1 rejects incomplete, duplicate, synthetic, wrongly scoped and production-labelled input',()=>{
 for(const mutate of [s=>s.season=2,s=>s.productionApproval=true,s=>s.countries[1]='IT',s=>s.bindings.pop(),
  s=>s.bindings[0]=null,s=>s.bindings[1]=s.bindings[0],s=>s.bindings[0].clubIds[0]='IT-33',
  s=>s.bindings[0].clubIds[0]='ENG-1',s=>s.bindings[0].clubIds[0]='IT-2',
  s=>s.bindings[17].clubIds[0]='IT-7',s=>s.bindings[16].clubIds[0]='IT-4',s=>s.bindings[0].approved=true]){
  const corrupt=structuredClone(selection);mutate(corrupt);
  assert.throws(()=>validateSeasonOneSelection(corrupt),/Invalid Season 1/);
 }
});
