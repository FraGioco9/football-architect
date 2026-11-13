/* Admin Contracts: guarded current-state affiliation, never an economic contract. */
((root,factory)=>{
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const copy={
  en:{heading:'Player–club affiliations',intro:'One current club per persisted player. No durations, salaries or fees.',findLabel:'Player ID',find:'Find',all:'All players',id:'ID',player:'Player',club:'Club',action:'Action',previous:'Previous',next:'Next',edit:'Edit affiliation',targetClub:'Club',unassigned:'Unassigned',save:'Save',unassign:'Unassign',cancel:'Cancel',change:'Change',page:'Page',of:'of',players:'players',busy:'Saving…',loading:'Loading affiliations…',saved:'Affiliation saved.',notFound:'No player has that ID.',invalid:'Enter a positive numeric player ID.',failed:'Unable to load affiliations.',writeFailed:'Save failed. Refresh and retry.',stale:'World or affiliation changed. Refresh and retry.'},
  it:{heading:'Affiliazioni giocatore–club',intro:'Un solo club attuale per giocatore salvato. Nessuna durata, stipendio o costo.',findLabel:'ID giocatore',find:'Cerca',all:'Tutti i giocatori',id:'ID',player:'Giocatore',club:'Club',action:'Azione',previous:'Precedente',next:'Successiva',edit:'Modifica affiliazione',targetClub:'Club',unassigned:'Senza club',save:'Salva',unassign:'Svincola',cancel:'Annulla',change:'Modifica',page:'Pagina',of:'di',players:'giocatori',busy:'Salvataggio…',loading:'Caricamento affiliazioni…',saved:'Affiliazione salvata.',notFound:'Nessun giocatore con questo ID.',invalid:'Inserisci un ID numerico positivo.',failed:'Impossibile caricare le affiliazioni.',writeFailed:'Salvataggio non riuscito. Ricarica e riprova.',stale:'Mondo o affiliazione cambiata. Ricarica e riprova.'},
  de:{heading:'Spieler–Verein-Zuordnungen',intro:'Ein aktueller Verein pro gespeichertem Spieler. Keine Laufzeiten, Gehälter oder Gebühren.',findLabel:'Spieler-ID',find:'Suchen',all:'Alle Spieler',id:'ID',player:'Spieler',club:'Verein',action:'Aktion',previous:'Zurück',next:'Weiter',edit:'Zuordnung bearbeiten',targetClub:'Verein',unassigned:'Ohne Verein',save:'Speichern',unassign:'Zuordnung lösen',cancel:'Abbrechen',change:'Ändern',page:'Seite',of:'von',players:'Spieler',busy:'Speichern…',loading:'Zuordnungen laden…',saved:'Zuordnung gespeichert.',notFound:'Kein Spieler mit dieser ID.',invalid:'Positive Spieler-ID eingeben.',failed:'Zuordnungen nicht verfügbar.',writeFailed:'Speichern fehlgeschlagen. Neu laden.',stale:'Welt oder Zuordnung geändert. Neu laden.'},
  es:{heading:'Vínculos jugador–club',intro:'Un club actual por jugador guardado. Sin duración, salarios ni tarifas.',findLabel:'ID del jugador',find:'Buscar',all:'Todos los jugadores',id:'ID',player:'Jugador',club:'Club',action:'Acción',previous:'Anterior',next:'Siguiente',edit:'Editar vínculo',targetClub:'Club',unassigned:'Sin club',save:'Guardar',unassign:'Desvincular',cancel:'Cancelar',change:'Cambiar',page:'Página',of:'de',players:'jugadores',busy:'Guardando…',loading:'Cargando vínculos…',saved:'Vínculo guardado.',notFound:'No hay jugador con ese ID.',invalid:'Introduce un ID numérico positivo.',failed:'No se pueden cargar vínculos.',writeFailed:'No se pudo guardar. Recarga e inténtalo.',stale:'El mundo o vínculo cambió. Recarga.'},
  fr:{heading:'Affiliations joueur–club',intro:'Un club actuel par joueur enregistré. Sans durée, salaire ni frais.',findLabel:'ID du joueur',find:'Rechercher',all:'Tous les joueurs',id:'ID',player:'Joueur',club:'Club',action:'Action',previous:'Précédent',next:'Suivant',edit:'Modifier affiliation',targetClub:'Club',unassigned:'Sans club',save:'Enregistrer',unassign:'Désaffilier',cancel:'Annuler',change:'Modifier',page:'Page',of:'sur',players:'joueurs',busy:'Enregistrement…',loading:'Chargement des affiliations…',saved:'Affiliation enregistrée.',notFound:'Aucun joueur avec cet ID.',invalid:'Saisissez un ID numérique positif.',failed:'Chargement impossible.',writeFailed:'Enregistrement impossible. Rechargez.',stale:'Le monde ou affiliation a changé. Rechargez.'}
 };
 function mount(win){
  const doc=win.document,host=doc.querySelector('#app-admin'),root=host?.querySelector('[data-admin-contracts]');
  if(!root)return;
  const el=selector=>root.querySelector(selector),tbody=el('[data-contracts-rows]');
  const select=el('[data-contracts-select]'),editor=el('[data-contracts-editor]');
  const search=el('[data-contracts-find-input]'),status=el('[data-contracts-message]');
  const permissionCache=win.faAdminPermissionsCache?.create(win);
  const save=el('[data-contracts-save]'),unassign=el('[data-contracts-unassign]');
  let allowed=false,busy=false,epoch=0,page=1,filterId=null,selected=null,chosen=null,record=null,clubs=null;
  const tr=()=>copy[doc.documentElement.lang]||copy.en;
  const label=key=>tr()[key]||copy.en[key];
  const clubName=key=>key===null?label('unassigned'):(clubs?.find(c=>c.clubKey===key)?.name||key);
  const message=value=>{status.textContent=value||''};
  function buttons(){
   save.disabled=!allowed||busy||!selected||chosen===selected.clubKey;
   unassign.disabled=!allowed||busy||!selected||selected.clubKey===null;
   el('[data-contracts-working]').textContent=busy?label('busy'):'';
  }
  function closeEditor(){selected=null;chosen=null;editor.hidden=true;buttons();}
  function paint(access){
   allowed=access;host.hidden=!access;root.hidden=!access;host.dataset.adminAccess=access?'granted':'denied';
   win.faAdminAccess=access;win.dispatchEvent(new CustomEvent('fa:admin-access',{detail:access}));
   if(!access){record=null;closeEditor();tbody.replaceChildren();}
  }
  function render(){
   if(!record)return;
   tbody.replaceChildren();
   for(const p of record.players){
    const row=doc.createElement('tr');
    for(const val of [p.id,p.name,clubName(p.clubKey)]){
     const td=doc.createElement('td');td.textContent=String(val);row.append(td);
    }
    const cell=doc.createElement('td'),button=doc.createElement('button');
    button.type='button';button.className='app-link app-link-secondary';
    button.textContent=label('change');button.dataset.contractsEdit=String(p.id);button.disabled=busy||!allowed;
    cell.append(button);row.append(cell);tbody.append(row);
   }
   tbody.setAttribute('aria-busy','false');
   el('[data-contracts-total]').textContent=record.count+' '+label('players');
   el('[data-contracts-page]').textContent=label('page')+' '+record.page+' '+label('of')+' '+record.totalPages;
   el('[data-contracts-prev]').disabled=busy||filterId!==null||page<=1;
   el('[data-contracts-next]').disabled=busy||filterId!==null||page>=record.totalPages;
  }
  function translate(){
   root.querySelectorAll('[data-contracts-copy]').forEach(n=>{
    if(label(n.dataset.contractsCopy))n.textContent=label(n.dataset.contractsCopy);
   });
   if(selected)el('[data-contracts-selected]').textContent='#'+selected.id+' · '+selected.name+' · '+clubName(selected.clubKey);
   buttons();render();
  }
  function populateClubs(){
   if(!clubs||select.options.length>1)return;
   const fragment=doc.createDocumentFragment();
   for(const c of clubs){
    const option=doc.createElement('option');option.value=c.clubKey;
    option.textContent=c.name+' · '+c.clubKey;fragment.append(option);
   }
   select.append(fragment);
  }
  function openEditor(p){
   if(!allowed||busy)return;
   selected=p;chosen=p.clubKey;select.value=p.clubKey??'';
   editor.hidden=false;el('[data-contracts-selected]').textContent='#'+p.id+' · '+p.name+' · '+clubName(p.clubKey);
   buttons();select.focus();
  }
  async function load(){
   if(!allowed)return;
   const ticket=++epoch;closeEditor();message(label('loading'));tbody.setAttribute('aria-busy','true');
   try{
    const query=filterId===null?'?page='+page:'?playerId='+filterId;
    const response=await win.fetch('/api/admin/contracts'+query,{credentials:'same-origin',cache:'no-store'});
    const payload=await response.json();
    if(ticket!==epoch||!allowed)return;
    if(!response.ok){if(response.status===401||response.status===403)permissionCache?.clear();throw Error(payload?.error?.code||'http_'+response.status);}
    if(!Array.isArray(payload?.players)||!Array.isArray(payload?.clubs)||typeof payload.worldGeneration!=='string'||!Number.isSafeInteger(payload.worldRevision))throw Error('invalid_contract_data');
    record=payload;clubs=payload.clubs;populateClubs();render();message('');
   }catch(error){
    if(ticket!==epoch)return;
    record=null;tbody.replaceChildren();tbody.setAttribute('aria-busy','false');
    el('[data-contracts-total]').textContent='';el('[data-contracts-page]').textContent='';
    el('[data-contracts-prev]').disabled=true;el('[data-contracts-next]').disabled=true;
    message(error.message==='player_not_found'?label('notFound'):label('failed'));
    if(/^(unauthorized|permission_denied|http_401|http_403)$/.test(error.message))paint(false);
   }
  }
  async function mutate(target){
   if(!allowed||busy||!selected||!record||target===selected.clubKey)return;
   busy=true;buttons();message('');
   const ticket=++epoch,p=selected,world=record;
   try{
    const session=await win.fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
    if(!session.ok){if(session.status===401||session.status===403)permissionCache?.clear();throw Error('auth_'+session.status);}
    const auth=await session.json();if(typeof auth.csrfToken!=='string'||!auth.csrfToken)throw Error('csrf_missing');
    const response=await win.fetch('/api/admin/contracts',{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken},
     body:JSON.stringify({playerId:p.id,clubKey:target,expectedClubKey:p.clubKey,
      expectedGeneration:world.worldGeneration,expectedRevision:world.worldRevision})
    });
    const payload=await response.json();
    if(ticket!==epoch||!allowed)return;
    if(!response.ok)throw Error(payload?.error?.code||'http_'+response.status);
    busy=false;buttons();await load();message(label('saved'));
   }catch(error){
    if(ticket!==epoch)return;
    message(/stale_world|stale_player_contract/.test(error.message)?label('stale'):label('writeFailed'));
    if(/auth_401|auth_403|permission_denied/.test(error.message))paint(false);
   }finally{busy=false;buttons();}
  }
  async function check(){
   const ticket=++epoch;paint(false);
   const accept=permissions=>{
    const permitted=['admin.access','admin.world.read','admin.world.write'].every(k=>permissions.includes(k));
    paint(permitted);if(permitted)void load();
   };
   const cached=permissionCache?.read();
   if(cached!==null&&cached!==undefined){accept(cached);return;}
   try{
    const response=await win.fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok){if(response.status===401)permissionCache?.write([]);throw Error('permissions')}
    const payload=await response.json();
    if(ticket!==epoch)return;
    const permissions=Array.isArray(payload.permissions)?payload.permissions:[];
    permissionCache?.write(permissions);accept(permissions);
   }catch{if(ticket===epoch)paint(false)}
  }
  el('[data-contracts-search-form]').addEventListener('submit',event=>{
   event.preventDefault();
   const raw=search.value.trim();
   if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(Number(raw))){message(label('invalid'));return;}
   filterId=Number(raw);page=1;void load();
  });
  el('[data-contracts-clear]').addEventListener('click',()=>{search.value='';filterId=null;page=1;void load()});
  el('[data-contracts-prev]').addEventListener('click',()=>{if(!busy&&page>1){page--;void load()}});
  el('[data-contracts-next]').addEventListener('click',()=>{if(!busy&&record&&page<record.totalPages){page++;void load()}});
  tbody.addEventListener('click',event=>{
   const target=event.target.closest('button[data-contracts-edit]');
   if(!target)return;
   const p=record?.players.find(x=>x.id===Number(target.dataset.contractsEdit));
   if(p)openEditor(p);
  });
  select.addEventListener('change',()=>{chosen=select.value||null;buttons()});
  save.addEventListener('click',()=>{void mutate(chosen)});
  unassign.addEventListener('click',()=>{void mutate(null)});
  el('[data-contracts-cancel]').addEventListener('click',closeEditor);
  new MutationObserver(translate).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  // Permission cache is per-tab and refreshed only on a full navigation/refresh.
  translate();void check();
 }
 return {mount};
});
