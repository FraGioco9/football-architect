/** Reserved bracket fixtures have identities before clubs and results exist. */
import divisions from '../../../../data/divisions.json' with {type:'json'};
import cups from '../../../../data/international-competitions.json' with {type:'json'};
import calendarModel from '../../../../assets/world-calendar-model.js';
import {legacySeasonOneRules} from '../../calendar-rules-compat.ts';
import {matchIdForSlot} from './match-slot-identity.ts';

export type BracketParticipant={kind:'leagueRank';rank:number}|{kind:'tieWinner';tieId:string};
export type BracketScope='calendar'|'domestic'|'international';
export interface KnockoutSlotReservation {
 matchId:string;competitionId:string;phaseId:string;tieId:string;leg:number;slotId:string;
 marker:string;day:number;round:number|null;homePolicy:'higherOriginalTableRank'|'neutral';
 rulesVersion:string;participantA:BracketParticipant;participantB:BracketParticipant;
}
interface Participant {phaseId?:string;rank?:number;tieId?:string}
interface TieRule {id:string;participants:Participant[];legs:number;homePolicy:string}
interface PhaseRule {id:string;type:string;calendarEvents:string[];ties?:TieRule[]}
interface Definition {id:string;rules:{version:string;phases:PhaseRule[]}}
const definitions=[...legacySeasonOneRules(divisions),...cups] as Definition[];
const totals:Record<BracketScope,number>={calendar:98,domestic:56,international:42};
function participant(p:Participant):BracketParticipant {
 if(p.phaseId==='league'&&Number.isSafeInteger(p.rank)&&p.rank!>0&&p.tieId===undefined)
  return {kind:'leagueRank',rank:p.rank!};
 if(p.tieId&&/^[a-zA-Z0-9_-]{1,64}$/.test(p.tieId)&&p.phaseId===undefined&&p.rank===undefined)
  return {kind:'tieWinner',tieId:p.tieId};
 throw new RangeError('Invalid bracket participant');
}
export async function buildKnockoutSlotReservations(generation:string,season:number,scope:BracketScope) {
 if(!Object.prototype.hasOwnProperty.call(totals,scope))throw new RangeError('Invalid bracket scope');
 const calendar=calendarModel.createSeason(season) as {
  days:{day:number;events:{marker:string;round:number|null;competitionIds:string[]}[]}[]
 };
 const events=new Map(calendar.days.flatMap(d=>d.events.map(e=>[e.marker,{...e,day:d.day}] as const)));
 const slots:KnockoutSlotReservation[]=[];
 for(const definition of definitions){
  const international=definition.id.startsWith('int-');
  if(scope==='domestic'&&international||scope==='international'&&!international)continue;
  for(const phase of definition.rules.phases.filter(p=>p.type==='knockout'))for(const tie of phase.ties??[]){
   if(![1,2].includes(tie.legs)||tie.participants.length!==2||
    !['higherOriginalTableRank','neutral'].includes(tie.homePolicy)||
    tie.homePolicy==='neutral'&&tie.legs!==1)throw new RangeError('Invalid knockout rule');
   // Identical event-selection rule to knockout-progression.ts.
   const markers=phase.calendarEvents.length>tie.legs&&tie.participants.some(p=>p.tieId)
    ?phase.calendarEvents.slice(-tie.legs):phase.calendarEvents.slice(0,tie.legs);
   if(markers.length!==tie.legs)throw new RangeError('Incomplete bracket events');
   const [participantA,participantB]=tie.participants.map(participant);
   for(let i=0;i<markers.length;i++){
    const event=events.get(markers[i]),leg=i+1;
    if(!event||!event.competitionIds.includes(definition.id))throw new RangeError('Unknown knockout marker');
    const slotId='tie:'+tie.id+':leg:'+leg;
    slots.push({
     matchId:await matchIdForSlot({generation,season,competitionId:definition.id,phaseId:phase.id,slotId}),
     competitionId:definition.id,phaseId:phase.id,tieId:tie.id,leg,slotId,
     marker:markers[i],day:event.day,round:event.round,
     homePolicy:tie.homePolicy as KnockoutSlotReservation['homePolicy'],
     rulesVersion:definition.rules.version,participantA,participantB
    });
   }
  }
 }
 if(slots.length!==totals[scope]||new Set(slots.map(x=>x.matchId)).size!==slots.length||
   new Set(slots.map(x=>[x.competitionId,x.phaseId,x.tieId,x.leg].join(':'))).size!==slots.length)
  throw new RangeError('Incomplete knockout slot reservations');
 return slots;
}
