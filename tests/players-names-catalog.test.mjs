import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COUNTRIES} from '../tools/players-generation-trial.mjs';

const master=JSON.parse(readFileSync(new URL('../data/players/names/catalog-v1.json',import.meta.url),'utf8'));
const FILLED=['ITA','ESP','FRA','USA','SCO','CAN','POL','GER','AUT','SUI','BEL','POR','BRA','NED','DEN','NOR','SWE','CRO','SRB','HUN','RUS','URU','PAR','ECU','VEN','UKR','SVK','PAN','ARG','MEX','COL','CHI','MAR','ALG','EGY','IRN'];
const banks=Object.fromEntries(FILLED.map(code=>[code,JSON.parse(readFileSync(new URL('../data/players/names/countries/'+code+'.json',import.meta.url),'utf8'))]));
const latinLetter=/^\p{Script=Latin}$/u;
const unicodeMark=/^\p{M}$/u;
const latinMarkExtension=/^\p{Script_Extensions=Latin}$/u;
function isSingleLatinGivenName(name){
 if(typeof name!=='string'||!name||name!==name.normalize('NFC'))return false;
 let seenLatinBase=false;
 for(const char of name){
  if(latinLetter.test(char)){seenLatinBase=true;continue;}
  if(seenLatinBase&&unicodeMark.test(char)&&latinMarkExtension.test(char))continue;
  return false;
 }
 return seenLatinBase;
}
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
 BRA:'br-ibge-census-2022-male-first-names',
 NED:'nl-svb-boys-birth-names-2025',
 DEN:'dk-statistics-denmark-male-residents-archived',
 NOR:'no-ssb-male-resident-names-2021-archived',
 SWE:'se-scb-boys-birth-usual-names-2000-2020',
 CRO:'forebears-croatia-male-forenames-incidence',
 SRB:'forebears-serbia-male-forenames-incidence',
 HUN:'forebears-hungary-male-forenames-incidence',
 RUS:'ru-sorokinpf-russian-male-names-pinned',
 URU:'uy-montevideo-registered-birth-male-names-1940-2012',
 PAR:'py-damegender-wikidata-male-given-name-sample',
 ECU:'ec-damegender-wikidata-male-given-name-sample',
 VEN:'ve-damegender-wikidata-male-given-name-sample',
 UKR:'ua-languk-ubertext-firstnames-male-lemma',
 SVK:'forebears-slovakia-male-firstname-incidence',
 PAN:'forebears-panama-male-firstname-incidence',
 ARG:'ar-sicytar-male-personnel-damegender-2019',
 MEX:'mx-sep-male-federal-education-personnel-2012',
 COL:'co-wikidata-male-colombian-biographies-damegender',
 CHI:'cl-registro-civil-male-birth-names-2000-2021-guaguas',
 MAR:'ma-wikidata-male-citizens-explicit-given-name-p735-2026',
 ALG:'dz-aldjia-algerian-male-first-name-registry',
 EGY:'eg-afify-male-given-token-frequency',
 IRN:'ir-wikidata-male-citizens-explicit-given-name-p735-2026'
};

test('frozen 50 FIFA codes, exactly 36 saved banks of 300 and 14 empty banks',()=>{
 assert.equal(master.schema_version,3);
 assert.equal(master.countries.length,50);
 assert.deepEqual(master.countries.map(x=>x.code),COUNTRIES.map(x=>x.code));
 assert.equal(master.source_registry.length,FILLED.length);
 assert.equal(master.policy.target_male_given_names_per_country,300);
 assert.equal(master.policy.current_collected_given_names,10800);
 assert.equal(master.policy.current_approved_given_names,0);
 assert.match(master.policy.first_name_format,/one (?:male )?first (?:given )?name/i);
 assert.match(master.policy.first_name_format,/Script=Latin/);
 assert.match(master.policy.origin_rule,/NOT REQUIRED/);
 assert.equal(master.countries.filter(x=>x.given_name_count===300).length,36);
 assert.equal(master.countries.filter(x=>x.given_name_count===0).length,14);
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
 assert.equal(new Set(ids).size,36);
 for(const code of FILLED){
  const meta=master.source_registry.find(s=>s.code===code);
  assert.equal(meta.id,sourceIds[code]);
  assert.equal(meta.external_file,'countries/'+code+'.json');
 }
});

test('each of 36 country files contains exactly 300 distinct SINGLE-word male names',()=>{
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
   assert.ok(isSingleLatinGivenName(n.value),code+' non-Latin, compound, or punctuation: '+n.value);
   assert.ok(Number.isSafeInteger(n.weight)&&n.weight>0,code+' non-positive source weight');
   if(i)assert.ok(n.weight<=bank.given_names[i-1].weight,code+' ranking disorder');
   const key=n.value.toLocaleLowerCase('und');
   assert.ok(!seen.has(key),code+' duplicate '+n.value);
   seen.add(key);
  }
  assert.equal(seen.size,300);
 }
});

