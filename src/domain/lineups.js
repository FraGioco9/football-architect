// Domain logic: no DOM, browser storage or UI dependencies.
import {FORMATIONS} from './rules.js';
import {playerById} from './selectors.js';
import {medicalAvailability} from '../addons/domain/player-medical.mjs';

export function makeDefaultLineup(players,teamId,formation='4-3-3',current=[]){
  const squad=players.filter(p=>p.clubId===teamId&&p.injury===0&&(!p.medicalV1||medicalAvailability(p.medicalV1).canStart));
  const taken=new Set(),slots=FORMATIONS[formation]||FORMATIONS['4-3-3'];
  return slots.map((slot,i)=>{
    const retained=current[i]&&!taken.has(current[i])?squad.find(p=>p.id===current[i]):null;
    const affinity=(p)=>p.position===slot.p?10: ({TD:['TS','DC'],TS:['TD','DC'],DC:['TD','TS','MED'],MED:['CC','DC'],CC:['MED','COC'],COC:['CC','AD','AS'],AD:['AS','COC','ATT'],AS:['AD','COC','ATT'],ATT:['COC','AD','AS'],POR:[]}[slot.p]||[]).includes(p.position)?-5:-23;
    const best=retained||[...squad].filter(p=>!taken.has(p.id)).sort((a,b)=>(b.ovr+affinity(b)+b.fitness/20)-(a.ovr+affinity(a)+a.fitness/20))[0];
    if(best)taken.add(best.id);
    return best?.id||null;
  });
}

export function formationSlots(w,teamId){
  if(teamId===w.clubId&&w.lineup.length===FORMATIONS[w.formation].length){
    if(w.lineup.every(id=>!id||(!playerById(w,id)?.injury&&(!playerById(w,id)?.medicalV1||medicalAvailability(playerById(w,id).medicalV1).canStart))))return w.lineup;
    return makeDefaultLineup(w.players,teamId,w.formation,w.lineup.map(id=>id&&!playerById(w,id)?.injury&&(!playerById(w,id)?.medicalV1||medicalAvailability(playerById(w,id).medicalV1).canStart)?id:null));
  }
  return makeDefaultLineup(w.players,teamId,teamId===w.clubId?w.formation:'4-3-3');
}

export function teamStrength(w,teamId){
  const ids=formationSlots(w,teamId);
  const selected=ids.map(id=>playerById(w,id)).filter(Boolean);
  if(!selected.length)return 64;
  return selected.reduce((s,p)=>s+p.ovr+(p.fitness-85)*.065+(p.morale-70)*.025-(p.injury?12:0),0)/selected.length;
}
