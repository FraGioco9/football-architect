/* #502: one read-only player detail UI for persisted IDs and Admin draft candidates. */
(()=>{'use strict';
 const root=document.querySelector('[data-player-detail-mode]');if(!root)return;
 const preview=root.dataset.playerDetailMode==='preview',panel=root.querySelector('[data-player-detail]');
 const nameNode=panel.querySelector('[data-detail-name]'),subtitle=panel.querySelector('[data-detail-subtitle]');
 const back=panel.querySelector('[data-detail-back]'),statusNode=panel.querySelector('[data-detail-status]');
 const views=[...panel.querySelectorAll('[data-detail-view]')],groupTabs=[...panel.querySelectorAll('[data-detail-group]')];
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
  en:{back:'Back to players',backPreview:'Back to preview',backGenerator:'Back to generator',overview:'Overview',attributes:'Attributes',groups:['Technical','Mental','Physical','Goalkeeper'],fields:['Nationality','Second nationality','Age','Positions','Height','Preferred foot'],loading:'Loading player…',notFound:'Player not found',expired:'Preview expired or no longer available. Return to the generator.',denied:'Admin permission required',error:'Unable to load player',left:'Left',right:'Right',preview:'Generated preview · not saved',player:'Player'},
  it:{back:'Torna ai giocatori',backPreview:'Torna all’anteprima',backGenerator:'Torna al generatore',overview:'Panoramica',attributes:'Attributi',groups:['Tecnici','Mentali','Fisici','Portiere'],fields:['Nazionalità','Seconda nazionalità','Età','Posizioni','Altezza','Piede preferito'],loading:'Caricamento giocatore…',notFound:'Giocatore non trovato',expired:'Anteprima scaduta o non più disponibile. Torna al generatore.',denied:'Autorizzazione Admin necessaria',error:'Impossibile caricare il giocatore',left:'Sinistro',right:'Destro',preview:'Anteprima generata · non salvato',player:'Giocatore'},
  de:{back:'Zurück zu Spielern',backPreview:'Zurück zur Vorschau',backGenerator:'Zurück zum Generator',overview:'Übersicht',attributes:'Attribute',groups:['Technisch','Mental','Physisch','Torwart'],fields:['Nationalität','Zweite Nationalität','Alter','Positionen','Größe','Starker Fuß'],loading:'Spieler wird geladen…',notFound:'Spieler nicht gefunden',expired:'Vorschau abgelaufen oder nicht mehr verfügbar. Zum Generator zurückkehren.',denied:'Admin-Berechtigung erforderlich',error:'Spieler konnte nicht geladen werden',left:'Links',right:'Rechts',preview:'Generierte Vorschau · nicht gespeichert',player:'Spieler'},
  es:{back:'Volver a jugadores',backPreview:'Volver a vista previa',backGenerator:'Volver al generador',overview:'Resumen',attributes:'Atributos',groups:['Técnicos','Mentales','Físicos','Portero'],fields:['Nacionalidad','Segunda nacionalidad','Edad','Posiciones','Altura','Pie preferido'],loading:'Cargando jugador…',notFound:'Jugador no encontrado',expired:'Vista previa caducada o no disponible. Vuelve al generador.',denied:'Se requiere permiso de administrador',error:'No se pudo cargar el jugador',left:'Izquierdo',right:'Derecho',preview:'Vista previa generada · sin guardar',player:'Jugador'},
  fr:{back:'Retour aux joueurs',backPreview:'Retour à l’aperçu',backGenerator:'Retour au générateur',overview:'Vue d’ensemble',attributes:'Attributs',groups:['Techniques','Mentaux','Physiques','Gardien'],fields:['Nationalité','Seconde nationalité','Âge','Postes','Taille','Pied préféré'],loading:'Chargement du joueur…',notFound:'Joueur introuvable',expired:'Aperçu expiré ou indisponible. Revenez au générateur.',denied:'Autorisation Admin requise',error:'Impossible de charger le joueur',left:'Gauche',right:'Droit',preview:'Aperçu généré · non enregistré',player:'Joueur'}
 };
 const language=()=>document.documentElement.lang.toLowerCase().slice(0,2);
 const tr=()=>copies[language()]||copies.en;
 const numeric=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
 const draftPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const params=new URLSearchParams(location.search);
 const context={draftId:params.get('draftId'),index:params.get('index'),returnView:params.get('returnView'),returnGroup:params.get('returnGroup'),returnPage:params.get('returnPage'),returnScroll:params.get('returnScroll')};
 const idMatch=!preview&&/^\/players\/([1-9][0-9]*)$/.exec(location.pathname);
 const id=idMatch&&numeric(idMatch[1])?Number(idMatch[1]):null;
 const validPreview=preview&&draftPattern.test(context.draftId||'')&&numeric(context.index)&&Number(context.index)<=1000
  &&[...params.keys()].every(k=>['draftId','index','returnView','returnGroup','returnPage','returnScroll','view','group'].includes(k));
 let player=null,state='loading',view='overview',group='technical',request=0;
 function fromUrl(){view=params.get('view')==='attributes'?'attributes':'overview';group=Object.hasOwn(groups,params.get('group'))?params.get('group'):'technical';}
 function updateUrl(){const url=new URL(location.href);url.searchParams.delete('view');url.searchParams.delete('group');if(view==='attributes'){url.searchParams.set('view',view);url.searchParams.set('group',group);}history.pushState(null,'',url.pathname+url.search+url.hash);}
 function previewReturnUrl(){
  const url=new URL('/admin/players/preview',location.origin);url.searchParams.set('draftId',context.draftId);
  const hash=new URLSearchParams();
  if(['overview','attributes'].includes(context.returnView))hash.set('view',context.returnView);
  if(Object.hasOwn(groups,context.returnGroup))hash.set('group',context.returnGroup);
  if(numeric(context.returnPage)&&Number(context.returnPage)<=1000)hash.set('page',context.returnPage);
  if(context.returnScroll&&/^(0|[1-9][0-9]{0,5})$/.test(context.returnScroll))hash.set('scroll',context.returnScroll);
  if(hash.size)url.hash=hash.toString();
  return url.pathname+url.search+url.hash;
 }
 function countryNode(code){
  const wrapper=document.createElement('span');
  if(!code){wrapper.textContent='—';return wrapper;}
  const countries=window.faPlayersNationality||{},flag=countries.flags?.[code];
  if(flag){const img=document.createElement('img');img.className='app-player-detail-flag app-players-nationality-flag';img.dataset.playerCountry=code;img.src='/assets/flags/'+flag+'.svg';img.width=24;img.height=18;img.alt=typeof countries.name==='function'?countries.name(code):code;img.tabIndex=0;wrapper.append(img);}
  wrapper.append(document.createTextNode(code));return wrapper;
 }
 function displayValue(key){
  const copy=tr();
  if(key==='nationality'||key==='secondary_nationality')return countryNode(player[key]);
  if(key==='positions')return [player.primary_position,...(Array.isArray(player.secondary_positions)?player.secondary_positions:[])].filter(Boolean).join(', ')||'—';
  if(key==='height_cm')return Number.isSafeInteger(player.height_cm)?player.height_cm+' cm':'—';
  if(key==='preferred_foot')return player.preferred_foot==='left'?copy.left:player.preferred_foot==='right'?copy.right:'—';
  return Number.isSafeInteger(player[key])?String(player[key]):'—';
 }
 function setContent(node,value){node.replaceChildren(typeof value==='string'?document.createTextNode(value):value);}
 function render(){
  const copy=tr();
  document.documentElement.dataset.playersView=view;document.documentElement.dataset.playersGroup=group;
  back.textContent=preview?(state==='expired'||state==='denied'?copy.backGenerator:copy.backPreview):copy.back;
  back.href=preview?(state==='expired'||state==='denied'?'/admin/players':validPreview?previewReturnUrl():'/admin/players'):'/players';
  views.forEach(tab=>{const active=tab.dataset.detailView===view;tab.textContent=copy[tab.dataset.detailView];tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  groupTabs.forEach((tab,i)=>{const active=tab.dataset.detailGroup===group;tab.textContent=copy.groups[i];tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  for(const section of panel.querySelectorAll('[data-detail-panel]'))section.hidden=section.dataset.detailPanel!==view;
  const fieldKeys=['nationality','secondary_nationality','age','positions','height_cm','preferred_foot'];
  panel.querySelectorAll('[data-detail-label]').forEach((node,i)=>{node.textContent=copy.fields[i];});
  statusNode.textContent=state==='loading'?copy.loading:state==='ready'?'':state==='not-found'?copy.notFound:state==='expired'?copy.expired:state==='denied'?copy.denied:copy.error;
  if(!player)return;
  setContent(nameNode,player.display_name||[player.first_name,player.last_name].filter(Boolean).join(' ')||copy.player);
  subtitle.textContent=preview?copy.preview:[player.primary_position,player.career_status].filter(Boolean).join(' · ');
  fieldKeys.forEach(key=>setContent(panel.querySelector('[data-detail-value="'+key+'"]'),displayValue(key)));
  const keys=groups[group],labels=(attrLabels[language()]||attrLabels.en).split('|');
  panel.querySelectorAll('[data-detail-attr-slot]').forEach((slot,i)=>{
   const key=keys[i];slot.hidden=!key;if(!key)return;
   slot.querySelector('dt').textContent=labels[attrKeys.indexOf(key)]||key;
   slot.querySelector('dd').textContent=Number.isSafeInteger(player.attributes?.[key])?String(player.attributes[key]):'—';
  });
 }
 function setTab(next,kind){
  if(kind==='view'){if(view===next)return;view=next;}
  else {if(group===next)return;group=next;}
  updateUrl();render();
 }
 function keyTabs(event,tabs,kind){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const idx=tabs.indexOf(event.target);
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(idx+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();setTab(kind==='view'?tabs[next].dataset.detailView:tabs[next].dataset.detailGroup,kind);
 }
 async function authorizedDraft(){
  const perms=await fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store'});
  if(!perms.ok)throw Error('denied');
  const rights=(await perms.json()).permissions||[];
  if(!['admin.access','admin.world.read','admin.world.write'].every(k=>rights.includes(k)))throw Error('denied');
  const session=await fetch('/api/admin/session',{credentials:'same-origin',cache:'no-store'});
  if(!session.ok)throw Error('denied');
  const csrf=(await session.json()).csrfToken;
  if(typeof csrf!=='string'||!csrf)throw Error('denied');
  const resp=await fetch('/api/admin/players/draft',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({draftId:context.draftId})});
  if(!resp.ok)throw Error(resp.status===401||resp.status===403?'denied':'expired');
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
  // A cached preview document must never display stale private candidate data
  // while rechecking the active Admin session and the live draft on pageshow.
  player=null;state='loading';
  if(preview)root.hidden=true;
  const skeleton=()=>{const bar=document.createElement('span');bar.className='app-skeleton-bar';bar.setAttribute('aria-hidden','true');return bar;};
  nameNode.replaceChildren(skeleton());
  subtitle.textContent='\u00a0';
  for(const node of panel.querySelectorAll('[data-detail-value]'))node.replaceChildren(skeleton());
  for(const node of panel.querySelectorAll('[data-detail-attr-slot] dd'))node.replaceChildren(skeleton());
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
 fromUrl();
 views.forEach(tab=>{tab.addEventListener('click',()=>setTab(tab.dataset.detailView,'view'));tab.addEventListener('keydown',e=>keyTabs(e,views,'view'));});
 groupTabs.forEach(tab=>{tab.addEventListener('click',()=>setTab(tab.dataset.detailGroup,'group'));tab.addEventListener('keydown',e=>keyTabs(e,groupTabs,'group'));});
 window.addEventListener('popstate',()=>{const next=new URLSearchParams(location.search);view=next.get('view')==='attributes'?'attributes':'overview';group=Object.hasOwn(groups,next.get('group'))?next.get('group'):'technical';render();});
 window.addEventListener('pageshow',e=>{if(preview&&e.persisted)void load();});
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 render();void load();
})();
