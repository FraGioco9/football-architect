// ME-PB-25: deterministic *local research* passing-lane selection and
// an opt-in, pre-positioned opponent. This is not official match AI.
// Every target decision uses the CURRENT canonical 22-player frame.
export const LOCAL_DYNAMIC_TARGET_VERSION='me-pb-25-dynamic-recipient-v1';
export const LOCAL_DEFENDER_ID='away-7';
export const LOCAL_DEFENDER_PREPOSITION=Object.freeze({
 x:-12.4,y:0,facingRad:Math.PI
});
export const LOCAL_TARGET_CANDIDATE_IDS=Object.freeze([
 'home-9','home-10','home-11'
]);
export const LOCAL_DYNAMIC_PASS_IMPULSE_NS=2.7;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const nearby=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const validPlayer=p=>p&&['x','y'].every(k=>finite(p[k]))&&
 typeof p.id==='string'&&['home','away'].includes(p.team);
function segmentDistance(point,start,end){
 const dx=end.x-start.x,dy=end.y-start.y;
 const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+
   (point.y-start.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(point.x-start.x-dx*t,point.y-start.y-dy*t);
}
export function localDefenderLineup(initialPlayers){
 if(!Array.isArray(initialPlayers)||initialPlayers.length!==22||
    initialPlayers.filter(p=>p.id===LOCAL_DEFENDER_ID&&p.team==='away').length!==1)
  throw new TypeError('A canonical 22-player formation is required');
 return Object.freeze(initialPlayers.map(p=>p.id===LOCAL_DEFENDER_ID?
   Object.freeze({...p,...LOCAL_DEFENDER_PREPOSITION}):
   Object.freeze({...p})));
}
// Score favors near, forward, observable teammate options and penalizes
// a real enemy near the passing segment. It NEVER guarantees reception.
export function chooseLocalPassRecipient({passer,players}){
 if(!validPlayer(passer)||passer.id!=='home-7'||passer.team!=='home'||
    !Array.isArray(players)||players.length!==22||
    new Set(players.map(p=>p.id)).size!==22||
    players.some(p=>!validPlayer(p)))
  throw new TypeError('Canonical observed passer and all 22 players required');
 const candidates=[];
 for(const id of LOCAL_TARGET_CANDIDATE_IDS){
  const p=players.find(q=>q.id===id&&q.team==='home'&&q.role==='forward');
  if(!p)continue;
  const dx=p.x-passer.x,dy=p.y-passer.y,distance=Math.hypot(dx,dy);
  if(dx<5||distance<8||distance>28)continue;
  const closestOpponent=players.filter(q=>q.team==='away')
    .reduce((acc,q)=>Math.min(acc,segmentDistance(q,passer,p)),Infinity);
  const lanePenaltyM=closestOpponent<2?3:closestOpponent<4?1.5:0;
  const scoreM=distance+Math.abs(dy)*0.12+lanePenaltyM;
  candidates.push(Object.freeze({
   playerId:p.id,scoreM,groundDistanceM:distance,
   closestOpponentToLaneM:closestOpponent,lanePenaltyM
  }));
 }
 candidates.sort((a,b)=>a.scoreM-b.scoreM||
  a.playerId.localeCompare(b.playerId,'en'));
 if(candidates.length===0)return null;
 const picked=candidates[0];
 return Object.freeze({
  version:LOCAL_DYNAMIC_TARGET_VERSION,
  receiverId:picked.playerId,
  receiverPosition:Object.freeze({
   x:players.find(p=>p.id===picked.playerId).x,
   y:players.find(p=>p.id===picked.playerId).y
  }),
  consideredCandidates:Object.freeze(candidates),
  selectedFromCurrentPlayerFrame:true,
  guaranteedPhysicalReceipt:false
 });
}
export function decideLocalSelectedPass({
 tick,contactStarted,passer,ballPosition,ballRadiusM,selection
}){
 if(!Number.isSafeInteger(tick)||tick<1||!Array.isArray(contactStarted)||
    !ballPosition||!['x','y','z'].every(k=>finite(ballPosition[k]))||
    !finite(ballRadiusM)||ballRadiusM<=0)
  throw new TypeError('Valid canonical 60Hz shoe START context required');
 if(!contactStarted.includes('home-7')||!validPlayer(passer)||
    passer.id!=='home-7'||passer.team!=='home'||passer.role!=='midfielder'||
    !finite(passer.facingRad)||Math.cos(passer.facingRad)<0.65||
    !selection||selection.version!==LOCAL_DYNAMIC_TARGET_VERSION||
    !LOCAL_TARGET_CANDIDATE_IDS.includes(selection.receiverId)||
    !selection.selectedFromCurrentPlayerFrame||
    !selection.receiverPosition||!['x','y'].every(k=>
      finite(selection.receiverPosition[k]))||
    nearby(passer,ballPosition)>0.85||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+0.12)return null;
 const dx=selection.receiverPosition.x-passer.x;
 const dy=selection.receiverPosition.y-passer.y;
 const magnitude=Math.hypot(dx,dy);
 if(dx<5||magnitude<8||magnitude>28)return null;
 return Object.freeze({
  version:LOCAL_DYNAMIC_TARGET_VERSION,
  tick,stage:'pass',playerId:'home-7',
  targetPlayerId:selection.receiverId,
  targetPositionAtPass:selection.receiverPosition,
  selectedCandidates:selection.consideredCandidates,
  usedObservedPlayerFrame:true,
  impulseNs:Object.freeze({
   x:LOCAL_DYNAMIC_PASS_IMPULSE_NS*dx/magnitude,
   y:LOCAL_DYNAMIC_PASS_IMPULSE_NS*dy/magnitude,z:0
  }),
  physicalTrigger:'real-rapier-foot-contact-start',
  actionSource:'built-in-deterministic-local-ai',
  experimentalOnly:true,officialMatchAction:false,
  inferredPossession:false,passCompletionInferred:false,
  intent:'local-ai-selected-recipient-ground-pass'
 });
}
