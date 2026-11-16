// #628 M23 — candidate football decisions from ACTUAL closed Action LAB
// shoe/ball physics. A real foot START is contact, not possession or tackle.
// This pure read-only observer NEVER authenticates external fabricated inputs;
// its authority comes solely from the closed one-World Rapier call site.
import {INITIAL_PLAYERS} from './player-movement.mjs';

const freeze=Object.freeze;
const known=new Map(INITIAL_PLAYERS.map(p=>[p.id,p]));
const valid=(list)=>Array.isArray(list)&&
 new Set(list).size===list.length&&list.every(id=>known.has(id));
const finite=n=>Number.isFinite(n);
export function createPhysicalFootballDecisionObserver(){
 let lastTick=-1,active=new Set();
 let originalVerifiedPass=null,firstOpponentInterruption=null,
  firstRecipientContact=null;
 let nativeShoeStarts=0,exclusiveShoeStarts=0,ambiguousStarts=0;
 let candidateReceives=0,candidateOpponentInterruptions=0;
 let firstPassWitness=null,lastEvidence=null;
 function observe({physics,playerFrame,foot,action=null}={}){
  const tick=physics?.tick;
  if(!Number.isSafeInteger(tick)||tick!==lastTick+1||tick<0||
     playerFrame?.tick!==tick||foot?.tick!==tick||
     !Array.isArray(playerFrame.players)||playerFrame.players.length!==22||
     !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];
      return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
       [q.x,q.y].every(finite);
     })||
     !valid(foot.started)||!valid(foot.ended)||!valid(foot.active)||
     !physics.ball?.position||!physics.ball?.velocity||
     !['x','y','z'].every(k=>
      finite(physics.ball.position[k])&&
      finite(physics.ball.velocity[k])))
   throw new TypeError('M23 requires one consecutive original 22-player shoe/ball physics tick');
  if(tick===0&&(foot.started.length||foot.ended.length||foot.active.length))
   throw new TypeError('M23 source zero tick cannot contain events');
  const next=new Set(active);
  for(const id of foot.ended){
   if(!next.delete(id))
    throw new TypeError('M23 native shoe END requires an earlier active START');
  }
  for(const id of foot.started){
   if(next.has(id))
    throw new TypeError('M23 duplicate native shoe START');
   next.add(id);
  }
  if(next.size!==foot.active.length||
     !foot.active.every(id=>next.has(id)))
   throw new TypeError('M23 cannot infer shoe START/END from proximity or a stale source');
  if(action!==null&&(
     action.tick!==tick||
     !['pass','shot','cross','save','tackle','interception','carry','clearance'].includes(action.action)||
     !known.has(action.playerId)||
     action.team!==known.get(action.playerId).team||
     action.appliedByRapier!==true||
     action.actualPhysicsImpulseApplied!==true||
     action.officialMatchAction!==false||
     foot.started.length!==1||foot.active.length!==1||
     foot.started[0]!==action.playerId||
     foot.active[0]!==action.playerId))
   throw new TypeError('M23 rejects action claims without exclusive same-tick real Rapier START/impulse');
  const exclusive=foot.started.length===1&&
   foot.active.length===1&&foot.started[0]===foot.active[0];
  const postPass=originalVerifiedPass!==null&&
   originalVerifiedPass.tick<tick;
  const actor=exclusive?foot.started[0]:null;
  const opposition=postPass&&actor!==null&&
   known.get(actor).team!==originalVerifiedPass.team;
  const receiving=postPass&&actor!==null&&
   actor===originalVerifiedPass.recipientId&&
   firstOpponentInterruption===null;
  const ambiguous=foot.started.length>0&&!exclusive;
  let candidate=foot.started.length?'unclaimed-shoe-contact':'none';
  if(ambiguous)candidate='ambiguous-physical-contact';
  if(opposition){
   candidate='possible-opponent-pass-interruption';
   candidateOpponentInterruptions++;
   if(firstOpponentInterruption===null)
    firstOpponentInterruption=freeze({
     tick,playerId:actor,priorPassTick:originalVerifiedPass.tick,
     realRapierShoeStart:true,officialInterception:false,
     officialTackle:false,officialPossession:false
    });
  }else if(receiving){
   candidate='possible-post-pass-receiver-contact';
   candidateReceives++;
   if(firstRecipientContact===null)
    firstRecipientContact=freeze({
     tick,playerId:actor,priorPassTick:originalVerifiedPass.tick,
     realRapierShoeStart:true,officialReception:false,
     passCompleted:false,officialPossession:false
    });
  }
  nativeShoeStarts+=foot.started.length;
  if(exclusive)exclusiveShoeStarts++;
  if(ambiguous)ambiguousStarts++;
  if(action?.action==='pass'&&originalVerifiedPass===null){
   const recipient=action.passTarget?.recipientId??null;
   if(recipient!==null&&(
     !known.has(recipient)||
     known.get(recipient).team!==action.team||
     recipient===action.playerId))
    throw new TypeError('M23 pass recipient must be an actual original teammate');
   if(recipient!==null){
    originalVerifiedPass=freeze({
     tick,playerId:action.playerId,team:action.team,recipientId:recipient,
     actualRapierImpulse:true,actualExclusiveRapierShoeStart:true,
     officialPassCompleted:false,officialPossession:false
    });
    firstPassWitness=originalVerifiedPass;
   }
  }
  active=next;lastTick=tick;
  lastEvidence=freeze({
   tick,kind:candidate,shoeStarted:freeze([...foot.started]),
   shoeActive:freeze([...foot.active]),exclusiveRealShoeStart:exclusive,
   ambiguousSource:ambiguous,
   actorId:actor,priorPhysicalPassTick:postPass?originalVerifiedPass.tick:null,
   actualRapierImpulseOnTick:action!==null,
   physicalEventOnly:true,
   verifiedInterception:false,verifiedTackle:false,
   verifiedReception:false,verifiedPossession:false,
   officialMatchAction:false,officialResult:null
  });
  return snapshot();
 }
 function snapshot(){
  if(lastTick<0)throw new TypeError('M23 must observe source before exposing evidence');
  return freeze({
   version:'m23-real-shoe-causal-football-decision-candidates-v1',
   tick:lastTick,nativeShoeStarts,exclusiveShoeStarts,ambiguousStarts,
   potentialReceiverContactTicks:candidateReceives,
   potentialOpponentInterruptionTicks:candidateOpponentInterruptions,
   actualPriorPass:firstPassWitness,
   firstPossibleReception:firstRecipientContact,
   firstPossibleOpponentInterruption:firstOpponentInterruption,
   current:lastEvidence,
   nativeSourceObserverOnly:true,readOnly:true,
   matchAuthority:false,officialPossession:false,
   verifiedInterception:false,verifiedTackle:false,
   verifiedReception:false
  });
 }
 return freeze({observe,snapshot});
}
