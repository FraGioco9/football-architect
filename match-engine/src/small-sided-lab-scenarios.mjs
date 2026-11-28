import {attackDirection,validateAttackPolarity} from './match-directions.mjs';
// #628 LAB-SMALL-01: bounded small-sided exercises, never a 11v11 match.
// Twenty-two canonical mover identities stay available to the existing
// engine, but ONLY these selected 2–7 players receive actual Rapier shoe
// colliders, participate in action policy or appear in the exercise.
// All initial positions are staged BEFORE tick zero; no in-play teleport.
const freeze=Object.freeze;
// Thirty replayable pre-tick-zero physical starting geometries per situation.
// V01 is the original fixture; variations never use Math.random, never move
// actors during play and never create an authoritative action/outcome.
export const SMALL_SIDED_VARIANT_COUNT=30;
function seededGeometry(id,variantIndex){
 let state=2166136261;
 for(const char of id+'#'+variantIndex){
  state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
 }
 return ()=>{
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state/4294967296;
 };
}
function physicallySeparated(players,minimumM){
 for(let i=0;i<players.length;i++){
  const p=players[i];
  if(Math.abs(p.x)>51.99||Math.abs(p.y)>33.49)return false;
  for(let j=i+1;j<players.length;j++){
   const q=players[j];
   if(Math.hypot(p.x-q.x,p.y-q.y)<minimumM-1e-8)return false;
  }
 }
 return true;
}

const ids=freeze(['dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3','carry-solo','pass-pair','cross-pair','shot-solo']);
const definitions=freeze([
 freeze({id:ids[0],nativeOpenPlay:true,title:'Dribbling · 1v1 (no goalkeeper)',
  attackers:freeze([10]),defenders:freeze([2]),includeGoalkeeper:false,
  description:'Real attacker vs defender and the original Rapier ball; only attacker genuine shoe STARTs can trigger variable carry touches. No shot/pass/automatic tackle, possession or dribble success.'}),
 freeze({id:ids[1],nativeOpenPlay:true,title:'1v1 · Attacker vs goalkeeper',
  attackers:freeze([10]),defenders:freeze([]),
  description:'One forward faces a real opponent goalkeeper. Original Rapier shoe contact and keeper movement; observe shot, physical parry attempt or actual full-ball exit. No automatic goal or save.'}),
 freeze({id:ids[2],nativeOpenPlay:true,title:'1v1 + goalkeeper',
  attackers:freeze([10]),defenders:freeze([2]),
  description:'One forward, one real defender and the goalkeeper. Watch genuine pressure, shot selection, shoe contact and ball travel; no inferred tackle or possession.'}),
 freeze({id:ids[3],nativeOpenPlay:true,title:'2v1 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2]),
  description:'Two forwards against one defender and a goalkeeper. Observe live pass options, overlapping runs and native player-ball actions; no completed pass or goal without physical evidence.'}),
 freeze({id:ids[4],nativeOpenPlay:true,title:'2v2 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2,3]),
  description:'Two forwards against two defenders and a goalkeeper. Original 60 Hz movement, individual shoe collisions, pressure and shot/pass selection, not an 11v11 simulation.'}),
 freeze({id:ids[5],nativeOpenPlay:true,title:'3v3 + goalkeeper',
  attackers:freeze([10,9,11]),defenders:freeze([2,3,4]),
  description:'Three forwards face three defenders and a goalkeeper. Keep the same Rapier world and canonical physics; inspect live support, blocked lanes and genuinely resulting actions.'}),
 freeze({id:ids[6],title:'Carry · solo',attackers:freeze([10]),
  defenders:freeze([]),includeGoalkeeper:false,
  description:'One original Rapier player carries the ball by genuine shoe START/END and physical impulses. No defender, goalkeeper or other active player.'}),
 freeze({id:ids[7],title:'Pass · ground',attackers:freeze([10,9]),
  defenders:freeze([]),includeGoalkeeper:false,
  description:'Two teammates only. One distance-calibrated ground impulse after a genuine exclusive shoe START; first receiving contact may use a bounded native cushion; control is measured, never assumed.'}),
 freeze({id:ids[8],title:'Cross · lofted',attackers:freeze([10,9]),
  defenders:freeze([]),includeGoalkeeper:false,
  description:'Two teammates only. One original M33 lofted cross after a genuine exclusive shoe START; observe flight and arrival, not aerial control.'}),
 freeze({id:ids[9],title:'Shot · Empty goal',attackers:freeze([10]),
  defenders:freeze([]),includeGoalkeeper:false,
  description:'One genuine shooter, stationary ball and empty goal. Observe actual flight and full-ball goal-line crossing; no official result.'})
]);
const headerDefinition=freeze({id:'header-pair',nativeOpenPlay:true,title:'Header · from cross',
 attackers:freeze([10,9]),defenders:freeze([]),includeGoalkeeper:false,
 description:'A grounded ball and two canonical teammates in crossing geometry. The shared policy selects a real lofted cross, then a reachable physical header; no staged airborne ball or awarded outcome.'});
const chestDefinition=freeze({...headerDefinition,id:'chest-control',title:'Control · Chest',description:'Real cross from a teammate, then a physically reachable chest cushion. No automatic control.'});
const footDefinition=freeze({...headerDefinition,id:'aerial-foot-control',title:'Control · Aerial foot',attackers:freeze([10]),description:'One player receives a descending ball with a reachable raised foot. No automatic control.'});
const aerialDuelDefinition=freeze({...headerDefinition,id:'aerial-duel',title:'Aerial duel · 1v1',attackers:freeze([10]),defenders:freeze([2]),
 description:'Two opposing canonical outfield players contest one descending physical ball. Neither side is assigned a winner.'});
