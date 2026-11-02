// I05 browser-safe selectors over one authenticated protected world snapshot.
const matches=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
export function selectProtectedWorldDay(snapshot,day){
 if(snapshot?.kind!=="protected-debug-world"||snapshot.status!=="UNSEALED_NOT_FOR_RUNTIME"||
  snapshot.source?.namespace!=="local-debug"||snapshot.source?.datasetId!=="debug-corpus-v1"||
  !Number.isInteger(day)||day<1||day>56||
  !Array.isArray(snapshot.competitions)||snapshot.competitions.length!==18)throw Error("Invalid protected world snapshot");
 return snapshot.competitions.flatMap(c=>c.events.filter(e=>e.day===day).map(e=>({...e,competitionId:c.competitionId})));
}
export function selectProtectedClubFixtures(snapshot,clubId){
 if(!matches.test(clubId))throw Error("Invalid club identifier");
 if(snapshot?.kind!=="protected-debug-world"||snapshot.status!=="UNSEALED_NOT_FOR_RUNTIME"||
  snapshot.source?.datasetId!=="debug-corpus-v1"||!Array.isArray(snapshot.competitions)||
  snapshot.competitions.length!==18)throw Error("Invalid protected world snapshot");
 return snapshot.competitions.flatMap(c=>c.events.filter(e=>e.homeId===clubId||e.awayId===clubId)
  .map(e=>({...e,competitionId:c.competitionId})));
}

export function selectProtectedClubSummary(snapshot,clubId){
 if(!matches.test(clubId)||snapshot?.kind!=="protected-debug-world"||
  snapshot.status!=="UNSEALED_NOT_FOR_RUNTIME"||snapshot.source?.namespace!=="local-debug")
  throw Error("Invalid protected club source");
 const domestic=snapshot.competitions.filter(c=>/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(c.competitionId)&&
  c.participants?.includes(clubId));
 if(domestic.length!==1)throw Error("Inconsistent protected club division membership");
 const division=domestic[0],rows=division.standings;
 const rank=rows.findIndex(r=>r.clubId===clubId);
 if(rank<0)throw Error("Missing protected club position");
 const row=rows[rank];
 const upcoming=division.events.filter(e=>e.phaseId==="league"&&e.result===null&&
  (e.homeId===clubId||e.awayId===clubId)&&e.day>snapshot.worldDay)
  .sort((a,b)=>a.day-b.day||Number(a.roundId)-Number(b.roundId))[0];
 const nextMatch=upcoming?{homeId:Number(upcoming.homeId.split("-")[1]),
  awayId:Number(upcoming.awayId.split("-")[1]),round:Number(upcoming.roundId)}:null;
 return {source:"dev",divisionId:division.competitionId,clubId:Number(clubId.split("-")[1]),
  season:snapshot.seasonNumber,position:rank+1,points:row.pts??row.points,nextMatch};
}
