#!/usr/bin/env node
// PLAYERS-02 read-only build-quality regression: never writes to D1 or API.
// Test exact primary suitability 30/50/70/85/90 for all 14 roles, including GK.
// Audit role priorities are read from the current generator's own pooled audit,
// avoiding a second, potentially divergent table of role signatures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {generateTrial,calculatePositionSuitability,ATTRIBUTES} from './players-generation-trial.mjs';

const valueOf=flag=>{
 const idx=process.argv.indexOf(flag);
 return idx<0?null:process.argv[idx+1];
};
const auditPath=valueOf('--audit-path'),trialPath=valueOf('--trial-path'),
 outPath=valueOf('--out');
if(!auditPath||!trialPath||!outPath)throw Error('Usage: --audit-path ROLE_AUDIT.json --trial-path PLAYERS_1000.json --out QA_REPORT.json');
const audit=JSON.parse(readFileSync(auditPath,'utf8'));
const roles=audit.pooled.roles;
const requiredRoles=['GK','RB','CB','LB','RWB','LWB','DM','CM','AM','RM','LM','RW','LW','ST'];
assert.deepEqual(Object.keys(roles).sort(),[...requiredRoles].sort());
const requestedLevels=[30,50,70,85,90];
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const round=v=>Math.round(v*1000)/1000;
const entries=[];
let allPlayers=0,allErrors=0,manualTests=0;
for(const role of requiredRoles){
 const core=roles[role].signature,support=roles[role].support;
 assert.equal(core.length,4);assert.equal(support.length,4);
 const other=ATTRIBUTES.slice(0,16).filter(a=>!core.includes(a)&&!support.includes(a));
 for(const target of requestedLevels){
  const cohort=generateTrial({count:10,seed:'role-level-qa:'+role+':'+target,
   primaryPosition:role,secondaryCount:0,primarySuitability:target});
  const coreMeans=[],supportMeans=[],otherMeans=[],spreads=[];
  let lowCore=0,saturated=0;
  for(const p of cohort.candidates){
   assert.equal(p.primary_position,role);
   assert.equal(p.trial_primary_suitability_target,target);
   const actual=calculatePositionSuitability(p.attributes,role);
   const error=Math.abs(actual-target);
   assert.ok(error<=.500001,role+' target '+target+' actual '+actual);
   assert.ok(ATTRIBUTES.every(a=>Number.isInteger(p.attributes[a])&&
    p.attributes[a]>=1&&p.attributes[a]<=99));
   assert.ok(p.attributes.gk_reflexes<=15||role==='GK');
   assert.ok(p.attributes.gk_handling<=15||role==='GK');
   assert.ok(p.attributes.gk_positioning<=15||role==='GK');
   assert.ok(p.attributes.gk_aerial<=15||role==='GK');
   assert.equal(p.trial_role_profile,'primary_only');
   assert.equal(p.secondary_positions.length,0);
   assert.equal('id' in p,false);
   assert.equal('entry_season' in p,false);
   coreMeans.push(mean(core.map(a=>p.attributes[a])));
   supportMeans.push(mean(support.map(a=>p.attributes[a])));
   if(other.length)otherMeans.push(mean(other.map(a=>p.attributes[a])));
   const values=ATTRIBUTES.slice(0,16).map(a=>p.attributes[a]);
   spreads.push(Math.max(...values)-Math.min(...values));
   const allImportant=[...core,...support].map(a=>p.attributes[a]).sort((a,b)=>a-b);
   const reference=(allImportant[3]+allImportant[4])/2;
   const margin=6;
   const floor=Math.round(reference-margin);
   if(core.some(a=>p.attributes[a]<floor))lowCore++;
   if(core.every(a=>p.attributes[a]>=98))saturated++;
   allErrors=Math.max(allErrors,error);
   allPlayers++;
  }
  entries.push({role,target,count:cohort.count,
   core_mean:round(mean(coreMeans)),
   support_mean:round(mean(supportMeans)),
   peripheral_mean:otherMeans.length?round(mean(otherMeans)):null,
   mean_16_field_spread:round(mean(spreads)),
   players_below_relative_A_threshold:lowCore,
   all_essential_at_98_or_higher:saturated,
   core_minus_support:round(mean(coreMeans)-mean(supportMeans)),
   support_minus_peripheral:otherMeans.length?
    round(mean(supportMeans)-mean(otherMeans)):null});
 }
 const coreKey=core[0];
 // A chosen manual A value is never silently changed to fit a target.
 const manual=generateTrial({count:1,seed:'manual-range-qa:'+role,
  primaryPosition:role,secondaryCount:0,primarySuitability:70,
  attributes:{[coreKey]:[48,50]}}).candidates[0];
 assert.ok(manual.attributes[coreKey]>=48&&manual.attributes[coreKey]<=50);
 assert.ok(Math.abs(calculatePositionSuitability(manual.attributes,role)-70)<=.500001);
 // One very low locked A skill cannot realize suitability 90.
 assert.throws(()=>generateTrial({count:1,seed:'manual-impossible-qa:'+role,
  primaryPosition:role,secondaryCount:0,primarySuitability:90,
  attributes:{[coreKey]:1}}),/Unattainable primary suitability/);
 assert.throws(()=>generateTrial({count:1,primaryPosition:role,
  primarySuitability:95}),/Invalid fixed/,'Over-90 target must be rejected');
 manualTests++;
}
// Check role compatibility and output quality when a secondary is present.
// GK cannot have a secondary by contract.
const secondaryCases=[];
for(const role of requiredRoles.filter(role=>role!=='GK')){
 const trial=generateTrial({count:8,seed:'secondary-level-qa:'+role,
  primaryPosition:role,secondaryCount:1,primarySuitability:[50,85]});
 assert.ok(trial.candidates.every(p=>p.secondary_positions.length===1));
 for(const p of trial.candidates){
  assert.ok(p.trial_primary_suitability_target>=50&&p.trial_primary_suitability_target<=85);
  assert.ok(Math.abs(calculatePositionSuitability(p.attributes,role)-
   p.trial_primary_suitability_target)<=.500001);
 }
 secondaryCases.push({role,count:trial.count});
}
const byLevel=requestedLevels.map(level=>{
 const set=entries.filter(x=>x.target===level);
 return {target:level,roles:set.length,players:set.reduce((sum,x)=>sum+x.count,0),
  mean_core:round(mean(set.map(x=>x.core_mean))),
  mean_support:round(mean(set.map(x=>x.support_mean))),
  mean_peripheral:round(mean(set.map(x=>x.peripheral_mean).filter(x=>x!==null))),
  below_relative_A:set.reduce((sum,x)=>sum+x.players_below_relative_A_threshold,0),
  fully_saturated:set.reduce((sum,x)=>sum+x.all_essential_at_98_or_higher,0),
  negative_A_B_roles:set.filter(x=>x.core_minus_support<=0).map(x=>x.role),
  negative_B_C_roles:set.filter(x=>x.support_minus_peripheral!==null&&
   x.support_minus_peripheral<=0).map(x=>x.role)
 };
});
// Audit every A-core warning in the official 1,000-player sample and
// distinguish expected height penalties / small rounding drift from genuine
// unexplained skill-profile problems. Compare same identities with the
// pre-target implementation, not different or randomly selected players.
const official=JSON.parse(readFileSync(trialPath,'utf8'));
assert.equal(official.count,1000);
assert.equal(official.seed,'fa-official-trial-01');
// The trial export excludes the per-player build label and target diagnostics.
// Only the in-memory replay exposes the QA-only values.
const withDiagnostics=generateTrial({count:official.count,seed:official.seed});
assert.deepEqual(official.candidates,JSON.parse(JSON.stringify(withDiagnostics.candidates)),
 'The exported JSON must be an exact projection of the seeded generator');
