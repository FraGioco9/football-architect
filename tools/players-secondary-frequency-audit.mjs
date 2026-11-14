#!/usr/bin/env node
// #518 — read-only secondary-position frequency audit of the canonical generator.
// node tools/players-secondary-frequency-audit.mjs [--json]
// Read-only evidence after #518 owner approved calibration A. No writes.
import assert from 'node:assert/strict';
import {generateTrial,AUTO_SECONDARY_COUNT_WEIGHTS,calculatePositionSuitability} from './players-generation-trial.mjs';

// Keep the exact three official #399 role-calibration seeds, not a different cohort.
const SEEDS=['fa-official-trial-01','fa-audit-independent-02','fa-audit-independent-03'];
const ROLES='GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' ');
const BASELINE=[25,35,25,11,3.5,.5]; // Historical outfield baseline before approved #518 A.
const CANDIDATES={
 strong:[55,32,10,2.5,.45,.05]
}; // B remains unapproved; proposals are never used to generate candidates.
const sum=a=>a.reduce((total,n)=>total+n,0);
const pct=(count,total)=>Number((100*count/total).toFixed(2));
function summarize(players){
 const counts=Array(6).fill(0);
 for(const player of players){
  const positions=player.secondary_positions;
  assert.ok(Array.isArray(positions)&&positions.length<=5);
  assert.ok(ROLES.includes(player.primary_position));
  assert.equal(new Set(positions).size,positions.length);
  assert.ok(positions.every(role=>ROLES.includes(role)&&role!==player.primary_position));
  if(player.primary_position==='GK')assert.equal(positions.length,0);
  counts[positions.length]++;
 }
 return {n:players.length,counts,percent:counts.map(n=>pct(n,players.length))};
}
// All suitability buckets are DERIVED from generated attributes; no quotas.
function secondarySuitability(players){
 const counts={better:0,equivalent:0,primary:0};
 for(const player of players){
  if(!player.secondary_positions.length)continue;
  const primary=calculatePositionSuitability(player.attributes,player.primary_position);
  const best=Math.max(...player.secondary_positions.map(role=>
   calculatePositionSuitability(player.attributes,role)));
  const delta=best-primary;
  if(delta>=3)counts.better++;
  else if(delta<=-3)counts.primary++;
  else counts.equivalent++;
 }
 const n=sum(Object.values(counts));
 return {n,counts,percent:Object.fromEntries(Object.entries(counts).map(
  ([key,value])=>[key,n?pct(value,n):null]))};
}
function expectation(weights){
 assert.equal(weights.length,6);
 assert.equal(sum(weights),100);
 // The canonical primary-position draw allocates 9% to GK (no secondaries)
 // and 91% to outfield. These are mathematical expectations, not cohort results.
 return weights.map((w,i)=>Number(((i===0?9:0)+.91*w).toFixed(3)));
}
function report(){
 const cohorts=SEEDS.map(seed=>{
  const players=generateTrial({count:1000,seed}).candidates;
  return {seed,players,overall:summarize(players),
   outfield:summarize(players.filter(p=>p.primary_position!=='GK')),
   suitability:secondarySuitability(players)};
 });
 const all=cohorts.flatMap(c=>c.players);
 const byRole=Object.fromEntries(ROLES.map(role=>[role,summarize(all.filter(p=>p.primary_position===role))]));
 return {
  issue:518,mode:'read-only approved A',seedCount:SEEDS.length,
  cohortSize:1000,seeds:cohorts.map(({seed,overall,outfield,suitability})=>({seed,overall,outfield,suitability})),
  pooled:summarize(all),outfield:summarize(all.filter(p=>p.primary_position!=='GK')),
  suitability:secondarySuitability(all),
  byRole,
  theoretical:{
   status:'model predictions, not observed results; assumes 9% GK',
   baselineOutfieldWeights:BASELINE,
   pooledBaseline:expectation(BASELINE),
   activeApprovedWeights:[...AUTO_SECONDARY_COUNT_WEIGHTS],
   pooledActive:expectation(AUTO_SECONDARY_COUNT_WEIGHTS),
   proposedCandidates:Object.fromEntries(Object.entries(CANDIDATES).map(([name,w])=>[name,{
    outfieldWeights:w,pooledExpectation:expectation(w)}]))
  },
  caveats:[
   'Observed rows use owner-approved distribution A; historical baseline and proposal B are analytical only.',
   'Deterministic 1000-player seeds are not population-wide confidence estimates.',
   'Explicit secondaryCount and secondaryPositions modes are not modified.'
  ]
 };
}
function markdown(r){
 const rows=[['Historical baseline (model)',r.theoretical.pooledBaseline],
  ['Approved A active (model)',r.theoretical.pooledActive],
  ...Object.entries(r.theoretical.proposedCandidates).map(([name,p])=>[name+' (unapproved)',p.pooledExpectation])];
 const lines=['# #518 — Secondary-position frequency audit','',
  'Approved A canonical generator, three deterministic 1,000-player cohorts.','',
  '| Number of secondaries | 0 | 1 | 2 | 3 | 4 | 5 |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...r.seeds.map(s=>['Seed '+s.seed,...s.overall.percent.map(v=>v.toFixed(2)+'%')].join(' | ').replace(/^/,'| ' )+' |'),
  '| **Observed pooled** | '+r.pooled.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |',
  '| **Observed outfield** | '+r.outfield.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |',
  ...rows.map(([name,values])=>'| '+name+' | '+values.map(n=>n.toFixed(2)+'%').join(' | ')+' |'),
  '', 'Mathematical rows are NOT sample measurements. A is active in the generator; B remains unapproved.','',
  '## By primary position','',
  '| Role | N | 0 | 1 | 2 | 3 | 4 | 5 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(r.byRole).map(([role,s])=>'| '+role+' | '+s.n+' | '+s.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |'),
  '', '## Derived secondary suitability (players with 1–5 secondaries only)',
  '', '| Cohort | N | Secondary better (>= +3) | Equivalent (-3 to +3) | Primary better (<= -3) |',
  '|---|---:|---:|---:|---:|',
  ...r.seeds.map(s=>'| '+s.seed+' | '+s.suitability.n+' | '+
   ['better','equivalent','primary'].map(k=>s.suitability.percent[k].toFixed(2)+'%').join(' | ')+' |'),
  '| **Pooled** | '+r.suitability.n+' | '+
   ['better','equivalent','primary'].map(k=>r.suitability.percent[k].toFixed(2)+'%').join(' | ')+' |',
  '', 'Buckets use the role-weighted Suitability 2.0 (65% core + 25% support + 10% additional); no quota is enforced.',
  '', 'The report is informational only; no DB writes, schema changes or player edits.'
 ];
 return lines.join('\n');
}
const data=report();
if(process.argv.includes('--json'))console.log(JSON.stringify(data,null,2));
else console.log(markdown(data));
