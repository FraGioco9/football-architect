/* #577 — Scoreboard-first match detail. Results and participants are official-only. */
(()=>{'use strict';
 const root=document.querySelector('[data-match-detail]');if(!root)return;
 const copies={
  en:{match:'Match',tbd:'To be determined',round:'Round',home:'Home',away:'Away',position:'Position',form:'Form',lineup:'Lineup',formW:'W',formD:'D',formL:'L',outcomeW:'Win',outcomeD:'Draw',outcomeL:'Loss',pitch:'Empty football pitch; match visualization is not yet available',notFound:'Match not found or not published.',error:'Match information is temporarily unavailable.'},
  it:{match:'Partita',tbd:'Da determinare',round:'Giornata',home:'Casa',away:'Trasferta',position:'Posizione',form:'Forma',lineup:'Formazione',formW:'V',formD:'N',formL:'P',outcomeW:'Vittoria',outcomeD:'Pareggio',outcomeL:'Sconfitta',pitch:'Campo vuoto; visualizzazione della partita non ancora disponibile',notFound:'Partita inesistente o non pubblicata.',error:'Informazioni sulla partita temporaneamente non disponibili.'},
  de:{match:'Spiel',tbd:'Noch offen',round:'Spieltag',home:'Heim',away:'Gast',position:'Platz',form:'Form',lineup:'Aufstellung',formW:'S',formD:'U',formL:'N',outcomeW:'Sieg',outcomeD:'Remis',outcomeL:'Niederlage',pitch:'Leeres Spielfeld; Spielvisualisierung noch nicht verfügbar',notFound:'Spiel nicht gefunden oder nicht veröffentlicht.',error:'Spielinformationen derzeit nicht verfügbar.'},
  es:{match:'Partido',tbd:'Por determinar',round:'Jornada',home:'Local',away:'Visitante',position:'Posición',form:'Forma',lineup:'Alineación',formW:'G',formD:'E',formL:'P',outcomeW:'Victoria',outcomeD:'Empate',outcomeL:'Derrota',pitch:'Campo vacío; visualización del partido todavía no disponible',notFound:'Partido no encontrado o no publicado.',error:'Información del partido temporalmente no disponible.'},
  fr:{match:'Match',tbd:'À déterminer',round:'Journée',home:'Domicile',away:'Extérieur',position:'Position',form:'Forme',lineup:'Composition',formW:'V',formD:'N',formL:'D',outcomeW:'Victoire',outcomeD:'Nul',outcomeL:'Défaite',pitch:'Terrain vide; visualisation du match pas encore disponible',notFound:'Match introuvable ou non publié.',error:'Informations temporairement indisponibles.'}
 };
 const numeric=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&Number.isSafeInteger(Number(x));
 const lang=()=>{const code=document.documentElement.lang?.slice(0,2).toLowerCase();return Object.hasOwn(copies,code)?code:'en'};
 const text=()=>copies[lang()];
 const find=s=>root.querySelector(s);
 const write=(s,value)=>{const node=find(s);if(node)node.textContent=String(value)};
 const matchId=(/^\/matches\/([1-9][0-9]*)$/.exec(location.pathname)||[])[1];
 const clubKey=value=>{const m=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(value||'');return m?m[1]+'-'+Number(m[2]):null};
 const href=path=>typeof window.faAppHref==='function'?window.faAppHref(path):path;
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
 function render(){
  const tr=text();
  if(errorKind){
   root.dataset.matchLoad='missing';
   const feedback=find('[data-match-feedback]');if(feedback){feedback.hidden=false;feedback.textContent=errorKind==='missing'?tr.notFound:tr.error}
   document.title=tr.match+' — Football Architect';return;
  }
  const pitch=find('[data-match-pitch]');if(pitch)pitch.setAttribute('aria-label',tr.pitch);
  renderSides(tr);
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
