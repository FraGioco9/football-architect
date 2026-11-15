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
  'Controlled attacking-third starting positions; genuine Rapier shot, never a claimed natural 11v11 goal.',
  ['home-10','away-1','away-10'],'shot'),
 item('challenge','Challenge','challenge',
  scene('me-action-opposition-shoe',-19.35),
  'Opposition contact and contested ball only; successful tackle or interception remains unconfirmed.',
  ['home-7','home-10','away-7'],'opponent-contact'),
 item('control','Control','control',
  scene('me-action-pass-receive',-19.35),
  'Separate real receiving shoe contact after a physical pass; no official possession.',
  ['home-7','home-10'],'control'),
 item('carry','Carry','carry',scene('me-action-carry-home',-4.96,0,0.3),
  'Real short shoe-origin carry impulse and continuation; no completed dribble classification.',
  ['home-10','away-10','home-9'],'carry')
]);
export function getActionLabScenario(id){
 const value=ACTION_LAB_SCENARIOS.find(x=>x.id===id);
 if(!value)throw new RangeError('Unknown controlled Match Engine action LAB');
 return value;
}
// This projection never makes a football outcome claim. A visible positive
// event must be derived from the actual private Rapier engine/session.
export function classifyActionLabEvidence(spec,{tick,action=null,starts=[],events=[]}={}){
 if(!Number.isSafeInteger(tick)||tick<0||
    !Array.isArray(starts)||!Array.isArray(events)||
    !spec||!ACTION_LAB_SCENARIOS.includes(spec))
  throw new TypeError('Invalid observed LAB evidence');
 if(action!==null&&(
    action.tick!==tick||action.appliedByRapier!==true||
    action.actualPhysicsImpulseApplied!==true||
    action.officialMatchAction!==false||
    starts.length!==1||starts[0]!==action.playerId))
  throw new TypeError('LAB action requires actual same-tick sole Rapier shoe START');
 const shot=spec.goal==='shot'&&action?.action==='shot';
 const pass=spec.goal==='pass'&&action?.action==='pass';
 const carry=spec.goal==='carry'&&action?.action==='carry';
 const control=spec.goal==='control'&&
  events.some(e=>e.stage==='control'&&e.tick===tick&&e.appliedByRealRapier===true);
 const opposing=spec.goal==='opponent-contact'&&
  starts.some(id=>id.startsWith('away-'))&&
  events.some(e=>e.playerId===idFromStarts(starts)&&e.tick===tick);
 const witnessed=Boolean(shot||pass||carry||control||opposing);
 return Object.freeze({
  tick,witnessed,kind:spec.goal,
  verifiedShoeImpulse:Boolean(pass||shot||carry),
  realContactObserved:Boolean(starts.length),
  officialPossession:false,officialGoal:false,
  tackleConfirmed:null,dribbleConfirmed:null,passCompleted:null
 });
}
function idFromStarts(starts){return starts.find(x=>x.startsWith('away-'))??null;}
