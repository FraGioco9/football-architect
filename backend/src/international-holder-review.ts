/** International trophy-holder review for INT24 ChampionAwareV1.
 * The full displacement rule is not implemented in the approved Season1 snapshot;
 * block final approval when a holder is outside the league-derived allocation.
 */
import {ApiError} from './errors.ts';
import type {Progression} from './knockout-progression.ts';
import type {NextSeasonMembership} from './next-season-membership.ts';
export interface HolderReview {
 readonly competitionId:'int-1'|'int-2';
 readonly championClubId:string;
 readonly countryId:string;
 readonly allocatedCup:'int-1'|'int-2'|null;
 readonly requiresQualificationPolicyDecision:boolean;
}
const invalid=():never=>{throw new ApiError(422,'qualification_evidence_invalid')};
export function reviewInternationalHolders(state:Progression,candidate:NextSeasonMembership):readonly HolderReview[]{
 if(state.lastDay!==56||candidate.season!==2||state.results.size!==4082||state.ties.size!==54)return invalid();
 const byCup=new Map(candidate.bindings.filter(b=>b.competitionId.startsWith('int-')).map(b=>[b.competitionId,b.clubIds]));
 if(byCup.size!==2)return invalid();
 const reviews:HolderReview[]=[];
 for(const cup of ['int-1','int-2'] as const){
  const final=state.ties.get(cup+':final:final');
  if(!final||final.fixtures.length!==1)return invalid();
  const fixture=final.fixtures[0].fixture;
  const winner=state.results.get(fixture.id)?.winnerClubId;
  if(!winner||![fixture.homeClubId,fixture.awayClubId].includes(winner))return invalid();
  const country=winner.split('-')[0];
  if(!['IT','ENG','ES','DE','FR','PT','NL','BR'].includes(country))return invalid();
  const allocatedCup=byCup.get('int-1')!.includes(winner)?'int-1':byCup.get('int-2')!.includes(winner)?'int-2':null;
  reviews.push(Object.freeze({competitionId:cup,championClubId:winner,countryId:country,allocatedCup,requiresQualificationPolicyDecision:allocatedCup!==cup}));
 }
 return Object.freeze(reviews);
}
