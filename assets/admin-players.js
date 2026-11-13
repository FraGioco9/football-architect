/* Restricted Admin directory and two-stage server-authorized Players generation. */
((root,factory)=>{
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const countries='ESP ARG FRA ENG POR BRA MAR BEL NED MEX COL SUI GER CRO ITA USA JPN SEN NOR URU DEN AUT IRN ECU EGY AUS CAN ALG CIV NGA TUR KOR PAR SWE RUS UKR POL HUN WAL COD GRE CMR SCO SRB SVK PAN MLI RSA VEN CHI'.split(' ');
 const roles='GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' ');
 const attributes='speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ');
 const translations={
  en:{calendar:'Calendar',players:'Players',calendarDescription:'Manage the world calendar and sporting progression',playersDescription:'Configure player generation',contracts:'Contracts',contractsDescription:'Manage current player–club affiliations',title:'Player generation', 'group.base':'Batch','group.nationalities':'Nationalities and names','group.positions':'Positions','group.physical':'Age and physical','group.attributes':'Attribute overrides',count:'Number of players (1–1000)',seed:'Seed',primarySuitability:'Primary suitability (1–90)',primaryNationality:'Primary nationality',secondaryMode:'Second nationality',secondaryCountry:'Exact second nationality',secondaryAllowed:'Allowed second nationalities',firstName:'First name override',lastName:'Last name override',primaryPosition:'Primary position',allowedPositions:'Allowed primary positions',preferredFoot:'Preferred foot',secondaryCount:'Secondary positions count',secondaryPositions:'Exact secondary positions',allowedSecondaries:'Allowed secondary positions',age:'Initial age (16–19)',height:'Height in cm (160–205)',developmentAptitude:'Development aptitude (1–99)',copy:'Copy PowerShell command',run:'This command creates only a local JSON preview (players-trial.json). Run it in PowerShell from the repository root.',invalid:'Invalid option',copied:'Command copied. Run it in PowerShell from the repository root.',manual:'Copy the command manually from the box.',automatic:'Auto',none:'None',exact:'Exact',allowed:'Allowed countries',choose:'Choose',left:'Left',right:'Right'},
  it:{calendar:'Calendario',players:'Giocatori',calendarDescription:'Gestisci il calendario e l’avanzamento del mondo',playersDescription:'Configura la generazione dei giocatori',contracts:'Contracts',contractsDescription:'Gestisci le affiliazioni attuali dei giocatori ai club',title:'Generazione giocatori','group.base':'Generazione','group.nationalities':'Nazionalità e nomi','group.positions':'Ruoli','group.physical':'Età e caratteristiche fisiche','group.attributes':'Attributi personalizzati',count:'Numero giocatori (1–1000)',seed:'Seed',primarySuitability:'Idoneità al ruolo primario (1–90)',primaryNationality:'Nazionalità primaria',secondaryMode:'Seconda nazionalità',secondaryCountry:'Seconda nazionalità specifica',secondaryAllowed:'Seconde nazionalità consentite',firstName:'Nome personalizzato',lastName:'Cognome personalizzato',primaryPosition:'Ruolo primario',allowedPositions:'Ruoli primari consentiti',preferredFoot:'Piede preferito',secondaryCount:'Numero ruoli secondari',secondaryPositions:'Ruoli secondari specifici',allowedSecondaries:'Ruoli secondari consentiti',age:'Età iniziale (16–19)',height:'Altezza in cm (160–205)',developmentAptitude:'Attitudine allo sviluppo (1–99)',copy:'Copia comando PowerShell',run:'Il comando crea solo un JSON locale di prova (players-trial.json). Eseguilo in PowerShell dalla cartella del repository.',invalid:'Opzione non valida',copied:'Comando copiato. Eseguilo in PowerShell dalla cartella del repository.',manual:'Copia manualmente il comando dal riquadro.',automatic:'Auto',none:'Nessuna',exact:'Specificata',allowed:'Paesi consentiti',choose:'Seleziona',left:'Sinistro',right:'Destro'},
  de:{calendar:'Kalender',players:'Spieler',calendarDescription:'Weltkalender und Spielbetrieb verwalten',playersDescription:'Spielergenerierung konfigurieren',contracts:'Verträge',contractsDescription:'Aktuelle Spieler–Verein-Zuordnungen verwalten',title:'Spielergenerierung','group.base':'Generierung','group.nationalities':'Nationalitäten und Namen','group.positions':'Positionen','group.physical':'Alter und Körperdaten','group.attributes':'Attributvorgaben',count:'Anzahl Spieler (1–1000)',seed:'Seed',primarySuitability:'Eignung für Hauptposition (1–90)',primaryNationality:'Erste Nationalität',secondaryMode:'Zweite Nationalität',secondaryCountry:'Bestimmte zweite Nationalität',secondaryAllowed:'Zulässige zweite Nationalitäten',firstName:'Vorname vorgeben',lastName:'Nachname vorgeben',primaryPosition:'Hauptposition',allowedPositions:'Zulässige Hauptpositionen',preferredFoot:'Bevorzugter Fuß',secondaryCount:'Anzahl Nebenpositionen',secondaryPositions:'Bestimmte Nebenpositionen',allowedSecondaries:'Zulässige Nebenpositionen',age:'Anfangsalter (16–19)',height:'Körpergröße in cm (160–205)',developmentAptitude:'Entwicklungspotenzial (1–99)',copy:'PowerShell-Befehl kopieren',run:'Der Befehl erstellt nur eine lokale JSON-Vorschau (players-trial.json). In PowerShell im Repository-Stammverzeichnis ausführen.',invalid:'Ungültige Option',copied:'Befehl kopiert. In PowerShell im Repository-Stammverzeichnis ausführen.',manual:'Befehl aus dem Feld manuell kopieren.',automatic:'Auto',none:'Keine',exact:'Bestimmt',allowed:'Zulässige Länder',choose:'Auswählen',left:'Links',right:'Rechts'},
  es:{calendar:'Calendario',players:'Jugadores',calendarDescription:'Gestionar el calendario y la progresión del mundo',playersDescription:'Configurar la generación de jugadores',contracts:'Contratos',contractsDescription:'Gestionar los vínculos actuales entre jugadores y clubes',title:'Generación de jugadores','group.base':'Generación','group.nationalities':'Nacionalidades y nombres','group.positions':'Posiciones','group.physical':'Edad y físico','group.attributes':'Atributos personalizados',count:'Número de jugadores (1–1000)',seed:'Semilla',primarySuitability:'Aptitud para posición principal (1–90)',primaryNationality:'Nacionalidad principal',secondaryMode:'Segunda nacionalidad',secondaryCountry:'Segunda nacionalidad exacta',secondaryAllowed:'Segundas nacionalidades permitidas',firstName:'Nombre personalizado',lastName:'Apellido personalizado',primaryPosition:'Posición principal',allowedPositions:'Posiciones principales permitidas',preferredFoot:'Pie preferido',secondaryCount:'Número de posiciones secundarias',secondaryPositions:'Posiciones secundarias exactas',allowedSecondaries:'Posiciones secundarias permitidas',age:'Edad inicial (16–19)',height:'Altura en cm (160–205)',developmentAptitude:'Aptitud de desarrollo (1–99)',copy:'Copiar comando PowerShell',run:'El comando solo crea una vista previa JSON local (players-trial.json). Ejecútalo en PowerShell desde la raíz del repositorio.',invalid:'Opción no válida',copied:'Comando copiado. Ejecútalo en PowerShell desde la raíz del repositorio.',manual:'Copia manualmente el comando del recuadro.',automatic:'Auto',none:'Ninguna',exact:'Exacta',allowed:'Países permitidos',choose:'Elegir',left:'Izquierdo',right:'Derecho'},
  fr:{calendar:'Calendrier',players:'Joueurs',calendarDescription:'Gérer le calendrier mondial et la progression sportive',playersDescription:'Configurer la génération de joueurs',contracts:'Contrats',contractsDescription:'Gérer les affiliations actuelles des joueurs aux clubs',title:'Génération de joueurs','group.base':'Génération','group.nationalities':'Nationalités et noms','group.positions':'Postes','group.physical':'Âge et caractéristiques physiques','group.attributes':'Attributs personnalisés',count:'Nombre de joueurs (1–1000)',seed:'Graine',primarySuitability:'Aptitude au poste principal (1–90)',primaryNationality:'Nationalité principale',secondaryMode:'Deuxième nationalité',secondaryCountry:'Deuxième nationalité précise',secondaryAllowed:'Deuxièmes nationalités autorisées',firstName:'Prénom personnalisé',lastName:'Nom personnalisé',primaryPosition:'Poste principal',allowedPositions:'Postes principaux autorisés',preferredFoot:'Pied préféré',secondaryCount:'Nombre de postes secondaires',secondaryPositions:'Postes secondaires précis',allowedSecondaries:'Postes secondaires autorisés',age:'Âge initial (16–19)',height:'Taille en cm (160–205)',developmentAptitude:'Potentiel de développement (1–99)',copy:'Copier la commande PowerShell',run:'La commande crée seulement un aperçu JSON local (players-trial.json). Exécutez-la dans PowerShell depuis la racine du dépôt.',invalid:'Option invalide',copied:'Commande copiée. Exécutez-la dans PowerShell depuis la racine du dépôt.',manual:'Copiez manuellement la commande du cadre.',automatic:'Auto',none:'Aucune',exact:'Précise',allowed:'Pays autorisés',choose:'Choisir',left:'Gauche',right:'Droit'}
 };
 const stageTranslations={
  en:{preview:'Preview players',previewHeading:'Player preview',commit:'Generate in environment',approvalPrompt:'Type GENERATE PLAYERS to approve this preview',
   colIndex:'#',colName:'Name',colNationality:'Nationality',colAge:'Age',colPosition:'Position',colFoot:'Foot',colHeight:'Height',
   previewBusy:'Generating preview…',commitBusy:'Saving approved players…',previewReady:'Review these players before approval.',page:'Page',of:'of',
   stored:'Players saved in this environment',previewError:'Unable to generate preview',commitError:'Unable to save players',expired:'Preview expired or world changed. Generate a new preview.'},
  it:{preview:'Anteprima giocatori',previewHeading:'Anteprima giocatori',commit:'Genera nell’environment',approvalPrompt:'Scrivi GENERATE PLAYERS per approvare questa anteprima',
   colIndex:'#',colName:'Nome',colNationality:'Nazionalità',colAge:'Età',colPosition:'Ruolo',colFoot:'Piede',colHeight:'Altezza',
   previewBusy:'Generazione anteprima…',commitBusy:'Salvataggio dei giocatori approvati…',previewReady:'Controlla i giocatori prima di approvarli.',page:'Pagina',of:'di',
   stored:'Giocatori salvati nell’environment',previewError:'Impossibile generare l’anteprima',commitError:'Impossibile salvare i giocatori',expired:'Anteprima scaduta o mondo modificato. Genera una nuova anteprima.'},
  de:{preview:'Spielervorschau',previewHeading:'Spielervorschau',commit:'In Umgebung generieren',approvalPrompt:'Zum Bestätigen GENERATE PLAYERS eingeben',
   colIndex:'#',colName:'Name',colNationality:'Nationalität',colAge:'Alter',colPosition:'Position',colFoot:'Fuß',colHeight:'Größe',
   previewBusy:'Vorschau wird erstellt…',commitBusy:'Genehmigte Spieler werden gespeichert…',previewReady:'Spieler vor Freigabe prüfen.',page:'Seite',of:'von',
   stored:'Spieler in dieser Umgebung gespeichert',previewError:'Vorschau fehlgeschlagen',commitError:'Speichern fehlgeschlagen',expired:'Vorschau abgelaufen oder Welt geändert. Neue Vorschau erstellen.'},
  es:{preview:'Vista previa de jugadores',previewHeading:'Vista previa de jugadores',commit:'Generar en el entorno',approvalPrompt:'Escribe GENERATE PLAYERS para aprobar esta vista previa',
   colIndex:'#',colName:'Nombre',colNationality:'Nacionalidad',colAge:'Edad',colPosition:'Posición',colFoot:'Pie',colHeight:'Altura',
   previewBusy:'Generando vista previa…',commitBusy:'Guardando jugadores aprobados…',previewReady:'Revisa los jugadores antes de aprobar.',page:'Página',of:'de',
   stored:'Jugadores guardados en este entorno',previewError:'No se pudo generar la vista previa',commitError:'No se pudieron guardar los jugadores',expired:'Vista previa caducada o mundo modificado. Genera otra.'},
  fr:{preview:'Aperçu des joueurs',previewHeading:'Aperçu des joueurs',commit:'Générer dans l’environnement',approvalPrompt:'Saisissez GENERATE PLAYERS pour approuver cet aperçu',
   colIndex:'#',colName:'Nom',colNationality:'Nationalité',colAge:'Âge',colPosition:'Poste',colFoot:'Pied',colHeight:'Taille',
   previewBusy:'Création de l’aperçu…',commitBusy:'Enregistrement des joueurs approuvés…',previewReady:'Vérifiez les joueurs avant de confirmer.',page:'Page',of:'sur',
   stored:'Joueurs enregistrés dans cet environnement',previewError:'Impossible de générer l’aperçu',commitError:'Impossible d’enregistrer les joueurs',expired:'Aperçu expiré ou monde modifié. Créez un nouvel aperçu.'}
 };
 function range(raw,min,max,field){
  if(raw===undefined||raw===null||String(raw).trim()===''||String(raw).trim().toLowerCase()==='auto')return undefined;
  const text=String(raw).trim(),match=/^(\d{1,3})(?::(\d{1,3}))?$/.exec(text);
  if(!match)throw Error(field);
  const lo=Number(match[1]),hi=match[2]===undefined?lo:Number(match[2]);
  if(lo<min||hi>max||lo>hi)throw Error(field);
  return lo===hi?lo:[lo,hi];
 }
 function csv(raw,allowed,max,field){
  if(!raw||!raw.trim())return undefined;
  const entries=raw.toUpperCase().split(',').map(s=>s.trim());
  if(entries.length>max||entries.some(s=>!allowed.includes(s))||new Set(entries).size!==entries.length)throw Error(field);
  return entries;
 }
 function makeOptions(raw){
  if(!raw||typeof raw!=='object')throw Error('options');
  const opts={};
  // Empty/Auto means use the stable generator defaults (100 players and its seed).
  const count=range(raw.count,1,1000,'count');
  if(count!==undefined){if(typeof count!=='number')throw Error('count');opts.count=count;}
  const seed=String(raw.seed??'').trim();
  if(seed.length>64||/[\r\n]/.test(seed))throw Error('seed');
  if(seed&&seed.toLowerCase()!=='auto')opts.seed=seed;
  const suitability=range(raw.primarySuitability,1,90,'primarySuitability');
  if(suitability!==undefined)opts.primarySuitability=suitability;
  const primary=raw.primaryNationality||'';
  if(primary){if(!countries.includes(primary))throw Error('primaryNationality');opts.primaryNationality=primary;}
  const mode=raw.secondaryMode||'automatic';
  if(mode==='none')opts.secondaryNationality='none';
  else if(mode==='exact'){
   const c=raw.secondaryCountry;
   if(!countries.includes(c)||c===primary)throw Error('secondaryCountry');
   opts.secondaryNationality=c;
  }else if(mode==='allowed'){
   const list=csv(String(raw.secondaryAllowed??''),countries,50,'secondaryAllowed');
   if(!list||list.includes(primary))throw Error('secondaryAllowed');
   opts.secondaryNationality=list;
  }else if(mode!=='automatic')throw Error('secondaryMode');
  for(const name of ['firstName','lastName']){
   const value=String(raw[name]??'').trim();
   if(value.length>100||/[\r\n]/.test(value))throw Error(name);
   if(value)opts[name]=value;
  }
  const primaryPosition=raw.primaryPosition||'';
  if(primaryPosition){if(!roles.includes(primaryPosition))throw Error('primaryPosition');opts.primaryPosition=primaryPosition;}
  for(const key of ['allowedPositions','secondaryPositions','allowedSecondaries']){
   const entries=csv(String(raw[key]??''),roles,key==='secondaryPositions'?5:14,key);
   if(entries)opts[key]=entries;
  }
  if(opts.allowedPositions&&opts.primaryPosition&&!opts.allowedPositions.includes(opts.primaryPosition))throw Error('allowedPositions');
  const foot=raw.preferredFoot||'';
  if(foot){if(!['left','right'].includes(foot))throw Error('preferredFoot');opts.preferredFoot=foot;}
  if(raw.secondaryCount!==undefined&&raw.secondaryCount!==''){
   const count=range(raw.secondaryCount,0,5,'secondaryCount');
   if(typeof count!=='number')throw Error('secondaryCount');
   opts.secondaryCount=count;
  }
  if(opts.secondaryPositions&&opts.secondaryCount!==undefined&&opts.secondaryPositions.length!==opts.secondaryCount)throw Error('secondaryCount');
  if(opts.primaryPosition==='GK'&&(opts.secondaryPositions?.length||opts.secondaryCount>0))throw Error('secondaryPositions');
  if(opts.allowedSecondaries&&opts.secondaryPositions&&opts.secondaryPositions.some(x=>!opts.allowedSecondaries.includes(x)))throw Error('secondaryPositions');
  for(const [field,min,max] of [['age',16,19],['height',160,205],['developmentAptitude',1,99]]){
   const v=range(raw[field],min,max,field);if(v!==undefined)opts[field]=v;
  }
  const attr={};
  for(const name of attributes){
   const v=range(raw['attribute.'+name],1,99,'attribute.'+name);
   if(v!==undefined)attr[name]=v;
  }
  if(Object.keys(attr).length)opts.attributes=attr;
  return opts;
 }
 function encodeOptions(options){
  const binary=Array.from(new TextEncoder().encode(JSON.stringify(options)),b=>String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 }
 function commandFromRaw(raw){
  const options=makeOptions(raw);
  return 'node tools/players-generation-trial.mjs --options-base64 '+encodeOptions(options)+' --out .\\players-trial.json';
 }
 function mount(win){
  const doc=win.document,host=doc.querySelector('#app-admin'),root=host?.querySelector('[data-admin-players],[data-admin-directory]');
  if(!root)return;
  const isPlayers=root.hasAttribute('data-admin-players');
  const form=root.querySelector('[data-admin-players-form]'),previewButton=root.querySelector('[data-admin-players-preview]');
  const commitButton=root.querySelector('[data-admin-players-commit]'),confirmation=root.querySelector('[data-admin-players-confirmation]');
  const result=root.querySelector('[data-admin-players-result]'),feedback=root.querySelector('[data-admin-players-feedback]');
  const summary=root.querySelector('[data-admin-players-summary]'),rows=root.querySelector('[data-admin-players-rows]');
  const pagination=root.querySelector('[data-admin-players-page]'),previous=root.querySelector('[data-admin-players-prev]'),next=root.querySelector('[data-admin-players-next]');
  const committed=root.querySelector('[data-admin-players-commit-status]');
  const tr=()=>({...(translations[doc.documentElement.lang]||translations.en),...(stageTranslations[doc.documentElement.lang]||stageTranslations.en)});
  // The preview returns only its approved generator *options*, never candidate
  // records, via transient same-tab history state. The full form survives the
  // dedicated-page round trip without leaking those values into a query string
  // or persistent browser storage.
  if(form){
   const restored=win.history.state?.faAdminGeneratorOptions;
   if(restored&&typeof restored==='object'&&!Array.isArray(restored)){
    const set=(key,value)=>{
     const field=form.querySelector('[data-players-option="'+key+'"]');
     if(!field||value===undefined||value===null)return;
     field.value=Array.isArray(value)?value.join(':'):String(value);
    };
    for(const [key,value] of Object.entries(restored)){
     // An auto seed is generated server-side for one preview only. Restoring
     // its temporary UUID would turn the next preview into a fixed-seed run.
     if(key==='seed'&&typeof value==='string'&&/^fa-auto-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))continue;
     if(key==='attributes'&&value&&typeof value==='object'&&!Array.isArray(value)){
      for(const [attribute,v] of Object.entries(value))set('attribute.'+attribute,v);
     }else if(key==='secondaryNationality'){
      if(value==='none')set('secondaryMode','none');
      else if(typeof value==='string'){set('secondaryMode','exact');set('secondaryCountry',value);}
      else if(Array.isArray(value)){set('secondaryMode','allowed');set('secondaryAllowed',value.join(','));}
     }else if(['allowedPositions','secondaryPositions','allowedSecondaries'].includes(key)){
      set(key,Array.isArray(value)?value.join(','):value);
     }else set(key,value);
    }
    // Consume the one-time handoff; a later refresh should not unexpectedly
    // overwrite edits made on the generator form.
    win.history.replaceState(null,'',win.location.pathname+win.location.search+win.location.hash);
   }
  }
  // An approved cohort carries its next deterministic seed back to the generator.
  // Apply it after restoring the other options so the old seed cannot win.
  const nextSeed=new URLSearchParams(win.location.search).get('nextSeed');
  if(form&&/^fa-next-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(nextSeed||''))
   form.querySelector('[data-players-option="seed"]').value=nextSeed;
  let allowed=false,canWrite=false,validation=null,options=null,signature='',ticket=0;
  let pending=false,draft=null,draftPage=0,operation=0,saved=false;

  // Keep native selects as the data model; render the same custom listbox pattern as the site.
  function mountDropdowns(){
   if(!form)return [];
   return [...form.querySelectorAll('select[data-players-option]')].map((select,index)=>{
    const control=doc.createElement('div');control.className='language-control admin-players-dropdown';
    control.dataset.playersDropdown=select.dataset.playersOption;
    const label=select.closest('label').querySelector('[data-admin-players-label]');
    const trigger=doc.createElement('button');trigger.type='button';trigger.className='language-trigger';
    trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',label?.textContent||'Option');
    const id='admin-players-menu-'+index;trigger.setAttribute('aria-controls',id);
    const value=doc.createElement('span');value.className='admin-players-dropdown-value';
    const chevron=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    chevron.setAttribute('class','language-chevron');chevron.setAttribute('viewBox','0 0 20 20');
    chevron.setAttribute('width','16');chevron.setAttribute('height','16');
    chevron.setAttribute('aria-hidden','true');
    const line=doc.createElementNS('http://www.w3.org/2000/svg','path');
    line.setAttribute('d','m5 7 5 5 5-5');line.setAttribute('fill','none');
    line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','1.75');
    line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');
    chevron.append(line);trigger.append(value,chevron);
    const menu=doc.createElement('div');menu.className='language-menu';menu.id=id;
    menu.setAttribute('role','listbox');menu.hidden=true;
    const searchable=select.options.length>15;
    const search=searchable?doc.createElement('input'):null;
    if(search){
     search.type='search';search.className='admin-players-dropdown-search';
     search.setAttribute('aria-label','Search');search.setAttribute('autocomplete','off');
     menu.append(search);
    }
    const items=[...select.options].map((source,i)=>{
     const node=doc.createElement('div');node.className='language-option';
     node.setAttribute('role','option');node.id=id+'-option-'+i;
     node.dataset.menuValue=source.value;node.textContent=source.textContent;
     node.setAttribute('aria-selected','false');menu.append(node);return node;
    });
    select.after(control);select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    control.append(trigger,menu);
    const normalized=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(doc.documentElement.lang).trim();
    let current=0;
    const visible=()=>items.filter(item=>!item.hidden);
    function highlight(){
     const list=visible();current=Math.min(Math.max(current,0),Math.max(0,list.length-1));
     for(const item of items)delete item.dataset.active;
     for(const el of [trigger,search].filter(Boolean)){
      if(list.length)el.setAttribute('aria-activedescendant',list[current].id);
      else el.removeAttribute('aria-activedescendant');
     }
     if(list.length){
      list[current].dataset.active='true';
      list[current].scrollIntoView?.({block:'nearest'});
     }
    }
    function filter(){
     const q=normalized(search?.value||'');
     for(const item of items)item.hidden=Boolean(q)&&!normalized(item.textContent+' '+item.dataset.menuValue).includes(q);
     current=0;if(!menu.hidden)highlight();
    }
    function close(focus=false){
     menu.hidden=true;trigger.setAttribute('aria-expanded','false');
     for(const el of [trigger,search].filter(Boolean))el.removeAttribute('aria-activedescendant');
     for(const item of items)delete item.dataset.active;
     if(focus)trigger.focus({preventScroll:true});
    }
    function place(){
     const bounds=trigger.getBoundingClientRect();
     const vp=win.visualViewport,top=vp?.offsetTop||0,bottom=top+(vp?.height||win.innerHeight);
     const below=bottom-bounds.bottom,above=bounds.top-top;
     control.dataset.menuPlacement=below<210&&above>below?'above':'below';
    }
    function open(){
     if(trigger.disabled)return;
     // Only one dropdown may be open at a time.
     doc.querySelectorAll('.admin-players-dropdown .language-trigger[aria-expanded="true"]').forEach(other=>{if(other!==trigger)other.click()});
     if(search){search.value='';filter();}
     const list=visible(),index=list.findIndex(item=>item.dataset.menuValue===select.value);
     current=index<0?0:index;menu.hidden=false;
     trigger.setAttribute('aria-expanded','true');
     place();(search||trigger).focus({preventScroll:true});highlight();
    }
    function choose(item){
     if(!item)return;
     select.value=item.dataset.menuValue;
     close(true);
     select.dispatchEvent(new win.Event('change',{bubbles:true}));
    }
    function onKey(event){
     const key=event.key;
     if(['ArrowDown','ArrowUp','Home','End'].includes(key)&&!(event.target===search&&['Home','End'].includes(key))){
      if(trigger.disabled)return;event.preventDefault();
      if(menu.hidden)open();const list=visible();if(!list.length)return;
      current=key==='Home'?0:key==='End'?list.length-1:key==='ArrowDown'?(current+1)%list.length:(current-1+list.length)%list.length;
      highlight();
     }else if(key==='Escape'&&!menu.hidden){event.preventDefault();close(true)}
     else if(key==='Enter'||(key===' '&&event.target!==search)){
      if(trigger.disabled)return;event.preventDefault();
      if(menu.hidden)open();else choose(visible()[current]);
     }else if(key==='Tab')close();
    }
    trigger.addEventListener('click',()=>menu.hidden?open():close(true));
    trigger.addEventListener('keydown',onKey);
    search?.addEventListener('keydown',onKey);
    search?.addEventListener('input',filter);
    for(const item of items){
     item.addEventListener('click',()=>choose(item));
     item.addEventListener('pointermove',()=>{const i=visible().indexOf(item);if(i>=0&&!menu.hidden){current=i;highlight()}});
    }
    doc.addEventListener('pointerdown',event=>{if(!control.contains(event.target)&&!menu.hidden)close()},true);
    win.addEventListener('resize',()=>{if(!menu.hidden)place()},{passive:true});
    const sync=()=>{
     items.forEach((item,i)=>{item.textContent=select.options[i].textContent;
      item.setAttribute('aria-selected',String(item.dataset.menuValue===select.value));});
     value.textContent=select.selectedOptions[0]?.textContent||select.options[0]?.textContent||'Auto';
     trigger.setAttribute('aria-label',(label?.textContent||'Option')+': '+value.textContent);
     if(search){search.placeholder=doc.documentElement.lang==='it'?'Cerca…':doc.documentElement.lang==='de'?'Suchen…':doc.documentElement.lang==='es'?'Buscar…':doc.documentElement.lang==='fr'?'Rechercher…':'Search…';search.setAttribute('aria-label',search.placeholder);}
     if(!menu.hidden)filter();
    };
    select.addEventListener('change',sync);
    sync();return {sync,close};
   });
  }
  const dropdowns=mountDropdowns();
  function rawValues(){
   const raw={};form.querySelectorAll('[data-players-option]').forEach(node=>raw[node.dataset.playersOption]=node.value);
   return raw;
  }
  const pageSize=25;
  function invalidateDraft(){
   ++operation;
   pending=false;
   draft=null;draftPage=0;saved=false;
   if(result)result.hidden=true;
   if(committed){committed.hidden=true;committed.textContent='';}
   if(confirmation)confirmation.value='';
   if(feedback)feedback.textContent='';
  }
  function renderPage(){
   if(!draft)return;
   const text=tr(),all=draft.candidates||[];
   const maxPage=Math.max(0,Math.ceil(all.length/pageSize)-1);
   draftPage=Math.max(0,Math.min(draftPage,maxPage));
   rows.replaceChildren();
   for(const [i,player] of all.slice(draftPage*pageSize,(draftPage+1)*pageSize).entries()){
    const tr=doc.createElement('tr');
    const values=[draftPage*pageSize+i+1,player.display_name,player.nationality,player.initial_age,player.primary_position,player.preferred_foot,player.height_cm];
    for(const value of values){const td=doc.createElement('td');td.textContent=String(value??'');tr.append(td);}
    rows.append(tr);
   }
   pagination.textContent=text.page+' '+(draftPage+1)+' '+text.of+' '+(maxPage+1);
   previous.disabled=draftPage===0;next.disabled=draftPage===maxPage;
   summary.textContent=draft.summary.count+' '+text.players+' · '+Object.keys(draft.summary.countries||{}).length+' '+text.colNationality+' · '+draft.summary.seed;
  }
  function update(){
   const text=tr();
   root.querySelectorAll('[data-admin-players-label]').forEach(node=>{const key=node.dataset.adminPlayersLabel;node.textContent=text[key]||node.textContent});
   doc.querySelectorAll('[data-admin-directory-copy]').forEach(node=>{const key=node.dataset.adminDirectoryCopy;node.textContent=text[key]||node.textContent});
   if(!isPlayers)return;
   form.querySelectorAll('input[data-players-option]').forEach(input=>{input.placeholder=text.automatic});
   const mode=form.querySelector('[data-players-option="secondaryMode"]').value;
   for(const [field,show] of [['secondaryCountry',mode==='exact'],['secondaryAllowed',mode==='allowed']]){
    form.querySelector('[data-players-option="'+field+'"]').closest('label').hidden=!show;
   }
   for(const node of form.querySelectorAll('select option')){
    if(node.value===''||node.value==='automatic')node.textContent=text.automatic;
    if(node.value==='none')node.textContent=text.none;
    if(node.value==='exact')node.textContent=text.exact;
    if(node.value==='allowed')node.textContent=text.allowed;
    if(node.value==='left')node.textContent=text.left;
    if(node.value==='right')node.textContent=text.right;
   }
   const choose=form.querySelector('[data-players-option="secondaryCountry"] option[value=""]');
   if(choose)choose.textContent=text.choose;
   dropdowns.forEach(dropdown=>dropdown.sync());
   let nextSignature='';
   try{options=makeOptions(rawValues());nextSignature=JSON.stringify(options);validation=null}
   catch(error){options=null;validation=error.message}
   if(nextSignature!==signature){signature=nextSignature;invalidateDraft();}
   if(draft&&!pending)feedback.textContent=text.previewReady;
   if(validation&&!pending)feedback.textContent=text.invalid+': '+validation;
   const previewDisabled=!allowed||!canWrite||!options||pending;
   const commitDisabled=true;
   // Preserve the enabled button throughout pointerdown/click. WebKit may
   // suppress a click after an unnecessary disabled-property assignment.
   if(previewButton.disabled!==previewDisabled)previewButton.disabled=previewDisabled;
   if(commitButton&&commitButton.disabled!==commitDisabled)commitButton.disabled=commitDisabled;
  }
  async function authorizedPost(path,payload){
   const session=await win.fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
   if(!session.ok)throw Error('authorization_'+session.status);
   const state=await session.json();
   if(typeof state.csrfToken!=='string'||!state.csrfToken)throw Error('csrf_unavailable');
   const response=await win.fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-CSRF-Token':state.csrfToken},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok)throw Error(data?.error?.code||'http_'+response.status);
   return data;
  }
  async function previewPlayers(){
   if(!allowed||!canWrite||pending||!options)return;
   const expected=signature,selected=options;
   invalidateDraft();pending=true;
   // invalidateDraft increments operation, retain the new active ticket.
   const active=++operation;
   feedback.textContent=tr().previewBusy;update();
   try{
    const data=await authorizedPost('/api/admin/players/preview',{options:selected});
    if(active!==operation||signature!==expected||!allowed||!canWrite)return;
    if(!data||!Array.isArray(data.candidates)||data.candidates.length!==data.summary?.count||
      typeof data.draftId!=='string')throw Error('invalid_preview');
    draft=data;draftPage=0;
    win.location.assign('/admin/players/preview?draftId='+encodeURIComponent(data.draftId));
   }catch(error){
    if(active!==operation)return;
    feedback.textContent=tr().previewError+': '+error.message;
    if(error.message.startsWith('authorization_'))paint(false,false);
   }finally{if(active===operation){pending=false;update();}}
  }
  async function commitPlayers(){
   if(!allowed||!canWrite||pending||!draft||saved||confirmation.value!=='GENERATE PLAYERS')return;
   const id=draft.draftId,active=++operation;
   pending=true;feedback.textContent=tr().commitBusy;update();
   try{
    const answer=await authorizedPost('/api/admin/players/commit',{draftId:id,confirmation:'GENERATE PLAYERS'});
    if(active!==operation||!allowed||!canWrite)return;
    if(answer.batchId!==id||answer.count!==draft.summary.count)throw Error('invalid_commit_result');
    // Successful commits advance the visible seed for the next cohort. The
    // approved draft was already persisted unchanged; its UUID makes this
    // follow-up seed distinct without requiring any extra server mutation.
    const receipt=answer.count+' '+tr().stored+' · '+answer.batchId;
    form.querySelector('[data-players-option="seed"]').value='fa-next-'+answer.batchId;
    update(); // New signature invalidates the old draft and unlocks Preview.
    committed.hidden=false;
    committed.textContent=receipt;
    feedback.textContent='';
   }catch(error){
    if(active!==operation)return;
    feedback.textContent=tr().commitError+': '+error.message;
    if(error.message==='players_preview_expired'||error.message==='stale_players_preview'){invalidateDraft();feedback.textContent=tr().expired;}
    else if(error.message.startsWith('authorization_')||error.message==='permission_denied')paint(false,false);
   }finally{if(active===operation){pending=false;update();}}
  }
  function paint(base,writer){
   if(!base||!writer){if(draft||saved)invalidateDraft();}
   allowed=base;canWrite=writer;
   host.hidden=!(base&&(!isPlayers||writer));
   if(isPlayers)root.hidden=!(base&&writer);
   host.dataset.adminAccess=host.hidden?'denied':'granted';
   if(!isPlayers)root.querySelectorAll('[data-admin-panel="players"],[data-admin-panel="contracts"]').forEach(item=>{item.hidden=!writer});
   win.faAdminAccess=base;
   win.dispatchEvent(new CustomEvent('fa:admin-access',{detail:base}));
   update();
  }
  async function check(){
   const current=++ticket;paint(false,false);
   const controller=new AbortController(),timeout=win.setTimeout(()=>controller.abort(),8000);
   try{
    const response=await win.fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('permissions');
    const data=await response.json();
    if(current!==ticket)return;
    const perms=Array.isArray(data?.permissions)?data.permissions:[];
    const read=perms.includes('admin.access')&&perms.includes('admin.world.read');
    paint(read,read&&perms.includes('admin.world.write'));
   }catch{if(current===ticket)paint(false,false)}finally{win.clearTimeout(timeout)}
  }
  if(form){
   form.addEventListener('input',update);
   // Text inputs update immediately on input. Their subsequent blur/change
   // events need not re-render the form during a Safari pointer gesture.
   // Native select changes continue to update dependent dropdown fields.
   form.addEventListener('change',event=>{
    if(event.target?.matches?.('select[data-players-option]'))update();
   });
   confirmation?.addEventListener('input',update);
   previewButton.addEventListener('click',()=>{void previewPlayers()});
   commitButton?.addEventListener('click',()=>{void commitPlayers()});
   previous?.addEventListener('click',()=>{if(draft){draftPage--;renderPage()}});
   next?.addEventListener('click',()=>{if(draft){draftPage++;renderPage()}});
  }
  new MutationObserver(update).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  win.addEventListener('pageshow',event=>{if(event.persisted)void check()});
  update();void check();
 }
 return {makeOptions,commandFromRaw,mount};
});