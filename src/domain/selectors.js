// Domain logic: no DOM, browser storage or UI dependencies.

export const clubById=(w,id)=>w.teams.find(t=>t.id===Number(id));

export const playerById=(w,id)=>w.players.find(p=>p.id===Number(id));

export const clubPlayers=(w,id)=>w.players.filter(p=>p.clubId===Number(id));


export const clubMatch=(day,clubId)=>day?.matches.find(m=>m.home===clubId||m.away===clubId);

export const fullName=(w,id)=>clubById(w,id)?.name||'Club sconosciuto';

export const myClub=w=>clubById(w,w.clubId);