for(const p of official.candidates){
 for(const name of ['trial_role_profile','trial_primary_suitability_target','trial_primary_suitability_actual'])
  assert.equal(Object.hasOwn(p,name),false);
}
const earlier=generateTrial({count:1000,seed:official.seed,
 experimentalPrimarySuitabilityModel:false});
const reviewFlags=[],summaryByRole={};
let earlierError=0,nowError=0,changedPlayerCount=0;
for(let i=0;i<official.count;i++){
 const p=official.candidates[i],diagnostic=withDiagnostics.candidates[i],prior=earlier.candidates[i];
 assert.equal(p.preview_id,prior.preview_id);
 assert.equal(p.primary_position,prior.primary_position);
 assert.deepEqual(p.secondary_positions,prior.secondary_positions);
 if(ATTRIBUTES.some(a=>p.attributes[a]!==prior.attributes[a]))changedPlayerCount++;
 const role=p.primary_position,core=roles[role].signature,support=roles[role].support;
 const values=[...core,...support].map(a=>p.attributes[a]).sort((a,b)=>a-b);
 const margin={primary_only:6,specialist:10,versatile:12}[diagnostic.trial_role_profile];
 const threshold=Math.round((values[3]+values[4])/2-margin);
 const row=summaryByRole[role]??={players:0,warnings:0};
 row.players++;
 const actual=calculatePositionSuitability(p.attributes,role);
 const error=Math.abs(actual-diagnostic.trial_primary_suitability_target);
 nowError=Math.max(nowError,error);
 assert.ok(error<=.500001);
 earlierError=Math.max(earlierError,Math.abs(calculatePositionSuitability(prior.attributes,role)-
  diagnostic.trial_primary_suitability_target));
 for(const attr of core){
  if(p.attributes[attr]>=threshold)continue;
  const deficit=threshold-p.attributes[attr];
  const anthropometric=(attr==='gk_aerial'&&role==='GK')?
   Math.max(-10,Math.min(10,Math.round((p.height_cm-189)*.5))):
   (attr==='heading'&&role!=='GK')?
   Math.max(-10,Math.min(10,Math.round((p.height_cm-180)*.4))):0;
  const classification=anthropometric<0&&deficit<=-anthropometric+1?
   'height_effect_expected':deficit<=3?'minor_rounding_or_rebase':'investigate';
  reviewFlags.push({id:p.preview_id,name:p.display_name,role,
   age:p.initial_age,height_cm:p.height_cm,skill:attr,actual:p.attributes[attr],
   expected_relative_floor:threshold,deficit,anthropometric_modifier:anthropometric,
   classification,primary_target:diagnostic.trial_primary_suitability_target,
   primary_actual:round(actual)});
  row.warnings++;
 }
}
assert.equal(Object.keys(summaryByRole).length,14);
const flagCount=Object.fromEntries(['height_effect_expected',
 'minor_rounding_or_rebase','investigate'].map(k=>[k,reviewFlags.filter(f=>f.classification===k).length]));
