/* Public Players directory: approved public D1 projection and stable two-view layout. */
(() => {
 'use strict';
 const flags=Object.freeze({
  ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',
  COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',
  DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',
  TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',
  GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'
 });

 const groups=Object.freeze({
  technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],
  mental:['vision','positioning','decisions','composure'],
  physical:['speed','strength','stamina','agility'],
  goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']
 });
 // Skill labels preserve the approved original public JSON order, independently
 // of the order in which the user switches attribute groups.
 const allAttrs=['speed','strength','stamina','agility','passing','technique','dribbling','shooting','crossing','tackling','marking','heading','vision','positioning','decisions','composure','gk_reflexes','gk_handling','gk_positioning','gk_aerial'];
 const attrLabels={
  en:'Speed|Strength|Stamina|Agility|Passing|Technique|Dribbling|Shooting|Crossing|Tackling|Marking|Heading|Vision|Positioning|Decisions|Composure|Reflexes|Handling|GK positioning|Aerial',
  it:'Velocità|Forza|Resistenza|Agilità|Passaggio|Tecnica|Dribbling|Tiro|Cross|Contrasto|Marcatura|Colpo di testa|Visione|Posizionamento|Decisioni|Freddezza|Riflessi|Presa|Posizionamento portiere|Uscite alte',
  de:'Tempo|Stärke|Ausdauer|Beweglichkeit|Passen|Technik|Dribbling|Schuss|Flanken|Zweikampf|Deckung|Kopfball|Übersicht|Stellungsspiel|Entscheidungen|Ruhe|Reflexe|Fangen|Torwartstellung|Luftraum',
  es:'Velocidad|Fuerza|Resistencia|Agilidad|Pases|Técnica|Regate|Tiro|Centros|Entradas|Marcaje|Cabeceo|Visión|Colocación|Decisiones|Serenidad|Reflejos|Blocaje|Posición de portero|Juego aéreo',
  fr:'Vitesse|Force|Endurance|Agilité|Passes|Technique|Dribble|Tir|Centres|Tacles|Marquage|Jeu de tête|Vision|Placement|Décisions|Sang-froid|Réflexes|Prise de balle|Placement gardien|Jeu aérien'
 };
 const labels={
  en:{one:'player',many:'players',loading:'Loading players…',empty:'No players available',error:'Unable to load players',prev:'Previous',next:'Next',page:'Page',of:'of',left:'Left',right:'Right',tabs:['Overview','Attributes'],groups:['Technical','Mental','Physical','Goalkeeper'],nationality:'Nationality',columns:['Player','Age','Positions','Height','Foot']},
  it:{one:'giocatore',many:'giocatori',loading:'Caricamento giocatori…',empty:'Nessun giocatore disponibile',error:'Impossibile caricare i giocatori',prev:'Precedente',next:'Successiva',page:'Pagina',of:'di',left:'Sinistro',right:'Destro',tabs:['Panoramica','Attributi'],groups:['Tecnici','Mentali','Fisici','Portiere'],nationality:'Nazionalità',columns:['Giocatore','Età','Posizioni','Altezza','Piede']},
  de:{one:'Spieler',many:'Spieler',loading:'Spieler werden geladen…',empty:'Keine Spieler verfügbar',error:'Spieler konnten nicht geladen werden',prev:'Zurück',next:'Weiter',page:'Seite',of:'von',left:'Links',right:'Rechts',tabs:['Übersicht','Attribute'],groups:['Technisch','Mental','Physisch','Torwart'],nationality:'Nationalität',columns:['Spieler','Alter','Positionen','Größe','Fuß']},
  es:{one:'jugador',many:'jugadores',loading:'Cargando jugadores…',empty:'No hay jugadores disponibles',error:'No se pudieron cargar los jugadores',prev:'Anterior',next:'Siguiente',page:'Página',of:'de',left:'Izquierdo',right:'Derecho',tabs:['Resumen','Atributos'],groups:['Técnicos','Mentales','Físicos','Portero'],nationality:'Nacionalidad',columns:['Jugador','Edad','Posiciones','Altura','Pie']},
  fr:{one:'joueur',many:'joueurs',loading:'Chargement des joueurs…',empty:'Aucun joueur disponible',error:'Impossible de charger les joueurs',prev:'Précédent',next:'Suivant',page:'Page',of:'sur',left:'Gauche',right:'Droit',tabs:['Vue d’ensemble','Attributs'],groups:['Techniques','Mentaux','Physiques','Gardien'],nationality:'Nationalité',columns:['Joueur','Âge','Postes','Taille','Pied']}
 };
 const language=()=>document.documentElement.lang.toLowerCase().slice(0,2);
 const locale=()=>labels[language()]||labels.en;
 const attributeName=key=>(attrLabels[language()]||attrLabels.en).split('|')[allAttrs.indexOf(key)]||key;
 function parseLocation(){
  const p=new URLSearchParams(location.search);
  const rawPage=Number(p.get('page')||'1');
  return {
   view:p.get('view')==='attributes'?'attributes':'overview',
   group:Object.hasOwn(groups,p.get('group'))?p.get('group'):'technical',
   page:Number.isSafeInteger(rawPage)&&rawPage>=1&&rawPage<=9999?rawPage:1
  };
 }
 function init(){
  const table=document.querySelector('.app-players-table'),scroll=table?.closest('.app-players-table-scroll');
  if(!table||!table.tBodies.length||!scroll)return;
  const body=table.tBodies[0],countNode=document.querySelector('[data-players-count]');
  const tabs=[...document.querySelectorAll('.app-players-tabs [data-players-view]')],groupTabs=[...document.querySelectorAll('.app-players-groups [data-players-group]')];
  const pager=document.createElement('nav');pager.className='app-players-pagination';pager.setAttribute('aria-label','Players pages');
  const previous=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
  previous.type='button';next.type='button';previous.className='app-players-page-button';next.className='app-players-page-button';
  counter.className='app-players-page-count';counter.setAttribute('aria-live','polite');pager.append(previous,counter,next);scroll.after(pager);
  let state=parseLocation(),ticket=0,current=null,lastCount=null,status='loading';
  const cols=()=>state.view==='attributes'?2+groups[state.group].length:6;
  const cell=(tr,value)=>{const td=document.createElement('td');td.textContent=value;tr.append(td);return td};
  function renderCount(count){
   if(!countNode)return;
   const t=locale();
   countNode.textContent=new Intl.NumberFormat(language()||'en').format(count)+' '+(count===1?t.one:t.many);
  }
  function syncUrl(mode='pushState'){
   const url=new URL(location.href);
   for(const name of ['view','group','nationality','position','page'])url.searchParams.delete(name);
   if(state.view!=='overview')url.searchParams.set('view',state.view);
   if(state.view==='attributes'&&state.group!=='technical')url.searchParams.set('group',state.group);
   if(state.page>1)url.searchParams.set('page',String(state.page));
   if(url.pathname+url.search+url.hash!==location.pathname+location.search+location.hash)
    history[mode](history.state,'',url.pathname+url.search+url.hash);
  }
  function syncControls(){
   const t=locale();
   document.documentElement.dataset.playersView=state.view;
   document.documentElement.dataset.playersGroup=state.group;
   tabs.forEach((tab,i)=>{const active=tab.dataset.playersView===state.view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.textContent=t.tabs[i]});
   groupTabs.forEach((tab,i)=>{const active=tab.dataset.playersGroup===state.group;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.textContent=t.groups[i]});
  }
  function renderHead(){
   const t=locale(),row=document.createElement('tr');
   const th=(value,isFlag=false)=>{const node=document.createElement('th');node.scope='col';if(isFlag){node.className='app-players-flag-col';const a=document.createElement('span');a.className='sr-only';a.textContent=t.nationality;node.append(a)}else node.textContent=value;row.append(node)};
   th('',true);th(t.columns[0]);
   if(state.view==='overview')for(const name of t.columns.slice(1))th(name);
   else for(const key of groups[state.group])th(attributeName(key));
   table.tHead.replaceChildren(row);
   table.dataset.playersTableMode=state.view;
  }
  function message(value){
   const tr=document.createElement('tr');tr.className='app-players-empty-row';
   const td=document.createElement('td');td.colSpan=cols();
   const strong=document.createElement('strong');strong.setAttribute('role','status');strong.textContent=value;
   td.append(strong);tr.append(td);body.replaceChildren(tr);pager.hidden=true;
  }
  function flagCell(tr,player){
   const td=document.createElement('td'),flag=Object.hasOwn(flags,player.nationality)?flags[player.nationality]:null;
   if(flag){const image=document.createElement('img');image.className='app-players-nationality-flag';image.width=24;image.height=18;image.alt=player.nationality;image.src='/assets/flags/'+flag+'.svg';td.append(image)}
   else td.textContent=player.nationality||'';
   tr.append(td);
  }
  function paint(data){
   renderHead();
   const t=locale();
   if(!data){message(t[status]);return}
   lastCount=data.count;renderCount(lastCount);
   if(!data.players.length){message(t.empty);scroll.setAttribute('aria-busy','false');return}
   const fragment=document.createDocumentFragment();
   for(const player of data.players){
    const tr=document.createElement('tr');flagCell(tr,player);cell(tr,player.display_name||'—');
    if(state.view==='overview'){
     cell(tr,Number.isSafeInteger(player.age)?String(player.age):'—');
     const positionsShown=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean);
     cell(tr,positionsShown.join(', ')||'—');
     cell(tr,Number.isSafeInteger(player.height_cm)?String(player.height_cm)+' cm':'—');
     cell(tr,player.preferred_foot==='left'?t.left:player.preferred_foot==='right'?t.right:'—');
    }else for(const key of groups[state.group])cell(tr,Number.isSafeInteger(player.attributes?.[key])?String(player.attributes[key]):'—');
    fragment.append(tr);
   }
   body.replaceChildren(fragment);
   previous.textContent=t.prev;next.textContent=t.next;
   counter.textContent=t.page+' '+data.page+' '+t.of+' '+data.totalPages;
   previous.disabled=data.page<=1;next.disabled=data.page>=data.totalPages;
   pager.hidden=data.totalPages<=1;scroll.setAttribute('aria-busy','false');
  }
  function refresh(){syncControls();paint(current)}
  async function load(page){
   const seq=++ticket;state.page=page;current=null;status='loading';
   scroll.setAttribute('aria-busy','true');renderHead();message(locale().loading);
   try{
    const response=await fetch('/api/players/page/'+page,{method:'GET',credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('http_'+response.status);
    const data=await response.json();
    if(!data||!Array.isArray(data.players)||!Number.isSafeInteger(data.count)||data.page!==page||!Number.isSafeInteger(data.totalPages)||data.totalPages<1)
     throw new Error('invalid_players_response');
    if(seq!==ticket)return;
    current=data;status='ready';paint(data);
   }catch{
    if(seq===ticket){status='error';message(locale().error);scroll.setAttribute('aria-busy','false');if(lastCount===null&&countNode)countNode.replaceChildren()}
   }
  }
  function changeView(view){
   if(state.view===view)return;
   state.view=view;syncUrl();refresh();
  }
  function changeGroup(group){
   if(state.group===group)return;
   state.group=group;syncUrl();refresh();
  }
  tabs.forEach(tab=>tab.addEventListener('click',event=>{event.preventDefault();changeView(tab.dataset.playersView)}));
  groupTabs.forEach(tab=>tab.addEventListener('click',()=>changeGroup(tab.dataset.playersGroup)));
  function keyboardTab(event,nodes,change,key){
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const current=nodes.indexOf(event.target);
   const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(current+(event.key==='ArrowRight'?1:-1)+nodes.length)%nodes.length;
   nodes[next].focus();change(nodes[next].dataset[key]);
  }
  const tabsBar=document.querySelector('.app-players-tabs'),groupBar=document.querySelector('.app-players-groups');
  tabsBar?.addEventListener('keydown',event=>keyboardTab(event,tabs,changeView,'playersView'));
  groupBar?.addEventListener('keydown',event=>keyboardTab(event,groupTabs,changeGroup,'playersGroup'));
  previous.addEventListener('click',()=>{if(current&&current.page>1){state.page=current.page-1;syncUrl();load(state.page)}});
  next.addEventListener('click',()=>{if(current&&current.page<current.totalPages){state.page=current.page+1;syncUrl();load(state.page)}});
  window.addEventListener('popstate',()=>{
   const next=parseLocation(),changed=next.page!==state.page;
   state=next;syncControls();
   if(changed)load(state.page);else paint(current);
  });
  new MutationObserver(()=>{syncControls();if(current)paint(current);else{renderHead();message(locale()[status]);if(lastCount!==null)renderCount(lastCount)}})
   .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  syncControls();load(state.page);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
