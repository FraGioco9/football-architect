// P1 draft: choose a football intention from EXPLICIT observed affordances.
// No Rapier, body motion, contact synthesis, ball impulse or official outcome.
// These qualitative priorities are PROPOSED, not approved for runtime wiring.
export const FOOTBALL_INTENT_VERSION='me-p1-observed-intent-draft-v1';
export const FOOTBALL_INTENT_PRIORITIES=Object.freeze({
 'ball-opportunity':Object.freeze(['shoot','pass','advance','retain','reposition']),
 'attack-off-ball':Object.freeze(['support','reposition']),
 'defend-off-ball':Object.freeze(['press','cover','recover'])
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>p&&finite(p.x)&&finite(p.y);
const identifier=v=>typeof v==='string'&&v.length>0&&v.length<=80;
const safeTick=n=>Number.isSafeInteger(n)&&n>=0;
const needsPlayer=new Set(['pass','press']);
// Retention is targetless intent only, never an authoritative possession signal.
const noTarget=new Set(['retain']);
const compare=(a,b)=>a<b?-1:a>b?1:0;

function validateObservation(o){
 if(!o||!safeTick(o.physicsTick)||o.physicsTick===0||
    !identifier(o.playerId)||!['home','away'].includes(o.team)||
    !Object.hasOwn(FOOTBALL_INTENT_PRIORITIES,o.phase)||
    !o.frame||!safeTick(o.frame.tick)||
    o.frame.tick>o.physicsTick||o.physicsTick-o.frame.tick>1||
    !o.frame.ball||!point(o.frame.ball)||!finite(o.frame.ball.z)||
    !Array.isArray(o.frame.players)||o.frame.players.length!==22||
    !Array.isArray(o.affordances)||o.affordances.length>22)
  throw new TypeError('Valid bounded observed football context required');
 const ids=new Set();
 let home=0,away=0;
 for(const p of o.frame.players){
  if(!p||!identifier(p.id)||ids.has(p.id)||
     !['home','away'].includes(p.team)||!point(p))
   throw new TypeError('Unique observed 22-player frame required');
  ids.add(p.id);
  if(p.team==='home')home++;else away++;
 }
 if(home!==11||away!==11||
    o.frame.players.find(p=>p.id===o.playerId)?.team!==o.team)
  throw new TypeError('Observed actor and 11v11 teams must agree');
 const seen=new Set(),allowed=FOOTBALL_INTENT_PRIORITIES[o.phase];
 for(const a of o.affordances){
  if(!a||!allowed.includes(a.kind)||typeof a.available!=='boolean'||
     !safeTick(a.evidenceTick)||a.evidenceTick>o.frame.tick||
     o.frame.tick-a.evidenceTick>1)
   throw new TypeError('Bounded phase-specific affordance required');
  if(a.available){
   if(needsPlayer.has(a.kind)){
    const receiver=o.frame.players.find(p=>p.id===a.targetPlayerId);
    if(!receiver||receiver.id===o.playerId||
       receiver.team===(a.kind==='pass'?
        (o.team==='home'?'away':'home'):o.team))
     throw new TypeError('Observed pass/press teammate or opponent required');
    if(a.target!==undefined)
     throw new TypeError('Player targets derive from the observed frame');
   }else if(noTarget.has(a.kind)){
    if(a.target!==undefined||a.targetPlayerId!==undefined)
     throw new TypeError('Retain cannot specify a motion or player target');
   }else if(!point(a.target)||a.targetPlayerId!==undefined)
    throw new TypeError('An observed spatial target is required');
  }
  const key=a.kind+'|'+(a.targetPlayerId??'')+'|'+
   (a.target?String(a.target.x)+','+String(a.target.y):'');
  if(seen.has(key))throw new TypeError('Duplicate affordances are ambiguous');
  seen.add(key);
 }
}

// Pure selection only. "available" is an untrusted proposal supplied by
// perception; it is NOT a physical/policy authorization. At integration,
// the existing real Rapier shoe START action policy must revalidate it.
export function chooseObservedFootballIntent(observation){
 validateObservation(observation);
 const priority=FOOTBALL_INTENT_PRIORITIES[observation.phase];
 const players=new Map(observation.frame.players.map(p=>[p.id,p]));
 const choices=observation.affordances.filter(a=>a.available).map(a=>{
  const person=needsPlayer.has(a.kind)?
   players.get(a.targetPlayerId):null;
  return {
   kind:a.kind,evidenceTick:a.evidenceTick,
   targetPlayerId:person?.id??null,
   target:person?{x:person.x,y:person.y}:
    noTarget.has(a.kind)?null:{x:a.target.x,y:a.target.y}
  };
 });
 choices.sort((a,b)=>
  priority.indexOf(a.kind)-priority.indexOf(b.kind)||
  compare(a.targetPlayerId??'',b.targetPlayerId??'')||
  (a.target?.x??0)-(b.target?.x??0)||
  (a.target?.y??0)-(b.target?.y??0)||
  a.evidenceTick-b.evidenceTick);
 if(choices.length===0)return null;
 const selected=choices[0];
 return Object.freeze({
  version:FOOTBALL_INTENT_VERSION,
  physicsTick:observation.physicsTick,
  observedFrameTick:observation.frame.tick,
  evidenceTick:selected.evidenceTick,
  playerId:observation.playerId,team:observation.team,
  phase:observation.phase,intent:selected.kind,
  targetPlayerId:selected.targetPlayerId,
  target:selected.target?Object.freeze(selected.target):null,
  fromDeclaredObservedAffordance:true,
  realShoeContactObserved:false,
  physicalActionExecuted:false,
  officialMatchAction:false,
  guaranteedFootballOutcome:false
 });
}
