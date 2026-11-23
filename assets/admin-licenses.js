/* Manual Admin club licenses. No consumer-side authority is inferred from the UI. */
((root,factory)=>{
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const labels={
  en:{manage:'Manage club licenses',intro:'Assign a club to an existing verified account. No payments or expiration rules are applied.',club:'Club',searchAccount:'Find an account by email',account:'Account',find:'Search',assign:'Assign license',replace:'Replace licensee',revoke:'Revoke license',clubs:'Clubs',licensee:'Licensee',updated:'Updated',history:'Recent license changes',date:'Date',action:'Action',previous:'Previous',new:'New',all:'All clubs',assigned:'Licensed',free:'Available',choose:'Choose club',noAccount:'Search for an account',unassigned:'Available',select:'Select',loading:'Loading licenses…',denied:'Sign in with an authorized Admin account to manage licenses.',failed:'Unable to load club licenses.',schema:'Club licenses schema is not available in this environment.',searchEmpty:'Enter at least two characters to find an account.',searchFailed:'Could not search accounts.',noResults:'No verified accounts found.',saved:'License updated.',conflict:'The license changed. The list has been refreshed.',error:'License change failed. Nothing was saved.',confirmReplace:'Replace the existing licensee for this club?',confirmRevoke:'Revoke the current license for this club?',none:'—',count:'clubs'},
  it:{manage:'Gestisci licenze club',intro:'Assegna un club a un account verificato. Nessun pagamento o scadenza è previsto in questa fase.',club:'Club',searchAccount:'Cerca un account per email',account:'Account',find:'Cerca',assign:'Assegna licenza',replace:'Cambia licenziatario',revoke:'Revoca licenza',clubs:'Club',licensee:'Licenziatario',updated:'Aggiornato',history:'Modifiche recenti alle licenze',date:'Data',action:'Operazione',previous:'Precedente',new:'Nuovo',all:'Tutti i club',assigned:'Assegnati',free:'Disponibili',choose:'Seleziona club',noAccount:'Cerca un account',unassigned:'Disponibile',select:'Seleziona',loading:'Caricamento licenze…',denied:'Accedi con un account Admin autorizzato per gestire le licenze.',failed:'Impossibile caricare le licenze.',schema:'La migrazione delle licenze club non è disponibile in questo ambiente.',searchEmpty:'Inserisci almeno due caratteri per cercare un account.',searchFailed:'Ricerca account non riuscita.',noResults:'Nessun account verificato trovato.',saved:'Licenza aggiornata.',conflict:'La licenza è cambiata. Elenco aggiornato.',error:'Modifica della licenza non riuscita. Nessun dato salvato.',confirmReplace:'Sostituire il licenziatario attuale di questo club?',confirmRevoke:'Revocare la licenza attuale di questo club?',none:'—',count:'club'},
  de:{manage:'Vereinslizenzen verwalten',intro:'Einem verifizierten Konto einen Verein zuweisen. Keine Zahlungen oder Ablaufregeln.',club:'Verein',searchAccount:'Konto per E-Mail suchen',account:'Konto',find:'Suchen',assign:'Lizenz zuweisen',replace:'Lizenznehmer wechseln',revoke:'Lizenz entziehen',clubs:'Vereine',licensee:'Lizenznehmer',updated:'Aktualisiert',history:'Letzte Lizenzänderungen',date:'Datum',action:'Aktion',previous:'Vorher',new:'Nachher',all:'Alle Vereine',assigned:'Lizenziert',free:'Verfügbar',choose:'Verein wählen',noAccount:'Konto suchen',unassigned:'Verfügbar',select:'Wählen',loading:'Lizenzen werden geladen…',denied:'Mit berechtigtem Admin-Konto anmelden.',failed:'Lizenzen konnten nicht geladen werden.',schema:'Lizenzdatenbank nicht verfügbar.',searchEmpty:'Mindestens zwei Zeichen eingeben.',searchFailed:'Kontosuche fehlgeschlagen.',noResults:'Keine verifizierten Konten gefunden.',saved:'Lizenz aktualisiert.',conflict:'Lizenz wurde geändert. Liste neu geladen.',error:'Änderung fehlgeschlagen. Keine Daten gespeichert.',confirmReplace:'Vorhandenen Lizenznehmer ersetzen?',confirmRevoke:'Aktuelle Lizenz entziehen?',none:'—',count:'Vereine'},
  es:{manage:'Gestionar licencias de clubes',intro:'Asigna un club a una cuenta verificada. Sin pagos ni reglas de caducidad.',club:'Club',searchAccount:'Buscar cuenta por correo',account:'Cuenta',find:'Buscar',assign:'Asignar licencia',replace:'Cambiar titular',revoke:'Revocar licencia',clubs:'Clubes',licensee:'Titular',updated:'Actualizado',history:'Cambios recientes',date:'Fecha',action:'Acción',previous:'Anterior',new:'Nuevo',all:'Todos los clubes',assigned:'Con licencia',free:'Disponibles',choose:'Elegir club',noAccount:'Buscar cuenta',unassigned:'Disponible',select:'Seleccionar',loading:'Cargando licencias…',denied:'Accede con una cuenta Admin autorizada.',failed:'No se pudieron cargar las licencias.',schema:'No está disponible la base de datos de licencias.',searchEmpty:'Introduce al menos dos caracteres.',searchFailed:'No se pudieron buscar cuentas.',noResults:'No hay cuentas verificadas.',saved:'Licencia actualizada.',conflict:'La licencia ha cambiado. Lista actualizada.',error:'Cambio fallido. No se guardaron datos.',confirmReplace:'¿Sustituir al titular actual?',confirmRevoke:'¿Revocar la licencia actual?',none:'—',count:'clubes'},
  fr:{manage:'Gérer les licences des clubs',intro:'Attribuer un club à un compte vérifié. Aucun paiement ni date d’expiration.',club:'Club',searchAccount:'Rechercher un compte par e-mail',account:'Compte',find:'Rechercher',assign:'Attribuer la licence',replace:'Changer le titulaire',revoke:'Révoquer',clubs:'Clubs',licensee:'Titulaire',updated:'Actualisé',history:'Modifications récentes',date:'Date',action:'Action',previous:'Avant',new:'Après',all:'Tous les clubs',assigned:'Sous licence',free:'Disponibles',choose:'Choisir un club',noAccount:'Rechercher un compte',unassigned:'Disponible',select:'Sélectionner',loading:'Chargement des licences…',denied:'Connectez-vous avec un compte Admin autorisé.',failed:'Impossible de charger les licences.',schema:'Le schéma des licences est indisponible.',searchEmpty:'Saisissez au moins deux caractères.',searchFailed:'Recherche des comptes impossible.',noResults:'Aucun compte vérifié trouvé.',saved:'Licence actualisée.',conflict:'La licence a changé. Liste actualisée.',error:'Modification échouée. Aucune donnée enregistrée.',confirmReplace:'Remplacer le titulaire actuel ?',confirmRevoke:'Révoquer la licence actuelle ?',none:'—',count:'clubs'}
 };
 function mount(win){
  const doc=win.document,host=doc.querySelector('#app-admin'),root=host?.querySelector('[data-admin-licenses]');
  if(!root)return;
  const el=q=>root.querySelector(q),gate=el('[data-licenses-gate]'),content=el('[data-licenses-content]');
  const club=el('[data-licenses-club]'),query=el('[data-licenses-query]'),account=el('[data-licenses-account]');
  const rows=el('[data-licenses-rows]'),history=el('[data-licenses-history]'),message=el('[data-licenses-message]');
  let data=null,working=false,loadCounter=0,searchCounter=0;
  const locale=()=>labels[doc.documentElement.lang]||labels.en;
  const l=k=>locale()[k]||labels.en[k]||k;
  const show=(value)=>{message.textContent=value||''};
  const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const selected=()=>data?.clubs?.find(x=>x.clubKey===club.value)||null;
  const formatDate=s=>Number.isSafeInteger(s)&&s>0
   ?new Intl.DateTimeFormat(doc.documentElement.lang||'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(s*1000)):l('none');
  function translate(){
   root.querySelectorAll('[data-licenses-copy]').forEach(node=>{node.textContent=l(node.dataset.licensesCopy)});
   query.placeholder=l('searchAccount');
   el('[data-licenses-club-search]').placeholder=l('clubs');
   if(data){populateClubs();render();}
  }
  function option(value,text){const node=doc.createElement('option');node.value=value;node.textContent=text;return node}
  function populateClubs(){
   const current=club.value;club.replaceChildren(option('',l('choose')));
   for(const c of data.clubs)club.append(option(c.clubKey,c.name+' ('+c.clubKey+')'));
   club.value=data.clubs.some(c=>c.clubKey===current)?current:'';
   club.disabled=false;controls();
  }
  function clearAccounts(){
   account.replaceChildren(option('',l('noAccount')));
   account.disabled=true;controls();
  }
  function controls(){
   const target=selected(),active=!!target?.accountId;
   el('[data-licenses-assign]').disabled=working||!target||!account.value||account.value===target.accountId;
   el('[data-licenses-assign]').textContent=l(active?'replace':'assign');
   el('[data-licenses-revoke]').disabled=working||!active;
   club.disabled=working||!data;
   query.disabled=working||!data;
   el('[data-licenses-find]').disabled=working||!data;
   account.disabled=working||!data||account.options.length<=1;
  }
  function cell(tr,text){const td=doc.createElement('td');td.textContent=String(text??'');tr.append(td);return td}
  function render(){
   if(!data)return;
   const value=normalize(el('[data-licenses-club-search]').value),state=el('[data-licenses-status-filter]').value;
   const filtered=data.clubs.filter(c=>(state==='all'||(state==='assigned')===!!c.accountId)&&
    (!value||normalize(c.name+' '+c.clubKey+' '+(c.accountEmail||'')).includes(value)));
   el('[data-licenses-count]').textContent=filtered.length+' '+l('count');
   rows.replaceChildren();
   for(const c of filtered){
    const tr=doc.createElement('tr');if(c.clubKey===club.value)tr.classList.add('is-selected');
    cell(tr,c.name+' ('+c.clubKey+')');
    cell(tr,c.accountEmail||c.accountId||l('unassigned'));
    cell(tr,formatDate(c.updatedAt));
    const td=cell(tr,'');const button=doc.createElement('button');
    button.type='button';button.className='app-link app-link-secondary';button.textContent=l('select');
    button.addEventListener('click',()=>{club.value=c.clubKey;clearAccounts();show('');controls();render();club.focus()});
    td.append(button);rows.append(tr);
   }
   if(!filtered.length){const tr=doc.createElement('tr');const td=cell(tr,l('none'));td.colSpan=4;rows.append(tr)}
   rows.setAttribute('aria-busy','false');
   history.replaceChildren();
   const name=new Map(data.clubs.map(c=>[c.clubKey,c.name]));
   for(const e of data.history){
    const tr=doc.createElement('tr');
    cell(tr,formatDate(e.occurredAt));cell(tr,name.get(e.clubKey)||e.clubKey);
    cell(tr,e.action);cell(tr,e.previousEmail||e.previousAccountId||l('none'));
    cell(tr,e.accountEmail||e.accountId||l('none'));history.append(tr);
   }
   if(!data.history.length){const tr=doc.createElement('tr');const td=cell(tr,l('none'));td.colSpan=5;history.append(tr)}
   controls();
  }
  async function request(path,body){
   const response=await win.fetch(path,{method:body?'POST':'GET',cache:'no-store',
    credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRF-Token':body.csrf}:undefined,
    body:body?JSON.stringify(body.payload):undefined});
   let result;try{result=await response.json()}catch{throw Error('http_'+response.status)}
   if(!response.ok)throw Error(result?.error?.code||'http_'+response.status);
   return result;
  }
  async function load(){
   const ticket=++loadCounter;
   try{
    const result=await request('/api/admin/club-licenses');
    if(ticket!==loadCounter)return;
    if(!Array.isArray(result.clubs)||!Array.isArray(result.history)||result.clubs.length!==320)throw Error('invalid_data');
    data=result;content.hidden=false;gate.hidden=true;
    populateClubs();render();
   }catch(error){
    if(ticket!==loadCounter)return;
    content.hidden=true;gate.hidden=false;
    gate.textContent=/club_licenses_schema_unavailable/.test(String(error))?l('schema'):
     /unauthorized|permission_denied|http_401|http_403/.test(String(error))?l('denied'):l('failed');
   }
  }
  async function lookup(){
   if(working||!data)return;
   clearAccounts();
   const q=query.value.trim();
   if(q.length<2){show(l('searchEmpty'));return}
   const ticket=++searchCounter;show('');
   try{
    const result=await request('/api/admin/club-licenses/accounts?q='+encodeURIComponent(q));
    if(ticket!==searchCounter)return;
    if(!Array.isArray(result.accounts))throw Error('invalid_accounts');
    for(const a of result.accounts){
     if(typeof a.id==='string'&&typeof a.email==='string')account.append(option(a.id,a.email));
    }
    account.disabled=account.options.length<=1;
    show(result.accounts.length?'':l('noResults'));
   }catch{if(ticket===searchCounter)show(l('searchFailed'))}
   controls();
  }
  async function mutate(accountId){
   const c=selected();if(!c||working)return;
   if(accountId===c.accountId)return;
   if(c.accountId&&accountId!==null&&!win.confirm(l('confirmReplace')))return;
   if(accountId===null&&c.accountId&&!win.confirm(l('confirmRevoke')))return;
   working=true;controls();show('');
   try{
    const session=await request('/api/admin/session');
    if(typeof session.csrfToken!=='string'||!session.csrfToken)throw Error('csrf_missing');
    await request('/api/admin/club-licenses',{
     csrf:session.csrfToken,
     payload:{clubKey:c.clubKey,accountId,expectedAccountId:c.accountId,expectedVersion:c.version}
    });
    const key=c.clubKey;await load();club.value=key;clearAccounts();render();show(l('saved'));
   }catch(error){
    if(String(error).includes('stale_club_license')){await load();show(l('conflict'))}
    else show(l('error'));
   }finally{working=false;controls()}
  }
  host.hidden=false;
  root.hidden=false;
  gate.textContent=l('loading');
  translate();
  el('[data-licenses-find]').addEventListener('click',lookup);
  query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookup()}});
  query.addEventListener('input',()=>{searchCounter++;clearAccounts()});
  account.addEventListener('change',controls);
  club.addEventListener('change',()=>{clearAccounts();render()});
  el('[data-licenses-assign]').addEventListener('click',()=>mutate(account.value||null));
  el('[data-licenses-revoke]').addEventListener('click',()=>mutate(null));
  el('[data-licenses-club-search]').addEventListener('input',render);
  el('[data-licenses-status-filter]').addEventListener('change',render);
  const obs=new win.MutationObserver(()=>translate());
  obs.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
 }
 return {mount};
});
