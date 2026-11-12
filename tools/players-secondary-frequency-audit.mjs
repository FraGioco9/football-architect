#!/usr/bin/env node
// #518 — read-only secondary-position frequency audit of the canonical generator.
// node tools/players-secondary-frequency-audit.mjs [--json]
// No writes, no production data, and no change to the generator's probabilities.
import assert from 'node:assert/strict';
import {generateTrial} from './players-generation-trial.mjs';

const SEEDS=['fa-official-trial-01','fa-phase1-independent-02','fa-phase1-independent-03'];
const ROLES='GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' ');
const BASELINE=[25,35,25,11,3.5,.5]; // Current outfield automatic weights, source audited 2026-11-12.
const CANDIDATES={
 moderate:[45,35,15,4,.9,.1],
 strong:[55,32,10,2.5,.45,.05]
}; // Unapproved proposals; NEVER used to generate candidates.
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
   outfield:summarize(players.filter(p=>p.primary_position!=='GK'))};
 });
 const all=cohorts.flatMap(c=>c.players);
 const byRole=Object.fromEntries(ROLES.map(role=>[role,summarize(all.filter(p=>p.primary_position===role))]));
 return {
  issue:518,mode:'read-only',seedCount:SEEDS.length,
  cohortSize:1000,seeds:cohorts.map(({seed,overall,outfield})=>({seed,overall,outfield})),
  pooled:summarize(all),outfield:summarize(all.filter(p=>p.primary_position!=='GK')),
  byRole,
  theoretical:{
   status:'model predictions, not observed results; assumes 9% GK',
   baselineOutfieldWeights:BASELINE,
   pooledBaseline:expectation(BASELINE),
   proposedCandidates:Object.fromEntries(Object.entries(CANDIDATES).map(([name,w])=>[name,{
    outfieldWeights:w,pooledExpectation:expectation(w)}]))
  },
  caveats:[
   'The unmodified generator produced observed rows; proposals did not affect generation.',
   'Deterministic 1000-player seeds are not population-wide confidence estimates.',
   'Explicit secondaryCount and secondaryPositions modes are not modified.'
  ]
 };
}
function markdown(r){
 const rows=[['Current (model)',r.theoretical.pooledBaseline],
  ...Object.entries(r.theoretical.proposedCandidates).map(([name,p])=>[name+' (proposal)',p.pooledExpectation])];
 const lines=['# #518 — Secondary-position frequency audit','',
  'Unmodified canonical generator, three deterministic 1,000-player cohorts.','',
  '| Number of secondaries | 0 | 1 | 2 | 3 | 4 | 5 |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...r.seeds.map(s=>['Seed '+s.seed,...s.overall.percent.map(v=>v.toFixed(2)+'%')].join(' | ').replace(/^/,'| ' )+' |'),
  '| **Observed pooled** | '+r.pooled.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |',
  '| **Observed outfield** | '+r.outfield.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |',
  ...rows.map(([name,values])=>'| '+name+' | '+values.map(n=>n.toFixed(2)+'%').join(' | ')+' |'),
  '', 'Mathematical rows are NOT sample measurements. The two candidates are unapproved and not active.','',
  '## By primary position','',
  '| Role | N | 0 | 1 | 2 | 3 | 4 | 5 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(r.byRole).map(([role,s])=>'| '+role+' | '+s.n+' | '+s.percent.map(v=>v.toFixed(2)+'%').join(' | ')+' |'),
  '', 'The report is informational only; no DB writes, schema changes or player edits.'
 ];
 return lines.join('\n');
}
const data=report();
if(process.argv.includes('--json'))console.log(JSON.stringify(data,null,2));
else console.log(markdown(data));
