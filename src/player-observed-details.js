/** PLYR-05 REC-06 — read-only, observed data only.
 * Medical state, dynamic relationships and development history are official
 * stored snapshots. Derived positional ratings are explicitly NOT learned roles.
 * No future-facing growth, personality traits, or potential is displayed.
 */
import {validateMedical,medicalAvailability} from './addons/domain/player-medical.mjs';
import {validateDevelopment} from './addons/domain/player-development.mjs';
import {readPlayerAttributes} from './addons/domain/player-generator.mjs';
import {canonicalPosition,POSITIONS,familiarityPenalty,ratePlayer} from './addons/domain/player-ratings.mjs';
import {personalityEnabled,validateCareerPersonality} from './domain/career-personality.js';
import {POSITION_LABELS} from './data.js';
import {esc} from './ui-components.js';

const tr=(lang,it,en)=>lang==='en'?en:it;
const decimal=n=>Number.isFinite(n)?String(Math.round(n*100)/100):'—';
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
const fact=(name,value)=>`<div class="plyr056-fact"><dt>${esc(name)}</dt><dd>${esc(value??'—')}</dd></div>`;
const section=(name,rows,description='')=>`<section class="plyr051-card plyr056-card"><h2>${esc(name)}</h2>${description?`<p class="plyr056-note">${esc(description)}</p>`:''}<dl class="plyr051-facts">${rows}</dl></section>`;
const names={
 GK:{it:'Portiere',en:'Goalkeeper'},RB:{it:'Terzino destro',en:'Right back'},LB:{it:'Terzino sinistro',en:'Left back'},
 CB:{it:'Difensore centrale',en:'Centre-back'},RWB:{it:'Esterno destro',en:'Right wing-back'},LWB:{it:'Esterno sinistro',en:'Left wing-back'},
 CDM:{it:'Mediano',en:'Defensive midfielder'},CM:{it:'Centrocampista',en:'Central midfielder'},
 RM:{it:'Esterno destro',en:'Right midfielder'},LM:{it:'Esterno sinistro',en:'Left midfielder'},
 CAM:{it:'Trequartista',en:'Attacking midfielder'},RW:{it:'Ala destra',en:'Right winger'},
 LW:{it:'Ala sinistra',en:'Left winger'},CF:{it:'Seconda punta',en:'Centre forward'},ST:{it:'Attaccante',en:'Striker'}
};
const program={
 balanced:['Bilanciato','Balanced'],role:['Ruolo','Position'],technical:['Tecnico','Technical'],
 physical:['Fisico','Physical'],mental:['Mentale','Mental'],goalkeeper:['Portiere','Goalkeeper']
};
const availability={
 available:['Disponibile','Available'],restricted:['Rientro limitato','Restricted return'],
 unavailable:['Non disponibile','Unavailable']
};
const recovery={
 none:['Nessun recupero in corso','No current recovery'],recovering:['In recupero','Recovering'],
 returning:['Rientro graduale','Gradual return'],cleared:['Idoneo','Cleared']
};
const injuryKind={
 muscle:['Muscolare','Muscle'],ligament:['Legamentoso','Ligament'],ankle:['Caviglia','Ankle'],
 knee:['Ginocchio','Knee'],bruise:['Contusione','Bruise'],concussion:['Commozione','Concussion'],
 illness:['Malattia','Illness']
};
const lbl=(v,lang)=>v?.[lang==='en'?1:0]??'—';
const own=(w,player)=>player.clubId===w.clubId;

/** Only the stored medical snapshot is authoritative. No default fabricated state. */
export function renderObservedMedical(w,player,lang='it'){
 if(!own(w,player))return '';
 const state=player.medicalV1;
 if(!state)return '';
 let available;
 try{validateMedical(state);available=medicalAvailability(state);}catch{
  return section(tr(lang,'Dettagli medici','Medical details'),
   fact(tr(lang,'Stato dei dati','Data status'),tr(lang,'Cartella clinica non verificabile','Medical record unavailable')));
 }
 const pct=value=>validNumber(value)?`${decimal(value)}/100`:'—';
 const days=state.injury?.stage==='recovering'&&Number.isSafeInteger(state.injury.daysRemaining)
  ?`${state.injury.daysRemaining} ${tr(lang,'giorni','days')}`:'—';
 return section(tr(lang,'Dettagli medici','Medical details'),
   fact(tr(lang,'Freschezza','Freshness'),pct(state.freshness))+
   fact(tr(lang,'Affaticamento','Fatigue'),pct(state.fatigue))+
   fact(tr(lang,'Carico accumulato','Accumulated load'),pct(state.overload))+
   fact(tr(lang,'Disponibilità medica','Medical availability'),lbl(availability[available.status],lang))+
   fact(tr(lang,'Stato recupero','Recovery status'),lbl(recovery[state.recoveryStatus],lang))+
   fact(tr(lang,'Tipo di infortunio','Injury type'),state.injury?lbl(injuryKind[state.injury.kind],lang):'—')+
   fact(tr(lang,'Giorni rimanenti','Days remaining'),days));
}

