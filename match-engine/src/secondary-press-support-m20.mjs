// #628 M20 — actual second-defender MARKING near a contested rolling ball.
// One optional teammate, one observed off-ball opponent, no forced collision.
const freeze=Object.freeze,finite=Number.isFinite;
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
export const M20_SECOND_PRESS_LIMITS=freeze({
 candidateBallM:25,opponentBallM:25,markingM:32,
 goalsideOffsetM:1,incumbentMarginM:3
});
function validated(players,team,ball,pressers,excluded,incumbentId){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(team)||!ball||
    ![ball.x,ball.y].every(finite)||!pressers||
    !Array.isArray(excluded)||excluded.some(id=>typeof id!=='string')||
    (incumbentId!==null&&typeof incumbentId!=='string'))
  throw new TypeError('M20 requires original full 22 current physical players');
 const ids=new Set();
 for(let i=0;i<players.length;i++){
  const p=players[i],t=i<11?'home':'away',n=i%11+1;
  const expected=n===1?'goalkeeper':n<=5?'defender':
   n<=8?'midfielder':'forward';
  if(p?.id!==t+'-'+n||p.team!==t||p.role!==expected||
     ![p.x,p.y].every(finite)||ids.has(p.id))
   throw new TypeError('M20 requires exact ordered original 22 IDs');
  ids.add(p.id);
 }
 for(const t of ['home','away']){
  const id=pressers[t],p=players.find(x=>x.id===id);
  if(!p||p.team!==t||p.role==='goalkeeper')
   throw new TypeError('M20 requires real primary pressers');
 }
 if(excluded.some(id=>!ids.has(id))||
    (incumbentId!==null&&!ids.has(incumbentId)))
  throw new TypeError('M20 forbids invented marker IDs');
}
export function selectObservedSecondaryPressSupport(
 players,team,ball,pressers,{excludedIds=[],incumbentId=null}={}
){
 validated(players,team,ball,pressers,excludedIds,incumbentId);
 const exclude=new Set([...excludedIds,pressers[team]]);
 const opp=team==='home'?'away':'home';
 const threats=players.filter(p=>p.team===opp&&p.role!=='goalkeeper'&&
  p.id!==pressers[opp]&&d(p,ball)<=25);
 const candidates=players.filter(p=>p.team===team&&
  p.role!=='goalkeeper'&&!exclude.has(p.id)&&d(p,ball)<=25);
 const options=[];
 for(const player of candidates)for(const opponent of threats){
  const gap=d(player,opponent);
  if(gap>32)continue;
  options.push({player,opponent,score:d(player,ball)+
   0.45*d(opponent,ball)+0.2*gap,gap});
 }
 if(!options.length)return null;
 options.sort((a,b)=>a.score-b.score||
  a.player.id.localeCompare(b.player.id)||
  a.opponent.id.localeCompare(b.opponent.id));
 const best=options[0];
 const previous=options.filter(x=>x.player.id===incumbentId)
  .sort((a,b)=>a.score-b.score||
   a.opponent.id.localeCompare(b.opponent.id))[0];
 const chosen=previous&&previous.score<=best.score+3?previous:best;
 const observed=chosen.opponent;
 const goalSide=team==='home'?-1:1;
 // Mark the ACTUAL off-ball opponent from the goal-facing side, with a
 // modest lane bias towards the ACTUAL ball. No collider is a target.
 const target=freeze({
  x:clamp(observed.x+goalSide, -52.06,52.06),
  y:clamp(observed.y+clamp((ball.y-observed.y)*0.18,-2.5,2.5),
   -33.56,33.56)
 });
 return freeze({playerId:chosen.player.id,opponentId:observed.id,target,
  ballGapM:d(chosen.player,ball),
  opponentBallGapM:d(observed,ball),
  currentOpponentGapM:chosen.gap,scoreM:chosen.score});
}
