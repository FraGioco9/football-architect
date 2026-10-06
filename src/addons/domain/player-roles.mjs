/** SIM03.01 — Role catalogue. Identifiers are stable save-facing identifiers. */
import {canonicalPosition,POSITIONS} from './player-ratings.mjs';
export const ROLE_SCHEMA=1;
export const ROLE_DUTIES=Object.freeze(['defend','support','attack']);
const def=(id,it,en,positions,weights,effect)=>Object.freeze({id,label:Object.freeze({it,en}),positions:Object.freeze(positions),weights:Object.freeze(weights),effect:Object.freeze(effect)});
/** Effects express compact tendencies, not fixed goals: passage creation, shot movement, protection, pressure. */
export const ROLES=Object.freeze([
 def('goalkeeper','Portiere','Goalkeeper',['GK'],{reflexes:3,handling:2,keeperPositioning:3},{passing:0,shooting:0,cover:2,press:0}),
 def('sweeperKeeper','Portiere libero','Sweeper keeper',['GK'],{rushingOut:3,distribution:3,decisions:2},{passing:2,shooting:0,cover:1,press:1}),
 def('centralDefender','Difensore centrale','Central defender',['CB'],{marking:3,tackling:3,defensivePositioning:3},{passing:0,shooting:0,cover:3,press:1}),
 def('ballPlayingDefender','Difensore impostatore','Ball-playing defender',['CB'],{shortPassing:3,longPassing:3,decisions:2},{passing:3,shooting:0,cover:1,press:0}),
 def('stopper','Marcatore','Stopper',['CB'],{marking:3,aggression:2,strength:2},{passing:-1,shooting:0,cover:2,press:3}),
 def('fullBack','Terzino','Full-back',['RB','LB','RWB','LWB'],{stamina:3,marking:2,crossing:2},{passing:1,shooting:0,cover:2,press:1}),
 def('attackingFullBack','Terzino offensivo','Attacking full-back',['RB','LB','RWB','LWB'],{crossing:3,pace:3,stamina:2},{passing:2,shooting:1,cover:-1,press:1}),
 def('invertedFullBack','Terzino invertito','Inverted full-back',['RB','LB','RWB','LWB'],{shortPassing:3,decisions:2,defensivePositioning:2},{passing:3,shooting:0,cover:1,press:1}),
 def('anchor','Mediano','Anchor',['CDM','CM'],{defensivePositioning:3,marking:3,anticipation:2},{passing:0,shooting:-1,cover:3,press:1}),
 def('ballWinner','Incontrista','Ball-winning midfielder',['CDM','CM'],{tackling:3,workRate:3,aggression:2},{passing:0,shooting:0,cover:2,press:3}),
 def('deepPlaymaker','Regista arretrato','Deep-lying playmaker',['CDM','CM'],{longPassing:3,vision:3,decisions:2},{passing:4,shooting:-1,cover:0,press:0}),
 def('centralMidfielder','Centrocampista centrale','Central midfielder',['CM','CDM','CAM'],{shortPassing:3,teamwork:3,stamina:2},{passing:1,shooting:1,cover:1,press:1}),
 def('boxToBox','Centrocampista box-to-box','Box-to-box midfielder',['CM'],{stamina:3,workRate:3,offBall:2},{passing:1,shooting:2,cover:1,press:2}),
 def('mezzala','Mezzala','Mezzala',['CM','CAM'],{offBall:3,dribbling:2,vision:2},{passing:2,shooting:3,cover:-1,press:0}),
 def('playmaker','Regista','Playmaker',['CM','CAM'],{vision:3,shortPassing:3,technique:2},{passing:4,shooting:0,cover:0,press:0}),
 def('wideMidfielder','Esterno di centrocampo','Wide midfielder',['RM','LM','RW','LW'],{stamina:3,crossing:2,teamwork:2},{passing:2,shooting:0,cover:1,press:2}),
 def('winger','Ala','Winger',['RM','LM','RW','LW'],{crossing:3,pace:3,dribbling:2},{passing:2,shooting:2,cover:-1,press:1}),
 def('invertedWinger','Esterno invertito','Inverted winger',['RM','LM','RW','LW'],{dribbling:3,finishing:3,offBall:2},{passing:1,shooting:4,cover:-1,press:0}),
 def('attackingMidfielder','Trequartista','Attacking midfielder',['CAM','CF'],{offBall:3,technique:3,composure:2},{passing:2,shooting:3,cover:-1,press:0}),
 def('advancedPlaymaker','Regista avanzato','Advanced playmaker',['CAM','CF'],{vision:3,technique:3,firstTouch:2},{passing:4,shooting:1,cover:-2,press:0}),
 def('linkForward','Punta di manovra','Link forward',['CF','ST'],{shortPassing:3,vision:3,firstTouch:2},{passing:3,shooting:2,cover:-1,press:0}),
 def('falseNine','Falso nove','False nine',['CF','ST'],{vision:3,offBall:3,decisions:2},{passing:3,shooting:2,cover:-2,press:0}),
 def('advancedForward','Attaccante avanzato','Advanced forward',['CF','ST'],{offBall:3,finishing:3,acceleration:2},{passing:0,shooting:4,cover:-2,press:1}),
 def('targetForward','Punta di riferimento','Target forward',['CF','ST'],{strength:3,heading:3,firstTouch:2},{passing:2,shooting:3,cover:0,press:0}),
 def('poacher','Rapace d’area','Poacher',['CF','ST'],{finishing:3,composure:3,offBall:2},{passing:-1,shooting:4,cover:-2,press:0}),
 def('pressingForward','Attaccante di pressing','Pressing forward',['CF','ST'],{workRate:3,stamina:3,anticipation:2},{passing:0,shooting:2,cover:-1,press:3}),
]);
export const ROLE_BY_ID=Object.freeze(Object.fromEntries(ROLES.map(r=>[r.id,r])));
const error=code=>{throw new Error(`SIM03_${code}`)};
export function availableRoles(position){const p=canonicalPosition(position);return ROLES.filter(r=>r.positions.includes(p));}
export function defaultRole(position){const p=canonicalPosition(position);return ({GK:'goalkeeper',CB:'centralDefender',RB:'fullBack',LB:'fullBack',RWB:'fullBack',LWB:'fullBack',CDM:'anchor',CM:'centralMidfielder',RM:'wideMidfielder',LM:'wideMidfielder',CAM:'attackingMidfielder',RW:'winger',LW:'winger',CF:'linkForward',ST:'advancedForward'})[p];}
export function roleDetails(id,locale='it'){const r=ROLE_BY_ID[id];if(!r)error('UNKNOWN_ROLE');return {id:r.id,label:r.label[locale==='en'?'en':'it'],positions:[...r.positions],duties:[...ROLE_DUTIES],effect:{...r.effect}};}
export function validateRoleChoice(position,role,duty){const p=canonicalPosition(position);if(!ROLE_BY_ID[role])error('UNKNOWN_ROLE');if(!ROLE_BY_ID[role].positions.includes(p))error('INCOMPATIBLE_ROLE');if(!ROLE_DUTIES.includes(duty))error('DUTY');return true;}
export function checkRoleCatalogue(){if(new Set(ROLES.map(r=>r.id)).size!==ROLES.length)error('DUPLICATES');for(const pos of POSITIONS)if(!availableRoles(pos).length)error('UNCOVERED');return true;}
