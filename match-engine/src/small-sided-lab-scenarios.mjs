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
 freeze({id:ids[0],title:'Dribbling · 1v1 (no goalkeeper)',
  attackers:freeze([10]),defenders:freeze([2]),includeGoalkeeper:false,
  description:'Real attacker vs defender and the original Rapier ball; only attacker genuine shoe STARTs can trigger variable carry touches. No shot/pass/automatic tackle, possession or dribble success.'}),
 freeze({id:ids[1],title:'1v1 · Attacker vs goalkeeper',
  attackers:freeze([10]),defenders:freeze([]),
  description:'One forward faces a real opponent goalkeeper. Original Rapier shoe contact and keeper movement; observe shot, physical parry attempt or actual full-ball exit. No automatic goal or save.'}),
 freeze({id:ids[2],title:'1v1 + goalkeeper',
  attackers:freeze([10]),defenders:freeze([2]),
  description:'One forward, one real defender and the goalkeeper. Watch genuine pressure, shot selection, shoe contact and ball travel; no inferred tackle or possession.'}),
 freeze({id:ids[3],title:'2v1 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2]),
  description:'Two forwards against one defender and a goalkeeper. Observe live pass options, overlapping runs and native player-ball actions; no completed pass or goal without physical evidence.'}),
 freeze({id:ids[4],title:'2v2 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2,3]),
  description:'Two forwards against two defenders and a goalkeeper. Original 60 Hz movement, individual shoe collisions, pressure and shot/pass selection, not an 11v11 simulation.'}),
 freeze({id:ids[5],title:'3v3 + goalkeeper',
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
const byId=new Map(definitions.map(s=>[s.id,s]));
// Keeper 1v1: deterministic source-only 60Hz tactical targets, never a
// physical impulse, teleport, scripted save, possession or match result.
const bounded=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
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
 const dir=side==='home'?1:-1, gap=Math.hypot(ball.x-keeper.x,ball.y-keeper.y);
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
export function getSmallSidedScenario(id){
 const d=byId.get(id);
 if(!d)throw new RangeError('Unknown private small-sided situation');
 return d;
}
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
