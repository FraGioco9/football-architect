/** #578: multi-season Player Stats from a single verified public read. */
export const statsWords={
 en:{headers:["Season","Competition","Club","Apps (Subs)","Min","Gls","Ast","YC","RC","Rat."],keeper:'CS',career:'Career',incomplete:'Incomplete coverage',total:'Total',season:'Season',empty:'No games played',unavailable:'Player statistics are unavailable.',unsupported:'Official statistics unavailable',unprepared:'Season not prepared',show:'Show competitions for',rated:'rated matches',missing:'Not recorded',help:[null,null,null,"Appearances (Substitute appearances)","Minutes played","Goals","Assists","Yellow cards","Red cards","Rating"],keeperHelp:"Clean sheets"},
 it:{headers:["Stagione","Competizione","Club","Pres. (Sub.)","Min","Gol","Assist","Gialli","Rossi","Val."],keeper:'CS',career:'Carriera',incomplete:'Copertura incompleta',total:'Totale',season:'Stagione',empty:'Nessuna partita giocata',unavailable:'Statistiche del giocatore non disponibili.',unsupported:'Statistiche ufficiali non disponibili',unprepared:'Stagione non preparata',show:'Mostra competizioni della',rated:'partite valutate',missing:'Non registrato',help:[null,null,null,"Presenze (da subentrato)","Minuti giocati","Gol segnati","Assist","Cartellini gialli","Cartellini rossi","Valutazione"],keeperHelp:"Clean sheet"},
 de:{headers:["Saison","Wettbewerb","Verein","Sp. (Einw.)","Min","Tor.","Vor.","Gelb","Rot","Bew."],keeper:'CS',career:'Karriere',incomplete:'Unvollständige Daten',total:'Gesamt',season:'Saison',empty:'Noch keine Spiele gespielt',unavailable:'Spielerstatistiken sind nicht verfügbar.',unsupported:'Offizielle Statistiken nicht verfügbar',unprepared:'Saison nicht vorbereitet',show:'Wettbewerbe anzeigen für',rated:'bewertete Spiele',missing:'Nicht erfasst',help:[null,null,null,"Spiele (Einwechslungen)","Gespielte Minuten","Tore","Vorlagen","Gelbe Karten","Rote Karten","Bewertung"],keeperHelp:"Spiele ohne Gegentor"},
 es:{headers:["Temporada","Competición","Club","PJ (Sup.)","Min","Gol","Asist.","Amar.","Rojas","Val."],keeper:'CS',career:'Carrera',incomplete:'Datos incompletos',total:'Total',season:'Temporada',empty:'Ningún partido disputado',unavailable:'Estadísticas del jugador no disponibles.',unsupported:'Estadísticas oficiales no disponibles',unprepared:'Temporada no preparada',show:'Mostrar competiciones de',rated:'partidos valorados',missing:'No registrado',help:[null,null,null,"Partidos jugados (Entradas como suplente)","Minutos jugados","Goles","Asistencias","Tarjetas amarillas","Tarjetas rojas","Valoración"],keeperHelp:"Porterías a cero"},
 fr:{headers:["Saison","Compétition","Club","MJ (Entr.)","Min","Bts","PdD","Jaunes","Rouges","Not."],keeper:'CS',career:'Carrière',incomplete:'Données incomplètes',total:'Total',season:'Saison',empty:'Aucun match joué',unavailable:'Statistiques du joueur indisponibles.',unsupported:'Statistiques officielles indisponibles',unprepared:'Saison non préparée',show:'Afficher les compétitions de',rated:'matches évalués',missing:'Non enregistré',help:[null,null,null,"Matches joués (Entrées en jeu)","Minutes jouées","Buts","Passes décisives","Cartons jaunes","Cartons rouges","Note"],keeperHelp:"Matches sans but encaissé"}
};
export const formatApps=(appearances,subs)=>Number.isSafeInteger(appearances)&&appearances>=0
 ?appearances+' ('+(Number.isSafeInteger(subs)&&subs>=0?subs:'—')+')':'—';
export const formatRating=(average,rated)=>typeof average==='number'&&Number.isFinite(average)&&
 Number.isSafeInteger(rated)&&rated>0?average.toFixed(2):'—';
