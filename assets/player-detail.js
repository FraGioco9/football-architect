/* #502 — Club-style player Overview shared by public and protected draft detail. */
(()=>{'use strict';
 const root=document.querySelector('[data-player-detail-mode]');if(!root)return;
 const preview=root.dataset.playerDetailMode==='preview',panel=root.querySelector('[data-player-detail]');
 const nameNode=panel.querySelector('[data-detail-name]'),roleNode=panel.querySelector('[data-detail-role]'),subtitle=panel.querySelector('[data-detail-subtitle]');
 const back=preview?panel.querySelector('[data-detail-back]'):null,statusNode=panel.querySelector('[data-detail-status]');
 const views=[...panel.querySelectorAll('[data-detail-view]')];
 const groups=Object.freeze({technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],mental:['vision','positioning','decisions','composure'],physical:['speed','strength','stamina','agility'],goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']});
 const attrKeys=['speed','strength','stamina','agility','passing','technique','dribbling','shooting','crossing','tackling','marking','heading','vision','positioning','decisions','composure','gk_reflexes','gk_handling','gk_positioning','gk_aerial'];
 const attrLabels={
  en:'Speed|Strength|Stamina|Agility|Passing|Technique|Dribbling|Shooting|Crossing|Tackling|Marking|Heading|Vision|Positioning|Decisions|Composure|Reflexes|Handling|Positioning|Aerial',
  it:'Velocità|Forza|Resistenza|Agilità|Passaggio|Tecnica|Dribbling|Tiro|Cross|Contrasto|Marcatura|Colpo di testa|Visione|Posizionamento|Decisioni|Freddezza|Riflessi|Presa|Posizionamento|Uscite alte',
  de:'Tempo|Stärke|Ausdauer|Beweglichkeit|Passen|Technik|Dribbling|Schuss|Flanken|Zweikampf|Deckung|Kopfball|Übersicht|Stellungsspiel|Entscheidungen|Ruhe|Reflexe|Fangen|Stellungsspiel|Luftraum',
  es:'Velocidad|Fuerza|Resistencia|Agilidad|Pases|Técnica|Regate|Tiro|Centros|Entradas|Marcaje|Cabeceo|Visión|Colocación|Decisiones|Serenidad|Reflejos|Blocaje|Colocación|Juego aéreo',
  fr:'Vitesse|Force|Endurance|Agilité|Passes|Technique|Dribble|Tir|Centres|Tacles|Marquage|Jeu de tête|Vision|Placement|Décisions|Sang-froid|Réflexes|Prise de balle|Placement|Jeu aérien'
 };
 const copies={
  en:{back:'Back to players',backPreview:'Back to preview',backGenerator:'Back to generator',overview:'Overview',attributes:'Attributes',groups:['Technical','Mental','Physical','Goalkeeper'],fields:['Nationality','Second nationality','Age','Positions','Height','Preferred foot'],notFound:'Player not found',expired:'Preview expired or no longer available. Return to the generator.',denied:'Admin permission required',error:'Unable to load player',left:'Left',right:'Right',preview:'Generated preview · not saved',player:'Player'},
  it:{back:'Torna ai giocatori',backPreview:'Torna all’anteprima',backGenerator:'Torna al generatore',overview:'Panoramica',attributes:'Attributi',groups:['Tecnici','Mentali','Fisici','Portiere'],fields:['Nazionalità','Seconda nazionalità','Età','Posizioni','Altezza','Piede preferito'],notFound:'Giocatore non trovato',expired:'Anteprima scaduta o non più disponibile. Torna al generatore.',denied:'Autorizzazione Admin necessaria',error:'Impossibile caricare il giocatore',left:'Sinistro',right:'Destro',preview:'Anteprima generata · non salvato',player:'Giocatore'},
  de:{back:'Zurück zu Spielern',backPreview:'Zurück zur Vorschau',backGenerator:'Zurück zum Generator',overview:'Übersicht',attributes:'Attribute',groups:['Technisch','Mental','Physisch','Torwart'],fields:['Nationalität','Zweite Nationalität','Alter','Positionen','Größe','Starker Fuß'],notFound:'Spieler nicht gefunden',expired:'Vorschau abgelaufen oder nicht mehr verfügbar. Zum Generator zurückkehren.',denied:'Admin-Berechtigung erforderlich',error:'Spieler konnte nicht geladen werden',left:'Links',right:'Rechts',preview:'Generierte Vorschau · nicht gespeichert',player:'Spieler'},
  es:{back:'Volver a jugadores',backPreview:'Volver a vista previa',backGenerator:'Volver al generador',overview:'Resumen',attributes:'Atributos',groups:['Técnicos','Mentales','Físicos','Portero'],fields:['Nacionalidad','Segunda nacionalidad','Edad','Posiciones','Altura','Pie preferido'],notFound:'Jugador no encontrado',expired:'Vista previa caducada o no disponible. Vuelve al generador.',denied:'Se requiere permiso de administrador',error:'No se pudo cargar el jugador',left:'Izquierdo',right:'Derecho',preview:'Vista previa generada · sin guardar',player:'Jugador'},
  fr:{back:'Retour aux joueurs',backPreview:'Retour à l’aperçu',backGenerator:'Retour au générateur',overview:'Vue d’ensemble',attributes:'Attributs',groups:['Techniques','Mentaux','Physiques','Gardien'],fields:['Nationalité','Seconde nationalité','Âge','Postes','Taille','Pied préféré'],notFound:'Joueur introuvable',expired:'Aperçu expiré ou indisponible. Revenez au générateur.',denied:'Autorisation Admin requise',error:'Impossible de charger le joueur',left:'Gauche',right:'Droit',preview:'Aperçu généré · non enregistré',player:'Joueur'}
 };

 const extra={
  en:{views:['Overview','Info','Stats','History','Progression'],positions:'Positions',info:'Info',attributes:'Attributes',primary:'Primary position',secondary:'Secondary positions',club:'Club',positionLabel:'Playable positions'},
  it:{views:['Panoramica','Info','Statistiche','Storia','Progressione'],positions:'Posizioni',info:'Info',attributes:'Attributi',primary:'Posizione principale',secondary:'Posizioni secondarie',club:'Club',positionLabel:'Posizioni utilizzabili'},
  de:{views:['Übersicht','Info','Statistik','Historie','Entwicklung'],positions:'Positionen',info:'Info',attributes:'Attribute',primary:'Hauptposition',secondary:'Nebenpositionen',club:'Verein',positionLabel:'Spielbare Positionen'},
  es:{views:['Resumen','Info','Estadísticas','Historial','Progresión'],positions:'Posiciones',info:'Info',attributes:'Atributos',primary:'Posición principal',secondary:'Posiciones secundarias',club:'Club',positionLabel:'Posiciones posibles'},
  fr:{views:['Vue d’ensemble','Info','Statistiques','Historique','Progression'],positions:'Postes',info:'Info',attributes:'Attributs',primary:'Poste principal',secondary:'Postes secondaires',club:'Club',positionLabel:'Postes jouables'}
 };
 const language=()=>document.documentElement.lang.toLowerCase().slice(0,2);
 const tr=()=>copies[language()]||copies.en;
 const ex=()=>extra[language()]||extra.en;
 const numeric=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
 const draftPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const params=new URLSearchParams(location.search);
 let view=params.get('view')==='info'?'info':'overview';
 const context={draftId:params.get('draftId'),index:params.get('index'),returnView:params.get('returnView'),returnGroup:params.get('returnGroup'),returnPage:params.get('returnPage'),returnScroll:params.get('returnScroll'),returnSort:params.get('returnSort'),returnOrder:params.get('returnOrder')};
 const idMatch=!preview&&/^\/players\/([1-9][0-9]*)$/.exec(location.pathname);
 const id=idMatch&&numeric(idMatch[1])?Number(idMatch[1]):null;
 const validPreview=preview&&draftPattern.test(context.draftId||'')&&numeric(context.index)&&Number(context.index)<=1000
  &&[...params.keys()].every(k=>['draftId','index','returnView','returnGroup','returnPage','returnScroll','returnSort','returnOrder','view','group'].includes(k));
 const pitchCoords=Object.freeze({GK:[120,294],RB:[198,261],RWB:[210,213],CB:[120,261],LWB:[30,213],LB:[42,261],DM:[120,216],RM:[194,168],CM:[120,168],LM:[46,168],RW:[194,83],AM:[120,116],LW:[46,83],ST:[120,54]});
 const attrGroups=['technical','mental','physical','goalkeeping'];
 let player=null,state='loading',request=0;
 function previewReturnUrl(){
  const url=new URL('/admin/players/preview',location.origin);url.searchParams.set('draftId',context.draftId);
  const hash=new URLSearchParams();
  if(['overview','attributes'].includes(context.returnView))hash.set('view',context.returnView);
  if(Object.hasOwn(groups,context.returnGroup))hash.set('group',context.returnGroup);
  if(numeric(context.returnPage)&&Number(context.returnPage)<=1000)hash.set('page',context.returnPage);
  if(context.returnScroll&&/^(0|[1-9][0-9]{0,5})$/.test(context.returnScroll))hash.set('scroll',context.returnScroll);
  if(context.returnSort&&['name','nationality','positions','age','height','foot',...attrKeys].includes(context.returnSort)){
   hash.set('sort',context.returnSort);
   if(['asc','desc'].includes(context.returnOrder))hash.set('order',context.returnOrder);
  }
  if(hash.size)url.hash=hash.toString();
  return url.pathname+url.search+url.hash;
 }
 function countryNode(code){
  const wrapper=document.createElement('span');wrapper.className='app-player-detail-country';
  if(!code){wrapper.textContent='—';return wrapper;}
  const countries=window.faPlayersNationality||{},flag=countries.flags?.[code];
  if(flag){
   const img=document.createElement('img');img.className='app-player-detail-flag app-players-nationality-flag';
   img.dataset.playerCountry=code;img.src='/assets/flags/'+flag+'.svg';img.width=24;img.height=18;
   img.alt=typeof countries.name==='function'?countries.name(code):code;img.tabIndex=0;wrapper.append(img);
  }
  wrapper.append(document.createTextNode(code));return wrapper;
 }
 function displayValue(key){
  const copy=tr();
  if(key==='nationality'||key==='secondary_nationality')return countryNode(player[key]);
  if(key==='height_cm')return Number.isSafeInteger(player.height_cm)?player.height_cm+' cm':'—';
  if(key==='preferred_foot')return player.preferred_foot==='left'?copy.left:player.preferred_foot==='right'?copy.right:'—';
  return Number.isSafeInteger(player[key])?String(player[key]):'—';
 }
 function setContent(node,value){if(node)node.replaceChildren(typeof value==='string'?document.createTextNode(value):value);}
 function positionCodes(){
  if(!player)return[];
  return [player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter((code,index,items)=>Object.hasOwn(pitchCoords,code)&&items.indexOf(code)===index);
 }
 function renderPitch(){
  const markers=panel.querySelector('[data-detail-pitch-markers]');if(!markers)return;
  markers.replaceChildren();
  if(!player)return;
  const ns='http://www.w3.org/2000/svg';
  for(const code of positionCodes()){
   const [x,y]=pitchCoords[code],primary=code===player.primary_position;
   const g=document.createElementNS(ns,'g');g.setAttribute('class','app-player-detail-pitch-marker'+(primary?' is-primary':''));
   const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',String(x));circle.setAttribute('cy',String(y));circle.setAttribute('r','16');
   const label=document.createElementNS(ns,'text');label.setAttribute('x',String(x));label.setAttribute('y',String(y+4));label.setAttribute('text-anchor','middle');label.textContent=code;
   const title=document.createElementNS(ns,'title');title.textContent=(primary?ex().primary:ex().secondary)+': '+code;
   g.append(title,circle,label);markers.append(g);
  }
 }
 function render(){
  const copy=tr(),e=ex(),labels=(attrLabels[language()]||attrLabels.en).split('|');
  if(back){
   back.textContent=state==='expired'||state==='denied'?copy.backGenerator:copy.backPreview;
   back.href=state==='expired'||state==='denied'?'/admin/players':validPreview?previewReturnUrl():'/admin/players';
  }
  document.documentElement.dataset.playerDetailView=view;
  views.forEach((tab,i)=>{
   const selected=tab.dataset.detailView===view;
   tab.textContent=e.views[i];tab.classList.toggle('is-active',selected);
   tab.setAttribute('aria-selected',String(selected));
   if(!tab.disabled)tab.tabIndex=selected?0:-1;
  });
  for(const [key,label] of [['info',e.info],['attributes',e.attributes]]){
   panel.querySelector('[data-detail-section-title="'+key+'"]').textContent=label;
  }
  panel.querySelector('[data-detail-positions]').setAttribute('aria-label',e.positions);
  panel.querySelector('[data-detail-club-label]').textContent=e.club;
  panel.querySelector('[data-detail-pitch]').setAttribute('aria-label',e.positionLabel);
  for(const [i,key] of ['nationality','secondary_nationality','age','height_cm','preferred_foot'].entries()){
   panel.querySelector('[data-detail-label="'+key+'"]').textContent=copy.fields[i<3?i:i+1];
  }
  for(const [i,key] of attrGroups.entries())panel.querySelector('[data-detail-group-title="'+key+'"]').textContent=copy.groups[i];
  for(const [i,key] of attrKeys.entries())panel.querySelector('[data-detail-attr-label="'+key+'"]').textContent=labels[i]||key;
  statusNode.textContent=state==='loading'?copy.loading:state==='ready'?'':state==='not-found'?copy.notFound:state==='expired'?copy.expired:state==='denied'?copy.denied:copy.error;
  if(!player){
   if(state!=='loading'){
    setContent(nameNode,copy.notFound);roleNode.textContent='—';
    subtitle.textContent=preview?copy.preview:'';
    for(const node of panel.querySelectorAll('[data-detail-value],[data-detail-attr-value]'))setContent(node,'—');
   }
   renderPitch();return;
  }
  setContent(nameNode,player.display_name||[player.first_name,player.last_name].filter(Boolean).join(' ')||copy.player);
  roleNode.textContent=player.primary_position||'—';
  subtitle.textContent=preview?copy.preview:'';
  for(const key of ['nationality','secondary_nationality','age','height_cm','preferred_foot'])
   setContent(panel.querySelector('[data-detail-value="'+key+'"]'),displayValue(key));
  for(const key of attrKeys){
   const value=player.attributes?.[key];
   setContent(panel.querySelector('[data-detail-attr-value="'+key+'"]'),Number.isSafeInteger(value)?String(value):'—');
  }
  renderPitch();
 }
 async function authorizedDraft(){
  const permissionCache=window.faAdminPermissionsCache?.create(window);
  let rights=permissionCache?.read();
  if(!Array.isArray(rights)){
   const perms=await fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
   if(!perms.ok){if(perms.status===401||perms.status===403)permissionCache?.clear();throw Error('denied');}
   rights=(await perms.json()).permissions||[];permissionCache?.write(rights);
  }
  if(!['admin.access','admin.world.read','admin.world.write'].every(k=>rights.includes(k)))throw Error('denied');
  // Cached UI permissions never replace the live server-side session or draft guard.
  const session=await fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
  if(!session.ok){permissionCache?.clear();throw Error('denied');}
  const csrf=(await session.json()).csrfToken;
  if(typeof csrf!=='string'||!csrf)throw Error('denied');
  const resp=await fetch('/api/admin/players/draft',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({draftId:context.draftId})});
  if(!resp.ok){if(resp.status===401||resp.status===403)permissionCache?.clear();throw Error(resp.status===401||resp.status===403?'denied':'expired');}
  const draft=await resp.json();
  if(draft.draftId!==context.draftId||!Array.isArray(draft.candidates)||draft.summary?.count!==draft.candidates.length)throw Error('expired');
  const p=draft.candidates[Number(context.index)-1];
  if(!p||p.preview_id!=='trial-'+String(context.index).padStart(4,'0'))throw Error('expired');
  // Explicit public/detail projection. Never retain internal options or metadata.
  const permitted=['first_name','last_name','display_name','nationality','secondary_nationality','age','height_cm','preferred_foot','primary_position','secondary_positions','career_status'];
  const projected=Object.fromEntries(permitted.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
  projected.attributes=Object.fromEntries(attrKeys.filter(k=>Number.isSafeInteger(p.attributes?.[k])).map(k=>[k,p.attributes[k]]));
  return projected;
 }
 async function load(){
  const ticket=++request;
  // Protected draft detail must not expose bfcache-private candidate data
  // until rechecking the active session and server-side draft on return.
  player=null;state='loading';
  if(preview)root.hidden=true;
  const skeleton=()=>{const bar=document.createElement('span');bar.className='app-skeleton-bar';bar.setAttribute('aria-hidden','true');return bar;};
  nameNode.replaceChildren(skeleton());roleNode.replaceChildren(skeleton());
  subtitle.textContent='\u00a0';
  for(const node of panel.querySelectorAll('[data-detail-value],[data-detail-attr-value]'))node.replaceChildren(skeleton());
  render();
  try{
   if(preview&&!validPreview)throw Error('expired');
   if(!preview&&(!id||params.size>0&&[...params.keys()].some(k=>!['view','group'].includes(k))))throw Error('not-found');
   const data=preview?await authorizedDraft():await (async()=>{
    const res=await fetch('/api/players/'+id,{credentials:'omit',cache:'no-store'});
    if(!res.ok)throw Error(res.status===404?'not-found':'error');
    return (await res.json()).player;
   })();
   if(ticket!==request)return;
   if(!data||typeof data!=='object'||typeof data.display_name!=='string')throw Error('error');
   player=data;state='ready';
  }catch(error){if(ticket!==request)return;player=null;state=['denied','expired','not-found'].includes(error.message)?error.message:'error';}
  if(preview)root.hidden=false;render();
 }
 function setView(next){
  if(!['overview','info'].includes(next)||next===view)return;
  view=next;
  const url=new URL(location.href);
  if(next==='info')url.searchParams.set('view','info');else url.searchParams.delete('view');
  history.pushState(history.state,'',url.pathname+url.search+url.hash);
  render();
 }
 const activeTabs=views.filter(tab=>!tab.disabled);
 activeTabs.forEach(tab=>{
  tab.addEventListener('click',()=>setView(tab.dataset.detailView));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const index=activeTabs.indexOf(tab);
   const chosen=event.key==='Home'?0:event.key==='End'?activeTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+activeTabs.length)%activeTabs.length;
   setView(activeTabs[chosen].dataset.detailView);activeTabs[chosen].focus();
  });
 });
 window.addEventListener('popstate',()=>{view=new URLSearchParams(location.search).get('view')==='info'?'info':'overview';render();});
 window.addEventListener('pageshow',e=>{if(preview&&e.persisted)void load();});
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 render();void load();
})();
