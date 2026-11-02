// I03: translate protected domestic knockout events without revealing
// future entrants. No renderer or runtime side effects.
const ensure=(ok,msg)=>{if(!ok)throw Error("I03 postseason: "+msg)};
export function prepareProtectedPostseason(events,{tier,day,participants}){
 ensure([1,2].includes(tier)&&Number.isInteger(day)&&day>=1&&day<=56,"invalid position");
 const expected=tier===1?2:5;
 ensure(Array.isArray(events)&&events.length===expected,"wrong postseason event count");
 const known=new Set(participants),seen=new Set(),out=[];
 for(const e of [...events].sort((a,b)=>a.day-b.day||a.eventId.localeCompare(b.eventId))){
  ensure(Number.isInteger(e.day)&&e.day>=52&&e.day<=54&&typeof e.eventId==="string"&&!seen.has(e.eventId),"invalid postseason fixture");
  seen.add(e.eventId);
  const future=e.day>day;
  ensure(!future||e.homeGoals===null&&e.awayGoals===null,"future score leak");
  ensure(!future||e.homeId===null&&e.awayId===null,"future entrant leak");
  if(!future)ensure(known.has(e.homeId)&&known.has(e.awayId)&&e.homeId!==e.awayId,"unknown postseason club");
  if(e.homeGoals!==null)ensure(Number.isInteger(e.homeGoals)&&Number.isInteger(e.awayGoals)&&e.homeGoals>=0&&e.awayGoals>=0,"bad result");
  out.push({eventId:e.eventId,day:e.day,stage:e.roundId??null,homeId:e.homeId,awayId:e.awayId,
   homeGoals:e.homeGoals,awayGoals:e.awayGoals,tiebreak:future?null:e.tiebreak??null});
 }
 ensure(out.filter(x=>x.day===52).length===(tier===1?1:2),"incorrect first legs");
 ensure(out.filter(x=>x.day===53).length===(tier===1?1:2),"incorrect second legs");
 ensure(out.filter(x=>x.day===54).length===(tier===1?0:1),"incorrect final");
 return out;
}
