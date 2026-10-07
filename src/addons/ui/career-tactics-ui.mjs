/** SIM02.04–06 official tactics UI, uses the already-persisted advanced career. */
import {BUILT_IN_STYLES,describeTacticalEffects,tacticalConflicts} from '../domain/team-tactics.mjs';
import {presetTactics} from '../domain/team-tactics-presets.mjs';
import {renderTacticalComparison,tacticalLabels} from './team-tactics-ui.mjs';
import {expectedNextMatch,substitutionsEnabled} from '../../domain/career-matchday.js';
import {careerTacticsEnabled} from '../../domain/career-tactics.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={it:{balanced:'Equilibrata',possession:'Possesso',highPress:'Pressing alto',lowBlock:'Blocco basso',direct:'Diretta',counter:'Contropiede'},en:{balanced:'Balanced',possession:'Possession',highPress:'High press',lowBlock:'Low block',direct:'Direct',counter:'Counterattack'}};
export function renderCareerTacticsPanel(w,lang='it',{halftime=false,compareId=null}={}){
  const en=lang==='en',tx=(it,english)=>en?english:it;
  if(!w.advancedV1?.enabled)return '';
  if(!careerTacticsEnabled(w))return `<section class="panel sim02-official" aria-label="${tx('Strategie tattiche','Tactical strategies')}"><h3>${tx('Strategie tattiche','Tactical strategies')}</h3><p>${tx('Attiva preset salvabili e cambi tattici durante la partita. I risultati precedenti restano invariati. Esporta prima un backup JSON.','Enable saved presets and in-match tactical changes. Past results stay unchanged. Export a JSON backup first.')}</p><button type="button" class="btn btn-primary" data-action="sim02-enable">${tx('Attiva strategie tattiche','Enable tactical strategies')}</button></section>`;
  const s=w.advancedV1.tacticPlannerV1,book=s.book,next=expectedNextMatch(w);
  const available=[...Object.keys(BUILT_IN_STYLES).map(id=>({id,name:names[en?'en':'it'][id]})),...book.presets.map(p=>({id:p.id,name:p.name}))];
  const options=available.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const choice=compareId&&available.some(p=>p.id===compareId)?compareId:'balanced';
  const current=w.advancedV1.tactics,other=presetTactics(book,choice),effects=describeTacticalEffects(other),conflicts=tacticalConflicts(other);
  const labels=tacticalLabels(lang);
  const explain=Object.entries(effects).map(([key,value])=>`<li>${esc(labels[key])}: <strong>${value>0?'+':''}${Math.round(value*100)}%</strong></li>`).join('');
  const competing=conflicts.map(k=>`<li>${esc(labels[k]||k)}</li>`).join('');
  const plans=s.plans.filter(p=>p.teamId===w.clubId&&p.matchId===next?.id);
  const readonly=!next;
  return `<section class="panel sim02-official" aria-label="${tx('Strategie tattiche','Tactical strategies')}"><h3>${tx('Preset e modifiche tattiche','Presets and in-match tactics')}</h3>
  <p class="note">${tx('Le modifiche programmate diventano effettive dagli eventi successivi ai minuti 45, 60 e 75. Non consumano finestre di sostituzione.','Planned changes take effect from the next events at minutes 45, 60 and 75. They do not consume substitution windows.')}</p>
  <div class="sim02-official-grid"><div><label for="sim02-preset-id">${tx('Preset','Preset')}</label><select id="sim02-preset-id">${options}</select><label for="sim02-name">${tx('Nome per salvare o duplicare','Name for saving or duplicating')}</label><input id="sim02-name" type="text" minlength="1" maxlength="70" placeholder="${tx('La mia strategia','My strategy')}" />
  <div class="sim02-official-buttons"><button class="btn btn-outline" type="button" data-action="sim02-save">${tx('Salva la tattica corrente','Save current tactics')}</button><button class="btn btn-outline" type="button" data-action="sim02-update">${tx('Aggiorna preset','Update preset')}</button><button class="btn btn-outline" type="button" data-action="sim02-duplicate">${tx('Duplica','Duplicate')}</button><button class="btn btn-primary" type="button" data-action="sim02-apply">${tx('Applica alle prossime gare','Apply to future games')}</button><button class="btn btn-quiet" type="button" data-action="sim02-delete">${tx('Elimina preset personale','Delete custom preset')}</button></div>
  <small>${book.presets.length}/40 ${tx('preset personalizzati','custom presets')}</small></div>
  <div><label for="sim02-compare-id">${tx('Confronta la tattica corrente con','Compare current tactics with')}</label><select id="sim02-compare-id">${available.map(p=>`<option value="${esc(p.id)}" ${p.id===choice?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button class="btn btn-outline" type="button" data-action="sim02-compare">${tx('Confronta','Compare')}</button><div class="sim02-effects"><strong>${tx('Effetti attesi','Expected effects')}</strong><ul>${explain}</ul>${competing?`<strong>${tx('Possibili conflitti','Potential conflicts')}</strong><ul>${competing}</ul>`:''}</div></div></div>
  <details class="sim02-compare"><summary>${tx('Tabella di confronto dettagliata','Detailed comparison')}</summary>${renderTacticalComparison(current,other,lang)}</details>
  <div class="sim02-planner"><h4>${tx('Piano partita','Match plan')}</h4><div class="sim02-official-grid"><label for="sim02-plan-preset">${tx('Strategia da applicare','Strategy to apply')}<select id="sim02-plan-preset"><option value="current">${tx('Tattica attuale','Current tactics')}</option>${options}</select></label><label for="sim02-minute">${tx('Minuto effettivo','Effective minute')}<select id="sim02-minute">${[45,60,75].map(m=>`<option value="${m}" ${halftime&&m===45?'selected':''}>${m}′</option>`).join('')}</select></label></div><button type="button" class="btn btn-primary" data-action="sim02-plan" ${readonly?'disabled':''}>${tx('Programma modifica','Schedule change')}</button>
  ${readonly?`<p class="note">${tx('Non ci sono partite da giocare.','No upcoming fixture.')}</p>`:''}<ol>${plans.map(p=>`<li>${p.minute}′ · ${esc(available.find(a=>a.id===p.presetId)?.name??tx('Tattica attuale','Current tactics'))} <button class="btn btn-quiet" type="button" data-action="sim02-cancel" data-index="${s.plans.indexOf(p)}" aria-label="${tx('Annulla modifica','Cancel change')} ${p.minute}">×</button></li>`).join('')||`<li>${tx('Nessuna modifica programmata','No changes scheduled')}</li>`}</ol></div></section>`;
}
