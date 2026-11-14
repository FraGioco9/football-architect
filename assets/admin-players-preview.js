/* Admin-only, server-authorized review page. No persistent player records or candidates in browser storage. */
(()=>{'use strict';
 const compactPlayerName=full=>{const m=/^(\S+)\s+(.+)$/u.exec(String(full||'').trim());return m&&!/^\p{L}\.$/u.test(m[1])?Array.from(m[1])[0]+'. '+m[2]:String(full||'').trim()};
 const host=document.querySelector('#app-admin'),root=host?.querySelector('[data-admin-players-preview-page]');
 if(!root)return;
 const permissionCache=window.faAdminPermissionsCache?.create(window);
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
 const copy={
  en:{title:'Player preview',summary:'Preview only — players are not yet saved.',regen:'Regenerate preview',back:'Back to generator',commit:'Generate in environment',confirm:'Type GENERATE PLAYERS to approve this preview',loading:'Loading generated players…',ready:'Review these players before approval.',error:'Unable to load this preview. Return to the generator to create another.',expired:'Preview expired or world changed. Generate a new preview.',saved:'Players saved in this environment',busy:'Saving approved players…',regenerating:'Generating a new preview…',invalid:'Preview data invalid',denied:'Admin permission required'},
  it:{title:'Anteprima giocatori',summary:'Solo anteprima — i giocatori non sono ancora salvati.',regen:'Rigenera anteprima',back:'Torna al generatore',commit:'Genera nell’environment',confirm:'Scrivi GENERATE PLAYERS per approvare questa anteprima',loading:'Caricamento giocatori generati…',ready:'Controlla i giocatori prima di approvarli.',error:'Impossibile caricare questa anteprima. Torna al generatore per crearne una nuova.',expired:'Anteprima scaduta o mondo modificato. Genera una nuova anteprima.',saved:'Giocatori salvati nell’environment',busy:'Salvataggio dei giocatori approvati…',regenerating:'Creazione nuova anteprima…',invalid:'Dati anteprima non validi',denied:'Autorizzazione Admin necessaria'},
  de:{title:'Spielervorschau',summary:'Nur Vorschau — Spieler sind noch nicht gespeichert.',regen:'Neue Vorschau erstellen',back:'Zurück zum Generator',commit:'In Umgebung generieren',confirm:'Zum Bestätigen GENERATE PLAYERS eingeben',loading:'Generierte Spieler werden geladen…',ready:'Spieler vor Freigabe prüfen.',error:'Vorschau konnte nicht geladen werden. Zurück zum Generator.',expired:'Vorschau abgelaufen oder Welt geändert. Erstelle eine neue.',saved:'Spieler in dieser Umgebung gespeichert',busy:'Genehmigte Spieler werden gespeichert…',regenerating:'Neue Vorschau wird erstellt…',invalid:'Ungültige Vorschaudaten',denied:'Admin-Berechtigung erforderlich'},
  es:{title:'Vista previa de jugadores',summary:'Solo vista previa — los jugadores aún no se han guardado.',regen:'Regenerar vista previa',back:'Volver al generador',commit:'Generar en el entorno',confirm:'Escribe GENERATE PLAYERS para aprobar esta vista previa',loading:'Cargando jugadores generados…',ready:'Revisa los jugadores antes de aprobar.',error:'No se pudo cargar esta vista previa. Vuelve al generador.',expired:'Vista previa caducada o mundo modificado. Genera otra.',saved:'Jugadores guardados en este entorno',busy:'Guardando jugadores aprobados…',regenerating:'Generando nueva vista previa…',invalid:'Datos de vista previa no válidos',denied:'Se requiere permiso de administrador'},
  fr:{title:'Aperçu des joueurs',summary:'Aperçu uniquement — joueurs non enregistrés.',regen:'Régénérer l’aperçu',back:'Retour au générateur',commit:'Générer dans l’environnement',confirm:'Saisissez GENERATE PLAYERS pour approuver cet aperçu',loading:'Chargement des joueurs générés…',ready:'Vérifiez les joueurs avant de confirmer.',error:'Impossible de charger cet aperçu. Retournez au générateur.',expired:'Aperçu expiré ou monde modifié. Créez-en un nouveau.',saved:'Joueurs enregistrés dans cet environnement',busy:'Enregistrement des joueurs approuvés…',regenerating:'Création d’un nouvel aperçu…',invalid:'Données d’aperçu incorrectes',denied:'Autorisation Admin requise'}
 };
 const tr=()=>copy[language()]||copy.en;
 const query=new URLSearchParams(location.search),id=query.get('draftId');
 const validId=()=>query.size===1&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'');
 const table=root.querySelector('.app-players-table'),scroll=root.querySelector('.app-players-table-scroll');
 const body=table.tBodies[0],feedback=root.querySelector('[data-admin-players-feedback]');
 const count=root.querySelector('[data-admin-preview-count]');
 const pagination=root.querySelector('[data-admin-preview-pagination]'),pageLabel=root.querySelector('[data-admin-preview-page]');
 const prev=root.querySelector('[data-admin-preview-prev]'),next=root.querySelector('[data-admin-preview-next]');
 const tabs=[...root.querySelectorAll('[data-admin-preview-view]')],groupTabs=[...root.querySelectorAll('[data-admin-preview-group]')];
 const confirmation=root.querySelector('[data-admin-players-confirmation]'),commit=root.querySelector('[data-admin-players-commit]');
 const regen=root.querySelector('[data-admin-preview-regenerate]'),back=root.querySelector('[data-admin-preview-back]');
 const confirmationDialog=root.querySelector('[data-admin-preview-confirm-dialog]');
 const confirmAction=root.querySelector('[data-admin-preview-confirm-action]');
 const confirmCancel=root.querySelector('[data-admin-preview-cancel]');
 const receipt=root.querySelector('[data-admin-players-commit-status]');
 let draft=null,view='overview',group='technical',sort='',order='',page=0,busy=false,saved=false,status='loading';
 // Restore the preview table presentation without putting draft content in URLs.
 const restored=new URLSearchParams(location.hash.slice(1));
 if(['overview','attributes'].includes(restored.get('view')))view=restored.get('view');
 if(['technical','mental','physical','goalkeeping'].includes(restored.get('group')))group=restored.get('group');
 if(/^[1-9][0-9]{0,3}$/.test(restored.get('page')||''))page=Number(restored.get('page'))-1;
 if(['name','nationality','positions','age','height','foot',...groups[group]].includes(restored.get('sort')))sort=restored.get('sort');
 if(sort&&['asc','desc'].includes(restored.get('order')))order=restored.get('order');
 const restoreScroll=/^(0|[1-9][0-9]{0,5})$/.test(restored.get('scroll')||'')?Number(restored.get('scroll')):0;

 const buttonLabels={
  en:{generate:'Generate',regenerate:'Regenerate',back:'Back',heading:'Confirm generation',cancel:'Cancel',confirm:'Confirm'},
  it:{generate:'Genera',regenerate:'Rigenera',back:'Indietro',heading:'Conferma generazione',cancel:'Annulla',confirm:'Conferma'},
  de:{generate:'Generieren',regenerate:'Neu generieren',back:'Zurück',heading:'Generierung bestätigen',cancel:'Abbrechen',confirm:'Bestätigen'},
  es:{generate:'Generar',regenerate:'Regenerar',back:'Volver',heading:'Confirmar generación',cancel:'Cancelar',confirm:'Confirmar'},
  fr:{generate:'Générer',regenerate:'Régénérer',back:'Retour',heading:'Confirmer la génération',cancel:'Annuler',confirm:'Confirmer'}
 };
 const pageSize=50,rankPositions=['GK','RB','RWB','CB','LWB','LB','DM','RM','CM','LM','RW','AM','LW','ST'];
 function columns(){return view==='overview'?['nationality','name','positions','age','height','foot']:['nationality','name','positions',...groups[group]];}
 function colLabel(key){
  const t=locale();
  if(key==='nationality')return t.nationality;
  if(key==='name')return t.columns[0];
  if(key==='age')return t.columns[1];
  if(key==='positions')return t.columns[2];
  if(key==='height')return t.columns[3];
  if(key==='foot')return t.columns[4];
  return attributeName(key);
 }
 function renderHead(){
  const tr=document.createElement('tr');
  for(const key of columns()){
   const th=document.createElement('th');th.scope='col';
   if(key==='nationality')th.className='app-players-flag-col';
   th.setAttribute('aria-sort',sort===key?(order==='desc'?'descending':'ascending'):'none');
   const button=document.createElement('button');button.type='button';button.className='app-players-sort-button';button.dataset.previewSort=key;
   const wrap=document.createElement('span');wrap.className='app-players-sort-label';
   const label=document.createElement('span');label.textContent=colLabel(key);
   if(key==='nationality')label.className='sr-only';
   wrap.append(label);
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','app-players-sort-chevron');
   svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('aria-hidden','true');
   const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
   arrow.setAttribute('d','m5 7 5 5 5-5');arrow.setAttribute('fill','none');arrow.setAttribute('stroke','currentColor');
   arrow.setAttribute('stroke-width','1.75');arrow.setAttribute('stroke-linecap','round');arrow.setAttribute('stroke-linejoin','round');
   svg.append(arrow);wrap.append(svg);button.append(wrap);th.append(button);tr.append(th);
  }
  table.tHead.replaceChildren(tr);table.dataset.playersTableMode=view;
 }
 function value(player,key){
  if(key==='nationality')return player.nationality||'';
  if(key==='name')return player.display_name||'';
  if(key==='age')return player.age??player.initial_age??-1;
  if(key==='positions')return rankPositions.length-rankPositions.indexOf(player.primary_position);
  if(key==='height')return player.height_cm??-1;
  if(key==='foot')return player.preferred_foot||'';
  return player.attributes?.[key]??-1;
 }
 function sorted(){
  const items=draft.candidates.map((player,index)=>({player,index}));
  if(!sort)return items;
  const sign=order==='desc'?-1:1;
  items.sort((a,b)=>{
   const x=value(a.player,sort),y=value(b.player,sort);
   const v=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),language());
   return sign*v||a.index-b.index;
  });
  return items;
 }
 function addCell(row,value){const td=document.createElement('td');td.textContent=String(value);row.append(td);}
 function flagCell(row,player){
  const code=player.nationality,flags=window.faPlayersNationality?.flags||{},flag=flags[code];
  const td=document.createElement('td');
  if(flag){
   const image=document.createElement('img');image.className='app-players-nationality-flag';
   image.dataset.playerCountry=code;image.alt=window.faPlayersNationality.name(code);image.tabIndex=0;
   image.width=20;image.height=15;image.src='/assets/flags/'+flag+'.svg';td.append(image);
  }else td.textContent=code||'—';
  row.append(td);
 }
 function showMessage(message){
  const row=document.createElement('tr');row.className='app-players-empty-row';
  const td=document.createElement('td');td.colSpan=columns().length;
  const strong=document.createElement('strong');strong.textContent=message;strong.setAttribute('role','status');
  td.append(strong);row.append(td);body.replaceChildren(row);
 }
 function loadingRows(){
  const frag=document.createDocumentFragment();
  for(let i=0;i<5;i++){const row=document.createElement('tr');row.className='app-players-loading-row';row.setAttribute('aria-hidden',String(i!==0));
   const td=document.createElement('td');td.colSpan=columns().length;
   if(!i){const sr=document.createElement('span');sr.className='sr-only';sr.setAttribute('role','status');sr.textContent=tr().loading;td.append(sr);}
   row.append(td);frag.append(row);}
  body.replaceChildren(frag);
 }
 function render(){
  const t=locale(),c=tr(),actions=buttonLabels[language()]||buttonLabels.en;
  root.querySelector('#admin-title').textContent=c.title;
  document.title=c.title+' — Football Architect';
  document.documentElement.dataset.playersView=view;document.documentElement.dataset.playersGroup=group;
  root.querySelector('[data-admin-preview-confirm-heading]').textContent=actions.heading;
  root.querySelector('[data-admin-preview-confirm-label]').textContent=c.confirm;
  confirmCancel.textContent=actions.cancel;confirmAction.textContent=actions.confirm;
  back.textContent=actions.back;regen.textContent=actions.regenerate;commit.textContent=actions.generate;
  tabs.forEach((tab,i)=>{const active=tab.dataset.adminPreviewView===view;tab.textContent=t.tabs[i];tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  groupTabs.forEach((tab,i)=>{const active=tab.dataset.adminPreviewGroup===group;tab.textContent=t.groups[i];tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  renderHead();pagination.hidden=true;
  scroll.setAttribute('aria-busy',String(status==='loading'||busy));
  if(status==='loading')loadingRows();
  else if(!draft)showMessage(status==='denied'?c.denied:c.error);
  else{
   const ordered=sorted(),total=Math.max(1,Math.ceil(ordered.length/pageSize));page=Math.min(page,total-1);
   const frag=document.createDocumentFragment();
   for(const {player,index} of ordered.slice(page*pageSize,(page+1)*pageSize)){
    const row=document.createElement('tr');flagCell(row,player);
    const nameCell=document.createElement('td');
    const link=document.createElement('a');link.className='app-player-name-link';
    const target=new URL('/admin/players/preview/player',location.origin);
    target.searchParams.set('draftId',id);target.searchParams.set('index',String(index+1));target.searchParams.set('view','overview');
    target.searchParams.set('returnView',view);target.searchParams.set('returnGroup',group);
    target.searchParams.set('returnPage',String(page+1));target.searchParams.set('returnScroll',String(Math.round(scroll.scrollLeft)));
    if(sort){target.searchParams.set('returnSort',sort);target.searchParams.set('returnOrder',order);}
    link.href=target.pathname+target.search;link.textContent=player.display_name||'—';link.dataset.mobileName=compactPlayerName(player.display_name);link.setAttribute('aria-label',player.display_name||'—');
    nameCell.append(link);row.append(nameCell);
    const positions=[player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean).join(', ')||'—';
    if(view==='overview'){
     addCell(row,positions);
     addCell(row,Number.isSafeInteger(player.age)?player.age:Number.isSafeInteger(player.initial_age)?player.initial_age:'—');
     addCell(row,Number.isSafeInteger(player.height_cm)?player.height_cm+' cm':'—');
     addCell(row,player.preferred_foot==='left'?t.left:player.preferred_foot==='right'?t.right:'—');
    }else{
     addCell(row,positions);
     for(const key of groups[group])addCell(row,Number.isSafeInteger(player.attributes?.[key])?player.attributes[key]:'—');
    }
    frag.append(row);
   }
   if(ordered.length)body.replaceChildren(frag);else showMessage(t.empty);
   count.textContent=new Intl.NumberFormat(language()).format(draft.summary.count)+' '+(draft.summary.count===1?t.one:t.many);
   pageLabel.textContent=t.page+' '+(page+1)+' '+t.of+' '+total+' · '+new Intl.NumberFormat(language()).format(draft.summary.count)+' '+(draft.summary.count===1?t.one:t.many);
   prev.textContent=t.prev;next.textContent=t.next;prev.disabled=page===0;next.disabled=page===total-1;
   pagination.hidden=total<=1;
  }
  regen.disabled=!draft||busy;commit.disabled=!draft||busy||saved;
  confirmAction.disabled=!draft||busy||saved||confirmation.value!=='GENERATE PLAYERS';
  feedback.hidden=!feedback.textContent;receipt.hidden=!saved;
 }
 async function authorizedPost(path,payload){
  const session=await fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
  if(!session.ok){if(session.status===401||session.status===403)permissionCache?.clear();throw new Error('authorization_'+session.status);}
  const auth=await session.json();
  if(typeof auth.csrfToken!=='string'||!auth.csrfToken)throw new Error('csrf_unavailable');
  const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken},body:JSON.stringify(payload)});
  const data=await response.json();
  if(!response.ok){if(response.status===401||response.status===403)permissionCache?.clear();throw new Error(data?.error?.code||'http_'+response.status);}
  return data;
 }
 async function load(){
  host.hidden=false;root.hidden=false;render();
  if(!validId()){status='error';feedback.textContent=tr().error;render();return;}
  try{
   let p=permissionCache?.read();
   if(p===null||p===undefined){
    const permitted=await fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
    if(!permitted.ok){if(permitted.status===401)permissionCache?.write([]);throw new Error('permission_denied');}
    const data=await permitted.json();p=Array.isArray(data.permissions)?data.permissions:[];
    permissionCache?.write(p);
   }
   // Cached UI permissions never replace backend authorization below.
   if(!['admin.access','admin.world.read','admin.world.write'].every(x=>p.includes(x)))throw new Error('permission_denied');
   const info=await authorizedPost('/api/admin/players/draft',{draftId:id});
   if(info?.draftId!==id||!Array.isArray(info.candidates)||info.candidates.length!==info.summary?.count||!info.options||!['preview','committed'].includes(info.status))
    throw new Error('invalid_draft');
   draft=info;saved=info.status==='committed';
   if(saved)receipt.textContent=info.summary.count+' '+tr().saved+' · '+info.draftId;
   status='ready';feedback.textContent='';
  }catch(e){status=e.message==='permission_denied'?'denied':'error';feedback.textContent=tr().error;}
  render();
  if(draft&&restoreScroll)requestAnimationFrame(()=>{scroll.scrollLeft=restoreScroll;});
 }
 async function regenerate(){
  if(!draft||busy)return;
  busy=true;feedback.textContent=tr().regenerating;render();
  try{
   const options={...draft.options};
   // Auto is always server-selected; an explicit manual seed remains reproducible.
   if(/^fa-auto-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(options.seed||''))delete options.seed;
   const nextDraft=await authorizedPost('/api/admin/players/preview',{options});
   if(!nextDraft||!nextDraft.draftId)throw new Error('invalid_preview');
   location.replace('/admin/players/preview?draftId='+encodeURIComponent(nextDraft.draftId));
  }catch(e){busy=false;feedback.textContent=tr().error+': '+e.message;render();}
 }
 async function save(){
  if(!draft||busy||saved||confirmation.value!=='GENERATE PLAYERS')return;
  busy=true;feedback.textContent=tr().busy;render();
  try{
   const answer=await authorizedPost('/api/admin/players/commit',{draftId:draft.draftId,confirmation:'GENERATE PLAYERS'});
   if(answer.batchId!==draft.draftId||answer.count!==draft.summary.count)throw new Error('invalid_commit_result');
   saved=true;receipt.textContent=answer.count+' '+tr().saved+' · '+answer.batchId;
   feedback.textContent='';
  }catch(e){feedback.textContent=(e.message==='stale_players_preview'||e.message==='players_preview_expired'?tr().expired:tr().error+': '+e.message);}
  finally{busy=false;if(confirmationDialog.open)confirmationDialog.close();confirmation.value='';render();}
 }
 function keyTabs(event,tabs,field,fn){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const current=tabs.indexOf(event.target);
  const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[index].focus();fn(tabs[index].dataset[field]);
 }
 function setView(next){if(view===next)return;view=next;sort='';order='';page=0;render();}
 function setGroup(next){if(group===next)return;group=next;sort='';order='';page=0;render();}
 tabs.forEach(tab=>tab.addEventListener('click',()=>setView(tab.dataset.adminPreviewView)));
 groupTabs.forEach(tab=>tab.addEventListener('click',()=>setGroup(tab.dataset.adminPreviewGroup)));
 root.querySelector('[data-admin-preview-tabs]').addEventListener('keydown',e=>keyTabs(e,tabs,'adminPreviewView',setView));
 root.querySelector('[data-admin-preview-groups]').addEventListener('keydown',e=>keyTabs(e,groupTabs,'adminPreviewGroup',setGroup));
 table.tHead.addEventListener('click',e=>{
  const key=e.target.closest?.('[data-preview-sort]')?.dataset.previewSort;
  if(!key)return;
  if(sort!==key){sort=key;order='desc';}else if(order==='desc'){order='asc';}else{sort='';order='';}
  page=0;render();
 });
 prev.addEventListener('click',()=>{if(draft&&page>0){page--;render();}});
 next.addEventListener('click',()=>{if(draft&&page+1<Math.ceil(draft.summary.count/pageSize)){page++;render();}});
 confirmation.addEventListener('input',render);
 // A normal Back action should retain generator settings, including after a
 // successful save. Only the normalized options cross the page boundary;
 // never carry generated candidates or a permanent ID in history state.
 back.addEventListener('click',event=>{
  if(!draft||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const destination=new URL(back.href,location.href);
  if(destination.origin!==location.origin||destination.pathname!=='/admin/players')return;
  event.preventDefault();
  // Prefer the generator history entry when following the normal workflow.
  let fromGenerator=false;
  try{const ref=new URL(document.referrer);fromGenerator=ref.origin===location.origin&&ref.pathname==='/admin/players';}catch{}
  if(fromGenerator&&history.length>1){history.back();return;}
  // Direct/replaced previews: use an ephemeral history-state handoff, no storage.
  history.replaceState({faAdminGeneratorOptions:draft.options},'',destination.pathname+destination.search+destination.hash);
  location.reload();
 });
 regen.addEventListener('click',()=>{void regenerate();});
 commit.addEventListener('click',()=>{
  if(commit.disabled)return;
  confirmation.value='';render();confirmationDialog.showModal();confirmation.focus();
 });
 confirmCancel.addEventListener('click',()=>confirmationDialog.close());
 confirmAction.addEventListener('click',()=>{void save();});
 confirmation.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!confirmAction.disabled){event.preventDefault();void save();}
 });
 confirmationDialog.addEventListener('close',()=>{confirmation.value='';render();commit.focus();});
 confirmationDialog.addEventListener('click',event=>{if(event.target===confirmationDialog)confirmationDialog.close();});
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 void load();
})();
