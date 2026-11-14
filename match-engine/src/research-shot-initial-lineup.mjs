// C2.3b experimental starting *situation*, never a mid-physics move.
// The same twenty-two canonical IDs, team, role and movement limits remain.
// Only one forward starts in the attacking third in this explicitly gated,
// local-only research setup. A genuine Rapier contact still must occur.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function initialResearchShotLineup(players,side,ball){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    ![ball.x,ball.y,ball.z].every(finite)||ball.z!==0||
    ![ball.vx,ball.vy,ball.vz].every(finite)||ball.vz!==0)
  throw new TypeError('Valid grounded, closed 22-player shot research situation required');
 const direction=side==='home'?1:-1;
 if(direction*ball.x<25||direction*ball.x>40||
    Math.abs(ball.y)>10)
  throw new RangeError('Shot research starts only in a safe attacking-third geometry');
 const actorId=side+'-10';
 if(players.filter(p=>p.id===actorId&&p.team===side&&p.role==='forward').length!==1)
  throw new TypeError('Canonical research forward must exist exactly once');
 const x=ball.x-direction*0.28,y=ball.y;
 const result=players.map(p=>p.id===actorId?
  Object.freeze({...p,x,y,baseX:x,baseY:y,
   vx:0,vy:0,blockedBy:null}):p);
 return Object.freeze(result);
}
