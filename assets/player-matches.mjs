/** #712: Player Detail > Matches. One batched, world-fenced read per page. */
const copy={
 en:{headers:["Date","Competition","Club","Opponent","Venue","Result","Min","Gls","Ast","YC","RC","CS","Rat."],help:["Season and official matchday; calendar date not recorded","Competition played","Player's club in this match","Opposing club","Home, away or neutral venue","Final score from the player's perspective","Minutes played","Goals scored","Assists","Yellow cards","Red cards","Clean sheets","Rating"],
 season:'Season',day:'Day',allSeasons:'All seasons',allCompetitions:'All competitions',
 loading:'Loading verified appearances…',empty:'No official appearances recorded.',filteredEmpty:"No matches for these filters.",
 unavailable:'Official match evidence is not available.',error:'Unable to load matches.',
 more:'Load more',details:'Match performance details',starter:'Started',sub:'Substitute',
 positions:'Position played',venue:['Home','Away','Neutral'],resolution:'Resolution',penalties:'Penalties',
 noRecord:'Not recorded'},
 it:{headers:["Data","Competizione","Club","Avversario","Sede","Risultato","Min","Gol","Assist","Gialli","Rossi","CS","Val."],help:["Stagione e giornata ufficiale; data di calendario non registrata","Competizione disputata","Club del giocatore nella partita","Club avversario","Casa, trasferta o campo neutro","Risultato dalla prospettiva del giocatore","Minuti giocati","Gol segnati","Assist","Cartellini gialli","Cartellini rossi","Clean sheet","Valutazione"],
 season:'Stagione',day:'Giornata',allSeasons:'Tutte le stagioni',allCompetitions:'Tutte le competizioni',
 loading:'Caricamento presenze verificate…',empty:'Nessuna presenza ufficiale registrata.',filteredEmpty:"Nessuna partita per questi filtri.",
 unavailable:'Dati ufficiali delle partite non disponibili.',error:'Impossibile caricare le partite.',
 more:'Carica altre',details:'Dettagli prestazione',starter:'Titolare',sub:'Subentrato',
 positions:'Posizioni giocate',venue:['Casa','Trasferta','Neutro'],resolution:'Esito',penalties:'Rigori',
 noRecord:'Non registrato'},
 de:{headers:["Datum","Wettbewerb","Verein","Gegner","Ort","Ergebnis","Min","Tor.","Vor.","Gelb","Rot","CS","Bew."],help:["Saison und offizieller Spieltag; Kalenderdatum nicht erfasst","Gespielter Wettbewerb","Verein des Spielers in diesem Spiel","Gegnerischer Verein","Heim, auswärts oder neutral","Endstand aus Sicht des Spielers","Gespielte Minuten","Tore","Vorlagen","Gelbe Karten","Rote Karten","Spiele ohne Gegentor","Bewertung"],
 season:'Saison',day:'Spieltag',allSeasons:'Alle Saisons',allCompetitions:'Alle Wettbewerbe',
 loading:'Verifizierte Einsätze werden geladen…',empty:'Keine offiziellen Einsätze erfasst.',filteredEmpty:"Keine Spiele für diese Filter.",
 unavailable:'Offizielle Spieldaten nicht verfügbar.',error:'Spiele können nicht geladen werden.',
 more:'Mehr laden',details:'Spieldetails',starter:'Startelf',sub:'Eingewechselt',
 positions:'Gespielte Positionen',venue:['Heim','Gast','Neutral'],resolution:'Entscheidung',penalties:'Elfmeterschießen',
 noRecord:'Nicht erfasst'},
 es:{headers:["Fecha","Competición","Club","Rival","Sede","Resultado","Min","Gol","Asist.","Amar.","Rojas","CS","Val."],help:["Temporada y jornada oficial; fecha de calendario no registrada","Competición disputada","Club del jugador en ese partido","Club rival","Local, visitante o neutral","Marcador desde la perspectiva del jugador","Minutos jugados","Goles","Asistencias","Tarjetas amarillas","Tarjetas rojas","Porterías a cero","Valoración"],
 season:'Temporada',day:'Jornada',allSeasons:'Todas las temporadas',allCompetitions:'Todas las competiciones',
 loading:'Cargando apariciones verificadas…',empty:'No hay apariciones oficiales registradas.',filteredEmpty:"No hay partidos con estos filtros.",
 unavailable:'Datos oficiales de partidos no disponibles.',error:'No se pudieron cargar los partidos.',
 more:'Cargar más',details:'Detalles del partido',starter:'Titular',sub:'Suplente utilizado',
 positions:'Posiciones jugadas',venue:['Local','Visitante','Neutral'],resolution:'Resolución',penalties:'Penaltis',
 noRecord:'No registrado'},
 fr:{headers:["Date","Compétition","Club","Adversaire","Lieu","Résultat","Min","Bts","PdD","Jaunes","Rouges","CS","Not."],help:["Saison et journée officielle ; date calendaire non enregistrée","Compétition disputée","Club du joueur lors du match","Club adverse","Domicile, extérieur ou terrain neutre","Score final du point de vue du joueur","Minutes jouées","Buts marqués","Passes décisives","Cartons jaunes","Cartons rouges","Matches sans but encaissé","Note"],
 season:'Saison',day:'Journée',allSeasons:'Toutes les saisons',allCompetitions:'Toutes les compétitions',
 loading:'Chargement des apparitions vérifiées…',empty:'Aucune apparition officielle enregistrée.',filteredEmpty:"Aucun match pour ces filtres.",
 unavailable:'Données officielles indisponibles.',error:'Impossible de charger les matchs.',
 more:'Charger plus',details:'Détails du match',starter:'Titulaire',sub:'Remplaçant entré',
 positions:'Postes joués',venue:['Domicile','Extérieur','Neutre'],resolution:'Résolution',penalties:'Tirs au but',
 noRecord:'Non enregistré'}
};
// Identical 24px venue glyphs to Club Fixtures (home / away / neutral).
const venueIcons={
 home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',
 away:'<path d="M12 2c-1 0-1.5 1-1.5 3v4L3 13v2l7.5-2v5L8 20v2l4-1 4 1v-2l-2.5-2v-5L21 15v-2l-7.5-4V5C13.5 3 13 2 12 2Z"/>',
 neutral:'<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>'
};
const resultLabels={en:['Full time','Extra time','Penalties'],it:['Tempi regolamentari','Tempi supplementari','Rigori'],de:['Reguläre Spielzeit','Verlängerung','Elfmeterschießen'],es:['Tiempo reglamentario','Prórroga','Penaltis'],fr:['Temps réglementaire','Prolongation','Tirs au but']};
const tableTitles={en:'Official player matches',it:'Partite ufficiali del giocatore',de:'Offizielle Spiele des Spielers',es:'Partidos oficiales del jugador',fr:'Matchs officiels du joueur'};
const clubId=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const compId=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const numericId=id=>typeof id==='string'&&/^[1-9][0-9]*$/.test(id)&&Number.isSafeInteger(Number(id));
const el=(tag,text='',className='')=>{
 const node=document.createElement(tag);if(className)node.className=className;
 if(text!==null)node.textContent=String(text);return node;
};
const printable=n=>Number.isFinite(n)?String(n):'—';
/* Shared 24px text line for verified data and first-paint skeleton bars. */
const textTrack=child=>{
 const track=el('span','','app-player-matches-value');
 if(typeof child==='string')track.textContent=child;
 else track.append(child);
 return track;
};
/** Filter only the fully downloaded, verified appearances; preserve server chronology. */
export const filterPlayerMatches=(items,season='all',competition='all')=>
 items.filter(item=>(season==='all'||item.season===season)&&
  (competition==='all'||item.competitionId===competition));

