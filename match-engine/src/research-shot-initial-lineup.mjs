// #620: A bounded initial SHOT situation, never a mid-simulation teleport.
// The 22 IDs, roles and the unchanged 60Hz physics/actions remain authoritative.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function initialResearchShotLineup(players,side,ball,{blockedLane=false,wideCross=false}={}){
 if(typeof blockedLane!=='boolean'||typeof wideCross!=='boolean'||(blockedLane&&wideCross))
  throw new TypeError('Only a single original SHOT or wide CROSS research variant');
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    ![ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz].every(finite)||
    ball.z!==0||ball.vz!==0)
  throw new TypeError('Valid grounded canonical shot situation required');
 const direction=side==='home'?1:-1;
 if(wideCross?(
    direction*ball.x<25||direction*ball.x>40||
    Math.abs(ball.y)<20||Math.abs(ball.y)>30
   ):(direction*ball.x<25||direction*ball.x>40||Math.abs(ball.y)>10))
  throw new RangeError('Shot research requires attacking-third ball geometry');
 const actorId=side+'-10';
 if(players.filter(p=>p.id===actorId&&p.team===side&&p.role==='forward').length!==1)
  throw new TypeError('Exactly one canonical research forward required');
 // One genuine opponent covers all three existing goal-mouth rays.
 // Only initial positions may differ; no runtime player teleport.
 const blockerId=(side==='home'?'away':'home')+'-2';
 if(blockedLane&&players.filter(p=>p.id===blockerId&&
     p.role==='defender'&&p.team!==side).length!==1)
  throw new TypeError('Exactly one canonical opposing defender required');
 if(wideCross&&players.filter(p=>
   p.id===side+'-9'&&p.team===side&&p.role==='forward').length!==1)
  throw new TypeError('Real team forward receiver required for physical cross');
 const x=ball.x-direction*0.28,y=ball.y;
 const bx=ball.x+direction*11;
 const by=ball.y*(1-11/(52.5-Math.abs(ball.x)));
 const staged=players.map(p=>{
  if(p.id===actorId)return Object.freeze({...p,x,y,baseX:x,baseY:y,
   vx:0,vy:0,blockedBy:null});
  if(wideCross&&p.id===side+'-9'){
   const bx=direction*43,by=ball.y<0?-3:3;
   return Object.freeze({...p,x:bx,y:by,baseX:bx,baseY:by,
    vx:0,vy:0,blockedBy:null});
  }
  if(blockedLane&&p.id===blockerId)return Object.freeze({...p,
   x:bx,y:by,baseX:bx,baseY:by,vx:0,vy:0,blockedBy:null});
  return p;
 });
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,staged[i].y-staged[j].y)<0.98-1e-8)
   throw new RangeError('Initial 0.98m player separation violated');
 return Object.freeze(staged);
}
