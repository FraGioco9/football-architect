// #620: A bounded initial SHOT situation, never a mid-simulation teleport.
// The 22 IDs, roles and the unchanged 60Hz physics/actions remain authoritative.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function initialResearchShotLineup(players,side,ball){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite)||
    ball.z!==0||ball.vz!==0)
  throw new TypeError('Valid grounded canonical shot situation required');
 const direction=side==='home'?1:-1;
 if(direction*ball.x<25||direction*ball.x>40||Math.abs(ball.y)>10)
  throw new RangeError('Shot research requires attacking-third ball geometry');
 const actorId=side+'-10';
 if(players.filter(p=>p.id===actorId&&p.team===side&&p.role==='forward').length!==1)
  throw new TypeError('Exactly one canonical research forward required');
 const x=ball.x-direction*0.28,y=ball.y;
 return Object.freeze(players.map(p=>p.id===actorId?
  Object.freeze({...p,x,y,baseX:x,baseY:y,vx:0,vy:0,blockedBy:null}):p));
}
