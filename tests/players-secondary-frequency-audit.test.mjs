import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {generateTrial,AUTO_SECONDARY_COUNT_WEIGHTS} from '../tools/players-generation-trial.mjs';

test('#518 baseline: exact manual secondaries and explicit count remain supported',()=>{
 const base={count:2,seed:'players-518-manual',primaryNationality:'ITA',primaryPosition:'ST'};
 const empty=generateTrial({...base,secondaryPositions:[]});
 assert.ok(empty.candidates.every(p=>p.secondary_positions.length===0));
 const exact=generateTrial({...base,secondaryPositions:['AM','RW']});
 assert.ok(exact.candidates.every(p=>p.secondary_positions.join(',')==='AM,RW'));
 const number=generateTrial({...base,secondaryCount:5});
 assert.ok(number.candidates.every(p=>p.secondary_positions.length===5));
 const restricted=generateTrial({...base,secondaryCount:1,allowedSecondaries:['AM']});
 assert.ok(restricted.candidates.every(p=>p.secondary_positions.join(',')==='AM'));
 assert.deepEqual(exact,generateTrial({...base,secondaryPositions:['AM','RW']}));
});
test('#518 baseline: goalkeeper always has zero secondary positions',()=>{
 const sample=generateTrial({count:8,seed:'players-518-goalkeeper',primaryPosition:'GK',primaryNationality:'ITA'});
 assert.ok(sample.candidates.every(p=>p.secondary_positions.length===0));
 assert.throws(()=>generateTrial({count:1,primaryPosition:'GK',secondaryCount:1}),/Secondary-position count impossible/);
});

test('#518 owner-approved A is active; three seeded cohorts have fewer multiple secondaries',()=>{
 assert.deepEqual([...AUTO_SECONDARY_COUNT_WEIGHTS],[45,35,15,4,.9,.1]);
 assert.ok(Math.abs(AUTO_SECONDARY_COUNT_WEIGHTS.reduce((a,b)=>a+b,0)-100)<1e-9);
 // The audit measures the ACTUAL canonical generator, not just theoretical weights.
 const raw=execFileSync(process.execPath,['tools/players-secondary-frequency-audit.mjs','--json'],
  {encoding:'utf8',maxBuffer:2*1024*1024});
 const report=JSON.parse(raw);
 assert.equal(report.pooled.n,3000);
 assert.equal(report.seeds.length,3);
 assert.deepEqual(report.theoretical.activeApprovedWeights,[45,35,15,4,.9,.1]);
 assert.deepEqual(report.theoretical.pooledActive,[49.95,31.85,13.65,3.64,.819,.091]);
 const fit=report.suitability;
 assert.equal(fit.n,fit.counts.better+fit.counts.equivalent+fit.counts.primary);
 assert.equal(fit.n,report.pooled.n-report.pooled.counts[0]);
 // Owner-approved #399 windows, unchanged; these are measured from attributes.
 assert.ok(fit.percent.better>=5&&fit.percent.better<=10,
  'Secondary-better 5–10%: '+JSON.stringify(fit));
 assert.ok(fit.percent.equivalent>=20&&fit.percent.equivalent<=25,
  'Secondary-equivalent 20–25%: '+JSON.stringify(fit));
 assert.ok(fit.percent.primary>=65&&fit.percent.primary<=75,
  'Primary-better 65–75%: '+JSON.stringify(fit));
 assert.equal(Object.keys(report.byRole).length,14);
 assert.deepEqual(report.byRole.GK.counts.slice(1),[0,0,0,0,0]);
 const out=report.outfield;
 const share=out.counts.map(n=>n/out.n);
 assert.ok(share[0]>.39&&share[0]<.51,'0 secondary positions should dominate outfield automatic generation');
 assert.ok(share[1]>.28&&share[1]<.42,'1 secondary should remain common');
 assert.ok(share.slice(2).reduce((a,b)=>a+b,0)>.14&&
  share.slice(2).reduce((a,b)=>a+b,0)<.26,'2+ secondaries must be much rarer than the 40% prior baseline');
 assert.ok(share.slice(4).reduce((a,b)=>a+b,0)<.03,'4–5 secondaries must be exceptional');
 for(const row of [...report.seeds.map(s=>s.overall),report.pooled,...Object.values(report.byRole)]){
  assert.equal(row.counts.reduce((a,b)=>a+b,0),row.n);
 }
 console.log('SECONDARY #518 measured 3x1000:',JSON.stringify({
  pooled:report.pooled,outfield:report.outfield,
  perSeed:report.seeds.map(s=>({seed:s.seed,counts:s.overall.counts})),
  gkCount:report.byRole.GK.n,suitability:report.suitability
 }));
});
