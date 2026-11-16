// #628 B05b: bounded DEV *before-tick-zero* original player placements.
// No teleports after play starts, no manufactured shoe events.
export const B05B_SOURCE_VERSION='actions-b05b-restart-staged-native-source-v1';
const finite=Number.isFinite;
const freeze=Object.freeze;
export const B05B_MODES=freeze(['throw-in','corner','goal-kick']);
const mirror=s=>s==='home'?1:s==='away'?-1:null;
export function basicSourcePositiveRestartSetup(players,attackSide,ball,kind){
 const direction=mirror(attackSide);
 if(!Array.isArray(players)||players.length!==22||
  direction===null||!B05B_MODES.includes(kind)||!ball||
  !['x','y','z','vx','vy','vz'].every(k=>finite(ball[k]))||
  ball.z!==0||ball.vz!==0||
  (kind==='throw-in'?
   Math.abs(ball.x)>1e-8||Math.abs(ball.y-direction*32.5)>1e-8||
   ball.vx!==0||ball.vy!==0:
   Math.abs(ball.x-direction*51)>1e-8||
   Math.abs(ball.y-direction*10)>1e-8||
   ball.vx!==0||ball.vy!==0))
  throw new TypeError('B05b requires exact bounded in-field Rapier boundary fixture');
 const lastTeam=kind==='corner'?
  attackSide==='home'?'away':'home':attackSide;
 const restartTeam=lastTeam==='home'?'away':'home';
 const sourceId=lastTeam+'-10',takerId=restartTeam+'-9';
 if(sourceId===takerId||players.some((p,i)=>
    !p||!/^(home|away)-(?:[1-9]|10|11)$/.test(p.id)||
    !['home','away'].includes(p.team)||
    (i>0&&players.slice(0,i).some(q=>q.id===p.id)))||
    players.filter(p=>p.id===sourceId&&p.role==='forward').length!==1||
    players.filter(p=>p.id===takerId&&p.role==='forward').length!==1)
  throw new TypeError('B05b needs unchanged original 22-player source and taker roles');
 const sourceFacing=lastTeam==='home'?1:-1;
 const dest=kind==='throw-in'?
  {x:0,y:direction*33.3}:
  kind==='corner'?
  {x:direction*51.75,y:direction*33.45}:
  {x:direction*47.24,y:direction*5.5};
 // Predictor used ONLY to put a real original shoe in the moving
 // ball's path BEFORE the first native 60Hz physics step.
 // Only a real original shoe START may kick a near-stationary ball
 // outward; no collision, action or source provenance is scripted.
 const source={x:ball.x-0.28*sourceFacing,y:ball.y};
 const modifications=new Map([[sourceId,source],[takerId,dest]]);
 const staged=freeze(players.map(p=>{
  const point=modifications.get(p.id);
  return point?freeze({...p,x:point.x,y:point.y,
   baseX:point.x,baseY:point.y,vx:0,vy:0,blockedBy:null}):p;
 }));
 for(const p of staged)
  if(Math.abs(p.x)>52.06||Math.abs(p.y)>33.56)
   throw new RangeError('B05b must remain inside canonical player pitch');
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
   staged[i].y-staged[j].y)<0.98-1e-8)
   throw new RangeError('B05b original 22-player separation must hold');
 return freeze({version:B05B_SOURCE_VERSION,players:staged,
  sourceId,takerId,lastTeam,restartTeam,kind,
  beforeTickZeroOnly:true,actualShoeStartRequired:true,
  physicalBallImpulse:false,officialResult:false});
}
