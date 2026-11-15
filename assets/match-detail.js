/* #577 — Scoreboard-first match detail. Results and participants are official-only. */
(()=>{'use strict';
 const root=document.querySelector('[data-match-detail]');if(!root)return;
 const copies={
  en:{match:'Match',loading:'Loading match…',scheduled:'Scheduled',awaiting_participants:'Awaiting participants',lineups_confirmed:'Lineups confirmed',in_progress:'In progress',completed:'Full time',postponed:'Postponed',cancelled:'Cancelled',tbd:'To be determined',round:'Round',day:'Sporting day',leg:'Leg',penalties:'Penalties',extraTime:'After extra time',notFound:'Match not found or not published.',error:'Match information is temporarily unavailable.'},
  it:{match:'Partita',loading:'Caricamento partita…',scheduled:'In programma',awaiting_participants:'In attesa delle squadre',lineups_confirmed:'Formazioni confermate',in_progress:'In corso',completed:'Terminata',postponed:'Rinviata',cancelled:'Annullata',tbd:'Da determinare',round:'Giornata',day:'Giorno sportivo',leg:'Gara',penalties:'Rigori',extraTime:'Dopo i supplementari',notFound:'Partita inesistente o non pubblicata.',error:'Informazioni sulla partita temporaneamente non disponibili.'},
  de:{match:'Spiel',loading:'Spiel wird geladen…',scheduled:'Angesetzt',awaiting_participants:'Teilnehmer ausstehend',lineups_confirmed:'Aufstellungen bestätigt',in_progress:'Läuft',completed:'Abpfiff',postponed:'Verschoben',cancelled:'Abgesagt',tbd:'Noch offen',round:'Spieltag',day:'Sporttag',leg:'Spiel',penalties:'Elfmeterschießen',extraTime:'Nach Verlängerung',notFound:'Spiel nicht gefunden oder nicht veröffentlicht.',error:'Spielinformationen derzeit nicht verfügbar.'},
  es:{match:'Partido',loading:'Cargando partido…',scheduled:'Programado',awaiting_participants:'Pendiente de participantes',lineups_confirmed:'Alineaciones confirmadas',in_progress:'En juego',completed:'Finalizado',postponed:'Aplazado',cancelled:'Cancelado',tbd:'Por determinar',round:'Jornada',day:'Día deportivo',leg:'Partido',penalties:'Penaltis',extraTime:'Tras prórroga',notFound:'Partido no encontrado o no publicado.',error:'Información del partido temporalmente no disponible.'},
  fr:{match:'Match',loading:'Chargement du match…',scheduled:'Programmé',awaiting_participants:'Participants en attente',lineups_confirmed:'Compositions confirmées',in_progress:'En cours',completed:'Terminé',postponed:'Reporté',cancelled:'Annulé',tbd:'À déterminer',round:'Journée',day:'Jour sportif',leg:'Match',penalties:'Tirs au but',extraTime:'Après prolongation',notFound:'Match introuvable ou non publié.',error:'Informations temporairement indisponibles.'}
 };
 const numeric=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&Number.isSafeInteger(Number(x));
 const lang=()=>{const code=document.documentElement.lang?.slice(0,2).toLowerCase();return Object.hasOwn(copies,code)?code:'en'};
 const text=()=>copies[lang()];
 const find=s=>root.querySelector(s);
 const write=(s,value)=>{const node=find(s);if(node)node.textContent=String(value)};
 const matchId=(/^\/matches\/([1-9][0-9]*)$/.exec(location.pathname)||[])[1];
 const clubKey=value=>{const m=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(value||'');return m?m[1]+'-'+Number(m[2]):null};
 const href=path=>typeof window.faAppHref==='function'?window.faAppHref(path):path;
 const validLineup=lineup=>lineup?.confirmed===true&&Array.isArray(lineup.starters)&&lineup.starters.length===11;
 let data=null,clubs=null,competitions=null,themeResolver=null,errorKind=null;
 const logoSources=new Map();
 const svgNS='http://www.w3.org/2000/svg';
 // The published division SVGs are approved, path-only assets; render with
 // a stroke on EACH path, not a filter around the union of all silhouettes.
 async function loadLogoPaths(src){
  if(!logoSources.has(src))logoSources.set(src,fetch(src,{credentials:'omit',cache:'force-cache'}).then(async res=>{
   if(!res.ok)throw Error('Logo unavailable');
   const raw=await res.text();
   if(raw.length>100000||/<!|<\?/.test(raw))throw Error('Logo markup rejected');
   const parsed=new DOMParser().parseFromString(raw,'image/svg+xml');
   const rootSvg=parsed.documentElement;
   if(rootSvg.localName!=='svg'||rootSvg.namespaceURI!==svgNS||parsed.querySelector('parsererror'))throw Error('Invalid logo SVG');
   const style=rootSvg.querySelector('style');
   if(!style||rootSvg.querySelectorAll('style').length!==1)throw Error('Invalid logo palette');
   const colors=Object.create(null);
   for(const hit of style.textContent.matchAll(/\.s([01])\s*\{\s*fill:\s*(#[0-9a-fA-F]{6})\s*\}/g))
    colors['s'+hit[1]]=hit[2];
   if(!colors.s0||!colors.s1)throw Error('Unapproved logo palette');
   const viewBox=rootSvg.getAttribute('viewBox');
   if(!viewBox||!/^[-\d. ]+$/.test(viewBox))throw Error('Invalid logo dimensions');
   const svg=document.createElementNS(svgNS,'svg');
   svg.setAttribute('viewBox',viewBox);
   svg.setAttribute('class','app-match-logo-art');
   svg.setAttribute('aria-hidden','true');
   svg.setAttribute('focusable','false');
   let paths=0;
   const copy=(source,parent)=>{
    for(const child of source.children){
     if(child.localName==='style'&&source===rootSvg)continue;
     if(child.namespaceURI!==svgNS||!['g','path'].includes(child.localName))throw Error('Unexpected logo object');
     const node=document.createElementNS(svgNS,child.localName);
     const transform=child.getAttribute('transform');
     if(transform)node.setAttribute('transform',transform);
     if(child.localName==='g')copy(child,node);
     else{
      const d=child.getAttribute('d');
      const color=colors[child.getAttribute('class')];
      if(!color||!d||!/^[MmZzLlHhVvCcSsQqTtAaEe\d\s.,+\-]+$/.test(d))throw Error('Invalid logo path');
      node.setAttribute('d',d);
      node.setAttribute('fill',color);
      if(child.getAttribute('fill-rule')==='evenodd')node.setAttribute('fill-rule','evenodd');
      node.setAttribute('stroke','#F5F1E8');
      node.setAttribute('stroke-width','5');
      node.setAttribute('stroke-linejoin','round');
      node.setAttribute('vector-effect','non-scaling-stroke');
      node.setAttribute('paint-order','stroke fill');
      paths++;
     }
     parent.append(node);
    }
   };
   copy(rootSvg,svg);
   if(!paths)throw Error('Empty logo');
   return svg;
  }));
  return logoSources.get(src);
 }
 function officialState(){
  if(!data)return 'scheduled';
  const status=data.status;
  if(status==='scheduled'&&validLineup(data.lineups?.home)&&validLineup(data.lineups?.away))return 'lineups_confirmed';
  return ['awaiting_participants','scheduled','in_progress','completed','postponed','cancelled'].includes(status)?status:'scheduled';
 }
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
  if(club)name.href=href('/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview');
  else name.removeAttribute('href');
 }
 function applyCompetition(){
  const comp=competitions?.competitions?.find(c=>c.id===data?.competitionId);
  const display=comp?.name||data?.competitionId||text().match;
  const link=find('[data-match-competition-link]');
  if(link){
   link.setAttribute('aria-label',display);
   link.removeAttribute('title');
   if(/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(data?.competitionId||''))
    link.href=href('/competitions/'+data.competitionId.toLowerCase()+'/fixtures');
   else link.removeAttribute('href');
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
  void loadLogoPaths(intended).then(svg=>{
   if(slot.dataset.matchLogoPath!==intended)return;
   slot.replaceChildren(svg.cloneNode(true));
   slot.dataset.matchLogoPresent='true';
  }).catch(()=>{
   if(slot.dataset.matchLogoPath===intended){
    slot.replaceChildren();
    delete slot.dataset.matchLogoPresent;
   }
  });
 }
 function render(){
  const tr=text();
  if(errorKind){
   root.dataset.matchLoad='missing';
   const feedback=find('[data-match-feedback]');if(feedback){feedback.hidden=false;feedback.textContent=errorKind==='missing'?tr.notFound:tr.error}
   document.title=tr.match+' — Football Architect';return;
  }
  if(!data){write('[data-match-status]',tr.loading);return}
  root.dataset.matchLoad='ready';
  applyCompetition();
  write('[data-match-status]',tr[officialState()]);
  // Scores are shown ONLY when provided as a verified completed result.
  const result=data.status==='completed'?data.result:null;
  const validScore=Number.isSafeInteger(result?.homeGoals)&&Number.isSafeInteger(result?.awayGoals)&&result.homeGoals>=0&&result.awayGoals>=0;
  write('[data-match-home-score]',validScore?result.homeGoals:'—');
  write('[data-match-away-score]',validScore?result.awayGoals:'—');
  const extra=validScore&&result?.penalties&&Number.isSafeInteger(result.penalties.home)&&Number.isSafeInteger(result.penalties.away)
   ?tr.penalties+' '+result.penalties.home+'–'+result.penalties.away:validScore&&result?.extraTime?tr.extraTime:'';
  write('[data-match-extra]',extra);
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
