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
export const DEFENSE_LAB_STARTS=Object.freeze({
 tackle:Object.freeze({
  home:scene('me-action-tackle-home',-30,0,0.28),
  away:scene('me-action-tackle-away',30,0,-0.28)
 }),
 interception:Object.freeze({
  home:scene('me-action-interception-home',-30,0,-2),
  away:scene('me-action-interception-away',30,0,2)
 })
});
export const SHOT_LAB_STARTS=Object.freeze({
 home:scene('me-action-shot-home',30,1,0),
 away:scene('me-action-shot-away',-30,-1,0)
});
// Base-action coverage: lofted wide deliveries, not completed crosses.
export const SAVE_LAB_STARTS=Object.freeze({
 home:Object.freeze({preset:'roll',seed:'me-action-keeper-save-home',
  x:-47.7,y:1.2,z:0,vx:-3,vy:1,vz:0}),
 away:Object.freeze({preset:'roll',seed:'me-action-keeper-save-away',
  x:47.7,y:-1.2,z:0,vx:3,vy:-1,vz:0})
});
export const CROSS_LAB_STARTS=Object.freeze({
 home:scene('me-action-cross-home',30,24),
 away:scene('me-action-cross-away',-30,-24)
});
export const CARRY_LAB_STARTS=Object.freeze({
 home:scene('me-action-carry-home',-4.96,0,0.3),
 away:scene('me-action-carry-away',4.96,0,-0.3)
});
// M4: mirror the *before-tick-zero* CONTROL ball and intended recipient.
// This never fabricates a Rapier START or bypasses the existing action policy.
export const CONTROL_LAB_STARTS=Object.freeze({
 home:scene('me-action-pass-receive',-4.96,0,0.3),
 away:scene('me-action-pass-receive-away',4.96,0,-0.3)
});
// #620 CHALLENGE: mirrored real shoe contact and physically empty counterfactual.
// The no-contact ball starts >15m from every original canonical shoe;
// no body, source event, momentum or score is constructed for a negative.
export const CHALLENGE_LAB_STARTS=Object.freeze({
 home:scene('me-action-challenge-home',-4.96),
 away:scene('me-action-opposition-shoe',4.96),
 noContact:scene('me-action-challenge-no-contact',0,30)
});
export const ACTION_LAB_SCENARIOS=Object.freeze([
 item('pass','Pass','uniform',scene('me-action-pass-home',-4.96,0,0.3),
  'Real shoe START + teammate-directed impulse; reception is not assumed.',
  ['home-10','home-9','away-10'],'pass'),
 item('shot','Shot','shot',SHOT_LAB_STARTS.home,
  'Only forward #10 starts next to the ball before tick zero; genuine Rapier shoe START, original shot lane and flight required. No goal awarded.',
  ['home-10','away-1','away-10'],'shot'),
 item('cross','Cross','shot',CROSS_LAB_STARTS.home,
  'A real wide #10 shoe START drives one lofted impulse toward the observed #9 in the box. Neither completion nor a goal is assumed.',
  ['home-10','home-9','away-1'],'cross'),
 item('save','Goalkeeper save','save',SAVE_LAB_STARTS.home,
  'An incoming goalward real ball triggers a bounded keeper lateral dive approach and, only on genuine exclusive Rapier shoe START, a physical parry attempt. No completed save.',
  ['home-1','away-10','away-1'],'save'),
 item('tackle','Tackle','defense',DEFENSE_LAB_STARTS.tackle.home,
  'Live defender #7 with a real nearby opponent attempts a physical poke on an almost stationary ball. Same native Rapier shoe START; no automatic ball recovery.',
  ['home-7','away-10','home-10'],'tackle'),
 item('interception','Interception','defense',
  DEFENSE_LAB_STARTS.interception.home,
  'Original defender #7 attempts to deflect an inbound moving ball under observed opponent pressure. An incoming trajectory is not proof of an opponent pass or a successful interception.',
  ['home-7','away-10','home-10'],'interception'),
 item('challenge','Challenge','challenge',
  CHALLENGE_LAB_STARTS.away,
  'Witness an opponent shoe-ball START only. An actual tackle/interception or ball recovery is NOT yet verified.',
  ['home-7','home-10','away-7'],'opponent-contact'),
 item('control','Control','control',
  CONTROL_LAB_STARTS.home,
  'A true HOME #10 PASS starts the receiver approach; only a later authentic HOME #9 shoe START counts as receiving contact. Possession or completed reception are never assumed.',
  ['home-9','home-10','away-10'],'control'),
 item('carry','Carry','carry',CARRY_LAB_STARTS.home,
  'Two actual opponents cover the safe PASS recipients before tick zero. A genuine #10 shoe START may then produce the original short CARRY impulse; never a confirmed dribble.',
  ['home-10','home-9','home-11','away-9','away-11'],'carry')
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
 tick,action=null,starts=[],priorPass=null,opponentEarlier=false,
 challengeSide='away'
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
    !['pass','shot','cross','save','tackle','interception','carry','clearance'].includes(action.action)))
  throw new TypeError('Never award an action without a single same-tick real shoe START');
 if(typeof opponentEarlier!=='boolean')throw new TypeError('Boolean contact history required');
 if(!['home','away'].includes(challengeSide))
  throw new TypeError('Known controlled contact side required');
 if(priorPass!==null&&(
    !Number.isSafeInteger(priorPass.tick)||priorPass.tick>=tick||
    typeof priorPass.playerId!=='string'||
    typeof priorPass.recipientId!=='string'||
    priorPass.recipientId===priorPass.playerId||
    !priorPass.recipientId.startsWith(priorPass.team+'-')||
    !['home','away'].includes(priorPass.team)))
  throw new TypeError('Invalid prior genuine physical pass');
 const pass=spec.goal==='pass'&&action?.action==='pass';
 const shot=spec.goal==='shot'&&action?.action==='shot';
 const cross=spec.goal==='cross'&&action?.action==='cross';
 const save=spec.goal==='save'&&action?.action==='save';
 const tackle=spec.goal==='tackle'&&action?.action==='tackle';
 const interception=spec.goal==='interception'&&
  action?.action==='interception';
 const carry=spec.goal==='carry'&&action?.action==='carry';
 const receiver=spec.goal==='control'&&priorPass!==null&&
  !opponentEarlier&&starts.length===1&&
  starts[0]===priorPass.recipientId;
 const opposition=spec.goal==='opponent-contact'&&
  starts.length===1&&starts[0].startsWith(challengeSide+'-');
 const witness=Boolean(pass||shot||cross||save||tackle||interception||carry||receiver||opposition);
 return Object.freeze({
  tick,witnessed:witness,kind:spec.goal,
  verifiedShoeImpulse:Boolean(pass||shot||cross||save||tackle||interception||carry),
  realContactObserved:starts.length>0,
  verifiedReceivingShoeContact:Boolean(receiver),
  observedOpponentShoeContact:Boolean(opposition),
  officialPossession:false,officialGoal:false,officialMatchAction:false,
  tackleConfirmed:null,dribbleConfirmed:null,passCompleted:null
 });
}
