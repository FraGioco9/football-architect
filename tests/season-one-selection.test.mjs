import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSeasonOneSelection} from '../backend/catalogues/season-one-selection.mjs';
import {loadSeasonOnePreview} from '../tools/load-season-one-preview.mjs';
import {loadCompetitionCatalogue} from '../tools/competition-catalogue.mjs';
const selection=JSON.parse(readFileSync(new URL('../backend/catalogues/season-1.participants.json',import.meta.url),'utf8'));
test('Season 1 preview projects all domestic bindings and international quotas without approval',()=>{
 validateSeasonOneSelection(selection);
 const definitions=loadCompetitionCatalogue();
 assert.equal(definitions.length,18);
 const byId=new Map(selection.bindings.map(binding=>[binding.competitionId,binding]));
 assert.equal(byId.size,18,'unique competition IDs');
 for(const definition of definitions){
  const binding=byId.get(definition.id);
  assert.ok(binding,'missing '+definition.id);
  assert.equal(binding.clubIds.length,definition.capacity,definition.id+' capacity');
 }
 const preview=loadSeasonOnePreview();
 assert.equal(preview.approved,false);
 assert.equal(selection.productionApproval,false);
 assert.equal(preview.allocations.length,16);
 const allocations=new Map(preview.allocations.map(row=>[row.divisionId,row]));
 assert.equal(allocations.size,16);
 for(const definition of definitions.filter(item=>item.category==='domestic')){
  const source=byId.get(definition.id);
  const projection=allocations.get(definition.id);
  assert.ok(source&&projection,'missing domestic preview '+definition.id);
  const expected=source.clubIds.map(id=>Number(id.split('-')[1])).sort((a,b)=>a-b);
  assert.deepEqual(projection.clubIds,expected,definition.id+' preview matches approved initial selection');
 }
 for(const [cupId,from] of [['int-1',0],['int-2',3]]){
  const expected=selection.countries.flatMap(country=>
   byId.get(country+'-1').clubIds.slice(from,from+3));
  assert.deepEqual(byId.get(cupId).clubIds,expected,cupId+' national quota uses initial top-tier table');
 }
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
