// Domain logic: no DOM, browser storage or UI dependencies.
import {clubById,clubPlayers,playerById,myClub} from './selectors.js';
import {addMessage} from './history.js';
import {compactMoney} from './format.js';

export function signPlayer(w,id){
  const player=playerById(w,id),club=myClub(w);
  if(!player||player.clubId===w.clubId)throw new Error('Non puoi acquistare questo giocatore.');
  if(clubPlayers(w,w.clubId).length>=32)throw new Error('Rosa piena: massimo 32 calciatori.');
  const seller=clubById(w,player.clubId);
  if(clubPlayers(w,seller.id).length<=18)throw new Error('Il club non intende cedere altri giocatori.');
  const fee=Math.round(player.value*1.1/50000)*50000;
  if(club.transferBudget<fee)throw new Error(`Budget insufficiente: servono ${compactMoney(fee)}.`);
  club.balance-=fee;club.transferBudget-=fee;seller.balance+=fee;
  const from=seller.name;
  player.clubId=w.clubId;player.morale=88;player.fitness=100;
  w.transfers.unshift({season:w.season,round:w.round,playerId:id,from,to:w.clubId,fee});
  addMessage(w,`Ufficiale: ${player.name}`,`${player.name} arriva da ${from} per ${compactMoney(fee)}. È già disponibile per la prima squadra.`,'transfer',{type:'transfer.completed',params:{player:player.name,from,to:club.name,amountEURMinor:fee*100}});
  return fee;
}

export function sellPlayer(w,id){
  const p=playerById(w,id),team=myClub(w);
  if(!p||p.clubId!==w.clubId)throw new Error('Il calciatore non appartiene al club.');
  if(clubPlayers(w,w.clubId).length<=19)throw new Error('Servono almeno 19 calciatori in rosa.');
  const buyers=w.teams.filter(t=>t.id!==w.clubId&&clubPlayers(w,t.id).length<31).sort((a,b)=>Math.abs(a.reputation-p.ovr)-Math.abs(b.reputation-p.ovr));
  const buyer=buyers[0];
  if(!buyer)throw new Error('Nessuna offerta disponibile.');
  const fee=Math.round(p.value*.82/50000)*50000;
  p.clubId=buyer.id;p.morale=70;
  team.balance+=fee;team.transferBudget+=fee;buyer.balance-=fee;
  w.transfers.unshift({season:w.season,round:w.round,playerId:p.id,from:w.clubId,to:buyer.id,fee});
  w.lineup=w.lineup.map(i=>i===p.id?null:i);
  addMessage(w,`Cessione completata: ${p.name}`,`${p.name} passa al ${buyer.name} per ${compactMoney(fee)}.`,'transfer',{type:'transfer.completed',params:{player:p.name,from:team.name,to:buyer.name,amountEURMinor:fee*100}});
  return fee;
}
