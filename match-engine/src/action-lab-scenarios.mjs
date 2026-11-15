// ME-ACTIONS-LAB #620: single source of truth for bounded DEV action scenes.
// A real shoe collision/impulse is required. These labels do NOT attest an
// official pass completion, possession, tackle, dribble or scored goal.
const scene=(seed,x,y=0,vx=0)=>Object.freeze({
 preset:'roll',seed,x,y,z:0,vx,vy:0,vz:0
});
const item=(id,title,mode,initial,description,focus,goal)=>Object.freeze({
 id,title,mode,initial,description,focus:Object.freeze(focus),goal,
 source:'one-canonical-rapier-ball-and-22-physical-feet',
 officialResult:false
});
export const ACTION_LAB_SCENARIOS=Object.freeze([
 item('pass','Pass','uniform',scene('me-action-pass-home',-4.96,0,0.3),
  'Real shoe START + teammate-directed impulse; reception is not assumed.',
  ['home-10','home-9','away-10'],'pass'),
 item('shot','Shot','shot',scene('me-action-shot-home',30,1,0),
  'Physical attacking-third shot trial in the original canonical formation. A SHOT is pending until an actual same-tick shoe START and original shot lane; no goal awarded.',
  ['home-10','away-1','away-10'],'shot'),
 item('challenge','Challenge','challenge',
  scene('me-action-opposition-shoe',4.96),
  'Witness an opponent shoe-ball START only. An actual tackle/interception or ball recovery is NOT yet verified.',
  ['home-7','home-10','away-7'],'opponent-contact'),
 item('control','Control','control',
  scene('me-action-pass-receive',-19.35),
  'Watch for a separate teammate shoe-ball START after an actual pass; receiving contact is not guaranteed or official possession.',
  ['home-7','home-10'],'control'),
 item('carry','Carry','carry',scene('me-action-carry-home',-4.96,0,0.3),
  'Observe a source-authenticated short CARRY impulse if physical gates allow it; no completed dribble classification.',
  ['home-10','away-10','home-9'],'carry')
]);
export function getActionLabScenario(id){
 const value=ACTION_LAB_SCENARIOS.find(x=>x.id===id);
 if(!value)throw new RangeError('Unknown controlled Match Engine action LAB');
 return value;
}
// This projection never makes a football outcome claim. A visible positive
// event must be derived from the actual private Rapier engine/session.
// A read-only projection. The caller cannot authenticate Rapier events;
// ONLY the closed createEngine-produced shoe timeline/action does so.
export function classifyActionLabEvidence(spec,{
 tick,action=null,starts=[],priorPass=null
}={}){
 if(!spec||!ACTION_LAB_SCENARIOS.includes(spec)||
    !Number.isSafeInteger(tick)||tick<0||
    !Array.isArray(starts)||new Set(starts).size!==starts.length||
    starts.some(id=>typeof id!=='string'||
      !/^(home|away)-(?:[1-9]|10|11)$/.test(id)))
  throw new TypeError('Invalid measured Action LAB frame');
 if(action!==null&&(
    action.tick!==tick||action.appliedByRapier!==true||
    action.actualPhysicsImpulseApplied!==true||
    action.officialMatchAction!==false||
    starts.length!==1||starts[0]!==action.playerId||
    !['pass','shot','carry','clearance'].includes(action.action)))
  throw new TypeError('Never award an action without a single same-tick real shoe START');
 if(priorPass!==null&&(
    !Number.isSafeInteger(priorPass.tick)||priorPass.tick>=tick||
    typeof priorPass.playerId!=='string'||
    !['home','away'].includes(priorPass.team)))
  throw new TypeError('Invalid prior genuine physical pass');
 const pass=spec.goal==='pass'&&action?.action==='pass';
 const shot=spec.goal==='shot'&&action?.action==='shot';
 const carry=spec.goal==='carry'&&action?.action==='carry';
 const receiver=spec.goal==='control'&&priorPass!==null&&
  starts.some(id=>id!==priorPass.playerId&&
    id.startsWith(priorPass.team+'-'));
 const opposition=spec.goal==='opponent-contact'&&
  starts.some(id=>id.startsWith('away-'));
 const witness=Boolean(pass||shot||carry||receiver||opposition);
 return Object.freeze({
  tick,witnessed:witness,kind:spec.goal,
  verifiedShoeImpulse:Boolean(pass||shot||carry),
  realContactObserved:starts.length>0,
  verifiedReceivingShoeContact:Boolean(receiver),
  observedOpponentShoeContact:Boolean(opposition),
  officialPossession:false,officialGoal:false,officialMatchAction:false,
  tackleConfirmed:null,dribbleConfirmed:null,passCompleted:null
 });
}
