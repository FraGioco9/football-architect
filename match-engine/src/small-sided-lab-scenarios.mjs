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

const ids=freeze(['dribble-1v1','keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3']);
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
  description:'Three forwards face three defenders and a goalkeeper. Keep the same Rapier world and canonical physics; inspect live support, blocked lanes and genuinely resulting actions.'})
]);
const byId=new Map(definitions.map(s=>[s.id,s]));
export const SMALL_SIDED_LAB_SCENARIOS=freeze(definitions.map(s=>
 freeze({...s,mode:'situation',goal:'situation',
  initial:freeze({preset:'roll',seed:'me-small-'+s.id+'-home',
   x:30,y:0,z:0,vx:0,vy:0,vz:0}),
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
export function smallSidedSetup(id,side,canonicalPlayers,{variantIndex=0}={}){
 const d=getSmallSidedScenario(id);
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
   d.defenders.some(n=>p.id===opponent+'-'+n)
 ).map(p=>p.id));
 if(activeIds.length!==d.attackers.length+d.defenders.length+
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
    vx:0,vy:0,blockedBy:null});
  }));
 }
 const original=new Map([
  [side+'-10',[29.72,0]],
  [side+'-9',[32,-6]],
  [side+'-11',[32,7]],
  [opponent+'-2',[34,2.7]],
  [opponent+'-3',[38,-5.7]],
  [opponent+'-4',[39,7.7]],
  [opponent+'-1',[48,0]]
 ]);
 let staged,ballX=30,ballY=0;
 if(variantIndex===0){
  staged=stage(original);
 }else{
  const random=seededGeometry(id,variantIndex);
  let accepted=false;
  for(let attempt=0;attempt<96&&!accepted;attempt++){
   const bx=27+random()*6,by=-6+random()*12;
   const positions=new Map([
    [side+'-10',[bx-0.25-random()*0.26,by+(random()-0.5)*0.20]],
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
 if(!physicallySeparated(staged,0.98))
  throw new RangeError('Original 22-player hard separation must hold at tick zero');
 return freeze({
  id,side,opponent,variantIndex,activeIds,staged,
  ball:freeze({preset:'roll',
   seed:'me-small-'+id+(variantIndex===0?'':'-v'+variantIndex)+'-'+side,
   x:dir*ballX,y:ballY,z:0,vx:0,vy:0,vz:0}),
  genuinePhysicalPlayers:activeIds.length,
  officialMatchResult:null
 });
}
