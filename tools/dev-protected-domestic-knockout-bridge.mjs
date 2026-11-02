// I03: only map fully-known domestic postseason into legacy Fixtures.
// Unknown future knockout entrants must remain in the protected shell, never
// be mapped to a different known team merely to satisfy legacy validation.
const ensure=(ok,msg)=>{if(!ok)throw Error("I03 knockout bridge: "+msg)};
export function mapKnownDomesticPostseason(model){
 const events=model?.postseason,tier=events?.length===2?1:events?.length===5?2:null;
 ensure(tier!==null,"unexpected postseason structure");
 const ids=new Map(model.standings.map(row=>[row.club.canonicalId,row.club.clubId]));
 if(events.some(e=>!ids.has(e.homeId)||!ids.has(e.awayId))){
  return {ready:false,fixtures:[],reason:"participants-not-yet-known"};
 }
 const fixtures=events.map(e=>{
  const round=e.day-21;
  ensure([31,32,33].includes(round),"unknown knockout stage");
  const extra=e.tiebreak?.extraTime??null,pen=e.tiebreak?.penalties??null;
  // Existing shared validator requires a fully resolved two-leg aggregate
  // and a specific penalties shape; refuse ambiguous resolutions.
  ensure(!extra&&!pen,"extra-time/penalty mapping requires score-contract audit");
  return {round,homeId:ids.get(e.homeId),awayId:ids.get(e.awayId),
    homeGoals:e.homeGoals,awayGoals:e.awayGoals,kickoff:null,
    afterExtraTime:false,penalties:null};
 });
 return {ready:true,fixtures,reason:null};
}
