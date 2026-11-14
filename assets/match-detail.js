/* #577 — Read-only official Match Detail. Future states are displayed ONLY when attested by the API. */
(()=>{'use strict';
 const root=document.querySelector('[data-match-detail]');if(!root)return;
 const views=['overview','lineups','stats'],tabs=[...root.querySelectorAll('[data-match-tab]')];
 const copies={
  en:{match:'Match',overview:'Overview',lineups:'Lineups',stats:'Stats',details:'Match details',competition:'Competition',season:'Season',round:'Round',day:'Sporting day',kickoff:'Kickoff',venue:'Venue',events:'Match events',statistics:'Match statistics',loading:'Loading match…',scheduled:'Scheduled',awaiting_participants:'Awaiting participants',lineups_confirmed:'Lineups confirmed',in_progress:'In progress',completed:'Full time',postponed:'Postponed',cancelled:'Cancelled',unavailable:'Not announced',tbd:'To be determined',home:'Home lineup',away:'Away lineup',notConfirmed:'Not confirmed',confirmed:'Confirmed',noLineup:'Lineup not available.',noEvents:'Events are not recorded yet.',noStats:'Match statistics are not available yet.',notFound:'Match not found or not published.',error:'Match information is temporarily unavailable.',noData:'No official data available',leg:'Leg',penalties:'Penalties',extraTime:'After extra time',goals:'Goals',shots:'Shots',shotsOnTarget:'Shots on target',possession:'Possession',passes:'Passes',fouls:'Fouls',corners:'Corners',offsides:'Offsides',yellowCards:'Yellow cards',redCards:'Red cards',saves:'Saves'},
  it:{match:'Partita',overview:'Panoramica',lineups:'Formazioni',stats:'Statistiche',details:'Dettagli partita',competition:'Competizione',season:'Stagione',round:'Giornata',day:'Giorno sportivo',kickoff:'Calcio d’inizio',venue:'Stadio',events:'Eventi della partita',statistics:'Statistiche della partita',loading:'Caricamento partita…',scheduled:'In programma',awaiting_participants:'In attesa delle squadre',lineups_confirmed:'Formazioni confermate',in_progress:'In corso',completed:'Terminata',postponed:'Rinviata',cancelled:'Annullata',unavailable:'Non annunciato',tbd:'Da determinare',home:'Formazione casa',away:'Formazione ospite',notConfirmed:'Non confermata',confirmed:'Confermata',noLineup:'Formazione non disponibile.',noEvents:'Eventi non ancora registrati.',noStats:'Statistiche non ancora disponibili.',notFound:'Partita inesistente o non pubblicata.',error:'Informazioni sulla partita temporaneamente non disponibili.',noData:'Nessun dato ufficiale disponibile',leg:'Gara',penalties:'Rigori',extraTime:'Dopo i supplementari',goals:'Gol',shots:'Tiri',shotsOnTarget:'Tiri in porta',possession:'Possesso',passes:'Passaggi',fouls:'Falli',corners:'Calci d’angolo',offsides:'Fuorigioco',yellowCards:'Ammonizioni',redCards:'Espulsioni',saves:'Parate'},
  de:{match:'Spiel',overview:'Übersicht',lineups:'Aufstellungen',stats:'Statistik',details:'Spieldetails',competition:'Wettbewerb',season:'Saison',round:'Spieltag',day:'Spieltag im Kalender',kickoff:'Anstoß',venue:'Stadion',events:'Spielereignisse',statistics:'Spielstatistik',loading:'Spiel wird geladen…',scheduled:'Angesetzt',awaiting_participants:'Teilnehmer ausstehend',lineups_confirmed:'Aufstellungen bestätigt',in_progress:'Läuft',completed:'Abpfiff',postponed:'Verschoben',cancelled:'Abgesagt',unavailable:'Nicht bekannt',tbd:'Noch offen',home:'Heimaufstellung',away:'Gastaufstellung',notConfirmed:'Nicht bestätigt',confirmed:'Bestätigt',noLineup:'Aufstellung nicht verfügbar.',noEvents:'Noch keine Ereignisse erfasst.',noStats:'Noch keine Spielstatistik verfügbar.',notFound:'Spiel nicht gefunden oder nicht veröffentlicht.',error:'Spielinformationen derzeit nicht verfügbar.',noData:'Keine offiziellen Daten',leg:'Spiel',penalties:'Elfmeterschießen',extraTime:'Nach Verlängerung',goals:'Tore',shots:'Schüsse',shotsOnTarget:'Torschüsse',possession:'Ballbesitz',passes:'Pässe',fouls:'Fouls',corners:'Ecken',offsides:'Abseits',yellowCards:'Gelbe Karten',redCards:'Rote Karten',saves:'Paraden'},
  es:{match:'Partido',overview:'Resumen',lineups:'Alineaciones',stats:'Estadísticas',details:'Detalles del partido',competition:'Competición',season:'Temporada',round:'Jornada',day:'Día deportivo',kickoff:'Inicio',venue:'Estadio',events:'Eventos del partido',statistics:'Estadísticas del partido',loading:'Cargando partido…',scheduled:'Programado',awaiting_participants:'Pendiente de participantes',lineups_confirmed:'Alineaciones confirmadas',in_progress:'En juego',completed:'Finalizado',postponed:'Aplazado',cancelled:'Cancelado',unavailable:'Sin anunciar',tbd:'Por determinar',home:'Alineación local',away:'Alineación visitante',notConfirmed:'Sin confirmar',confirmed:'Confirmada',noLineup:'Alineación no disponible.',noEvents:'Eventos aún no registrados.',noStats:'Estadísticas todavía no disponibles.',notFound:'Partido no encontrado o no publicado.',error:'Información del partido temporalmente no disponible.',noData:'Sin datos oficiales',leg:'Partido',penalties:'Penaltis',extraTime:'Tras prórroga',goals:'Goles',shots:'Tiros',shotsOnTarget:'Tiros a puerta',possession:'Posesión',passes:'Pases',fouls:'Faltas',corners:'Córneres',offsides:'Fueras de juego',yellowCards:'Amarillas',redCards:'Rojas',saves:'Paradas'},
  fr:{match:'Match',overview:'Vue d’ensemble',lineups:'Compositions',stats:'Statistiques',details:'Détails du match',competition:'Compétition',season:'Saison',round:'Journée',day:'Jour sportif',kickoff:'Coup d’envoi',venue:'Stade',events:'Événements du match',statistics:'Statistiques du match',loading:'Chargement du match…',scheduled:'Programmé',awaiting_participants:'Participants en attente',lineups_confirmed:'Compositions confirmées',in_progress:'En cours',completed:'Terminé',postponed:'Reporté',cancelled:'Annulé',unavailable:'Non annoncé',tbd:'À déterminer',home:'Composition domicile',away:'Composition extérieur',notConfirmed:'Non confirmée',confirmed:'Confirmée',noLineup:'Composition indisponible.',noEvents:'Aucun événement enregistré.',noStats:'Statistiques indisponibles pour le moment.',notFound:'Match introuvable ou non publié.',error:'Informations temporairement indisponibles.',noData:'Aucune donnée officielle',leg:'Match',penalties:'Tirs au but',extraTime:'Après prolongation',goals:'Buts',shots:'Tirs',shotsOnTarget:'Tirs cadrés',possession:'Possession',passes:'Passes',fouls:'Fautes',corners:'Corners',offsides:'Hors-jeu',yellowCards:'Cartons jaunes',redCards:'Cartons rouges',saves:'Arrêts'}
 };
 const codes=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const statKeys=['goals','shots','shotsOnTarget','possession','passes','fouls','corners','offsides','yellowCards','redCards','saves'];
 const numeric=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&Number.isSafeInteger(Number(x));
 const language=()=>{const l=document.documentElement.lang?.slice(0,2).toLowerCase();return Object.hasOwn(copies,l)?l:'en'};
 const t=()=>copies[language()];
 const find=key=>root.querySelector(key);
 const write=(key,value)=>{const n=find(key);if(n)n.textContent=String(value)};
 const matchId=(/^\/matches\/([1-9][0-9]*)$/.exec(location.pathname)||[])[1];
 let data=null,clubCatalog=null,competitionCatalog=null,errorKind=null;
 let view=new URLSearchParams(location.search).get('view');
 if(!views.includes(view))view='overview';
 function href(path){return typeof window.faAppHref==='function'?window.faAppHref(path):path}
 function selectView(next,push=false){
  if(!views.includes(next))return;
  view=next;
  tabs.forEach(tab=>{const active=tab.dataset.matchTab===view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1});
  root.querySelectorAll('[data-match-panel]').forEach(panel=>{panel.hidden=panel.dataset.matchPanel!==view});
  if(push){const url=new URL(location.href);if(view==='overview')url.searchParams.delete('view');else url.searchParams.set('view',view);history.pushState(history.state,'',url.pathname+url.search+url.hash)}
 }
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>selectView(tab.dataset.matchTab,true));
  tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[target].focus();selectView(tabs[target].dataset.matchTab,true)});
 });
 window.addEventListener('popstate',()=>{const target=new URLSearchParams(location.search).get('view');selectView(views.includes(target)?target:'overview')});
 const clubKey=value=>{if(typeof value!=='string')return null;const m=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(value);return m?m[1]+'-'+Number(m[2]):null};
 function clubData(participant){
  const key=clubKey(participant?.clubId);
  if(!key||!clubCatalog?.clubs)return null;
  const club=clubCatalog.clubs.find(x=>x.countryId+'-'+x.clubId===key);
  return club?{...club,key}:null;
 }
 function participantFallback(p){
  const tr=t();if(!p||typeof p!=='object')return tr.tbd;
  if(p.kind==='leagueRank'&&Number.isInteger(p.rank)&&p.rank>0)return tr.round+' '+p.rank;
  return tr.tbd;
 }
 function showTeam(side){
  const slot=find('[data-match-'+side+'-crest]'),label=find('[data-match-'+side+'-name]');
  if(!slot||!label)return;
  const d=clubData(data?.[side+'Participant']);
  const pending=data?.participantA&&side==='home'?data.participantA:data?.participantB&&side==='away'?data.participantB:null;
  const publishedClubId=clubKey(data?.[side+'Participant']?.clubId);
  const primary=d?.primaryName||publishedClubId||participantFallback(pending),compact=d?.compactName||primary;
  label.replaceChildren();const full=document.createElement('span');full.className='app-match-primary-name';full.textContent=primary;
  const short=document.createElement('span');short.className='app-match-compact-name';short.textContent=compact;
  label.append(full,short);
  if(d)label.href=href('/clubs/'+d.countryId.toLowerCase()+'/'+d.clubId+'/overview');else label.removeAttribute('href');
  slot.replaceChildren();
  const crest=d&&clubCatalog?.clubCrests?.[d.key];
  if(crest&&new RegExp('^assets/clubs/'+d.countryId+'/'+d.clubId+'/crest\\.svg$').test(crest)){
   const img=document.createElement('img');img.src='/'+crest;img.alt='';img.width=74;img.height=74;slot.append(img);
  }else if(!d){const placeholder=document.createElement('span');placeholder.className='app-match-crest-skeleton';slot.append(placeholder)}
 }
 function officialState(){
  if(!data)return 'scheduled';
  const s=data.status;
  if(s==='scheduled'&&validLineup(data.lineups?.home)&&validLineup(data.lineups?.away))return 'lineups_confirmed';
  return ['awaiting_participants','scheduled','in_progress','completed','postponed','cancelled'].includes(s)?s:'scheduled';
 }
 function validLineup(v){return v?.confirmed===true&&Array.isArray(v.starters)&&v.starters.length===11}
 function setDetails(tr,key,value){const n=find('[data-match-detail-value="'+key+'"]');if(n)n.textContent=value??tr.unavailable}
 function fmtStage(tr){
  if(!data)return '—';
  const stage=data.stageId==='league'?'':data.stageId;
  const round=Number.isSafeInteger(data.round)&&data.round>0?tr.round+' '+data.round:'';
  const leg=Number.isSafeInteger(data.leg)&&data.leg>0?' · '+tr.leg+' '+data.leg:'';
  return (stage?stage+' · ':'')+round+leg||'—';
 }
 function fmtDate(value){
  if(typeof value!=='string'||!value.trim())return t().unavailable;
  const time=Date.parse(value);if(!Number.isFinite(time))return t().unavailable;
  return new Intl.DateTimeFormat(language(),{dateStyle:'medium',timeStyle:'short'}).format(time);
 }
 function renderLineup(side){
  const tr=t(),lineup=data?.lineups?.[side],confirmed=validLineup(lineup),slot=find('[data-match-lineup-players="'+side+'"]');
  write('[data-match-lineup-heading="'+side+'"]',tr[side]);write('[data-match-lineup-status="'+side+'"]',confirmed?tr.confirmed:tr.notConfirmed);
  if(!slot)return;
  slot.replaceChildren();
  if(!confirmed){const p=document.createElement('p');p.textContent=tr.noLineup;slot.append(p);return}
  const ul=document.createElement('ul');ul.className='app-match-player-list';
  lineup.starters.forEach((player,i)=>{
   const li=document.createElement('li'),name=document.createElement('span');
   const id=player&&numeric(String(player.playerId??''))?String(player.playerId):null;
   const textName=typeof player?.displayName==='string'&&player.displayName.trim()?player.displayName.trim():id?'#'+id:tr.noData;
   if(id){const link=document.createElement('a');link.href=href('/players/'+id);link.textContent=textName;name.append(link)}else name.textContent=textName;
   const left=document.createElement('span'),number=document.createElement('span');number.className='app-match-player-number';number.textContent=Number.isInteger(player?.shirtNumber)?String(player.shirtNumber):String(i+1);
   left.append(number,name);li.append(left);
   if(typeof player?.position==='string'){const pos=document.createElement('span');pos.className='app-match-player-position';pos.textContent=player.position;li.append(pos)}
   ul.append(li);
  });slot.append(ul);
 }
 function renderEvents(){
  const slot=find('[data-match-events]');if(!slot)return;slot.replaceChildren();
  const tr=t(),events=['completed','in_progress'].includes(data?.status)&&Array.isArray(data.events)?data.events:null;
  if(!events?.length){const p=document.createElement('p');p.textContent=tr.noEvents;slot.append(p);return}
  const ul=document.createElement('ul');ul.className='app-match-event-list';
  events.forEach(event=>{
   if(!event||typeof event.type!=='string'||!event.type.trim())return;
   const li=document.createElement('li'),desc=document.createElement('span'),clock=document.createElement('span');
   desc.textContent=event.type;clock.textContent=Number.isInteger(event.minute)&&event.minute>=0?event.minute+'′':'';
   li.append(clock,desc);ul.append(li);
  });if(ul.childElementCount)slot.append(ul);else{const p=document.createElement('p');p.textContent=tr.noEvents;slot.append(p)}
 }
 function renderStats(){
  const slot=find('[data-match-stats]');if(!slot)return;slot.replaceChildren();
  const tr=t(),stats=data?.teamStats;
  if(!['completed','in_progress'].includes(data?.status)||!stats?.home||!stats?.away){const p=document.createElement('p');p.textContent=tr.noStats;slot.append(p);return}
  const wrap=document.createElement('div');wrap.className='app-match-stat-list';
  for(const key of statKeys){
   const home=stats.home[key],away=stats.away[key];
   if(typeof home!=='number'||typeof away!=='number'||!Number.isFinite(home)||!Number.isFinite(away)||home<0||away<0)continue;
   const row=document.createElement('div');row.className='app-match-stat-row';
   const a=document.createElement('span'),b=document.createElement('strong'),c=document.createElement('span'),suffix=key==='possession'?'%':'';
   a.textContent=home+suffix;b.textContent=tr[key];c.textContent=away+suffix;row.append(a,b,c);wrap.append(row);
  }
  if(wrap.childElementCount)slot.append(wrap);else{const p=document.createElement('p');p.textContent=tr.noStats;slot.append(p)}
 }
 function render(){
  const tr=t();
  Object.entries({match:tr.match,details:tr.details,competition:tr.competition,season:tr.season,round:tr.round,day:tr.day,kickoff:tr.kickoff,venue:tr.venue,events:tr.events,statistics:tr.statistics}).forEach(([k,v])=>root.querySelectorAll('[data-match-label="'+k+'"]').forEach(n=>n.textContent=v));
  tabs.forEach(n=>n.textContent=tr[n.dataset.matchTab]);
  if(errorKind){
   root.dataset.matchLoad='missing';
   const feedback=find('[data-match-feedback]');feedback.hidden=false;feedback.textContent=errorKind==='missing'?tr.notFound:tr.error;
   document.title=tr.match+' — Football Architect';return;
  }
  if(!data){write('[data-match-status]',tr.loading);return}
  root.dataset.matchLoad='ready';
  write('[data-match-reference]','#'+matchId);
  const comp=competitionCatalog?.competitions?.find(x=>x.id===data.competitionId);
  const name=comp?.name||data.competitionId;
  write('[data-match-competition]',name);write('[data-match-detail-value="competition"]',name);
  const compLink=find('[data-match-competition]');
  if(/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$|^int-[12]$/.test(data.competitionId))compLink.href=href('/competitions/'+data.competitionId.toLowerCase()+'/fixtures');else compLink.removeAttribute('href');
  write('[data-match-stage]',fmtStage(tr));
  write('[data-match-day]',Number.isInteger(data.day)?tr.day+' '+data.day:'—');
  setDetails(tr,'season',Number.isSafeInteger(data.season)?data.season:'—');
  setDetails(tr,'round',fmtStage(tr));setDetails(tr,'day',Number.isInteger(data.day)?data.day:'—');
  setDetails(tr,'kickoff',fmtDate(data.kickoff));
  setDetails(tr,'venue',typeof data.venue==='string'&&data.venue.trim()?data.venue:tr.unavailable);
  const state=officialState();write('[data-match-status]',tr[state]);
  const result=data.status==='completed'?data.result:null;
  const validScore=Number.isSafeInteger(result?.homeGoals)&&Number.isSafeInteger(result?.awayGoals)&&result.homeGoals>=0&&result.awayGoals>=0;
  write('[data-match-score]',validScore?result.homeGoals+' : '+result.awayGoals:'— : —');
  const more=validScore&&result?.penalties&&Number.isInteger(result.penalties.home)&&Number.isInteger(result.penalties.away)?tr.penalties+' '+result.penalties.home+'–'+result.penalties.away:validScore&&result?.extraTime?tr.extraTime:'';
  write('[data-match-extra]',more);
  showTeam('home');showTeam('away');
  renderLineup('home');renderLineup('away');renderEvents();renderStats();
  document.title=tr.match+' #'+matchId+' — Football Architect';
 }
 async function load(){
  if(!numeric(matchId)){errorKind='missing';render();return}
  const [official,clubs,competitions]=await Promise.allSettled([
   fetch('/api/matches/'+matchId,{credentials:'omit',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(r.status===404?'missing':'error');return r.json()}),
   fetch('/clubs/_shared/manifest.json',{credentials:'omit',cache:'force-cache'}).then(r=>r.ok?r.json():null),
   fetch('/competitions/_shared/manifest.json',{credentials:'omit',cache:'force-cache'}).then(r=>r.ok?r.json():null)
  ]);
  if(clubs.status==='fulfilled'&&Array.isArray(clubs.value?.clubs))clubCatalog=clubs.value;
  if(competitions.status==='fulfilled'&&Array.isArray(competitions.value?.competitions))competitionCatalog=competitions.value;
  if(official.status!=='fulfilled'){errorKind=official.reason?.message==='missing'?'missing':'error';render();return}
  const obj=official.value;
  if(obj?.schemaVersion!==1||obj?.providerId!=='authoritative-world'||String(obj.matchId)!==matchId||
    !['awaiting_participants','scheduled','in_progress','completed','postponed','cancelled'].includes(obj.status)||
    typeof obj.competitionId!=='string'||!Number.isSafeInteger(obj.season)||obj.season<1||
    obj.status==='completed'&&(!Number.isSafeInteger(obj.result?.homeGoals)||!Number.isSafeInteger(obj.result?.awayGoals)||obj.result.homeGoals<0||obj.result.awayGoals<0)){
   errorKind='error';render();return;
  }
  data=obj;errorKind=null;render();
 }
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 selectView(view);render();void load();
})();
