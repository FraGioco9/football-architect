// I03: only map fully-known domestic postseason into legacy Fixtures.
// Unknown future knockout entrants must remain in the protected shell, never
// be mapped to a different known team merely to satisfy legacy validation.
const ensure=(ok,msg)=>{if(!ok)throw Error("I03 knockout bridge: "+msg)};
export function mapKnownDomesticPostseason(model){
 const events=model?.postseason,tier=events?.length===2?1:events?.length===5?2:null;
 ensure(tier!==null,"unexpected postseason structure");
 const ids=new Map(model.standings.map(row=>[row.club.canonicalId,row.club.clubId]));
 const fixtures=events.map((e,index)=>{
  const round=e.day-21;
  ensure([31,32,33].includes(round),"unknown knockout stage");
  const pending=e.homeId===null&&e.awayId===null;
  ensure(pending||ids.has(e.homeId)&&ids.has(e.awayId),"invalid knockout club identity");
  if(pending){ensure(e.homeGoals===null&&e.awayGoals===null,"pending slot has result");
   return {round,slot:e.eventId??String(index),pendingParticipants:true,homeId:null,awayId:null,homeGoals:null,awayGoals:null,kickoff:null,afterExtraTime:false,penalties:null};}
  const extra=e.tiebreak?.extraTime??null,pen=e.tiebreak?.penalties??null;
  const method=e.tiebreak?.method??"aggregate";
  ensure(["aggregate","extraTime","penalties"].includes(method),"unknown tiebreak method");
  ensure(method==="aggregate"?!extra&&!pen:extra!==null,"tiebreak method mismatch");
  ensure(method==="penalties"===Boolean(pen),"penalty method mismatch");
  if(extra)ensure(Number.isInteger(extra.homeGoals)&&extra.homeGoals>=0&&Number.isInteger(extra.awayGoals)&&extra.awayGoals>=0,"invalid extra-time score");
  if(pen)ensure(Number.isInteger(pen.homeGoals)&&pen.homeGoals>=0&&Number.isInteger(pen.awayGoals)&&pen.awayGoals>=0&&pen.homeGoals!==pen.awayGoals,"invalid shootout");
  return {round,homeId:ids.get(e.homeId),awayId:ids.get(e.awayId),
    homeGoals:e.homeGoals,awayGoals:e.awayGoals,kickoff:null,
    afterExtraTime:extra!==null,extraTime:extra?{...extra}:null,
    penalties:pen?{homeId:ids.get(e.homeId),awayId:ids.get(e.awayId),...pen}:null};
 });
 return {ready:true,fixtures,reason:null};
}
