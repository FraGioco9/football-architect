/** #577 — Public event timeline projection from verified immutable V2 evidence.
 * No simulation, legacy reconstruction, current roster lookup or future leakage.
 * Returning a new allowlisted object avoids publishing internal receipt details.
 */
import {validateRecordedMatchTimelineV1,VERIFIED_EVENT_MODEL_VERSION} from './match-event-validation-v1.mjs';

export function projectPublishedMatchEventsV1(result){
 if(result?.eventModelVersion!==VERIFIED_EVENT_MODEL_VERSION)
  return {kind:'not_recorded',eventModelVersion:null,events:null};
 // The verified season replay has already checked the receipt digest and
 // sporting chain. Revalidate the event actors and score independently.
 validateRecordedMatchTimelineV1(result);
 const events=result.events.map(event=>{
  const shared={ordinal:event.ordinal,minute:event.minute,period:event.period,
   side:event.side,type:event.type,playerId:event.playerId};
  switch(event.type){
   case 'goal':
    return {...shared,goalId:event.goalId,assistingPlayerId:event.assistingPlayerId,
     creation:event.creation};
   case 'pass':
    return {...shared,goalId:event.goalId,fromPlayerId:event.fromPlayerId,
     toPlayerId:event.toPlayerId};
   case 'yellow':
    return event.secondYellowSequence===true
     ?{...shared,secondYellowSequence:true}:shared;
   case 'red':
    return {...shared,reason:event.reason};
   case 'substitution':
    return {...shared,inPlayerId:event.inPlayerId,outPlayerId:event.outPlayerId,
     inRole:event.inRole,outRole:event.outRole,window:event.window};
   case 'role_change':
    return {...shared,fromRole:event.fromRole,toRole:event.toRole,reason:event.reason};
   default:throw new TypeError('Unknown verified match event');
  }
 });
 // Recorded with zero events is different from a legacy unrecorded timeline.
 return {kind:'recorded',eventModelVersion:VERIFIED_EVENT_MODEL_VERSION,events};
}
