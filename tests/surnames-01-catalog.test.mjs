import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const dir=join(root,'data/players/surnames');
const catalog=JSON.parse(readFileSync(join(dir,'catalog-v1.json'),'utf8'));
const codes='ESP ARG FRA ENG POR BRA MAR BEL NED MEX COL SUI GER CRO ITA USA JPN SEN NOR URU DEN AUT IRN ECU EGY AUS CAN ALG CIV NGA TUR KOR PAR SWE RUS UKR POL HUN WAL COD GRE CMR SCO SRB SVK PAN MLI RSA VEN CHI'.split(' ');
const tiers=[{start_rank:1,end_rank:25,target_count:3000},{start_rank:26,end_rank:35,target_count:2000},{start_rank:36,end_rank:45,target_count:1500},{start_rank:46,end_rank:50,target_count:1000}];
const states=['complete','partial','pending','over_target','blocked'];
const forbidden=new Set(['weight','probability','frequency_weight','selection_weight']);
const latin=/^(?:\p{Script=Latin}\p{M}*)+$/u,mark=/\p{Script_Extensions=Latin}/u,marks=/\p{M}/gu,sep=/[ '\u2019-]/u,repeat=/[ '\u2019-]{2}/u;
function isSurname(s){
 if(typeof s!=='string'||!s||s!==s.normalize('NFC'))return false;
 const grammar=s.replace(/(^| )'(?:s|t)(?= )/giu,'$1t'); // documented Dutch particles
 return !sep.test(grammar[0])&&!sep.test(grammar.at(-1))&&!repeat.test(grammar)&&grammar.split(sep).every(t=>latin.test(t)&&[...t.matchAll(marks)].every(([m])=>mark.test(m)));
}
function noWeights(v,path='$'){
 if(!v||typeof v!=='object')return;
 for(const[k,x]of Object.entries(v)){assert.ok(!forbidden.has(k),'Forbidden '+path+'.'+k);noWeights(x,path+'.'+k)}
}
function gitBlob(sha){assert.match(sha,/^[a-f0-9]{40}$/);return JSON.parse(execFileSync('git',['cat-file','blob',sha],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}))}
function prior(path){return JSON.parse(execFileSync('git',['show',catalog.preservation_baseline_commit+':'+path],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}))}
const targetFor=i=>i<25?3000:i<35?2000:i<45?1500:1000;
test('exact fixed ranking, 4 tiers and 115,000 aggregate target',()=>{
 assert.deepEqual(catalog.countries.map(x=>x.code),codes);
 assert.equal(new Set(codes).size,50);
 assert.equal(catalog.schema_version,1);
 assert.equal(catalog.kind,'surnames'); // match main's player-name adapter contract without changing PLAYERS-03
 assert.equal(catalog.ranking_policy,'fixed_50_country_rank');
 assert.deepEqual(catalog.ranking_tiers,tiers);
 assert.equal(tiers.reduce((n,t)=>n+(t.end_rank-t.start_rank+1)*t.target_count,0),115000);
 assert.equal(catalog.target_total_surnames,115000);
 assert.equal(catalog.excess_policy,'retain_all_existing_entries');
 assert.equal(catalog.excess_policy_owner_decision,'retain');
 assert.equal(catalog.excess_policy_decision_date,'2026-11-06');
 assert.ok(!Object.hasOwn(catalog,'target_per_country'));
 assert.equal(catalog.selection_policy,'uniform');
 assert.equal(catalog.production_ready,false);
 assert.match(catalog.preservation_baseline_commit,/^[a-f0-9]{40}$/);
 assert.deepEqual(readdirSync(join(dir,'countries')).filter(x=>x.endsWith('.json')).sort(),catalog.countries.filter(x=>x.status!=='pending').map(x=>x.code+'.json').sort());
 noWeights(catalog);
});
test('country target/actual/missing/excess/status and global totals',()=>{
 const counts=Object.fromEntries(states.map(x=>[x,0]));let actual=0,missing=0,excess=0;
 for(const [i,c]of catalog.countries.entries()){
  assert.equal(c.rank,i+1);
  const target=targetFor(i);assert.equal(c.target_count,target,c.code);
  assert.ok(Number.isInteger(c.actual_count)&&c.actual_count>=0,c.code);
  assert.equal(c.missing_count,Math.max(0,target-c.actual_count),c.code);
  assert.equal(c.excess_count,Math.max(0,c.actual_count-target),c.code);
  const state=c.block_reason?'blocked':c.actual_count===0?'pending':c.actual_count<target?'partial':c.actual_count>target?'over_target':'complete';
  assert.equal(c.status,state,c.code);
  assert.ok(states.includes(c.status));
  if(c.status==='blocked'){assert.match(c.blocked_source_head_sha,/^[a-f0-9]{40}$/);assert.ok(c.actual_count>0)}
  if(c.status==='over_target'){
   assert.equal(c.over_target_review_required,false,c.code+' owner approved retaining excess');
   assert.equal(c.over_target_owner_decision,'retain',c.code);
   assert.equal(c.excess_retention_authorized,true,c.code);
   assert.ok(c.excess_count>0,c.code);
  }
  assert.equal(c.production_ready,false);
  assert.equal(c.sources_available,true);
  assert.equal(c.path,'data/players/surnames/countries/'+c.code+'.json');
  assert.match(c.source_blob_sha,/^[a-f0-9]{40}$/);
  assert.match(c.source_head_sha,/^[a-f0-9]{40}$/);
  assert.match(c.source_branch,/^research\/surnames-01-batch-[a-m]$/);
  assert.ok(Number.isInteger(c.source_pr));
  if(c.expansion_blob_sha){assert.match(c.expansion_blob_sha,/^[a-f0-9]{40}$/);assert.match(c.expansion_head_sha,/^[a-f0-9]{40}$/);assert.match(c.expansion_branch,/^research\/surnames-3000-batch-[a-m]$/)}
  assert.match(c.latest_checked_expansion_head_sha,/^[a-f0-9]{40}$/);
  if(c.reconciliation_source_blob_sha)assert.equal(c.reconciliation_method,'preserve_previous_prefix_append_new_unique_source_entries');
  if(c.romanization_corrections)assert.equal(c.code,'IRN');
  counts[c.status]++;actual+=c.actual_count;missing+=c.missing_count;excess+=c.excess_count;
 }
 assert.deepEqual(catalog.status_counts,counts);
 assert.equal(catalog.total_surnames,actual);assert.equal(catalog.total_missing,missing);assert.equal(catalog.total_excess,excess);
 assert.equal(actual+missing-excess,115000,'surplus cannot compensate other national shortages');
});
for(const c of catalog.countries)test(c.code+': source blob, full history preservation, Unicode and strict unweighted entries',()=>{
 const path=join(root,c.path);
 if(c.status==='pending'){assert.ok(!existsSync(path));assert.equal(c.actual_count,0);return}
 assert.ok(existsSync(path));
 const sha=execFileSync('git',['hash-object',path],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(sha,c.expansion_blob_sha??c.source_blob_sha,c.code+' Git blob');
 const bank=JSON.parse(readFileSync(path,'utf8'));
 assert.deepEqual(Object.keys(bank).sort(),['schema_version','code','kind','selection_policy','sources','surnames','production_ready'].sort());
 assert.equal(bank.schema_version,1);assert.equal(bank.code,c.code);assert.equal(bank.kind,'surnames');
 assert.equal(bank.selection_policy,'uniform');assert.equal(bank.production_ready,false);
 assert.ok(Array.isArray(bank.sources)&&bank.sources.length>0&&bank.sources.some(s=>/^https:\/\//.test(s.url??s.source_url??'')));
 assert.equal(bank.surnames.length,c.actual_count);
 noWeights(bank);
 const before=prior(c.path);
 assert.ok(bank.surnames.length>=before.surnames.length,c.code+' lost previously integrated entries');
 const original=gitBlob(c.source_blob_sha);assert.equal(original.surnames.length,500);
 function verifyPrevious(reference){
  if(!c.romanization_corrections){
   assert.deepEqual(bank.surnames.slice(0,reference.surnames.length),reference.surnames,c.code+' previous validated names changed');
   return;
  }
  assert.equal(c.code,'IRN','only Iranian gloss corrections are authorized');
  assert.equal(c.romanization_corrections.length,11);
  const at=new Map(c.romanization_corrections.map(v=>[v.index,v]));
  assert.equal(at.size,11);
  const cited=bank.sources.flatMap(s=>s.romanization_corrections||[]);
  for(const [i,entry] of reference.surnames.entries()){
   const fix=at.get(i);
   if(fix){
    assert.equal(entry.value,fix.previous_value,'old literal gloss at '+i);
    assert.equal(bank.surnames[i].value,fix.corrected_value,'documented correction at '+i);
    assert.ok(cited.some(x=>x.source_english_gloss===fix.previous_value&&x.corrected_attested_latin===fix.corrected_value&&x.original_persian===fix.original_persian),'no source evidence for '+fix.previous_value);
   }else assert.deepEqual(bank.surnames[i],entry,'unexpected lost Iranian surname '+i);
  }
 }
 verifyPrevious(before);
 verifyPrevious(original);
 if(c.reconciliation_source_blob_sha){
  assert.match(c.reconciliation_source_blob_sha,/^[a-f0-9]{40}$/);
  assert.equal(c.reconciliation_previous_prefix_count,before.surnames.length);
  const src=gitBlob(c.reconciliation_source_blob_sha);
  const originalKeys=new Set(before.surnames.map(x=>x.value.toLowerCase().normalize('NFC')));
  const appended=src.surnames.filter(x=>!originalKeys.has(x.value.toLowerCase().normalize('NFC')));
  assert.deepEqual(bank.surnames,[...before.surnames,...appended],c.code+' source reconciliation must preserve all old names and all newly sourced names');
  assert.ok(before.surnames.some(x=>x.value===c.reconciliation_retained_original_value),'reconciled original not present');
  assert.equal(bank.surnames.length,src.surnames.length+1,c.code+' one retained old variant');
 }
 if(c.previous_expansion){const old=gitBlob(c.previous_expansion.blob_sha);assert.equal(old.surnames.length,c.previous_expansion.actual_count);assert.deepEqual(bank.surnames.slice(0,old.surnames.length),old.surnames)}
 const seen=new Set();
 for(const [i,item]of bank.surnames.entries()){
  assert.deepEqual(Object.keys(item),['value'],c.code+' '+i+' unexpected fields');
  assert.ok(isSurname(item.value),c.code+' '+i+' invalid surname '+item.value);
  const key=item.value.toLowerCase().normalize('NFC');
  assert.ok(!seen.has(key),c.code+' duplicate '+item.value);seen.add(key);
 }
});
test('Unicode and authentic compounds adversarial checks',()=>{
 for(const x of ['Rossi','De Luca',"O'Brien",'O\u2019Reilly','García-Márquez','Müller','Łukaszewicz',"van 't Hof","'s Graeuwen"])assert.equal(isSurname(x),true,x);
 for(const x of ['Иванов','Ανδρέου','محمد','山田','김','Rоssi','A\u0301lvarez','abc\u0300\u034f','',"O''Brien",'Smith--Jones',"van 't",' De Luca','De  Luca','Smith2'])assert.equal(isSurname(x),false,x);
});
test('all national minimums reached; surplus remains explicit and untrimmed',()=>{
 assert.equal(catalog.total_missing,0);
 assert.equal(catalog.total_surnames,139020);
 assert.equal(catalog.total_excess,24020);
 assert.deepEqual(catalog.status_counts,{complete:30,partial:0,pending:0,over_target:20,blocked:0});
 for(const c of catalog.countries)assert.ok(c.actual_count>=c.target_count,c.code+' not at target');
 for(const code of ['URU','PAR','VEN'])assert.equal(catalog.countries.find(c=>c.code===code).status,'over_target');
});
test('PLAYERS-03 unchanged when SURNAMES-01 catalog data changes',()=>{
 if(!process.env.GITHUB_ACTIONS)return;
 const changedSurnames=execFileSync('git',['diff','--name-only','origin/main...HEAD','--','data/players/surnames/'],{cwd:root,encoding:'utf8'}).trim();
 if(!changedSurnames)return; // Player-only PRs may legitimately update first-name spelling.
 assert.equal(execFileSync('git',['diff','--name-only','origin/main...HEAD','--','data/players/names/'],{cwd:root,encoding:'utf8'}).trim(),'');
});
