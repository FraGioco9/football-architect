/** #579 — verified club-season playing record, never a fabricated transfer ledger. */
export const historyWords={
 en:{current:'Current club',free:'Free agent',title:'Recorded playing history',description:'Past clubs are verified only by official match appearances. Transfers, contract dates and complete seasonal affiliations are not recorded.',head:['Season','Club','Competitions','Apps'],season:'Season',pending:'Not yet recorded',none:'No recorded appearances',empty:'No official playing history recorded in this world.',unavailable:'Player history unavailable',unsupported:'Official history unavailable for this season'},
 it:{current:'Club attuale',free:'Svincolato',title:'Carriera documentata',description:'I club passati sono verificati solo dalle presenze ufficiali. Trasferimenti, date contrattuali e appartenenze stagionali non sono registrati.',head:['Stagione','Club','Competizioni','Pres.'],season:'Stagione',pending:'Non ancora registrata',none:'Nessuna presenza registrata',empty:'Nessuna carriera ufficiale registrata in questo mondo.',unavailable:'Carriera non disponibile',unsupported:'Storico ufficiale non disponibile per questa stagione'},
 de:{current:'Aktueller Verein',free:'Vereinslos',title:'Belegte Spielhistorie',description:'Frühere Vereine sind nur durch offizielle Spiele belegt. Transfers, Vertragsdaten und vollständige Saisonzugehörigkeiten werden nicht erfasst.',head:['Saison','Verein','Wettbewerbe','Sp.'],season:'Saison',pending:'Noch nicht erfasst',none:'Keine Einsätze erfasst',empty:'Keine offiziellen Einsätze in dieser Welt erfasst.',unavailable:'Spielhistorie nicht verfügbar',unsupported:'Offizielle Historie für diese Saison nicht verfügbar'},
 es:{current:'Club actual',free:'Agente libre',title:'Trayectoria registrada',description:'Los clubes anteriores solo se acreditan mediante partidos oficiales. No se registran traspasos, fechas de contrato ni temporadas completas de pertenencia.',head:['Temporada','Club','Competiciones','PJ'],season:'Temporada',pending:'Aún sin registrar',none:'Sin apariciones registradas',empty:'No hay trayectoria oficial registrada en este mundo.',unavailable:'Historial no disponible',unsupported:'Historial oficial no disponible esta temporada'},
 fr:{current:'Club actuel',free:'Sans club',title:'Parcours sportif attesté',description:'Les anciens clubs ne sont attestés que par les matchs officiels. Les transferts, dates de contrat et saisons complètes ne sont pas enregistrés.',head:['Saison','Club','Compétitions','MJ'],season:'Saison',pending:'Pas encore enregistré',none:'Aucune apparition enregistrée',empty:'Aucun parcours officiel enregistré dans ce monde.',unavailable:'Historique indisponible',unsupported:'Historique officiel indisponible pour cette saison'}
};
const clubPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const competitionPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function projectPlayerClubHistory(payload){
 if(!payload||!['available','empty','unavailable'].includes(payload.status)||!Array.isArray(payload.seasons))
  throw TypeError('Invalid player history source');
 if(payload.status==='empty')return {status:'empty',rows:[]};
 if(payload.status==='unavailable')return {status:'unavailable',rows:[]};
 const seen=new Set(),rows=[];
 for(const season of payload.seasons){
  if(!Number.isSafeInteger(season?.season)||season.season<1||seen.has(season.season))throw TypeError('Invalid history season');
  seen.add(season.season);
  if(season.status==='unavailable'){rows.push({season:season.season,kind:'unavailable'});continue;}
  if(season.status==='empty'){rows.push({season:season.season,kind:'pending'});continue;}
  // Published competition entrants are not official appearance evidence.
  if(season.status==='partial'&&season.data?.entrantsOnly===true&&
   season.provenance?.resultAuthority==='confirmed-entrants-v1'){
   rows.push({season:season.season,kind:'pending'});continue;
  }
  if(!['available','partial'].includes(season.status)||season.provenance?.kind!=='authoritative'||
   !String(season.provenance.sourceRef||'').startsWith('player-stats:')||
   !integer(season.data?.total?.appearances)||!Array.isArray(season.data?.competitions))
    throw TypeError('Unverified player history');
  const clubs=new Map(),recorded=new Set();let total=0;
  for(const item of season.data.competitions){
   if(!clubPattern.test(item?.clubId)||!competitionPattern.test(item?.competitionId)||!integer(item.appearances)||item.appearances===0)
    throw TypeError('Invalid verified club appearances');
   const key=item.clubId+'|'+item.competitionId;
   if(recorded.has(key))throw TypeError('Duplicate history competition');
   recorded.add(key);total+=item.appearances;
   const group=clubs.get(item.clubId)||{season:season.season,kind:'club',clubId:item.clubId,appearances:0,competitions:[]};
   group.appearances+=item.appearances;group.competitions.push(item.competitionId);clubs.set(item.clubId,group);
  }
  if(total!==season.data.total.appearances)throw TypeError('Incomplete verified player history');
  if(!clubs.size){rows.push({season:season.season,kind:'none'});continue;}
  rows.push(...[...clubs.values()].sort((a,b)=>a.clubId.localeCompare(b.clubId,'en'))
   .map(item=>({...item,competitions:item.competitions.sort((a,b)=>
    Number(a.startsWith('int-'))-Number(b.startsWith('int-'))||a.localeCompare(b,'en'))})));
 }
 return {status:'available',rows:rows.sort((a,b)=>b.season-a.season)};
}
const el=(tag,txt='',cls='')=>{const n=document.createElement(tag);n.textContent=txt;if(cls)n.className=cls;return n;};
export function createPlayerHistoryView({host,id,locale,currentClub,clubName,clubCrest,competitionName,fetchStats}){
 if(!host||!Number.isSafeInteger(id)||id<1||typeof fetchStats!=='function')throw TypeError('Invalid Player History view');
 const tbody=host.querySelector('[data-player-history-rows]'),note=host.querySelector('[data-player-history-note]');
 const currentValue=host.querySelector('[data-player-history-current-value]'),words=()=>historyWords[locale()]||historyWords.en;
 let state='loading',model=null,reading=null;
 function clubLink(key){
  const match=clubPattern.exec(key);if(!match)return el('span',key);
  const link=el('a',clubName?.(key)||key,'app-player-history-link');
  link.href='/clubs/'+match[1].toLowerCase()+'/'+Number(match[2])+'/overview';return link;
 }
 function render(){
  const w=words();
  host.querySelector('[data-player-history-title]').textContent=w.title;
  host.querySelector('[data-player-history-description]').textContent=w.description;
  host.querySelector('[data-player-history-current-label]').textContent=w.current;
  host.querySelectorAll('[data-player-history-heading]').forEach((n,i)=>{n.textContent=w.head[i];});
  const live=currentClub();
  if(live===null)currentValue.textContent=w.free;
  else if(typeof live==='string'&&clubPattern.test(live))currentValue.replaceChildren(clubLink(live));
  else currentValue.textContent='—';
  host.setAttribute('aria-busy',String(state==='loading'));
  if(state==='loading')return; // Keep parser-time skeleton until authoritative data is ready.
  if(state==='error'||!model||model.status==='unavailable'){
   tbody.replaceChildren();note.textContent=w.unavailable;note.hidden=false;return;
  }
  if(model.status==='empty'||!model.rows.length){
   tbody.replaceChildren();note.textContent=w.empty;note.hidden=false;return;
  }
  note.hidden=true;note.textContent='';const output=[];
  for(const item of model.rows){
   const row=el('tr','','app-player-history-row'+(item.kind==='unavailable'?' app-player-history-row-unavailable':''));
   const season=el('th',w.season+' '+item.season);season.scope='row';row.append(season);
   if(item.kind!=='club'){
    const status=el('td',item.kind==='unavailable'?w.unsupported:item.kind==='pending'?w.pending:w.none,'app-player-history-pending');
    status.colSpan=3;row.append(status);output.push(row);continue;
   }
   const identity=el('span','','app-player-history-identity');
   const crest=el('span','','app-player-history-crest app-world-club-crest-placeholder');
   crest.setAttribute('aria-hidden','true');
   const match=clubPattern.exec(item.clubId),asset=clubCrest?.(item.clubId);
   if(asset==='assets/clubs/'+match[1]+'/'+Number(match[2])+'/crest.svg'){
    const img=el('img');img.src='/'+asset;img.width=24;img.height=24;
    img.alt='';img.loading='lazy';img.decoding='async';img.draggable=false;
    img.addEventListener('error',()=>img.remove(),{once:true});crest.append(img);
   }
   identity.append(crest,clubLink(item.clubId));
   const club=el('td');club.append(identity);row.append(club);
   const comps=el('td'),links=el('span','','app-player-history-competitions');
   item.competitions.forEach((id,index)=>{
    if(index)links.append(el('span','·'));
    const link=el('a',competitionName?.(id)||id,'app-player-history-link');
    link.href='/competitions/'+id.toLowerCase()+'/standings?season='+item.season;
    links.append(link);
   });
   comps.append(links);row.append(comps,el('td',String(item.appearances)));output.push(row);
  }
  tbody.replaceChildren(...output);
 }
 function load(){
  if(state==='ready'||reading)return reading||Promise.resolve();
  render();
  reading=Promise.resolve().then(()=>fetchStats(id)).then(payload=>{
   if(payload.playerId!==id)throw TypeError('Mismatched history identity');
   model=projectPlayerClubHistory(payload);state='ready';render();
  }).catch(()=>{state='error';render();}).finally(()=>{reading=null;});
  return reading;
 }
 return {render,load};
}
