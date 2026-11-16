/* #577 — Scoreboard-first match detail. Results and participants are official-only. */
(()=>{'use strict';
 const root=document.querySelector('[data-match-detail]');if(!root)return;
 const copies={
  en:{match:'Match',tbd:'To be determined',round:'Round',home:'Home',away:'Away',position:'Position',form:'Form',lineup:'Lineup',player:'Player',rating:'Test rating',formW:'W',formD:'D',formL:'L',outcomeW:'Win',outcomeD:'Draw',outcomeL:'Loss',overview:'Overview',competition:'Competition',season:'Season',date:'Date',stadium:'Stadium',status:'Status',statusNames:{awaiting_participants:'Awaiting teams',scheduled:'Scheduled',in_progress:'In progress',completed:'Completed',postponed:'Postponed',cancelled:'Cancelled'},pitch:'Empty football pitch; match visualization is not yet available',notFound:'Match not found or not published.',error:'Match information is temporarily unavailable.'},
  it:{match:'Partita',tbd:'Da determinare',round:'Giornata',home:'Casa',away:'Trasferta',position:'Posizione',form:'Forma',lineup:'Formazione',player:'Giocatore',rating:'Voto di prova',formW:'V',formD:'N',formL:'P',outcomeW:'Vittoria',outcomeD:'Pareggio',outcomeL:'Sconfitta',overview:'Panoramica',competition:'Competizione',season:'Stagione',date:'Data',stadium:'Stadio',status:'Stato',statusNames:{awaiting_participants:'In attesa delle squadre',scheduled:'Programmata',in_progress:'In corso',completed:'Conclusa',postponed:'Rinviata',cancelled:'Annullata'},pitch:'Campo vuoto; visualizzazione della partita non ancora disponibile',notFound:'Partita inesistente o non pubblicata.',error:'Informazioni sulla partita temporaneamente non disponibili.'},
  de:{match:'Spiel',tbd:'Noch offen',round:'Spieltag',home:'Heim',away:'Gast',position:'Platz',form:'Form',lineup:'Aufstellung',player:'Spieler',rating:'Testnote',formW:'S',formD:'U',formL:'N',outcomeW:'Sieg',outcomeD:'Remis',outcomeL:'Niederlage',overview:'Übersicht',competition:'Wettbewerb',season:'Saison',date:'Datum',stadium:'Stadion',status:'Status',statusNames:{awaiting_participants:'Teilnehmer offen',scheduled:'Geplant',in_progress:'Läuft',completed:'Beendet',postponed:'Verschoben',cancelled:'Abgesagt'},pitch:'Leeres Spielfeld; Spielvisualisierung noch nicht verfügbar',notFound:'Spiel nicht gefunden oder nicht veröffentlicht.',error:'Spielinformationen derzeit nicht verfügbar.'},
  es:{match:'Partido',tbd:'Por determinar',round:'Jornada',home:'Local',away:'Visitante',position:'Posición',form:'Forma',lineup:'Alineación',player:'Jugador',rating:'Nota de prueba',formW:'G',formD:'E',formL:'P',outcomeW:'Victoria',outcomeD:'Empate',outcomeL:'Derrota',overview:'Resumen',competition:'Competición',season:'Temporada',date:'Fecha',stadium:'Estadio',status:'Estado',statusNames:{awaiting_participants:'Equipos pendientes',scheduled:'Programado',in_progress:'En curso',completed:'Finalizado',postponed:'Aplazado',cancelled:'Cancelado'},pitch:'Campo vacío; visualización del partido todavía no disponible',notFound:'Partido no encontrado o no publicado.',error:'Información del partido temporalmente no disponible.'},
  fr:{match:'Match',tbd:'À déterminer',round:'Journée',home:'Domicile',away:'Extérieur',position:'Position',form:'Forme',lineup:'Composition',player:'Joueur',rating:'Note de test',formW:'V',formD:'N',formL:'D',outcomeW:'Victoire',outcomeD:'Nul',outcomeL:'Défaite',overview:'Aperçu',competition:'Compétition',season:'Saison',date:'Date',stadium:'Stade',status:'Statut',statusNames:{awaiting_participants:'Équipes à déterminer',scheduled:'Programmé',in_progress:'En cours',completed:'Terminé',postponed:'Reporté',cancelled:'Annulé'},pitch:'Terrain vide; visualisation du match pas encore disponible',notFound:'Match introuvable ou non publié.',error:'Informations temporairement indisponibles.'}
 };
 const numeric=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&Number.isSafeInteger(Number(x));
 const lang=()=>{const code=document.documentElement.lang?.slice(0,2).toLowerCase();return Object.hasOwn(copies,code)?code:'en'};
 const text=()=>copies[lang()];
 const find=s=>root.querySelector(s);
 const write=(s,value)=>{const node=find(s);if(node)node.textContent=String(value)};
 const matchId=(/^\/matches\/([1-9][0-9]*)$/.exec(location.pathname)||[])[1];
 const clubKey=value=>{const m=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(value||'');return m?m[1]+'-'+Number(m[2]):null};
 const href=path=>typeof window.faAppHref==='function'?window.faAppHref(path):path;
 const competitionHref=id=>/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(id||'')
  ?href('/competitions/'+id.toLowerCase()+'/fixtures'):null;
 // Current public match responses have venue:null and kickoff:null.
 // Never infer dates from sporting days. For non-neutral matches, a verified
 // home club's published stadiumName is authoritative when venue is absent.
 const publishedDate=kickoff=>{
  if(typeof kickoff!=='string')return '';
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(kickoff);
  if(!m)return '';
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  if(year<1900)return '';
  const parsed=new Date(Date.UTC(year,month-1,day));
  if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()+1!==month||parsed.getUTCDate()!==day)return '';
  const locale={en:'en-GB',it:'it-IT',de:'de-DE',es:'es-ES',fr:'fr-FR'}[lang()];
  return new Intl.DateTimeFormat(locale,{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(parsed);
 };
 const publishedStadium=venue=>{
  const name=typeof venue==='string'?venue:venue&&typeof venue==='object'&&!Array.isArray(venue)?venue.name:null;
  return typeof name==='string'&&name.trim().length>0&&name.trim().length<=120?name.trim():'';
 };
 let data=null,clubs=null,competitions=null,themeResolver=null,errorKind=null,sideProjection=null;

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
 // Published projection only: never guess a team, league position or result.
 function verifiedProjection(projection){
  return projection?.schemaVersion===1&&projection.providerId==='authoritative-world'&&
   projection.competitionId===data?.competitionId&&projection.selectedSeason===data?.season&&
   projection.provenance?.kind==='authoritative'&&['available','partial'].includes(projection.status)&&
   projection.data?.season===data.season&&Number.isSafeInteger(projection.data.seasonState?.day)&&
   Array.isArray(projection.data.fixtures)&&Array.isArray(projection.data.standings?.rows);
 }
 function sideFacts(side){
  const club=clubKey(data?.[side+'Participant']?.clubId);
  if(!club||!verifiedProjection(sideProjection))return {position:null,form:[]};
  const facts=sideProjection.data,priorDay=data.day;
  if(!Number.isSafeInteger(priorDay)||priorDay<1)return {position:null,form:[]};
  const rankRow=facts.standings.rows.find(row=>row.clubId===club);
  // A published present-day table is a pre-match table ONLY if the sporting
  // world has not yet reached this fixture. Historical ranks are left blank.
  const safeRank=data.stageId==='league'&&facts.seasonState.day<priorDay&&
   Number.isSafeInteger(rankRow?.rank)&&rankRow.rank>0&&
   Number.isSafeInteger(rankRow?.played)&&rankRow.played>0?rankRow.rank:null;
  const games=facts.fixtures.filter(f=>f?.competitionId===data.competitionId&&
   Number.isSafeInteger(f.day)&&f.day>0&&f.day<priorDay&&
   (f.homeClubId===club||f.awayClubId===club)&&
   Number.isSafeInteger(f.result?.homeGoals)&&f.result.homeGoals>=0&&
   Number.isSafeInteger(f.result?.awayGoals)&&f.result.awayGoals>=0)
   .sort((a,b)=>a.day-b.day||String(a.id).localeCompare(String(b.id),'en'));
  const form=games.slice(-5).map(f=>{
   const home=f.homeClubId===club,a=f.result.homeGoals,b=f.result.awayGoals;
   return a===b?'d':home?(a>b?'w':'l'):(b>a?'w':'l');
  });
  return {position:safeRank,form};
 }
 // Render a single official-only Overview panel over the field.
 // Unknown or unpublished context stays blank rather than being fabricated.
 function renderOverview(tr){
  const comp=competitions?.competitions?.find(c=>c.id===data?.competitionId);
  const link=find('[data-match-overview="competition"]');
  if(link){
   link.textContent=data?(comp?.name||data.competitionId):'';
   const route=competitionHref(data?.competitionId);
   if(route){link.href=route;link.target='_blank';link.rel='noopener noreferrer';}
   else{link.removeAttribute('href');link.removeAttribute('target');link.removeAttribute('rel');}
   link.removeAttribute('title');
  }
  write('[data-match-overview="season"]',Number.isSafeInteger(data?.season)&&data.season>0?data.season:'');
  write('[data-match-overview="round"]',Number.isSafeInteger(data?.round)&&data.round>0?data.round:'');
  write('[data-match-overview="date"]',data?publishedDate(data.kickoff):'');
  const homeKey=clubKey(data?.homeParticipant?.clubId);
  const homeClub=homeKey&&clubs?.clubs?.find(c=>c.countryId+'-'+c.clubId===homeKey);
  const isNeutral=data?.neutral===true;
  const homeStadium=!isNeutral?publishedStadium(homeClub?.stadiumName):'';
  write('[data-match-overview="stadium"]',data?(publishedStadium(data.venue)||homeStadium):'');
  write('[data-match-overview="status"]',data?(tr.statusNames[data.status]||''):'');
  const panel=find('[data-match-overview-panel]');
  if(panel)panel.setAttribute('aria-label',tr.overview);
 }
 function renderSides(tr){
  root.querySelectorAll('[data-match-label]').forEach(node=>{
   const key=node.dataset.matchLabel;
   if(key&&tr[key])node.textContent=tr[key];
  });
  for(const side of ['home','away']){
   const id=clubKey(data?.[side+'Participant']?.clubId);
   const club=id&&clubs?.clubs?.find(c=>c.countryId+'-'+c.clubId===id);
   const title=find('[data-match-side-name="'+side+'"]');
   if(title){
    title.textContent=club?.primaryName||id||tr[side];
    // Only a verified club identity can navigate to the canonical overview.
    // Match the scoreboard links; unresolved participants remain plain text.
    if(id){
     title.href=href('/clubs/'+id.split('-')[0].toLowerCase()+'/'+Number(id.split('-')[1])+'/overview');
     title.target='_blank';title.rel='noopener noreferrer';
    }else{
     title.removeAttribute('href');title.removeAttribute('target');title.removeAttribute('rel');
    }
    title.removeAttribute('title');
   }
   const crest=find('[data-match-side-crest="'+side+'"]');
   if(crest){
    // The canonical passive crest renderer accepts only published registry
    // entries. Never construct an unapproved SVG image URL.
    if(id&&crest.dataset.clubCrest!==id)crest.dataset.clubCrest=id;
    if(!id&&crest.dataset.clubCrest)delete crest.dataset.clubCrest;
   }
   const panel=find('[data-match-side="'+side+'"]');
   if(panel)panel.setAttribute('aria-label',tr[side]+' · '+(club?.primaryName||id||''));
   const facts=sideFacts(side);
   write('[data-match-position="'+side+'"]',facts.position??'–');
   // Display only verified prior results (1–5); never render blank slots.
   const formFact=find('[data-match-form-fact="'+side+'"]');
   if(formFact){
    formFact.hidden=facts.form.length===0;
    const stats=formFact.closest('.app-match-side-stats');
    if(stats)stats.dataset.formVisible=String(facts.form.length>0);
   }
   const form=find('[data-match-form="'+side+'"]');
   if(form){
    form.setAttribute('aria-label',tr[side]+' · '+tr.form);
    form.replaceChildren(...facts.form.map(state=>{
     const cell=document.createElement('span');
     cell.className='app-match-form-cell';
     cell.textContent=tr['form'+state.toUpperCase()];
     cell.dataset.outcome=state;
     cell.setAttribute('aria-label',tr['outcome'+state.toUpperCase()]);
     return cell;
    }));
   }
  }
 }
 // Keep all eleven rows preallocated. Only verified frozen real XI
 // participants appear; missing/unplayed/fallback sides retain placeholders.
 function renderLineups(tr){
  for(const side of ['home','away']){
   const list=find('[data-match-lineup="'+side+'"] .app-match-lineup-rows');
   if(!list)return;
   const source=data?.status==='completed'&&data?.provenance?.receiptHash
    ?data.lineup?.[side]:null;
   const starters=source?.kind==='real_xi'&&Array.isArray(source.starters)&&
    source.starters.length===11?source.starters:null;
   const valid=starters&&new Set(starters.map(p=>p.playerId)).size===11&&
    starters.every(p=>Number.isSafeInteger(p.playerId)&&p.playerId>0&&
     /^[A-Z]{2,3}$/.test(p.role)&&
     (p.rating===null||typeof p.rating==='number'));
   const rated=valid&&data.lineup?.ratingVersion==='test-rating-v1';
   for(const [i,row] of [...list.children].entries()){
    if(!valid||i>=starters.length){
     row.setAttribute('aria-hidden','true');
     const bar=document.createElement('span');bar.className='app-match-lineup-reserved';
     row.replaceChildren(bar);continue;
    }
    row.removeAttribute('aria-hidden');
    const starter=starters[i];
    const role=document.createElement('span');role.className='app-match-lineup-role';role.textContent=starter.role;
    const player=document.createElement('a');player.className='app-match-lineup-player';
    player.textContent=tr.player+' #'+starter.playerId;
    player.href=href('/players/'+starter.playerId);
    player.target='_blank';player.rel='noopener noreferrer';
    const vote=document.createElement('span');vote.className='app-match-lineup-rating';
    const n=starter.rating;
    const officialVote=rated&&typeof n==='number'&&Number.isFinite(n)&&n>=4&&n<=10&&
     Math.abs(n*10-Math.round(n*10))<1e-9;
    vote.textContent=officialVote?n.toFixed(1):'–';
    vote.setAttribute('aria-label',tr.rating+': '+vote.textContent);
    vote.title=tr.rating;
    row.replaceChildren(role,player,vote);
   }
   if(valid)list.removeAttribute('aria-hidden');
   else list.setAttribute('aria-hidden','true');
  }
 }
 function render(){
  const tr=text();
  if(errorKind){
   root.dataset.matchLoad='missing';
   const feedback=find('[data-match-feedback]');if(feedback){feedback.hidden=false;feedback.textContent=errorKind==='missing'?tr.notFound:tr.error}
   document.title=tr.match+' — Football Architect';return;
  }
  const pitch=find('[data-match-pitch]');if(pitch)pitch.setAttribute('aria-label',tr.pitch);
  renderOverview(tr);
  renderSides(tr);
  renderLineups(tr);
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
  // Match data and the competition snapshot are read independently. Only
  // the immutable verified match identity is allowed to request this season.
  if(!Number.isSafeInteger(item.day)||item.day<1||
   !clubKey(item.homeParticipant?.clubId)&&!clubKey(item.awayParticipant?.clubId))return;
  try{
   const response=await fetch('/api/competitions/'+item.competitionId+'/seasons/'+item.season,
    {credentials:'omit',cache:'no-store'});
   if(!response.ok)return;
   const snapshot=await response.json();
   if(verifiedProjection(snapshot)){sideProjection=snapshot;render();}
  }catch{/* Unavailable context remains empty; match and scoreboard stay intact. */}
 }
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 render();void load();
})();
