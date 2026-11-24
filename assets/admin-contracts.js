/* #777 Admin Contracts: inspect and prepare genuine terms; no legacy assignment. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root.document)api.mount(root)})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const compactPlayerName=full=>{const m=/^(\S+)\s+(.+)$/u.exec(String(full||'').trim());return m&&!/^\p{L}\.$/u.test(m[1])?Array.from(m[1])[0]+'. '+m[2]:String(full||'').trim()};
 const flags={ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'};
 const labels={"en":{"playersHeading":"Players","nationality":"","player":"Player","club":"Club","salary":"Salary (ARC/season)","duration":"Duration","start":"Starts","end":"Ends","signed":"Signed","unassigned":"Free Agent","previous":"Previous","next":"Next","of":"of","page":"Page","players":"players","season":"S","day":"D","seasons":"seasons","empty":"No players available.","failed":"Unable to load contracts.","unavailable":"Contracts unavailable."},"it":{"playersHeading":"Giocatori","nationality":"","player":"Giocatore","club":"Club","salary":"Stipendio (ARC/stagione)","duration":"Durata","start":"Inizio","end":"Fine","signed":"Firma","unassigned":"Svincolato","previous":"Precedente","next":"Successiva","of":"di","page":"Pagina","players":"giocatori","season":"S","day":"G","seasons":"stagioni","empty":"Nessun giocatore disponibile.","failed":"Impossibile caricare i contratti.","unavailable":"Contratti non disponibili."},"de":{"playersHeading":"Spieler","nationality":"","player":"Spieler","club":"Verein","salary":"Gehalt (ARC/Saison)","duration":"Laufzeit","start":"Beginn","end":"Ende","signed":"Unterzeichnet","unassigned":"Vereinslos","previous":"Zurück","next":"Weiter","of":"von","page":"Seite","players":"Spieler","season":"S","day":"T","seasons":"Saisons","empty":"Keine Spieler.","failed":"Verträge konnten nicht geladen werden.","unavailable":"Verträge nicht verfügbar."},"es":{"playersHeading":"Jugadores","nationality":"","player":"Jugador","club":"Club","salary":"Sueldo (ARC/temporada)","duration":"Duración","start":"Inicio","end":"Fin","signed":"Firma","unassigned":"Agente libre","previous":"Anterior","next":"Siguiente","of":"de","page":"Página","players":"jugadores","season":"T","day":"D","seasons":"temporadas","empty":"No hay jugadores.","failed":"No se pudieron cargar los contratos.","unavailable":"Contratos no disponibles."},"fr":{"playersHeading":"Joueurs","nationality":"","player":"Joueur","club":"Club","salary":"Salaire (ARC/saison)","duration":"Durée","start":"Début","end":"Fin","signed":"Signature","unassigned":"Libre","previous":"Précédent","next":"Suivant","of":"sur","page":"Page","players":"joueurs","season":"S","day":"J","seasons":"saisons","empty":"Aucun joueur.","failed":"Impossible de charger les contrats.","unavailable":"Contrats indisponibles."}};
 const draftLabels={"en":{"minimumSalary":"Minimum","newContract":"New contract","representation":"Representation","previewContract":"Preview","signContract":"Sign contract","ai":"AI","human":"Human","signBlocked":"Signing unavailable: financial checks pending.","previewFailed":"Preview failed. Try again.","sessionExpired":"Session expired. Sign in again.","accessChanged":"Access changed. Refresh the page.","staleWorld":"World changed. Refresh the page.","playerIneligible":"Player no longer eligible. Refresh.","clubIneligible":"Club is not eligible.","dayUnavailable":"No sporting day available.","loadFailed":"Contracts unavailable. Refresh the page.","noEligible":"No eligible players on this page.","signedOk":"Contract signed.","quoteReady":"Quote ready. Review and sign.","quoteChanged":"Quote changed. Prepare again.","insufficientFunds":"Insufficient treasury funds.","openingStaged":"Opening World is locked.","openingOnly":"Initial AI contracts only.","consentRequired":"Human consent required.","signFailed":"Signing failed. Retry.","genesisNotReady":"Initial funding incomplete."},"it":{"minimumSalary":"Minimo","newContract":"Nuovo contratto","representation":"Rappresentanza","previewContract":"Anteprima","signContract":"Firma contratto","ai":"IA","human":"Umano","signBlocked":"Firma non disponibile: verifiche economiche in attesa.","previewFailed":"Anteprima non riuscita. Riprova.","sessionExpired":"Sessione scaduta. Accedi di nuovo.","accessChanged":"Accesso cambiato. Aggiorna la pagina.","staleWorld":"Mondo aggiornato. Ricarica la pagina.","playerIneligible":"Giocatore non idoneo. Aggiorna.","clubIneligible":"Club non idoneo.","dayUnavailable":"Nessuna giornata sportiva disponibile.","loadFailed":"Contratti non disponibili. Aggiorna.","noEligible":"Nessun giocatore idoneo in questa pagina.","signedOk":"Contratto firmato.","quoteReady":"Anteprima pronta. Verifica e firma.","quoteChanged":"Termini cambiati. Rifai l’anteprima.","insufficientFunds":"Fondi del club insufficienti.","openingStaged":"Opening World bloccato.","openingOnly":"Solo contratti iniziali AI.","consentRequired":"Consenso umano necessario.","signFailed":"Firma non riuscita. Riprova.","genesisNotReady":"Finanziamento iniziale incompleto."},"de":{"minimumSalary":"Minimum","newContract":"Neuer Vertrag","representation":"Vertretung","previewContract":"Vorschau","signContract":"Vertrag unterschreiben","ai":"KI","human":"Mensch","signBlocked":"Signatur nicht verfügbar: Finanzprüfung offen.","previewFailed":"Vorschau fehlgeschlagen. Erneut versuchen.","sessionExpired":"Sitzung abgelaufen. Erneut anmelden.","accessChanged":"Zugriff geändert. Seite neu laden.","staleWorld":"Spielwelt geändert. Seite neu laden.","playerIneligible":"Spieler nicht berechtigt. Neu laden.","clubIneligible":"Verein nicht berechtigt.","dayUnavailable":"Kein Spieltag verfügbar.","loadFailed":"Verträge nicht verfügbar. Neu laden.","noEligible":"Keine berechtigten Spieler auf dieser Seite.","signedOk":"Vertrag unterzeichnet.","quoteReady":"Angebot prüfen und unterschreiben.","quoteChanged":"Angebot geändert. Neu prüfen.","insufficientFunds":"Vereinsmittel nicht ausreichend.","openingStaged":"Spielweltaufbau gesperrt.","openingOnly":"Nur initiale KI-Verträge.","consentRequired":"Menschliche Zustimmung nötig.","signFailed":"Signatur fehlgeschlagen. Erneut versuchen.","genesisNotReady":"Startfinanzierung unvollständig."},"es":{"minimumSalary":"Mínimo","newContract":"Nuevo contrato","representation":"Representación","previewContract":"Vista previa","signContract":"Firmar contrato","ai":"IA","human":"Humano","signBlocked":"Firma no disponible: comprobaciones financieras pendientes.","previewFailed":"Vista previa fallida. Reintenta.","sessionExpired":"Sesión caducada. Inicia sesión de nuevo.","accessChanged":"Acceso cambiado. Recarga la página.","staleWorld":"Mundo actualizado. Recarga la página.","playerIneligible":"Jugador no elegible. Recarga.","clubIneligible":"Club no elegible.","dayUnavailable":"No hay jornada deportiva disponible.","loadFailed":"Contratos no disponibles. Recarga.","noEligible":"No hay jugadores elegibles en esta página.","signedOk":"Contrato firmado.","quoteReady":"Revisa y firma el contrato.","quoteChanged":"Oferta cambiada. Prepara otra.","insufficientFunds":"Fondos del club insuficientes.","openingStaged":"Mundo inicial bloqueado.","openingOnly":"Solo contratos iniciales IA.","consentRequired":"Consentimiento humano necesario.","signFailed":"Firma fallida. Reintenta.","genesisNotReady":"Financiación inicial incompleta."},"fr":{"minimumSalary":"Minimum","newContract":"Nouveau contrat","representation":"Représentation","previewContract":"Aperçu","signContract":"Signer le contrat","ai":"IA","human":"Humain","signBlocked":"Signature indisponible : contrôles financiers en attente.","previewFailed":"Échec de l’aperçu. Réessayez.","sessionExpired":"Session expirée. Reconnectez-vous.","accessChanged":"Accès modifié. Actualisez la page.","staleWorld":"Monde modifié. Actualisez la page.","playerIneligible":"Joueur non éligible. Actualisez.","clubIneligible":"Club non éligible.","dayUnavailable":"Aucune journée sportive disponible.","loadFailed":"Contrats indisponibles. Actualisez.","noEligible":"Aucun joueur éligible sur cette page.","signedOk":"Contrat signé.","quoteReady":"Vérifiez et signez le contrat.","quoteChanged":"Offre modifiée. Recommencez.","insufficientFunds":"Fonds du club insuffisants.","openingStaged":"Monde initial verrouillé.","openingOnly":"Contrats initiaux IA seulement.","consentRequired":"Consentement humain nécessaire.","signFailed":"Échec de signature. Réessayez.","genesisNotReady":"Financement initial incomplet."}};
 function mount(win){
  const doc=win.document,host=doc.querySelector('#app-admin'),root=host?.querySelector('[data-admin-contracts]');if(!root)return;
  const el=q=>root.querySelector(q),rows=el('[data-contracts-rows]'),status=el('[data-contracts-message]');
  const permissionCache=win.faAdminPermissionsCache?.create(win);
  let allowed=false,writer=false,epoch=0,page=1,record=null,readAbort=null,draftEpoch=0,draftBusy=false,draftLocked=false,draftMessageKey='',listMessageKey='',acceptedQuote=null,signing=false;
  const form=el('[data-contract-draft]'),playerSelect=el('[data-contract-draft-player]'),clubSelect=el('[data-contract-draft-club]'),durationSelect=el('[data-contract-draft-duration]'),previewButton=el('[data-contract-draft-preview]'),draftMessage=el('[data-contract-draft-message]');
  const signButton=el('[data-contract-draft-sign]');
  const t=()=>labels[doc.documentElement.lang]||labels.en,l=k=>t()[k]??draftLabels[doc.documentElement.lang]?.[k]??labels.en[k]??draftLabels.en[k];
  const report=key=>{listMessageKey=key;status.textContent=key?l(key):''};
  const reportDraft=key=>{draftMessageKey=key;draftMessage.textContent=key?l(key):''};
  const clearTerms=()=>{for(const k of ['salary','start','end','agent','minimum'])el('[data-contract-draft-'+k+']').textContent='—'};
  function previewError(code,status){
   if(status===401){draftLocked=true;return 'sessionExpired'}
   if(status===403){draftLocked=true;return 'accessChanged'}
   if(code==='stale_world'){draftLocked=true;return 'staleWorld'}
   if(code==='contract_player_ineligible'){draftLocked=true;return 'playerIneligible'}
   if(code==='contract_club_ineligible')return 'clubIneligible';
   if(code==='contract_sporting_day_unavailable')return 'dayUnavailable';
   if(code==='contract_quote_changed'||code==='contract_signing_preconditions_changed')return 'quoteChanged';
   if(code==='contract_insufficient_cash_proof')return 'insufficientFunds';
   if(code==='contract_opening_staged')return 'openingStaged';
   if(code==='contract_genesis_not_ready')return 'genesisNotReady';
   if(code==='contract_opening_only')return 'openingOnly';
   if(code==='contract_human_consent_required')return 'consentRequired';
   return 'previewFailed';
  }
  function unavailableRows(key){
   const fragment=doc.createDocumentFragment();
   for(let i=0;i<5;i++){
    const row=doc.createElement('tr'),cell=doc.createElement('td');
    row.className='admin-contracts-empty-row';row.setAttribute('aria-hidden','true');
    cell.colSpan=8;if(i===0){cell.className='admin-contracts-empty-message';cell.textContent=l(key)}
    row.append(cell);fragment.append(row);
   }
   rows.replaceChildren(fragment);
  }

  const mountDropdown=win.faAdminDropdowns?.(win,'admin-contract-draft');
  const dropdowns=mountDropdown?[mountDropdown(playerSelect,true,0),mountDropdown(clubSelect,true,1),mountDropdown(durationSelect,false,2)]:[];
  function draftReset(){
   draftEpoch++;draftBusy=false;acceptedQuote=null;signing=false;
   clearTerms();
   if(!draftLocked)reportDraft(writer&&record?playerSelect.options.length<=1?'noEligible':'signBlocked':'');
   draftControls();
  }
  function draftControls(){
   const ready=allowed&&writer&&!!record&&!readAbort&&!draftLocked;
   form.dataset.draftState=host.dataset.adminAccess==='pending'||readAbort?'loading':signing?'signing':draftBusy?'preview':'ready';
   for(const select of [playerSelect,clubSelect,durationSelect])select.disabled=!ready||draftBusy;
   previewButton.disabled=!ready||draftBusy||!playerSelect.value||!clubSelect.value;
   signButton.disabled=!ready||draftBusy||!acceptedQuote;
   dropdowns.forEach(sync=>sync());
  }
  function options(select,items){
   const selected=select.value,first=doc.createElement('option');first.value='';first.textContent='—';
   const list=items.map(([value,label])=>{const option=doc.createElement('option');option.value=String(value);option.textContent=label;return option});
   select.replaceChildren(first,...list);
   if([...select.options].some(o=>o.value===selected))select.value=selected;
  }
  function refreshDraft(){
   options(playerSelect,(record?.players||[]).filter(p=>p.contract===null&&p.canPrepareContract===true).map(p=>[p.id,p.name]));
   options(clubSelect,(record?.clubs||[]).map(c=>[c.clubKey,c.name]));
   draftReset();
  }
  form.addEventListener('change',draftReset);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!writer||!allowed||!record||previewButton.disabled)return;
   const ticket=++draftEpoch;
   const request={playerId:Number(playerSelect.value),clubKey:clubSelect.value,durationSeasons:Number(durationSelect.value),expectedGeneration:record.worldGeneration,expectedRevision:record.worldRevision};
   acceptedQuote=null;clearTerms();reportDraft('');draftBusy=true;draftControls();
   try{
    const session=await win.fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
    if(ticket!==draftEpoch||!writer||!allowed)return;
    if(!session.ok){reportDraft(previewError('',session.status));return}
    const {csrfToken}=await session.json();
    if(ticket!==draftEpoch||!writer||!allowed)return;
    const res=await win.fetch('/api/admin/contracts/preview',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(request)});
    const quote=await res.json();
    if(ticket!==draftEpoch||!writer||!allowed)return;
    if(!res.ok){reportDraft(previewError(quote?.error?.code,res.status));return}
    if(quote.playerId!==request.playerId||quote.clubKey!==request.clubKey||quote.durationSeasons!==request.durationSeasons||typeof quote.signable!=='boolean'||!Number.isSafeInteger(quote.startTick)||quote.startTick<0||!Number.isSafeInteger(quote.endTick)||quote.endTick<=quote.startTick||!['human','ai'].includes(quote.representation)||!Number.isSafeInteger(quote.minimumArc)||quote.minimumArc<=0)throw Error('preview');
    el('[data-contract-draft-start]').textContent=sporting(quote.startTick);
    el('[data-contract-draft-end]').textContent=sporting(quote.endTick-1);
    el('[data-contract-draft-agent]').textContent=l(quote.representation);
    el('[data-contract-draft-minimum]').textContent=new Intl.NumberFormat(doc.documentElement.lang||'en').format(quote.minimumArc)+' ARC';
    if(quote.signable){
     if(quote.representation!=='ai'||!Number.isSafeInteger(quote.annualSalaryArc)||quote.annualSalaryArc<quote.minimumArc||typeof quote.quoteHash!=='string'||!/^[a-f0-9]{64}$/.test(quote.quoteHash))throw Error('preview');
     el('[data-contract-draft-salary]').textContent=new Intl.NumberFormat(doc.documentElement.lang||'en').format(quote.annualSalaryArc);
     acceptedQuote={request:{...request,quoteHash:quote.quoteHash},key:win.crypto.randomUUID()};reportDraft('quoteReady');
    }else{const blocker=quote.blockers?.[0];reportDraft(['contract_insufficient_cash_proof','contract_genesis_not_ready','contract_opening_staged','contract_opening_only','contract_human_consent_required','contract_quote_changed','contract_signing_preconditions_changed'].includes(blocker)?previewError(blocker,409):'signBlocked')}
   }catch{if(ticket===draftEpoch){clearTerms();reportDraft('previewFailed')}}
   finally{if(ticket===draftEpoch){draftBusy=false;draftControls()}}
  });

  signButton.addEventListener('click',async()=>{
   if(signButton.disabled||!acceptedQuote||signing)return;
   const ticket=++draftEpoch,pending=acceptedQuote;
   signing=true;draftBusy=true;reportDraft('');controls();
   try{
    const session=await win.fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
    if(ticket!==draftEpoch||!writer||!allowed)return;
    if(!session.ok){reportDraft(previewError('',session.status));return}
    const {csrfToken}=await session.json();
    if(ticket!==draftEpoch||!writer||!allowed)return;
    const res=await win.fetch('/api/admin/contracts/sign',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken,'Idempotency-Key':pending.key},body:JSON.stringify(pending.request)});
    const outcome=await res.json();
    if(ticket!==draftEpoch||!writer||!allowed)return;
    if(!res.ok){acceptedQuote=null;clearTerms();reportDraft(previewError(outcome?.error?.code,res.status));return}
    if(typeof outcome.operationId!=='string'||outcome.world?.generation!==pending.request.expectedGeneration||outcome.world?.revision!==pending.request.expectedRevision+1)throw Error('sign');
    acceptedQuote=null;await load();if(allowed&&writer&&record&&record.worldRevision>=outcome.world.revision)reportDraft('signedOk');
   }catch{if(ticket===draftEpoch)reportDraft('signFailed')}
   finally{if(ticket===draftEpoch){signing=false;draftBusy=false;controls()}}
  });
  function controls(){
   draftControls();
   el('[data-contracts-prev]').disabled=signing||!allowed||!record||page<=1;
   el('[data-contracts-next]').disabled=signing||!allowed||!record||page>=record.totalPages;
  }
  function loading(){
   root.dataset.contractsState='loading';
   if(rows.childElementCount===5&&[...rows.children].every(row=>row.classList.contains('admin-contracts-skeleton'))){rows.setAttribute('aria-busy','true');return}
   const fragment=doc.createDocumentFragment();
   for(let i=0;i<5;i++){const tr=doc.createElement('tr');tr.className='admin-contracts-skeleton';tr.setAttribute('aria-hidden','true');
    for(let c=0;c<8;c++)tr.append(doc.createElement('td'));fragment.append(tr)}
   rows.replaceChildren(fragment);rows.setAttribute('aria-busy','true');
  }
  const sporting=tick=>Number.isSafeInteger(tick)&&tick>=0?l('season')+(Math.floor(tick/56)+1)+' · '+l('day')+(tick%56+1):'—';
  function render(){
   if(!record)return;
   const clubNames=new Map(record.clubs.map(c=>[c.clubKey,c.name]));
   const fragment=doc.createDocumentFragment();
   for(const p of record.players){
    const tr=doc.createElement('tr');tr.dataset.contractsPlayer=String(p.id);
    const flagTd=doc.createElement('td'),flag=Object.hasOwn(flags,p.nationality)?flags[p.nationality]:null;
    if(flag){const img=doc.createElement('img');img.src='/assets/flags/'+flag+'.svg';img.className='app-players-nationality-flag';
     img.dataset.playerCountry=p.nationality;img.alt=win.faPlayersNationality?.name(p.nationality)||p.nationality;img.tabIndex=0;img.width=20;img.height=15;flagTd.append(img)}
    else flagTd.textContent=p.nationality||'';tr.append(flagTd);
    const name=doc.createElement('td');name.className='admin-contracts-player-name';name.dataset.mobileName=compactPlayerName(p.name);name.setAttribute('aria-label',p.name);
    const full=doc.createElement('span');full.className='fa-player-full-name';full.textContent=p.name;name.append(full);
    const short=doc.createElement('span');short.className='fa-player-short-name';short.textContent=compactPlayerName(p.name);short.setAttribute('aria-hidden','true');name.append(short);tr.append(name);
    const c=p.contract,locale=doc.documentElement.lang||'en';
    const date=c&&typeof c.signedAt==='string'&&Number.isFinite(Date.parse(c.signedAt))?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(c.signedAt)):'—';
    const values=[p.clubKey===null?l('unassigned'):(clubNames.get(p.clubKey)||p.clubKey),
     c?new Intl.NumberFormat(locale).format(c.annualSalaryArc):'—',c?String(c.durationSeasons):'—',
     c?sporting(c.startTick):'—',c?sporting(c.endTick-1):'—',date];
    for(const v of values){const td=doc.createElement('td');td.textContent=v;tr.append(td)}fragment.append(tr);
   }
   rows.replaceChildren(fragment);rows.setAttribute('aria-busy','false');root.dataset.contractsState='ready';
   el('[data-contracts-total]').textContent=record.count+' '+l('players');
   el('[data-contracts-page]').textContent=l('page')+' '+record.page+' '+l('of')+' '+record.totalPages;
   report(record.players.length?'':'empty');if(!record.players.length)unavailableRows('empty');refreshDraft();controls();
  }
  function translate(){root.querySelectorAll('[data-contracts-copy]').forEach(node=>{node.textContent=l(node.dataset.contractsCopy)});if(record&&!readAbort&&!signing)render();else{if(root.dataset.contractsState==='error')unavailableRows('loadFailed');controls()}reportDraft(draftMessageKey);report(listMessageKey)}
  function clear(){record=null;refreshDraft();loading();el('[data-contracts-total]').textContent='';el('[data-contracts-page]').textContent='';controls()}
  function paint(yes){if(!yes){epoch++;readAbort?.abort();readAbort=null;writer=false;draftLocked=false;form.hidden=true;draftReset()}allowed=yes;host.hidden=!yes;root.hidden=!yes;host.dataset.adminAccess=yes?'granted':'denied';win.faAdminAccess=yes;win.dispatchEvent(new win.CustomEvent('fa:admin-access',{detail:yes}));if(!yes)clear()}
  async function load(){
   if(!allowed)return;
   readAbort?.abort();const controller=new win.AbortController();readAbort=controller;
   const ticket=++epoch;draftLocked=false;draftReset();reportDraft('');loading();report('');controls();
   try{
    const res=await win.fetch('/api/admin/contracts?page='+page,{credentials:'same-origin',cache:'no-store',signal:controller.signal}),data=await res.json();
    if(ticket!==epoch||controller.signal.aborted||!allowed)return;
    if(!res.ok){if([401,403].includes(res.status)){permissionCache?.clear();paint(false);return}throw Error('http_'+res.status)}
    if(!Array.isArray(data?.players)||!Array.isArray(data?.clubs)||!Number.isSafeInteger(data.page)||!Number.isSafeInteger(data.totalPages)||!Number.isSafeInteger(data.count)||data.players.some(p=>!Object.hasOwn(p,'contract')||(p.contract===null)!==(p.clubKey===null)))throw Error('invalid_contract_data');
    record=data;page=data.page;render();
   }catch(e){if(ticket!==epoch||controller.signal.aborted)return;clear();rows.setAttribute('aria-busy','false');root.dataset.contractsState='error';report('loadFailed');unavailableRows('loadFailed');if(writer)reportDraft('loadFailed')}
   finally{if(readAbort===controller){readAbort=null;controls()}}
  }
  async function check(){
   const ticket=++epoch;host.dataset.adminAccess='pending';
   const accept=permissions=>{const ok=['admin.access','admin.world.read'].every(k=>permissions.includes(k));writer=ok&&permissions.includes('admin.world.write');form.hidden=!writer;paint(ok);if(ok)void load()};
   const cached=permissionCache?.read();if(cached!==undefined&&cached!==null){accept(cached);return}
   try{const res=await win.fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
    if(!res.ok){if(res.status===401)permissionCache?.write([]);throw Error('permission_denied')}
    const data=await res.json();if(ticket!==epoch)return;const perms=Array.isArray(data.permissions)?data.permissions:[];permissionCache?.write(perms);accept(perms)
   }catch{if(ticket===epoch)paint(false)}
  }
  el('[data-contracts-prev]').addEventListener('click',()=>{if(allowed&&record&&page>1){page--;void load()}});
  el('[data-contracts-next]').addEventListener('click',()=>{if(allowed&&record&&page<record.totalPages){page++;void load()}});
  new win.MutationObserver(translate).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();void check();
 }
 return {mount};
});
