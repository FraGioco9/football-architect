import {LEAGUES,getLeagueClubs,leagueById} from './leagues.js';
import {seasonLabel} from './simulation.js';
import {bestCareer} from './career-store.js';
import {icon} from './icons.js';
import {languagePicker} from './language-picker.js';
export const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const tr=(lang,it,en)=>lang==='en'?en:it;
const fmtDate=(value,lang,clock=false)=>{
 if(!value)return '—';
 const d=new Date(clock?value:value+'T12:00:00Z');
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(lang==='en'?'en-GB':'it-IT',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC',...(clock?{hour:'2-digit',minute:'2-digit'}:{})}).format(d):'—';
};
const club=(country,id)=>getLeagueClubs(country).find(x=>x.id===id);
const crest=c=>c?`<span class="crest" style="--club1:${esc(c.colors[0])};--club2:${esc(c.colors[1])}">${esc(c.short)}</span>`:'<span class="crest unknown">?</span>';
const buttonIcons={continue:'play',new:'plus-circle',careers:'folder-open',settings:'settings',load:'play',rename:'pencil',export:'download',delete:'trash',import:'upload',day:'calendar',week:'calendar',month:'calendar',year:'calendar',toggle:'play','start-career':'play','cancel-setup':'arrow-left'};
export const button=(action,title,variant='primary',attrs='')=>`<button type="button" class="btn ${variant}" data-action="${action}" ${attrs}>${buttonIcons[action]?icon(buttonIcons[action],16):''}<span>${esc(title)}</span></button>`;
export function layout(inner,lang,message='',languageOpen=false){
 return `<div class="shell"><a href="#content" class="skip">${tr(lang,'Vai al contenuto','Skip to content')}</a>
 <header class="top"><a class="brand" href="/" data-action="home"><span class="brand-symbol">${icon('shield',22)}</span><span>FOOTBALL <b>ARCHITECT</b><small>BUILD YOUR LEGACY</small></span></a>
 <div class="header-actions">${languagePicker(lang,languageOpen)}</div></header>
 <main id="content">${message?`<p class="notice" role="status">${esc(message)}</p>`:''}${inner}</main>
 <footer>FOOTBALL ARCHITECT · ${tr(lang,'OFFLINE · GIOCATORE SINGOLO','OFFLINE · SINGLE PLAYER')}</footer></div>`;
}
const option=(action,symbol,title,desc)=>`<button class="menu-option" type="button" data-action="${action}">
 <span class="option-icon" aria-hidden="true">${icon(symbol,21)}</span><span class="option-copy"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span><span class="menu-chevron">${icon('chevron-right',18)}</span></button>`;
export function homePage(catalog,lang){
 const active=bestCareer(catalog),meta=active?.meta,team=meta&&club(meta.countryId,meta.clubId);
 return `<section class="hero"><span class="kicker">${tr(lang,'IL TUO MONDO CALCISTICO','YOUR FOOTBALL WORLD')}</span>
 <h1>${tr(lang,'Benvenuto in Football Architect','Welcome to Football Architect')}</h1><p>${tr(lang,'Ogni carriera è una storia diversa. Scegli una squadra e costruisci il tuo percorso.','Every career tells a different story. Choose a club and build your journey.')}</p></section>
 <div class="menu-stack">${active?`<section class="panel active-career" aria-label="${tr(lang,'Ultima carriera','Last career')}"><span class="kicker active-label">${icon('clock',15)} ${tr(lang,'ULTIMA CARRIERA','LAST CAREER')}</span>
 <div class="active-details">${crest(team)}<div><h2>${esc(team?.name??'—')}</h2><p>${meta.careerName&&meta.careerName!==team?.name?esc(meta.careerName)+' · ':''}${esc(meta.managerName)} · ${tr(lang,'Stagione','Season')} ${esc(seasonLabel(active.state.date))}</p>
 <p>${esc(fmtDate(active.state.date,lang))} · ${tr(lang,'Salvata','Saved')} ${esc(fmtDate(meta.updatedAt,lang,true))}</p></div></div>
 ${button('continue',tr(lang,'Continua carriera','Continue career'))}</section>`:''}
 <section class="menu-actions" aria-label="${tr(lang,'Azioni principali','Main actions')}">
 ${option('new','plus-circle',tr(lang,'Nuova carriera','New career'),tr(lang,'Inizia un nuovo percorso da allenatore','Begin a new managerial journey'))}
 ${option('careers','folder-open',tr(lang,'Le mie carriere','My careers'),tr(lang,'Carica e gestisci i salvataggi','Load and manage saved careers'))}
 ${option('settings','settings',tr(lang,'Impostazioni','Settings'),tr(lang,'Lingua e preferenze','Language and preferences'))}
 </section></div>`;
}
export function managerPage(draft,lang){
 return `<section class="heading"><button class="back" type="button" data-action="home">${icon('arrow-left',16)} ${tr(lang,'Menu','Menu')}</button>
 <span class="kicker">${tr(lang,'NUOVA CARRIERA · PASSAGGIO 1 DI 2','NEW CAREER · STEP 1 OF 2')}</span><h1>${tr(lang,'Il tuo allenatore','Your manager')}</h1>
 <p>${tr(lang,'Inserisci un nome prima di scegliere la squadra. La carriera verrà salvata solo dopo la conferma finale.','Enter your name before choosing a club. No save is made before final confirmation.')}</p></section>
 <form id="manager-form" class="panel form-card"><label for="manager-name">${tr(lang,'Nome allenatore','Manager name')}</label>
 <input id="manager-name" name="managerName" required maxlength="80" autocomplete="off" value="${esc(draft.managerName)}" placeholder="${tr(lang,'Nome e cognome','First and last name')}">
 <div class="actions">${button('cancel-setup',tr(lang,'Annulla','Cancel'),'ghost')}<button type="submit" class="btn primary"><span>${tr(lang,'Scegli la squadra','Choose club')}</span>${icon('chevron-right',17)}</button></div></form>`;
}
export function clubList(draft,lang){
 const selected=club(draft.countryId,draft.clubId);
 const teams=getLeagueClubs(draft.countryId).filter(c=>(c.name+' '+c.city).toLocaleLowerCase().includes((draft.query??'').toLocaleLowerCase()));
 return teams.length?teams.map(c=>`<button type="button" class="club ${selected?.id===c.id?'selected':''}" data-action="select" data-id="${c.id}" aria-pressed="${selected?.id===c.id}">
 ${crest(c)}<span class="club-copy"><strong>${esc(c.name)}</strong><small>${esc(c.city)}</small></span><span aria-hidden="true">${icon(selected?.id===c.id?'check':'chevron-right',16)}</span></button>`).join(''):`<p class="muted">${tr(lang,'Nessuna squadra trovata','No clubs found')}</p>`;
}
export function teamsPage(draft,lang){
 const selected=club(draft.countryId,draft.clubId);
 return `<section class="heading"><button class="back" type="button" data-action="setup-back">${icon('arrow-left',16)} ${tr(lang,'Allenatore','Manager')}</button>
 <span class="kicker">${tr(lang,'NUOVA CARRIERA · PASSAGGIO 2 DI 2','NEW CAREER · STEP 2 OF 2')}</span><h1>${tr(lang,'Scegli una squadra','Choose a club')}</h1>
 <p>${esc(draft.managerName)} · ${tr(lang,'8 Paesi e 160 squadre inventate','8 countries and 160 fictional clubs')}</p></section>
 <section class="panel"><div class="countries" role="group" aria-label="${tr(lang,'Nazione','Country')}">
 ${LEAGUES.map(l=>`<button type="button" data-action="country" data-country="${l.id}" aria-pressed="${l.id===draft.countryId}">${esc(l.flag)} ${esc(l.country[lang])}</button>`).join('')}</div>
 <label class="search-label" for="search">${tr(lang,'Cerca una squadra','Search clubs')}</label>
 <input type="search" id="search" autocomplete="off" placeholder="${tr(lang,'Nome o città','Name or city')}" value="${esc(draft.query)}">
 <div id="clubs" class="clubs" aria-live="polite">${clubList(draft,lang)}</div>
 <div class="selection"><span>${selected?esc(selected.name):tr(lang,'Nessuna squadra selezionata','No club selected')}</span>
 ${button('start-career',tr(lang,'Inizia carriera','Start career'),'primary',selected?'':'disabled')}</div></section>`;
}
export function careersPage(catalog,lang){
 const rows=catalog.rows;
 return `<section class="heading"><button class="back" type="button" data-action="home">${icon('arrow-left',16)} ${tr(lang,'Menu','Menu')}</button>
 <span class="kicker">${tr(lang,'SALVATAGGI','SAVED CAREERS')}</span><h1>${tr(lang,'Le mie carriere','My careers')}</h1>
 <p>${tr(lang,'Ogni carriera è indipendente. Puoi esportare o eliminare anche un salvataggio danneggiato.','Each career is independent. You can export or delete damaged saves.')}</p></section>
 <section class="panel"><div class="list-top"><h2>${tr(lang,'Carriere','Careers')} (${rows.length})</h2>${button('new',tr(lang,'Nuova carriera','New career'),'secondary')}</div>
 ${rows.length?`<div class="career-list">${rows.map(row=>{
  const m=row.meta,team=m&&club(m.countryId,m.clubId),ok=row.status==='ok',id=esc(row.id);
  return `<article class="career-row ${ok?'':'corrupt'}">${crest(team)}<div class="career-copy">
  <strong>${esc(m?.careerName??team?.name??tr(lang,'Carriera non leggibile','Unreadable career'))}</strong><small>${esc(m?.managerName??'—')} · ${esc(team?.name??'—')} ${ok?'· '+esc(seasonLabel(row.state.date)):''}</small>
  <small>${ok?tr(lang,'Data','Date')+' '+esc(fmtDate(row.state.date,lang))+' · '+tr(lang,'Salvata','Saved')+' '+esc(fmtDate(m.updatedAt,lang,true)):tr(lang,'Salvataggio danneggiato: caricamento disabilitato','Corrupt save: loading disabled')}</small></div>
  <div class="row-actions">${ok?button('load',tr(lang,'Carica','Load'),'secondary',`data-id="${id}"`):`<span class="corrupt-tag" role="img" aria-label="${tr(lang,'Danneggiata','Corrupt')}">${icon('alert-triangle',19)}</span>`}
  ${ok?button('rename',tr(lang,'Rinomina','Rename'),'ghost',`data-id="${id}"`):''}
  ${button('export',tr(lang,'Esporta','Export'),'ghost',`data-id="${id}"`)}
  ${button('delete',tr(lang,'Elimina','Delete'),'danger',`data-id="${id}"`)}</div></article>`;
 }).join('')}</div>`:`<div class="empty-state"><p>${tr(lang,'Non hai ancora carriere.','You have no careers yet.')}</p></div>`}
 <div class="list-bottom">${button('import',tr(lang,'Importa JSON','Import JSON'),'ghost')}

 <input id="import-file" type="file" accept="application/json,.json" hidden aria-label="${tr(lang,'File carriera JSON','Career JSON file')}"></div>
 </section>`;
}
export function settingsPage(lang){
 return `<section class="heading"><button class="back" type="button" data-action="home">${icon('arrow-left',16)} ${tr(lang,'Menu','Menu')}</button>
 <span class="kicker">${tr(lang,'PREFERENZE','PREFERENCES')}</span><h1>${tr(lang,'Impostazioni','Settings')}</h1></section>
 <section class="panel form-card"><h2>${tr(lang,'Lingua','Language')}</h2>
 <p>${tr(lang,'Cambia la lingua dal selettore in alto. La scelta è globale per tutte le carriere.','Change the language using the selector above. It applies to every career.')}</p>
 <p class="muted">${tr(lang,'Salvataggi: IndexedDB locale, nessun account o cloud.','Saves: local IndexedDB, no account or cloud.')}</p></section>`;
}
export function simulationPage(meta,state,lang,playing){
 const c=club(meta.countryId,meta.clubId),l=leagueById(meta.countryId);
 return `<section class="heading"><button class="back" type="button" data-action="home">${icon('arrow-left',16)} ${tr(lang,'Menu','Menu')}</button>
 <span class="kicker">${tr(lang,'CARRIERA','CAREER')}</span><h1>${esc(c?.name??'—')}</h1>
 <p>${esc(meta.managerName)} · ${esc(l.flag)} ${esc(l.country[lang])}</p></section>
 <div class="metrics"><section class="panel"><span class="kicker">${tr(lang,'DATA DI GIOCO','GAME DATE')}</span><h2>${esc(fmtDate(state.date,lang))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'STAGIONE','SEASON')}</span><h2>${esc(seasonLabel(state.date))}</h2></section>
 <section class="panel"><span class="kicker">${tr(lang,'GIORNI TRASCORSI','DAYS ELAPSED')}</span><h2>${state.daysElapsed.toLocaleString(lang==='en'?'en-GB':'it-IT')}</h2></section></div>
 <section class="panel control"><h2>${tr(lang,'Avanza nel tempo','Advance through time')}</h2><p>${tr(lang,'La simulazione modifica soltanto il calendario. Non viene giocata alcuna partita.','Only the calendar advances. No matches are played.')}</p>
 <div class="actions">${button('day',tr(lang,'+ 1 giorno','+ 1 day'))}${button('week',tr(lang,'+ 7 giorni','+ 7 days'))}${button('month',tr(lang,'+ 30 giorni','+ 30 days'))}${button('year',tr(lang,'+ 365 giorni','+ 365 days'))}</div>
 <div class="actions separated">${button('toggle',playing?tr(lang,'Ⅱ Ferma simulazione','Ⅱ Pause simulation'):tr(lang,'▶ Simulazione continua','▶ Auto-advance'),playing?'warning':'secondary')}
 ${button('careers',tr(lang,'Le mie carriere','My careers'),'ghost')}</div>
 <p class="muted" role="status">${playing?tr(lang,'Avanzamento automatico attivo','Automatic advancement active'):tr(lang,'Simulazione in pausa','Simulation paused')}</p></section>`;
}
