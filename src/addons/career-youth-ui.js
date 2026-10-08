/** Official career PLY06 academy; renders only persisted roster and academy. */
import {esc} from '../ui-components.js';
import {hasCareerYouth,careerYouthSummary} from '../domain/career-youth.js';
import {hasCareerTraining} from '../domain/career-training.js';
const dictionary={
 it:{title:'Vivaio e ricambio generazionale',description:'La prima squadra e l’accademia condividono un calendario. I ritiri e i nuovi giovani vengono registrati una sola volta al cambio stagione.',first:'Prima squadra',academy:'Accademia',retired:'Ritirati',total:'Giovani nel campionato',on:'Attiva vivaio e ritiri',warning:'Aggiorna la carriera e configura gli allenamenti per rendere disponibile il vivaio completo.',needs:'L’accademia viene aggiunta senza alterare i risultati precedenti.',player:'Calciatore',position:'Ruolo',age:'Età',ovr:'OVR',action:'Azione',promote:'Promuovi',full:'Rosa piena',tooYoung:'Sotto i 16 anni',empty:'L’accademia non ha ancora giovani disponibili.',archive:'Ultimi ritiri',focus:'Focus del vivaio',season:'Stagione',kind:'Evento',event:'Movimenti recenti',noRetired:'Non ci sono ancora ritiri.',noEvents:'Nessun movimento registrato.',retirement:'Ritiro',promotion:'Promozione',intake:'Nuovo giovane',emergency:'Reintegro',release:'Uscita dal vivaio'},
 en:{title:'Youth academy and succession',description:'First-team and academy share one season timeline. Retirements and youth intake are recorded only once at rollover.',first:'First team',academy:'Academy',retired:'Retired',total:'Prospects across the league',on:'Enable youth academy',warning:'Update this career and configure training to make the full academy available.',needs:'The academy is added without changing previous results.',player:'Player',position:'Position',age:'Age',ovr:'OVR',action:'Action',promote:'Promote',full:'Squad full',tooYoung:'Under 16',empty:'No academy prospects yet.',archive:'Recent retirements',focus:'Academy development focus',season:'Season',kind:'Event',event:'Recent activity',noRetired:'No retirements yet.',noEvents:'No activity recorded.',retirement:'Retirement',promotion:'Promotion',intake:'Intake',emergency:'Emergency recruit',release:'Academy departure'}
};
const table=(headers,body)=>`<div class="fa-addon-scroll" role="region" tabindex="0"><table class="fa-addon-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
export function careerYouthPanel(w,lang='it'){
 const t=dictionary[lang==='en'?'en':'it'];
 if(!w.advancedV1?.enabled||!hasCareerTraining(w))return `<section class="panel fa-youth-panel"><h2>${t.title}</h2><p>${t.warning}</p><button class="btn btn-quiet" type="button" data-action="nav" data-page="training">${lang==='en'?'Open training':'Vai ad allenamento'}</button></section>`;
 if(!hasCareerYouth(w))return `<section class="panel fa-youth-panel"><h2>${t.title}</h2><p>${t.needs}</p><button class="btn btn-primary" type="button" data-action="youth-enable">${t.on}</button></section>`;
 const s=careerYouthSummary(w),history=s.retired;
 const rows=s.academy.map(p=>{
  const allowed=p.age>=16&&s.rosterSize<s.capacity;
  const detail=p.age<16?t.tooYoung:t.full;
  return `<tr><th scope="row">${esc(p.name)}</th><td>${esc(p.position)}</td><td>${p.age}</td><td>${Math.round(p.ovr)}</td><td><button type="button" class="btn btn-quiet" data-action="youth-promote" data-id="${p.id}" ${allowed?'':`disabled title="${esc(detail)}"`}>${esc(t.promote)}</button></td></tr>`;
 }).join('')||`<tr><td colspan="5">${t.empty}</td></tr>`;
 const retirements=history.map(p=>`<tr><th scope="row">${esc(p.name)}</th><td>${esc(p.position)}</td><td>${p.age}</td><td>${p.retiredSeason}</td></tr>`).join('')||`<tr><td colspan="4">${t.noRetired}</td></tr>`;
 const events=s.events.map(e=>`<tr><th scope="row">${e.season}</th><td>${esc(t[e.type]??e.type)}</td><td>${esc(w.players.find(p=>p.id===e.playerId)?.name||s.retired.find(p=>p.id===e.playerId)?.name||s.academy.find(p=>p.id===e.playerId)?.name||`#${e.playerId}`)}</td></tr>`).join('')||`<tr><td colspan="3">${t.noEvents}</td></tr>`;
 return `<section class="panel fa-youth-panel"><h2>${t.title}</h2><p class="fa-addon-hint">${t.description}</p>
 <div class="fa-addon-facts"><div><small>${t.first}</small><strong>${s.rosterSize}/${s.capacity}</strong></div><div><small>${t.academy}</small><strong>${s.academy.length}</strong></div><div><small>${t.retired}</small><strong>${s.allRetired}</strong></div><div><small>${t.total}</small><strong>${s.totalAcademy}</strong></div></div>
 <h3>${t.focus}</h3><div class="fa-youth-focus" role="group" aria-label="${esc(t.focus)}">${['balanced','role','technical','physical','mental','goalkeeper'].map(k=>`<button type="button" class="btn ${s.academyProgram===k?'btn-primary':'btn-quiet'}" data-action="youth-program" data-value="${k}" aria-pressed="${s.academyProgram===k}">${esc(({it:{balanced:'Equilibrato',role:'Ruolo',technical:'Tecnica',physical:'Fisico',mental:'Mentale',goalkeeper:'Portieri'},en:{balanced:'Balanced',role:'Role',technical:'Technical',physical:'Physical',mental:'Mental',goalkeeper:'Goalkeepers'}})[lang==='en'?'en':'it'][k])}</button>`).join('')}</div>
 <h3>${t.academy}</h3>${table([t.player,t.position,t.age,t.ovr,t.action],rows)}
 <h3>${t.archive}</h3>${table([t.player,t.position,t.age,t.season],retirements)}
 <h3>${t.event}</h3>${table([t.season,t.kind,t.player],events)}</section>`;
}
