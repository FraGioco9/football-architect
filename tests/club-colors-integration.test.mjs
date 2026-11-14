// CLUB-COLORS-INTEGRATION — owner-approved palettes from GitHub issue #466.
// Deliberately pin the normalized 320-club palette fingerprint; future color
// changes require a separately approved update to this fingerprint.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const canonical=JSON.parse(read('data/clubs.json'));
const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
const expectedFingerprint='4e6974b2cd53e4403f3293bbdc9a7cbcf384bedc1f8a0d705b292b376d98a33c';
const fields=['countryId','clubId','city','primaryName','fullName','compactName','abbr','nickname','description','primaryColor','secondaryColor','stadiumName'];
const id=club=>club.countryId+'-'+club.clubId;

function csvRecords(input){
 const records=[];let row=[],cell='',inQuotes=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){
   if(inQuotes&&input[i+1]==='"'){cell+='"';i++}
   else inQuotes=!inQuotes;
  }else if(c===','&&!inQuotes){row.push(cell);cell=''}
  else if((c==='\r'||c==='\n')&&!inQuotes){
   if(c==='\r'&&input[i+1]==='\n')i++;
   row.push(cell);cell='';
   if(row.some(x=>x!==''))records.push(row);
   row=[];
  }else cell+=c;
 }
 assert.equal(inQuotes,false,'unterminated CSV quote');
 if(row.length||cell!==''){row.push(cell);records.push(row)}
 return records;
}

test('CLUB-COLORS: JSON and CSV agree on all 320 club records and fields',()=>{
 const records=csvRecords(read('data/clubs-registry.csv'));
 assert.deepEqual(records[0],fields);
 assert.equal(canonical.length,320);
 assert.equal(records.length,321);
 const byId=new Map(canonical.map(c=>[id(c),c]));
 assert.equal(byId.size,320,'club identities remain unique');
 for(const row of records.slice(1)){
  assert.equal(row.length,fields.length,'CSV column count');
  const club=byId.get(row[0]+'-'+row[1]);
  assert.ok(club,'CSV identity exists');
  for(let i=0;i<fields.length;i++)assert.equal(row[i],String(club[fields[i]]),id(club)+' '+fields[i]);
 }
 for(const c of canonical){
  assert.match(c.primaryColor,/^#[0-9A-F]{6}$/);
  assert.match(c.secondaryColor,/^#[0-9A-F]{6}$/);
 }
});

test('CLUB-COLORS: official catalog matches the 320 owner-approved color fingerprint',()=>{
 const payload=canonical.map(c=>id(c)+','+c.primaryColor+','+c.secondaryColor).sort().join('\n')+'\n';
 const sha256=createHash('sha256').update(payload,'utf8').digest('hex');
 assert.equal(sha256,expectedFingerprint,'approved palette fingerprint from issue #466');

});

test('CLUB-COLORS: hydrated club-page manifest reproduces canonical palette and identities',()=>{
 assert.equal(manifest.clubs.length,320);
 const derived=new Map(manifest.clubs.map(c=>[id(c),c]));
 assert.equal(derived.size,320);
 for(const c of canonical){
  const m=derived.get(id(c));
  assert.ok(m,'manifest missing '+id(c));
  for(const field of fields)assert.deepEqual(m[field],c[field],id(c)+' manifest '+field);
 }
});

test('CLUB-CATALOG: rivalry names and references agree across the full published catalog',()=>{
 const source=JSON.parse(read('data/club-rivalries.json'));
 const byId=new Map(canonical.map(club=>[id(club),club]));
 const columns=['rivalryId','clubAId','clubAName','clubBId','clubBName','derbyName','type'];
 const rows=csvRecords(read('data/club-rivalries.csv'));
 assert.deepEqual(rows[0].map(value=>value.replace(/^\uFEFF/,'')),columns);
 assert.equal(rows.length,source.length+1,'one CSV row per rivalry');
 assert.deepEqual(manifest.rivalries,source,'published rivalries match the canonical source');
 const csvById=new Map(rows.slice(1).map(row=>[row[0],row]));
 assert.equal(csvById.size,source.length,'rivalry identifiers must be unique');
 for(const rivalry of source){
  const a=byId.get(rivalry.clubAId),b=byId.get(rivalry.clubBId);
  assert.ok(a&&b,'unknown rivalry endpoint: '+rivalry.rivalryId);
  assert.equal(rivalry.clubAName,a.primaryName,rivalry.rivalryId+' A display name');
  assert.equal(rivalry.clubBName,b.primaryName,rivalry.rivalryId+' B display name');
  assert.deepEqual(csvById.get(rivalry.rivalryId),columns.map(column=>String(rivalry[column])),
   rivalry.rivalryId+' CSV must agree with JSON');
 }
});

test('CLUB-CATALOG: all translated descriptions agree across CSV, JSON and public manifests',()=>{
 const translations=JSON.parse(read('data/club-descriptions.i18n.json'));
 const rows=csvRecords(read('data/club-descriptions.i18n.csv'));
 const languages=['en','de','es','fr','it'];
 assert.deepEqual(rows[0].map(value=>value.replace(/^\uFEFF/,'')),['countryId','clubId',...languages]);
 assert.equal(rows.length,canonical.length+1,'one translation record per club');
 const byId=new Map(canonical.map(club=>[id(club),club]));
 const published=new Map(manifest.clubs.map(club=>[id(club),club]));
 const seen=new Set();
 for(const row of rows.slice(1)){
  assert.equal(row.length,7,'translation CSV columns');
  const key=row[0]+'-'+row[1];
  assert.ok(!seen.has(key),'duplicate translation row: '+key);
  seen.add(key);
  const club=byId.get(key),derived=published.get(key);
  const localized=translations[row[0]]?.[row[1]];
  assert.ok(club&&derived&&localized,'unknown translation identity: '+key);
  for(const [offset,lang] of languages.entries()){
   const text=localized[lang];
   assert.equal(row[offset+2],text??'',key+' / '+lang+' CSV parity');
   if(text!==undefined)assert.ok(typeof text==='string'&&text.trim(),key+' / '+lang+' has content');
   assert.equal(derived.descriptions[lang],text??club.description,key+' / '+lang+' public fallback');
  }
 }
 assert.equal(seen.size,canonical.length,'every club has exactly one translation row');
});
