/** UX2-06 — purely presentational, never written into career state. */
import {esc} from './ui-components.js';
export const TACTICS_VIEWS=Object.freeze(['formation','roles','strategy','matchday']);
const captions={
 it:{formation:['Formazione','Undici titolare e modulo'],roles:['Ruoli','Ruoli e compiti individuali'],strategy:['Strategia','Mentalità, pressing e preset'],matchday:['Distinta','Riserve e sostituzioni']},
 en:{formation:['Formation','Starting XI and shape'],roles:['Roles','Individual roles and duties'],strategy:['Strategy','Mentality, pressing and presets'],matchday:['Team sheet','Bench and substitutions']}
};
export function safeTacticsView(value){return TACTICS_VIEWS.includes(value)?value:'formation';}
export function tacticsTabs(value,lang='it'){
 const active=safeTacticsView(value),labels=captions[lang==='en'?'en':'it'];
 return `<div class="tactics-center-tabs" role="tablist" aria-label="${lang==='en'?'Tactical workspace':'Centro tattico'}">${TACTICS_VIEWS.map((key,i)=>`<button type="button" id="tactics-tab-${key}" class="tactics-center-tab${active===key?' is-active':''}" role="tab" data-action="ux206-tab" data-value="${key}" aria-controls="tactics-workspace-panel" aria-selected="${active===key}" tabindex="${active===key?'0':'-1'}"><span class="tactics-tab-index" aria-hidden="true">0${i+1}</span><span><strong>${esc(labels[key][0])}</strong><small>${esc(labels[key][1])}</small></span></button>`).join('')}</div>`;
}
export function tacticsSummary({starters=0,bench=0,unavailable=0,fitness=0,planned=0,formation='—'}={},lang='it'){
 const en=lang==='en',phrase=(it,english)=>en?english:it;
 const ready=starters===11;
 return `<div class="tactics-center-summary" role="group" aria-label="${phrase('Riepilogo preparazione partita','Match preparation summary')}"><div class="tactics-summary-main"><strong>${phrase('Preparazione gara','Match preparation')}</strong><span class="tactics-ready ${ready?'is-ready':'is-pending'}">${ready?phrase('11 titolari','11 starters'):phrase('Formazione incompleta','Incomplete lineup')}</span></div><dl><div><dt>${phrase('Modulo','Formation')}</dt><dd>${esc(formation)}</dd></div><div><dt>${phrase('Titolari','Starters')}</dt><dd>${starters}/11</dd></div><div><dt>${phrase('Panchina','Bench')}</dt><dd>${bench}</dd></div><div><dt>${phrase('Fitness medio','Average fitness')}</dt><dd>${fitness}%</dd></div><div><dt>${phrase('Indisponibili','Unavailable')}</dt><dd>${unavailable}</dd></div><div><dt>${phrase('Cambi programmati','Scheduled changes')}</dt><dd>${planned}</dd></div></dl></div>`;
}