/** Existing medical / gameplay dynamics are public only to the managed club. */
export function renderObservedRelations(w,player,lang='it'){
 if(!own(w,player)||!personalityEnabled(w)||!validateCareerPersonality(w))return '';
 const state=w.advancedV1.personalityV1.playerStates[String(player.id)];
 if(!state)return '';
 const historic=Array.isArray(state.history)?state.history.slice(-6).reverse()
   .filter(row=>validNumber(Math.abs(row.moraleDelta))&&validNumber(Math.abs(row.relationshipDelta))):[];
 const rows=fact(tr(lang,'Morale registrato','Recorded morale'),validNumber(state.morale)?`${decimal(state.morale)}/100`:'—')+
    fact(tr(lang,'Rapporto con l’allenatore','Coach relationship'),validNumber(state.coachRelationship)?`${decimal(state.coachRelationship)}/100`:'—')+
    fact(tr(lang,'Influenza nello spogliatoio','Dressing-room influence'),validNumber(state.influence)?`${decimal(state.influence)}/100`:'—');
 const event={win:['Vittoria','Win'],loss:['Sconfitta','Loss'],played:['Presenza','Appearance'],
  bench:['Panchina','Bench'],draw:['Pareggio','Draw'],training:['Allenamento','Training']};
 const history=historic.length?`<div class="plyr056-history"><h3>${tr(lang,'Variazioni già registrate','Recorded changes')}</h3><ul>${historic.map(row=>
  `<li><span>${esc(lbl(event[row.type],lang)||tr(lang,'Evento','Event'))}</span><span>${tr(lang,'Morale','Morale')} ${esc(row.moraleDelta>0?'+':'')}${esc(decimal(row.moraleDelta))}</span><span>${tr(lang,'Rapporto','Relationship')} ${esc(row.relationshipDelta>0?'+':'')}${esc(decimal(row.relationshipDelta))}</span></li>`).join('')}</ul></div>`:'';
 return `<section class="plyr051-card plyr056-card"><h2>${tr(lang,'Rapporto con l’allenatore','Coach relationship')}</h2><dl class="plyr051-facts">${rows}</dl>${history}</section>`;
}

/** These are derived ratings for related positions, not verified learned positions.
 * Never run on opponents — even if an external player has stored attributes.
 */
export function renderRelatedPositions(w,player,lang='it'){
 if(!own(w,player)||!player.attributeProfile)return '';
 try{
  const natural=canonicalPosition(player.position);
  const attributes=readPlayerAttributes(player,{seed:w.seed,countryId:w.countryId});
  const rated=ratePlayer(player,attributes);
  const related=POSITIONS.filter(pos=>pos!==natural&&familiarityPenalty(natural,pos)<=9)
   .map(pos=>({pos,value:rated.allPositions[pos]}))
   .filter(row=>Number.isInteger(row.value)&&row.value>=1&&row.value<=100)
   .sort((a,b)=>b.value-a.value||a.pos.localeCompare(b.pos))
   .slice(0,5);
  if(!related.length)return '';
  return section(tr(lang,'Valutazioni in ruoli affini','Related position ratings'),
   related.map(row=>fact(names[row.pos]?.[lang]??row.pos,`${row.value}/100`)).join(''),
   tr(lang,'Valori calcolati dagli attributi attuali: non indicano posizioni secondarie apprese.',
    'Derived from current attributes: these do not imply learned secondary positions.'));
 }catch{return '';}
}

/** Last official development record; no forecasting or unrecorded growth. */
export function renderRecordedDevelopment(w,player,lang='it'){
 if(!own(w,player)||!player.developmentV1)return '';
 let snapshot;
 try{validateDevelopment(player.developmentV1);snapshot=player.developmentV1.history?.at(-1);}catch{return '';}
 if(!snapshot)return '';
 const signed=n=>Number.isFinite(n)?`${n>0?'+':''}${decimal(n)}`:'—';
 const rows=fact(tr(lang,'Stagione registrata','Recorded season'),snapshot.season)+
  fact(tr(lang,'Variazione OVR registrata','Recorded OVR change'),signed(snapshot.delta))+
  fact(tr(lang,'Programma svolto','Completed program'),lbl(program[snapshot.program],lang))+
  fact(tr(lang,'Minuti registrati','Recorded minutes'),Number.isSafeInteger(snapshot.minutes)?String(snapshot.minutes):'—')+
  fact(tr(lang,'Forma registrata','Recorded form'),validNumber(snapshot.form)?`${decimal(snapshot.form)}/100`:'—')+
  fact(tr(lang,'Carico registrato','Recorded workload'),validNumber(snapshot.workload)?`${decimal(snapshot.workload)}/100`:'—');
 return `<div class="plyr056-development">${section(tr(lang,'Ultimo sviluppo registrato','Latest recorded development'),rows,
  tr(lang,'Solo dati storici della stagione già completata.','Only historical data from a completed season.'))}</div>`;
}
