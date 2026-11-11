/* Restricted Admin directory and local Players trial controls. No Admin/D1 writes. */
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
  en:{calendar:'Calendar',players:'Players',calendarDescription:'Manage the world calendar and sporting progression',playersDescription:'Configure player generation',title:'Player generation', 'group.base':'Batch','group.nationalities':'Nationalities and names','group.positions':'Positions','group.physical':'Age and physical','group.attributes':'Attribute overrides',count:'Number of players (1–1000)',seed:'Seed',primarySuitability:'Primary suitability (1–90)',primaryNationality:'Primary nationality',secondaryMode:'Second nationality',secondaryCountry:'Exact second nationality',secondaryAllowed:'Allowed second nationalities',firstName:'First name override',lastName:'Last name override',primaryPosition:'Primary position',allowedPositions:'Allowed primary positions',preferredFoot:'Preferred foot',secondaryCount:'Secondary positions count',secondaryPositions:'Exact secondary positions',allowedSecondaries:'Allowed secondary positions',age:'Initial age (16–19)',height:'Height in cm (160–205)',developmentAptitude:'Development aptitude (1–99)',copy:'Copy PowerShell command',run:'This command creates only a local JSON preview (players-trial.json). Run it in PowerShell from the repository root.',invalid:'Invalid option',copied:'Command copied. Run it in PowerShell from the repository root.',manual:'Copy the command manually from the box.',automatic:'Auto',none:'None',exact:'Exact',allowed:'Allowed countries',choose:'Choose',left:'Left',right:'Right'},
  it:{calendar:'Calendario',players:'Giocatori',calendarDescription:'Gestisci il calendario e l’avanzamento del mondo',playersDescription:'Configura la generazione dei giocatori',title:'Generazione giocatori','group.base':'Generazione','group.nationalities':'Nazionalità e nomi','group.positions':'Ruoli','group.physical':'Età e caratteristiche fisiche','group.attributes':'Attributi personalizzati',count:'Numero giocatori (1–1000)',seed:'Seed',primarySuitability:'Idoneità al ruolo primario (1–90)',primaryNationality:'Nazionalità primaria',secondaryMode:'Seconda nazionalità',secondaryCountry:'Seconda nazionalità specifica',secondaryAllowed:'Seconde nazionalità consentite',firstName:'Nome personalizzato',lastName:'Cognome personalizzato',primaryPosition:'Ruolo primario',allowedPositions:'Ruoli primari consentiti',preferredFoot:'Piede preferito',secondaryCount:'Numero ruoli secondari',secondaryPositions:'Ruoli secondari specifici',allowedSecondaries:'Ruoli secondari consentiti',age:'Età iniziale (16–19)',height:'Altezza in cm (160–205)',developmentAptitude:'Attitudine allo sviluppo (1–99)',copy:'Copia comando PowerShell',run:'Il comando crea solo un JSON locale di prova (players-trial.json). Eseguilo in PowerShell dalla cartella del repository.',invalid:'Opzione non valida',copied:'Comando copiato. Eseguilo in PowerShell dalla cartella del repository.',manual:'Copia manualmente il comando dal riquadro.',automatic:'Auto',none:'Nessuna',exact:'Specificata',allowed:'Paesi consentiti',choose:'Seleziona',left:'Sinistro',right:'Destro'},
  de:{calendar:'Kalender',players:'Spieler',calendarDescription:'Weltkalender und Spielbetrieb verwalten',playersDescription:'Spielergenerierung konfigurieren',title:'Spielergenerierung','group.base':'Generierung','group.nationalities':'Nationalitäten und Namen','group.positions':'Positionen','group.physical':'Alter und Körperdaten','group.attributes':'Attributvorgaben',count:'Anzahl Spieler (1–1000)',seed:'Seed',primarySuitability:'Eignung für Hauptposition (1–90)',primaryNationality:'Erste Nationalität',secondaryMode:'Zweite Nationalität',secondaryCountry:'Bestimmte zweite Nationalität',secondaryAllowed:'Zulässige zweite Nationalitäten',firstName:'Vorname vorgeben',lastName:'Nachname vorgeben',primaryPosition:'Hauptposition',allowedPositions:'Zulässige Hauptpositionen',preferredFoot:'Bevorzugter Fuß',secondaryCount:'Anzahl Nebenpositionen',secondaryPositions:'Bestimmte Nebenpositionen',allowedSecondaries:'Zulässige Nebenpositionen',age:'Anfangsalter (16–19)',height:'Körpergröße in cm (160–205)',developmentAptitude:'Entwicklungspotenzial (1–99)',copy:'PowerShell-Befehl kopieren',run:'Der Befehl erstellt nur eine lokale JSON-Vorschau (players-trial.json). In PowerShell im Repository-Stammverzeichnis ausführen.',invalid:'Ungültige Option',copied:'Befehl kopiert. In PowerShell im Repository-Stammverzeichnis ausführen.',manual:'Befehl aus dem Feld manuell kopieren.',automatic:'Auto',none:'Keine',exact:'Bestimmt',allowed:'Zulässige Länder',choose:'Auswählen',left:'Links',right:'Rechts'},
  es:{calendar:'Calendario',players:'Jugadores',calendarDescription:'Gestionar el calendario y la progresión del mundo',playersDescription:'Configurar la generación de jugadores',title:'Generación de jugadores','group.base':'Generación','group.nationalities':'Nacionalidades y nombres','group.positions':'Posiciones','group.physical':'Edad y físico','group.attributes':'Atributos personalizados',count:'Número de jugadores (1–1000)',seed:'Semilla',primarySuitability:'Aptitud para posición principal (1–90)',primaryNationality:'Nacionalidad principal',secondaryMode:'Segunda nacionalidad',secondaryCountry:'Segunda nacionalidad exacta',secondaryAllowed:'Segundas nacionalidades permitidas',firstName:'Nombre personalizado',lastName:'Apellido personalizado',primaryPosition:'Posición principal',allowedPositions:'Posiciones principales permitidas',preferredFoot:'Pie preferido',secondaryCount:'Número de posiciones secundarias',secondaryPositions:'Posiciones secundarias exactas',allowedSecondaries:'Posiciones secundarias permitidas',age:'Edad inicial (16–19)',height:'Altura en cm (160–205)',developmentAptitude:'Aptitud de desarrollo (1–99)',copy:'Copiar comando PowerShell',run:'El comando solo crea una vista previa JSON local (players-trial.json). Ejecútalo en PowerShell desde la raíz del repositorio.',invalid:'Opción no válida',copied:'Comando copiado. Ejecútalo en PowerShell desde la raíz del repositorio.',manual:'Copia manualmente el comando del recuadro.',automatic:'Auto',none:'Ninguna',exact:'Exacta',allowed:'Países permitidos',choose:'Elegir',left:'Izquierdo',right:'Derecho'},
  fr:{calendar:'Calendrier',players:'Joueurs',calendarDescription:'Gérer le calendrier mondial et la progression sportive',playersDescription:'Configurer la génération de joueurs',title:'Génération de joueurs','group.base':'Génération','group.nationalities':'Nationalités et noms','group.positions':'Postes','group.physical':'Âge et caractéristiques physiques','group.attributes':'Attributs personnalisés',count:'Nombre de joueurs (1–1000)',seed:'Graine',primarySuitability:'Aptitude au poste principal (1–90)',primaryNationality:'Nationalité principale',secondaryMode:'Deuxième nationalité',secondaryCountry:'Deuxième nationalité précise',secondaryAllowed:'Deuxièmes nationalités autorisées',firstName:'Prénom personnalisé',lastName:'Nom personnalisé',primaryPosition:'Poste principal',allowedPositions:'Postes principaux autorisés',preferredFoot:'Pied préféré',secondaryCount:'Nombre de postes secondaires',secondaryPositions:'Postes secondaires précis',allowedSecondaries:'Postes secondaires autorisés',age:'Âge initial (16–19)',height:'Taille en cm (160–205)',developmentAptitude:'Potentiel de développement (1–99)',copy:'Copier la commande PowerShell',run:'La commande crée seulement un aperçu JSON local (players-trial.json). Exécutez-la dans PowerShell depuis la racine du dépôt.',invalid:'Option invalide',copied:'Commande copiée. Exécutez-la dans PowerShell depuis la racine du dépôt.',manual:'Copiez manuellement la commande du cadre.',automatic:'Auto',none:'Aucune',exact:'Précise',allowed:'Pays autorisés',choose:'Choisir',left:'Gauche',right:'Droit'}
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
  const form=root.querySelector('[data-admin-players-form]'),button=root.querySelector('[data-admin-players-copy]');
  const commandNode=root.querySelector('[data-admin-players-command]'),feedback=root.querySelector('[data-admin-players-feedback]');
  const tr=()=>translations[doc.documentElement.lang]||translations.en;
  let allowed=false,canWrite=false,validation=null,command='',ticket=0;
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
  function update(){
   const text=tr();
   root.querySelectorAll('[data-admin-players-label]').forEach(node=>{const key=node.dataset.adminPlayersLabel;node.textContent=text[key]||translations.en[key]||node.textContent});
   doc.querySelectorAll('[data-admin-directory-copy]').forEach(node=>{const key=node.dataset.adminDirectoryCopy;node.textContent=text[key]||translations.en[key]||node.textContent});
   if(!isPlayers)return;
   // Every unset field must show Auto, never a preselected numeric/personality value.
   form.querySelectorAll('input[data-players-option]').forEach(input=>{
    input.placeholder=text.automatic;
   });
   const mode=form.querySelector('[data-players-option="secondaryMode"]').value;
   for(const [field,show] of [['secondaryCountry',mode==='exact'],['secondaryAllowed',mode==='allowed']]){
    const node=form.querySelector('[data-players-option="'+field+'"]');
    node.closest('label').hidden=!show;
   }
   for(const node of form.querySelectorAll('select option')){
    if(node.value==='')node.textContent=text.automatic;
    if(node.value==='automatic')node.textContent=text.automatic;
    if(node.value==='none')node.textContent=text.none;
    if(node.value==='exact')node.textContent=text.exact;
    if(node.value==='allowed')node.textContent=text.allowed;
    if(node.value==='left')node.textContent=text.left;
    if(node.value==='right')node.textContent=text.right;
   }
   const choose=form.querySelector('[data-players-option="secondaryCountry"] option[value=""]');
   if(choose)choose.textContent=text.choose;
   dropdowns.forEach(dropdown=>dropdown.sync());
   try{command=commandFromRaw(rawValues());validation=null}
   catch(error){command='';validation=error.message}
   commandNode.textContent=command;
   button.disabled=!allowed||!canWrite||!command;
   feedback.textContent=validation?text.invalid+': '+validation:text.run;
  }
  function paint(base,writer){
   allowed=base;canWrite=writer;
   host.hidden=!(base&&(!isPlayers||writer));
   if(isPlayers)root.hidden=!(base&&writer);
   host.dataset.adminAccess=host.hidden?'denied':'granted';
   if(!isPlayers){const item=root.querySelector('[data-admin-panel="players"]');if(item)item.hidden=!writer;}
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
   form.addEventListener('input',update);form.addEventListener('change',update);
   button.addEventListener('click',async()=>{
    if(!allowed||!canWrite||!command)return;
    const text=tr();
    try{await win.navigator.clipboard.writeText(command);feedback.textContent=text.copied}
    catch{feedback.textContent=text.manual}
   });
  }
  new MutationObserver(update).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  win.addEventListener('pageshow',event=>{if(event.persisted)void check()});
  update();void check();
 }
 return {makeOptions,commandFromRaw,mount};
});