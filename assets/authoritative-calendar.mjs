// Private read-only calendar transport. Browser events never confer world authority.
import {validPublicWorld,scoreValid,viewedSeasonState} from './authoritative-season.mjs';
const fail=()=>{throw TypeError('Invalid authoritative calendar')};
const same=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
const key=c=>c.countryId+'-'+c.clubId;
export function validateCalendarDay(input,selection,manifest){
 if(input?.schemaVersion!==1||input.providerId!=='authoritative-world'||input.scope!=='calendar'||input.selectedSeason!==selection.season||input.day!==selection.day||!validPublicWorld(input.world))fail();
 if(!['partial','available'].includes(input.status)){
  const reasons=input.status==='empty'?['season-not-prepared','calendar-unpublished']:input.status==='unavailable'?['unsupported-season','unsupported-world-season']:[];
  if(!reasons.includes(input.reason)||input.data!==null||input.provenance?.kind!=='none'||input.provenance.sourceRef!==null||input.provenance.resultAuthority!==null)fail();return structuredClone(input);
 }
 const {data:d,world:w,provenance:p}=input,viewed=viewedSeasonState(input);
 if(!viewed||![1,2].includes(w.seasonNumber)||d?.season!==selection.season||d.day!==selection.day||input.reason!==null||p?.kind!=='authoritative'||p.resultAuthority!=='temporary-score-v1'||
   !/^[a-f0-9]{64}$/.test(d.calendarHash)||!/^[a-f0-9]{64}$/.test(d.rulesHash)||p.sourceRef!==`world:${w.generation}:season:${selection.season}:${d.calendarHash}`||(input.status==='available')!==(viewed.phase==='closed'))fail();
 const definitions=new Map(manifest.competitions.map(c=>[c.id,c])),catalog=new Map(manifest.divisions.flatMap(d=>d.clubs).map(c=>[key(c),c]));
 if(!Array.isArray(d.competitions)||d.competitions.length!==18||new Set(d.competitions.map(c=>c.id)).size!==18||!Array.isArray(d.fixtures))fail();
 const bindings=new Map(d.competitions.map(c=>[c.id,c]));
 for(const c of d.competitions){const def=definitions.get(c.id);if(!def||c.rulesVersion!==def.rules.version||!Array.isArray(c.clubIds)||c.clubIds.length!==def.capacity||new Set(c.clubIds).size!==c.clubIds.length||c.clubIds.some(id=>!catalog.has(id)))fail();
  if(def.category==='domestic'){const ids=manifest.divisions.find(d=>d.id===c.id).clubs.map(key);if(selection.season===1?c.clubIds.some(id=>!ids.includes(id)):c.clubIds.some(id=>!id.startsWith(c.id.split('-')[0]+'-')))fail()}
  else for(const country of ['IT','ENG','ES','DE','FR','PT','NL','BR'])if(c.clubIds.filter(id=>id.startsWith(country+'-')).length!==3)fail();
 }
 for(const country of ['IT','ENG','ES','DE','FR','PT','NL','BR'])if(new Set([...(bindings.get(country+'-1')?.clubIds||[]),...(bindings.get(country+'-2')?.clubIds||[])]).size!==32)fail();
 if(new Set(['int-1','int-2'].flatMap(id=>bindings.get(id).clubIds)).size!==48)fail();
 const events=globalThis.faWorldCalendarModel.createSeason(selection.season).days[selection.day-1].events,seen=new Set();
 for(const f of d.fixtures){
  const binding=bindings.get(f.competitionId),def=definitions.get(f.competitionId),phase=def?.rules.phases.find(p=>p.id===f.phaseId),event=events.find(e=>e.marker===f.marker&&e.competitionIds.includes(f.competitionId));
  if(!binding||!phase||!event||f.day!==selection.day||!binding.clubIds.includes(f.homeClubId)||!binding.clubIds.includes(f.awayClubId)||f.homeClubId===f.awayClubId||
    !Number.isInteger(f.round)||f.round<1||f.round>33||f.id!==`season:${selection.season}:${f.competitionId}:${f.marker}:${f.homeClubId}:${f.awayClubId}`||seen.has(f.id)||
    !phase.calendarEvents.includes(f.marker)||typeof f.neutral!=='boolean'||(f.result!==null)!==(selection.day<=viewed.day)||f.result!==null&&!scoreValid(f.result,f))fail();
  if(phase.type==='knockout'){const tie=phase.ties.find(t=>t.id===f.tieId);if(!tie||!Number.isInteger(f.leg)||f.leg<1||f.leg>tie.legs||f.neutral!==(tie.homePolicy==='neutral'))fail()}
  else if(f.tieId!==null||f.leg!==null||f.neutral||f.round!==phase.calendarEvents.indexOf(f.marker)+1)fail();seen.add(f.id);
 }
 for(const event of events.filter(e=>e.phase==='league'))for(const id of event.competitionIds){const games=d.fixtures.filter(f=>f.competitionId===id&&f.marker===event.marker);if(games.length!==definitions.get(id).capacity/2||new Set(games.flatMap(f=>[f.homeClubId,f.awayClubId])).size!==definitions.get(id).capacity)fail()}
 return structuredClone(input);
}
export function createCalendarLoader({getSelection,clear,commit,fetchJson,manifest,onState=()=>{}}){
 let epoch=0,controller=null,disposed=false;
 return Object.freeze({async load(){
  if(disposed)return false;const selection={...getSelection()},ticket=++epoch;controller?.abort();controller=new AbortController();const signal=controller.signal;
  clear();onState('loading');const current=()=>!disposed&&ticket===epoch&&getSelection().season===selection.season&&getSelection().day===selection.day;
  let completed=false;
  try{
   const before=await fetchJson('/api/world',{signal});if(!current()||!validPublicWorld(before?.world))return false;
   const data=validateCalendarDay(await fetchJson(`/api/calendar/seasons/${selection.season}/days/${selection.day}`,{signal}),selection,manifest);if(!current()||!same(before.world,data.world))return false;
   const after=await fetchJson('/api/world',{signal});if(!current()||!validPublicWorld(after?.world)||!same(data.world,after.world))return false;
   commit(data);if(!current())return false;completed=true;onState(data.status);return true;
  }catch{return false}finally{if(!completed&&current())onState('unavailable')}
 },dispose(){disposed=true;epoch++;controller?.abort()}});
}
const words={en:['Loading season data…','Season data is unavailable.','No published season data yet.','No known fixtures for this day.','Scheduled','World day'],it:['Caricamento dei dati della stagione…','Dati della stagione non disponibili.','Nessun dato della stagione ancora pubblicato.','Nessuna partita definita per questo giorno.','In programma','Giorno del mondo'],de:['Saisondaten werden geladen…','Saisondaten sind nicht verfügbar.','Noch keine veröffentlichten Saisondaten.','Keine bekannten Spiele für diesen Tag.','Geplant','Welttag'],es:['Cargando datos de la temporada…','Los datos de la temporada no están disponibles.','Aún no hay datos publicados de la temporada.','No hay partidos definidos para este día.','Programado','Día mundial'],fr:['Chargement des données de la saison…','Les données de la saison sont indisponibles.','Aucune donnée de saison publiée pour le moment.','Aucune rencontre connue pour ce jour.','Prévu','Jour mondial']};
export async function mountAuthoritativeCalendar({root,document=globalThis.document,window=globalThis.window,onWorld}){
 const fetchJson=async(path,{signal}={})=>{const r=await window.fetch(path,{signal,credentials:'omit',cache:'no-store',redirect:'error'});if(!r.ok)throw Error('Calendar unavailable');return r.json()};
 const manifest=await fetchJson('/competitions/_shared/manifest.json'),catalog=new Map(manifest.divisions.flatMap(d=>d.clubs).map(c=>[key(c),c])),names=new Map(manifest.competitions.map(c=>[c.id,c.name]));
 if(!document.getElementById('calendar-event-dialog'))await new Promise(resolve=>{
  const finish=()=>{window.removeEventListener('fa:calendar-ui-ready',finish);document.removeEventListener('DOMContentLoaded',finish);window.removeEventListener('load',finish);resolve()};
  window.addEventListener('fa:calendar-ui-ready',finish);document.addEventListener('DOMContentLoaded',finish);window.addEventListener('load',finish);if(document.readyState==='complete')finish();
 });
 const dialog=document.getElementById('calendar-event-dialog'),details=document.getElementById('calendar-details-content');
 if(!dialog)throw Error('Calendar UI unavailable');
 let payload=null,state='loading',selectionKey='';
 const getSelection=()=>({season:window.faCalendarSelectedSeason?.()??Number(root.dataset.season||1),day:Number(dialog?.dataset.authoritativeDay||document.documentElement.dataset.calendarDay||1)});
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
 const render=()=>{
  const t=words[document.documentElement.lang]||words.en;
  for(const host of [dialog?.open?dialog.querySelector('#calendar-event-dialog-details'):null,details].filter(Boolean)){
   host.querySelector('[data-authoritative-calendar]')?.remove();const section=make('section');section.dataset.authoritativeCalendar='';section.setAttribute('aria-live','polite');
   if(payload?.data&&['partial','available'].includes(state)){
    const fixtures=payload.data.fixtures;
    if(!fixtures.length)section.append(make('p',t[3]));
    const list=make('ul');for(const f of fixtures){const row=make('li');row.style.overflowWrap='anywhere';const home=catalog.get(f.homeClubId).primaryName,away=catalog.get(f.awayClubId).primaryName;
     row.append(make('span',names.get(f.competitionId)+' · '+home+' — '+away+' · '+(f.result?f.result.homeGoals+'–'+f.result.awayGoals:t[4])));
     if(f.result?.penalties)row.append(make('span',' ('+f.result.penalties.home+'–'+f.result.penalties.away+')'));
     list.append(row);
    }section.append(list);
   }else section.append(make('p',state==='loading'?t[0]:state==='empty'?t[2]:t[1]));
   host.append(section);
  }
 };
 const loader=createCalendarLoader({manifest,getSelection,fetchJson,clear:()=>{payload=null;onWorld(null);render()},commit:data=>{payload=data;onWorld(data.world)},onState:s=>{state=s;render()}});
 const reload=event=>{const s=getSelection(),next=s.season+':'+s.day;if(next===selectionKey&&!event?.detail?.refresh){render();return;}selectionKey=next;void loader.load()};
 window.addEventListener('fa:calendar-selection-change',reload);
 window.addEventListener('focus',()=>void loader.load());
 window.addEventListener('pageshow',e=>{if(e.persisted)void loader.load()});
 window.addEventListener('pagehide',e=>{if(!e.persisted)loader.dispose()});
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 reload();return loader;
}
