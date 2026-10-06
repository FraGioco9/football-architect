/** PLY01.03 — positional suitability, explicitly derived; never overwrites legacy OVR. */
import {validateAttributes,clampAttribute} from './player-attributes.mjs';
const posKeys=['GK','RB','LB','CB','RWB','LWB','CDM','CM','RM','LM','CAM','RW','LW','CF','ST'];
export const POSITIONS = Object.freeze(posKeys);
const aliases={G:'GK',POR:'GK',GOALKEEPER:'GK',TD:'RB',TS:'LB',DC:'CB',DFC:'CB',DCB:'CB',D:'CB',DEF:'CB',DF:'CB',RBK:'RB',LBK:'LB',MED:'CDM',CC:'CM',COC:'CAM',AD:'RW',AS:'LW',DM:'CDM',DMC:'CDM',MC:'CM',MID:'CM',M:'CM',AM:'CAM',AMC:'CAM',ACM:'CAM',ATT:'ST',F:'ST',FW:'ST',STRIKER:'ST',FC:'CF',RF:'RW',LF:'LW',RWB:'RWB',LWB:'LWB',RWM:'RM',LWM:'LM'};
export function canonicalPosition(pos) {
 const key=String(pos??'').trim().toUpperCase().replace(/[^A-Z]/g,'');
 const normalized=aliases[key]??key;
 if(!POSITIONS.includes(normalized)) throw new Error(`PLY01_UNKNOWN_POSITION:${key}`);
 return normalized;
}
const specs = {
 GK:{reflexes:18,keeperPositioning:17,handling:14,diving:14,oneOnOne:12,rushingOut:10,distribution:8,concentration:4,decisions:3},
 CB:{marking:18,tackling:17,defensivePositioning:15,anticipation:13,strength:11,heading:9,jumping:6,decisions:6,shortPassing:5},
 LB:{marking:14,tackling:13,defensivePositioning:13,pace:12,stamina:11,crossing:9,acceleration:9,shortPassing:8,anticipation:6,workRate:5},
 RB:{marking:14,tackling:13,defensivePositioning:13,pace:12,stamina:11,crossing:9,acceleration:9,shortPassing:8,anticipation:6,workRate:5},
 LWB:{pace:15,stamina:14,crossing:14,acceleration:12,workRate:10,marking:9,tackling:8,shortPassing:9,dribbling:9},
 RWB:{pace:15,stamina:14,crossing:14,acceleration:12,workRate:10,marking:9,tackling:8,shortPassing:9,dribbling:9},
 CDM:{defensivePositioning:15,tackling:14,anticipation:13,shortPassing:13,decisions:11,marking:10,teamwork:9,stamina:8,longPassing:7},
 CM:{shortPassing:18,vision:14,decisions:13,firstTouch:12,teamwork:10,stamina:10,technique:9,longPassing:8,workRate:6},
 LM:{crossing:15,pace:14,stamina:12,shortPassing:12,dribbling:11,acceleration:11,workRate:10,firstTouch:8,teamwork:7},
 RM:{crossing:15,pace:14,stamina:12,shortPassing:12,dribbling:11,acceleration:11,workRate:10,firstTouch:8,teamwork:7},
 CAM:{vision:17,technique:16,shortPassing:15,decisions:14,firstTouch:12,offBall:12,dribbling:8,composure:6},
 LW:{dribbling:17,pace:16,acceleration:15,firstTouch:12,crossing:12,finishing:10,agility:10,offBall:8},
 RW:{dribbling:17,pace:16,acceleration:15,firstTouch:12,crossing:12,finishing:10,agility:10,offBall:8},
 CF:{offBall:17,finishing:16,firstTouch:15,vision:12,decisions:12,technique:10,composure:10,shortPassing:8},
 ST:{finishing:22,offBall:18,composure:14,firstTouch:11,heading:10,acceleration:9,strength:8,anticipation:8},
};
export const POSITION_WEIGHTS=Object.freeze(Object.fromEntries(Object.entries(specs).map(([p,v])=>[p,Object.freeze({...v})])));
const related=[['RB','LB','RWB','LWB'],['RM','LM','RW','LW'],['ST','CF','CAM'],['CDM','CM','CAM'],['CB','CDM','RB','LB']];
export function familiarityPenalty(natural, target) {
 natural=canonicalPosition(natural);target=canonicalPosition(target);
 if(natural===target)return 0;
 if((natural==='GK')!==(target==='GK')) return 58;
 if (related.some(g=>g.includes(natural)&&g.includes(target))) return (natural[0]===target[0]&&natural.endsWith('B')!==target.endsWith('B'))?7:5;
 if (['LB','LWB'].includes(natural)&&['RB','RWB'].includes(target)||['RB','RWB'].includes(natural)&&['LB','LWB'].includes(target)) return 9;
 if (['LM','LW'].includes(natural)&&['RM','RW'].includes(target)||['RM','RW'].includes(natural)&&['LM','LW'].includes(target)) return 8;
 return 16;
}
/** Stable weighted rating (no familiarity). */
export function rawPositionRating(values,position) {
 const p=canonicalPosition(position), w=POSITION_WEIGHTS[p], scores='values' in (values??{})?values.values:values;
 if(!scores||typeof scores!=='object')throw new Error('PLY01_INVALID_VALUES');
 return Object.entries(w).reduce((sum,[key,weight])=>{
   if(!Number.isInteger(scores[key])||scores[key]<1||scores[key]>100)throw new Error('PLY01_INVALID_VALUES');
   return sum+scores[key]*weight;
 },0)/100;
}
export function positionalRating(attributes,target,natural=target) {
 validateAttributes(attributes);
 const p=canonicalPosition(target), home=canonicalPosition(natural);
 return clampAttribute(rawPositionRating(attributes,p)-familiarityPenalty(home,p));
}
export function allPositionRatings(attributes,natural){
 validateAttributes(attributes);return Object.fromEntries(POSITIONS.map(p=>[p,positionalRating(attributes,p,natural)]));
}
export function ratePlayer(player,attributes,requestedPosition=player?.position) {
 if(!player||typeof player!=='object')throw new Error('PLY01_PLAYER_REQUIRED');
 validateAttributes(attributes);
 const natural=canonicalPosition(player.position),position=canonicalPosition(requestedPosition);
 const legacyOvr=Number.isFinite(player.ovr)?player.ovr:Number.isFinite(player.overall)?player.overall:null;
 return {legacyOvr,naturalPosition:natural,requestedPosition:position,derivedOvr:positionalRating(attributes,position,natural),allPositions:allPositionRatings(attributes,natural)};
}
