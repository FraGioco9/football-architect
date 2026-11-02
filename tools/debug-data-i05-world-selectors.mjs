// I05 browser-safe selectors over one authenticated protected world snapshot.
const matches=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
export function selectProtectedWorldDay(snapshot,day){
 if(snapshot?.kind!=="protected-debug-world"||snapshot.status!=="UNSEALED_NOT_FOR_RUNTIME"||
  snapshot.source?.namespace!=="local-debug"||snapshot.source?.datasetId!=="debug-corpus-v1"||
  !Number.isInteger(day)||day<1||day>snapshot.worldDay||
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