assert.equal(flagCount.investigate,0,
 'Unexpected major role-core warning: review actual attributes before release');
const cohortReview={sample_count:official.count,seed:official.seed,
 changed_players_vs_pre_target:changedPlayerCount,
 max_primary_error:round(nowError),
 max_error_if_reusing_pre_target_attributes:round(earlierError),
 warnings:reviewFlags.length,warning_counts:flagCount,
 per_primary_role:summaryByRole,flagged_players:reviewFlags};
const result={status:'COMPLETE',read_only:true,persisted:false,
 primary_suitability_max:90,elite_95_cases:0,
 label:'PLAYERS-02 target-first quality audit',levels:requestedLevels,
 primary_roles:requiredRoles.length,players_examined:allPlayers,
 manual_override_and_unattainable_tests:manualTests,
 secondary_role_cases:secondaryCases.length,
 maximum_primary_suitability_error:round(allErrors),
 official_1000_cohort:cohortReview,
 by_level:byLevel,by_role_target:entries,
 note:'Conformance checks PASS; A/B/C tier differences and high-ability saturation are diagnostic, not a forced per-player quota.'};
writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,players:allPlayers,
 manual_tests:manualTests,secondary_cases:secondaryCases.length,
 maximum_error:result.maximum_primary_suitability_error,
 by_level:byLevel}));
