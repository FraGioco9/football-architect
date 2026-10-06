// UX2-07: presentational match centre. No engine/storage imports or mutations.
import {esc} from './ui-components.js';
import {clubById,clubPlayers} from './engine.js';
import {formatCareerDateTime} from './domain/career-date.js';

const say=(lang,it,en)=>lang==='en'?en:it;
const number=(v)=>Number.isFinite(Number(v))?Number(v):0;
const minute=(value)=>Number.isFinite(Number(value))?`${Math.max(0,Math.floor(Number(value)))}′`:'—';

export function matchReadiness(world){
  const players=clubPlayers(world,world.clubId)??[];
  const starters=new Set((world.lineup??[]).filter(Boolean).map(String));
  const squad=players.filter(p=>starters.has(String(p.id)));
  const unavailable=squad.filter(p=>(Number(p.injury)>0||(typeof p.injury==='string'&&p.injury!=='0'&&p.injury.length>0))||p.medicalV1?.availability==='unavailable').length;
  const exhausted=squad.filter(p=>Number.isFinite(Number(p.fitness))&&Number(p.fitness)<65).length;
  return {starters:squad.length,unavailable,exhausted};
}

export function matchPreparation(world,fixture,lang='it',{advanced=false,previewSaved=false}={}){
  if(!fixture||fixture.result||fixture.home===undefined||fixture.away===undefined)return '';
  const home=clubById(world,fixture.home),away=clubById(world,fixture.away),ready=matchReadiness(world);
  const tr=(it,en)=>say(lang,it,en);
  return `<section class="match-center-preparation panel" aria-label="${tr('Preparazione partita','Match preparation')}">
    <div class="match-center-preparation-heading"><span class="eyebrow">${tr('PRIMA DEL FISCHIO','BEFORE KICKOFF')}</span><h3>${tr('Prepara la prossima partita','Prepare the next match')}</h3><p>${esc(home?.name||'—')} · ${tr('contro','versus')} · ${esc(away?.name||'—')}${home?.stadium?` · ${esc(home.stadium)}`:''}</p><p class="match-scheduled-at"><strong>${formatCareerDateTime(fixture.date,fixture.kickoff,lang)}</strong></p></div>
    <div class="match-center-preparation-metrics" role="group" aria-label="${tr('Disponibilità formazione','Lineup readiness')}">
      <div><span>${tr('Titolari','Starters')}</span><strong>${ready.starters}/11</strong></div>
      <div><span>${tr('Indisponibili tra i titolari','Unavailable starters')}</span><strong>${ready.unavailable}</strong></div>
      <div><span>${tr('Titolari sotto 65% fitness','Starters below 65% fitness')}</span><strong>${ready.exhausted}</strong></div>
    </div>
    <div class="match-center-preparation-actions"><button type="button" class="btn btn-outline" data-action="nav" data-page="tactics">${tr('Apri centro tattico','Open tactics centre')}</button>
      <button type="button" class="btn btn-secondary" data-action="preview-match" data-id="${esc(fixture.id)}">${advanced?tr('Prepara tattiche avanzate','Prepare advanced tactics'):previewSaved?tr('Riprendi anteprima non ufficiale','Resume unofficial preview'):tr('Anteprima non ufficiale','Unofficial preview')}</button>
      <button type="button" class="btn btn-primary" data-action="advance">${tr('Gioca giornata ufficiale','Play official matchday')}</button></div>
    <p class="match-center-disclaimer">${tr('L’anteprima non modifica calendario o risultati. Giocare la giornata avanza invece la carriera ufficiale.','The preview does not change fixtures or results. Playing the matchday advances your official career.')}</p>
  </section>`;
}

const previewSymbol={goal:'⚽',half_time:'Ⅱ',full_time:'■',shot:'↗',kickoff:'▶',recovery:'↺',pass:'→',possession:'◉'};
export function previewEventTimeline(events,world,lang,commentary,clock){
  const tr=(it,en)=>say(lang,it,en);
  if(!events?.length)return `<p class="muted">${tr('In attesa del calcio d’inizio.','Waiting for kickoff.')}</p>`;
  return `<ol class="match-center-timeline" aria-label="${tr('Cronologia eventi di anteprima','Preview event timeline')}">${events.map((e,i)=>`<li class="match-center-event event-${esc(e.type||'other')}" data-event="${esc(e.type||'other')}"><span class="match-center-event-time">${esc(clock(e))}</span><span class="match-center-event-symbol" aria-hidden="true">${previewSymbol[e.type]??'•'}</span><span>${esc(commentary(world,e,lang))}</span></li>`).join('')}</ol>`;
}

export function officialMatchTimeline(world,fixture,lang='it'){
  const tr=(it,en)=>say(lang,it,en),r=fixture?.result;
  if(!r)return '';
  const details=r.advancedV1;
  const recorded=Array.isArray(details?.events)?details.events:[];
  // Advanced event stream is authoritative; legacy matches only offer recorded goals.
  const items=recorded.length?recorded.filter(e=>['goal','shot','foul','recovery'].includes(e.type)).map(e=>({minute:Number(e.second)/60+1,side:e.side,type:e.type,name:world.players?.find(p=>String(p.id)===String(e.playerId))?.name||'—'})):
    (r.goals??[]).map(g=>({minute:g.minute,side:g.side,type:'goal',name:world.players?.find(p=>String(p.id)===String(g.scorerId))?.name||'—'}));
  const kinds={goal:tr('Gol','Goal'),shot:tr('Tiro','Shot'),foul:tr('Fallo','Foul'),recovery:tr('Recupero','Recovery')};
  const sorted=items.filter(e=>Number.isFinite(Number(e.minute))).sort((a,b)=>a.minute-b.minute);
  return `<section class="match-center-official-events" aria-label="${tr('Cronologia ufficiale','Official timeline')}"><h3>${tr('Timeline ufficiale','Official timeline')}</h3><p class="muted small">${tr('Solo eventi presenti nel referto. Eventi non registrati non vengono ricostruiti.','Only recorded events are displayed. Missing events are not reconstructed.')}</p>${sorted.length?`<ol class="match-center-timeline">${sorted.map(e=>`<li class="match-center-event event-${esc(e.type)}"><span class="match-center-event-time">${minute(e.minute)}</span><span class="match-center-event-symbol" aria-hidden="true">${e.type==='goal'?'⚽':'•'}</span><span><b>${kinds[e.type]??esc(e.type)}</b> · ${esc(e.name)} · ${esc(e.side==='home'?clubById(world,fixture.home)?.short||'—':clubById(world,fixture.away)?.short||'—')}</span></li>`).join('')}</ol>`:`<p class="match-center-empty">${tr('Nessun evento dettagliato registrato per questa partita.','No detailed events recorded for this match.')}</p>`}</section>`;
}

export function halftimeIntro(lang='it'){
  return `<div class="match-center-half-label" role="note"><strong>${say(lang,'DECISIONI INTERVALLO','HALF-TIME DECISIONS')}</strong><p>${say(lang,'Scegli eventuali cambi SIM04 e modifiche tattiche SIM02, poi conferma per simulare il secondo tempo ufficiale. Chiudendo questa finestra non avanzi la giornata.','Choose SIM04 substitutions and SIM02 tactical changes, then confirm to play the official second half. Closing this dialog does not advance the matchday.')}</p></div>`;
}
