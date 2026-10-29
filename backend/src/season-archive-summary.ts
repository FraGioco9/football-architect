/** Immutable sporting projections derived only after validating all persisted day receipts. */
import {ApiError} from './errors.ts';
import type {Progression} from './knockout-progression.ts';
import {membershipCandidateFromProgression} from './next-season-membership.ts';
import {reviewInternationalHolders} from './international-holder-review.ts';
import {proposeHolderAllocation} from './international-holder-allocation-proposal.ts';

export function seasonArchiveSportingSummary(state:Progression){
 if(state.lastDay!==56||state.results.size!==4082||state.ties.size!==54)throw new ApiError(422,'archive_invalid');
 const candidate=state.schedule.season===1?membershipCandidateFromProgression(state):null;
 const holders=candidate?reviewInternationalHolders(state,candidate):null;
 const holderProposal=candidate&&holders?proposeHolderAllocation(candidate,holders):null;
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const divisions=countries.flatMap(country=>[1,2].map(level=>{
  const id=country+'-'+level,table=state.tables.get(id);
  if(!table||table.length!==16)throw new ApiError(422,'archive_invalid');
  return {competitionId:id,table:table.map(row=>({...row}))};
 }));
 const movements=candidate?countries.map(country=>{
  const top=state.tables.get(country+'-1')!,second=state.tables.get(country+'-2')!;
  const newTop=candidate.bindings.find(x=>x.competitionId===country+'-1')?.clubIds??[];
  const oldTop=top.map(x=>x.clubId);
  return {countryId:country,championClubId:oldTop[0],relegatedClubIds:oldTop.filter(id=>!newTop.includes(id)),promotedClubIds:second.map(x=>x.clubId).filter(id=>newTop.includes(id))};
 }):null;
 const cupWinners=(holders??(['int-1','int-2'] as const).map(competitionId=>{
  const final=state.ties.get(competitionId+':final:final');
  const fixture=final?.fixtures[0]?.fixture;
  const championClubId=fixture?state.results.get(fixture.id)?.winnerClubId:null;
  if(!championClubId)throw new ApiError(422,'archive_invalid');
  return {competitionId,championClubId};
 })).map(h=>({competitionId:h.competitionId,championClubId:h.championClubId}));
 return {schemaVersion:1 as const,sourceSeason:state.schedule.season,divisions,movements,cupWinners,
  qualificationCandidate:candidate,holderReview:holders,holderAllocationProposal:holderProposal,
  statisticsAvailability:'team-table-only' as const};
}
