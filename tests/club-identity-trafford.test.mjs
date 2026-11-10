import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Trafford United receives TRA and Tramontana retains unique TRM',()=>{
 const clubs=JSON.parse(load('data/clubs.json'));
 assert.equal(clubs.length,320);
 assert.equal(new Set(clubs.map(c=>c.abbr)).size,320);
 const byId=key=>clubs.find(c=>c.countryId+'-'+c.clubId===key);
 const eng=byId('ENG-2'),it=byId('IT-27');
 assert.deepEqual([eng.primaryName,eng.fullName,eng.compactName,eng.abbr],
  ['Trafford United','Trafford United Football Club','Trafford','TRA']);
 assert.equal(eng.city,'Manchester');
 assert.equal(it.primaryName,'Tramontana Calcio');
 assert.equal(it.abbr,'TRM');
 for(const [key,abbrev] of [['ENG-2','TRA'],['IT-27','TRM']]){
  const club=byId(key);
  assert.equal(clubs.filter(c=>c.abbr===abbrev).length,1);
  assert.ok(load('data/clubs-registry.csv').split('\n').some(row=>row.startsWith(club.countryId+','+club.clubId+',')&&row.includes(','+abbrev+',')));
 }
 const translations=JSON.parse(load('data/club-descriptions.i18n.json')).ENG['2'];
 assert.equal(Object.keys(translations).length,4);
 for(const value of Object.values(translations)){
  assert.ok(value.includes('Trafford United'));
  assert.ok(!value.includes('Medlock United'));
 }
 assert.ok(load('data/club-descriptions.i18n.csv').split('\n').some(row=>row.startsWith('ENG,2,')&&row.includes('Trafford United')&&!row.includes('Medlock United')));
});
