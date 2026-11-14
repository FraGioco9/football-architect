// C2-a research-only positive witness discovery: real 22-player Rapier worlds.
// Run from match-engine: node tools/c2a-positive-rapier-discovery.mjs [cases] [ticks]
// This is NOT an acceptance test. A missing witness is reported, never invented.
// No injected shoe contacts, action events, ball teleport or fixture mutation.
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const input=(index,fallback,max)=>{
 const raw=process.argv[index];
 if(raw===undefined)return fallback;
 const n=Number(raw);
 if(!Number.isSafeInteger(n)||n<1||n>max)
  throw new RangeError('Expected integer 1..'+max+' at argument '+index);
 return n;
};
const maxCases=input(2,36,120),ticks=input(3,720,900);
const fixture=Object.freeze({
 id:'season:1:DE-1:N01:DE-1:DE-2',
 competitionId:'DE-1',marker:'N01',day:1,round:1,
 homeClubId:'DE-1',awayClubId:'DE-2'
});
const base=Object.freeze({
 autonomousActions:true,autonomousCarry:true,
 autonomousCarrySupport:true,autonomousCarrySupportPressHandoff:true
});
const trial=Object.freeze({...base,autonomousCarryAttackContinuity:true});
// All variants are initial ball conditions, not subsequent movement inputs.
// The known y=0 natural PASS/CARRY replay is kept first as a negative control.
// Never use variants.slice(0,maxCases): it exhausts one x slice first.
const variants=[];
for(const x of [4.96,7,10,13])
 for(const y of [0,4,-4,8,-8,12,-12,16,-16,18,-18])
  for(const vy of [0,0.3,-0.3])
   variants.push(Object.freeze({x,y,vy}));
const sampled=[variants[0],...Array.from({length:maxCases-1},(_,i)=>
 variants[1+Math.floor((i+0.5)*(variants.length-1)/(maxCases-1))])];
assert.equal(new Set(sampled).size,maxCases,
 'sample must have unique initial ball conditions');
assert.ok(new Set(sampled.map(v=>v.x)).size>=
 (maxCases>=12?4:Math.min(2,maxCases)),
 'bounded search must span multiple pitch depths');
const scenarios=sampled.map((v,i)=>Object.freeze({
 preset:'roll',seed:'c2a-genuine-'+String(i).padStart(3,'0'),
 x:v.x,y:v.y,z:0,vx:-0.3,vy:v.vy,vz:0
}));
const duty=(frame,id)=>frame.contactDecisionObservation.duties
 .find(d=>d.engineId===id)?.movementDuty??null;
