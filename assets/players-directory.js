/* Read-only public players directory, backed by persisted D1 records through a safe API. */
(() => {
 'use strict';
 const flags=Object.freeze({
  ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',
  COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',
  DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',
  TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',
  GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'
 });
 const labels={
  en:{one:'player',many:'players',loading:'Loading players…',empty:'No players available',error:'Unable to load players',prev:'Previous',next:'Next',page:'Page',of:'of',left:'Left',right:'Right'},
  it:{one:'giocatore',many:'giocatori',loading:'Caricamento giocatori…',empty:'Nessun giocatore disponibile',error:'Impossibile caricare i giocatori',prev:'Precedente',next:'Successiva',page:'Pagina',of:'di',left:'Sinistro',right:'Destro'},
  de:{one:'Spieler',many:'Spieler',loading:'Spieler werden geladen…',empty:'Keine Spieler verfügbar',error:'Spieler konnten nicht geladen werden',prev:'Zurück',next:'Weiter',page:'Seite',of:'von',left:'Links',right:'Rechts'},
  es:{one:'jugador',many:'jugadores',loading:'Cargando jugadores…',empty:'No hay jugadores disponibles',error:'No se pudieron cargar los jugadores',prev:'Anterior',next:'Siguiente',page:'Página',of:'de',left:'Izquierdo',right:'Derecho'},
  fr:{one:'joueur',many:'joueurs',loading:'Chargement des joueurs…',empty:'Aucun joueur disponible',error:'Impossible de charger les joueurs',prev:'Précédent',next:'Suivant',page:'Page',of:'sur',left:'Gauche',right:'Droit'}
 };
 function init(){
  const table=document.querySelector('.app-players-table');
  if(!table||!table.tBodies.length)return;
  const body=table.tBodies[0],scroll=table.closest('.app-players-table-scroll'),countNode=document.querySelector('[data-players-count]');
  if(!scroll)return;
  const pager=document.createElement('nav');
  pager.className='app-players-pagination';pager.setAttribute('aria-label','Players pages');pager.hidden=true;
  const previous=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
  previous.type='button';next.type='button';previous.className='app-players-page-button';next.className='app-players-page-button';
  counter.className='app-players-page-count';counter.setAttribute('aria-live','polite');
  pager.append(previous,counter,next);scroll.after(pager);
  let ticket=0,current=null,lastCount=null;
  const language=()=>labels[document.documentElement.lang]||labels.en;
  const renderCount=count=>{
   if(!countNode)return;
   const t=language();
   countNode.textContent=new Intl.NumberFormat(document.documentElement.lang||'en').format(count)+' '+(count===1?t.one:t.many);
  };
  const cell=(row,value)=>{const td=document.createElement('td');td.textContent=value;row.append(td);return td};
  function message(value){
   const tr=document.createElement('tr');tr.className='app-players-empty-row';
   const td=document.createElement('td');td.colSpan=6;
   const strong=document.createElement('strong');strong.setAttribute('role','status');strong.textContent=value;
   td.append(strong);tr.append(td);body.replaceChildren(tr);
   pager.hidden=true;
  }
  function paint(data){
   const t=language();
   lastCount=data.count;renderCount(lastCount);
   if(!data.players.length){message(t.empty);return}
   const fragment=document.createDocumentFragment();
   for(const player of data.players){
    const tr=document.createElement('tr');
    const flagCell=document.createElement('td');
    const flag=Object.hasOwn(flags,player.nationality)?flags[player.nationality]:null;
    if(flag){
     const image=document.createElement('img');
     image.className='app-players-nationality-flag';
     image.width=24;image.height=18;image.alt=player.nationality;
     image.src='/assets/flags/'+flag+'.svg';
     flagCell.append(image);
    }else{flagCell.textContent=player.nationality||''}
    tr.append(flagCell);
    cell(tr,player.display_name||'—');
    cell(tr,Number.isSafeInteger(player.age)?String(player.age):'—');
    const positions=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean);
    cell(tr,positions.join(', ')||'—');
    cell(tr,Number.isSafeInteger(player.height_cm)?String(player.height_cm)+' cm':'—');
    cell(tr,player.preferred_foot==='left'?t.left:player.preferred_foot==='right'?t.right:'—');
    fragment.append(tr);
   }
   body.replaceChildren(fragment);
   previous.textContent=t.prev;next.textContent=t.next;
   counter.textContent=t.page+' '+data.page+' '+t.of+' '+data.totalPages;
   previous.disabled=data.page<=1;next.disabled=data.page>=data.totalPages;
   pager.hidden=data.totalPages<=1;
  }
  async function load(page){
   const seq=++ticket;
   current=null;message(language().loading);
   try{
    const response=await fetch('/api/players/page/'+page,{method:'GET',credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('http_'+response.status);
    const data=await response.json();
    if(!data||!Array.isArray(data.players)||!Number.isSafeInteger(data.count)||
       data.page!==page||!Number.isSafeInteger(data.totalPages)||data.totalPages<1)
      throw new Error('invalid_players_response');
    if(seq!==ticket)return;
    current=data;paint(current);
   }catch{
    if(seq===ticket){message(language().error);if(lastCount===null&&countNode)countNode.replaceChildren();}
   }
  }
  previous.addEventListener('click',()=>{if(current&&current.page>1)load(current.page-1)});
  next.addEventListener('click',()=>{if(current&&current.page<current.totalPages)load(current.page+1)});
  new MutationObserver(()=>{if(current)paint(current);else{if(lastCount!==null)renderCount(lastCount);message(language().loading)}})
   .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load(1);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