test('Unicode Latin-only validator rejects mixed scripts, unsupported marks and compound names',()=>{
 for(const name of ['à','é','ü','ñ','ç','ğ','ı','ł','č','š','ž','João','Bjørn','László','İsmail','Aleksandr']){
  assert.ok(isSingleLatinGivenName(name),'valid Latin name rejected: '+name);
 }
 for(const name of ['Александр','Νίκος','محمد','太郎','민준','Ivаn','JohnΑ','Jean-Pierre','José Luis',"D'Angelo",'','42','A\u0483','A\u3099','A\u20DD','A\u0301']){
  assert.equal(isSingleLatinGivenName(name),false,'non-Latin/invalid accepted: '+JSON.stringify(name));
 }
});

test('Batch F sources preserve 300 Latin male given names and documented non-official source limitations',()=>{
 for(const code of ['CRO','SRB','HUN']){
  assert.match(banks[code].source.id,/^forebears-/);
  assert.match(banks[code].source.metric,/ESTIMATES/);
  assert.match(banks[code].source.license,/review/i);
 }
 assert.equal(banks.RUS.source.source_csv_git_blob_sha,'6287fea8e12814bedb3d7dff8d0fb4fba119f587');
 assert.match(banks.RUS.source.romanization_convention,/BGN\/PCGN/);
 assert.equal(banks.RUS.source.output_script,'Latin (ASCII A-Z)');
 assert.ok(banks.RUS.given_names.every(e=>/^[A-Za-z]+$/.test(e.value)));
 for(const [value,weight] of [['Akram',105],['Takhir',104],['Feodosiy',104]]){
  assert.ok(banks.RUS.given_names.some(e=>e.value===value&&e.weight===weight));
 }
 assert.ok(banks.CRO.given_names.some(e=>e.value==='Željko'));
 assert.ok(banks.SRB.given_names.some(e=>e.value==='Dušan'));
 assert.ok(banks.HUN.given_names.some(e=>e.value==='László'));
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
 assert.ok(banks.NED.given_names.some(x=>x.value==='Daniël'));
 assert.ok(banks.NOR.given_names.some(x=>x.value==='Bjørn'));
 assert.ok(banks.SWE.given_names.some(x=>x.value==='Måns'));
 assert.ok(banks.DEN.given_names.some(x=>x.value==='Jens'));
 assert.equal(banks.DEN.source.upstream_source_blob_sha,'5a9bf5624a13e77bef9ffad5cd25566ed7190e97');
 assert.equal(banks.NOR.source.upstream_source_blob_sha,'a017d7db55d8870d9b764e623aa81ebdfd4304f1');
 assert.equal(banks.SWE.source.upstream_source_blob_sha,'b5538dee93afc1e0e0d1901f17dfe3258162a5f2');
});

test('Batch J country records preserve source identity and research-only limitations',()=>{
 const originalBlobs={URU:'5e9a37896be5e4e96fe263eba89fd8be165d8856',PAR:'4d085b8ea56a90e1eddb1fee43eebfdadc509451',ECU:'3a35c429bcc40039d097bfee23223896bb91a1d2',VEN:'46c389a636e54ab89612f5ad4da899f490b05ee0'};
 for(const code of ['URU','PAR','ECU','VEN']){
  const bank=banks[code];
  assert.equal(bank.source.upstream_commit,'65ee149ce9da0be2c388b7c3ea62f79709e5336b');
  assert.equal(bank.source.upstream_blob_sha,originalBlobs[code]);
  assert.ok(bank.source.source_mirror_url.includes('65ee149c'));
  assert.equal(bank.given_names.length,300);
  assert.equal(bank.production_ready,false);
 }
 assert.match(banks.URU.source.metric,/1940-2012/);
 assert.match(banks.URU.source.geographic_scope,/Montevideo/);
 assert.ok(!banks.URU.given_names.some(x=>x.value.toLowerCase()==='maria'));
 for(const code of ['PAR','ECU','VEN']){
  assert.match(banks[code].source.metric,/not population or births/);
  assert.match(banks[code].source.quality_warning,/not be trusted as representative statistics/);
  assert.match(banks[code].cohort,/biographical sample/);
 }
});

test('Batch K preserves three source-backed research-only Latin pools, with non-birth limitations',()=>{
 for(const code of ['UKR','SVK','PAN']){
  const bank=banks[code];
  assert.equal(bank.given_names.length,300);
  assert.equal(bank.production_ready,false);
  assert.deepEqual(bank.surnames,[]);
  assert.ok(bank.given_names.every(item=>isSingleLatinGivenName(item.value)));
  assert.ok(bank.source.license.length>20);
 }
 assert.match(banks.UKR.source.metric,/corpus/i);
 assert.match(banks.UKR.source.metric,/NOT official census\/birth/i);
 assert.match(banks.UKR.transliteration,/Resolution No\. 55/);
 assert.match(banks.UKR.source.transliteration_standard_url,/2010/);
 for(const code of ['SVK','PAN']){
  assert.match(banks[code].source.metric,/estimated incidence/i);
  assert.match(banks[code].source.metric,/NOT exact population register counts or newborn registrations/i);
  assert.match(banks[code].source.license,/licen[cs]/i);
 }
 assert.ok(banks.SVK.given_names.some(x=>x.value==='Štefan'));
 assert.ok(banks.UKR.given_names.some(x=>x.value==='Volodymyr'));
});

