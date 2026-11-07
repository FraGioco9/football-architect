#!/usr/bin/env node
// PLAYERS-01 Phase 1: evidence-only generator QA. No gameplay, persistence or catalog mutations.
// Node 22: node tools/players-generation-phase1-qa.mjs --json /tmp/phase1.json --markdown /tmp/phase1.md
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {COUNTRIES,ATTRIBUTES,generateTrial,calculatePositionSuitability,selectDualNameOrigins} from './players-generation-trial.mjs';
import {loadPlayerNamePools} from './players-name-pools.mjs';

const SEEDS=['fa-official-trial-01','fa-phase1-independent-02','fa-phase1-independent-03'];
const PAIRS=[['ITA','MAR'],['ENG','WAL'],['JPN','KOR'],['BRA','POR']];
const NAME_PATTERN=/^(?:\p{Script=Latin}\p{M}*)+$/u;
const GK=ATTRIBUTES.slice(16),OUTFIELD=ATTRIBUTES.slice(0,16);
const FIELDS=ATTRIBUTES.length;
const POOLS=loadPlayerNamePools({expectedCodes:COUNTRIES.map(c=>c.code)});
const COUNTRIES_BY_CODE=new Map(COUNTRIES.map(c=>[c.code,c]));
const pct=(n,d)=>d?Number((100*n/d).toFixed(2)):null;
const round=(n)=>n===null?null:Number(n.toFixed(3));
const avg=arr=>arr.reduce((s,x)=>s+x,0)/arr.length;
const countBy=(rows,key)=>Object.fromEntries([...rows.reduce((map,item)=>{
 const k=String(key(item));map.set(k,(map.get(k)||0)+1);return map;
},new Map())].sort(([a],[b])=>a.localeCompare(b)));
function quantile(values,p){
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y),k=(a.length-1)*p,i=Math.floor(k);
 return a[i]+(a[Math.ceil(k)]-a[i])*(k-i);
}
function stats(values){
 return {n:values.length,min:Math.min(...values),p10:round(quantile(values,.1)),
  p50:round(quantile(values,.5)),p90:round(quantile(values,.9)),
  max:Math.max(...values),mean:round(avg(values))};
}
function pearson(a,b){
 const ma=avg(a),mb=avg(b);let xy=0,x2=0,y2=0;
 for(let i=0;i<a.length;i++){let x=a[i]-ma,y=b[i]-mb;xy+=x*y;x2+=x*x;y2+=y*y;}
 return x2*y2===0?null:round(xy/Math.sqrt(x2*y2));
}
function ranks(values){
 const items=values.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),out=[];
 for(let i=0;i<items.length;){let j=i+1;while(j<items.length&&items[j][0]===items[i][0])j++;
  const rank=(i+j+1)/2;for(let k=i;k<j;k++)out[items[k][1]]=rank;i=j;}
 return out;
}
function spearman(rows,a,b){return pearson(ranks(rows.map(p=>p.attributes[a])),ranks(rows.map(p=>p.attributes[b])))}
function surnameBank(code){return POOLS.surnames.get(code)??COUNTRIES_BY_CODE.get(code)?.demoLast}
function sourceTag(value,primary,secondary,kind){
 const has=(code)=>kind==='first'?POOLS.given.get(code)?.values.includes(value):surnameBank(code)?.includes(value);
 const p=has(primary),s=has(secondary);
 assert.ok(p||s,'Name absent from both eligible national banks: '+primary+'/'+secondary+'/'+value);
 if(p&&s)return 'overlap';
 return s?'secondary':'primary';
}
function validate(p,allowedPairs,manual=false){
 assert.equal(typeof p.preview_id,'string');
 assert.equal(p.career_status,'active');
 assert.equal(Object.hasOwn(p,'known_as'),false);
 for(const k of ['id','entry_season','overall','club_id'])assert.equal(Object.hasOwn(p,k),false);
 assert.equal(p.display_name,p.first_name+' '+p.last_name);
 assert.ok(p.first_name===p.first_name.normalize('NFC')&&NAME_PATTERN.test(p.first_name));
 assert.ok(typeof p.last_name==='string'&&p.last_name.length>0&&p.last_name===p.last_name.normalize('NFC'));
 assert.ok(COUNTRIES_BY_CODE.has(p.nationality));
 assert.ok(p.initial_age>=16&&p.initial_age<=19&&Number.isInteger(p.initial_age));
 assert.ok(Number.isInteger(p.height_cm)&&p.height_cm>=160&&p.height_cm<=205);
 assert.ok(Number.isInteger(p.development_aptitude)&&p.development_aptitude>=1&&p.development_aptitude<=99);
 assert.ok(['left','right'].includes(p.preferred_foot));
 assert.ok(Array.isArray(p.secondary_positions)&&p.secondary_positions.length<=5);
 assert.ok(new Set(p.secondary_positions).size===p.secondary_positions.length);
 assert.ok(!p.secondary_positions.includes(p.primary_position));
 if(p.primary_position==='GK')assert.equal(p.secondary_positions.length,0);
 assert.equal(Object.keys(p.attributes).length,FIELDS);
 assert.ok(ATTRIBUTES.every(a=>Number.isInteger(p.attributes[a])&&p.attributes[a]>=1&&p.attributes[a]<=99));
 if(p.primary_position!=='GK')assert.ok(GK.every(a=>p.attributes[a]<=15));
 const actual=calculatePositionSuitability(p.attributes,p.primary_position);
 const target=p.trial_primary_suitability_target;
 assert.ok(Number.isInteger(target)&&target>=1&&target<=90);
 assert.ok(Math.abs(actual-target)<=.500001,'Actual primary suitability drifted from target');
 assert.ok(!Object.keys(p).some(k=>k.startsWith('trial_')),'QA-only attributes leaked into enumerable JSON');
 const out=JSON.parse(JSON.stringify(p));
 assert.equal(out.trial_role_profile,undefined);
 assert.equal(out.trial_primary_suitability_target,undefined);
 if(p.secondary_nationality){
  assert.notEqual(p.secondary_nationality,p.nationality);
  assert.ok(COUNTRIES_BY_CODE.has(p.secondary_nationality));
  if(!manual)assert.ok(allowedPairs.has([p.nationality,p.secondary_nationality].sort().join('-')),
   'Automatic second nationality outside the eligible allowlist');
 }
 return actual;
}
function pairAllowlist(){
 const source=readFileSync(new URL('players-generation-trial.mjs',import.meta.url),'utf8');
 const content=source.match(/const relatedPairs=\[([\s\S]*?)\];/)?.[1];
 assert.ok(content,'Country relationship allowlist missing');
 const set=new Set();
 for(const [,a,b] of content.matchAll(/'([A-Z]{3})-([A-Z]{3})'/g)){
  const key=[a,b].sort().join('-');assert.ok(!set.has(key),'Duplicate country pair');set.add(key);
 }
 assert.equal(set.size,90,'Provisional V6 allowlist changed unexpectedly');
 return set;
}
function exactOriginTest(){
 const counts={PP:0,SP:0,PS:0,SS:0};let lastFromSecondary=0,firstFromSecondary=0;
 for(let i=0;i<10000;i++){
  const x=(i+.5)/10000;
  const o=selectDualNameOrigins(true,false,false,x);
  counts[(o.first==='secondary'?'S':'P')+(o.last==='secondary'?'S':'P')]++;
  if(selectDualNameOrigins(true,true,false,x).last==='secondary')lastFromSecondary++;
  if(selectDualNameOrigins(true,false,true,x).first==='secondary')firstFromSecondary++;
 }
 assert.deepEqual(counts,{PP:5000,SP:1500,PS:2500,SS:1000});
 assert.equal(lastFromSecondary,3500);assert.equal(firstFromSecondary,2500);
 return {conditional_theoretical_percent:{PP:50,SP:15,PS:25,SS:10},
  deterministic_10000_strata:counts,
  manual_first_field_secondary_percent:25,manual_last_field_secondary_percent:35};
}
function sourceReport(rows,primary,secondary){
 const first={primary:0,secondary:0,overlap:0},
  last={primary:0,secondary:0,overlap:0},
  inferred={PP:0,SP:0,PS:0,SS:0,ambiguous:0};
 const illustrations=[];
 for(const p of rows){
  const a=sourceTag(p.first_name,primary,secondary,'first');
  const b=sourceTag(p.last_name,primary,secondary,'last');
  first[a]++;last[b]++;
  const category=a==='overlap'||b==='overlap'?'ambiguous':
   (a==='secondary'?'S':'P')+(b==='secondary'?'S':'P');
  inferred[category]++;
  if(illustrations.length<12&&a==='secondary'&&b==='secondary')illustrations.push({
   name:p.display_name,first_source:a,surname_source:b,classification:category});
 }
 return {n:rows.length,first,last,combination_inference:inferred,
  observed_exclusive_secondary_first_percent:pct(first.secondary,rows.length),
  observed_exclusive_secondary_surname_percent:pct(last.secondary,rows.length),
  illustrations,limitation:'Exclusive membership infers only a lower bound on secondary-source choices; shared strings make exact origin unobservable. An origin-decision metric must not be inferred from spelling.'};
}
function calculate(){
 const allowlist=pairAllowlist(),sampleSets=[],runs=[],all=[];
 for(const seed of SEEDS){
  const trial=generateTrial({count:1000,seed});
  assert.equal(trial.persisted,false);assert.equal(trial.trial_only,true);
  assert.equal(trial.identity_sources.given_names,'PLAYERS-03 weighted catalog');
  assert.equal(trial.identity_sources.surnames,POOLS.surnameSource);
  const ids=new Set(),nations=new Map(),positions=[];
  for(const p of trial.candidates){
   validate(p,allowlist);assert.ok(!ids.has(p.preview_id));ids.add(p.preview_id);
   nations.set(p.nationality,(nations.get(p.nationality)||0)+1);positions.push(p.primary_position);
   const eligible=[p.nationality,...(p.secondary_nationality?[p.secondary_nationality]:[])];
   assert.ok(eligible.some(code=>POOLS.given.get(code).values.includes(p.first_name)));
   assert.ok(eligible.some(code=>surnameBank(code).includes(p.last_name)));
  }
  assert.equal(nations.size,50);
  assert.ok([...nations.values()].every(n=>n===20),'Trial coverage must be 20 per country, not production nationality weight');
  assert.deepEqual(generateTrial({count:20,seed}).candidates,trial.candidates.slice(0,20),'Seed replay mismatch');
  runs.push({seed,n:1000,digest_sha256:createHash('sha256').update(JSON.stringify(trial.candidates)).digest('hex'),
   primary_countries:nations.size,primary_per_country:20,
   second_nationalities:trial.candidates.filter(p=>p.secondary_nationality).length,
   position_counts:countBy(trial.candidates,p=>p.primary_position),
   age_counts:countBy(trial.candidates,p=>p.initial_age),
   first_name_unique:new Set(trial.candidates.map(p=>p.first_name)).size,
   surname_unique:new Set(trial.candidates.map(p=>p.last_name)).size,
   full_name_unique:new Set(trial.candidates.map(p=>p.display_name)).size});
  sampleSets.push(trial.candidates);all.push(...trial.candidates);
 }
 const roleGroups=countBy(all,p=>p.primary_position);
 const positionMetrics={};
 for(const role of Object.keys(roleGroups)){
  const r=all.filter(p=>p.primary_position===role);
  positionMetrics[role]={n:r.length,primary_suitability:stats(r.map(p=>calculatePositionSuitability(p.attributes,role))),
   first_16_spread:stats(r.map(p=>Math.max(...OUTFIELD.map(a=>p.attributes[a]))-Math.min(...OUTFIELD.map(a=>p.attributes[a])))),
   secondary_position_rate:pct(r.filter(p=>p.secondary_positions.length).length,r.length)};
 }
 const secondaryEligible=all.filter(p=>p.secondary_positions.length>0);
 const secondaryFit={better:0,equal:0,primary:0};
 for(const p of secondaryEligible){
  const main=calculatePositionSuitability(p.attributes,p.primary_position);
  const best=Math.max(...p.secondary_positions.map(role=>calculatePositionSuitability(p.attributes,role)));
  const delta=best-main;
  secondaryFit[delta>=3?'better':delta<=-3?'primary':'equal']++;
 }
 const fitPercent=Object.fromEntries(Object.entries(secondaryFit).map(([k,n])=>[k,pct(n,secondaryEligible.length)]));
 const height=(rows,field)=>pearson(rows.map(p=>p.height_cm),rows.map(p=>p.attributes[field]));
 const forced=[];
 for(const [primary,secondary] of PAIRS){
  const seed='phase1-forced-'+primary+'-'+secondary;
  const trial=generateTrial({count:1000,seed,primaryNationality:primary,secondaryNationality:secondary});
  for(const p of trial.candidates){
   validate(p,allowlist,true);
   assert.equal(p.nationality,primary);assert.equal(p.secondary_nationality,secondary);
  }
  const sources=sourceReport(trial.candidates,primary,secondary);
  forced.push({primary,secondary,seed,sources});
 }
 const overridden=[];
 for(const mode of ['first','last']){
  const options={count:1000,seed:'phase1-manual-'+mode,primaryNationality:'ITA',secondaryNationality:'MAR'};
  if(mode==='first')options.firstName='ExplicitFirst';
  else options.lastName='ExplicitSurname';
  const candidates=generateTrial(options).candidates;
  for(const p of candidates){
   validate(p,allowlist,true);
   assert.equal(mode==='first'?p.first_name:p.last_name,mode==='first'?'ExplicitFirst':'ExplicitSurname');
  }
  const primary='ITA',secondary='MAR',autoField=mode==='first'?'last':'first';
  const codes={primary:0,secondary:0,overlap:0};
  for(const p of candidates)codes[sourceTag(p[autoField+'_name'],primary,secondary,autoField)]++;
  overridden.push({manual_field:mode,automatic_field:autoField,catalog_inference:codes,forced_percent:mode==='first'?35:25});
 }
 const correlations={};
 for(const [a,b] of [['speed','agility'],['passing','vision'],['tackling','marking'],
   ['dribbling','technique'],['shooting','composure']]){
  correlations[a+'__'+b]=spearman(all,a,b);
 }
 const overall={n:all.length,unique_primary_nationalities:new Set(all.map(p=>p.nationality)).size,
  secondary_nationalities:all.filter(p=>p.secondary_nationality).length,
  secondary_nationality_percent:pct(all.filter(p=>p.secondary_nationality).length,all.length),
  age_counts:countBy(all,p=>p.initial_age),height_cm:stats(all.map(p=>p.height_cm)),
  feet:countBy(all,p=>p.preferred_foot),position_counts:roleGroups,
  secondary_position_counts:countBy(all,p=>p.secondary_positions.length),
  aptitude:stats(all.map(p=>p.development_aptitude)),
  primary_suitability:stats(all.map(p=>calculatePositionSuitability(p.attributes,p.primary_position))),
  first_16_spread:stats(all.map(p=>Math.max(...OUTFIELD.map(a=>p.attributes[a]))-Math.min(...OUTFIELD.map(a=>p.attributes[a])))),
  attribute_range:{min:Math.min(...all.flatMap(p=>Object.values(p.attributes))),
   max:Math.max(...all.flatMap(p=>Object.values(p.attributes)))},
  max_outfield_gk:Math.max(...all.filter(p=>p.primary_position!=='GK').flatMap(p=>GK.map(a=>p.attributes[a]))),
  full_name_unique:new Set(all.map(p=>p.display_name)).size,
  secondary_position_suitability:{denominator:secondaryEligible.length,counts:secondaryFit,percent:fitPercent},
  spearman:correlations,
  height_pearson:{outfield_heading:height(all.filter(p=>p.primary_position!=='GK'),'heading'),
   goalkeeper_aerial:height(all.filter(p=>p.primary_position==='GK'),'gk_aerial'),strength:height(all,'strength')}};
 const flags=[];
 flags.push({severity:'design_open',code:'PRIMARY_NATIONALITY_COVERAGE_ONLY',
   detail:'Automatic nationality is 20 players per FIFA top-50 country per 1000-player batch, not an approved worldwide football population distribution.'});
 flags.push({severity:'human_review',code:'CULTURAL_NAME_REALISM_UNVERIFIED',
   detail:'Catalog membership, script constraints and seeded replay do not prove that mixed first/surname combinations are culturally plausible; inspect the examples against qualified sources.'});
 if(POOLS.surnameSource!=='SURNAMES-01 uniform catalog')
  flags.push({severity:'catalogue',code:'SURNAME_DEMO_FALLBACK',detail:'Only three fallback demo surnames per nationality are available in this environment.'});
 if(forced.some(f=>f.sources.first.overlap||f.sources.last.overlap))
  flags.push({severity:'measurement',code:'AMBIGUOUS_ORIGIN_MEMBERSHIP',
   detail:'Names appearing in both national banks cannot reveal the actual selected source without internal metadata. Exact rates are verified by the chooser contract, not by matching strings.'});
 const {better,equal:equalFit,primary:primaryFit}=fitPercent;
 if(!(better>=5&&better<=10&&equalFit>=20&&equalFit<=25&&primaryFit>=65&&primaryFit<=75))
  flags.push({severity:'calibration_review',code:'SECONDARY_POSITION_FIT_OUTSIDE_TARGET',
   detail:'Pooled distribution for players with secondary positions lies outside at least one owner-approved reference window. Observe before parameter changes.'});
 for(const [role,count] of Object.entries(roleGroups))if(count<50)
  flags.push({severity:'sampling',code:'LOW_POSITION_SAMPLE',detail:role+' has only '+count+' samples in pooled cohort.'});
 return {scope:'PLAYERS-01 PHASE-1 IN-MEMORY AUDIT',read_only:true,persisted:false,
  exact_checked_out_head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  generator_unchanged:true,country_catalogs:POOLS.given.size,
  surname_catalog_source:POOLS.surnameSource,allowlisted_nationality_pairs:allowlist.size,
  seeds:SEEDS,normal_runs:runs,pooled:overall,per_role:positionMetrics,
  origin_probabilities:exactOriginTest(),forced_nationality_pairs:forced,
  one_field_manual_overrides:overridden,flags,
  caveats:['Seeded coverage and 1000-per-seed sampling are not estimates of production nationality frequencies.',
   'The four category probabilities apply conditional on having a second nationality, not to all players.',
   'The 35% surname and 25% given-name single-field probabilities apply only when the other name is manually supplied.',
   'Observed source inference is incomplete when names overlap across national banks.',
   'Secondary nationality and secondary playing position are different fields; positional fit percentages apply to the latter.',
   'No PDF, database, permanent IDs, deploy, or production generation is performed.']};
}
function markdown(r){
 const o=r.pooled,lines=[
 '# PLAYERS-01 — Phase 1 generation QA (evidence-only)',
 '',
 'Repro: node tools/players-generation-phase1-qa.mjs --json /tmp/phase1.json --markdown /tmp/phase1.md',
 '',
 '**Source:** existing in-memory generator on checked-out PR HEAD '+r.exact_checked_out_head+'. No gameplay or generation parameters changed.',
 '',
 '## Pooled normal generation (3 × 1,000)',
 '',
 '| Measure | Observed |',
 '|---|---:|',
 '| Players | '+o.n+' |',
 '| Unique primary nationalities | '+o.unique_primary_nationalities+' (fixed top-50 coverage) |',
 '| Secondary nationalities | '+o.secondary_nationalities+' ('+o.secondary_nationality_percent+'%) |',
 '| Unique full names | '+o.full_name_unique+' |',
 '| Age counts | '+Object.entries(o.age_counts).map(x=>x.join(':')).join(', ')+' |',
 '| Right / left foot | '+(o.feet.right??0)+' / '+(o.feet.left??0)+' |',
 '| Height mean / p50 / p90 | '+o.height_cm.mean+' / '+o.height_cm.p50+' / '+o.height_cm.p90+' cm |',
 '| Primary suitability mean / p90 / max | '+o.primary_suitability.mean+' / '+o.primary_suitability.p90+' / '+o.primary_suitability.max+' |',
 '| Sixteen-field spread mean / p90 | '+o.first_16_spread.mean+' / '+o.first_16_spread.p90+' |',
 '| Outfield goalkeeper skills maximum | '+o.max_outfield_gk+' |',
 '| Secondary playing-position fit, better / equal / primary | '+o.secondary_position_suitability.percent.better+'% / '+o.secondary_position_suitability.percent.equal+'% / '+o.secondary_position_suitability.percent.primary+'% (n='+o.secondary_position_suitability.denominator+') |',
 '',
 '## Per-seed reproducibility',
 '',
 '| Seed | SHA-256 (serialized 1000 candidates) | Secondary nationalities | Distinct names |',
 '|---|---|---:|---:|',
 ...r.normal_runs.map(x=>'| '+x.seed+' | '+x.digest_sha256+' | '+x.second_nationalities+' | '+x.full_name_unique+' |'),
 '',
 '## Origin sampling (conditional on a second nationality)',
 '',
 '| Category | Contract | Deterministic strata (10,000) |',
 '|---|---:|---:|',
 ...Object.entries(r.origin_probabilities.conditional_theoretical_percent).map(([k,n])=>
  '| '+k+' | '+n+'% | '+r.origin_probabilities.deterministic_10000_strata[k]+' |'),
 '',
 'The actual source is not always inferable from a printed name if it occurs in both catalogs.',
 '',
 '## Forced country-pair samples (1,000 each)',
 '',
 '| Primary → secondary | Exclusive secondary given | Exclusive secondary surname | Ambiguous combinations |',
 '|---|---:|---:|---:|',
 ...r.forced_nationality_pairs.map(x=>'| '+x.primary+' → '+x.secondary+' | '+
  x.sources.first.secondary+'/'+x.sources.n+' | '+x.sources.last.secondary+'/'+x.sources.n+
  ' | '+x.sources.combination_inference.ambiguous+'/'+x.sources.n+' |'),
 '',
 '### Human-review examples (secondary-exclusive for both fields)',
 ...r.forced_nationality_pairs.flatMap(x=>['**'+x.primary+' → '+x.secondary+'**',
  ...(x.sources.illustrations.length?x.sources.illustrations.map(z=>'- '+z.name):['- No unambiguous examples in this draw'])]),
 '',
 '## Attribute correlation diagnostics',
 '',
 ...Object.entries(o.spearman).map(([k,v])=>'- '+k+': Spearman '+v),
 '',
 'Height ↔ heading (outfield): '+o.height_pearson.outfield_heading+
 '; height ↔ GK aerial (GK): '+o.height_pearson.goalkeeper_aerial+
 '; height ↔ strength (all roles): '+o.height_pearson.strength+'.',
 '',
 '## Findings requiring decisions or review',
 '',
 ...r.flags.map(x=>'- **'+x.severity+' / '+x.code+'** — '+x.detail),
 '',
 '## Limits',
 '',
 ...r.caveats.map(x=>'- '+x),''
 ];
 return lines.join('\n');
}
const args=process.argv.slice(2);
const option=key=>{const n=args.indexOf(key);return n<0?null:args[n+1]};
try{
 assert.ok(args.every((a,i)=>['--json','--markdown'].includes(a)||['--json','--markdown'].includes(args[i-1])),
  'Allowed arguments: --json PATH --markdown PATH');
 const report=calculate();
 if(option('--json'))writeFileSync(option('--json'),JSON.stringify(report,null,2)+'\n');
 if(option('--markdown'))writeFileSync(option('--markdown'),markdown(report));
 const o=report.pooled;
 console.log('PHASE1_SUMMARY '+JSON.stringify({head:report.exact_checked_out_head,n:o.n,
  seeds:report.seeds,secondary_nationalities:o.secondary_nationalities,
  secondary_nationality_percent:o.secondary_nationality_percent,age_counts:o.age_counts,
  positions:o.position_counts,height:o.height_cm,primary_suitability:o.primary_suitability,
  secondary_fit:o.secondary_position_suitability,unique_names:o.full_name_unique,
  name_source:report.surname_catalog_source,forced:report.forced_nationality_pairs.map(f=>({
   pair:f.primary+'-'+f.secondary,first:f.sources.first,last:f.sources.last,
   identifiable:f.sources.combination_inference})),flags:report.flags}));
}catch(error){console.error('PLAYERS-PHASE1-FAIL',error);process.exitCode=1;}
