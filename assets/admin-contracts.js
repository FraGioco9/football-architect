/* Admin Contracts #509: Players-style checkbox list, atomic batch assignments. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root.document)api.mount(root)})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const flags={ESP:'es',ARG:'ar',FRA:'fr',ENG:'gb-eng',POR:'pt',BRA:'br',MAR:'ma',BEL:'be',NED:'nl',MEX:'mx',COL:'co',SUI:'ch',GER:'de',CRO:'hr',ITA:'it',USA:'us',JPN:'jp',SEN:'sn',NOR:'no',URU:'uy',DEN:'dk',AUT:'at',IRN:'ir',ECU:'ec',EGY:'eg',AUS:'au',CAN:'ca',ALG:'dz',CIV:'ci',NGA:'ng',TUR:'tr',KOR:'kr',PAR:'py',SWE:'se',RUS:'ru',UKR:'ua',POL:'pl',HUN:'hu',WAL:'gb-wls',COD:'cd',GRE:'gr',CMR:'cm',SCO:'gb-sct',SRB:'rs',SVK:'sk',PAN:'pa',MLI:'ml',RSA:'za',VEN:'ve',CHI:'cl'};
 const labels={
  en:{assignHeading:'Assign players to club',playersHeading:'Players',chooseClub:'Choose club',unassigned:'Free Agent',assign:'Assign',nationality:'',player:'Player',age:'Age',positions:'Positions',height:'Height',foot:'Foot',club:'Club',previous:'Previous',next:'Next',of:'of',page:'Page',players:'players',selected:'players selected',all:'Select all on this page',pick:'Select',left:'Left',right:'Right',search:'Search clubs…',loading:'Loading players…',saving:'Assigning…',saved:'Affiliations updated.',empty:'No players available.',limit:'Select at most 50 players per assignment.',failed:'Unable to load affiliations.',apiMissing:'Contracts API unavailable. Update the Worker.',schemaMissing:'Contracts migration missing.',stale:'World or affiliation changed. Reload and select again.',saveFailed:'Assignment failed; no changes were saved.',unavailable:'Contracts unavailable.'},
  it:{assignHeading:'Assegna giocatori al club',playersHeading:'Giocatori',chooseClub:'Seleziona club',unassigned:'Free Agent',assign:'Assegna',nationality:'',player:'Giocatore',age:'Età',positions:'Posizioni',height:'Altezza',foot:'Piede',club:'Club',previous:'Precedente',next:'Successiva',of:'di',page:'Pagina',players:'giocatori',selected:'giocatori selezionati',all:'Seleziona tutti in questa pagina',pick:'Seleziona',left:'Sinistro',right:'Destro',search:'Cerca club…',loading:'Caricamento giocatori…',saving:'Assegnazione…',saved:'Affiliazioni aggiornate.',empty:'Nessun giocatore disponibile.',limit:'Seleziona al massimo 50 giocatori per assegnazione.',failed:'Impossibile caricare le affiliazioni.',apiMissing:'API Contracts non disponibile. Aggiorna il Worker.',schemaMissing:'Manca la migrazione D1 Contracts.',stale:'Mondo o affiliazione cambiata. Ricarica e seleziona di nuovo.',saveFailed:'Assegnazione non riuscita; nessun dato modificato.',unavailable:'Contracts non disponibile.'},
  de:{assignHeading:'Spieler einem Verein zuweisen',playersHeading:'Spieler',chooseClub:'Verein auswählen',unassigned:'Free Agent',assign:'Zuweisen',nationality:'',player:'Spieler',age:'Alter',positions:'Positionen',height:'Größe',foot:'Fuß',club:'Verein',previous:'Zurück',next:'Weiter',of:'von',page:'Seite',players:'Spieler',selected:'Spieler ausgewählt',all:'Alle auf dieser Seite auswählen',pick:'Auswählen',left:'Links',right:'Rechts',search:'Verein suchen…',loading:'Spieler laden…',saving:'Zuordnen…',saved:'Zuordnungen aktualisiert.',empty:'Keine Spieler.',limit:'Maximal 50 Spieler je Zuweisung.',failed:'Zuordnungen nicht verfügbar.',apiMissing:'Contracts-API fehlt. Worker aktualisieren.',schemaMissing:'Contracts-D1-Migration fehlt.',stale:'Welt oder Zuordnung geändert. Erneut laden.',saveFailed:'Zuordnung fehlgeschlagen; keine Daten geändert.',unavailable:'Contracts nicht verfügbar.'},
  es:{assignHeading:'Asignar jugadores a un club',playersHeading:'Jugadores',chooseClub:'Elegir club',unassigned:'Free Agent',assign:'Asignar',nationality:'',player:'Jugador',age:'Edad',positions:'Posiciones',height:'Altura',foot:'Pie',club:'Club',previous:'Anterior',next:'Siguiente',of:'de',page:'Página',players:'jugadores',selected:'jugadores seleccionados',all:'Seleccionar todos en esta página',pick:'Seleccionar',left:'Izquierdo',right:'Derecho',search:'Buscar clubes…',loading:'Cargando jugadores…',saving:'Asignando…',saved:'Vínculos actualizados.',empty:'No hay jugadores.',limit:'Máximo 50 jugadores por operación.',failed:'No se pueden cargar vínculos.',apiMissing:'API Contracts no disponible. Actualiza Worker.',schemaMissing:'Falta migración D1 Contracts.',stale:'Mundo o vínculo cambiado. Recarga.',saveFailed:'Error al asignar; ningún cambio guardado.',unavailable:'Contracts no disponible.'},
  fr:{assignHeading:'Affecter des joueurs à un club',playersHeading:'Joueurs',chooseClub:'Choisir un club',unassigned:'Free Agent',assign:'Affecter',nationality:'',player:'Joueur',age:'Âge',positions:'Postes',height:'Taille',foot:'Pied',club:'Club',previous:'Précédent',next:'Suivant',of:'sur',page:'Page',players:'joueurs',selected:'joueurs sélectionnés',all:'Tout sélectionner sur cette page',pick:'Sélectionner',left:'Gauche',right:'Droit',search:'Rechercher clubs…',loading:'Chargement joueurs…',saving:'Affectation…',saved:'Affiliations mises à jour.',empty:'Aucun joueur.',limit:'50 joueurs maximum par opération.',failed:'Chargement impossible.',apiMissing:'API Contracts indisponible. Actualisez Worker.',schemaMissing:'Migration D1 Contracts absente.',stale:'Monde ou affiliation modifié. Rechargez.',saveFailed:'Affectation échouée; aucune modification.',unavailable:'Contracts indisponible.'}
 };
 function mount(win){
  const doc=win.document,host=doc.querySelector('#app-admin'),root=host?.querySelector('[data-admin-contracts]');if(!root)return;
  const el=q=>root.querySelector(q),rows=el('[data-contracts-rows]'),all=el('[data-contracts-all]');
  const select=el('[data-contracts-select]'),trigger=el('[data-contracts-trigger]');
  const menu=el('.admin-contracts-club-menu'),menuItems=el('[data-contracts-club-options]'),search=el('[data-contracts-club-search]');
  const status=el('[data-contracts-message]'),save=el('[data-contracts-save]'),permissionCache=win.faAdminPermissionsCache?.create(win);
  const selected=new Map();let allowed=false,busy=false,epoch=0,page=1,record=null,clubs=null,options=[],active=0,anchorId=null;
  const t=()=>labels[doc.documentElement.lang]||labels.en,l=k=>t()[k]??labels.en[k];
  const clubName=key=>key===null?l('unassigned'):(clubs?.find(c=>c.clubKey===key)?.name||key);
  const report=value=>{status.textContent=value||''};
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const shownOptions=()=>options.filter(n=>!n.hidden);
  function controls(){
   el('[data-contracts-selected-count]').textContent=selected.size+' '+l('selected');
   trigger.disabled=!allowed||busy||!record;
   save.disabled=!allowed||busy||!record||selected.size===0||!select.value;
   save.textContent=l('assign');
   const visible=record?.players||[],n=visible.filter(p=>selected.has(p.id)).length;
   all.disabled=!allowed||busy||!record||!visible.length;
   all.checked=visible.length>0&&n===visible.length;all.indeterminate=n>0&&n<visible.length;all.setAttribute('aria-label',l('all'));
   el('[data-contracts-prev]').disabled=busy||!record||page<=1;
   el('[data-contracts-next]').disabled=busy||!record||page>=record.totalPages;
  }
  function closeMenu(focus=false){
   menu.hidden=true;trigger.setAttribute('aria-expanded','false');
   trigger.removeAttribute('aria-activedescendant');search.removeAttribute('aria-activedescendant');
   if(focus)trigger.focus({preventScroll:true});
  }
  function highlight(){
   const visible=shownOptions();active=Math.max(0,Math.min(active,visible.length-1));
   for(const item of options)delete item.dataset.active;
   if(visible.length){visible[active].dataset.active='true';visible[active].scrollIntoView?.({block:'nearest'});
    for(const node of [trigger,search])node.setAttribute('aria-activedescendant',visible[active].id)}
  }
  function filterOptions(){
   const q=normalize(search.value);for(const item of options)item.hidden=!!q&&!normalize(item.textContent+' '+item.dataset.value).includes(q);
   active=0;if(!menu.hidden)highlight();
  }
  function syncSelect(){
   const value=select.selectedOptions[0]?.textContent||l('chooseClub');
   el('[data-contracts-dropdown-value]').textContent=value;trigger.setAttribute('aria-label',l('chooseClub')+': '+value);
   search.placeholder=l('search');search.setAttribute('aria-label',l('search'));
   for(const item of options)item.setAttribute('aria-selected',String(item.dataset.value===select.value));
   controls();
  }
  function choose(item){if(!item)return;select.value=item.dataset.value;closeMenu(true);syncSelect()}
  function openMenu(){
   if(trigger.disabled)return;
   search.value='';filterOptions();menu.hidden=false;trigger.setAttribute('aria-expanded','true');
   const b=trigger.getBoundingClientRect();el('.admin-contracts-dropdown').dataset.menuPlacement=win.innerHeight-b.bottom<220&&b.top>220?'above':'below';
   active=Math.max(0,shownOptions().findIndex(item=>item.dataset.value===select.value));search.focus({preventScroll:true});highlight();
  }
  function keys(e){
   const key=e.key;
   if(['ArrowDown','ArrowUp','Home','End'].includes(key)&&!(e.target===search&&['Home','End'].includes(key))){
    e.preventDefault();if(menu.hidden)openMenu();const items=shownOptions();if(!items.length)return;
    active=key==='Home'?0:key==='End'?items.length-1:key==='ArrowDown'?(active+1)%items.length:(active-1+items.length)%items.length;highlight();
   }else if(key==='Escape'&&!menu.hidden){e.preventDefault();closeMenu(true)}
   else if(key==='Enter'||(key===' '&&e.target!==search)){e.preventDefault();if(menu.hidden)openMenu();else choose(shownOptions()[active])}
   else if(key==='Tab')closeMenu();
  }
  function populate(){
   if(!clubs)return;
   const previous=select.value;select.replaceChildren();
   for(const [value,name] of [['',l('chooseClub')],['__unassigned__',l('unassigned')],...clubs.map(c=>[c.clubKey,c.name+' · '+c.clubKey])]){
    const node=doc.createElement('option');node.value=value;node.textContent=name;select.append(node);
   }
   select.value=previous&&[...select.options].some(x=>x.value===previous)?previous:'';
   const fragment=doc.createDocumentFragment();options=[];
   [...select.options].forEach((source,i)=>{
    const node=doc.createElement('div');node.id='admin-contracts-option-'+i;node.className='language-option';
    node.setAttribute('role','option');node.dataset.value=source.value;node.textContent=source.textContent;
    node.addEventListener('click',()=>choose(node));
    node.addEventListener('pointermove',()=>{const i=shownOptions().indexOf(node);if(i>=0&&!menu.hidden){active=i;highlight()}});
    options.push(node);fragment.append(node);
   });
   menuItems.replaceChildren(fragment);syncSelect();
  }
  // Static rows, header and controls already exist in HTML. Keep the five
  // eight-column placeholders unchanged on the first authorized paint.
  function loading(){
   if(rows.childElementCount===5&&[...rows.children].every(row=>row.classList.contains('admin-contracts-skeleton'))){
    rows.setAttribute('aria-busy','true');return;
   }
   const fragment=doc.createDocumentFragment();
   for(let i=0;i<5;i++){
    const tr=doc.createElement('tr');tr.className='admin-contracts-skeleton';
    tr.setAttribute('aria-hidden','true');
    for(let col=0;col<8;col++){
     const td=doc.createElement('td');
     if(col===0){
      td.className='admin-contracts-checkbox-cell';
      const cb=doc.createElement('input');cb.type='checkbox';cb.disabled=true;
      cb.tabIndex=-1;cb.setAttribute('aria-hidden','true');td.append(cb);
     }
     tr.append(td);
    }
    fragment.append(tr);
   }
   rows.replaceChildren(fragment);rows.setAttribute('aria-busy','true');
  }
  function render(){
   if(!record)return;
   const fragment=doc.createDocumentFragment();
   for(const p of record.players){
    const tr=doc.createElement('tr'),checkTd=doc.createElement('td');tr.dataset.contractsPlayer=String(p.id);
    checkTd.className='admin-contracts-checkbox-cell';
    const input=doc.createElement('input');input.type='checkbox';input.dataset.contractsCheck=String(p.id);
    input.checked=selected.has(p.id);input.disabled=busy;input.setAttribute('aria-label',l('pick')+' '+p.name);
    checkTd.append(input);tr.append(checkTd);
    const flagTd=doc.createElement('td'),flag=Object.hasOwn(flags,p.nationality)?flags[p.nationality]:null;
    if(flag){const img=doc.createElement('img');img.src='/assets/flags/'+flag+'.svg';
     img.className='app-players-nationality-flag';img.dataset.playerCountry=p.nationality;
     img.alt=win.faPlayersNationality?.name(p.nationality)||p.nationality;
     img.tabIndex=0;img.width=24;img.height=18;flagTd.append(img)}
    else flagTd.textContent=p.nationality||'';
    tr.append(flagTd);
    const name=doc.createElement('td');name.textContent=p.name;name.className='admin-contracts-player-name';tr.append(name);
    const positions=[p.primary_position,...(Array.isArray(p.secondary_positions)?p.secondary_positions:[])].filter(Boolean).join(', ')||'—';
    const values=[Number.isSafeInteger(p.age)?String(p.age):'—',positions,
     Number.isSafeInteger(p.height_cm)?p.height_cm+' cm':'—',
     p.preferred_foot==='left'?l('left'):p.preferred_foot==='right'?l('right'):'—',clubName(p.clubKey)];
    for(const v of values){const td=doc.createElement('td');td.textContent=v;tr.append(td)}
    fragment.append(tr);
   }
   rows.replaceChildren(fragment);rows.setAttribute('aria-busy','false');
   el('[data-contracts-total]').textContent=record.count+' '+l('players');
   el('[data-contracts-page]').textContent=l('page')+' '+record.page+' '+l('of')+' '+record.totalPages;
   controls();
  }
  function translate(){
   root.querySelectorAll('[data-contracts-copy]').forEach(node=>{node.textContent=l(node.dataset.contractsCopy)});
   populate();if(record)render();else controls();
  }
  function clear(){
   record=null;selected.clear();anchorId=null;clubs=null;select.value='';closeMenu();
   loading();
   el('[data-contracts-total]').textContent='';el('[data-contracts-page]').textContent='';controls();
  }
  function paint(yes){
   allowed=yes;host.hidden=!yes;root.hidden=!yes;host.dataset.adminAccess=yes?'granted':'denied';
   win.faAdminAccess=yes;win.dispatchEvent(new win.CustomEvent('fa:admin-access',{detail:yes}));if(!yes)clear();
  }
  async function load(){
   if(!allowed)return false;
   const ticket=++epoch;loading();report('');controls();
   try{
    const res=await win.fetch('/api/admin/contracts?page='+page,{credentials:'same-origin',cache:'no-store'}),data=await res.json();
    if(ticket!==epoch||!allowed)return false;
    if(!res.ok){if([401,403].includes(res.status))permissionCache?.clear();throw Error(data?.error?.code||'http_'+res.status)}
    if(!Array.isArray(data?.players)||!Array.isArray(data?.clubs)||typeof data.worldGeneration!=='string'||!Number.isSafeInteger(data.worldRevision))throw Error('invalid_contract_data');
    if(record&&(data.worldGeneration!==record.worldGeneration||data.worldRevision!==record.worldRevision)){
     selected.clear();anchorId=null;
    }
    if(record?.page!==data.page)anchorId=null;
    record=data;page=data.page;clubs=data.clubs;populate();render();
    return true;
   }catch(e){
    if(ticket!==epoch)return false;clear();rows.setAttribute('aria-busy','false');
    const code=String(e.message||'');
    report(code==='contracts_schema_unavailable'?l('schemaMissing'):
     ['not_found','http_404'].includes(code)?l('apiMissing'):['http_503','admin_unavailable','environment_unavailable'].includes(code)?l('unavailable'):l('failed'));
    if(['unauthorized','permission_denied','http_401','http_403'].includes(code))paint(false);
    return false;
   }
  }
  // Keep focus on checkboxes while selecting; rebuilding rows here would
  // break keyboard use and the second click in a Shift+click range.
  function syncChecks(){
   for(const input of rows.querySelectorAll('input[data-contracts-check]'))
    input.checked=selected.has(Number(input.dataset.contractsCheck));
   controls();
  }
  function toggle(id,on,withShift=false){
   if(!allowed||busy||!record)return;
   const list=record.players,index=list.findIndex(p=>p.id===id);if(index<0)return;
   const anchor=withShift?list.findIndex(p=>p.id===anchorId):-1;
   const range=anchor>=0?list.slice(Math.min(anchor,index),Math.max(anchor,index)+1):[list[index]];
   if(on){
    const added=range.filter(p=>!selected.has(p.id)).length;
    if(selected.size+added>50){report(l('limit'));syncChecks();return}
    for(const p of range)selected.set(p.id,{playerId:p.id,expectedClubKey:p.clubKey});
   }else for(const p of range)selected.delete(p.id);
   if(anchor<0)anchorId=id;
   report('');syncChecks();
  }
  async function assign(){
   if(!allowed||busy||!record||!selected.size||!select.value)return;
   const target=select.value==='__unassigned__'?null:select.value;
   const world=record,players=[...selected.values()],ticket=++epoch;busy=true;closeMenu();controls();report('');
   try{
    const session=await win.fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
    if(!session.ok){if([401,403].includes(session.status))permissionCache?.clear();throw Error('auth_'+session.status)}
    const auth=await session.json();if(typeof auth.csrfToken!=='string'||!auth.csrfToken)throw Error('csrf_missing');
    const res=await win.fetch('/api/admin/contracts',{method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken},
     body:JSON.stringify({players,clubKey:target,expectedGeneration:world.worldGeneration,expectedRevision:world.worldRevision})});
    const data=await res.json();if(ticket!==epoch||!allowed)return;
    if(!res.ok)throw Error(data?.error?.code||'http_'+res.status);
    selected.clear();anchorId=null;select.value='';busy=false;syncSelect();
    await load();
   }catch(e){
    if(ticket!==epoch)return;const code=String(e.message||'');
    report(/stale_world|stale_player_contract/.test(code)?l('stale'):l('saveFailed'));
    if(['auth_401','auth_403','permission_denied'].includes(code))paint(false);
   }finally{busy=false;controls();if(record)render()}
  }
  async function check(){
   // The HTML already paints the inert Contracts scaffold on hard refresh.
   // Do not hide it while the async permission check is pending.
   const ticket=++epoch;host.dataset.adminAccess='pending';
   const accept=permissions=>{const ok=['admin.access','admin.world.read','admin.world.write'].every(k=>permissions.includes(k));paint(ok);if(ok)void load()};
   const cached=permissionCache?.read();if(cached!==undefined&&cached!==null){accept(cached);return}
   try{
    const res=await win.fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
    if(!res.ok){if(res.status===401)permissionCache?.write([]);throw Error('permission_denied')}
    const data=await res.json();if(ticket!==epoch)return;
    const perms=Array.isArray(data.permissions)?data.permissions:[];permissionCache?.write(perms);accept(perms);
   }catch{if(ticket===epoch)paint(false)}
  }
  // Prevent the browser's native Shift-click text selection over checkbox rows.
  // Keep the input click intact so ranged checkbox selection continues to work.
  rows.addEventListener('mousedown',e=>{
   if(e.shiftKey&&e.target.closest?.('input[data-contracts-check]'))e.preventDefault();
  });
  rows.addEventListener('click',e=>{const c=e.target.closest?.('input[data-contracts-check]');if(c)toggle(Number(c.dataset.contractsCheck),c.checked,e.shiftKey)});
  all.addEventListener('change',()=>{
   if(!record||busy)return;
   const list=record.players,include=list.some(p=>!selected.has(p.id));
   if(include&&selected.size+list.filter(p=>!selected.has(p.id)).length>50){report(l('limit'));render();return}
   for(const p of list){if(include)selected.set(p.id,{playerId:p.id,expectedClubKey:p.clubKey});else selected.delete(p.id)}
   report('');render();
  });
  el('[data-contracts-prev]').addEventListener('click',()=>{if(!busy&&page>1){page--;void load()}});
  el('[data-contracts-next]').addEventListener('click',()=>{if(!busy&&record&&page<record.totalPages){page++;void load()}});
  save.addEventListener('click',()=>{void assign()});
  trigger.addEventListener('click',()=>menu.hidden?openMenu():closeMenu(true));
  trigger.addEventListener('keydown',keys);search.addEventListener('keydown',keys);search.addEventListener('input',filterOptions);
  doc.addEventListener('pointerdown',e=>{if(!el('.admin-contracts-dropdown').contains(e.target))closeMenu()},{capture:true});
  win.addEventListener('resize',()=>{if(!menu.hidden)closeMenu()},{passive:true});
  new win.MutationObserver(translate).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();void check();
 }
 return {mount};
});
