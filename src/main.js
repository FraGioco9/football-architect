import {LEAGUES,getLeagueClubs,leagueById} from './leagues.js';
import {createSession,advanceSession,readSession,writeSession,seasonLabel} from './simulation.js';

const app=document.getElementById('app');
let session=readSession(window.localStorage);
let lang=(()=>{try{return window.localStorage.getItem('football-architect:minimal:lang')==='en'?'en':'it';}catch{return 'it';}})();
let country='IT',choice=null,query='',timer=null;
const en=()=>lang==='en';
const tr=(it,english)=>en()?english:it;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>['/','/teams','/simulation'].includes(location.pathname)?location.pathname:'/';
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function navigate(path){stop();history.pushState({},'',path);render();}
function localeDate(date){return new Intl.DateTimeFormat(en()?'en-GB':'it-IT',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
function frame(content){
 return `<div class="shell">
  <a class="skip" href="#content">${tr('Vai al contenuto','Skip to content')}</a>
  <header class="top"><a class="brand" href="/" data-action="home">FOOTBALL <b>ARCHITECT</b></a>
   <label class="lang"><span>${tr('Lingua','Language')}</span><select id="language" aria-label="${tr('Lingua','Language')}">
    <option value="it"${lang==='it'?' selected':''}>IT</option><option value="en"${lang==='en'?' selected':''}>EN</option></select></label>
  </header><main id="content">${content}</main>
  <footer>FOOTBALL ARCHITECT · ${tr('Prototipo offline · Nessuna partita','Offline prototype · No matches')}</footer>
 </div>`;
}
function button(action,text,variant='primary',extra=''){
 return `<button type="button" class="btn ${variant}" data-action="${action}" ${extra}>${safe(text)}</button>`;
}
function home(){
 const l=session?leagueById(session.countryId):null,c= session?getLeagueClubs(session.countryId).find(x=>x.id===session.clubId):null;
 return `<section class="hero"><span class="kicker">${tr('IL TUO CALCIO, LE TUE SCELTE','YOUR CLUB. YOUR JOURNEY.')}</span>
  <h1>${tr('Benvenuto in Football Architect','Welcome to Football Architect')}</h1>
  <p>${tr('Scegli una squadra e avanza nel tempo. Nessuna partita, nessun risultato: solo una base pulita da cui ripartire.','Choose a club and advance through time. No matches or scores: a clean foundation.')}</p>
  <div class="actions">${button('new',tr('Scegli una squadra','Choose a club'))}${session?button('continue',tr('Continua simulazione','Continue simulation'),'secondary'):''}</div>
  </section>${session?`<section class="panel preview"><span class="kicker">${tr('SESSIONE ATTIVA','ACTIVE SESSION')}</span><h2>${safe(c?.name)}</h2><p>${safe(l?.country[lang])} · ${safe(localeDate(session.date))}</p></section>`:''}`;
}
function clubsMarkup(){
 const clubs=getLeagueClubs(country).filter(c=>(c.name+' '+c.city).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return clubs.length?clubs.map(c=>`<button type="button" class="club ${choice===c.id?'selected':''}" data-action="select" data-id="${c.id}" aria-pressed="${choice===c.id}">
  <span class="crest" style="--club1:${safe(c.colors[0])};--club2:${safe(c.colors[1])}">${safe(c.short)}</span><span class="club-copy"><strong>${safe(c.name)}</strong><small>${safe(c.city)}</small></span><span aria-hidden="true">${choice===c.id?'✓':'›'}</span></button>`).join(''):`<p class="muted">${tr('Nessuna squadra trovata.','No clubs found.')}</p>`;
}
function choose(){
 return `<section class="heading"><button type="button" class="back" data-action="home">← ${tr('Menu','Menu')}</button><span class="kicker">${tr('NUOVA SIMULAZIONE','NEW SIMULATION')}</span>
  <h1>${tr('Scegli una squadra','Choose a club')}</h1><p>${tr('Otto nazioni, venti squadre inventate per campionato.','Eight countries, twenty fictional clubs in each league.')}</p></section>
  <section class="panel"><div class="countries" role="group" aria-label="${tr('Paese','Country')}">${LEAGUES.map(l=>`<button type="button" data-action="country" data-country="${l.id}" aria-pressed="${l.id===country}">${safe(l.flag)} ${safe(l.country[lang])}</button>`).join('')}</div>
  <label class="search-label" for="search">${tr('Cerca una squadra','Find a club')}</label><input id="search" type="search" placeholder="${tr('Nome o città','Name or city')}" value="${safe(query)}" autocomplete="off">
  <div id="clubs" class="clubs" aria-live="polite">${clubsMarkup()}</div>
  <div class="selection"><span id="selected">${choice?safe(getLeagueClubs(country).find(c=>c.id===choice)?.name):tr('Nessuna squadra selezionata','No club selected')}</span>
   ${button('start',tr('Inizia simulazione','Start simulation'),'primary',choice?'':'disabled')}</div></section>`;
}
function simulation(){
 if(!session)return home();
 const league=leagueById(session.countryId),club=getLeagueClubs(session.countryId).find(c=>c.id===session.clubId);
 return `<section class="heading"><button class="back" type="button" data-action="home">← ${tr('Menu','Menu')}</button><span class="kicker">${tr('SIMULAZIONE','SIMULATION')}</span>
 <h1>${safe(club.name)}</h1><p>${safe(league.flag)} ${safe(league.country[lang])} · ${safe(club.city)}</p></section>
 <div class="metrics"><section class="panel"><span class="kicker">${tr('DATA DI GIOCO','SIMULATION DATE')}</span><h2>${safe(localeDate(session.date))}</h2></section>
 <section class="panel"><span class="kicker">${tr('STAGIONE','SEASON')}</span><h2>${safe(seasonLabel(session.date))}</h2></section>
 <section class="panel"><span class="kicker">${tr('GIORNI TRASCORSI','DAYS ELAPSED')}</span><h2>${session.daysElapsed.toLocaleString(en()?'en-GB':'it-IT')}</h2></section></div>
 <section class="panel control"><h2>${tr('Avanza nel tempo','Advance through time')}</h2>
 <p>${tr('La simulazione modifica soltanto la data e la stagione. Nessun incontro viene generato o giocato.','Only the date and season advance. No fixtures, matches or results are generated.')}</p>
 <div class="actions">${button('day',tr('+ 1 giorno','+ 1 day'))}${button('week',tr('+ 7 giorni','+ 7 days'))}${button('month',tr('+ 30 giorni','+ 30 days'))}${button('year',tr('+ 365 giorni','+ 365 days'))}</div>
 <div class="actions separated">${button('toggle',timer===null?tr('▶ Simulazione continua','▶ Auto-advance'):tr('Ⅱ Ferma simulazione','Ⅱ Pause simulation'),timer===null?'secondary':'warning')}
 ${button('change',tr('Cambia squadra','Change club'),'ghost')}</div>
 <p class="muted" role="status">${timer===null?tr('Simulazione in pausa.','Simulation paused.'):tr('Avanzamento automatico: un giorno alla volta.','Automatic advance: one day at a time.')}</p></section>`;
}
function render(){
 const path=route();
 if(path!=='/simulation')stop();
 if(path==='/simulation'&&!session){history.replaceState({},'','/');}
 app.innerHTML=frame(path==='/teams'?choose():path==='/simulation'&&session?simulation():home());
 document.documentElement.lang=lang;
 document.title='Football Architect';
}
function advance(days){if(!session)return;try{session=advanceSession(session,days);writeSession(window.localStorage,session);render();}catch(err){stop();render();window.alert(tr('Impossibile avanzare: ','Cannot advance: ')+err.message);}}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-action]');if(!el||!app.contains(el))return;
 const action=el.dataset.action;
 if(action==='home'){e.preventDefault();navigate('/');return;}
 if(action==='new'){if(session&&!window.confirm(tr('Avviare una nuova simulazione? Quella attuale sarà sostituita, ma i vecchi salvataggi IndexedDB resteranno intatti.','Start a new simulation? The current one will be replaced. Old IndexedDB saves remain untouched.')))return;country='IT';choice=null;query='';navigate('/teams');return;}
 if(action==='continue'){navigate('/simulation');return;}
 if(action==='country'){country=el.dataset.country;choice=null;query='';render();return;}
 if(action==='select'){choice=Number(el.dataset.id);render();return;}
 if(action==='start'){if(!choice)return;try{session=createSession(country,choice);writeSession(window.localStorage,session);navigate('/simulation');}catch(err){window.alert(err.message);}return;}
 if(action==='change'){stop();if(!window.confirm(tr('Cambiare squadra e ricominciare?','Choose another club and restart?')))return;country=session.countryId;choice=null;query='';navigate('/teams');return;}
 if(action==='day'||action==='week'||action==='month'||action==='year'){stop();advance({day:1,week:7,month:30,year:365}[action]);return;}
 if(action==='toggle'){if(timer!==null){stop();render();}else{timer=setInterval(()=>advance(1),500);render();}return;}
});
document.addEventListener('input',e=>{
 if(e.target.id!=='search')return;
 query=e.target.value;
 const target=document.getElementById('clubs');if(target)target.innerHTML=clubsMarkup();
});
document.addEventListener('change',e=>{
 if(e.target.id!=='language')return;
 lang=e.target.value==='en'?'en':'it';
 try{window.localStorage.setItem('football-architect:minimal:lang',lang);}catch{}
 render();
});
window.addEventListener('popstate',()=>{stop();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){stop();render();}});
render();
