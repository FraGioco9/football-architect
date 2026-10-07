/** UX #20 04A: compact, read-only club identity page. */
import {clubOverview} from './club-overview-model.js';
import {esc,sectionHead,emptyState,metricCard} from './ui-components.js';
import {badge,icon} from './ui.js';

const link=(page,label)=>`<button class="btn btn-outline" type="button" data-action="nav" data-page="${page}">${esc(label)} ${icon('chevron',16)}</button>`;
const valueOrDash=value=>value===undefined||value===null||value===''?'—':value;

export function clubPage(w,ui){
 const d=clubOverview(w),en=ui.language==='en',tr=(it,eng)=>en?eng:it;
 if(!d)return emptyState(tr('Seleziona prima un club.','Select a club first.'));
 const {club:c}=d;
 const number=n=>n===null||n===undefined?'—':Number(n).toLocaleString(en?'en-GB':'it-IT');
 const ordinal=n=>n===null||n===undefined?'—':`${number(n)}°`;
 const tier=d.tier===2?tr('Seconda divisione','Second tier'):tr('Prima divisione','First tier');
 const target=d.board?.leagueTarget??null;
 const trust=d.board?.trust??null;
 const objectiveStatus=target===null||d.position===null
  ?'—'
  :(d.position<=target?tr('In linea con l’obiettivo','On target'):tr('Sotto l’obiettivo','Behind target'));
 const section=(title,content,action='')=>`<section class="panel card-shell club-overview-panel"><header class="panel-head"><h2>${esc(title)}</h2>${action}</header><div class="club-overview-panel-body">${content}</div></section>`;
 const objective=`<div class="club-overview-objective">
   <div><span>${tr('Obiettivo campionato','League target')}</span><strong>${target===null?'—':tr(`Top ${number(target)}`,`Top ${number(target)}`)}</strong></div>
   <div><span>${tr('Posizione attuale','Current position')}</span><strong>${ordinal(d.position)}</strong></div>
   <div><span>${tr('Stato','Status')}</span><strong>${esc(objectiveStatus)}</strong></div>
  </div>`;
 const facilityNames={
  training:tr('Centro allenamento','Training center'),
  academy:tr('Vivaio','Youth academy'),
  medical:tr('Centro medico','Medical center'),
  stadium:tr('Stadio','Stadium')
 };
 const facilityKeys=['training','academy','medical','stadium'];
 const facilities=`<div class="club-overview-facilities">${facilityKeys.map(type=>{
   const level=d.facilities?.buildings?.[type];
   return `<div><span>${esc(facilityNames[type])}</span><strong>${level===undefined||level===null?'—':`${number(level)}/5`}</strong></div>`;
  }).join('')}</div>
  <div class="club-overview-facility-meta">
   <span>${tr('Collaboratori','Staff')}: <strong>${d.facilities?number(d.facilities.staffCount):'—'}</strong></span>
   ${d.facilities?.underway>0?`<span>${tr('Progetti in corso','Projects underway')}: <strong>${number(d.facilities.underway)}</strong></span>`:''}
  </div>`;
 return `<div class="club-overview" data-page-view="club">
  ${sectionHead('CLUB',tr('Club','Club'),'')}
  <section class="club-overview-hero" aria-label="${tr('Identità del club','Club identity')}">
   <div class="club-overview-crest">${badge(c,'xl')}</div>
   <div class="club-overview-identity">
    <span class="eyebrow">${esc(d.flag||'')} ${esc(en?(d.countryEn||d.country):d.country)} · ${esc(d.competition||'')} · ${esc(tier)}</span>
    <h2>${esc(c.name)}</h2>
    <p>${esc(c.city)} · ${tr('Stadio','Stadium')}: ${esc(valueOrDash(c.stadium))} · ${tr('Capienza','Capacity')}: ${number(c.capacity)}</p>
    <div class="club-overview-hero-bottom">
     <div class="club-overview-colors" aria-label="${tr('Colori sociali','Club colours')}">${(c.colors||[]).slice(0,2).map((color,i)=>`<span style="background:${/^#[0-9a-f]{3,8}$/i.test(color)?color:'#42dcb0'}" title="${tr('Colore','Colour')} ${i+1}"></span>`).join('')}</div>
     <span class="club-overview-reputation">${tr('Reputazione','Reputation')} <strong>${number(c.reputation)}/100</strong></span>
    </div>
   </div>
  </section>
  <div class="club-overview-kpis club-overview-kpis-compact">
   ${metricCard({label:tr('POSIZIONE','POSITION'),value:ordinal(d.position),detail:tr('Campionato','League')})}
   ${metricCard({label:tr('OBIETTIVO','TARGET'),value:target===null?'—':`Top ${number(target)}`,detail:tr('Campionato','League')})}
   ${metricCard({label:tr('FIDUCIA','TRUST'),value:trust===null?'—':number(trust),detail:trust===null?'': '/100'})}
  </div>
  <div class="club-overview-grid club-overview-grid-compact">
   ${section(tr('Obiettivi','Objectives'),objective,link('board',tr('Apri Dirigenza','Open Board')))}
   ${section(tr('Strutture','Facilities'),facilities,link('finance',tr('Gestisci strutture','Manage facilities')))}
  </div>
 </div>`;
}
