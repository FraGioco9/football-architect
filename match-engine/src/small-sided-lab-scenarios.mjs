// #628 LAB-SMALL-01: bounded small-sided exercises, never a 11v11 match.
// Twenty-two canonical mover identities stay available to the existing
// engine, but ONLY these selected 2–7 players receive actual Rapier shoe
// colliders, participate in action policy or appear in the exercise.
// All initial positions are staged BEFORE tick zero; no in-play teleport.
const freeze=Object.freeze;
const ids=freeze(['keeper-1v1','defender-1v1','overload-2v1','duel-2v2','duel-3v3']);
const definitions=freeze([
 freeze({id:ids[0],title:'1v1 · Attacker vs goalkeeper',
  attackers:freeze([10]),defenders:freeze([]),
  description:'One forward faces a real opponent goalkeeper. Original Rapier shoe contact and keeper movement; observe shot, physical parry attempt or actual full-ball exit. No automatic goal or save.'}),
 freeze({id:ids[1],title:'1v1 + goalkeeper',
  attackers:freeze([10]),defenders:freeze([2]),
  description:'One forward, one real defender and the goalkeeper. Watch genuine pressure, shot selection, shoe contact and ball travel; no inferred tackle or possession.'}),
 freeze({id:ids[2],title:'2v1 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2]),
  description:'Two forwards against one defender and a goalkeeper. Observe live pass options, overlapping runs and native player-ball actions; no completed pass or goal without physical evidence.'}),
 freeze({id:ids[3],title:'2v2 + goalkeeper',
  attackers:freeze([10,9]),defenders:freeze([2,3]),
  description:'Two forwards against two defenders and a goalkeeper. Original 60 Hz movement, individual shoe collisions, pressure and shot/pass selection, not an 11v11 simulation.'}),
 freeze({id:ids[4],title:'3v3 + goalkeeper',
  attackers:freeze([10,9,11]),defenders:freeze([2,3,4]),
  description:'Three forwards face three defenders and a goalkeeper. Keep the same Rapier world and canonical physics; inspect live support, blocked lanes and genuinely resulting actions.'})
]);
const byId=new Map(definitions.map(s=>[s.id,s]));
export const SMALL_SIDED_LAB_SCENARIOS=freeze(definitions.map(s=>
 freeze({...s,mode:'situation',goal:'situation',
  initial:freeze({preset:'roll',seed:'me-small-'+s.id+'-home',
   x:30,y:0,z:0,vx:0,vy:0,vz:0}),
  focus:freeze([...s.attackers.map(n=>'home-'+n),
   ...s.defenders.map(n=>'away-'+n),'away-1']),
  source:'original-rapier-selected-shoe-colliders-only',
  officialResult:false})
));
export function getSmallSidedScenario(id){
 const d=byId.get(id);
 if(!d)throw new RangeError('Unknown private small-sided situation');
 return d;
}
export function smallSidedSetup(id,side,canonicalPlayers){
 const d=getSmallSidedScenario(id);
 if(!['home','away'].includes(side)||!Array.isArray(canonicalPlayers)||
    canonicalPlayers.length!==22||canonicalPlayers.some(p=>!p||
     typeof p.id!=='string'||!['home','away'].includes(p.team)))
  throw new TypeError('Small-sided exercise needs real canonical ordered 22-player identities');
 const opponent=side==='home'?'away':'home',dir=side==='home'?1:-1;
 const activeIds=freeze(canonicalPlayers.filter(p=>
   p.id===opponent+'-1'||
   d.attackers.some(n=>p.id===side+'-'+n)||
   d.defenders.some(n=>p.id===opponent+'-'+n)
 ).map(p=>p.id));
 if(activeIds.length!==d.attackers.length+d.defenders.length+1||
    new Set(activeIds).size!==activeIds.length)
  throw new TypeError('Every real small-sided attacker/defender/keeper must have a canonical identity');
 const positions=new Map([
  [side+'-10',[29.72,0]],
  [side+'-9',[32,-6]],
  [side+'-11',[32,7]],
  [opponent+'-2',[34,2.7]],
  [opponent+'-3',[38,-5.7]],
  [opponent+'-4',[39,7.7]],
  [opponent+'-1',[48,0]]
 ]);
 const staged=freeze(canonicalPlayers.map(p=>{
  if(!activeIds.includes(p.id))return p;
  const [x,y]=positions.get(p.id);
  return freeze({...p,x:dir*x,y,baseX:dir*x,baseY:y,
   vx:0,vy:0,blockedBy:null});
 }));
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
    staged[i].y-staged[j].y)<0.98-1e-8)
   throw new RangeError('Original 22-player hard separation must hold at tick zero');
 return freeze({
  id,side,opponent,activeIds,staged,
  ball:freeze({preset:'roll',seed:'me-small-'+id+'-'+side,
   x:dir*30,y:0,z:0,vx:0,vy:0,vz:0}),
  genuinePhysicalPlayers:activeIds.length,
  officialMatchResult:null
 });
}
