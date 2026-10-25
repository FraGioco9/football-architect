// A04-10: pure status/provenance selectors; no consumer writes or fallback.
const frozen=value=>Object.freeze(value);
const validStatus=new Set(['empty','partial','available','unavailable']);
function payload(input){
 if(input?.schemaVersion===1&&validStatus.has(input.status)&&input.data!==undefined&&input.provenance)
  return input;
 return null;
}
export function selectProviderState(input){
 const response=payload(input);
 if(!response)return frozen({status:'unavailable',reason:'invalid-data',coverage:'none',kind:'none',approved:false,sourceRef:null});
 const {status,reason,provenance}=response;
 return frozen({status,reason,coverage:provenance.coverage,kind:provenance.kind,approved:provenance.approved,sourceRef:provenance.sourceRef});
}
export function selectSeasonData(input,competitionId,selectedSeason){
 const response=payload(input);
 if(!response||response.competitionId!==competitionId||response.selectedSeason!==selectedSeason||response.scope!=='season'||
    !['partial','available'].includes(response.status)||response.data?.season!==selectedSeason)return null;
 return response.data;
}
export function selectHistoryData(input,competitionId,selectedSeason){
 const response=payload(input);
 if(!response||response.competitionId!==competitionId||response.selectedSeason!==selectedSeason||response.scope!=='history'||
    response.providerId!=='verified-historical'||response.status!=='available'||
    response.provenance.kind!=='verified'||response.provenance.approved!==true||
    response.provenance.coverage!=='complete'||response.data==null)return null;
 return response.data;
}
export function selectSeasonStatistics(input,competitionId,selectedSeason){
 const data=selectSeasonData(input,competitionId,selectedSeason);
 return data?.statistics??null;
}
export function selectSeasonFixtures(input,competitionId,selectedSeason){
 const data=selectSeasonData(input,competitionId,selectedSeason);
 return Array.isArray(data?.fixtures)?data.fixtures:null;
}
