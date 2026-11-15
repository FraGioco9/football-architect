/* #577 — Scoreboard-first match detail. Results and participants are official-only. */
(()=>{'use strict';
 const root=document.querySelector('[data-match-detail]');if(!root)return;
 const copies={
  en:{match:'Match',tbd:'To be determined',round:'Round',overview:'Overview',lineups:'Lineups',events:'Events',stats:'Stats',season:'Season',day:'Day',notAvailable:'Not available',confirmed:'Confirmed',available:'Available',eventSingular:'event',eventPlural:'events',pitch:'Empty football pitch; match visualization is not yet available',notFound:'Match not found or not published.',error:'Match information is temporarily unavailable.'},
  it:{match:'Partita',tbd:'Da determinare',round:'Giornata',overview:'Panoramica',lineups:'Formazioni',events:'Eventi',stats:'Statistiche',season:'Stagione',day:'Giorno',notAvailable:'Non disponibili',confirmed:'Confermate',available:'Disponibili',eventSingular:'evento',eventPlural:'eventi',pitch:'Campo vuoto; visualizzazione della partita non ancora disponibile',notFound:'Partita inesistente o non pubblicata.',error:'Informazioni sulla partita temporaneamente non disponibili.'},
  de:{match:'Spiel',tbd:'Noch offen',round:'Spieltag',overview:'Übersicht',lineups:'Aufstellungen',events:'Ereignisse',stats:'Statistiken',season:'Saison',day:'Tag',notAvailable:'Nicht verfügbar',confirmed:'Bestätigt',available:'Verfügbar',eventSingular:'Ereignis',eventPlural:'Ereignisse',pitch:'Leeres Spielfeld; Spielvisualisierung noch nicht verfügbar',notFound:'Spiel nicht gefunden oder nicht veröffentlicht.',error:'Spielinformationen derzeit nicht verfügbar.'},
  es:{match:'Partido',tbd:'Por determinar',round:'Jornada',overview:'Resumen',lineups:'Alineaciones',events:'Eventos',stats:'Estadísticas',season:'Temporada',day:'Día',notAvailable:'No disponible',confirmed:'Confirmadas',available:'Disponible',eventSingular:'evento',eventPlural:'eventos',pitch:'Campo vacío; visualización del partido todavía no disponible',notFound:'Partido no encontrado o no publicado.',error:'Información del partido temporalmente no disponible.'},
  fr:{match:'Match',tbd:'À déterminer',round:'Journée',overview:'Aperçu',lineups:'Compositions',events:'Événements',stats:'Statistiques',season:'Saison',day:'Jour',notAvailable:'Indisponible',confirmed:'Confirmées',available:'Disponible',eventSingular:'événement',eventPlural:'événements',pitch:'Terrain vide; visualisation du match pas encore disponible',notFound:'Match introuvable ou non publié.',error:'Informations temporairement indisponibles.'}
 };
 const validLineup=lineup=>lineup?.confirmed===true&&Array.isArray(lineup.starters)&&lineup.starters.length===11;
 const knownStats=stats=>stats&&typeof stats==='object'&&!Array.isArray(stats)&&
  stats.home&&typeof stats.home==='object'&&Object.keys(stats.home).length>0&&
  stats.away&&typeof stats.away==='object'&&Object.keys(stats.away).length>0;
 const numeric=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&Number.isSafeInteger(Number(x));
 const lang=()=>{const code=document.documentElement.lang?.slice(0,2).toLowerCase();return Object.hasOwn(copies,code)?code:'en'};
 const text=()=>copies[lang()];
 const find=s=>root.querySelector(s);
 const write=(s,value)=>{const node=find(s);if(node)node.textContent=String(value)};
 const matchId=(/^\/matches\/([1-9][0-9]*)$/.exec(location.pathname)||[])[1];
 const clubKey=value=>{const m=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(value||'');return m?m[1]+'-'+Number(m[2]):null};
 const href=path=>typeof window.faAppHref==='function'?window.faAppHref(path):path;
 let data=null,clubs=null,competitions=null,themeResolver=null,errorKind=null;
 // Use the approved SVG directly: its primary and secondary fills are
 // identical in Dark and Light, without recolouring or injected outlines.
 function showTeam(side){
  const name=find('[data-match-'+side+'-name]');if(!name)return;
  const id=clubKey(data?.[side+'Participant']?.clubId);
  const club=id&&clubs?.clubs?.find(c=>c.countryId+'-'+c.clubId===id);
  const participant=side==='home'?data?.participantA:data?.participantB;
  let fallback=text().tbd;
  if(!id&&participant?.kind==='leagueRank'&&Number.isSafeInteger(participant.rank)&&participant.rank>0)
   fallback=text().round+' '+participant.rank;
  const full=club?.primaryName||id||fallback;
  // Use the canonical club abbreviation (manifest field "abbr") on both
  // desktop and mobile; retain the primary name for accessible descriptions.
  const abbreviation=typeof club?.abbr==='string'&&/^[A-Z0-9]{2,5}$/.test(club.abbr)
   ?club.abbr:club?.compactName||full;
  name.textContent=abbreviation;
  name.setAttribute('aria-label',full);
  name.removeAttribute('title');
  // A verified club ID is enough for canonical routing even if the optional
  // club catalog is delayed; missing/unresolved participants are not links.
  if(id){
   name.href=href('/clubs/'+id.split('-')[0].toLowerCase()+'/'+Number(id.split('-')[1])+'/overview');
   name.target='_blank';name.rel='noopener noreferrer';
  }else{
   name.removeAttribute('href');name.removeAttribute('target');name.removeAttribute('rel');
  }
 }
 function applyCompetition(){
  const comp=competitions?.competitions?.find(c=>c.id===data?.competitionId);
  const display=comp?.name||data?.competitionId||text().match;
  const link=find('[data-match-competition-link]');
  if(link){
   link.setAttribute('aria-label',display);
   link.removeAttribute('title');
   if(/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(data?.competitionId||'')){
    link.href=href('/competitions/'+data.competitionId.toLowerCase()+'/fixtures');
    link.target='_blank';link.rel='noopener noreferrer';
   }else{
    link.removeAttribute('href');link.removeAttribute('target');link.removeAttribute('rel');
   }
  }
  const theme=themeResolver?.(comp)||{
   backgroundHex:'#243039',foregroundHex:'#F5F1E8',accentHex:'#F5F1E8',logoAsset:null,kind:'neutral'
  };
  const board=find('.app-match-scoreboard');
  if(board){
   board.style.setProperty('--app-match-surface',theme.backgroundHex);
   board.style.setProperty('--app-match-ink',theme.foregroundHex);
   board.style.setProperty('--app-match-accent',theme.accentHex);
   board.dataset.scoreboardTheme=theme.kind;
  }
  const slot=find('[data-match-competition-logo]');if(!slot)return;
  // Brand assets are already published at assets/divisions/<slug>/compact.svg.
  // Do not request an unapproved path or show an unrelated Football Architect logo.
  const intended=theme.logoAsset?'/'+theme.logoAsset:'';
  if(slot.dataset.matchLogoPath===intended)return;
  slot.dataset.matchLogoPath=intended;
  delete slot.dataset.matchLogoPresent;
  slot.replaceChildren();
  if(!intended)return;
  const img=document.createElement('img');
  img.alt='';img.width=44;img.height=44;img.decoding='async';
  img.addEventListener('error',()=>{
   if(slot.dataset.matchLogoPath===intended&&slot.contains(img)){
    delete slot.dataset.matchLogoPresent;
    img.remove();
   }
  },{once:true});
  slot.dataset.matchLogoPresent='true';
  slot.append(img);
  img.src=intended;
 }
 function renderContext(tr){
  for(const key of ['overview','lineups','events','stats'])
   write('[data-match-card-title="'+key+'"]',tr[key]);
  write('[data-match-visual-title]',tr.match);
  const pitch=find('[data-match-pitch]');
  if(pitch)pitch.setAttribute('aria-label',tr.pitch);
  if(!data)return;
  // These are factual summaries, not selectable tabs. The empty pitch is
  // always present; no live simulation or gameplay state is inferred.
  const status=data.status,playing=status==='in_progress'||status==='completed';
  const authoritative=data.provenance?.kind==='authoritative';
  const lineups=authoritative&&validLineup(data.lineups?.home)&&validLineup(data.lineups?.away);
  const events=authoritative&&playing&&Array.isArray(data.events);
  const stats=authoritative&&playing&&knownStats(data.statistics);
  const emphasis={
   overview:playing?'medium':'high',
   lineups:lineups?'high':status==='scheduled'||status==='in_progress'?'medium':'low',
   events:events?'high':status==='in_progress'?'medium':'low',
   stats:stats?'high':status==='in_progress'?'medium':'low'
  };
  for(const [key,value] of Object.entries(emphasis)){
   const card=find('[data-match-card="'+key+'"]');
   if(card)card.dataset.matchEmphasis=value;
  }
  const overview=[tr.season+' '+data.season];
  if(Number.isSafeInteger(data.round)&&data.round>0)overview.push(tr.round+' '+data.round);
  write('[data-match-card-summary="overview"]',overview.join(' · '));
  write('[data-match-card-detail="overview"]',Number.isSafeInteger(data.day)&&data.day>0?tr.day+' '+data.day:'');
  write('[data-match-card-summary="lineups"]',lineups?tr.confirmed:tr.notAvailable);
  write('[data-match-card-summary="events"]',events?data.events.length+' '+(data.events.length===1?tr.eventSingular:tr.eventPlural):tr.notAvailable);
  write('[data-match-card-summary="stats"]',stats?tr.available:tr.notAvailable);
 }
 function render(){
  const tr=text();
  if(errorKind){
   root.dataset.matchLoad='missing';
   const feedback=find('[data-match-feedback]');if(feedback){feedback.hidden=false;feedback.textContent=errorKind==='missing'?tr.notFound:tr.error}
   document.title=tr.match+' — Football Architect';return;
  }
  renderContext(tr);
  if(!data)return;
  root.dataset.matchLoad='ready';
  applyCompetition();
  // Scores are shown ONLY when provided as a verified completed result.
  const result=data.status==='completed'?data.result:null;
  const validScore=Number.isSafeInteger(result?.homeGoals)&&Number.isSafeInteger(result?.awayGoals)&&result.homeGoals>=0&&result.awayGoals>=0;
  // Keep both score slots empty until a verified completed result exists;
  // the centred separator remains visible for every match state.
  // Never imply that a scheduled, postponed or unreported match is 0–0.
  write('[data-match-home-score]',validScore?result.homeGoals:'');
  write('[data-match-away-score]',validScore?result.awayGoals:'');
  for(const side of ['home','away']){
   const score=find('[data-match-'+side+'-score]');
   if(score)score.setAttribute('aria-hidden',String(!validScore));
  }
  showTeam('home');showTeam('away');document.title=tr.match+' — Football Architect';
 }
 async function load(){
  if(!numeric(matchId)){errorKind='missing';render();return}
  const reads=await Promise.allSettled([
   fetch('/api/matches/'+matchId,{credentials:'omit',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(r.status===404?'missing':'error');return r.json()}),
   fetch('/clubs/_shared/manifest.json',{credentials:'omit',cache:'force-cache'}).then(r=>r.ok?r.json():null),
   fetch('/competitions/_shared/manifest.json',{credentials:'omit',cache:'force-cache'}).then(r=>r.ok?r.json():null),
   import('/assets/match-scoreboard-themes.mjs')
  ]);
  if(reads[1].status==='fulfilled'&&Array.isArray(reads[1].value?.clubs))clubs=reads[1].value;
  if(reads[2].status==='fulfilled'&&Array.isArray(reads[2].value?.competitions))competitions=reads[2].value;
  if(reads[3].status==='fulfilled'&&typeof reads[3].value?.resolveScoreboardTheme==='function')
   themeResolver=reads[3].value.resolveScoreboardTheme;
  if(reads[0].status!=='fulfilled'){errorKind=reads[0].reason?.message==='missing'?'missing':'error';render();return}
  const item=reads[0].value;
  if(item?.schemaVersion!==1||item?.providerId!=='authoritative-world'||String(item.matchId)!==matchId||
   !['awaiting_participants','scheduled','in_progress','completed','postponed','cancelled'].includes(item.status)||
   !/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(item.competitionId||'')||
   !Number.isSafeInteger(item.season)||item.season<1||
   item.status==='completed'&&(!Number.isSafeInteger(item.result?.homeGoals)||!Number.isSafeInteger(item.result?.awayGoals)||item.result.homeGoals<0||item.result.awayGoals<0)){
   errorKind='error';render();return;
  }
  data=item;errorKind=null;render();
 }
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 render();void load();
})();
