#!/usr/bin/env node
// PLAYERS-02 role tier VALUE audit: core skills higher, peripheral lower; NOT correlation scaling.
// Read-only: no remote calls, persistent IDs, D1 writes or gameplay changes.
// Node 22: node tools/players-generation-audit.mjs --count 1000
import assert from 'node:assert/strict';
import {generateTrial, ATTRIBUTES, calculatePositionSuitability} from './players-generation-trial.mjs';

const FIELD=ATTRIBUTES.slice(0,16),KEEPER=ATTRIBUTES.slice(16);
const SEEDS=['fa-official-trial-01','fa-audit-independent-02','fa-audit-independent-03'];
// Primary-role signatures reflect the existing generator's A-tier priorities.
const SIGNATURES={
 GK:'gk_reflexes gk_handling gk_positioning gk_aerial',
 RB:'speed stamina tackling crossing',
 CB:'marking tackling heading strength',
 LB:'speed stamina tackling crossing',
 RWB:'speed stamina crossing agility',
 LWB:'speed stamina crossing agility',
 DM:'tackling marking positioning passing',
 CM:'passing technique vision stamina',
 AM:'technique vision passing dribbling',
 RM:'speed crossing stamina dribbling',
 LM:'speed crossing stamina dribbling',
 RW:'speed dribbling agility technique',
 LW:'speed dribbling agility technique',
 ST:'shooting positioning composure heading'
};
for(const role of Object.keys(SIGNATURES))SIGNATURES[role]=SIGNATURES[role].split(' ');
const SUPPORT={
 RB:'marking positioning agility passing',CB:'positioning composure decisions passing',
 LB:'marking positioning agility passing',RWB:'tackling passing positioning dribbling',
 LWB:'tackling passing positioning dribbling',DM:'strength stamina decisions vision',
 CM:'decisions positioning dribbling composure',AM:'shooting decisions agility composure',
 RM:'agility passing technique positioning',LM:'agility passing technique positioning',
 RW:'crossing shooting passing vision',LW:'crossing shooting passing vision',
 ST:'speed strength technique agility',
 GK:'agility positioning decisions composure'
};
for(const role of Object.keys(SUPPORT))SUPPORT[role]=SUPPORT[role].split(' ');
const ORIGINAL_OFFSETS={A:12,B:4,C:-5,D:-13};
// Deliberately soft, directional role comparisons; no individual has to fit a stereotype.
// GK vs ST is hard-separated because outfield automatic GK values are capped.
const CONTRASTS=[
 ['ST','CB','shooting','core'],
 ['CB','ST','tackling','core'],
 ['RW','CB','speed','core'],
 ['LW','CB','dribbling','core'],
 ['CM','CB','passing','core'],
 ['DM','CM','tackling','core'],
 ['AM','CB','vision','core'],
 ['AM','CM','shooting','core'],
 ['RB','CB','crossing','core'],
 ['LB','CB','crossing','core'],
 ['CB','CM','heading','core'],
 ['ST','CM','heading','core'],
 ['GK','ST','gk_reflexes','hard'],
 ['RWB','RB','agility','informational'],
 ['LWB','LB','agility','informational'],
 ['RB','RWB','tackling','informational'],
 ['LB','LWB','tackling','informational'],
 ['ST','CB','heading','shared_strength']
];
const MEASURED_PAIRS=[
 ['speed','agility'],['passing','vision'],['tackling','marking'],
 ['dribbling','technique'],['shooting','composure']
];
const mean=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
const round=x=>x===null?null:Number(x.toFixed(4));
function quantile(values,q){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b);
 const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);
}
function pearson(xs,ys){
 assert.equal(xs.length,ys.length);
 if(xs.length<3)return null;
 const mx=mean(xs),my=mean(ys);
 let xy=0,xx=0,yy=0;
 for(let i=0;i<xs.length;i++){
  const a=xs[i]-mx,b=ys[i]-my;
  xy+=a*b;xx+=a*a;yy+=b*b;
 }
 return xx*yy===0?null:xy/Math.sqrt(xx*yy);
}
function midranks(values){
 const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);
 const result=[];
 for(let i=0;i<indexed.length;){
  let j=i+1;
  while(j<indexed.length&&indexed[j].value===indexed[i].value)j++;
  const rank=(i+j+1)/2;
  for(let k=i;k<j;k++)result[indexed[k].index]=rank;
  i=j;
 }
 return result;
}
function spearman(xs,ys){return pearson(midranks(xs),midranks(ys))}
function spread(p){
 const values=FIELD.map(a=>p.attributes[a]);
 return Math.max(...values)-Math.min(...values);
}
function describe(values){
 if(!values.length)return null;
 return {n:values.length,mean:round(mean(values)),min:Math.min(...values),
  p10:round(quantile(values,.10)),p50:round(quantile(values,.50)),
  p90:round(quantile(values,.90)),max:Math.max(...values)};
}
function pairwiseWinRate(xs,ys){
 if(!xs.length||!ys.length)return null;
 let wins=0,ties=0;
 for(const x of xs)for(const y of ys){
  if(x>y)wins++;
  else if(x===y)ties++;
 }
 return round((wins+.5*ties)/(xs.length*ys.length));
}
// Position aptitude is derived only for trial diagnostics; there is no
// persisted overall or position-rating field.
function aptitudeForRole(player,role){
 return calculatePositionSuitability(player.attributes,role);
}
function analyzeSecondaryFit(candidates){
 const possible=candidates.filter(p=>p.secondary_positions.length>0);
 const byProfile={};
 const byPrimaryPosition={};
 let secondaryBetter=0,equivalent=0,primaryBetter=0;
 const advantages=[];
 for(const p of possible){
  const main=aptitudeForRole(p,p.primary_position);
  const secondaries=p.secondary_positions.map(position=>({
   position,aptitude:aptitudeForRole(p,position)
  }));
  const best=secondaries.reduce((a,b)=>a.aptitude>b.aptitude?a:b);
  const advantage=best.aptitude-main;
  const isBetter=advantage>=3;
  const isEqual=advantage>-3&&advantage<3;
  const isMain=advantage<=-3;
  advantages.push(advantage);
  if(isBetter)secondaryBetter++;
  else if(isEqual)equivalent++;
  else if(isMain)primaryBetter++;
  else throw Error('Unclassified position suitability');
  const profile=p.trial_role_profile??'legacy';
  const row=byProfile[profile]??={count:0,secondary_better_by_3:0,
   equivalent_within_3:0,primary_better_by_3:0};
  row.count++;
  if(isBetter)row.secondary_better_by_3++;
  if(isEqual)row.equivalent_within_3++;
  if(isMain)row.primary_better_by_3++;
  const role=byPrimaryPosition[p.primary_position]??={count:0,secondary_better_by_3:0,
   equivalent_within_3:0,primary_better_by_3:0};
  role.count++;
  if(isBetter)role.secondary_better_by_3++;
  if(isEqual)role.equivalent_within_3++;
  if(isMain)role.primary_better_by_3++;
 }
 for(const group of [...Object.values(byProfile),...Object.values(byPrimaryPosition)])
  group.share=round(group.secondary_better_by_3/group.count);
 return {
  possible:possible.length,
  specialist:byProfile.specialist?.count??0,
  versatile:byProfile.versatile?.count??0,
  versatile_share:possible.length?round((byProfile.versatile?.count??0)/possible.length):null,
  no_secondary_favored:!Object.hasOwn(byProfile,'secondary_favored'),
  secondary_better_by_3:secondaryBetter,
  secondary_better_share:possible.length?round(secondaryBetter/possible.length):null,
  equivalent_within_3:equivalent,
  equivalent_share:possible.length?round(equivalent/possible.length):null,
  primary_better_by_3:primaryBetter,
  primary_better_share:possible.length?round(primaryBetter/possible.length):null,
  secondary_advantage_distribution:describe(advantages),
  by_profile:byProfile,by_primary_position:byPrimaryPosition
 };
}
function analyze(candidates){
 assert.ok(candidates.length>0);
 const byRole=new Map(),countries=new Set(),spreads=[];
 let outfieldGKMax=0,secondaryNationalities=0,roleWithSecondaries=0;
 for(const p of candidates){
  assert.ok(!Object.hasOwn(p,'id')&&!Object.hasOwn(p,'entry_season'));
  assert.ok(Object.hasOwn(SIGNATURES,p.primary_position),'Unknown primary role');
  assert.equal(Object.keys(p.attributes).length,20);
  assert.equal(p.career_status,'active');
  for(const v of Object.values(p.attributes))
   assert.ok(Number.isInteger(v)&&v>=1&&v<=99,'All attributes must be integers 1..99');
  if(p.primary_position!=='GK')for(const a of KEEPER){
   outfieldGKMax=Math.max(outfieldGKMax,p.attributes[a]);
   assert.ok(p.attributes[a]<=15,'Outfield automatic goalkeeper hard cap');
  }
  if(p.primary_position==='GK')assert.equal(p.secondary_positions.length,0);
  if(p.secondary_nationality)secondaryNationalities++;
  if(p.secondary_positions.length)roleWithSecondaries++;
  countries.add(p.nationality);
  spreads.push(spread(p));
  if(!byRole.has(p.primary_position))byRole.set(p.primary_position,[]);
  byRole.get(p.primary_position).push(p);
 }
 const roles={};
 for(const [role,group] of [...byRole].sort(([a],[b])=>a.localeCompare(b))){
  const signature=SIGNATURES[role],support=SUPPORT[role];
  const other=(role==='GK'?FIELD:FIELD.filter(x=>!signature.includes(x)));
  const tertiary=FIELD.filter(a=>!signature.includes(a)&&!support.includes(a));
  const attributeDistributions=Object.fromEntries(ATTRIBUTES.map(a=>
   [a,describe(group.map(p=>p.attributes[a]))]));
  const signatureMean=mean(group.map(p=>mean(signature.map(a=>p.attributes[a]))));
  const otherMean=mean(group.map(p=>mean(other.map(a=>p.attributes[a]))));
  const tierMean=tier=>round(mean(group.map(p=>mean(tier.map(a=>p.attributes[a])))));
  const tierMeans={A:tierMean(signature),B:tierMean(support),
   C:role==='GK'?null:tierMean(tertiary),
   D:role==='GK'?tierMean(tertiary):null};
  roles[role]={n:group.length,signature,support,tier_means:tierMeans,
   a_minus_c:role==='GK'?null:round(tierMeans.A-tierMeans.C),
   b_minus_c:role==='GK'?null:round(tierMeans.B-tierMeans.C),
   signature_mean:round(signatureMean),other_mean:round(otherMean),
   signature_lift:round(signatureMean-otherMean),
   spread:describe(group.map(spread)),attributes:attributeDistributions,
   with_secondary_positions:group.filter(p=>p.secondary_positions.length>0).length};
 }
 const contrasts={};
 for(const [a,b,field,kind] of CONTRASTS){
  const aValues=(byRole.get(a)||[]).map(p=>p.attributes[field]);
  const bValues=(byRole.get(b)||[]).map(p=>p.attributes[field]);
  const key=a+'__'+b+'__'+field;
  const aStats=describe(aValues),bStats=describe(bValues);
  const winProbability=pairwiseWinRate(aValues,bValues);
  contrasts[key]={kind,first_role:a,second_role:b,attribute:field,
   first:aStats,second:bStats,
   mean_gap:aStats&&bStats?round(aStats.mean-bStats.mean):null,
   pairwise_win_probability:winProbability,
   inverse_or_tied_probability:winProbability===null?null:round(1-winProbability)};
 }
 const correlations=Object.fromEntries(MEASURED_PAIRS.map(([a,b])=>
  [a+'__'+b,round(spearman(candidates.map(p=>p.attributes[a]),
   candidates.map(p=>p.attributes[b])))]));
 const gk=byRole.get('GK')||[];
 const fieldPlayers=candidates.filter(p=>p.primary_position!=='GK');
 const heightPearson=(group,attr)=>round(pearson(group.map(p=>p.height_cm),
  group.map(p=>p.attributes[attr])));
 return {n:candidates.length,countries:countries.size,
  secondary_nationalities:secondaryNationalities,
  players_with_secondary_positions:roleWithSecondaries,
  spread:describe(spreads),outfield_auto_gk_max:outfieldGKMax,
  roles,contrasts,correlations,secondary_fit:analyzeSecondaryFit(candidates),
  height_pearson:{
   outfielder_heading:heightPearson(fieldPlayers,'heading'),
   goalkeeper_aerial:heightPearson(gk,'gk_aerial'),
   strength:heightPearson(candidates,'strength')
  }};
}
function compareCoreFloors(before,after){
 assert.equal(before.length,after.length);
 const byRole={}, changedIds=new Set();
 let correctedAttributes=0,totalLift=0,maxLift=0;
 for(let i=0;i<before.length;i++){
  const a=before[i],b=after[i],role=b.primary_position;
  const essential=SIGNATURES[role];
  const row=byRole[role]??={players:0,players_changed:0,core_attributes_raised:0,total_lift:0};
  row.players++;
  let corrected=false;
  for(const key of ATTRIBUTES){
   const lift=b.attributes[key]-a.attributes[key];
   if(essential.includes(key)){
    assert.ok(lift>=0,'Core floor must never lower essential skills: '+role+' '+key);
    if(lift>0){
     corrected=true;correctedAttributes++;totalLift+=lift;maxLift=Math.max(maxLift,lift);
     row.core_attributes_raised++;row.total_lift+=lift;
    }
   }else assert.equal(lift,0,
    'Only primary role A-tier values may change under core-relative-floor calibration: '+role+' '+key);
  }
  if(corrected){row.players_changed++;changedIds.add(b.preview_id+'@'+i)}
 }
 return {changed_players:changedIds.size,corrected_attributes:correctedAttributes,
  total_attribute_lift:totalLift,max_attribute_lift:maxLift,
  by_role:byRole};
}
export function audit(count=1000,seeds=SEEDS){
 assert.ok(Number.isInteger(count)&&count>=1&&count<=1000,'Count must be 1..1000');
 assert.ok(Array.isArray(seeds)&&seeds.length>=2&&seeds.length<=10&&
  seeds.every(s=>typeof s==='string'&&s.length>0)&&
  new Set(seeds).size===seeds.length,'2..10 distinct nonempty seeds required');
 const sets={v6:[],prior60:[],previousTiers:[],approved80:[],prior55:[],uncorrected:[],preTarget:[],proposal:[]},perSeed=[];
 for(const seed of seeds){
  const trials={
   v6:generateTrial({count,seed,experimentalCoherenceMix:.65,
    experimentalRoleOffsets:ORIGINAL_OFFSETS,experimentalLegacySecondaryModel:true}),
   prior60:generateTrial({count,seed,
    experimentalRoleOffsets:ORIGINAL_OFFSETS,experimentalLegacySecondaryModel:true}),
   previousTiers:generateTrial({count,seed,experimentalLegacySecondaryModel:true}),
   approved80:generateTrial({count,seed,experimentalVersatileShare:.20,
    experimentalRoleExpression:false,experimentalRoleCoreFloor:false,
    experimentalPrimarySuitabilityModel:false}),
   prior55:generateTrial({count,seed,
    experimentalRoleExpression:false,experimentalRoleCoreFloor:false,
    experimentalPrimarySuitabilityModel:false}),
   uncorrected:generateTrial({count,seed,experimentalRoleCoreFloor:false,
    experimentalPrimarySuitabilityModel:false}),
   preTarget:generateTrial({count,seed,experimentalPrimarySuitabilityModel:false}),
   proposal:generateTrial({count,seed})
  };
  for(const trial of Object.values(trials))assert.equal(trial.persisted,false);
  const idOnly=p=>{
   const {attributes:unused,trial_role_profile:meta,
    trial_primary_suitability_target:target,trial_primary_suitability_actual:actual,
    ...identity}=p;
   return identity;
  };
  for(let i=0;i<count;i++){
   const expected=idOnly(trials.proposal.candidates[i]);
   for(const version of ['v6','prior60','previousTiers','approved80','prior55','uncorrected','preTarget'])assert.deepEqual(
    expected,idOnly(trials[version].candidates[i]),
    'Trial model may change attributes and trial metadata, not identities');
  }
  const item={seed};
  for(const k of Object.keys(trials)){
   sets[k].push(...trials[k].candidates);
   item[k]=analyze(trials[k].candidates);
  }
  perSeed.push(item);
 }
 const baseline=analyze(sets.v6),prior60=analyze(sets.prior60),
  previousTiers=analyze(sets.previousTiers),approved80=analyze(sets.approved80),
  prior55=analyze(sets.prior55),uncorrected=analyze(sets.uncorrected),
  preTarget=analyze(sets.preTarget),pooled=analyze(sets.proposal);
 const coreFloor=compareCoreFloors(sets.uncorrected,sets.preTarget);
 const targetErrors=sets.proposal.map(p=>{
  assert.ok(Number.isInteger(p.trial_primary_suitability_target));
  const actual=calculatePositionSuitability(p.attributes,p.primary_position);
  assert.ok(Math.abs(actual-p.trial_primary_suitability_actual)<.011);
  return Math.abs(actual-p.trial_primary_suitability_target);
 });
 const suitabilityGeneration={
  mode:'automatic_target_first',
  maximum_primary_suitability:90,
  desired:describe(sets.proposal.map(p=>p.trial_primary_suitability_target)),
  effective:describe(sets.proposal.map(p=>p.trial_primary_suitability_actual)),
  absolute_error:describe(targetErrors),
  max_absolute_error:Math.max(...targetErrors),
  tolerance:.5,
  preserved_original_identities:true,
  not_persisted:true
 };
 assert.ok(suitabilityGeneration.max_absolute_error<=.500001,
  'The visible generated attributes must actually realize the selected target');
 assert.ok(suitabilityGeneration.desired.max<=90,
  'No generated target may exceed the approved primary suitability maximum 90');
 assert.ok(coreFloor.changed_players>0,'The role-relative floor must correct some players');
 assert.equal(Object.keys(coreFloor.by_role).length,14);
 assert.ok(Object.values(coreFloor.by_role).every(x=>x.players_changed>0),
  'Role-relative core floor must correct some automatic core values for all 14 roles');
 const coreContrasts=[];
 for(const [key,value] of Object.entries(pooled.contrasts)){
  if(value.kind==='core'||value.kind==='hard'){
   assert.ok(value.first.n>=20&&value.second.n>=20,'Insufficient sample '+key);
   const passed=value.mean_gap>0&&value.pairwise_win_probability>.5;
   coreContrasts.push({key,passed,mean_gap:value.mean_gap,
    dominance_probability:value.pairwise_win_probability});
   assert.ok(passed,'Expected main-role direction absent: '+key);
  }
 }
 const roleTiers={};
 for(const [role,signature] of Object.entries(SIGNATURES)){
  assert.ok(rolesAllContains(pooled.roles,role),'Missing primary role '+role);
  assert.equal(signature.length,4);
  assert.ok(pooled.roles[role].signature_lift>0,'Role core identity lost '+role);
  const t=pooled.roles[role].tier_means;
  roleTiers[role]={A:t.A,B:t.B,C:t.C,D:t.D,
   A_minus_B:round(t.A-t.B),B_minus_C:t.C===null?null:round(t.B-t.C),
   A_minus_C:t.C===null?null:round(t.A-t.C)};
  if(role!=='GK'){
   assert.ok(t.A>t.B&&t.B>t.C,'A/B/C tier ordering lost '+role);
  }else assert.ok(t.A>t.B,'GK primary skills should exceed support skills');
 }
 const secondary=pooled.secondary_fit;
 assert.ok(secondary.possible>500,'Expected enough players with secondaries');
 assert.ok(secondary.versatile_share>=.49&&secondary.versatile_share<=.64,
  'Proposed 55% versatile mixture should be represented across pooled seeds');
 assert.ok(approved80.secondary_fit.versatile_share>=.15&&
   approved80.secondary_fit.versatile_share<=.25,
  'Replaying the approved 20% versatile mixture should work');
 assert.equal(secondary.secondary_better_by_3+
  secondary.equivalent_within_3+secondary.primary_better_by_3,
  secondary.possible,'Suitability buckets must partition all players with secondaries');
 assert.ok(secondary.no_secondary_favored);
 assert.equal(secondary.specialist+secondary.versatile,secondary.possible);
 for(const p of sets.proposal){
  assert.ok(p.secondary_positions.length?
   (['specialist','versatile'].includes(p.trial_role_profile)):
   (p.trial_role_profile==='primary_only'));
 }
 assert.ok(pooled.spread.mean<50,'Prevent extreme loss of role-profile coherence');
 return {
  status:'EXPERIMENTAL_POSITIONAL_SKILL_EXPRESSION_THREE_WAY_TARGET',
  read_only:true,persisted:false,seeds,count_per_seed:count,
  owner_approved_prior_profiles:{specialist:{share:.80,primary:.70,secondaries_total:.30},
   versatile:{share:.20,primary:.50,secondaries_total:.50},
   secondary_favored:null},
  proposed_profiles:{specialist:{share:.45,primary:.70,secondaries_total:.30},
   versatile:{share:.55,primary:.50,secondaries_total:.50},
   secondary_favored:null},
  requested_target:{secondary_fit_rate_min:.05,secondary_fit_rate_max:.10,
   equivalent_rate_min:.20,equivalent_rate_max:.25,
   primary_fit_rate_min:.65,primary_fit_rate_max:.75,
   denominator:'players with one or more secondary positions',
   symmetric_threshold_points:3},
  measured_target_met:secondary.secondary_better_share>=.05&&secondary.secondary_better_share<=.10&&
   secondary.equivalent_share>=.20&&secondary.equivalent_share<=.25&&
   secondary.primary_better_share>=.65&&secondary.primary_better_share<=.75,
  provisional_position_expression:{mean:15,sd:12,clamp:35,max_skill_change:25},
  provisional_role_core_floor:{primary_only:6,specialist:10,versatile:12,
   reference:'median of four essential (A) plus four supporting (B) attributes',
   height_modifiers_applied_after_core_floor:true,
   preserves_manual_overrides:true},
  no_suitability_score_recalibration:true,
  derived_aptitude:{core_weight:.70,support_weight:.30,secondary_better_margin:3,
   not_persisted:true},
  offsets_previous:{...ORIGINAL_OFFSETS},
  offsets_proposed:{A:15,B:5,C:-8,D:-13},
  coherence_mix_proposed:.60,
  baseline,prior60,previousTiers,approved80,prior55,uncorrected,preTarget,pooled,
  core_floor:coreFloor,suitability_generation:suitabilityGeneration,
  perSeed,core_role_directions:coreContrasts,
  role_tiers:roleTiers,
  comparison:{
   spread_delta_vs_previous_tiers:round(pooled.spread.mean-previousTiers.spread.mean),
   spread_delta_vs_v6:round(pooled.spread.mean-baseline.spread.mean),
   secondary_fit_before:preTarget.secondary_fit,
   secondary_fit_after:secondary,
   trial_0143_before_after:{
    shooting_before:generateTrial({count:143,seed:'fa-official-trial-01',
     experimentalRoleCoreFloor:false,experimentalPrimarySuitabilityModel:false})
     .candidates[142].attributes.shooting,
    shooting_after:generateTrial({count:143,seed:'fa-official-trial-01',
     experimentalPrimarySuitabilityModel:false}).candidates[142].attributes.shooting
   },
   per_seed_bucket_comparison:perSeed.map(x=>({
    seed:x.seed,prior55:x.preTarget.secondary_fit,proposal:x.proposal.secondary_fit}))
  },
  interpretation:'Owner-approved A-core identity across all 14 primary roles: automatically generated essential attributes should be among the most relevant high skills for that individual. The experimental relative floor uses the median of A+B rather than a global fixed rating. The original 5-10/20-25/65-75 secondary suitability cohorts remain statistical targets, never forced. The role-relative margin is experimental.'

 };
}
function rolesAllContains(roles,role){return Object.hasOwn(roles,role)}
function selfTest(){
 const seeds=['fa-role-qa-01','fa-role-qa-02'];
 const result=audit(1000,seeds);
 assert.deepEqual(result,audit(1000,seeds),'Seeded generation/audit must be reproducible');
 assert.equal(result.pooled.n,2000);
 assert.equal(result.baseline.n,2000);
 assert.equal(result.prior60.n,2000);
 assert.equal(result.previousTiers.n,2000);
 assert.equal(Object.keys(result.pooled.roles).length,14);
 assert.equal(result.core_role_directions.length,13);
 assert.ok(result.core_role_directions.every(x=>x.passed));
 assert.ok(result.pooled.outfield_auto_gk_max<=15);
 assert.ok(result.pooled.secondary_fit.no_secondary_favored);
 assert.ok(result.pooled.secondary_fit.versatile_share>=.49);
 assert.ok(result.pooled.secondary_fit.versatile_share<=.64);
 assert.equal(typeof result.measured_target_met,'boolean');
 // Statistical acceptance is checked on 3 seeds / 3000 candidates in CI,
 // not before the audit can emit its diagnostic report on 2 seeds.
 assert.equal(result.pooled.secondary_fit.secondary_better_by_3+
  result.pooled.secondary_fit.equivalent_within_3+
  result.pooled.secondary_fit.primary_better_by_3,
  result.pooled.secondary_fit.possible);
 assert.ok(result.approved80.secondary_fit.versatile_share>=.15);
 assert.ok(result.approved80.secondary_fit.versatile_share<=.25);
 assert.equal(result.prior55.n,2000);
 assert.equal(result.uncorrected.n,2000);
 assert.equal(result.preTarget.n,2000);
 assert.equal(result.suitability_generation.mode,'automatic_target_first');
 assert.equal(result.suitability_generation.maximum_primary_suitability,90);
 assert.ok(result.suitability_generation.max_absolute_error<=.500001);
 assert.equal(Object.keys(result.core_floor.by_role).length,14);
 assert.ok(Object.values(result.core_floor.by_role).every(x=>x.players_changed>0));
 assert.ok(result.core_floor.corrected_attributes>0);
 // Removing alias-name draws changes the deterministic sample sequence.
 // Keep the invariant: role core-floor balancing never lowers shooting.
 const shot=result.comparison.trial_0143_before_after;
 assert.ok(Number.isInteger(shot.shooting_before)&&shot.shooting_before>=1&&shot.shooting_before<=99);
 assert.ok(Number.isInteger(shot.shooting_after)&&shot.shooting_after>=shot.shooting_before&&shot.shooting_after<=99);
 assert.ok(result.pooled.contrasts.ST__CB__shooting.pairwise_win_probability<1);
 assert.throws(()=>audit(1001),/Count must be/);
 return {passed:true,count_per_scenario:2000,seed_count:2,
  secondary_fit:result.pooled.secondary_fit,
  old_secondary_fit:result.approved80.secondary_fit,
  old_secondary_fit:result.preTarget.secondary_fit,
  core_floor:result.core_floor,
  suitability_generation:result.suitability_generation,
  meets_3_requested_bands:result.measured_target_met,
  role_tiers:result.role_tiers,no_persistence:true};
}
if(process.argv[1]&&process.argv[1].endsWith('players-generation-audit.mjs')){
 try{
  const args=process.argv.slice(2),get=flag=>{
   const i=args.indexOf(flag);return i<0?undefined:args[i+1];
  };
  if(args.includes('--help'))
   console.log('Usage: node tools/players-generation-audit.mjs [--self-test] [--count 1000] [--seeds seed1,seed2,seed3] (all 14 role-essential attribute floors and three-way positional suitability)');
  else if(args.includes('--self-test'))console.log(JSON.stringify(selfTest(),null,2));
  else{
   const rawCount=get('--count')??'1000';assert.match(rawCount,/^[0-9]+$/);
   const rawSeeds=get('--seeds');
   const seeds=rawSeeds===undefined?SEEDS:rawSeeds.split(',').map(s=>s.trim());
   console.log(JSON.stringify(audit(Number(rawCount),seeds),null,2));
  }
 }catch(err){console.error(err);process.exitCode=1;}
}
