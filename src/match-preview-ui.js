// SIM01.04 — localized match preview, strictly read-only against the career.
import {clubById,playerById} from './engine.js';
import {esc} from './ui-components.js';
import {matchPlaybackSnapshot} from './match-playback.js';
import {officialMatchClock} from './domain/match-timeline.js';
import {previewEventTimeline} from './match-experience.js';
import {formatCareerDateTime} from './domain/career-date.js';

const phrase=(lang,it,en)=>lang==='en'?en:it;
const playerName=(world,event)=>event.playerId?playerById(world,event.playerId)?.name||'—':null;
const clubName=(world,event)=>event.teamId?clubById(world,event.teamId)?.short||'—':null;
const previewFixture=(world,record)=>world.fixtures?.flatMap(round=>round.matches??[]).find(match=>match.id===record?.matchId)??null;
export function commentaryForEvent(world,event,lang='it'){
  const player=playerName(world,event),club=clubName(world,event),detail=event.xg===null?'':` · xG ${event.xg.toFixed(2)}`;
  switch(event.type){
    case 'kickoff':return phrase(lang,`Calcio d'inizio · ${club}`,`Kickoff · ${club}`);
    case 'half_time':return phrase(lang,'Intervallo','Half-time');
    case 'full_time':return phrase(lang,'Fischio finale','Full-time whistle');
    case 'goal':return phrase(lang,`GOL! ${player} (${club})${detail}`,`GOAL! ${player} (${club})${detail}`);
    case 'shot':return phrase(lang,`Tiro di ${player} (${club})${detail}`,`Shot by ${player} (${club})${detail}`);
    case 'recovery':return phrase(lang,`Recupero palla · ${club}`,`Ball recovery · ${club}`);
    case 'pass':return phrase(lang,`Passaggio di ${player}`,`Pass by ${player}`);
    case 'possession':return phrase(lang,`Possesso · ${club}`,`Possession · ${club}`);
    default:return event.type;
  }
}
export function matchPreviewStatus(world,playback,language='it'){
  if(!playback)return '';
  const data=matchPlaybackSnapshot(playback),stat=data.stats,lang=language;
  const rows=[
    [phrase(lang,'Tiri','Shots'),stat.shotsHome,stat.shotsAway],
    ['xG',stat.xgHome.toFixed(2),stat.xgAway.toFixed(2)],
    [phrase(lang,'Passaggi','Passes'),stat.passesHome,stat.passesAway],
    [phrase(lang,'Possessi','Possessions'),stat.possessionsHome,stat.possessionsAway]
  ];
  const home=clubById(world,playback.record.homeTeamId),away=clubById(world,playback.record.awayTeamId);
  return `<div class="match-preview-scoreboard">
    <div class="match-preview-club"><strong>${esc(home?.name||'—')}</strong><small>${esc(home?.city||'')}</small></div>
    <div class="match-preview-score"><span class="match-preview-clock" aria-label="${phrase(lang,'Cronometro','Match clock')}">${esc(data.clock)}</span><strong>${stat.homeGoals} <span>:</span> ${stat.awayGoals}</strong>${data.halftime?`<small>${phrase(lang,'Intervallo','Half-time')} ${data.halftime.home} : ${data.halftime.away}</small>`:''}</div>
    <div class="match-preview-club away"><strong>${esc(away?.name||'—')}</strong><small>${esc(away?.city||'')}</small></div>
  </div>
  <div class="match-preview-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${data.progress}" aria-label="${phrase(lang,'Avanzamento cronaca','Playback progress')}"><span style="width:${data.progress}%"></span></div>
  <div class="match-center-phases" aria-label="${phrase(lang,'Fasi della partita','Match phases')}"><span class="${data.phase==='not_started'||['first_half','first_half_stoppage'].includes(data.phase)?'is-current':''}">${phrase(lang,'Primo tempo','First half')}</span><span class="${data.phase==='half_time'?'is-current':''}">${phrase(lang,'Intervallo','Half-time')}</span><span class="${['second_half','second_half_stoppage'].includes(data.phase)?'is-current':''}">${phrase(lang,'Secondo tempo','Second half')}</span><span class="${data.finished?'is-current':''}">${phrase(lang,'Finale','Full-time')}</span></div><div class="match-preview-grid"><section class="panel match-preview-stat-panel"><h2>${phrase(lang,'Statistiche in diretta','Live statistics')}</h2>${rows.map(([label,a,b])=>`<div class="match-preview-stat"><strong>${esc(a)}</strong><span>${esc(label)}</span><strong>${esc(b)}</strong></div>`).join('')}</section>
    <section class="panel match-preview-commentary"><h2>${phrase(lang,'Cronaca','Commentary')}</h2><div class="match-preview-events" aria-label="${phrase(lang,'Eventi di partita','Match events')}">${previewEventTimeline(data.highlights,world,lang,commentaryForEvent,officialMatchClock)}</div></section></div>
  <p class="match-preview-status" role="status">${data.finished?phrase(lang,'Anteprima conclusa. La carriera non è stata modificata.','Preview finished. Your career is unchanged.'):data.paused?phrase(lang,'Riproduzione in pausa','Playback paused'):phrase(lang,'Riproduzione in corso','Playback running')}</p>`;
}
export function matchPreviewPage(world,playback,language='it'){
  if(!playback)return '';
  const en=language==='en',fixture=previewFixture(world,playback.record),scheduled=fixture?formatCareerDateTime(fixture.date,fixture.kickoff,language):'—';
  return `<div class="match-preview-page"><div class="match-preview-heading"><div><span class="eyebrow">${en?'MATCH ENGINE · PREVIEW':'MATCH ENGINE · ANTEPRIMA'}</span><h1>${en?'Live match commentary':'Cronaca della partita'}</h1><p class="match-preview-schedule"><strong>${scheduled}</strong></p><p>${en?'Demonstration only: this match does not change your career, fixtures or saves.':'Solo dimostrazione: questa partita non modifica carriera, calendario o salvataggi.'}</p></div><button type="button" class="btn btn-quiet" data-action="preview-exit">${en?'Back to calendar':'Torna al calendario'}</button></div>
  <aside class="match-center-mode" role="note"><strong>${en?'UNOFFICIAL PREVIEW · NOT A CAREER RESULT':'ANTEPRIMA NON UFFICIALE · NON È UN RISULTATO DI CARRIERA'}</strong><p>${en?'The preview has no effect on standings, fatigue, substitutions or official match results. To play the official matchday, return to Calendar.':'L’anteprima non modifica classifiche, fitness, sostituzioni o risultati ufficiali. Per giocare la giornata ufficiale torna al Calendario.'}</p></aside><section class="panel match-preview-controls" aria-label="${en?'Playback controls':'Controlli riproduzione'}"><button class="btn btn-secondary" type="button" data-action="preview-toggle" data-preview-pause ${playback.cursor===playback.record.events.length?'disabled':''}>${playback.paused?(en?'Resume':'Riprendi'):(en?'Pause':'Pausa')}</button><div role="group" aria-label="${en?'Playback speed':'Velocità riproduzione'}" class="match-preview-speeds">${[1,2,4].map(speed=>`<button class="btn btn-quiet" data-action="preview-speed" data-value="${speed}" aria-pressed="${playback.speed===speed}">${speed}×</button>`).join('')}</div><button class="btn btn-outline" type="button" data-action="preview-finish" ${playback.cursor===playback.record.events.length?'disabled':''}>${en?'Skip to full-time':'Vai al fischio finale'}</button><button class="btn btn-quiet" type="button" data-action="preview-discard">${en?'Discard saved preview':'Elimina anteprima salvata'}</button></section>
  <div id="match-playback-updates">${matchPreviewStatus(world,playback,language)}</div>
  <p class="muted small">${en?'The preview is generated once from a reproducible seed. Playback speed does not alter the score. Every event is saved to this career’s preview slot. Reloading resumes at the same event, paused; the official match remains unchanged.':'L’anteprima è generata una volta con un seed riproducibile. La velocità non cambia il risultato. Ogni evento viene salvato nello slot di anteprima della carriera. Ricaricando la pagina riprendi dallo stesso punto, in pausa; la partita ufficiale resta invariata.'}</p></div>`;
}