const provenance=(frame)=>{
 const action=frame.localAutonomousAction;
 if(!action)return null;
 const starts=frame.physicalContactFeed.started;
 const active=frame.physicalContactFeed.active;
 assert.equal(starts.length,1);
 assert.equal(active.length,1);
 assert.equal(starts[0].engineId,action.playerId);
 assert.equal(active[0].engineId,action.playerId);
 assert.equal(starts[0].team,action.team);
 assert.equal(action.tick,frame.physicsTick);
 assert.equal(action.appliedByRapier,true);
 assert.equal(action.actualPhysicsImpulseApplied,true);
 assert.equal(action.physicalTrigger,'same-tick-real-rapier-shoe-start');
 assert.equal(action.officialMatchAction,false);
 return Object.freeze({tick:action.tick,team:action.team,
  playerId:action.playerId,action:action.action});
};
function runSearch(R,scenario){
 const world=createPhysicalFixtureStepRuntime(R,fixture,scenario,trial);
 const events=[];
 let lastAudit=null,firstResidual=null,positive=null;
 try{
  for(let t=1;t<=ticks;t++){
   const frame=world.step();
   assert.equal(frame.physicsTick,t);
   assert.equal(frame.playerCount,22);
   assert.equal(frame.officialMatchPossession,false);
   assert.equal(frame.officialMatchResult,null);
   const event=provenance(frame);
   if(event)events.push(event);
   const audit=frame.continuityAudit;
   assert.ok(audit,'DEV candidate audit must be exposed');
   if(!firstResidual&&audit.firstResidualConflict)
    firstResidual=audit.firstResidualConflict;
   if(audit.retainedSupport>(lastAudit?.retainedSupport??0)){
    const support=frame.contactDecisionObservation.attackSupportRun;
    // Use THIS tick's retained runner, not the cumulative first swap:
    // later authentic contacts may qualify a different runner.
    if(support?.phase==='post-carry-support'&&
       duty(frame,support.playerId)==='attack-support-intent'){
      const witness=Object.freeze({
       tick:t,team:support.team,runnerId:support.playerId,
       sourcePassTick:support.sourcePassTick,
       sourceCarryTick:support.carryContinuation.sourceCarryTick
      });
      const pass=events.find(e=>e.tick===witness.sourcePassTick&&
       e.action==='pass'&&e.team===witness.team);
      const carry=events.find(e=>e.tick===witness.sourceCarryTick&&
       e.action==='carry'&&e.team===witness.team);
      if(pass&&carry&&carry.tick>pass.tick&&
         t-pass.tick>240&&t-pass.tick<=480&&
         t-carry.tick<=150&&t>carry.tick){
       positive=Object.freeze({tick:t,witness,pass,carry,
        supportId:support.playerId});
       break;
      }
    }
   }
   lastAudit=audit;
  }
  const audit=world.snapshot().continuityAudit;
  const passes=events.filter(e=>e.action==='pass');
  const carries=events.filter(e=>e.action==='carry');
  const sameTeamPassCarry=carries.some(c=>passes.some(p=>
   p.team===c.team&&p.tick<c.tick));
  return Object.freeze({scenario,firstResidual,positive,
   audit,observedPhysicalActions:events.length,
   passes:passes.length,carries:carries.length,sameTeamPassCarry});
 }finally{world.dispose();}
}
// Validate the discovered case afresh against a baseline and two completely
// independent opt-in Rapier sessions; no reuse of state or injected events.
function verifyPositive(R,result){
 const sessions=[
  createPhysicalFixtureStepRuntime(R,fixture,result.scenario,base),
  createPhysicalFixtureStepRuntime(R,fixture,result.scenario,trial),
  createPhysicalFixtureStepRuntime(R,fixture,result.scenario,trial)
 ];
 try{
  const firstConflict=result.firstResidual.tick;
  let verified=false;
  for(let tick=1;tick<=result.positive.tick;tick++){
   const [baseline,candidate,replay]=sessions.map(w=>w.step());
   assert.deepEqual(candidate,replay,
    'independent actual 22-player Rapier replay at '+tick);
   if(tick<firstConflict){
    assert.equal(baseline.canonicalBall,candidate.canonicalBall);
    assert.deepEqual(baseline.physicalPlayerPositions,
     candidate.physicalPlayerPositions);
    assert.deepEqual(baseline.physicalContactFeed,
     candidate.physicalContactFeed);
   }
   provenance(baseline);provenance(candidate);
   if(tick===result.positive.tick){
    const id=result.positive.witness.runnerId;
    const attack=candidate.contactDecisionObservation.attackSupportRun;
    assert.equal(duty(baseline,id),'press',
     'positive witness requires the genuine baseline to press');
    assert.equal(duty(candidate,id),'attack-support-intent',
     'C2-a must preserve the forward actual movement duty');
    assert.equal(attack?.playerId,id);
    assert.equal(attack?.phase,'post-carry-support');
    assert.ok(candidate.continuityAudit.residualConflicts>0);
    assert.ok(candidate.continuityAudit.c2aResolved>0);
    assert.ok(candidate.continuityAudit.retainedSupport>0);
    verified=true;
   }
  }
  assert.ok(verified,'no verified real baseline-vs-candidate contrast');
  const [a,b]=sessions.slice(1).map(w=>w.reset());
  try{
   assert.equal(a.snapshot().physicsTick,0);
   assert.equal(a.snapshot().continuityAudit.eligible,0);
   for(let i=0;i<30;i++)assert.deepEqual(a.step(),b.step());
  }finally{a.dispose();b.dispose();}
  return true;
 }finally{sessions.forEach(s=>s.dispose());}
}
const R=await initializeRapier(rapier);
let best=null,examined=0,physicalActions=0;
let withPass=0,withCarry=0,withSameTeamPassCarry=0,withEligible=0;
let withPreConflict=0,withC23nResolved=0,withResidual=0;
let withRetained=0,rejectedCounterfactuals=[];
const score=a=>[
 a.audit.retainedSupport,a.audit.residualConflicts,
 a.audit.preHandoffConflicts,a.audit.c23nResolved,
 a.audit.eligible,Number(a.sameTeamPassCarry),a.observedPhysicalActions
];
const better=(a,b)=>{
 if(!b)return true;
 const as=score(a),bs=score(b);
 for(let i=0;i<as.length;i++){
  if(as[i]!==bs[i])return as[i]>bs[i];
 }
 return false;
};
for(const scenario of scenarios){
 const outcome=runSearch(R,scenario),a=outcome.audit;
 examined++;
 physicalActions+=outcome.observedPhysicalActions;
 if(outcome.passes)withPass++;
 if(outcome.carries)withCarry++;
 if(outcome.sameTeamPassCarry)withSameTeamPassCarry++;
 if(a.eligible)withEligible++;
 if(a.preHandoffConflicts)withPreConflict++;
 if(a.c23nResolved)withC23nResolved++;
 if(a.residualConflicts)withResidual++;
 if(a.retainedSupport)withRetained++;
 if(better(outcome,best))best=outcome;
 if(outcome.positive){
  // A positive candidate is not accepted unless independent A/B succeeds.
  try{
   const accepted=verifyPositive(R,outcome);
   console.log('C2_A_POSITIVE_REAL_RAPIER_WITNESS',JSON.stringify({
    accepted,examined,outcome
   }));
   process.exit(0);
  }catch(error){
   rejectedCounterfactuals.push(Object.freeze({
    scenario,firstResidual:outcome.firstResidual,
    reason:String(error.message)
   }));
  }
 }
}
// Exit nonzero so this diagnostic cannot be mistaken for positive coverage.
console.log('C2_A_NO_POSITIVE_RAPIER_WITNESS',JSON.stringify({
 examined,ticks,physicalActions,initialXValues:[...new Set(sampled.map(v=>v.x))],
 withPass,withCarry,withSameTeamPassCarry,withEligible,withPreConflict,
 withC23nResolved,withResidual,withRetained,
 bestScenario:best?.scenario??null,bestAudit:best?.audit??null,
 bestSameTeamPassCarry:best?.sameTeamPassCarry??false,
 rejectedCounterfactuals
}));
process.exitCode=2;