const loftedPassDefinition=freeze({...headerDefinition,id:'lofted-pass',title:'Pass · Lofted',description:'Two separated teammates, a genuine long lofted pass and physical receiving opportunity.'});
const volleyDefinition=freeze({...headerDefinition,id:'volley-solo',title:'Shot · Volley from cross',description:'Two teammates with a grounded ball and open crossing geometry. A real cross precedes an exclusive raised-foot first-time shot.'});
const highClaimDefinition=freeze({...headerDefinition,id:'keeper-high-cross',title:'Goalkeeper · High cross',includeGoalkeeper:true,description:'Two attacking teammates and an opposing goalkeeper. A real cross offers a high interception, grip or deflection opportunity.'});
const highInterceptDefinition=freeze({...highClaimDefinition,id:'keeper-high-intercept',title:'Goalkeeper · High interception',description:'A deeper near-side cross and a keeper starting closer to the delivery lane, to investigate interception before the intended receiver. Real pressure and outcomes are measured, not assigned.'});
const shortLoftDefinition=freeze({...loftedPassDefinition,id:'lofted-short',title:'Pass · Lofted short',defenders:freeze([2]),description:'Two teammates and one middle-lane opponent. A live blocked ground lane offers a short lofted pass.'});
const switchDefinition=freeze({...loftedPassDefinition,id:'lofted-switch',title:'Pass · Switch of play',description:'Two teammates on opposite flanks, outside ordinary ground-pass range.'});
const byId=new Map([...definitions,headerDefinition,chestDefinition,footDefinition,aerialDuelDefinition,loftedPassDefinition,volleyDefinition,highClaimDefinition,highInterceptDefinition,shortLoftDefinition,switchDefinition].map(s=>[s.id,s]));
// Private full-field research fixture: initial geometry only. Not in the
// visible LAB catalog until the full native participant path is certified.
byId.set('full-field-native',freeze({id:'full-field-native',nativeOpenPlay:true,fullField:true}));
// Keeper 1v1: deterministic source-only 60Hz tactical targets, never a
// physical impulse, teleport, scripted save, possession or match result.
const bounded=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// COL-01: live outfield approach and support are geometric movement
// proposals only. The nearest approach reference is NOT ball possession.
// Each team can pursue the same ball; shirt numbers never select a runner.
// COL-04: choose a reachable useful support waypoint from actual open
// passing lanes. The target is movement intent, never a pass or reception.
export function planNativeSupport({player,ball,opponents,reserved=[],attackPolarity=1}){
 validateAttackPolarity(attackPolarity);
 if(!player||!['home','away'].includes(player.team)||!Array.isArray(opponents)||!Array.isArray(reserved)||!reserved.every(p=>[p.x,p.y].every(Number.isFinite))||
    ![player.x,player.y,ball?.x,ball?.y].every(Number.isFinite)||
    !opponents.every(p=>p.team!==player.team&&[p.x,p.y].every(Number.isFinite)))
  throw new TypeError('Live teammate support geometry required');
 const dir=attackDirection(player.team,attackPolarity);
 const lateral=Math.abs(player.y-ball.y)>0.1?Math.sign(player.y-ball.y):ball.y>=0?-1:1;
 const candidates=[];
 const evaluate=(x,y)=>{
  x=bounded(x,-51.99,51.99);y=bounded(y,-33.49,33.49);
  const dx=x-ball.x,dy=y-ball.y,d=Math.hypot(dx,dy),forward=dir*dx;
  if(d<3||d>25||forward< -3||reserved.some(p=>Math.hypot(p.x-x,p.y-y)<1.8))return;
  const lane=Math.min(150,...opponents.map(p=>{
   const u=bounded(((p.x-ball.x)*dx+(p.y-ball.y)*dy)/(d*d),0,1);
   return Math.hypot(p.x-ball.x-u*dx,p.y-ball.y-u*dy);
  }));
  const separation=Math.min(150,...opponents.map(p=>Math.hypot(p.x-x,p.y-y)));
  const travel=Math.hypot(x-player.x,y-player.y);
  const safe=lane>=1.9&&separation>=1.6;
  const score=Math.min(lane,8)*1.2+Math.min(separation,8)*0.65+Math.min(forward,8)*0.30-travel*0.8-Math.abs(d-7)*0.12;
  candidates.push({x,y,lane,separation,travel,safe,score});
 };
 // Prefer holding an already useful position; otherwise compare both
 // lateral sides, forward and short backward support, including near lines.
 evaluate(player.x,player.y);
 for(const forward of [2.5,5,0,-2.5])for(const width of [4.5,7])for(const side of [lateral,-lateral])
  evaluate(ball.x+dir*forward,ball.y+side*width);
 candidates.sort((a,b)=>Number(b.safe)-Number(a.safe)||b.score-a.score||a.travel-b.travel);
 const best=candidates[0];
 if(!best)return freeze({target:freeze({x:player.x,y:player.y}),safeLane:false,decisionOnly:true,officialPossession:false});
 return freeze({target:freeze({x:best.x,y:best.y}),safeLane:best.safe,laneClearanceM:best.lane,
  opponentGapM:best.separation,decisionOnly:true,officialPossession:false});
}
// AERIAL-04: symmetric live intercept pursuit for loose descending balls.
// Select the most reachable outfielder independently on each team. A
// predicted reach is only movement intent, not a jump/contact award.
export function planNativeAerialContest(players,ball,velocity,height=1.95){
 if(!Array.isArray(players)||![ball?.x,ball?.y,ball?.z,velocity?.x,velocity?.y,velocity?.z,height].every(Number.isFinite)||
    ball.z<height||ball.z>12||height<0.8||height>2.3)return freeze({});
 const d=velocity.z*velocity.z+19.62*(ball.z-height);
 const eta=(velocity.z+Math.sqrt(d))/9.81;
 if(!(eta>0&&eta<=3))return freeze({});
 const target=freeze({x:bounded(ball.x+velocity.x*eta,-51.99,51.99),y:bounded(ball.y+velocity.y*eta,-33.49,33.49)});
 const result={};
 for(const team of ['home','away']){
  const candidates=players.filter(p=>p.team===team&&p.role!=='goalkeeper'&&[p.x,p.y,p.vx,p.vy].every(Number.isFinite))
   .map(p=>({p,gap:Math.hypot(p.x-target.x,p.y-target.y)}))
   .filter(c=>c.gap<=0.35+Math.min(7*eta,Math.hypot(c.p.vx,c.p.vy)*eta+4.5*eta*eta))
   .sort((a,b)=>a.gap-b.gap||a.p.id.localeCompare(b.p.id));
  if(candidates.length){const {p}=candidates[0];result[p.id]=freeze({kind:'aerial-approach',target,etaS:eta,decisionOnly:true,officialPossession:false});}
 }
 return freeze(result);
}
// COL-05: approach from the goal side when the opponent has observed
// control. Keep the second defender in a distinct cover lane. These
// are bounded movement proposals; the original mover still owns contact.
export function planNativeDefense({player,ball,velocity,opponents,owner,primary=true,reserved=[],coveredReceivers=[],attackPolarity=1}){
 validateAttackPolarity(attackPolarity);
 if(!player||!owner||owner.team===player.team||!Array.isArray(opponents)||
    !opponents.some(p=>p.id===owner.id)||!['home','away'].includes(player.team)||
    ![player.x,player.y,owner.x,owner.y,ball?.x,ball?.y,velocity?.x,velocity?.y].every(Number.isFinite))
  throw new TypeError('Live opposing control required');
 const dir=attackDirection(player.team,attackPolarity),goalX=-dir*52.5;
 const bx=bounded(ball.x+velocity.x*0.15,-51.75,51.75),by=bounded(ball.y+velocity.y*0.15,-33.25,33.25);
 const dx=goalX-bx,dy=-by,d=Math.max(0.01,Math.hypot(dx,dy));
 const gx=dx/d,gy=dy/d;
 const receiver=opponents.filter(p=>p.id!==owner.id&&p.role!=='goalkeeper'&&!coveredReceivers.includes(p.id))
  .sort((a,b)=>Math.hypot(a.x-goalX,a.y)-Math.hypot(b.x-goalX,b.y)||a.y-b.y||attackPolarity*(a.x-b.x))[0];
 const target=(x,y)=>freeze({x:bounded(x,-51.99,51.99),y:bounded(y,-33.49,33.49)});
 if(!primary){
  // If a second opponent is available, cover the actual passing lane.
  // Otherwise screen behind the pressing teammate, away from his feet.
  const lateral=Math.abs(player.y-by)>0.1?Math.sign(player.y-by):by>=0?-1:1;
  const preferred=receiver?target(bx+(receiver.x-bx)*0.65,by+(receiver.y-by)*0.65):
   target(bx+gx*3.0,by+gy*3.0+lateral*2.2);
  const candidates=[preferred];
  for(const depth of [3,5,7,9])for(const width of [2.2,4.4,6.6,8.8])for(const side of [lateral,-lateral])candidates.push(target(bx+gx*depth,by+gy*depth+side*width));
  const covered=candidates.find(c=>reserved.every(p=>Math.hypot(p.x-c.x,p.y-c.y)>=1.8))??target(player.x,player.y);
  return freeze({kind:'cover-pass',target:covered,...(receiver&&covered===preferred?{coveredReceiverId:receiver.id}:{}),decisionOnly:true,officialPossession:false});
 }
 const gap=Math.hypot(player.x-ball.x,player.y-ball.y);
 const goalSide=(player.x-bx)*gx+(player.y-by)*gy;
 // Never chase through the carrier's body simply to get to the ball.
 // Close down when already goal-side and near; otherwise regain shape.
 const close=goalSide>=-0.15&&gap<=1.8;
 const standOff=close?0.40:1.15;
 const shade=receiver?bounded((receiver.y-by)*0.10,-0.40,0.40):0;
 return freeze({kind:'press-ball',target:target(bx+gx*standOff,by+gy*standOff+(close?0:shade)),
  mode:close?'close-down':'contain',decisionOnly:true,officialPossession:false});
}
export function planNativeFootballMovement(players,ball,velocity,control=null,goalkeepers=[],attackPolarity=1){
 validateAttackPolarity(attackPolarity);
 if(!Array.isArray(players)||players.length<1||players.length>22||
    new Set(players.map(p=>p.id)).size!==players.length||
    !players.every(p=>['home','away'].includes(p.team)&&[p.x,p.y].every(Number.isFinite))||
    ![ball?.x,ball?.y,velocity?.x,velocity?.y].every(Number.isFinite)||!Array.isArray(goalkeepers)||
    !goalkeepers.every(p=>['home','away'].includes(p.team)&&[p.x,p.y].every(Number.isFinite)))
  throw new TypeError('Live physical outfield participants required');
 const bx=bounded(ball.x+velocity.x*0.18,-51.75,51.75);
 const by=bounded(ball.y+velocity.y*0.18,-33.25,33.25);
 const target=(x,y)=>freeze({x:bounded(x,-51.99,51.99),y:bounded(y,-33.49,33.49)});
 const gap=p=>Math.hypot(p.x-bx,p.y-by);
 const result={};
 for(const team of ['home','away']){
  const own=players.filter(p=>p.team===team).sort((p,q)=>gap(p)-gap(q)||p.y-q.y||attackPolarity*(p.x-q.x));
  if(!own.length)continue;
  const rival=players.filter(p=>p.team!==team).sort((p,q)=>gap(p)-gap(q))[0];
  const owner=control?.kind==='controlled'?players.find(p=>p.id===control.playerId):null;
  const runner=own.find(p=>p.id===owner?.id)??own[0],dir=attackDirection(team,attackPolarity);
  const rivalNear=owner?owner.team!==team:!!rival&&gap(rival)<=1.15&&gap(rival)+0.15<gap(runner);
  const dx=bx-runner.x,dy=by-runner.y,d=Math.hypot(dx,dy);
  const tx=d>0.05?dx/d:dir,ty=d>0.05?dy/d:0;
  const opposition=[...players,...goalkeepers].filter(q=>q.team!==team);
  const defending=owner&&owner.team!==team;
  result[runner.id]=defending?planNativeDefense({player:runner,ball,velocity,opponents:opposition,owner,attackPolarity}):freeze({kind:owner?.id===runner.id?'carry-ball':rivalNear?'press-ball':'approach-ball',
   target:target(bx+0.25*tx,by+0.25*ty),decisionOnly:true,officialPossession:false});
  const reserved=[result[runner.id].target],coveredReceivers=[];
  for(const p of own.filter(p=>p.id!==runner.id)){
   if(defending){
    result[p.id]=planNativeDefense({player:p,ball,velocity,opponents:opposition,owner,primary:false,reserved,coveredReceivers,attackPolarity});
    reserved.push(result[p.id].target);
    if(result[p.id].coveredReceiverId)coveredReceivers.push(result[p.id].coveredReceiverId);
    continue;
   }
   const lateral=Math.abs(p.y-by)>0.1?Math.sign(p.y-by):by>=0?-1:1;
   // Defensive cover stays separate; attacking support searches open
   // lanes against all physically active opponents, including the keeper.
   const support=rivalNear?null:planNativeSupport({player:p,ball,opponents:opposition,reserved:own.length>2?reserved:[],attackPolarity});
   result[p.id]=freeze({kind:rivalNear?'press-ball':'support-run',
    target:support?.target??target(bx-dir*2.5,by+lateral*4.5),
    ...(support?{support}:{}),decisionOnly:true,officialPossession:false});
   reserved.push(result[p.id].target);
  }
 }
 return freeze(result);
}
// Historical names remain aliases, not separate movement implementations.
export const planCollectiveSupport=planNativeSupport;
export const planCollectiveDefense=planNativeDefense;
export const planCollectiveApproaches=planNativeFootballMovement;
function requireKeeperVariant(side,index){
 if(!['home','away'].includes(side)||!Number.isSafeInteger(index)||
    index<0||index>=SMALL_SIDED_VARIANT_COUNT)
  throw new TypeError('Valid 1v1 goalkeeper side and variant required');
}
export function keeperDuelAttackerTarget(side,index,attacker,ball){
 requireKeeperVariant(side,index);
 if(!attacker||attacker.id!==side+'-10'||!ball||
    ![attacker.x,attacker.y,ball.x,ball.y].every(Number.isFinite))
  throw new TypeError('Actual live 1v1 attacker and ball required');
 const dir=side==='home'?1:-1;
 const ballAhead=(ball.x-attacker.x)*dir;
 // Drive through the real ball instead of decelerating at a target 8 cm
 // behind it. When overrun, recover via original capped kinematics.
 return freeze({
  x:bounded(ball.x+dir*(ballAhead>=-0.10?1.35:-0.32),-51.99,51.99),
  y:bounded(ball.y,-33.49,33.49)
 });
}
// GK-06: pursuit of a witnessed loose ball only. Forecast a short
// interception from the actual current velocity, then continue through the
// contact point in the approach direction. No direct player or ball move.
export function keeperDuelReboundTarget(side,index,attacker,ball,velocity){
 requireKeeperVariant(side,index);
 if(!attacker||attacker.id!==side+'-10'||
    ![attacker.x,attacker.y,ball?.x,ball?.y,velocity?.x,velocity?.y].every(Number.isFinite))
  throw new TypeError('Actual live rebound and original attacker required');
 const distance=Math.hypot(ball.x-attacker.x,ball.y-attacker.y);
 const horizon=bounded(distance/14,0,0.35);
 const bx=bounded(ball.x+velocity.x*horizon,-51.75,51.75);
 const by=bounded(ball.y+velocity.y*horizon,-33.25,33.25);
 const dx=bx-attacker.x,dy=by-attacker.y,gap=Math.hypot(dx,dy);
 const dir=side==='home'?1:-1;
 const ux=gap>0.05?dx/gap:dir,uy=gap>0.05?dy/gap:0;
 return freeze({x:bounded(bx+0.65*ux,-51.99,51.99),
  y:bounded(by+0.65*uy,-33.49,33.49)});
}
// Active single-shot LAB: close a controllable live ball in the penalty
// area instead of stopping just outside the existing glove's reach.
// Return a movement target only; no contact or successful tackle claim.
export function keeperDuelCloseDownTarget(side,keeper,attacker,ball,velocity){
 if(!['home','away'].includes(side)||keeper?.id!==(side==='home'?'away':'home')+'-1'||
    attacker?.id!==side+'-10'||![keeper.x,keeper.y,attacker.x,attacker.y,
     ball?.x,ball?.y,ball?.z,velocity?.x,velocity?.y,velocity?.z].every(Number.isFinite))
  throw new TypeError('Live keeper close-down needs original players and ball');
 return planNativeKeeperCloseDown({...keeper,team:side==='home'?'away':'home'},{...attacker,team:side},ball,velocity);
}
// Open play and the isolated keeper experiment share this geometry.
// AERIAL-07: same live ballistic prediction for keeper movement and
// hand reach. Only descending points inside the keeper's own box qualify.
export function planNativeKeeperHighIntercept(keeper,ball,velocity,attackPolarity=1){
 if(!keeper||keeper.role!=='goalkeeper'||![keeper.x,keeper.y,ball?.x,ball?.y,ball?.z,velocity?.x,velocity?.y,velocity?.z].every(Number.isFinite))return null;
 const dir=attackDirection(keeper.team,attackPolarity),height=2.05;
 const disc=velocity.z*velocity.z+19.62*(ball.z-height);
 if(disc<0||ball.z<0.30)return null;
 const eta=(velocity.z+Math.sqrt(disc))/9.81;
 if(!(eta>=0.08&&eta<=2.6))return null;
 const x=ball.x+velocity.x*eta,y=ball.y+velocity.y*eta;
 if(-dir*x<36.2||-dir*x>52.1||Math.abs(y)>19.8)return null;
 const gap=Math.hypot(x-keeper.x,y-keeper.y);
 if(gap>1.4+Math.min(7*eta,Math.hypot(keeper.vx??0,keeper.vy??0)*eta+4.5*eta*eta))return null;
 return freeze({point:freeze({x,y,z:height}),target:freeze({x:bounded(x-dir*0.35,-51.99,51.99),y}),eta,decisionOnly:true,officialPossession:false});
}
export function planNativeKeeperCloseDown(keeper,attacker,ball,velocity,attackPolarity=1){
 validateAttackPolarity(attackPolarity);
 if(!keeper||!attacker||!['home','away'].includes(keeper.team)||!['home','away'].includes(attacker.team)||attacker.team===keeper.team||
    ![keeper.x,keeper.y,attacker.x,attacker.y,ball?.x,ball?.y,ball?.z,velocity?.x,velocity?.y,velocity?.z].every(Number.isFinite))return null;
 const dir=-attackDirection(keeper.team,attackPolarity),gap=Math.hypot(ball.x-keeper.x,ball.y-keeper.y);
 if(dir*ball.x<36||dir*ball.x>=52.39||Math.abs(ball.y)>20.16||
    ball.z>0.5||Math.hypot(velocity.x,velocity.y,velocity.z)>6||
    Math.hypot(ball.x-attacker.x,ball.y-attacker.y)>2.2||gap>7)return null;
 const lead=bounded(gap/16,0,0.25);
 const bx=ball.x+velocity.x*lead,by=ball.y+velocity.y*lead;
 // Stay on the goal side until close enough for the physical challenge.
 return freeze({x:bounded(bx+dir*0.65,-51.99,51.99),
  y:bounded(by,-20.16,20.16)});
}
export function keeperDuelGoalkeeperTarget(side,index,attacker,ball,baseline){
 requireKeeperVariant(side,index);
 if(!attacker||attacker.id!==side+'-10'||!ball||!baseline||
    ![attacker.x,attacker.y,ball.x,ball.y,baseline.x,baseline.y]
     .every(Number.isFinite))
  throw new TypeError('Actual live attacker, ball and keeper baseline required');
 const dir=side==='home'?1:-1;
 // V01 preserves original positioning. V02+ alternate three degrees
 // of genuine keeper advance driven by CURRENT attacker/ball separation.
 const style=index===0?0:1+(index-1)%3;
 const gap=Math.hypot(ball.x-attacker.x,ball.y-attacker.y);
 const threat=bounded((1.8-gap)/1.2,0,1);
 const available=Math.max(0,(baseline.x-ball.x)*dir-1.5);
 const advance=Math.min(available,style*1.1*threat);
 return freeze({
  x:bounded(baseline.x-dir*advance,-51.99,51.99),
  y:bounded(baseline.y+bounded(ball.y-baseline.y,-4,4)*style*0.06*threat,
   -33.49,33.49)
 });
}
export const SMALL_SIDED_LAB_SCENARIOS=freeze(definitions.map(s=>
 freeze({...s,mode:'situation',goal:'situation',
  initial:freeze({preset:'roll',seed:'me-small-'+s.id+'-home',
   x:s.id==='pass-pair'?-12:30,y:s.id==='pass-pair'?8:s.id==='cross-pair'?24:0,z:0,vx:0,vy:0,vz:0}),
  focus:freeze([...s.attackers.map(n=>'home-'+n),
   ...s.defenders.map(n=>'away-'+n),...(s.includeGoalkeeper===false?[]:['away-1'])]),
  source:'original-rapier-selected-shoe-colliders-only',
  officialResult:false})
));
// Keep grounded baseline matrix stable; aerial fixtures have their own
// contact-source assertions while sharing the same scenario registry.
export const AERIAL_LAB_SCENARIOS=freeze([headerDefinition,chestDefinition,footDefinition,aerialDuelDefinition,loftedPassDefinition,volleyDefinition,highClaimDefinition,highInterceptDefinition,shortLoftDefinition,switchDefinition].map(d=>freeze({...d,mode:'situation',goal:'situation',
 initial:freeze({preset:d.id==='aerial-foot-control'?'drop':'roll',seed:'me-small-'+d.id+'-home',x:d.id==='aerial-foot-control'?17:27,y:d.id==='aerial-foot-control'?0:26,z:d.id==='aerial-foot-control'?1.6:0,vx:0,vy:0,vz:d.id==='aerial-foot-control'?-2:0}),
 focus:freeze([...d.attackers.slice().sort((a,b)=>a-b).map(n=>'home-'+n),...(d.includeGoalkeeper?['away-1']:[]),...d.defenders.map(n=>'away-'+n)]),source:'original-rapier-selected-aerial-and-shoe-colliders',officialResult:false})));
