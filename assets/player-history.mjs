/** #579 — signed-contract History. Do not infer signings from club membership or match statistics. */
export const historyWords={
 "en": {
  "contractHead": [
   "Event",
   "Club",
   "Duration",
   "Signed on"
  ],
  "contractEvent": "Contract signed",
  "durationSingular": "season",
  "durationPlural": "seasons",
  "contractEmpty": "No signed contracts recorded yet.",
  "contractUnavailable": "Signed contract history unavailable",
  "contractPending": "Contract signing is not yet available. Signed contracts will appear here once recorded."
 },
 "de": {
  "contractHead": [
   "Ereignis",
   "Verein",
   "Laufzeit",
   "Unterzeichnet am"
  ],
  "contractEvent": "Vertrag unterzeichnet",
  "durationSingular": "Saison",
  "durationPlural": "Saisons",
  "contractEmpty": "Noch keine unterzeichneten Verträge erfasst.",
  "contractUnavailable": "Vertragshistorie nicht verfügbar",
  "contractPending": "Die Vertragsunterzeichnung ist noch nicht verfügbar. Unterzeichnete Verträge erscheinen hier, sobald sie erfasst wurden."
 },
 "es": {
  "contractHead": [
   "Evento",
   "Club",
   "Duración",
   "Fecha de firma"
  ],
  "contractEvent": "Contrato firmado",
  "durationSingular": "temporada",
  "durationPlural": "temporadas",
  "contractEmpty": "Aún no hay contratos firmados registrados.",
  "contractUnavailable": "Historial de contratos no disponible",
  "contractPending": "La firma de contratos aún no está disponible. Los contratos firmados aparecerán aquí cuando se registren."
 },
 "fr": {
  "contractHead": [
   "Événement",
   "Club",
   "Durée",
   "Date de signature"
  ],
  "contractEvent": "Contrat signé",
  "durationSingular": "saison",
  "durationPlural": "saisons",
  "contractEmpty": "Aucun contrat signé enregistré à ce jour.",
  "contractUnavailable": "Historique des contrats indisponible",
  "contractPending": "La signature des contrats n’est pas encore disponible. Les contrats signés apparaîtront ici après leur enregistrement."
 },
 "it": {
  "contractHead": [
   "Evento",
   "Club",
   "Durata",
   "Data della firma"
  ],
  "contractEvent": "Contratto firmato",
  "durationSingular": "stagione",
  "durationPlural": "stagioni",
  "contractEmpty": "Nessun contratto firmato registrato.",
  "contractUnavailable": "Storico dei contratti non disponibile",
  "contractPending": "La firma dei contratti non è ancora disponibile. I contratti firmati compariranno qui quando saranno registrati."
 }
};
const clubPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
/** Signed events come only from an authoritative ledger, never from current affiliation. */
export function projectPlayerSignedContracts(payload){
 if(!payload||payload.schemaVersion!==1||!Number.isSafeInteger(payload.playerId)||payload.playerId<1||
  !['available','empty','not_supported'].includes(payload.status)||!Array.isArray(payload.contracts))
  throw TypeError('Invalid signed contract history');
 if((payload.status!=='available')!==(payload.contracts.length===0))
  throw TypeError('Inconsistent signed contract history');
 const seen=new Set();
 const contracts=payload.contracts.map(record=>{
  const signed=new Date(record?.signedAt);
  if(!Number.isSafeInteger(record?.id)||record.id<1||seen.has(record.id)||
   !clubPattern.test(record?.clubKey)||!Number.isSafeInteger(record?.durationSeasons)||
   record.durationSeasons<1||typeof record.signedAt!=='string'||
   !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.signedAt)||
   !Number.isFinite(signed.getTime())||signed.toISOString()!==record.signedAt)
   throw TypeError('Invalid signed contract event');
  seen.add(record.id);
  return {id:record.id,clubKey:record.clubKey,durationSeasons:record.durationSeasons,signedAt:record.signedAt};
 }).sort((a,b)=>b.signedAt.localeCompare(a.signedAt)||b.id-a.id);
 return {status:payload.status,contracts};
}
const el=(tag,txt='',cls='')=>{const n=document.createElement(tag);n.textContent=txt;if(cls)n.className=cls;return n;};
/** Fetches verified events only; unsupported remains separate from a verified empty ledger. */
export function createPlayerHistoryView({host,id,locale,clubName,clubCrest,fetchContracts}){
 if(!host||!Number.isSafeInteger(id)||id<1||typeof fetchContracts!=='function'||typeof locale!=='function')
  throw TypeError('Invalid Player History view');
 const rows=host.querySelector('[data-player-contract-rows]'),note=host.querySelector('[data-player-contract-note]');
 const headings=[...host.querySelectorAll('[data-player-contract-heading]')];
 if(!rows||!note||headings.length!==4)throw TypeError('Missing contract History structure');
 let state='loading',model=null,reading=null;
 const words=()=>historyWords[locale()]||historyWords.en;
 function clubLink(key){
  const match=clubPattern.exec(key);
  if(!match)return el('span',key);
  const link=el('a',clubName?.(key)||key,'app-player-history-link');
  link.href='/clubs/'+match[1].toLowerCase()+'/'+Number(match[2])+'/overview';
  return link;
 }
 function render(){
  const w=words();
  headings.forEach((node,i)=>{node.textContent=w.contractHead[i]});
  host.setAttribute('aria-busy',String(state==='loading'));
  if(state==='loading')return; // Retain parser-time skeleton until response state is known.
  if(state==='error'||!model){
   rows.replaceChildren();note.textContent=w.contractUnavailable;note.hidden=false;return;
  }
  if(model.status!=='available'){
   rows.replaceChildren();note.textContent=model.status==='not_supported'?w.contractPending:w.contractEmpty;note.hidden=false;return;
  }
  const output=[];
  for(const contract of model.contracts){
   const row=el('tr','','app-player-history-row');
   const event=el('th',w.contractEvent,'app-player-contracts-event');event.scope='row';
   const club=el('td'),identity=el('span','','app-player-history-identity');
   const crest=el('span','','app-player-history-crest app-world-club-crest-placeholder');
   crest.setAttribute('aria-hidden','true');
   const match=clubPattern.exec(contract.clubKey),asset=clubCrest?.(contract.clubKey);
   if(asset==='assets/clubs/'+match[1]+'/'+Number(match[2])+'/crest.svg'){
    const img=el('img');img.src='/'+asset;img.width=24;img.height=24;
    img.alt='';img.loading='lazy';img.decoding='async';img.draggable=false;
    img.addEventListener('error',()=>img.remove(),{once:true});crest.append(img);
   }
   identity.append(crest,clubLink(contract.clubKey));club.append(identity);
   const duration=el('td',String(contract.durationSeasons)+' '+(contract.durationSeasons===1?w.durationSingular:w.durationPlural));
   const date=el('td','','app-player-contracts-date'),time=el('time',
    new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(contract.signedAt)));
   time.dateTime=contract.signedAt;date.append(time);
   row.append(event,club,duration,date);output.push(row);
  }
  rows.replaceChildren(...output);note.textContent='';note.hidden=true;
 }
 function load(){
  if(state==='ready'||reading)return reading||Promise.resolve();
  render();
  reading=Promise.resolve().then(()=>fetchContracts(id)).then(payload=>{
   if(payload.playerId!==id)throw TypeError('Mismatched contract identity');
   model=projectPlayerSignedContracts(payload);state='ready';render();
  }).catch(()=>{state='error';render();}).finally(()=>{reading=null;});
  return reading;
 }
 return {render,load};
}
