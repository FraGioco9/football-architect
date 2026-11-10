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
 assert.equal(eng.stadiumName,'Foundry Park');
 assert.equal(eng.nickname,'The Foundrymen');
 assert.equal(eng.description,"Trafford United draws its identity from Manchester's industrial heritage, where foundries, workshops and working communities helped shape the city's character. Foundry Park stands as a symbol of craftsmanship, determination and collective effort. Rooted in a culture of resilience and solidarity, the club carries the spirit of its industrial origins onto the football pitch.");
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

test('Foundry Park and Trafford United propagate to rivalry data and published snapshots',()=>{
 const clubs=JSON.parse(load('data/clubs.json'));
 const eng=clubs.find(c=>c.countryId==='ENG'&&c.clubId===2);
 const csvLine=load('data/clubs-registry.csv').split('\n').find(row=>row.startsWith('ENG,2,'));
 assert.equal(eng.stadiumName,'Foundry Park');
 assert.equal(eng.city,'Manchester');
 assert.ok(csvLine.includes(',Foundry Park'));
 const rivals=JSON.parse(load('data/club-rivalries.json')).filter(r=>r.clubAId==='ENG-2'||r.clubBId==='ENG-2');
 assert.equal(rivals.length,3);
 assert.ok(rivals.every(r=>(r.clubAId!=='ENG-2'||r.clubAName==='Trafford United')&&(r.clubBId!=='ENG-2'||r.clubBName==='Trafford United')));
 assert.ok(!load('data/club-rivalries.csv').includes('Medlock United'));
 const clubManifest=JSON.parse(load('clubs/_shared/manifest.json'));
 const club=clubManifest.clubs.find(c=>c.countryId==='ENG'&&c.clubId===2);
 assert.equal(club.primaryName,'Trafford United');
 assert.equal(club.stadiumName,'Foundry Park');
 assert.equal(club.city,'Manchester');
 assert.equal(clubManifest.clubs.find(c=>c.countryId==='IT'&&c.clubId===27).abbr,'TRM');
 const competitions=JSON.parse(load('competitions/_shared/manifest.json'));
 const entries=competitions.divisions.flatMap(d=>d.clubs||[]);
 assert.equal(entries.find(c=>c.countryId==='ENG'&&c.clubId===2).stadiumName,'Foundry Park');
 assert.equal(entries.find(c=>c.countryId==='IT'&&c.clubId===27).abbr,'TRM');
 // Identity is fetched from the shared manifest, not embedded in generated HTML.
 for(const htmlPath of ['clubs/_shared/index.html','clubs/index.html','competitions/eng-1/index.html']){
  const html=load(htmlPath);
  assert.ok(!html.includes('Trafford United'),htmlPath+' must wait for catalog hydration');
  assert.ok(!html.includes('Medlock United'),htmlPath+' must not preload the superseded name');
 }
});

test('ENG-2 owner-approved nickname and description match all sources and four translations',()=>{
 const clubs=JSON.parse(load('data/clubs.json'));
 const eng=clubs.find(c=>c.countryId==='ENG'&&c.clubId===2);
 const csv=load('data/clubs-registry.csv').split('\n').find(l=>l.startsWith('ENG,2,'));
 assert.ok(csv.includes(',The Foundrymen,'));
 assert.ok(csv.includes(eng.description));
 const translations=JSON.parse(load('data/club-descriptions.i18n.json')).ENG['2'];
 assert.deepEqual(Object.keys(translations),['de','es','fr','it']);
 for(const [lang,copy] of Object.entries(translations)){
  assert.ok(copy.includes('Trafford United'),lang);
  assert.ok(copy.includes('Foundry Park'),lang);
  assert.ok(copy.length>260,lang);
  const i18nCsv=load('data/club-descriptions.i18n.csv').split('\n').find(row=>row.startsWith('ENG,2,'));
  assert.ok(i18nCsv.includes(copy),lang);
 }
 const manifest=JSON.parse(load('clubs/_shared/manifest.json'));
 const club=manifest.clubs.find(c=>c.countryId==='ENG'&&c.clubId===2);
 assert.equal(club.nickname,eng.nickname);
 assert.equal(club.description,eng.description);
 assert.deepEqual(club.descriptions,{...translations,en:eng.description});
 assert.equal(club.city,'Manchester');
 assert.equal(club.stadiumName,'Foundry Park');
});


test('Trafford directory first paint is anonymous and client search uses catalog identities',()=>{
 const html=load('clubs/index.html');
 const client=load('assets/clubs-directory.js');
 const manifest=JSON.parse(load('clubs/_shared/manifest.json'));
 const trafford=manifest.clubs.find(c=>c.countryId==='ENG'&&c.clubId===2);
 assert.equal(trafford.primaryName,'Trafford United');
 assert.equal(trafford.fullName,'Trafford United Football Club');
 assert.equal((html.match(/class="nav01-card nav01-skeleton-card"/g)||[]).length,6,'six reserved anonymous cards');
 assert.equal((html.match(/<a class="nav01-card"/g)||[]).length,0,'no 320 prerendered clubs');
 assert.ok(!html.includes('Trafford United'),'no name before manifest');
 assert.ok(!html.includes('Medlock United'),'no obsolete name');
 assert.match(client,/m\.clubs\.map\(c=>\[c,normalizeSearch\(\[c\.primaryName,c\.fullName,c\.city\]/,'search index built from fetched catalog');
 assert.match(client,/a\.primaryName\.localeCompare\(b\.primaryName/,'fetched cards are sorted alphabetically');
});
