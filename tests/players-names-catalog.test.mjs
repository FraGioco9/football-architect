import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COUNTRIES} from '../tools/players-generation-trial.mjs';

const master=JSON.parse(readFileSync(new URL('../data/players/names/catalog-v1.json',import.meta.url),'utf8'));
const FILLED=['ITA','ESP','FRA','USA','SCO','CAN','POL','GER','AUT','SUI','BEL','POR','BRA'];
const banks=Object.fromEntries(FILLED.map(code=>[code,JSON.parse(readFileSync(new URL('../data/players/names/countries/'+code+'.json',import.meta.url),'utf8'))]));
const strict=/^[\p{L}\p{M}]+$/u;
const sourceIds={
 ITA:'it-admin-register-male-names',
 ESP:'es-ine-residents-male-names',
 FRA:'fr-insee-male-births-2000-2025',
 USA:'us-ssa-male-births-2016-2020',
 SCO:'gb-nrs-scotland-male-births-2000-2025',
 CAN:'ca-statcan-male-births-2000-2025',
 POL:'pl-gov-pesel-first-male-names-2025',
 GER:'de-berlin-first-male-births-2023',
 AUT:'at-statistikaustria-first-male-births-2010-2025',
 SUI:'ch-bfs-resident-male-birth-cohorts-2000-2025',
 BEL:'be-statbel-male-births-2000-2025',
 POR:'pt-registered-male-first-names-2014',
 BRA:'br-ibge-census-2022-male-first-names'
};

test('frozen 50 FIFA codes, exactly 13 saved banks of 300 and 37 empty banks',()=>{
 assert.equal(master.schema_version,3);
 assert.equal(master.countries.length,50);
 assert.deepEqual(master.countries.map(x=>x.code),COUNTRIES.map(x=>x.code));
 assert.equal(master.source_registry.length,FILLED.length);
 assert.equal(master.policy.target_male_given_names_per_country,300);
 assert.equal(master.policy.current_collected_given_names,3900);
 assert.equal(master.policy.current_approved_given_names,0);
 assert.match(master.policy.first_name_format,/one first name/i);
 assert.match(master.policy.origin_rule,/NOT REQUIRED/);
 assert.equal(master.countries.filter(x=>x.given_name_count===300).length,13);
 assert.equal(master.countries.filter(x=>x.given_name_count===0).length,37);
 for(const country of master.countries){
  assert.deepEqual(country.given_names,[]);
  assert.equal(country.production_ready,false);
  if(FILLED.includes(country.code)){
   assert.equal(country.external_file,'countries/'+country.code+'.json');
   assert.equal(country.name_format,'single_first_name_only');
   assert.equal(country.given_name_count,300);
   assert.deepEqual(country.name_source_ids,[sourceIds[country.code]]);
  }else{
   assert.equal(country.given_name_count,0);
   assert.equal(country.name_source_ids.length,0);
   assert.ok(!('external_file' in country));
  }
 }
 const ids=master.source_registry.map(s=>s.id);
 assert.equal(new Set(ids).size,13);
 for(const code of FILLED){
  const meta=master.source_registry.find(s=>s.code===code);
  assert.equal(meta.id,sourceIds[code]);
  assert.equal(meta.external_file,'countries/'+code+'.json');
 }
});

test('each of 13 country files contains exactly 300 distinct SINGLE-word male names',()=>{
 for(const code of FILLED){
  const bank=banks[code];
  assert.equal(bank.schema_version,2);
  assert.equal(bank.code,code);
  assert.equal(bank.name_format,'single_first_name_only_no_spaces_hyphens_apostrophes');
  assert.equal(bank.production_ready,false);
  assert.equal(bank.origin_review,'not_required_by_owner');
  assert.equal(bank.source.id,sourceIds[code]);
  assert.ok(bank.source.source_url.startsWith('https://'));
  assert.ok(bank.source.metric.length>15);
  assert.deepEqual(bank.surnames,[]);
  assert.equal(bank.given_names.length,300);
  assert.ok(!('last_name' in bank));
  const seen=new Set();
  for(const [i,n] of bank.given_names.entries()){
   assert.equal(typeof n.value,'string');
   assert.equal(n.value,n.value.trim());
   assert.equal(n.value,n.value.normalize('NFC'));
   assert.match(n.value,strict,code+' compound or punctuation: '+n.value);
   assert.ok(Number.isSafeInteger(n.weight)&&n.weight>0,code+' non-positive source weight');
   if(i)assert.ok(n.weight<=bank.given_names[i-1].weight,code+' ranking disorder');
   const key=n.value.toLocaleLowerCase('und');
   assert.ok(!seen.has(key),code+' duplicate '+n.value);
   seen.add(key);
  }
  assert.equal(seen.size,300);
 }
});

test('known formerly invalid compound forms cannot return; accents and unrestricted origins remain accepted',()=>{
 for(const code of FILLED){
  for(const name of ['Francesco Antonio','Jose Antonio','Jean-Pierre','Mohamed-Amine','John Paul','Michał Jan']){
   assert.ok(!banks[code].given_names.some(x=>x.value===name),code+' compound recurred');
  }
 }
 assert.ok(banks.FRA.given_names.some(x=>x.value==='Léo'));
 assert.ok(banks.POL.given_names.some(x=>x.value==='Stanisław'));
 assert.ok(banks.SCO.given_names.some(x=>x.value==='Muhammad'));
 assert.ok(banks.CAN.given_names.some(x=>x.value==='Mohamed'));
 assert.ok(banks.USA.given_names.some(x=>x.value==='Iker'));
 assert.equal(banks.FRA.source.source_csv_sha256,'5ec80c06cd9266cc5680885c6a219148bcdfaa53d65086f4ea9d2c584431fbfd');
 assert.equal(banks.SCO.source.source_zip_sha256,'e1dd892b576f75cc349caeee7a219aa9fad3857b1849bc2ce21bfd81c24b3085');
 assert.equal(banks.CAN.source.source_zip_sha256,'c2c4a0b9c40c1116bf4229b97ae0680af4ffdd3721834533c31d4145ed56f420');
 assert.equal(banks.POL.source.source_csv_sha256,'447f64ad7008f7960341710322d4f4d20e928129753f9469a10abc593da92beb');
 assert.equal(banks.GER.source.source_sha256,'327431daf6854268dce647fb6cdea6fe6f994dd67c60e95ba8b691c43dd44480');
 assert.equal(banks.AUT.source.source_csv_sha256,'49c277575ff669e5a7b670d759ec17d033e9c079aa802e3a096a0640b6756a6c');
 assert.equal(banks.SUI.source.source_csv_sha256,'75f8d1d00f7c0a73b7ad3f149bb39596fee295773ff0416e98b63006e375f66f');
 assert.equal(banks.BEL.source.source_xlsx_sha256,'eb33415f0c1a488d3e0978e6a8b0b3f06e32a9fe3ac3038edeafc6c7f4dc03a1');
 assert.equal(banks.POR.source.source_file_sha256,'b14ac2d593a95955946af6df6d35befc905ee2ec6708219a6e4e38fd9131cd85');
 assert.equal(banks.BRA.source.source_parquet_sha256,'91518f2d0d1da8e438ab9f557127da06633e186914aecb717f1bbf7bfb6b2943');
 assert.ok(banks.POR.given_names.some(x=>x.value==='João'));
 assert.ok(banks.BRA.given_names.some(x=>x.value==='jose'));
});
