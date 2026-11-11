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
  en:{calendar:'Calendar',players:'Players',calendarDescription:'Manage the world calendar and sporting progression',playersDescription:'Configure player generation',title:'Player generation',intro:'Configure a local generator trial. No players are saved to the world or database.', 'group.base':'Batch','group.nationalities':'Nationalities and names','group.positions':'Positions','group.physical':'Age and physical','group.attributes':'Attribute overrides',count:'Number of players (1–1000)',seed:'Seed',primarySuitability:'Primary suitability (1–90)',primaryNationality:'Primary nationality',secondaryMode:'Second nationality',secondaryCountry:'Exact second nationality',secondaryAllowed:'Allowed second nationalities',firstName:'First name override',lastName:'Last name override',primaryPosition:'Primary position',allowedPositions:'Allowed primary positions',preferredFoot:'Preferred foot',secondaryCount:'Secondary positions count',secondaryPositions:'Exact secondary positions',allowedSecondaries:'Allowed secondary positions',age:'Initial age (16–19)',height:'Height in cm (160–205)',developmentAptitude:'Development aptitude (1–99)',copy:'Copy PowerShell command',run:'This command creates only a local JSON preview (players-trial.json). Run it in PowerShell from the repository root.',invalid:'Invalid option',copied:'Command copied. Run it in PowerShell from the repository root.',manual:'Copy the command manually from the box.',automatic:'Automatic',none:'None',exact:'Exact',allowed:'Allowed countries',choose:'Choose',left:'Left',right:'Right'},
  it:{calendar:'Calendario',players:'Giocatori',calendarDescription:'Gestisci il calendario e l’avanzamento del mondo',playersDescription:'Configura la generazione dei giocatori',title:'Generazione giocatori',intro:'Configura una prova locale del generatore. Non vengono salvati giocatori nel mondo o nel database.','group.base':'Generazione','group.nationalities':'Nazionalità e nomi','group.positions':'Ruoli','group.physical':'Età e caratteristiche fisiche','group.attributes':'Attributi personalizzati',count:'Numero giocatori (1–1000)',seed:'Seed',primarySuitability:'Idoneità al ruolo primario (1–90)',primaryNationality:'Nazionalità primaria',secondaryMode:'Seconda nazionalità',secondaryCountry:'Seconda nazionalità specifica',secondaryAllowed:'Seconde nazionalità consentite',firstName:'Nome personalizzato',lastName:'Cognome personalizzato',primaryPosition:'Ruolo primario',allowedPositions:'Ruoli primari consentiti',preferredFoot:'Piede preferito',secondaryCount:'Numero ruoli secondari',secondaryPositions:'Ruoli secondari specifici',allowedSecondaries:'Ruoli secondari consentiti',age:'Età iniziale (16–19)',height:'Altezza in cm (160–205)',developmentAptitude:'Attitudine allo sviluppo (1–99)',copy:'Copia comando PowerShell',run:'Il comando crea solo un JSON locale di prova (players-trial.json). Eseguilo in PowerShell dalla cartella del repository.',invalid:'Opzione non valida',copied:'Comando copiato. Eseguilo in PowerShell dalla cartella del repository.',manual:'Copia manualmente il comando dal riquadro.',automatic:'Automatica',none:'Nessuna',exact:'Specificata',allowed:'Paesi consentiti',choose:'Seleziona',left:'Sinistro',right:'Destro'},
  de:{calendar:'Kalender',players:'Spieler',calendarDescription:'Weltkalender und Spielbetrieb verwalten',playersDescription:'Spielergenerierung konfigurieren',title:'Spielergenerierung',intro:'Lokalen Generatortest konfigurieren. Es werden keine Spieler in Welt oder Datenbank gespeichert.','group.base':'Generierung','group.nationalities':'Nationalitäten und Namen','group.positions':'Positionen','group.physical':'Alter und Körperdaten','group.attributes':'Attributvorgaben',count:'Anzahl Spieler (1–1000)',seed:'Seed',primarySuitability:'Eignung für Hauptposition (1–90)',primaryNationality:'Erste Nationalität',secondaryMode:'Zweite Nationalität',secondaryCountry:'Bestimmte zweite Nationalität',secondaryAllowed:'Zulässige zweite Nationalitäten',firstName:'Vorname vorgeben',lastName:'Nachname vorgeben',primaryPosition:'Hauptposition',allowedPositions:'Zulässige Hauptpositionen',preferredFoot:'Bevorzugter Fuß',secondaryCount:'Anzahl Nebenpositionen',secondaryPositions:'Bestimmte Nebenpositionen',allowedSecondaries:'Zulässige Nebenpositionen',age:'Anfangsalter (16–19)',height:'Körpergröße in cm (160–205)',developmentAptitude:'Entwicklungspotenzial (1–99)',copy:'PowerShell-Befehl kopieren',run:'Der Befehl erstellt nur eine lokale JSON-Vorschau (players-trial.json). In PowerShell im Repository-Stammverzeichnis ausführen.',invalid:'Ungültige Option',copied:'Befehl kopiert. In PowerShell im Repository-Stammverzeichnis ausführen.',manual:'Befehl aus dem Feld manuell kopieren.',automatic:'Automatisch',none:'Keine',exact:'Bestimmt',allowed:'Zulässige Länder',choose:'Auswählen',left:'Links',right:'Rechts'},
  es:{calendar:'Calendario',players:'Jugadores',calendarDescription:'Gestionar el calendario y la progresión del mundo',playersDescription:'Configurar la generación de jugadores',title:'Generación de jugadores',intro:'Configura una prueba local. No se guardan jugadores en el mundo ni en la base de datos.','group.base':'Generación','group.nationalities':'Nacionalidades y nombres','group.positions':'Posiciones','group.physical':'Edad y físico','group.attributes':'Atributos personalizados',count:'Número de jugadores (1–1000)',seed:'Semilla',primarySuitability:'Aptitud para posición principal (1–90)',primaryNationality:'Nacionalidad principal',secondaryMode:'Segunda nacionalidad',secondaryCountry:'Segunda nacionalidad exacta',secondaryAllowed:'Segundas nacionalidades permitidas',firstName:'Nombre personalizado',lastName:'Apellido personalizado',primaryPosition:'Posición principal',allowedPositions:'Posiciones principales permitidas',preferredFoot:'Pie preferido',secondaryCount:'Número de posiciones secundarias',secondaryPositions:'Posiciones secundarias exactas',allowedSecondaries:'Posiciones secundarias permitidas',age:'Edad inicial (16–19)',height:'Altura en cm (160–205)',developmentAptitude:'Aptitud de desarrollo (1–99)',copy:'Copiar comando PowerShell',run:'El comando solo crea una vista previa JSON local (players-trial.json). Ejecútalo en PowerShell desde la raíz del repositorio.',invalid:'Opción no válida',copied:'Comando copiado. Ejecútalo en PowerShell desde la raíz del repositorio.',manual:'Copia manualmente el comando del recuadro.',automatic:'Automática',none:'Ninguna',exact:'Exacta',allowed:'Países permitidos',choose:'Elegir',left:'Izquierdo',right:'Derecho'},
  fr:{calendar:'Calendrier',players:'Joueurs',calendarDescription:'Gérer le calendrier mondial et la progression sportive',playersDescription:'Configurer la génération de joueurs',title:'Génération de joueurs',intro:'Configurez un essai local. Aucun joueur n’est enregistré dans le monde ni la base de données.','group.base':'Génération','group.nationalities':'Nationalités et noms','group.positions':'Postes','group.physical':'Âge et caractéristiques physiques','group.attributes':'Attributs personnalisés',count:'Nombre de joueurs (1–1000)',seed:'Graine',primarySuitability:'Aptitude au poste principal (1–90)',primaryNationality:'Nationalité principale',secondaryMode:'Deuxième nationalité',secondaryCountry:'Deuxième nationalité précise',secondaryAllowed:'Deuxièmes nationalités autorisées',firstName:'Prénom personnalisé',lastName:'Nom personnalisé',primaryPosition:'Poste principal',allowedPositions:'Postes principaux autorisés',preferredFoot:'Pied préféré',secondaryCount:'Nombre de postes secondaires',secondaryPositions:'Postes secondaires précis',allowedSecondaries:'Postes secondaires autorisés',age:'Âge initial (16–19)',height:'Taille en cm (160–205)',developmentAptitude:'Potentiel de développement (1–99)',copy:'Copier la commande PowerShell',run:'La commande crée seulement un aperçu JSON local (players-trial.json). Exécutez-la dans PowerShell depuis la racine du dépôt.',invalid:'Option invalide',copied:'Commande copiée. Exécutez-la dans PowerShell depuis la racine du dépôt.',manual:'Copiez manuellement la commande du cadre.',automatic:'Automatique',none:'Aucune',exact:'Précise',allowed:'Pays autorisés',choose:'Choisir',left:'Gauche',right:'Droit'}
 };
 function range(raw,min,max,field){
  if(raw===undefined||raw===null||String(raw).trim()===''||String(raw).trim()==='auto')return undefined;
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
  const count=range(raw.count,1,1000,'count');
  if(typeof count!=='number')throw Error('count');
  const seed=String(raw.seed??'').trim();
  if(!seed||seed.length>64||/[\r\n]/.test(seed))throw Error('seed');
  const opts={count,seed};
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
  function rawValues(){
   const raw={};form.querySelectorAll('[data-players-option]').forEach(node=>raw[node.dataset.playersOption]=node.value);
   return raw;
  }
  function update(){
   const text=tr();
   root.querySelectorAll('[data-admin-players-label]').forEach(node=>{const key=node.dataset.adminPlayersLabel;node.textContent=text[key]||translations.en[key]||node.textContent});
   doc.querySelectorAll('[data-admin-directory-copy]').forEach(node=>{const key=node.dataset.adminDirectoryCopy;node.textContent=text[key]||translations.en[key]||node.textContent});
   if(!isPlayers)return;
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
   if(!isPlayers){const item=root.querySelector('[data-admin-card="players"]');if(item)item.hidden=!writer;}
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