export function createPlayerMatchesView({host,id,locale,fetchMatches,clubName,clubCrest,competitionName}){
 if(!host||!Number.isSafeInteger(id)||id<1)throw TypeError('Invalid Player Matches view');
 const tbody=host.querySelector('[data-player-matches-rows]');
 const seasonControl=host.querySelector('[data-player-matches-season-control]');
 const competitionControl=host.querySelector('[data-player-matches-competition-control]');
 const note=host.querySelector('[data-player-matches-note]');
 const more=host.querySelector('[data-player-matches-more]');
 const loadingMarkup=tbody.innerHTML;
 let status='loading',reading=null,items=[],available=null,revision=null,season='all',competition='all',visibleCount=20,ticket=0;
 let tooltip=null,activeHeader=null,closeTimer=null;
 const words=()=>copy[locale()]||copy.en;
 function tooltipNode(){
  if(tooltip)return tooltip;
  tooltip=document.createElement('div');tooltip.id='app-player-matches-header-tooltip';
  tooltip.className='app-players-nationality-tooltip app-player-stats-tooltip';
  tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  return tooltip;
 }
 function hideTooltip(){
  if(activeHeader)activeHeader.removeAttribute('aria-describedby');
  activeHeader=null;
  if(!tooltip||tooltip.hidden)return;
  window.clearTimeout(closeTimer);tooltip.classList.add('is-closing');
  closeTimer=window.setTimeout(()=>{
   if(!activeHeader&&tooltip){tooltip.hidden=true;tooltip.classList.remove('is-closing');}
   closeTimer=null;
  },130);
 }
 function showTooltip(trigger){
  if(!trigger||!host.contains(trigger))return;
  const index=Number(trigger.dataset.playerMatchesHelp),w=words();
  if(!Number.isSafeInteger(index)||index<6||index>=w.headers.length)return;
  if(activeHeader&&activeHeader!==trigger)activeHeader.removeAttribute('aria-describedby');
  activeHeader=trigger;const tip=tooltipNode();
  window.clearTimeout(closeTimer);closeTimer=null;tip.classList.remove('is-closing');
  tip.textContent=w.help[index];tip.hidden=false;
  trigger.setAttribute('aria-describedby',tip.id);
  const rect=trigger.getBoundingClientRect(),width=tip.offsetWidth||200,height=tip.offsetHeight||40;
  const left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2));
  const top=rect.top-height-8>=8?rect.top-height-8:Math.min(rect.bottom+8,window.innerHeight-height-8);
  tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(Math.max(8,top))+'px';
 }
 function renderHeaders(){
  const w=words(),mobile=window.matchMedia?.('(max-width:620px)').matches;
  host.querySelectorAll('[data-player-matches-heading]').forEach((header,index)=>{
   // Match identity, venue and result stay plain headers exactly as in Stats.
   if(index<=5){
    if(header.querySelector('[data-player-matches-help]'))header.replaceChildren();
    header.textContent=w.headers[index]||'';
    return;
   }
   let button=header.querySelector('[data-player-matches-help]');
   if(!button){button=el('button','','app-player-stats-header-trigger');button.type='button';
    button.dataset.playerMatchesHelp=String(index);header.replaceChildren(button);}
   button.textContent=w.headers[index]||'';
   button.setAttribute('aria-label',w.headers[index]||'');
   button.tabIndex=mobile?-1:0;
  });
  if(activeHeader&&!tooltip?.hidden)showTooltip(activeHeader);
 }
 function crest(key){
  const mark=el('span','','app-players-club-mark app-player-matches-crest');
  mark.setAttribute('aria-hidden','true');
  const match=clubId.exec(key||''),asset=clubCrest?.(key);
  if(match&&asset==='assets/clubs/'+match[1]+'/'+Number(match[2])+'/crest.svg'){
   const img=el('img','','app-players-club-crest');img.src='/'+asset;img.alt='';
   img.width=24;img.height=24;img.decoding='async';img.loading='lazy';
   img.addEventListener('error',()=>img.remove(),{once:true});
   mark.append(img);
  }
  return mark;
 }
 function clubCell(key){
  const cell=el('span','','app-player-matches-club');
  cell.append(crest(key));
  const match=clubId.exec(key||'');
  if(match){
   const link=el('a',clubName?.(key)||key,'app-player-matches-link');
   link.href='/clubs/'+match[1].toLowerCase()+'/'+Number(match[2])+'/overview';
   cell.append(textTrack(link));
  }else cell.append(textTrack(key||'—'));
  return cell;
 }
 const fmt=(value,metric)=>value===null||value===undefined?'—':
  metric==='rating'?(typeof value==='number'&&Number.isFinite(value)?value.toFixed(1):'—'):printable(value);
 function resultText(item){
  const score=item.result;
  if(!Number.isSafeInteger(score?.homeGoals)||!Number.isSafeInteger(score?.awayGoals))return '—';
  return item.side==='away'?score.awayGoals+'–'+score.homeGoals:score.homeGoals+'–'+score.awayGoals;
 }
 function populate(control,values,selected,allText,labelFn,label){
  const trigger=control.querySelector('.language-trigger');
  const menu=control.querySelector('[role="listbox"]');
  const options=[['all',allText],...values.map(value=>[String(value),labelFn(value)])];
  const selectedValue=options.some(option=>option[0]===String(selected))?String(selected):'all';
  trigger.querySelector('[data-player-matches-value]').textContent=
   options.find(option=>option[0]===selectedValue)[1];
  trigger.setAttribute('aria-label',label);
  trigger.disabled=status!=='ready'||options.length===1;
  menu.setAttribute('aria-label',label);
  menu.replaceChildren(...options.map(([value,text],i)=>{
   const option=el('div',text,'language-option');
   option.id=menu.id+'-option-'+i;
   option.dataset.menuValue=value;
   option.setAttribute('role','option');
   option.setAttribute('aria-selected',String(value===selectedValue));
   option.tabIndex=-1;
   return option;
  }));
 }
 function bindMenu(control,key){
  const trigger=control.querySelector('.language-trigger'),menu=control.querySelector('[role="listbox"]');
  const options=()=>[...menu.querySelectorAll('[role="option"]')];
  const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
  const open=(last=false)=>{
   if(trigger.disabled)return;
   for(const other of [seasonControl,competitionControl]){
    if(other!==control){other.querySelector('[role="listbox"]').hidden=true;
     other.querySelector('.language-trigger').setAttribute('aria-expanded','false');}
   }
   menu.hidden=false;trigger.setAttribute('aria-expanded','true');
   const entries=options(),selected=entries.findIndex(option=>option.getAttribute('aria-selected')==='true');
   entries[last?entries.length-1:Math.max(0,selected)]?.focus();
  };
  const choose=value=>{
   if(key==='season')season=value==='all'?'all':Number(value);
   else competition=value;
   close();trigger.focus({preventScroll:true});
   visibleCount=20;render();
  };
  trigger.addEventListener('click',()=>{if(menu.hidden)open();else close();});
  trigger.addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();open(event.key==='ArrowUp');
   }else if(event.key==='Escape')close();
  });
  menu.addEventListener('click',event=>{
   const option=event.target.closest?.('[data-menu-value]');
   if(option&&menu.contains(option))choose(option.dataset.menuValue);
  });
  menu.addEventListener('keydown',event=>{
   const entries=options(),current=entries.indexOf(document.activeElement);
   if(event.key==='Escape'){event.preventDefault();close();trigger.focus();return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
    event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?entries.length-1:
     (current+(event.key==='ArrowDown'?1:-1)+entries.length)%entries.length;
    entries[index]?.focus();
   }else if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    if(current>=0)choose(entries[current].dataset.menuValue);
   }else if(event.key==='Tab')close();
  });
  document.addEventListener('pointerdown',event=>{if(!control.contains(event.target))close();});
 }

 function rowFor(item){
  const w=words(),tr=el('tr','','app-player-matches-row');tr.dataset.playerMatchId=item.matchId;
  tr.dataset.playerMatchHref='/matches/'+item.matchId;
  tr.tabIndex=0;
  tr.setAttribute('aria-label',w.season+' '+item.season+', '+w.day+' '+item.day);
  const first=el('th','','app-player-matches-match');first.scope='row';
  const link=el('a',w.season+' '+item.season+' · '+w.day+' '+item.day,'app-player-matches-link app-player-matches-match-link');
  link.href='/matches/'+item.matchId;
  first.append(textTrack(link));tr.append(first);
  const competitionCell=el('td','','app-player-matches-competition');
  if(compId.test(item.competitionId)){
   const a=el('a',competitionName?.(item.competitionId)||item.competitionId,'app-player-matches-link');
   a.href='/competitions/'+item.competitionId.toLowerCase()+'/fixtures?season='+item.season;
   competitionCell.append(textTrack(a));
  }else competitionCell.append(textTrack('—'));
  tr.append(competitionCell);
  for(const key of ['clubId','opponentId']){
   const td=el('td','','app-player-matches-identity');td.append(clubCell(item[key]));tr.append(td);
  }
  const venue=el('td','','app-player-matches-number app-player-matches-venue');
  const venueLabel=w.venue[item.venue==='neutral'?2:item.venue==='away'?1:0];
  const icon=el('span','','app-player-matches-venue-icon');
  icon.setAttribute('role','img');icon.setAttribute('aria-label',venueLabel);icon.title=venueLabel;
  icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+venueIcons[item.venue]+'</svg>';
  venue.append(textTrack(icon));tr.append(venue);
  const result=el('td','','app-player-matches-number app-player-matches-result');
  result.append(textTrack(resultText(item)));tr.append(result);
  const p=item.performance||{};
  for(const metric of ['minutes','goals','assists','yellowCards','redCards','cleanSheets','rating']){
   const cell=el('td','','app-player-matches-number');
   cell.dataset.metric=metric;
   cell.append(textTrack(fmt(p[metric],metric)));
   tr.append(cell);
  }
  return tr;
 }
 function render(){
  const w=words();
  host.querySelector('.app-player-matches-table').setAttribute('aria-label',tableTitles[locale()]||tableTitles.en);
  renderHeaders();
  const seasonValues=available?.seasons||[],competitionValues=available?.competitions||[];
  populate(competitionControl,competitionValues,competition,w.allCompetitions,key=>competitionName?.(key)||key,w.headers[1]);
  populate(seasonControl,seasonValues,season,w.allSeasons,n=>w.season+' '+n,w.season);
  host.setAttribute('aria-busy',String(status==='loading'));
  note.hidden=true;more.hidden=true;
  if(status==='loading'&&items.length===0){
   if(tbody.querySelector('[data-player-matches-loading]')===null)tbody.innerHTML=loadingMarkup;
   note.textContent=w.loading;return;
  }
  const filtered=filterPlayerMatches(items,season,competition);
  if(status==='error'||status==='unavailable'||filtered.length===0){
   const message=status==='error'?w.error:status==='unavailable'?w.unavailable:
    items.length===0?w.empty:w.filteredEmpty;
   tbody.replaceChildren();
   const tr=el('tr','','app-player-matches-empty'),td=el('td',message);td.colSpan=13;
   tr.append(td);tbody.append(tr);note.textContent=message;return;
  }
  const focusedRow=host.contains(document.activeElement)?
   document.activeElement.closest?.('[data-player-match-id]')?.dataset.playerMatchId:null;
  const rows=filtered.slice(0,visibleCount).map(rowFor);tbody.replaceChildren(...rows);
  if(focusedRow)tbody.querySelector('[data-player-match-id="'+focusedRow+'"]')?.focus({preventScroll:true});
  more.hidden=filtered.length<=visibleCount;more.textContent=w.more;
 }
 async function load(){
  if(reading)return reading;
  if(['ready','error','unavailable'].includes(status))return;
  status='loading';render();
  const current=++ticket;
  reading=(async()=>{
   let cursor=null,total=null,world=null,filters=null,sourceStatus=null;
   const gathered=[],seen=new Set(),seenCursors=new Set();
   do{
    // Acquire the complete verified set once. Filtering and "Load more" are local.
    const payload=await fetchMatches(id,{season:'all',competition:'all',limit:50,cursor});
    if(current!==ticket)return;
    if(!payload||payload.providerId!=='authoritative-world'||payload.playerId!==id||
       !['available','empty','unavailable'].includes(payload.status)||
       !Array.isArray(payload.items)||!payload.world||!payload.filters||
       !Array.isArray(payload.filters.seasons)||!Array.isArray(payload.filters.competitions)||
       !Number.isSafeInteger(payload.total)||payload.total<0||
       !(payload.nextCursor===null||typeof payload.nextCursor==='string'))
     throw TypeError('Invalid match response');
    if(!world){world=payload.world;filters=payload.filters;total=payload.total;sourceStatus=payload.status;}
    else if(world.generation!==payload.world.generation||world.revision!==payload.world.revision||
       total!==payload.total||sourceStatus!==payload.status||
       JSON.stringify(filters)!==JSON.stringify(payload.filters))
     throw TypeError('Inconsistent player matches pagination');
    if(payload.status==='unavailable'){
     if(payload.items.length||payload.nextCursor||payload.total)throw TypeError('Invalid unavailable state');
     break;
    }
    for(const item of payload.items){
     if(!numericId(item?.matchId)||seen.has(item.matchId)||
        !Number.isSafeInteger(item.day)||!['home','away'].includes(item.side)||
        !['home','away','neutral'].includes(item.venue)||
        !clubId.test(item.clubId)||!clubId.test(item.opponentId))
      throw TypeError('Invalid match item');
     seen.add(item.matchId);gathered.push(item);
    }
    cursor=payload.nextCursor;
    if(cursor){
     if(seenCursors.has(cursor)||gathered.length>=total||payload.items.length===0)
      throw TypeError('Invalid match cursor progression');
     seenCursors.add(cursor);
    }
   }while(cursor);
   if(current!==ticket)return;
   if(sourceStatus!=='unavailable'&&gathered.length!==total)
    throw TypeError('Incomplete player match set');
   items=gathered;available=filters;revision=world;
   status=sourceStatus==='unavailable'?'unavailable':'ready';
  })().catch(()=>{if(current===ticket)status='error';}).finally(()=>{
   if(current===ticket){reading=null;render();}
  });
  return reading;
 }
 bindMenu(competitionControl,'competition');
 bindMenu(seasonControl,'season');
 more.addEventListener('click',()=>{if(status==='ready'){visibleCount+=20;render();}});
 host.addEventListener('click',event=>{
  const tip=event.target.closest?.('[data-player-matches-help]');if(tip){showTooltip(tip);return;}
  if(event.defaultPrevented||event.target.closest?.('a,button,[role="option"]'))return;
  const row=event.target.closest?.('.app-player-matches-row[data-player-match-href]');
  if(row&&tbody.contains(row))window.location.assign(row.dataset.playerMatchHref);
 });
 host.addEventListener('keydown',event=>{
  const row=event.target;
  if(row.matches?.('.app-player-matches-row[data-player-match-href]')&&
     (event.key==='Enter'||event.key===' ')){
   event.preventDefault();window.location.assign(row.dataset.playerMatchHref);
  }
 });
 host.addEventListener('pointerover',event=>{
  const trigger=event.target.closest?.('[data-player-matches-help]');
  if(trigger&&event.pointerType!=='touch')showTooltip(trigger);
 });
 host.addEventListener('pointerout',event=>{
  if(activeHeader&&(event.target===activeHeader||activeHeader.contains(event.target))&&
     !activeHeader.contains(event.relatedTarget))hideTooltip();
 });
 host.addEventListener('focusin',event=>{
  const trigger=event.target.closest?.('[data-player-matches-help]');if(trigger)showTooltip(trigger);
 });
 host.addEventListener('focusout',event=>{if(event.target===activeHeader)hideTooltip();});
 host.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
 document.addEventListener('scroll',hideTooltip,true);
 window.addEventListener('resize',()=>{hideTooltip();renderHeaders();});
 return {render,load};
}
