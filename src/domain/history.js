import {makeCareerMessageEvent} from './career-locale.js';
// Domain logic: no DOM, browser storage or UI dependencies.

// Match notifications and inbox history live with the domain, not in the view.

const INPUT_REQUIRED_EVENT_TYPES=new Set(['contract.expired']);

export function careerMessageRequiresUserInput(message){
  return Boolean(message&&(message.requiresUserInput===true||INPUT_REQUIRED_EVENT_TYPES.has(message.localeEvent?.type)));
}

export function addMessage(w,subject,text,kind='info',event=null){
  // New message identifiers are deterministic across replays. Existing saved IDs remain untouched.
  const id=`msg-${w.season}-${w.round}-${w.inbox.length}-q02`;
  const requiresUserInput=event?.requiresUserInput===true||INPUT_REQUIRED_EVENT_TYPES.has(event?.type);
  const message={id,season:w.season,round:w.round,date:w.currentDate??null,subject,text,kind,read:false};
  if(requiresUserInput)message.requiresUserInput=true;
  if(event)message.localeEvent=makeCareerMessageEvent(id,event.type,event.params,w.round);
  w.inbox.unshift(message);
  w.unread=w.inbox.filter(m=>!m.read).length;
}

// Read-only navigation over historical match results.
export const latestResult=(w)=>w.fixtures.slice(0,w.round).flatMap(d=>d.matches).filter(m=>m.result&&(m.home===w.clubId||m.away===w.clubId)).at(-1);
export function findMatch(w,id){return w.fixtures.flatMap(d=>d.matches).find(m=>m.id===id);}
