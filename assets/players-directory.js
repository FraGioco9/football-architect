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


 const filterKeys=['nationality','position','ageMin','ageMax','foot'];
 const positions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
 const ageValue=value=>/^(?:0|[1-9][0-9]{0,2})$/.test(value||'')&&Number(value)<=120?value:'';
 const filterLabels={
  en:{button:'Filters',active:'active',description:'Select filters and press Apply to update the list.',close:'Close filters',apply:'Apply filters',ageRange:'Age range',title:'Player filters',names:['Nationality','Position','Min age','Max age','Preferred foot'],all:'All',reset:'Reset filters',noMatches:'No matching players',range:'Minimum age cannot exceed maximum age'},
  it:{button:'Filtri',active:'attivi',description:'Seleziona i filtri e premi Applica per aggiornare l\'elenco.',close:'Chiudi filtri',apply:'Applica filtri',ageRange:'Intervallo di età',title:'Filtri giocatori',names:['Nazionalità','Posizione','Età min.','Età max.','Piede preferito'],all:'Tutti',reset:'Reimposta filtri',noMatches:'Nessun giocatore corrispondente',range:"L'età minima non può superare quella massima"},
  de:{button:'Filter',active:'aktiv',description:'Wähle Filter aus und klicke auf Anwenden, um die Liste zu aktualisieren.',close:'Filter schließen',apply:'Filter anwenden',ageRange:'Altersspanne',title:'Spielerfilter',names:['Nationalität','Position','Mindestalter','Höchstalter','Starker Fuß'],all:'Alle',reset:'Filter zurücksetzen',noMatches:'Keine passenden Spieler',range:'Das Mindestalter darf nicht über dem Höchstalter liegen'},
  es:{button:'Filtros',active:'activos',description:'Selecciona los filtros y pulsa Aplicar para actualizar la lista.',close:'Cerrar filtros',apply:'Aplicar filtros',ageRange:'Rango de edad',title:'Filtros de jugadores',names:['Nacionalidad','Posición','Edad mín.','Edad máx.','Pie preferido'],all:'Todos',reset:'Restablecer filtros',noMatches:'No hay jugadores que coincidan',range:'La edad mínima no puede superar la máxima'},
  fr:{button:'Filtres',active:'actifs',description:'Sélectionnez les filtres et appuyez sur Appliquer pour actualiser la liste.',close:'Fermer les filtres',apply:'Appliquer les filtres',ageRange:'Tranche d’âge',title:'Filtres des joueurs',names:['Nationalité','Poste','Âge min.','Âge max.','Pied préféré'],all:'Tous',reset:'Réinitialiser les filtres',noMatches:'Aucun joueur correspondant',range:'L’âge minimum ne peut pas dépasser l’âge maximum'}
 };
 const homeNames={en:['England','Scotland','Wales'],it:['Inghilterra','Scozia','Galles'],de:['England','Schottland','Wales'],es:['Inglaterra','Escocia','Gales'],fr:['Angleterre','Écosse','Pays de Galles']};
 const filterLocale=()=>filterLabels[language()]||filterLabels.en;
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
  en:'Speed|Strength|Stamina|Agility|Passing|Technique|Dribbling|Shooting|Crossing|Tackling|Marking|Heading|Vision|Positioning|Decisions|Composure|Reflexes|Handling|Positioning|Aerial',
  it:'Velocità|Forza|Resistenza|Agilità|Passaggio|Tecnica|Dribbling|Tiro|Cross|Contrasto|Marcatura|Colpo di testa|Visione|Posizionamento|Decisioni|Freddezza|Riflessi|Presa|Posizionamento|Uscite alte',
  de:'Tempo|Stärke|Ausdauer|Beweglichkeit|Passen|Technik|Dribbling|Schuss|Flanken|Zweikampf|Deckung|Kopfball|Übersicht|Stellungsspiel|Entscheidungen|Ruhe|Reflexe|Fangen|Stellungsspiel|Luftraum',
  es:'Velocidad|Fuerza|Resistencia|Agilidad|Pases|Técnica|Regate|Tiro|Centros|Entradas|Marcaje|Cabeceo|Visión|Colocación|Decisiones|Serenidad|Reflejos|Blocaje|Colocación|Juego aéreo',
  fr:'Vitesse|Force|Endurance|Agilité|Passes|Technique|Dribble|Tir|Centres|Tacles|Marquage|Jeu de tête|Vision|Placement|Décisions|Sang-froid|Réflexes|Prise de balle|Placement|Jeu aérien'
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
  const filters={
   nationality:Object.hasOwn(flags,p.get('nationality'))?p.get('nationality'):'',
   position:positions.has(p.get('position'))?p.get('position'):'',
   ageMin:ageValue(p.get('ageMin')),
   ageMax:ageValue(p.get('ageMax')),
   foot:['left','right'].includes(p.get('foot'))?p.get('foot'):''
  };
  if(filters.ageMin&&filters.ageMax&&Number(filters.ageMin)>Number(filters.ageMax)){filters.ageMin='';filters.ageMax='';}
  return {
   view:p.get('view')==='attributes'?'attributes':'overview',
   group:Object.hasOwn(groups,p.get('group'))?p.get('group'):'technical',
   page:Number.isSafeInteger(rawPage)&&rawPage>=1&&rawPage<=9999?rawPage:1,
   filters
  };
 }
 function init(){
  const table=document.querySelector('.app-players-table'),scroll=table?.closest('.app-players-table-scroll');
  if(!table||!table.tBodies.length||!scroll)return;
  const body=table.tBodies[0],countNode=document.querySelector('[data-players-count]');
  const filterPanel=document.querySelector('.app-players-filters');
  const filterFields=[...document.querySelectorAll('.app-players-filters [data-players-filter]')];
  const dropdowns=[...document.querySelectorAll('.app-players-filter-select')];
  const reset=document.querySelector('[data-players-reset]');
  const filterTrigger=document.querySelector('[data-players-filter-open]');
  const filterTriggerLabel=document.querySelector('[data-players-filter-trigger-label]');
  const filterActive=document.querySelector('[data-players-filter-active]');
  const filterDialog=document.querySelector('#players-filter-dialog');
  const filterForm=document.querySelector('[data-players-filter-form]');
  const filterClose=document.querySelector('[data-players-filter-close]');
  const filterApply=document.querySelector('[data-players-apply]');
  const filterTitle=document.querySelector('[data-players-filter-title]');
  const filterDescription=document.querySelector('[data-players-filter-description]');
  const filterAgeRange=document.querySelector('[data-players-age-range]');
  const tabs=[...document.querySelectorAll('.app-players-tabs [data-players-view]')],groupTabs=[...document.querySelectorAll('.app-players-groups [data-players-group]')];
  const pager=document.createElement('nav');pager.className='app-players-pagination';pager.setAttribute('aria-label','Players pages');
  const previous=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
  previous.type='button';next.type='button';previous.className='app-players-page-button';next.className='app-players-page-button';
  counter.className='app-players-page-count';counter.setAttribute('aria-live','polite');pager.append(previous,counter,next);scroll.after(pager);
  let state=parseLocation(),ticket=0,current=null,lastCount=null,status='loading';
  const cols=()=>state.view==='attributes'?3+groups[state.group].length:6;
  const cell=(tr,value)=>{const td=document.createElement('td');td.textContent=value;tr.append(td);return td};
  function renderCount(count){
   if(!countNode)return;
   const t=locale();
   countNode.textContent=new Intl.NumberFormat(language()||'en').format(count)+' '+(count===1?t.one:t.many);
  }
  function filterSignature(filters){return filterKeys.map(key=>filters?.[key]||'').join('|')}
  function syncUrl(mode='pushState'){
   const url=new URL(location.href);
   for(const name of ['view','group','page',...filterKeys])url.searchParams.delete(name);
   url.searchParams.set('view',state.view);
   if(state.view==='attributes')url.searchParams.set('group',state.group);
   for(const key of filterKeys)if(state.filters?.[key])url.searchParams.set(key,state.filters[key]);
   if(state.page>1)url.searchParams.set('page',String(state.page));
   if(url.pathname+url.search+url.hash!==location.pathname+location.search+location.hash)
    history[mode](history.state,'',url.pathname+url.search+url.hash);
  }
  function syncDropdown(field){
   const wrapper=field.closest('.app-players-filter-select');
   if(!wrapper)return;
   const caption=wrapper.querySelector('[data-players-filter-value]');
   if(caption)caption.textContent=field.selectedOptions[0]?.textContent||'';
   for(const option of wrapper.querySelectorAll('[data-players-filter-option]')){
    const selected=option.dataset.playersFilterOption===field.value;
    option.setAttribute('aria-selected',String(selected));
    const native=[...field.options].find(item=>item.value===option.dataset.playersFilterOption);
    if(native)option.textContent=native.textContent;
   }
  }
  function syncFilterControls(){
   const t=filterLocale(),main=locale();
   filterPanel?.setAttribute('aria-label',t.title);
   if(filterTitle)filterTitle.textContent=t.title;
   if(filterDescription)filterDescription.textContent=t.description;
   filterClose?.setAttribute('aria-label',t.close);
   filterAgeRange?.setAttribute('aria-label',t.ageRange);
   if(filterApply)filterApply.textContent=t.apply;
   if(filterTriggerLabel)filterTriggerLabel.textContent=t.button;
   const selectedCount=filterKeys.filter(key=>state.filters?.[key]).length;
   if(filterActive){filterActive.hidden=selectedCount===0;filterActive.textContent=selectedCount?String(selectedCount):'';}
   filterTrigger?.setAttribute('aria-label',t.button+(selectedCount?': '+selectedCount+' '+t.active:''));
   let countries;
   try{countries=new Intl.DisplayNames([language()||'en'],{type:'region'});}catch{countries=null;}
   for(const field of filterFields){
    const key=field.dataset.playersFilter;
    const selected=state.filters?.[key]||'';
    if(field.value!==selected)field.value=selected;
    const label=field.closest('.app-players-filter-control')?.querySelector('[data-players-filter-label]');
    if(label)label.textContent=t.names[filterKeys.indexOf(key)];
    if(field.tagName==='SELECT'){
     field.options[0].textContent=t.all;
     if(key==='foot'){field.options[1].textContent=main.left;field.options[2].textContent=main.right;}
     if(key==='nationality')for(const option of [...field.options].slice(1)){
      const country=option.value,home=homeNames[language()]||homeNames.en;
      const name=country==='ENG'?home[0]:country==='SCO'?home[1]:country==='WAL'?home[2]:countries?.of(flags[country].slice(0,2).toUpperCase());
      option.textContent=name||country;
     }
    }else field.placeholder=t.all;
    if(field.tagName==='SELECT')syncDropdown(field);
   }
   if(reset){reset.textContent=t.reset;reset.disabled=false;}
  }
  function syncControls(){
   const t=locale();syncFilterControls();
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
   else {th(t.columns[2]);for(const key of groups[state.group])th(attributeName(key));}
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
   if(!data.players.length){message(data.count===0&&filterKeys.some(key=>state.filters?.[key])?filterLocale().noMatches:t.empty);scroll.setAttribute('aria-busy','false');return}
   const fragment=document.createDocumentFragment();
   for(const player of data.players){
    const tr=document.createElement('tr');flagCell(tr,player);cell(tr,player.display_name||'—');
    const positionsShown=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean);
    if(state.view==='overview'){
     cell(tr,Number.isSafeInteger(player.age)?String(player.age):'—');
     cell(tr,positionsShown.join(', ')||'—');
     cell(tr,Number.isSafeInteger(player.height_cm)?String(player.height_cm)+' cm':'—');
     cell(tr,player.preferred_foot==='left'?t.left:player.preferred_foot==='right'?t.right:'—');
    }else {
     cell(tr,positionsShown.join(', ')||'—');
     for(const key of groups[state.group])cell(tr,Number.isSafeInteger(player.attributes?.[key])?String(player.attributes[key]):'—');
    }
    fragment.append(tr);
   }
   body.replaceChildren(fragment);
   previous.textContent=t.prev;next.textContent=t.next;
   counter.textContent=t.page+' '+data.page+' '+t.of+' '+data.totalPages+' · '+new Intl.NumberFormat(language()||'en').format(data.count)+' '+(data.count===1?t.one:t.many);
   previous.disabled=data.page<=1;next.disabled=data.page>=data.totalPages;
   pager.hidden=data.totalPages<=1;scroll.setAttribute('aria-busy','false');
  }
  function refresh(){syncControls();paint(current)}
  async function load(page){
   const seq=++ticket;state.page=page;current=null;status='loading';
   if(countNode)countNode.replaceChildren(Object.assign(document.createElement('span'),{className:'app-players-count-skeleton'}));
   scroll.style.minHeight=Math.ceil(scroll.getBoundingClientRect().height)+'px';
   scroll.setAttribute('aria-busy','true');renderHead();message(locale().loading);
   const query=new URLSearchParams({page:String(page)});
   for(const key of filterKeys)if(state.filters?.[key])query.set(key,state.filters[key]);
   try{
    const response=await fetch('/api/players?'+query.toString(),{method:'GET',credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('http_'+response.status);
    const data=await response.json();
    if(!data||!Array.isArray(data.players)||!Number.isSafeInteger(data.count)||data.page!==page||!Number.isSafeInteger(data.totalPages)||data.totalPages<1)
     throw new Error('invalid_players_response');
    if(seq!==ticket)return;
    current=data;status='ready';paint(data);scroll.style.minHeight='';
   }catch{
    if(seq===ticket){status='error';message(locale().error);scroll.style.minHeight='';scroll.setAttribute('aria-busy','false');if(countNode)countNode.replaceChildren()}
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
  // Shared site combobox presentation (language-trigger / language-menu / language-option).
  // Keep focus on the trigger and expose the active option via aria-activedescendant.
  let openDropdown=null;
  const dropdownParts=wrapper=>({
   field:wrapper.querySelector('[data-players-filter]'),
   trigger:wrapper.querySelector('.language-trigger'),
   menu:wrapper.querySelector('.language-menu'),
   options:[...wrapper.querySelectorAll('[data-players-filter-option]')]
  });
  function highlightDropdown(wrapper,index){
   const {trigger,menu,options}=dropdownParts(wrapper);
   if(!options.length)return;
   const selected=(index+options.length)%options.length;
   options.forEach((option,i)=>{if(i===selected)option.dataset.active='true';else delete option.dataset.active});
   trigger.setAttribute('aria-activedescendant',options[selected].id);
   if(!menu.hidden)options[selected].scrollIntoView?.({block:'nearest'});
  }
  function closeDropdown(wrapper,restoreFocus=false){
   if(!wrapper)return;
   const {trigger,menu,options}=dropdownParts(wrapper);
   menu.hidden=true;
   trigger.setAttribute('aria-expanded','false');
   trigger.removeAttribute('aria-activedescendant');
   options.forEach(option=>delete option.dataset.active);
   if(openDropdown===wrapper)openDropdown=null;
   if(restoreFocus)trigger.focus({preventScroll:true});
  }
  function openDropdownMenu(wrapper){
   if(openDropdown&&openDropdown!==wrapper)closeDropdown(openDropdown);
   const {field,trigger,menu,options}=dropdownParts(wrapper);
   openDropdown=wrapper;menu.hidden=false;trigger.setAttribute('aria-expanded','true');
   const current=options.findIndex(option=>option.dataset.playersFilterOption===field.value);
   highlightDropdown(wrapper,Math.max(0,current));
  }
  function chooseDropdown(wrapper,index){
   const {field,options}=dropdownParts(wrapper);
   if(!options[index])return;
   field.value=options[index].dataset.playersFilterOption;
   syncDropdown(field);closeDropdown(wrapper,true);
  }
  for(const wrapper of dropdowns){
   const {trigger,menu,options}=dropdownParts(wrapper);
   trigger.addEventListener('click',()=>{
    if(menu.hidden)openDropdownMenu(wrapper);else closeDropdown(wrapper);
   });
   trigger.addEventListener('keydown',event=>{
    const k=event.key;
    if(k==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();closeDropdown(wrapper);return;}
    if(k==='Tab'){closeDropdown(wrapper);return;}
    if(!['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(k))return;
    event.preventDefault();
    if(menu.hidden){openDropdownMenu(wrapper);if(k==='Enter'||k===' ')return;}
    const active=options.findIndex(option=>option.id===trigger.getAttribute('aria-activedescendant'));
    if(k==='Enter'||k===' '){chooseDropdown(wrapper,Math.max(0,active));return;}
    const next=k==='Home'?0:k==='End'?options.length-1:active+(k==='ArrowUp'?-1:1);
    highlightDropdown(wrapper,next);
   });
   menu.addEventListener('click',event=>{
    const option=event.target.closest('[data-players-filter-option]');
    if(option&&menu.contains(option))chooseDropdown(wrapper,options.indexOf(option));
   });
  }
  filterDialog?.addEventListener('click',event=>{
   if(openDropdown&&!openDropdown.contains(event.target))closeDropdown(openDropdown);
  });
  function applyFilters(){
   const fields=Object.fromEntries(filterFields.map(field=>[field.dataset.playersFilter,field.value]));
   for(const field of filterFields){
    field.setCustomValidity('');
    if(!field.checkValidity()){field.reportValidity();return;}
   }
   // Native number fields can retain forms such as 05 or 2e1; normalize to the API's canonical decimal form.
   for(const key of ['ageMin','ageMax'])if(fields[key]!=='')fields[key]=String(Number(fields[key]));
   if(fields.ageMin&&fields.ageMax&&Number(fields.ageMin)>Number(fields.ageMax)){
    const field=filterFields.find(f=>f.dataset.playersFilter==='ageMax');
    field.setCustomValidity(filterLocale().range);field.reportValidity();return;
   }
   const nextFilters=Object.fromEntries(filterKeys.map(key=>[key,fields[key]||'']));
   if(filterSignature(nextFilters)===filterSignature(state.filters)){closeFilterDialog();return;}
   state.filters=nextFilters;state.page=1;syncUrl();syncControls();closeFilterDialog();load(1);
  }
  // Draft values remain inside the modal until Apply; never fetch on individual changes.
  for(const field of filterFields)field.addEventListener('input',()=>field.setCustomValidity(''));
  filterForm?.addEventListener('submit',event=>{event.preventDefault();applyFilters()});
  reset?.addEventListener('click',()=>{
   const changed=filterKeys.some(key=>state.filters?.[key])||state.page!==1;
   state.filters=Object.fromEntries(filterKeys.map(key=>[key,'']));
   for(const field of filterFields)field.setCustomValidity('');
   state.page=1;syncUrl();syncControls();closeFilterDialog();
   if(changed)load(1);
  });
  let previousOverflow='',closeFallback=null;
  function syncDrawerTop(){
   const header=document.querySelector('.fa-shell-topbar');
   const bottom=Math.max(0,Math.ceil(header?.getBoundingClientRect().bottom??60));
   document.documentElement.style.setProperty('--players-filter-top',bottom+'px');
  }
  function finishFilterClose(){
   if(closeFallback!==null){clearTimeout(closeFallback);closeFallback=null;}
   if(filterDialog?.open)closeFilterDialog();
  }
  function closeFilterDialog(){
   if(!filterDialog?.open||filterDialog.classList.contains('is-closing'))return;
   closeDropdown(openDropdown);
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finishFilterClose();return;}
   filterDialog.classList.add('is-closing');
   // Safari/Chromium: event drives closure; fallback handles throttled animations.
   closeFallback=setTimeout(finishFilterClose,280);
  }
  filterTrigger?.addEventListener('click',()=>{
   if(!filterDialog||filterDialog.open)return;
   syncFilterControls(); // Reopen from applied state; discard unsubmitted draft edits.
   syncDrawerTop();
   previousOverflow=document.documentElement.style.overflow;
   filterDialog.classList.remove('is-closing');
   filterDialog.showModal(); // Native focus containment; drawer begins below the fixed header.
   document.documentElement.style.overflow='hidden';
   filterTrigger.setAttribute('aria-expanded','true');
   dropdowns[0]?.querySelector('.language-trigger')?.focus({preventScroll:true});
  });
  filterClose?.addEventListener('click',closeFilterDialog);
  filterDialog?.addEventListener('cancel',event=>{event.preventDefault();closeFilterDialog()});
  filterDialog?.addEventListener('animationend',event=>{
   if(event.target===filterDialog&&event.animationName==='players-filter-slide-out')finishFilterClose();
  });
  filterDialog?.addEventListener('click',event=>{
   if(event.target!==filterDialog)return;
   const bounds=filterDialog.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeFilterDialog();
  });
  filterDialog?.addEventListener('close',()=>{
   if(closeFallback!==null){clearTimeout(closeFallback);closeFallback=null;}
   filterDialog.classList.remove('is-closing');
   closeDropdown(openDropdown);
   document.documentElement.style.overflow=previousOverflow;
   filterTrigger?.setAttribute('aria-expanded','false');
   for(const field of filterFields)field.setCustomValidity('');
   filterTrigger?.focus({preventScroll:true});
  });
  window.addEventListener('resize',()=>{if(filterDialog?.open)syncDrawerTop()});
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
   if(filterDialog?.open)filterDialog.close();
   const next=parseLocation(),changed=next.page!==state.page||filterSignature(next.filters)!==filterSignature(state.filters);
   state=next;syncControls();syncUrl('replaceState');
   if(changed)load(state.page);else paint(current);
  });
  new MutationObserver(()=>{syncControls();if(current)paint(current);else{renderHead();message(locale()[status]);if(status==='loading'&&countNode)countNode.replaceChildren(Object.assign(document.createElement('span'),{className:'app-players-count-skeleton'}));}})
   .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  syncControls();syncUrl('replaceState');load(state.page);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