export function getSmallSidedScenario(id){
 const d=byId.get(id);
 if(!d)throw new RangeError('Unknown private small-sided situation');
 return d;
}
// Only the fixture adapter declares whether an isolated exercise can run
// unrestricted native football. This metadata never enters the action scores.
export function supportsNativeOpenPlay(id){return byId.get(id)?.nativeOpenPlay===true;}
export function smallSidedSetup(id,side,canonicalPlayers,{
 variantIndex=0,carryRunwayStart=false,tapInStart=false,firstTimeShot=false,shoulderStart=false,interceptionStart=false,blockStart=false
}={}){
 const d=getSmallSidedScenario(id);
 if(typeof blockStart!=='boolean'||blockStart&&(id!=='defender-1v1'||shoulderStart||interceptionStart))throw new TypeError('Block requires three original players');
 if(typeof interceptionStart!=='boolean'||(interceptionStart&&(id!=='pass-pair'||shoulderStart)))throw new TypeError('Interception start requires isolated rolling 1v1');
 if(typeof shoulderStart!=='boolean'||(shoulderStart&&id!=='dribble-1v1'))
  throw new TypeError('Shoulder start requires isolated 1v1');
 if(typeof firstTimeShot!=='boolean'||(firstTimeShot&&id!=='shot-solo'))
  throw new TypeError('First-time start requires isolated shooter');
 if(typeof tapInStart!=='boolean'||(tapInStart&&id!=='shot-solo'))
  throw new TypeError('Tap-in start requires isolated shooter');
 if(typeof carryRunwayStart!=='boolean'||
    (carryRunwayStart&&id!=='carry-solo'))
  throw new TypeError('Long runway is restricted to pre-kickoff Solo Carry research');
 if(!Number.isSafeInteger(variantIndex)||variantIndex<0||
    variantIndex>=SMALL_SIDED_VARIANT_COUNT)
  throw new RangeError('Small-sided variant index must be 0–29');
 if(!['home','away'].includes(side)||!Array.isArray(canonicalPlayers)||
    canonicalPlayers.length!==22||canonicalPlayers.some(p=>!p||
     typeof p.id!=='string'||!['home','away'].includes(p.team)))
  throw new TypeError('Small-sided exercise needs real canonical ordered 22-player identities');
 const opponent=side==='home'?'away':'home',dir=side==='home'?1:-1;
 if(d.fullField){
  if(carryRunwayStart||tapInStart||firstTimeShot||shoulderStart||interceptionStart||blockStart)throw new TypeError('Full field cannot use isolated experiment overrides');
  // UME-06B: reuse accepted pre-tick-zero geometry, never the restricted
  // exercise action policy. All 22 players (including both keepers) remain
  // native and active even when a particular local challenge is staged.
  const geometry=variantIndex===0?null:smallSidedSetup(
   ['keeper-1v1','duel-3v3','defender-1v1'][(variantIndex-1)%3],
   side,canonicalPlayers,{variantIndex:Math.floor((variantIndex-1)/3)});
  const staged=geometry?.staged??freeze(canonicalPlayers.map(p=>p.id===side+'-10'?freeze({...p,x:-dir*0.35,y:0,baseX:-dir*0.35,baseY:0}):p));
  const activeIds=freeze(staged.map(p=>p.id));
  if(new Set(activeIds).size!==22||!physicallySeparated(staged,1.15))throw new TypeError('Full field requires 22 distinct separated canonical participants');
  return freeze({id,side,opponent,variantIndex,activeIds,staged,fullField:true,
   ball:freeze({preset:'roll',seed:'me-native-full-field-'+side+'-'+variantIndex,x:geometry?.ball.x??0,y:geometry?.ball.y??0,z:0,vx:0,vy:0,vz:0}),genuinePhysicalPlayers:22,officialMatchResult:null});
 }
 const activeIds=freeze(canonicalPlayers.filter(p=>
   (d.includeGoalkeeper!==false&&p.id===opponent+'-1')||
   d.attackers.some(n=>p.id===side+'-'+n)||
   (d.defenders.some(n=>p.id===opponent+'-'+n)||(interceptionStart&&p.id===opponent+'-2'))
 ).map(p=>p.id));
 if(activeIds.length!==d.attackers.length+d.defenders.length+(interceptionStart?1:0)+
    (d.includeGoalkeeper===false?0:1)||
    new Set(activeIds).size!==activeIds.length)
  throw new TypeError('Every real small-sided attacker/defender/keeper must have a canonical identity');
 // Identical seed and relative coordinates for HOME/AWAY; only attacking
 // X is mirrored. Inactive canonical players are also included in the 0.98 m
 // separation guard, even though only selected players have Rapier shoes.
 function stage(positions){
  return freeze(canonicalPlayers.map(p=>{
   if(!activeIds.includes(p.id))return p;
   const [x,y]=positions.get(p.id);
   return freeze({...p,x:dir*x,y,baseX:dir*x,baseY:y,
    vx:0,vy:0,blockedBy:null,...(shoulderStart?{facingRad:dir===1?0:Math.PI}:{})});
  }));
 }
 // AERIAL-02 LAB: before-tick-zero placement only. All action choices
 // are made by the same live native policy; no heading intent override.
 if(id==='header-pair'||id==='chest-control'||id==='volley-solo'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const flank=variantIndex%2===0?1:-1;
   const bx=27+random()*2,by=flank*(25+random()*2);
   // Deeper delivery across the goal area towards the far-post runner.
   // A volley receiver starts around the penalty spot, leaving room to
   // pursue the lower descending interception of the same cross trajectory.
   const rx=id==='volley-solo'?39+random()*3:46+random()*2,ry=-flank*(4+random()*2);
   const staged=freeze(stage(new Map([[side+'-10',[bx-0.30,by]],[side+'-9',[rx,ry]]])).map(p=>p.id===side+'-9'?
    freeze({...p,facingRad:Math.atan2(by-ry,dir*(bx-rx))}):p));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,
    ball:freeze({preset:'roll',seed:'me-small-'+id+'-v'+variantIndex+'-'+side,
     x:dir*bx,y:by,z:0,vx:0,vy:0,vz:0}),aerialSurface:id==='header-pair'?'head':id==='volley-solo'?'foot':'chest',genuinePhysicalPlayers:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original aerial header setup');
 }
 if(id==='aerial-foot-control'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   // Isolate receiving well outside the live shooting lane. Keep the
   // same seeded relative geometry and unrestricted shared action policy.
   const x=10+random()*10,y=-12+random()*24,gap=0.35+random()*0.12;
   const staged=stage(new Map([[side+'-10',[x,y]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,aerialSurface:'foot',
    ball:freeze({preset:'drop',seed:'me-small-foot-v'+variantIndex+'-'+side,x:dir*(x+gap),y,z:1.5+random()*0.3,vx:-dir*0.4,vy:0,vz:-2}),
    genuinePhysicalPlayers:1,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original raised foot setup');
 }
 if(id==='aerial-duel'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const x=18+random()*15,y=-11+random()*22;
   const near=0.70+random()*0.20,far=1.15+random()*0.35;
   const left=variantIndex%2===0?near:far,right=variantIndex%2===0?far:near;
   const staged=stage(new Map([[side+'-10',[x-left,y]],[opponent+'-2',[x+right,y]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,aerialSurface:'head',
    ball:freeze({preset:'drop',seed:'me-small-aerial-duel-v'+variantIndex+'-'+side,x:dir*x,y,z:3.4+random()*0.4,vx:dir*(random()-0.5)*0.7,vy:0,vz:-0.4}),
    genuinePhysicalPlayers:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original aerial duel setup');
 }
 if(id==='lofted-pass'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const x=-23+random()*8,y=-8+random()*16,distance=32+random()*10,dy=(random()-0.5)*14;
   const staged=stage(new Map([[side+'-10',[x-0.30,y]],[side+'-9',[x+distance,y+dy]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,aerialSurface:'foot',
    ball:freeze({preset:'roll',seed:'me-small-lofted-pass-v'+variantIndex+'-'+side,x:dir*x,y,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original lofted pass setup');
 }
 if(id==='lofted-short'||id==='lofted-switch'){
  const random=seededGeometry(id,variantIndex),flank=variantIndex%2===0?1:-1;
  for(let attempt=0;attempt<96;attempt++){
   const short=id==='lofted-short';
   const x=-22+random()*7,y=short?-8+random()*16:flank*(17+random()*4);
   const dx=short?13+random()*5:1+random()*5,dy=short?(random()-0.5)*5:-flank*(34+random()*8);
   const positions=new Map([[side+'-10',[x-0.30,y]],[side+'-9',[x+dx,y+dy]]]);
   if(short)positions.set(opponent+'-2',[x+dx*0.5,y+dy*0.5+(random()-0.5)*0.5]);
   const staged=stage(positions);
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,aerialSurface:'foot',
    ball:freeze({preset:'roll',seed:'me-small-'+id+'-v'+variantIndex+'-'+side,x:dir*x,y,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:short?3:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original lofted pass setup');
 }
 if(id==='keeper-high-cross'||id==='keeper-high-intercept'){
  const intercept=id==='keeper-high-intercept';
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const flank=variantIndex%2===0?1:-1;
   // The short near-side delivery may never supply a descending high
   // hand opportunity. Give this exercise a genuine deeper flight path.
   const bx=intercept?34+random()*2:29+random()*2,by=flank*(intercept?28+random()*2:25+random()*2);
   const rx=intercept?46+random()*2:41+random()*2,ry=flank*(intercept?4+random()*2:-(2+random()*3));
   // Keeper is offset from the original passing lane; normal movement
   // and the existing reach planner decide if he gets there first.
   const gx=intercept?rx-3.2-random()*0.8:49+random()*1.2,
    gy=flank*(intercept?Math.abs(ry)+1+random():random()*1.2);
   const staged=stage(new Map([[side+'-10',[bx-0.30,by]],[side+'-9',[rx,ry]],[opponent+'-1',[gx,gy]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,aerialSurface:'head',
    ball:freeze({preset:'roll',seed:'me-small-keeper-high-v'+variantIndex+'-'+side,x:dir*bx,y:by,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:3,officialMatchResult:null});
  }
  throw new RangeError('No collision-free original keeper high cross setup');
 }
 // PASS-01: before-tick-zero geometry only. No opponent or keeper.
 if(id==='pass-pair'){
  const random=seededGeometry(id,variantIndex);
  const distanceM=[6,12,20][variantIndex%3];
  for(let attempt=0;attempt<96;attempt++){
   const bx=variantIndex===0?-12:-16+random()*5;
   const by=variantIndex===0?8:5+random()*7;
   const angle=variantIndex===0?0:(random()-0.5)*0.52;
   const rx=bx+distanceM*Math.cos(angle),ry=by+distanceM*Math.sin(angle);
   const positions=new Map([[side+'-10',[bx-0.30,by]],[side+'-9',[rx,ry]]]);
   if(interceptionStart){
    const fraction=0.40+0.20*random(),lateral=(variantIndex%2===0?1:-1)*(0.75+random()*0.65);
    positions.set(opponent+'-2',[bx+fraction*(rx-bx)-Math.sin(angle)*lateral,by+fraction*(ry-by)+Math.cos(angle)*lateral]);
   }
   const staged=freeze(stage(positions).map(p=>p.id===side+'-9'?
    freeze({...p,facingRad:Math.atan2(by-ry,dir*(bx-rx))}):p));
   if(!physicallySeparated(staged,1.15)){
    if(variantIndex===0&&!interceptionStart)break;
    continue;
   }
   return freeze({id,side,opponent,variantIndex,activeIds,staged,...(interceptionStart?{interceptionStart:true}:{}),
    ball:freeze({preset:'roll',seed:'me-small-pass-pair-v'+variantIndex+'-'+side,
     x:dir*bx,y:by,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:interceptionStart?3:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free isolated pass setup');
 }
 // CROSS-01: stationary penalty-area target, native wide actor.
 if(id==='cross-pair'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const bx=variantIndex===0?30:28+random()*8;
   const by=variantIndex===0?24:22+random()*6;
   const rx=variantIndex===0?42:39+random()*6;
   const ry=variantIndex===0?4:1+random()*8;
   const positions=new Map([[side+'-10',[bx-0.30,by]],[side+'-9',[rx,ry]]]);
   const staged=freeze(stage(positions).map(p=>p.id===side+'-9'?
    freeze({...p,facingRad:Math.atan2(by-ry,dir*(bx-rx))}):p));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,
    ball:freeze({preset:'roll',seed:'me-small-cross-pair-v'+variantIndex+'-'+side,
     x:dir*bx,y:by,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:2,officialMatchResult:null});
  }
  throw new RangeError('No collision-free isolated cross setup');
 }
 // SHOT-05: a rolling ball approaches the original stationary shoe
 // from six directions and five speed bands. Stage only before tick zero.
 if(id==='shot-solo'&&firstTimeShot){
  const random=seededGeometry('shot-first-time',variantIndex);
  const angles=[Math.PI/2,-Math.PI/2,Math.PI/3,-Math.PI/3,2*Math.PI/3,-2*Math.PI/3];
  const angle=angles[variantIndex%angles.length];
  const speed=4+Math.floor(variantIndex/angles.length)*0.75;
  const ux=Math.cos(angle),uy=Math.sin(angle),travel=1.05;
  for(let attempt=0;attempt<96;attempt++){
   const contactX=tapInStart?48.0+random()*2.7:26+random()*12;
   const contactY=tapInStart?-1.7+random()*3.4:-10+random()*20;
   // Existing native shoe centre is 0.22m ahead of the player.
   const staged=stage(new Map([[side+'-10',[contactX-0.22,contactY]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,firstTimeShot:true,
    ball:freeze({preset:'roll',seed:'me-small-shot-first-time-'+(tapInStart?'tap-in-':'')+'v'+variantIndex+'-'+side,
     x:dir*(contactX-travel*ux),y:contactY-travel*uy,z:0,vx:dir*speed*ux,vy:speed*uy,vz:0}),
    genuinePhysicalPlayers:1,officialMatchResult:null});
  }
  throw new RangeError('No collision-free first-time shot setup');
 }
 // SHOT-01: one original physical shooter and a stationary ball.
 if(id==='shot-solo'){
  const random=seededGeometry(id,variantIndex);
  for(let attempt=0;attempt<96;attempt++){
   const fixed=variantIndex===0&&attempt===0;
   const bx=tapInStart?52.5-(fixed?3:1+random()*4.5):variantIndex===0?30:24+random()*17;
   const by=tapInStart?(fixed?1.8:-2.25+random()*4.5):variantIndex===0?0:-14+random()*28;
   const staged=stage(new Map([[side+'-10',[bx-0.30,by]]]));
   if(!physicallySeparated(staged,1.15))continue;
   return freeze({id,side,opponent,variantIndex,activeIds,staged,
    ball:freeze({preset:'roll',seed:'me-small-shot-solo-'+(tapInStart?'tap-in-':'')+'v'+variantIndex+'-'+side,
     x:dir*bx,y:by,z:0,vx:0,vy:0,vz:0}),
    genuinePhysicalPlayers:1,officialMatchResult:null});
  }
  throw new RangeError('No collision-free isolated shot setup');
 }
 const original=new Map([
  [side+'-10',[(id==='dribble-1v1'||id==='carry-solo')?29.45:id==='keeper-1v1'?29.50:29.72,0]],
  [side+'-9',[32,-6]],
  [side+'-11',[32,7]],
  [opponent+'-2',[34,2.7]],
  [opponent+'-3',[38,-5.7]],
  [opponent+'-4',[39,7.7]],
  [opponent+'-1',[48,0]]
 ]);
 let staged,ballX=30,ballY=0;
 if(blockStart){
  const random=seededGeometry(id,variantIndex);let accepted=false;
  for(let attempt=0;attempt<96&&!accepted;attempt++){
   const bx=34+random()*6,by=(variantIndex%2===0?1:-1)*(1.0+random()*3.5);
   const dx=2.0+random()*3.0,aimY=Math.sign(by)*2.65;
   const laneY=by+(aimY-by)*dx/(52.5-bx);
   const offset=(variantIndex%4<2?1:-1)*(variantIndex%3===0?0.15:variantIndex%3===1?0.65:1.25);
   const positions=new Map([[side+'-10',[bx-0.30,by]],[opponent+'-2',[bx+dx,laneY+offset]],[opponent+'-1',[50,0]]]);
   const candidate=stage(positions);
   if(physicallySeparated(candidate,1.15)){staged=candidate;ballX=bx;ballY=by;accepted=true;}
  }
  if(!accepted)throw new RangeError('No collision-free shot-block setup');
 }else if(shoulderStart){
  // Dedicated shoulder fixture: both actors start in the same running
  // direction, already alongside. No retreat or lateral chase to set up contact.
  const random=seededGeometry(id,variantIndex);
  let accepted=false;
  for(let attempt=0;attempt<96&&!accepted;attempt++){
   const fixed=variantIndex===0&&attempt===0;
   const bx=fixed?30:27+random()*6,by=fixed?0:-6+random()*12;
   const ax=bx-(fixed?0.55:0.50+random()*0.15);
   const lateral=(variantIndex%2===0?1:-1)*(fixed?1.16:1.15+random()*0.10);
   const longitudinal=fixed?0:(random()-0.5)*0.30;
   const positions=new Map([[side+'-10',[ax,by]],[opponent+'-2',[ax+longitudinal,by+lateral]]]);
   const candidate=stage(positions);
   if(physicallySeparated(candidate,1.15)){staged=candidate;ballX=bx;ballY=by;accepted=true;}
  }
  if(!accepted)throw new RangeError('No collision-free paired shoulder start');
 }else if(variantIndex===0){
  staged=stage(original);
 }else{
  const random=seededGeometry(id,variantIndex);
  let accepted=false;
  for(let attempt=0;attempt<96&&!accepted;attempt++){
   const bx=27+random()*6,by=-6+random()*12;
   const positions=new Map([
    [side+'-10',(id==='dribble-1v1'||id==='carry-solo')?
     [bx-0.50-random()*0.17,by+(random()-0.5)*0.20]:
     id==='keeper-1v1'?
     [bx-0.50-random()*0.22,by+(random()-0.5)*0.38]:
     [bx-0.25-random()*0.26,by+(random()-0.5)*0.20]],
    [side+'-9',[bx+1.8+random()*2.4,by-4.8-random()*2.8]],
    [side+'-11',[bx+1.8+random()*2.4,by+4.8+random()*2.8]],
    [opponent+'-2',id==='dribble-1v1'?
     [bx+2.2+random()*2.2,by-2.2+random()*4.4]:
     [bx+3.2+random()*2.5,by-1+random()*4]],
    [opponent+'-3',[bx+7+random()*2.7,by-4.6-random()*2.7]],
    [opponent+'-4',[bx+8+random()*2.7,by+4.6+random()*2.7]],
    [opponent+'-1',[46.7+random()*2.2,
      Math.max(-4,Math.min(4,by*0.35+(random()-0.5)*1.8))]]
   ]);
   const candidate=stage(positions);
   if(physicallySeparated(candidate,1.15)){
    staged=candidate;ballX=bx;ballY=by;accepted=true;
   }
  }
  if(!accepted)throw new RangeError('No collision-free seeded small-sided start');
 }
 // An opt-in 10s experiment starts 30m further back. Move only the
 // original active runner and the initial ball BEFORE tick zero; the ball,
 // both native shoe colliders and all subsequent 60Hz motion remain Rapier.
 // No post-kickoff teleport, goal-line interception or artificial wall.
 if(carryRunwayStart){
  const startX=staged.find(p=>p.id===side+'-10').x;
  const offsetX=-dir*30;
  staged=freeze(staged.map(p=>p.id!==side+'-10'?p:
   freeze({...p,x:startX+offsetX,baseX:p.baseX+offsetX})));
  ballX-=30;
 }
 if(!physicallySeparated(staged,0.98))
  throw new RangeError('Original 22-player hard separation must hold at tick zero');
 return freeze({
  id,side,opponent,variantIndex,activeIds,staged,
  ...(carryRunwayStart?{carryRunwayStart:true}:{}),
  ...(shoulderStart?{shoulderStart:true}:{}),
  ...(blockStart?{blockStart:true}:{}),
  ball:freeze({preset:'roll',
   seed:'me-small-'+id+(variantIndex===0?'':'-v'+variantIndex)+'-'+side,
   x:dir*ballX,y:ballY,z:0,vx:0,vy:0,vz:0}),
  genuinePhysicalPlayers:activeIds.length,
  officialMatchResult:null
 });
}
