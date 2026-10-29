/** Deterministic next-season membership proposal from verified sporting outcomes.
 * Pure projection only; never an approved snapshot or D1 mutation.
 */
import {ApiError} from './errors.ts';
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'] as const;
export interface FinishedDivision {competitionId:string;rankedClubIds:readonly string[]}
export interface CountryPostseason {countryId:string;playoutRelegatedClubId:string;playoffPromotedClubId:string}
export interface NextSeasonMembership {season:number;bindings:readonly {competitionId:string;clubIds:readonly string[]}[];status:'provisional-results-derived'}
const reject=():never=>{throw new ApiError(422,'qualification_evidence_invalid')};
export function proposeNextSeasonMembership(season:number,divisions:readonly FinishedDivision[],outcomes:readonly CountryPostseason[]):NextSeasonMembership {
 if(!Number.isSafeInteger(season)||season<2||divisions.length!==16||outcomes.length!==8)return reject();
 const all=new Set<string>(),binding=new Map<string,readonly string[]>();
 for(const d of divisions){
  if(!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(d.competitionId)||binding.has(d.competitionId)||!Array.isArray(d.rankedClubIds)||d.rankedClubIds.length!==16||
     new Set(d.rankedClubIds).size!==16||d.rankedClubIds.some(id=>!/^([A-Z]{2,3})-([1-9]|[1-3][0-9]|40)$/.test(id)||!id.startsWith(d.competitionId.split('-')[0]+'-')||all.has(id)))return reject();
  binding.set(d.competitionId,d.rankedClubIds);d.rankedClubIds.forEach(id=>all.add(id));
 }
 const outcomeMap=new Map(outcomes.map(x=>[x.countryId,x]));
 if(outcomeMap.size!==8)return reject();
 const results:{competitionId:string;clubIds:string[]}[]=[];
 const sovereign:string[]=[],federation:string[]=[];
 for(const c of countries){
  const top=binding.get(c+'-1'),second=binding.get(c+'-2'),o=outcomeMap.get(c);
  if(!top||!second||!o||o.countryId!==c||!top.slice(12,14).includes(o.playoutRelegatedClubId)||
     !second.slice(2,6).includes(o.playoffPromotedClubId))return reject();
  const relegated=[top[14],top[15],o.playoutRelegatedClubId],promoted=[second[0],second[1],o.playoffPromotedClubId];
  const nextTop=[...top.filter(id=>!relegated.includes(id)),...promoted];
  const nextSecond=[...second.filter(id=>!promoted.includes(id)),...relegated];
  if(nextTop.length!==16||nextSecond.length!==16||new Set([...nextTop,...nextSecond]).size!==32)return reject();
  results.push({competitionId:c+'-1',clubIds:nextTop},{competitionId:c+'-2',clubIds:nextSecond});
  // Placeholders for qualified positions: ranking after turnover is NOT a sporting ranking.
  // The international selection must be based on the final, verified table.
  sovereign.push(...top.slice(0,3));
  federation.push(...top.slice(3,6));
 }
 if(sovereign.length!==24||federation.length!==24||new Set([...sovereign,...federation]).size!==48)return reject();
 return Object.freeze({season,bindings:Object.freeze([...results,{competitionId:'int-1',clubIds:sovereign},{competitionId:'int-2',clubIds:federation}].map(x=>Object.freeze({competitionId:x.competitionId,clubIds:Object.freeze([...x.clubIds])}))),status:'provisional-results-derived'});
}