/** Compute career values only from verified season totals already delivered by the
 * authoritative Stats read. Never use present club, future matches, partial
 * aggregates with missing seasons, or a naive average of per-season ratings. */
export function aggregateVerifiedCareerStats(seasons){
 if(!Array.isArray(seasons)||!seasons.length)return null;
 const totals={appearances:0,starts:0,subAppearances:0,minutes:0,goals:0,assists:0,
  yellowCards:0,redCards:0,gkAppearances:0,cleanSheets:0,
  ratedAppearances:0,averageRating:null};
 const keys=['appearances','starts','minutes','goals','gkAppearances','ratedAppearances'];
 const optional=['subAppearances','assists','yellowCards','redCards'];
 let ratedSum=0,ratingComplete=true,keepersComplete=true;
 const checked=new Set();
 for(const season of seasons){
  if(!Number.isSafeInteger(season?.season)||season.season<1||checked.has(season.season)||
   !['partial','available'].includes(season.status)||!season.data?.total||
   !Array.isArray(season.data.competitions))return null;
  checked.add(season.season);
  const row=season.data.total;
  if(keys.some(key=>!Number.isSafeInteger(row[key])||row[key]<0)||
   row.starts>row.appearances||row.ratedAppearances>row.appearances||
   row.gkAppearances>row.appearances)return null;
  for(const key of keys)totals[key]+=row[key];
  for(const key of optional){
   if(row[key]===null){totals[key]=null;continue;}
   if(!Number.isSafeInteger(row[key])||row[key]<0)return null;
   if(totals[key]!==null)totals[key]+=row[key];
  }
  if(row.gkAppearances>0){
   if(row.cleanSheets===null)keepersComplete=false;
   else if(!Number.isSafeInteger(row.cleanSheets)||row.cleanSheets<0||
    row.cleanSheets>row.gkAppearances)return null;
   else totals.cleanSheets+=row.cleanSheets;
  }
  if(row.ratedAppearances>0){
   if(typeof row.averageRating!=='number'||!Number.isFinite(row.averageRating))
    ratingComplete=false;
   else ratedSum+=row.averageRating*row.ratedAppearances;
  }
 }
 if(!Number.isSafeInteger(totals.appearances)||totals.appearances<totals.starts||
  !Number.isSafeInteger(totals.minutes))return null;
 totals.cleanSheets=totals.gkAppearances>0&&keepersComplete?totals.cleanSheets:null;
 totals.averageRating=ratingComplete&&totals.ratedAppearances>0
  ?Math.round(ratedSum/totals.ratedAppearances*100)/100:null;
 return totals;
}
const competitionPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const clubPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
export function createPlayerStatsView({host,id,locale,position,fetchStats,clubName,competitionName}){
 if(!host||!Number.isSafeInteger(id)||id<1)throw TypeError('Invalid player Stats view');
 const tbody=host.querySelector('[data-detail-stats-rows]');
 const headers=[...host.querySelectorAll('[data-detail-stats-heading]')];
 const note=host.querySelector('[data-detail-stats-note]');
 const expanded=new Set();
 let status='loading',payload=null,reading=null,activeHeader=null,tooltip=null,closeTimer=null;
 const words=()=>statsWords[locale()]||statsWords.en;
 const el=(tag,txt='',cls='')=>{
  const node=document.createElement(tag);node.textContent=txt===null?'':String(txt);
  if(cls)node.className=cls;
  return node;
 };
 const value=n=>Number.isSafeInteger(n)&&n>=0?String(n):'—';
 const isKeeper=()=>position()==='GK';
 const mobileLabels=()=>{
  const w=words(),labels=[...w.headers];if(isKeeper())labels[5]=w.keeper;
  return labels;
 };
 function tooltipNode(){
  if(tooltip)return tooltip;
  tooltip=document.createElement('div');
  tooltip.id='app-player-stats-header-tooltip';
  // Identical portal styling and in/out keyframes as Players' nationality tooltip.
  tooltip.className='app-players-nationality-tooltip app-player-stats-tooltip';
  tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
  document.body.append(tooltip);return tooltip;
 }
 function hideTooltip(){
  if(activeHeader)activeHeader.removeAttribute('aria-describedby');
  activeHeader=null;
  if(!tooltip||tooltip.hidden)return;
  window.clearTimeout(closeTimer);
  tooltip.classList.add('is-closing');
  closeTimer=window.setTimeout(()=>{
   if(!activeHeader&&tooltip){tooltip.hidden=true;tooltip.classList.remove('is-closing');}
   closeTimer=null;
  },130);
 }
 function positionTooltip(){
  if(!activeHeader||!tooltip||tooltip.hidden)return;
  const rect=activeHeader.getBoundingClientRect(),w=tooltip.offsetWidth||200,h=tooltip.offsetHeight||40;
  const left=Math.max(8,Math.min(window.innerWidth-w-8,rect.left+rect.width/2-w/2));
  const above=rect.top-h-8,below=rect.bottom+8;
  const y=above>=8?above:Math.max(8,Math.min(below,window.innerHeight-h-8));
  tooltip.style.left=Math.round(left)+'px';tooltip.style.top=Math.round(y)+'px';
 }
 function showTooltip(trigger){
  if(!trigger||!host.contains(trigger))return;
  const index=Number(trigger.dataset.statsHelp);
  if(!Number.isSafeInteger(index)||index<3||index>=10)return;
  if(activeHeader&&activeHeader!==trigger)activeHeader.removeAttribute('aria-describedby');
  activeHeader=trigger;
  const tip=tooltipNode(),w=words();
  window.clearTimeout(closeTimer);closeTimer=null;tip.classList.remove('is-closing');
  tip.textContent=isKeeper()&&index===5?w.keeperHelp:w.help[index];
  tip.hidden=false;trigger.setAttribute('aria-describedby',tip.id);positionTooltip();
 }
 function headerControls(){
  const labels=mobileLabels();
  for(const [index,header] of headers.entries()){
   // Club History's identity headers are plain text, never tooltip triggers.
   if(index<3){
    if(header.querySelector('[data-stats-help]'))header.replaceChildren();
    header.textContent=labels[index]||'';
    continue;
   }
   let button=header.querySelector('[data-stats-help]');
   if(!button){
    button=el('button','','app-player-stats-header-trigger');
    button.type='button';button.dataset.statsHelp=String(index);
    header.replaceChildren(button);
   }
   button.textContent=labels[index]||'';
   button.setAttribute('aria-label',labels[index]||'');
   // The mobile History-style grid hides thead; invisible controls must
   // not remain keyboard tab stops. Screen readers get labelled data cells.
   button.tabIndex=window.matchMedia?.('(max-width:620px)').matches?-1:0;
  }
  if(activeHeader&&!tooltip?.hidden)showTooltip(activeHeader);
  for(const cell of tbody.querySelectorAll('.app-player-stats-loading [data-metric]')){
   const index=['apps','minutes','score','assists','yellow','red','rating'].indexOf(cell.dataset.metric);
   if(index>=0)cell.dataset.mobileLabel=labels[index+3];
  }
 }
 function numericCells(record,w){
  const labels=mobileLabels(),displayed=[
   formatApps(record.appearances,record.subAppearances),value(record.minutes),
   isKeeper()?value(record.cleanSheets):value(record.goals),
   value(record.assists),value(record.yellowCards),value(record.redCards),
   formatRating(record.averageRating,record.ratedAppearances)
  ];
  return displayed.map((v,i)=>{
   const cell=el('td','','app-player-stats-number');
   cell.append(el('span',v,'app-player-stats-value'));
   cell.dataset.metric=['apps','minutes','score','assists','yellow','red','rating'][i];
   cell.dataset.mobileLabel=labels[i+3];
   cell.setAttribute('aria-label',labels[i+3]+': '+v);
   if(v==='—'||v.includes('(—)'))cell.title=w.missing;
   if(i===6&&v!=='—')cell.title=record.ratedAppearances+'/'+record.appearances+' '+w.rated;
   return cell;
  });
 }
 const row=()=>document.createElement('tr');
 function syncDisclosures(){
  for(const button of tbody.querySelectorAll('[data-stats-toggle]'))
   button.setAttribute('aria-expanded',String(expanded.has(Number(button.dataset.statsToggle))));
  for(const detail of tbody.querySelectorAll('[data-player-stats-detail]'))
   detail.hidden=!expanded.has(Number(detail.dataset.playerStatsDetail));
 }
 function tableRoles(){
  // Same native table/rowgroup/header semantics as Club History on mobile.
  const table=host.querySelector('.app-player-stats-table');
  if(!table)return;
  table.setAttribute('role','table');
  table.tHead?.setAttribute('role','rowgroup');
  for(const body of table.tBodies)body.setAttribute('role','rowgroup');
  for(const r of table.rows)r.setAttribute('role','row');
  for(const th of table.querySelectorAll('thead th'))th.setAttribute('role','columnheader');
  for(const th of table.querySelectorAll('tbody th'))th.setAttribute('role','rowheader');
  for(const td of table.querySelectorAll('tbody td'))td.setAttribute('role','cell');
 }
 function render(){
  headerControls();
  const w=words();
  host.setAttribute('aria-busy',String(status==='loading'));
  if(status==='loading')return; // Preserve the exact parser-time History-style skeleton row.
  if(status==='error'||!payload||payload.status==='unavailable'){
   hideTooltip();tbody.replaceChildren();note.textContent=status==='error'?w.unavailable:w.unsupported;note.hidden=false;return;
  }
  if(payload.status==='empty'||!payload.seasons.length){
   hideTooltip();tbody.replaceChildren();note.textContent=w.empty;note.hidden=false;return;
  }
  note.textContent='';note.hidden=true;
  const focused=host.contains(document.activeElement)?document.activeElement?.dataset?.statsToggle:null;
  const resultRows=[];
  for(const season of payload.seasons){
   if(!Number.isSafeInteger(season.season)||season.season<1)continue;
   const label=w.season+' '+season.season;
   const available=(season.status==='available'||season.status==='partial')&&
    season.data?.total&&Array.isArray(season.data.competitions);
   const groups=available?season.data.competitions:[],expandable=groups.length>0;
   const summary=row();summary.className='app-player-stats-season-row';
   summary.dataset.playerStatsSeason=String(season.season);
   summary.dataset.playerStatsSummary=String(season.season);
   const heading=el('th','','app-player-stats-season');heading.scope='row';
   if(expandable){
    const button=el('button','','app-player-stats-toggle');button.type='button';
    button.dataset.statsToggle=String(season.season);
    button.setAttribute('aria-expanded',String(expanded.has(season.season)));
    button.setAttribute('aria-label',w.show+' '+label);
    const chevron=el('span','','app-player-stats-chevron');chevron.setAttribute('aria-hidden','true');
    button.append(chevron,el('span',label));
    heading.append(button);
   }else{
    const placeholder=el('span','','app-player-stats-chevron-space');
    placeholder.setAttribute('aria-hidden','true');
    const value=el('span',label,'app-player-stats-no-toggle');
    const content=el('span','','app-player-stats-static-label');
    content.append(placeholder,value);heading.append(content);
   }
   const hasTotal=available&&season.data.total.appearances>0;
   const totalCell=el('td','',
    hasTotal?'app-player-stats-competition app-player-stats-total-label':'app-player-stats-competition');
   totalCell.append(el('span',available?(hasTotal?w.total:w.empty):
    season.status==='unavailable'?w.unsupported:w.unprepared,'app-player-stats-total-value'));
   summary.append(heading,totalCell,el('td','','app-player-stats-club'));
   if(available)summary.append(...numericCells(season.data.total,w));
   else for(let i=0;i<7;i++)summary.append(el('td','','app-player-stats-number'));
   resultRows.push(summary);
   for(const record of groups){
    if(!competitionPattern.test(record.competitionId))continue;
    const match=clubPattern.exec(record.clubId);if(!match)continue;
    const detail=row();detail.className='app-player-stats-competition-row';
    detail.dataset.playerStatsDetail=String(season.season);
    detail.hidden=!expanded.has(season.season);
    detail.append(el('td','','app-player-stats-season'));
    const competition=el('th','','app-player-stats-competition');competition.scope='row';
    const link=el('a',competitionName?.(record.competitionId)||record.competitionId,'app-player-stats-link');
    link.href='/competitions/'+record.competitionId.toLowerCase()+'/standings?season='+season.season;
    competition.append(link);detail.append(competition);
    const club=el('td','','app-player-stats-club');
    const clubLink=el('a',clubName?.(record.clubId)||record.clubId,'app-player-stats-link');
    clubLink.href='/clubs/'+match[1].toLowerCase()+'/'+Number(match[2])+'/overview';
    club.append(clubLink);detail.append(club,...numericCells(record,w));resultRows.push(detail);
   }
  }
  // Career is shown first and includes the still-active official season.
  // A missing official season suppresses potentially misleading sums.
  const career=aggregateVerifiedCareerStats(payload.seasons);
  const careerRow=row();
  careerRow.className='app-player-stats-season-row app-player-stats-career-row';
  careerRow.dataset.playerStatsCareer='true';
  const heading=el('th','','app-player-stats-season');
  heading.scope='row';
  const wrapper=el('span','','app-player-stats-static-label');
  const spacer=el('span','','app-player-stats-chevron-space');
  spacer.setAttribute('aria-hidden','true');
  wrapper.append(spacer,el('span',w.career,'app-player-stats-no-toggle'));
  heading.append(wrapper);
  const careerLabel=el('td','','app-player-stats-competition app-player-stats-total-label');
  careerLabel.append(el('span',career?w.total:w.incomplete,'app-player-stats-total-value'));
  careerRow.append(heading,careerLabel,el('td','','app-player-stats-club'));
  if(career)careerRow.append(...numericCells(career,w));
  else {
   const missing={appearances:null,subAppearances:null,minutes:null,goals:null,
    cleanSheets:null,assists:null,yellowCards:null,redCards:null,
    averageRating:null,ratedAppearances:0};
   careerRow.append(...numericCells(missing,w));
  }
  resultRows.unshift(careerRow);
  tbody.replaceChildren(...resultRows);
  tableRoles();syncDisclosures();
  if(focused!==null&&focused!==undefined)
   tbody.querySelector('[data-stats-toggle="'+focused+'"]')?.focus({preventScroll:true});
 }
 host.addEventListener('click',event=>{
  const header=event.target.closest?.('[data-stats-help]');
  if(header){showTooltip(header);return;}
  if(event.target.closest?.('a,input,select,textarea'))return;
  const summary=event.target.closest?.('[data-player-stats-summary]');
  const button=summary?.querySelector('[data-stats-toggle]');
  if(!button||!host.contains(summary))return;
  const season=Number(button.dataset.statsToggle);
  if(expanded.has(season))expanded.delete(season);else expanded.add(season);
  // Keep the exact same arrow/button in the DOM. Rerendering would prevent
  // the 120 ms chevron transition used by Club History from animating.
  syncDisclosures();
 });
 host.addEventListener('pointerover',event=>{
  const trigger=event.target.closest?.('[data-stats-help]');
  if(trigger&&event.pointerType!=='touch')showTooltip(trigger);
 });
 host.addEventListener('pointerout',event=>{
  if(activeHeader&&(event.target===activeHeader||activeHeader.contains(event.target))&&
     !activeHeader.contains(event.relatedTarget))hideTooltip();
 });
 host.addEventListener('focusin',event=>{
  const trigger=event.target.closest?.('[data-stats-help]');if(trigger)showTooltip(trigger);
 });
 host.addEventListener('focusout',event=>{if(event.target===activeHeader)hideTooltip();});
 host.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
 document.addEventListener('scroll',hideTooltip,true);
 window.addEventListener('resize',()=>{hideTooltip();headerControls();});
 return {render,load(){
  if(status==='ready'||reading)return reading??Promise.resolve();
  render(); // Localize header + mobile skeleton labels while the read is pending.
  reading=Promise.resolve().then(()=>fetchStats(id)).then(value=>{
   if(!value||value.playerId!==id||!['available','empty','unavailable'].includes(value.status)||
      !Array.isArray(value.seasons))throw TypeError('Invalid player Stats contract');
   payload=value;status='ready';render();
  }).catch(()=>{status='error';render()}).finally(()=>{reading=null});
  return reading;
 }};
}
