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
 const byId=new Map(canonical.map(c=>[id(c),c]));
 assert.deepEqual([byId.get('NL-22').primaryColor,byId.get('NL-22').secondaryColor],['#194979','#D4B46F']);
 assert.deepEqual([byId.get('ENG-2').primaryColor,byId.get('ENG-2').secondaryColor],['#882E2D','#F5F1E9']);
 assert.equal(byId.get('ENG-2').primaryName,'Trafford United');
 assert.equal(byId.get('ENG-2').nickname,'The Foundrymen');
 assert.equal(byId.get('IT-27').abbr,'TRM');
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
