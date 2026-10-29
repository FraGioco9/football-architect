/** Provisional score-only authority. No players/ratings or full game-engine model. */
import type {Fixture} from './initial-schedule.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {ApiError} from './errors.ts';
export type MatchContext={mode:'regulation'}|{mode:'single-knockout';neutral?:true}|{mode:'second-leg';firstLegHomeGoals:number;firstLegAwayGoals:number};
export interface Score {home:number;away:number}
export interface TemporaryResult {
 fixtureId:string;algorithmVersion:'temporary-score-v1';provenance:'temporary-simulation';sourceSeedHash:string;
 context:MatchContext;regulation:Score;extraTime:Score|null;penalties:Score|null;
 homeGoals:number;awayGoals:number;winnerClubId:string|null;resolution:'regulation'|'extra-time'|'penalties';
}
// Integer lookup policy, deliberately provisional and independent of club strength.
// Each of16 equiprobable entries is selected by one SHA-256 nibble; no floating
// point RNG or current clock affects a match. Keep v1 stable when replacing it.
const homeTable=[0,0,0,0,1,1,1,1,1,1,2,2,2,2,3,4];
const awayTable=[0,0,0,0,0,0,1,1,1,1,1,1,2,2,3,4];
const neutralTable=[0,0,0,0,0,1,1,1,1,1,2,2,2,2,3,4];
const extraTable=[0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,2];
const fail=():never=>{throw new ApiError(422,'simulation_invalid')};
function parseContext(input:unknown):MatchContext{
 if(!input||typeof input!=='object'||Array.isArray(input))return fail();
 const c=input as MatchContext,keys=Object.keys(c).sort().join(',');
 if((c.mode==='regulation'||c.mode==='single-knockout')&&keys==='mode')return {mode:c.mode};
 if(c.mode==='single-knockout'&&keys==='mode,neutral'&&c.neutral===true)return {mode:c.mode,neutral:true};
 if(c.mode==='second-leg'&&keys==='firstLegAwayGoals,firstLegHomeGoals,mode'&&[c.firstLegHomeGoals,c.firstLegAwayGoals].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100))return {...c};
 return fail();
}
export async function simulateTemporaryMatch(fixture:Fixture,seed:string,contextInput:MatchContext):Promise<TemporaryResult>{
 const context=parseContext(contextInput);
 if(!fixture||Object.keys(fixture).sort().join(',')!=='awayClubId,competitionId,day,homeClubId,id,marker,round'||
  !['homeClubId','awayClubId'].every(k=>/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.test(fixture[k as 'homeClubId']))||fixture.homeClubId===fixture.awayClubId||
  !/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(fixture.competitionId)||
  !/^(?:[NI](?:0[1-9]|[12][0-9]|3[0-3])|FEDERATION-FINAL|SOVEREIGN-FINAL)$/.test(fixture.marker)||
  !Number.isInteger(fixture.day)||fixture.day<1||fixture.day>56||!Number.isInteger(fixture.round)||fixture.round<1||fixture.round>33||
  fixture.id!==`season:1:${fixture.competitionId}:${fixture.marker}:${fixture.homeClubId}:${fixture.awayClubId}`||
  typeof seed!=='string'||!/^[A-Za-z0-9._:-]{16,256}$/.test(seed))return fail();
 const algorithmVersion='temporary-score-v1' as const;
 const digest=await canonicalHash({algorithmVersion,seed,fixture,purpose:'regulation'});
 const neutral=context.mode==='single-knockout'&&context.neutral===true;
 const regulation={home:(neutral?neutralTable:homeTable)[parseInt(digest[0],16)],away:(neutral?neutralTable:awayTable)[parseInt(digest[1],16)]};
 let homeGoals=regulation.home,awayGoals=regulation.away,extraTime:Score|null=null,penalties:Score|null=null;
 const aggregate=()=>context.mode==='second-leg'?homeGoals+context.firstLegAwayGoals-awayGoals-context.firstLegHomeGoals:homeGoals-awayGoals;
 let difference=context.mode==='regulation'?homeGoals-awayGoals:aggregate();
 let resolution:TemporaryResult['resolution']='regulation';
 if(context.mode!=='regulation'&&difference===0){
  const more=await canonicalHash({algorithmVersion,seed,fixture,context,purpose:'extra-time'});
  extraTime={home:extraTable[parseInt(more[0],16)],away:extraTable[parseInt(more[1],16)]};
  homeGoals+=extraTime.home;awayGoals+=extraTime.away;difference=aggregate();resolution='extra-time';
  if(difference===0){
   const shootout=await canonicalHash({algorithmVersion,seed,fixture,context,purpose:'penalties'});
   const winner=3+(parseInt(shootout[1],16)%4),loser=winner-1; // feasible3-2,4-3,5-4 or sudden-death6-5
   penalties=parseInt(shootout[0],16)%2===0?{home:winner,away:loser}:{home:loser,away:winner};
   difference=penalties.home-penalties.away;resolution='penalties';
  }
 }
 return {fixtureId:fixture.id,algorithmVersion,provenance:'temporary-simulation',sourceSeedHash:await canonicalHash({seed}),context,
  regulation,extraTime,penalties,homeGoals,awayGoals,winnerClubId:difference===0?null:difference>0?fixture.homeClubId:fixture.awayClubId,resolution};
}
