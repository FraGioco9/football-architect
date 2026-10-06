import {makeCareerMessageEvent} from './career-locale.js';
// Domain logic: no DOM, browser storage or UI dependencies.

// Match notifications and inbox history live with the domain, not in the view.

export function addMessage(w,subject,text,kind='info',event=null){
  // New message identifiers are deterministic across replays. Existing saved IDs remain untouched.
  const id=`msg-${w.season}-${w.round}-${w.inbox.length}-q02`;
  const message={id,season:w.season,round:w.round,date:w.currentDate??null,subject,text,kind,read:false};
  if(event)message.localeEvent=makeCareerMessageEvent(id,event.type,event.params,w.round);
  w.inbox.unshift(message);
  w.unread=w.inbox.filter(m=>!m.read).length;
}

// Read-only navigation over historical match results.
export const latestResult=(w)=>w.fixtures.slice(0,w.round).flatMap(d=>d.matches).filter(m=>m.result&&(m.home===w.clubId||m.away===w.clubId)).at(-1);
export function findMatch(w,id){return w.fixtures.flatMap(d=>d.matches).find(m=>m.id===id);}
