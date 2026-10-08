/** PLY-REBUILD PLYR-04 — positional ratings derived from attribute schema v2. */
import {validateAttributes,clampAttribute} from './player-attributes.mjs';

const posKeys=['GK','RB','LB','CB','RWB','LWB','CDM','CM','RM','LM','CAM','RW','LW','ST'];
export const POSITIONS=Object.freeze(posKeys);
const aliases={G:'GK',POR:'GK',GOALKEEPER:'GK',TD:'RB',TS:'LB',DC:'CB',DFC:'CB',DCB:'CB',D:'CB',DEF:'CB',DF:'CB',RBK:'RB',LBK:'LB',MED:'CDM',CC:'CM',COC:'CAM',AD:'RW',AS:'LW',DM:'CDM',DMC:'CDM',MC:'CM',MID:'CM',M:'CM',AM:'CAM',AMC:'CAM',ACM:'CAM',ATT:'ST',F:'ST',FW:'ST',STRIKER:'ST',RF:'RW',LF:'LW',RWM:'RM',LWM:'LM'};
export function canonicalPosition(pos){
 const key=String(pos??'').trim().toUpperCase().replace(/[^A-Z]/g,'');
 const normalized=aliases[key]??key;
 if(!POSITIONS.includes(normalized))throw new Error(`PLY04_UNKNOWN_POSITION:${key}`);
 return normalized;
}

/* Weights sum to 100 for every position. These are rating weights only;
 * match-event formulas are intentionally deferred.
 */
const specs={
 GK:{reflexes:17,keeperPositioning:15,handling:13,diving:12,aerialReach:10,commandArea:8,rushingOut:7,oneOnOne:9,concentration:4,decisions:3,passing:2},
 CB:{marking:16,tackling:15,defensivePositioning:14,anticipation:11,strength:9,heading:8,jumping:6,bravery:5,decisions:5,passing:5,concentration:6},
 LB:{marking:12,tackling:11,defensivePositioning:11,pace:11,stamina:10,crossing:10,acceleration:8,passing:8,anticipation:6,workRate:7,ballControl:6},
 RB:{marking:12,tackling:11,defensivePositioning:11,pace:11,stamina:10,crossing:10,acceleration:8,passing:8,anticipation:6,workRate:7,ballControl:6},
 LWB:{pace:13,stamina:13,crossing:13,acceleration:11,workRate:10,marking:8,tackling:7,passing:8,dribbling:7,ballControl:5,offBall:5},
 RWB:{pace:13,stamina:13,crossing:13,acceleration:11,workRate:10,marking:8,tackling:7,passing:8,dribbling:7,ballControl:5,offBall:5},
 CDM:{defensivePositioning:14,tackling:13,anticipation:11,passing:12,decisions:10,marking:9,teamwork:8,stamina:7,concentration:6,strength:5,workRate:5},
 CM:{passing:17,vision:13,decisions:12,ballControl:11,teamwork:9,stamina:8,anticipation:6,workRate:6,composure:5,offBall:5,dribbling:4,defensivePositioning:4},
 LM:{crossing:13,pace:12,stamina:11,passing:11,dribbling:10,acceleration:10,workRate:9,ballControl:8,teamwork:6,offBall:5,vision:5},
 RM:{crossing:13,pace:12,stamina:11,passing:11,dribbling:10,acceleration:10,workRate:9,ballControl:8,teamwork:6,offBall:5,vision:5},
 CAM:{vision:15,passing:14,decisions:12,ballControl:12,offBall:11,dribbling:9,composure:8,finishing:6,longShots:5,agility:4,teamwork:4},
 LW:{dribbling:15,pace:14,acceleration:13,ballControl:11,crossing:10,finishing:9,agility:8,offBall:7,composure:5,passing:5,vision:3},
 RW:{dribbling:15,pace:14,acceleration:13,ballControl:11,crossing:10,finishing:9,agility:8,offBall:7,composure:5,passing:5,vision:3},
 ST:{finishing:19,offBall:16,composure:12,ballControl:9,heading:8,acceleration:8,strength:7,anticipation:7,pace:5,bravery:4,decisions:5},
};
export const POSITION_WEIGHTS=Object.freeze(Object.fromEntries(Object.entries(specs).map(([p,v])=>[p,Object.freeze({...v})])));

const related=[['RB','LB','RWB','LWB'],['RM','LM','RW','LW'],['ST','CAM'],['CDM','CM','CAM'],['CB','CDM','RB','LB']];
export function familiarityPenalty(natural,target){
 natural=canonicalPosition(natural);target=canonicalPosition(target);
 if(natural===target)return 0;
 if((natural==='GK')!==(target==='GK'))return 58;
 if(related.some(g=>g.includes(natural)&&g.includes(target)))return (natural[0]===target[0]&&natural.endsWith('B')!==target.endsWith('B'))?7:5;
 if((['LB','LWB'].includes(natural)&&['RB','RWB'].includes(target))||(['RB','RWB'].includes(natural)&&['LB','LWB'].includes(target)))return 9;
 if((['LM','LW'].includes(natural)&&['RM','RW'].includes(target))||(['RM','RW'].includes(natural)&&['LM','LW'].includes(target)))return 8;
 return 16;
}
export function rawPositionRating(values,position){
 const p=canonicalPosition(position),weights=POSITION_WEIGHTS[p],scores='values' in (values??{})?values.values:values;
 if(!scores||typeof scores!=='object')throw new Error('PLY04_INVALID_VALUES');
 return Object.entries(weights).reduce((sum,[key,weight])=>{
  if(!Number.isInteger(scores[key])||scores[key]<1||scores[key]>100)throw new Error('PLY04_INVALID_VALUES');
  return sum+scores[key]*weight;
 },0)/100;
}
export function positionalRating(attributes,target,natural=target){
 validateAttributes(attributes);
 return clampAttribute(rawPositionRating(attributes,canonicalPosition(target))-familiarityPenalty(natural,target));
}
export function allPositionRatings(attributes,natural){
 validateAttributes(attributes);return Object.fromEntries(POSITIONS.map(p=>[p,positionalRating(attributes,p,natural)]));
}
export function ratePlayer(player,attributes,requestedPosition=player?.position){
 if(!player||typeof player!=='object')throw new Error('PLY04_PLAYER_REQUIRED');
 validateAttributes(attributes);
 const natural=canonicalPosition(player.position),position=canonicalPosition(requestedPosition);
 return {naturalPosition:natural,requestedPosition:position,derivedOvr:positionalRating(attributes,position,natural),allPositions:allPositionRatings(attributes,natural)};
}
