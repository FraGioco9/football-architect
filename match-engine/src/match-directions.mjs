// Match identities and stadium ends are independent. The canonical
// first-half coordinate convention is home +X / away -X. A second
// period reverses the orientation, NOT the team or player identities.
export function validateAttackPolarity(polarity){
 if(polarity!==1&&polarity!==-1)throw new TypeError('Attack polarity must be +1 or -1');
 return polarity;
}
export function oppositeTeam(team){
 if(team!=='home'&&team!=='away')throw new TypeError('Canonical team required');
 return team==='home'?'away':'home';
}
export function attackDirection(team,polarity=1){
 validateAttackPolarity(polarity);
 if(team!=='home'&&team!=='away')throw new TypeError('Canonical team required');
 return (team==='home'?1:-1)*polarity;
}
export function teamAttackingEnd(end,polarity=1){
 validateAttackPolarity(polarity);
 if(end!==1&&end!==-1)throw new TypeError('Physical goal end must be +1 or -1');
 return end===attackDirection('home',polarity)?'home':'away';
}

// Bounded kickoff readiness: original players in their new own half,
// original keepers in the correct penalty areas. No formation teleport.
export function nativeHalfFormationReady(players){
 return Array.isArray(players)&&players.length===22&&new Set(players.map(p=>p.id)).size===22&&
 players.every(p=>['home','away'].includes(p.team)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  (p.id==='away-10'||(p.x*attackDirection(p.team,-1)<=-1&&
   (p.role!=='goalkeeper'||Math.abs(p.x)>=36&&Math.abs(p.y)<=20.16))));
}
