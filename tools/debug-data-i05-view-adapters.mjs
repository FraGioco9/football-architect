// I05 pure view adapters. No fetch, DOM, storage or runtime activation.
// Input is an already authenticated, redacted protected season projection.
const assert=(ok,message)=>{if(!ok)throw new TypeError("I05 view adapter: "+message)};
const clone=x=>JSON.parse(JSON.stringify(x));
export function validateProtectedView(view,{seasonNumber,worldDay,competitionId}){
 assert(view?.kind==="protected-debug-projection"&&view.status==="UNSEALED_NOT_FOR_RUNTIME","candidate status");
 assert(view.source?.kind==="debug"&&view.source.namespace==="local-debug"&&view.source.datasetId==="debug-corpus-v1","source identity");
 assert(view.seasonNumber===seasonNumber&&view.worldDay===worldDay&&view.competitionId===competitionId,"view cursor");
 assert(Array.isArray(view.events)&&Array.isArray(view.participants)&&Array.isArray(view.clubs),"missing view collections");
 const participants=new Set(view.participants);
 assert(participants.size===view.participants.length,"duplicate participants");
 for(const event of view.events){
  assert(Number.isInteger(event.day)&&event.day>=1&&event.day<=56,"event day");
  assert(event.day<=worldDay||event.result===null,"future result leak");
  if(event.day>worldDay&&event.phaseId!=="league")assert(event.homeId===null&&event.awayId===null,"future knockout identities");
 }
 return true;
}
export function projectProtectedCalendar(view,cursor){
 validateProtectedView(view,cursor);
 return {source:clone(view.source),seasonNumber:cursor.seasonNumber,worldDay:cursor.worldDay,
  competitionId:cursor.competitionId,events:clone(view.events.map(({eventId,day,order,phaseId,roundId,homeId,awayId,result})=>({
   eventId,day,order,phaseId,roundId,homeId,awayId,result
  })))};
}
export function projectProtectedClubSchedule(view,cursor,clubId){
 validateProtectedView(view,cursor);
 assert(view.participants.includes(clubId),"club is not a participant");
 return {source:clone(view.source),clubId,seasonNumber:cursor.seasonNumber,worldDay:cursor.worldDay,
  competitionId:cursor.competitionId,events:clone(view.events.filter(e=>e.homeId===clubId||e.awayId===clubId))};
}
