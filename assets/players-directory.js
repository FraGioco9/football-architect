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


 const filterKeys=['nationality','nationalityScope','position','positionScope','ageMin','ageMax','heightMin','heightMax','foot'];
 const selectedCodes=(value,allowed)=>{
  const codes=(value||'').split(',').filter(Boolean);
  return codes.length&&new Set(codes).size===codes.length&&codes.every(code=>allowed.has(code))?codes.sort().join(','):'';
 };
 const integerValue=(value,min,max)=>/^(?:0|[1-9][0-9]{0,2})$/.test(value||'')&&Number(value)>=min&&Number(value)<=max?value:'';
 const positions=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
 const ageValue=value=>/^(?:0|[1-9][0-9]{0,2})$/.test(value||'')&&Number(value)<=120?value:'';
 const filterLabels={
  en:{sections:["Nationality","Positions","Age","Height","Preferred foot"],multi:"Select multiple",picked:"selected",scopeN:"Include secondary nationality",scopeP:"Include secondary positions",search:"Search…",heightRange:"Height range",heights:["Min height (cm)","Max height (cm)"],stepMinus:"Decrease",stepPlus:"Increase",button:'Filters',active:'active',description:'Select filters and press Apply to update the list.',close:'Close filters',apply:'Apply filters',ageRange:'Age range',title:'Player filters',names:['Nationality','Position','Min age','Max age','Preferred foot'],all:'All',reset:'Reset filters',noMatches:'No matching players',range:'Minimum age cannot exceed maximum age'},
  it:{sections:["Nazionalità","Posizioni","Età","Altezza","Piede preferito"],multi:"Selezione multipla",picked:"selezionati",scopeN:"Includi nazionalità secondaria",scopeP:"Includi posizioni secondarie",search:"Cerca…",heightRange:"Intervallo di altezza",heights:["Altezza min. (cm)","Altezza max. (cm)"],stepMinus:"Diminuisci",stepPlus:"Aumenta",button:'Filtri',active:'attivi',description:'Seleziona i filtri e premi Applica per aggiornare l\'elenco.',close:'Chiudi filtri',apply:'Applica filtri',ageRange:'Intervallo di età',title:'Filtri giocatori',names:['Nazionalità','Posizione','Età min.','Età max.','Piede preferito'],all:'Tutti',reset:'Reimposta filtri',noMatches:'Nessun giocatore corrispondente',range:"L'età minima non può superare quella massima"},
  de:{sections:["Nationalität","Positionen","Alter","Größe","Starker Fuß"],multi:"Mehrfachauswahl",picked:"ausgewählt",scopeN:"Auch zweite Nationalität",scopeP:"Auch Nebenpositionen",search:"Suchen…",heightRange:"Größenbereich",heights:["Mindestgröße (cm)","Höchstgröße (cm)"],stepMinus:"Verringern",stepPlus:"Erhöhen",button:'Filter',active:'aktiv',description:'Wähle Filter aus und klicke auf Anwenden, um die Liste zu aktualisieren.',close:'Filter schließen',apply:'Filter anwenden',ageRange:'Altersspanne',title:'Spielerfilter',names:['Nationalität','Position','Mindestalter','Höchstalter','Starker Fuß'],all:'Alle',reset:'Filter zurücksetzen',noMatches:'Keine passenden Spieler',range:'Das Mindestalter darf nicht über dem Höchstalter liegen'},
  es:{sections:["Nacionalidad","Posiciones","Edad","Altura","Pie preferido"],multi:"Selección múltiple",picked:"seleccionados",scopeN:"Incluir nacionalidad secundaria",scopeP:"Incluir posiciones secundarias",search:"Buscar…",heightRange:"Rango de altura",heights:["Altura mín. (cm)","Altura máx. (cm)"],stepMinus:"Reducir",stepPlus:"Aumentar",button:'Filtros',active:'activos',description:'Selecciona los filtros y pulsa Aplicar para actualizar la lista.',close:'Cerrar filtros',apply:'Aplicar filtros',ageRange:'Rango de edad',title:'Filtros de jugadores',names:['Nacionalidad','Posición','Edad mín.','Edad máx.','Pie preferido'],all:'Todos',reset:'Restablecer filtros',noMatches:'No hay jugadores que coincidan',range:'La edad mínima no puede superar la máxima'},
  fr:{sections:["Nationalité","Postes","Âge","Taille","Pied préféré"],multi:"Sélection multiple",picked:"sélectionnés",scopeN:"Inclure la nationalité secondaire",scopeP:"Inclure les postes secondaires",search:"Rechercher…",heightRange:"Plage de taille",heights:["Taille min. (cm)","Taille max. (cm)"],stepMinus:"Diminuer",stepPlus:"Augmenter",button:'Filtres',active:'actifs',description:'Sélectionnez les filtres et appuyez sur Appliquer pour actualiser la liste.',close:'Fermer les filtres',apply:'Appliquer les filtres',ageRange:'Tranche d’âge',title:'Filtres des joueurs',names:['Nationalité','Poste','Âge min.','Âge max.','Pied préféré'],all:'Tous',reset:'Réinitialiser les filtres',noMatches:'Aucun joueur correspondant',range:'L’âge minimum ne peut pas dépasser l’âge maximum'}
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
  const p=new URLSearchParams(location.search),rawPage=Number(p.get('page')||'1');
  const nationality=selectedCodes(p.get('nationality'),new Set(Object.keys(flags)));
  const position=selectedCodes(p.get('position'),positions);
  const filters={
   nationality,nationalityScope:nationality&&p.get('nationalityScope')==='any'?'any':'',
   position,positionScope:position&&p.get('positionScope')==='any'?'any':'',
   ageMin:integerValue(p.get('ageMin'),0,120),ageMax:integerValue(p.get('ageMax'),0,120),
   heightMin:integerValue(p.get('heightMin'),100,250),heightMax:integerValue(p.get('heightMax'),100,250),
   foot:['left','right'].includes(p.get('foot'))?p.get('foot'):''
  };
  for(const [lo,hi] of [['ageMin','ageMax'],['heightMin','heightMax']]){
   if(filters[lo]&&filters[hi]&&Number(filters[lo])>Number(filters[hi])){filters[lo]='';filters[hi]='';}
  }
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
  const filterSections=[...document.querySelectorAll('[data-players-filter-section]')];
  const scopeLabels=[...document.querySelectorAll('[data-players-scope-label]')];
  const stepButtons=[...document.querySelectorAll('[data-players-step]')];
  function selectedCountryName(country,countries){
   const home=homeNames[language()]||homeNames.en;
   return country==='ENG'?home[0]:country==='SCO'?home[1]:country==='WAL'?home[2]:countries?.of(flags[country].slice(0,2).toUpperCase())||country;
  }
  function syncDropdown(field){
   const wrapper=field.closest('.app-players-filter-select');
   if(!wrapper)return;
   const caption=wrapper.querySelector('[data-players-filter-value]'),t=filterLocale();
   const menuOptions=dropdownCache.get(wrapper)?.options||[...wrapper.querySelectorAll('[data-players-filter-option]')];
   if(field.classList.contains('app-players-filter-multi')){
    const values=new Set(field.value.split(',').filter(Boolean));
    if(caption)caption.textContent=values.size?values.size+' '+t.picked:t.all;
    for(const option of menuOptions)option.setAttribute('aria-selected',String(option.dataset.playersFilterOption?values.has(option.dataset.playersFilterOption):values.size===0));
   }else{
    if(caption)caption.textContent=field.selectedOptions[0]?.textContent||t.all;
    for(const option of menuOptions){
     const selected=option.dataset.playersFilterOption===field.value;
     option.setAttribute('aria-selected',String(selected));
     const native=[...field.options].find(item=>item.value===option.dataset.playersFilterOption);
     const name=option.querySelector('[data-players-filter-option-label]');
     if(native&&name)name.textContent=native.textContent;
    }
   }
  }
  function syncSectionCounts(){
   const t=filterLocale();
   const draft=drawerOpen()?Object.fromEntries(filterFields.map(field=>[field.dataset.playersFilter,field.type==='checkbox'?(field.checked?'any':''):field.value])):state.filters;
   const counts={
    nationality:draft.nationality?draft.nationality.split(',').length:0,
    position:draft.position?draft.position.split(',').length:0,
    age:Number(!!draft.ageMin)+Number(!!draft.ageMax),
    height:Number(!!draft.heightMin)+Number(!!draft.heightMax),
    foot:Number(!!draft.foot)
   };
   for(const section of filterSections){
    const key=section.dataset.playersFilterSection;
    const index=['nationality','position','age','height','foot'].indexOf(key);
    const label=section.querySelector('[data-players-section-label]');
    if(label)label.textContent=t.sections[index];
    const count=section.querySelector('[data-players-section-count]');
    if(count){count.hidden=!counts[key];count.textContent=counts[key]?String(counts[key]):'';}
   }
  }
  function syncFilterControls(){
   const t=filterLocale(),main=locale();
   filterPanel?.setAttribute('aria-label',t.title);
   if(filterTitle)filterTitle.textContent=t.title;
   filterClose?.setAttribute('aria-label',t.close);
   filterAgeRange?.setAttribute('aria-label',t.ageRange);
   document.querySelector('[data-players-height-range]')?.setAttribute('aria-label',t.heightRange);
   if(filterApply)filterApply.textContent=t.apply;
   if(filterTriggerLabel)filterTriggerLabel.textContent=t.button;
   const selectedCount=filterKeys.filter(key=>state.filters?.[key]).length;
   if(filterActive){filterActive.hidden=selectedCount===0;filterActive.textContent=selectedCount?String(selectedCount):'';}
   filterTrigger?.setAttribute('aria-label',t.button+(selectedCount?': '+selectedCount+' '+t.active:''));
   let countries;
   try{countries=new Intl.DisplayNames([language()||'en'],{type:'region'});}catch{countries=null;}
   const labelKeys=['nationality','position','ageMin','ageMax','heightMin','heightMax','foot'];
   const labels=[t.multi,t.multi,t.names[2],t.names[3],...t.heights,t.names[4]];
   for(const field of filterFields){
    const key=field.dataset.playersFilter,selected=state.filters?.[key]||'';
    if(field.type==='checkbox')field.checked=selected==='any';
    else if(field.value!==selected)field.value=selected;
    const label=field.closest('.app-players-filter-control')?.querySelector('[data-players-filter-label]');
    if(label)label.textContent=labels[labelKeys.indexOf(key)]||'';
    if(field.tagName==='SELECT'){
     field.options[0].textContent=t.all;
     if(key==='foot'){field.options[1].textContent=main.left;field.options[2].textContent=main.right;}
    }else if(field.type==='number')field.placeholder=t.all;
   }
   for(const wrapper of dropdowns){
    const key=wrapper.dataset.playersFilterSelect;
    const {field,menu,options}=dropdownCache.get(wrapper);
    if(key==='nationality')for(const option of options){
     const c=option.dataset.playersFilterOption;
     const label=option.querySelector('[data-players-filter-option-label]');
     if(label)label.textContent=c?selectedCountryName(c,countries):t.all;
    }
    if(key==='position'){
     const all=options.find(option=>option.dataset.playersFilterOption==='');
     if(all?.querySelector('[data-players-filter-option-label]'))all.querySelector('[data-players-filter-option-label]').textContent=t.all;
    }
    const search=menu.querySelector('[data-players-filter-search]');
    if(search){search.placeholder=t.search;search.setAttribute('aria-label',t.search+' '+t.sections[key==='nationality'?0:1]);}
    syncDropdown(field);
   }
   for(const scope of scopeLabels)scope.textContent=scope.dataset.playersScopeLabel==='nationality'?t.scopeN:t.scopeP;
   for(const button of stepButtons){
    const key=button.dataset.playersStep,field=filterFields.find(f=>f.dataset.playersFilter===key);
    const label=labels[labelKeys.indexOf(key)]||key;
    button.setAttribute('aria-label',(button.dataset.direction==='-1'?t.stepMinus:t.stepPlus)+' '+label);
   }
   syncSectionCounts();
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
  const dropdownCache=new Map(dropdowns.map(wrapper=>[wrapper,{
   field:wrapper.querySelector('[data-players-filter]'),
   trigger:wrapper.querySelector('.language-trigger'),
   menu:wrapper.querySelector('.language-menu'),
   options:[...wrapper.querySelectorAll('[data-players-filter-option]')]
  }]));
  const dropdownParts=wrapper=>dropdownCache.get(wrapper);
  // Keep the listbox inside the top-layer panel, outside its scrolling region.
  function positionDropdown(wrapper){
   if(!filterDialog||!wrapper)return;
   const {trigger,menu}=dropdownParts(wrapper);
   const panel=filterDialog.getBoundingClientRect(),rect=trigger.getBoundingClientRect();
   const below=Math.max(0,panel.bottom-rect.bottom-12);
   const above=Math.max(0,rect.top-panel.top-12);
   const up=below<175&&above>below;
   const room=up?above:below;
   const height=Math.max(44,Math.min(280,room));
   menu.style.left=Math.round(rect.left-panel.left)+'px';
   menu.style.width=Math.round(rect.width)+'px';
   menu.style.maxHeight=Math.floor(height)+'px';
   menu.style.top=Math.round((up?rect.top-panel.top-height-6:rect.bottom-panel.top+6))+'px';
  }
  function highlightDropdown(wrapper,index){
   const {trigger,menu,options}=dropdownParts(wrapper);
   if(!options.length)return;
   const visible=options.filter(option=>!option.hidden);
   if(!visible.length)return;
   const active=((index%visible.length)+visible.length)%visible.length;
   options.forEach(option=>{if(option===visible[active])option.dataset.active='true';else delete option.dataset.active});
   trigger.setAttribute('aria-activedescendant',visible[active].id);
   if(!menu.hidden)visible[active].scrollIntoView?.({block:'nearest'});
  }
  function closeDropdown(wrapper,restoreFocus=false){
   if(!wrapper)return;
   const {trigger,menu,options}=dropdownParts(wrapper);
   menu.hidden=true;
   trigger.setAttribute('aria-expanded','false');
   trigger.removeAttribute('aria-activedescendant');
   options.forEach(option=>delete option.dataset.active);
   if(menu.parentElement!==wrapper)wrapper.append(menu);
   for(const property of ['left','top','width','max-height'])menu.style.removeProperty(property);
   if(openDropdown===wrapper)openDropdown=null;
   if(restoreFocus)trigger.focus({preventScroll:true});
  }
  function openDropdownMenu(wrapper){
   if(openDropdown&&openDropdown!==wrapper)closeDropdown(openDropdown);
   const {field,trigger,menu,options}=dropdownParts(wrapper);
   const search=menu.querySelector('[data-players-filter-search]');
   if(search){search.value='';options.forEach(option=>option.hidden=false);}
   openDropdown=wrapper;
   filterDialog.append(menu);
   menu.hidden=false;
   positionDropdown(wrapper);
   trigger.setAttribute('aria-expanded','true');
   const primary=field.value.split(',')[0]||'';
   const current=options.filter(option=>!option.hidden).findIndex(option=>option.dataset.playersFilterOption===primary);
   highlightDropdown(wrapper,Math.max(0,current));
  }
  function chooseDropdown(wrapper,index){
   const {field,options}=dropdownParts(wrapper);
   if(!options[index]||options[index].hidden)return;
   const chosen=options[index].dataset.playersFilterOption;
   if(field.classList.contains('app-players-filter-multi')){
    const codes=new Set(field.value.split(',').filter(Boolean));
    if(!chosen)codes.clear();
    else if(codes.has(chosen))codes.delete(chosen);
    else codes.add(chosen);
    field.value=[...codes].sort().join(',');
    syncDropdown(field);
    syncSectionCounts();
    highlightDropdown(wrapper,Math.max(0,options.filter(o=>!o.hidden).indexOf(options[index])));
   }else{
    field.value=chosen;syncDropdown(field);syncSectionCounts();closeDropdown(wrapper,true);
   }
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
    const visible=options.filter(option=>!option.hidden);
    const active=visible.findIndex(option=>option.id===trigger.getAttribute('aria-activedescendant'));
    if(k==='Enter'||k===' '){chooseDropdown(wrapper,options.indexOf(visible[Math.max(0,active)]));return;}
    const next=k==='Home'?0:k==='End'?visible.length-1:active+(k==='ArrowUp'?-1:1);
    highlightDropdown(wrapper,next);
   });
   menu.addEventListener('click',event=>{
    const option=event.target.closest('[data-players-filter-option]');
    if(option&&menu.contains(option))chooseDropdown(wrapper,options.indexOf(option));
   });
   const search=menu.querySelector('[data-players-filter-search]');
   if(search){
    search.addEventListener('input',()=>{
     const needle=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
     options.forEach(option=>{
      const code=option.dataset.playersFilterOption,label=option.querySelector('[data-players-filter-option-label]')?.textContent||'';
      option.hidden=!!needle&&!!code&&!((label+' '+code).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));
     });
     highlightDropdown(wrapper,0);
    });
    search.addEventListener('keydown',event=>{
     if(event.key==='Enter'){event.preventDefault();const active=options.findIndex(option=>option.id===trigger.getAttribute('aria-activedescendant'));if(active>=0)chooseDropdown(wrapper,active);}
     if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const visible=options.filter(option=>!option.hidden);const active=visible.findIndex(option=>option.id===trigger.getAttribute('aria-activedescendant'));highlightDropdown(wrapper,active+(event.key==='ArrowDown'?1:-1));}
    });
   }
  }
  filterDialog?.addEventListener('click',event=>{
   if(!openDropdown)return;
   const {menu}=dropdownParts(openDropdown);
   if(!openDropdown.contains(event.target)&&!menu.contains(event.target))closeDropdown(openDropdown);
  });
  filterPanel?.addEventListener('scroll',()=>{
   // Do not let a detached listbox cover the scrolling controls.
   if(openDropdown)closeDropdown(openDropdown);
  },{passive:true});
  function applyFilters(){
   const fields=Object.fromEntries(filterFields.map(field=>[field.dataset.playersFilter,field.type==='checkbox'?(field.checked?'any':''):field.value]));
   for(const field of filterFields){
    field.setCustomValidity('');
    if(!field.checkValidity()){field.reportValidity();return;}
   }
   for(const key of ['ageMin','ageMax','heightMin','heightMax'])if(fields[key]!=='')fields[key]=String(Number(fields[key]));
   for(const [lo,hi] of [['ageMin','ageMax'],['heightMin','heightMax']]){
    if(fields[lo]&&fields[hi]&&Number(fields[lo])>Number(fields[hi])){
     const field=filterFields.find(f=>f.dataset.playersFilter===hi);
     field.setCustomValidity(filterLocale().range);field.reportValidity();return;
    }
   }
   for(const key of ['nationality','position']){
    if(!fields[key])fields[key+'Scope']='';
   }
   const nextFilters=Object.fromEntries(filterKeys.map(key=>[key,fields[key]||'']));
   if(filterSignature(nextFilters)===filterSignature(state.filters)){closeFilterDialog();return;}
   state.filters=nextFilters;state.page=1;syncUrl();syncControls();closeFilterDialog();load(1);
  }
  // Draft values remain inside the modal until Apply; never fetch on individual changes.
  for(const field of filterFields)field.addEventListener('input',()=>{field.setCustomValidity('');syncSectionCounts();});
  for(const button of stepButtons)button.addEventListener('click',()=>{
   const field=filterFields.find(f=>f.dataset.playersFilter===button.dataset.playersStep);
   if(!field)return;
   const delta=Number(button.dataset.direction),base=Number(field.dataset.stepBase);
   const min=Number(field.min),max=Number(field.max);
   const current=field.value===''?base:Number(field.value);
   field.value=String(Math.max(min,Math.min(max,current+delta)));
   field.setCustomValidity('');
   syncSectionCounts();
  });
  filterForm?.addEventListener('submit',event=>{event.preventDefault();applyFilters()});
  reset?.addEventListener('click',()=>{
   const changed=filterKeys.some(key=>state.filters?.[key])||state.page!==1;
   state.filters=Object.fromEntries(filterKeys.map(key=>[key,'']));
   for(const field of filterFields){field.setCustomValidity('');if(field.type==='checkbox')field.checked=false;}
   state.page=1;syncUrl();syncControls();closeFilterDialog();
   if(changed)load(1);
  });
  let closeFallback=null,restoreTriggerFocus=true;
  const drawerOpen=()=>!!filterDialog?.matches(':popover-open');
  function syncDrawerTop(){
   const header=document.querySelector('.fa-shell-topbar');
   const bottom=Math.max(0,Math.ceil(header?.getBoundingClientRect().bottom??60));
   filterDialog?.style.setProperty('--players-filter-top',bottom+'px');
  }
  function finishFilterClose(){
   if(closeFallback!==null){clearTimeout(closeFallback);closeFallback=null;}
   if(!filterDialog)return;
   closeDropdown(openDropdown);
   if(drawerOpen())filterDialog.hidePopover();
   filterDialog.classList.remove('is-closing');
   filterTrigger?.setAttribute('aria-expanded','false');
   for(const field of filterFields)field.setCustomValidity('');
   if(restoreTriggerFocus)filterTrigger?.focus({preventScroll:true});
  }
  function closeFilterDialog(restoreFocus=true){
   if(!drawerOpen()||filterDialog.classList.contains('is-closing'))return;
   restoreTriggerFocus=restoreFocus;
   closeDropdown(openDropdown);
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finishFilterClose();return;}
   filterDialog.classList.add('is-closing');
   closeFallback=setTimeout(finishFilterClose,280);
  }
  filterTrigger?.addEventListener('click',()=>{
   if(!filterDialog||drawerOpen())return;
   syncFilterControls(); // Discard any previously unsubmitted edits.
   syncDrawerTop();
   restoreTriggerFocus=true;
   filterDialog.classList.remove('is-closing');
   // Manual top-layer popover: the app shell and its scrollbar are not made inert.
   filterDialog.showPopover();
   filterTrigger.setAttribute('aria-expanded','true');
   dropdowns[0]?.querySelector('.language-trigger')?.focus({preventScroll:true});
  });
  filterClose?.addEventListener('click',()=>closeFilterDialog());
  filterDialog?.addEventListener('animationend',event=>{
   if(event.target===filterDialog&&event.animationName==='players-filter-slide-out')finishFilterClose();
  });
  // A click outside closes the drawer, but still reaches the original target.
  document.addEventListener('pointerdown',event=>{
   if(drawerOpen()&&!filterDialog.contains(event.target)&&!filterTrigger?.contains(event.target))
    closeFilterDialog(false);
  },true);
  document.addEventListener('keydown',event=>{
   if(!drawerOpen()||event.key!=='Escape')return;
   event.preventDefault();
   if(openDropdown){closeDropdown(openDropdown,true);return;}
   closeFilterDialog();
  });
  window.addEventListener('resize',()=>{
   if(drawerOpen()){syncDrawerTop();closeDropdown(openDropdown);}
  });
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
   if(drawerOpen()){restoreTriggerFocus=false;finishFilterClose();}
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