test('Batch D: ARG/MEX/COL/CHI source pins and research-only cohort limits',()=>{
 const pinned={
  ARG:'5416f2e019a077e497811d2b28dc597dd9b2819b',
  MEX:'2e605dbbdf28ca28cea02172b61359a37f9b924b',
  COL:'7fe0ec3a602aa85ddde713fc065a54eaf68e24e7',
  CHI:'dd0049fb440703be03312699afd6010ffcb206f6'
 };
 for(const code of ['ARG','MEX','COL','CHI']){
  const bank=banks[code];
  assert.equal(bank.given_names.length,300);
  assert.equal(bank.production_ready,false);
  assert.deepEqual(bank.surnames,[]);
  assert.equal(bank.source.source_csv_git_blob_sha,pinned[code]);
  assert.ok(bank.source.source_csv_url.startsWith('https://raw.githubusercontent.com/'));
  assert.ok(bank.source.metric.length>40);
  assert.ok(bank.given_names.every(e=>isSingleLatinGivenName(e.value)));
 }
 assert.match(banks.ARG.cohort,/NOT birth records/);
 assert.match(banks.MEX.cohort,/NOT birth records/);
 assert.match(banks.COL.cohort,/NOT births/);
 assert.match(banks.CHI.cohort,/2000–2021/);
 assert.ok(banks.CHI.given_names.some(e=>e.value==='Benjamín'));
});

test('Batch G: four source-backed 300-name Latin pools preserve actual observations and research limits',()=>{
 const expected={
  MAR:'ma-wikidata-male-citizens-explicit-given-name-p735-2026',
  ALG:'dz-aldjia-algerian-male-first-name-registry',
  EGY:'eg-afify-male-given-token-frequency',
  IRN:'ir-wikidata-male-citizens-explicit-given-name-p735-2026'
 };
 for(const [code,id] of Object.entries(expected)){
  const bank=banks[code];
  assert.equal(bank.source.id,id);
  assert.equal(bank.given_names.length,300);
  assert.equal(bank.production_ready,false);
  assert.deepEqual(bank.surnames,[]);
  assert.ok(bank.given_names.every(x=>isSingleLatinGivenName(x.value)),code+' strict Unicode Latin names');
  assert.match(bank.source.romanization,/Latin|transliterat/i);
  assert.ok(bank.source.license.length>8);
 }
 for(const [code,country] of [['MAR','Q1028'],['IRN','Q794']]){
  const b=banks[code];
  assert.ok(b.source.metric.startsWith('COUNT(DISTINCT Wikidata human person QIDs)'),code+' observed biographical metric');
  assert.match(b.source.source_query_sparql,/wdt:P31 wd:Q5/);
  assert.ok(b.source.source_query_sparql.includes('wdt:P27 wd:'+country));
  assert.match(b.source.sampling_limitations,/not a population census/i);
  assert.match(b.source.license,/CC0/);
  assert.match(b.source.source_query_response_sha256,/^[0-9a-f]{64}$/);
  assert.ok(b.source.eligible_distinct_name_after_romanization_count>=300);
  assert.ok(b.source.romanization_equivalence_groups.length>10);
  assert.ok(!b.given_names.some(x=>b.source.excluded_fragment_and_title_forms.includes(x.value.toLocaleLowerCase('und'))));
 }
 assert.equal(banks.ALG.source.source_git_commit,'dc89312451599abee3eb6a6c96710c0c3b1af3bb');
 assert.equal(banks.ALG.source.source_csv_sha256,'4b4d9d8593c512774c8e3eb5c75347dad1ad2efca53a7fad2e5f4e72dfc3755d');
 assert.match(banks.ALG.source.license,/CC0/);
 assert.match(banks.ALG.source.sampling_limitations,/Not a national birth register/i);
 assert.equal(banks.EGY.source.source_hf_git_commit,'2a9cf6419177935e38821f3db7b085606d945618');
 assert.equal(banks.EGY.source.source_lexicon_sha256,'3673f809f8e9a9c355bd51ec2b765096ff3997e771ae9d53203ae66b5adbc9a7');
 assert.equal(banks.EGY.source.source_frequency_sha256,'992b0e9da2a6621d7f8ca63e1d29ecefdd3980b0d560ce39fbfddff393fae786');
 assert.match(banks.EGY.source.sampling_limitations,/not male newborns/i);
 for(const [code,groups] of Object.entries({
  MAR:[['Mohamed','Mohammed'],['Driss','Idriss'],['Tarik','Tariq','Tarek'],['Jaouad','Jawad']],
  IRN:[['Mehdi','Mahdi'],['Saeed','Saeid'],['Javad','Jawad'],['Houshang','Hushang']]
 })){
  const names=new Set(banks[code].given_names.map(x=>x.value.toLocaleLowerCase('und')));
  for(const g of groups)assert.ok(g.filter(name=>names.has(name.toLocaleLowerCase('und'))).length<=1,code+' transliteration collision: '+g.join('/'));
 }
});
