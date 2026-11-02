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

// The bracket's existing contract includes extra time in its displayed goals.
// Fixtures retain regulation and extra-time fields separately. Derive both from
// the same redacted events; never inspect a future event's participants.
export function prepareProtectedBracket(model,definition,rows){
 const {fixtures}=mapKnownDomesticPostseason(model);
 const qualified=rows.every(row=>row.played===30);
 const matchday=qualified?Math.max(30,Math.min(33,model.worldDay-21)):
  Math.max(0,...model.fixtures.filter(g=>g.homeGoals!==null).map(g=>g.round));
 const result={divisionId:definition.id,season:model.season,matchday,ties:[],final:null,winnerId:null};
 if(!qualified)return result;
 const complete=game=>game&&game.homeGoals!==null&&game.awayGoals!==null;
 const display=game=>({...game,homeGoals:game.homeGoals===null?null:game.homeGoals+(game.extraTime?.homeGoals??0),
  awayGoals:game.awayGoals===null?null:game.awayGoals+(game.extraTime?.awayGoals??0)});
 const winner=(ids,totals,last)=>{
  if(totals[0]!==totals[1])return totals[0]>totals[1]?ids[0]:ids[1];
  ensure(last?.penalties,"unresolved completed bracket tie");
  return last.penalties.homeGoals>last.penalties.awayGoals?last.homeId:last.awayId;
 };
 const ties=definition.rules.phases.flatMap(phase=>phase.ties??[]).filter(tie=>tie.legs===2);
 for(const tie of ties){
  const positions=tie.participants.map(ref=>ref.rank).sort((a,b)=>a-b);
  ensure(positions.length===2&&positions.every(rank=>Number.isInteger(rank)),"unsupported bracket seed");
  const ids=positions.map(rank=>rows[rank-1].club.clubId);
  const legs=[31,32].map(round=>{
   const game=fixtures.find(g=>g.round===round&&!g.pendingParticipants&&ids.includes(g.homeId)&&ids.includes(g.awayId));
   return complete(game)?display(game):null;
  });
  const aggregate=legs[0]?ids.map(id=>legs.filter(Boolean).reduce((n,g)=>n+(g.homeId===id?g.homeGoals:g.awayGoals),0)):null;
  const winnerId=legs[1]?winner(ids,aggregate,legs[1]):null;
  result.ties.push({id:({semi36:'semi-one',semi45:'semi-two'}[tie.id]??tie.id),seedPositions:positions,clubIds:ids,legs,aggregate,winnerId});
 }
 if(model.worldDay>=53){
  if(fixtures.length===2)result.winnerId=result.ties[0].winnerId;
  else{
   const ids=result.ties.map(tie=>tie.winnerId).sort((a,b)=>rows.findIndex(r=>r.club.clubId===a)-rows.findIndex(r=>r.club.clubId===b));
   ensure(ids.every(Number.isInteger),"unresolved finalists");
   const game=fixtures.find(g=>g.round===33);
   result.final=complete(game)?display(game):{homeId:ids[0],awayId:ids[1],homeGoals:null,awayGoals:null,afterExtraTime:false,penalties:null};
   ensure(result.final.homeId===ids[0]&&result.final.awayId===ids[1],"incorrect final home order");
   result.final.winnerId=complete(game)?winner(ids,[result.final.homeGoals,result.final.awayGoals],result.final):null;
   result.winnerId=result.final.winnerId;
  }
 }
 return result;
}
