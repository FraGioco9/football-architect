// #628 H2a. A genuine kick can only follow an original shoe START.
// Only before-tick-zero original 22-player setup; no player teleports.
export const B06B_OPENING_LINEUP_VERSION='me-628-b06b-opening-lineup-v1';
export function initialB06bOpeningLineup(players){
 if(!Array.isArray(players)||players.length!==22||
    players.filter(p=>p?.id==='home-10'&&p.team==='home'&&p.role==='forward').length!==1||
    new Set(players.map(p=>p?.id)).size!==22)
  throw new TypeError('B06b opening needs the original 22 unique player identities');
 const staged=Object.freeze(players.map(p=>p.id==='home-10'?
  Object.freeze({...p,x:-0.28,y:0,baseX:-0.28,baseY:0,
    vx:0,vy:0,blockedBy:null}):p));
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
     staged[i].y-staged[j].y)<0.98-1e-8)
   throw new RangeError('B06b source cannot violate original 0.98m player gap');
 return staged;
}
