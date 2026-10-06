// Domain logic: no DOM, browser storage or UI dependencies.
import {FORMATIONS} from './rules.js';
import {makeDefaultLineup} from './lineups.js';
import {playerById} from './selectors.js';
import {medicalAvailability} from '../addons/domain/player-medical.mjs';

export function changeFormation(w,formation){
  if(!FORMATIONS[formation])throw new Error('Modulo sconosciuto.');
  w.formation=formation;
  w.lineup=makeDefaultLineup(w.players,w.clubId,formation);
}

export function assignPlayer(w,index,playerId){
  const player=playerById(w,playerId);
  if(!player||player.clubId!==w.clubId||player.injury||(w.advancedV1?.enabled&&player.medicalV1&&!medicalAvailability(player.medicalV1).canStart))throw new Error('Giocatore non disponibile.');
  if(index<0||index>=11)throw new Error('Posizione non valida.');
  const old=w.lineup.indexOf(player.id);
  if(old!==-1)w.lineup[old]=w.lineup[index]||null;
  w.lineup[index]=player.id;
}

export function autoLineup(w){w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation);}
