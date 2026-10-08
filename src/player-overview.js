/** PLYR-05.1 — Standalone, read-only player overview.
 * Numeric /player/:id routes currently address the local career roster.
 * The profile never renders potential or opponent-only authoritative values.
 */
import {esc} from './ui-components.js';
import {POSITION_LABELS} from './data.js';
import {identityCountryLabel} from './domain/player-identity.js';
import {scoutingEnabled,scoutingEstimate} from './domain/career-scouting.js';
import {displayCareerMoney} from './domain/career-locale.js';

const locale=(lang,it,en)=>lang==='en'?en:it;
const number=value=>Number.isFinite(value)?String(Math.round(value)):'—';
const interval=value=>value&&Number.isFinite(value.min)&&Number.isFinite(value.max)?`${value.min}–${value.max}`:'—';
const country=(code,lang)=>{
 if(!code)return '—';
 try{return identityCountryLabel(code,lang);}catch{return String(code);}
};
const foot=(value,lang)=>({left:locale(lang,'Sinistro','Left'),right:locale(lang,'Destro','Right'),both:locale(lang,'Entrambi','Both')}[String(value||'').toLowerCase()]??'—');
const date=(value,lang)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '—';
 const d=new Date(value+'T00:00:00Z');
 return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
};
const money=(value,w,lang)=>Number.isFinite(value)?displayCareerMoney(value,{countryId:w.countryId,lang}):'—';
const info=(label,value)=>`<div class="plyr051-fact"><dt>${esc(label)}</dt><dd>${esc(value??'—')}</dd></div>`;
function card(title,content){return `<section class="plyr051-card"><h2>${esc(title)}</h2><dl class="plyr051-facts">${content}</dl></section>`;}
export function renderPlayerOverviewPage(w,ui){
 const lang=ui.language,en=lang==='en',id=ui.routePlayerId;
 const player=w.players.find(p=>p.id===id);
 if(!player)return `<div class="plyr051-page"><h1>${locale(lang,'Calciatore non disponibile','Player unavailable')}</h1><button type="button" class="btn btn-outline" data-action="player-back">${locale(lang,'Torna alla rosa','Back to squad')}</button></div>`;
 const identity=player.identity??{},owned=player.clubId===w.clubId;
 const team=w.teams.find(t=>t.id===player.clubId);
 // A scouting report can reveal estimated intervals, never exact opponent data.
 const report=!owned&&scoutingEnabled(w)
  ?scoutingEstimate(w,player.globalId??`${w.countryId}:${player.id}`)
  :null;
 const rating=owned?number(player.ovr):interval(report?.overall);
 const valuation=owned?money(player.value,w,lang)
  :report?.valueEUR?`${money(report.valueEUR.min,w,lang)}–${money(report.valueEUR.max,w,lang)}`:'—';
 const fullName=identity.displayName||player.name||`#${id}`;
 const shirt=identity.shirtNumber??player.shirtNumber;
 const pos=en?String(player.position||'—'):POSITION_LABELS[player.position]??String(player.position||'—');
 const nationality=identity.nationality?.primary?country(identity.nationality.primary,lang):player.nationality??'—';
 const secondary=identity.nationality?.secondary?country(identity.nationality.secondary,lang):'—';
 const birthplace=identity.birthPlace?.city
  ?`${identity.birthPlace.city}, ${country(identity.birthPlace.countryCode,lang)}`:'—';
 const fitness=owned&&Number.isFinite(player.fitness)?`${number(player.fitness)}%`:'—';
 const morale=owned?number(player.morale):'—';
 const injury=owned
  ?(Number(player.injury)>0?locale(lang,'Non disponibile','Unavailable'):locale(lang,'Disponibile','Available'))
  :'—';
 const term=owned&&Number.isFinite(player.contract)
  ?`${number(player.contract)} ${locale(lang,player.contract===1?'anno':'anni',player.contract===1?'year':'years')}`:'—';
 const wages=owned?money(player.wage,w,lang):'—';
 const scoutNote=!owned?`<p class="plyr051-note" role="status">${locale(lang,
   'Le valutazioni e il valore sono mostrati solo come stime quando esiste un rapporto di scouting. I dati non conosciuti restano nascosti.',
   'Ratings and value appear as estimates only when a scouting report exists. Unknown data remain hidden.')}</p>`:'';
 return `<div class="plyr051-page" data-player-overview-id="${id}">
   <nav class="plyr051-breadcrumb" aria-label="${locale(lang,'Percorso','Breadcrumb')}">
     <button type="button" class="btn btn-quiet" data-action="player-back">${locale(lang,'Indietro','Back')}</button>
     <span aria-hidden="true">/</span><span aria-current="page">${esc(fullName)}</span>
   </nav>
   <header class="plyr051-hero">
     <div class="plyr051-avatar" aria-hidden="true">${esc((identity.firstName?.[0]??fullName[0]??'').toUpperCase())}${esc((identity.lastName?.[0]??'').toUpperCase())}</div>
     <div class="plyr051-person">
       <p class="plyr051-overline">${locale(lang,'Profilo calciatore','Player profile')}</p>
       <h1>${esc(fullName)}</h1>
       <p>${shirt==null?'':`#${esc(shirt)} · `}${esc(pos)} · ${esc(number(player.age))} ${locale(lang,'anni','years')} · ${esc(nationality)}</p>
       <p class="plyr051-club">${esc(team?.name??locale(lang,'Senza squadra','Free agent'))}</p>
     </div>
     <div class="plyr051-rating" aria-label="${locale(lang,'Valutazione generale','Overall rating')}">
       <strong>${esc(rating)}</strong><span>${locale(lang,'Valutazione','Overall')}</span>
     </div>
   </header>
   <div class="plyr051-summary" aria-label="${locale(lang,'Dati principali','Key information')}">
     <div><span>${locale(lang,'Valore','Value')}</span><strong>${esc(valuation)}</strong></div>
     <div><span>${locale(lang,'Condizione','Fitness')}</span><strong>${esc(fitness)}</strong></div>
     <div><span>${locale(lang,'Contratto','Contract')}</span><strong>${esc(term)}</strong></div>
   </div>
   <div class="plyr051-section-label" aria-current="page">${locale(lang,'Panoramica','Overview')}</div>
   ${scoutNote}
   <div class="plyr051-grid">
     ${card(locale(lang,'Identità','Identity'),
       info(locale(lang,'Nome','First name'),identity.firstName||'—')+
       info(locale(lang,'Cognome','Last name'),identity.lastName||'—')+
       info(locale(lang,'Data di nascita','Date of birth'),date(identity.birthDate,lang))+
       info(locale(lang,'Luogo di nascita','Place of birth'),birthplace)+
       info(locale(lang,'Nazionalità','Nationality'),nationality)+
       info(locale(lang,'Seconda nazionalità','Second nationality'),secondary)+
       info(locale(lang,'Altezza','Height'),identity.heightCm?`${identity.heightCm} cm`:'—')+
       info(locale(lang,'Peso','Weight'),identity.weightKg?`${identity.weightKg} kg`:'—')+
       info(locale(lang,'Piede preferito','Preferred foot'),foot(identity.preferredFoot??player.foot,lang)))}
     ${card(locale(lang,'Posizione e squadra','Position and club'),
       info(locale(lang,'Posizione principale','Primary position'),pos)+
       info(locale(lang,'Altre posizioni','Other positions'),locale(lang,'Non registrate','Not recorded'))+
       info('Club',team?.name??locale(lang,'Svincolato','Free agent'))+
       info(locale(lang,'Numero di maglia','Shirt number'),shirt??'—'))}
     ${card(locale(lang,'Condizione','Condition'),
       info(locale(lang,'Condizione fisica','Fitness'),fitness)+
       info(locale(lang,'Morale','Morale'),morale)+
       info(locale(lang,'Disponibilità','Availability'),injury))}
     ${card(locale(lang,'Situazione contrattuale','Contract situation'),
       info(locale(lang,'Valore di mercato','Market value'),valuation)+
       info(locale(lang,'Durata residua','Time remaining'),term)+
       info(locale(lang,'Ingaggio settimanale','Weekly wage'),wages))}
   </div>
 </div>`;
}
