/* #581: view-only World History. Never derive sporting results in the browser. */
(()=>{'use strict';
 const root=document.getElementById('world-history');if(!root)return;
 const ids=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const competitionIds=ids.flatMap(c=>[1,2].map(t=>c+'-'+t)).concat('int-1','int-2');
 const clubPattern=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
 const copy={
  en:{debugTag:'Debug',debugLoading:'Loading fictional Debug history…',debugUnstarted:'Debug is at Season 0. No completed seasons.',debugEmpty:'No completed Debug seasons yet. Advance to a later season or the final sporting day.',debugError:'Debug history is unavailable. No winners were substituted.',title:'World History',season:'Season',country:'Champion country',competition:'Competition',allSeasons:'All seasons',allCountries:'All countries',allCompetitions:'All competitions',loading:'Loading verified archive…',unstarted:'The world has not started. No seasons have been completed.',empty:'No completed seasons are available yet.',filtered:'No champions match these filters.',error:'Verified history is unavailable. No results were substituted.',retry:'Retry',count:'champions',first:'First division',second:'Second division',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italy','England','Spain','Germany','France','Portugal','Netherlands','Brazil']},
  de:{debugTag:'Debug',debugLoading:'Fiktive Debug-Historie wird geladen…',debugUnstarted:'Debug steht auf Saison 0. Keine abgeschlossenen Saisons.',debugEmpty:'Noch keine abgeschlossenen Debug-Saisons.',debugError:'Debug-Historie nicht verfügbar. Keine erfundenen Ersatzdaten.',title:'Weltgeschichte',season:'Saison',country:'Land des Meisters',competition:'Wettbewerb',allSeasons:'Alle Saisons',allCountries:'Alle Länder',allCompetitions:'Alle Wettbewerbe',loading:'Bestätigtes Archiv wird geladen…',unstarted:'Die Welt hat noch nicht begonnen. Es gibt keine abgeschlossenen Saisons.',empty:'Noch keine abgeschlossenen Saisons verfügbar.',filtered:'Keine Meister entsprechen diesen Filtern.',error:'Bestätigte Historie ist nicht verfügbar. Keine Ersatzresultate.',retry:'Erneut versuchen',count:'Meister',first:'Erste Liga',second:'Zweite Liga',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italien','England','Spanien','Deutschland','Frankreich','Portugal','Niederlande','Brasilien']},
  es:{debugTag:'Debug',debugLoading:'Cargando historia Debug ficticia…',debugUnstarted:'Debug está en la temporada 0. No hay temporadas completadas.',debugEmpty:'Todavía no hay temporadas Debug completadas.',debugError:'Historial Debug no disponible.',title:'Historia mundial',season:'Temporada',country:'País del campeón',competition:'Competición',allSeasons:'Todas las temporadas',allCountries:'Todos los países',allCompetitions:'Todas las competiciones',loading:'Cargando archivo verificado…',unstarted:'El mundo aún no ha comenzado. No hay temporadas completadas.',empty:'Todavía no hay temporadas completadas.',filtered:'Ningún campeón coincide con estos filtros.',error:'El historial verificado no está disponible. No se han sustituido resultados.',retry:'Reintentar',count:'campeones',first:'Primera división',second:'Segunda división',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italia','Inglaterra','España','Alemania','Francia','Portugal','Países Bajos','Brasil']},
  fr:{debugTag:'Debug',debugLoading:'Chargement de l’historique Debug fictif…',debugUnstarted:'Debug est à la saison 0. Aucune saison terminée.',debugEmpty:'Aucune saison Debug terminée pour le moment.',debugError:'Historique Debug indisponible.',title:'Histoire mondiale',season:'Saison',country:'Pays du champion',competition:'Compétition',allSeasons:'Toutes les saisons',allCountries:'Tous les pays',allCompetitions:'Toutes les compétitions',loading:'Chargement des archives vérifiées…',unstarted:'Le monde n’a pas encore commencé. Aucune saison terminée.',empty:'Aucune saison terminée disponible.',filtered:'Aucun champion ne correspond à ces filtres.',error:'Historique vérifié indisponible. Aucun résultat de substitution.',retry:'Réessayer',count:'champions',first:'Première division',second:'Deuxième division',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italie','Angleterre','Espagne','Allemagne','France','Portugal','Pays-Bas','Brésil']},
  it:{debugTag:'Debug',debugLoading:'Caricamento storico Debug fittizio…',debugUnstarted:'Debug è alla Stagione 0. Nessuna stagione completata.',debugEmpty:'Nessuna stagione Debug completata. Avanza alla stagione successiva o all’ultimo giorno sportivo.',debugError:'Storico Debug non disponibile. Nessun vincitore sostitutivo.',title:'Storia mondiale',season:'Stagione',country:'Paese del campione',competition:'Competizione',allSeasons:'Tutte le stagioni',allCountries:'Tutti i paesi',allCompetitions:'Tutte le competizioni',loading:'Caricamento archivio verificato…',unstarted:'Il mondo non è ancora iniziato. Nessuna stagione completata.',empty:'Non ci sono ancora stagioni completate.',filtered:'Nessun campione corrisponde ai filtri.',error:'Archivio verificato non disponibile. Nessun risultato sostitutivo.',retry:'Riprova',count:'campioni',first:'Prima divisione',second:'Seconda divisione',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italia','Inghilterra','Spagna','Germania','Francia','Portogallo','Paesi Bassi','Brasile']}
 };
 const locale=()=>copy[document.documentElement.lang]||copy.en;
 const seasons=root.querySelector('#world-history-season'),countries=root.querySelector('#world-history-country'),comps=root.querySelector('#world-history-competition');
 const archive=root.querySelector('#world-history-archive'),status=root.querySelector('#world-history-status'),count=root.querySelector('#world-history-count'),retry=root.querySelector('#world-history-retry');
 let payload=null,clubNames=new Map(),clubCrests=new Map(),competitionNames=new Map(),competitionLogos=new Map(),loading=false,error=false,request=0;
 const debugActive=()=>window.faDevPreviewMode===true&&window.faDebugEnabled===true;
 const text=(node,value)=>{node.textContent=value;return node};
 const make=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el};
 // Official competition names are the same published identities used in Matches.
 const compLabel=(id,w)=>competitionNames.get(id)||
  (id==='int-1'?w.sovereign:id==='int-2'?w.federation:id.split('-')[0]+' · '+(id.endsWith('-1')?w.first:w.second));
 // International cups have no approved artwork yet; use the established neutral mark.
 const neutralCupMark='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v8a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v3a4 4 0 0 0 4 4M16 6h3v3a4 4 0 0 1-4 4M12 16v3M8 21h8"/></svg>';
 function competitionMark(id){
  const slot=make('span','fa-world-history-logo');slot.setAttribute('aria-hidden','true');
  const fallback=()=>{slot.classList.add('app-competition-logo-placeholder');slot.innerHTML=neutralCupMark};
  const url=competitionLogos.get(id);
  if(!url){fallback();return slot}
  const img=make('img');img.alt='';img.loading='lazy';img.decoding='async';
  img.addEventListener('error',fallback,{once:true});
  img.src=url;slot.append(img);return slot;
 }
 const safeDebugPayload=p=>p&&p.schemaVersion===1&&p.providerId==='dev-world-history'&&
  p.provenance?.kind==='fictional'&&p.provenance?.sourceRef==='dev-fictional-preview'&&
  p.provenance?.approved===false&&p.coverage==='domestic-only'&&
  ['empty','available'].includes(p.status)&&p.world&&
  Number.isSafeInteger(p.world.seasonNumber)&&p.world.seasonNumber>=0&&
  Array.isArray(p.seasons)&&p.seasons.every(s=>Number.isSafeInteger(s.seasonNumber)&&
   s.seasonNumber>=1&&s.seasonNumber<=4&&
   Array.isArray(s.champions)&&s.champions.length===16&&
   new Set(s.champions.map(c=>c.competitionId)).size===16&&
   s.champions.every(c=>competitionIds.slice(0,16).includes(c.competitionId)&&
    clubPattern.test(c.championClubId)&&c.championClubId.startsWith(c.competitionId.split('-')[0]+'-')))&&
  new Set(p.seasons.map(s=>s.seasonNumber)).size===p.seasons.length&&
  (p.status==='empty')===(p.seasons.length===0);
 const safePayload=p=>p&&p.schemaVersion===1&&p.providerId==='authoritative-world-history'&&
  p.provenance?.kind==='authoritative'&&p.provenance?.source==='closed-season-archive'&&
  ['empty','available'].includes(p.status)&&p.world&&Number.isSafeInteger(p.world.seasonNumber)&&
  Array.isArray(p.seasons)&&p.seasons.every(s=>Number.isSafeInteger(s.seasonNumber)&&s.seasonNumber>=1&&
   Array.isArray(s.champions)&&s.champions.length===18&&
   s.champions.every(c=>competitionIds.includes(c.competitionId)&&clubPattern.test(c.championClubId)))&&
  new Set(p.seasons.map(s=>s.seasonNumber)).size===p.seasons.length;
 // Shared combobox controller: Clubs/Competitions keyboard, focus and viewport behavior.
 const filterControls=[['season',seasons],['country',countries],['competition',comps]].map(([id,select])=>({
  id,select,control:root.querySelector('#world-history-'+id+'-control'),
  trigger:root.querySelector('#world-history-'+id+'-trigger'),
  menu:root.querySelector('#world-history-'+id+'-menu'),
  value:root.querySelector('#world-history-'+id+'-value'),
  binding:null
 }));
 const contentPane=document.querySelector('.fa-shell-content-scroll');
 function syncFilter(item){
  const selected=item.select.selectedOptions[0];
  item.value.textContent=selected?.textContent||'';
  item.trigger.value=item.select.value;
  item.binding?.sync(item.select.value);
 }
 function syncFilters(){for(const item of filterControls)syncFilter(item)}
 function choose(item,values,label){
  const select=item.select,current=select.value;
  select.replaceChildren(new Option(label,''));
  for(const [value,display] of values)select.add(new Option(display,String(value)));
  select.value=[...select.options].some(o=>o.value===current)?current:'';
  const nodes=[...select.options].map((option,index)=>{
   const node=make('div','language-option',option.textContent);
   node.id='world-history-'+item.id+'-option-'+index;
   node.dataset.menuValue=option.value;
   node.setAttribute('role','option');
   node.setAttribute('aria-selected',String(option.value===select.value));
   return node;
  });
  item.menu.replaceChildren(...nodes);
  if(item.binding)item.binding.update(nodes);
  else item.binding=window.faBindCompetitionMenu(item.trigger,item.menu,nodes,value=>{
   item.select.value=value;syncFilter(item);updateUrl();
  },item.control,{fitViewport:true,boundary:contentPane});
  syncFilter(item);
 }
 function setFilterDisabled(disabled){
  for(const item of filterControls){
   item.select.disabled=disabled;
   item.trigger.disabled=disabled;
   if(disabled)item.binding?.close();
  }
 }
 function fromUrl(){
  const q=new URLSearchParams(location.search);
  const season=q.get('season')||'',country=q.get('country')||'',competition=q.get('competition')||'';
  seasons.value=[...seasons.options].some(o=>o.value===season)?season:'';
  countries.value=ids.includes(country)?country:'';
  comps.value=competitionIds.includes(competition)?competition:'';
  const canonical=new URLSearchParams();
  if(seasons.value)canonical.set('season',seasons.value);
  if(countries.value)canonical.set('country',countries.value);
  if(comps.value)canonical.set('competition',comps.value);
  const desired=location.pathname+(canonical.size?'?'+canonical:'')+location.hash;
  if(location.pathname+location.search+location.hash!==desired)history.replaceState(null,'',desired);
  syncFilters();
 }
 function updateUrl(){
  const query=new URLSearchParams();
  if(seasons.value)query.set('season',seasons.value);
  if(countries.value)query.set('country',countries.value);
  if(comps.value)query.set('competition',comps.value);
  history.pushState(null,'',location.pathname+(query.size?'?'+query:'')+location.hash);
  render();
 }
 function labels(){
  const w=locale();text(root.querySelector('#world-history-title'),w.title);
  for(const [id,label] of [['season',w.season],['country',w.country],['competition',w.competition]])
   text(root.querySelector('#world-history-'+id+'-label'),label);
  text(retry,w.retry);
  choose(filterControls[0],(payload?.seasons||[]).map(s=>[String(s.seasonNumber),w.season+' '+s.seasonNumber]),w.allSeasons);
  choose(filterControls[1],ids.map((code,i)=>[code,w.countries[i]]),w.allCountries);
  choose(filterControls[2],(debugActive()?competitionIds.slice(0,16):competitionIds).map(id=>[id,compLabel(id,w)]),w.allCompetitions);
  root.querySelector('.fa-world-history-controls').setAttribute('aria-label',w.title+' — '+w.competition);
 }
 function render(){
  const w=locale();
  if(loading){status.textContent=debugActive()?w.debugLoading:w.loading;status.hidden=false;return;}
  archive.setAttribute('aria-busy','false');
  if(error){status.textContent=debugActive()?w.debugError:w.error;status.hidden=false;count.textContent='';archive.replaceChildren();return;}
  if(!payload)return;
  const wanted=payload.seasons.filter(s=>!seasons.value||String(s.seasonNumber)===seasons.value)
   .map(s=>({...s,champions:s.champions.filter(c=>
    (!countries.value||c.championClubId.startsWith(countries.value+'-'))&&
    (!comps.value||c.competitionId===comps.value))}))
   .filter(s=>s.champions.length);
  archive.replaceChildren();
  let total=0;
  for(const season of wanted){
   const section=make('section','fa-world-history-season');
   const heading=make('h2','',w.season+' '+season.seasonNumber);section.append(heading);
   const list=make('ul','fa-world-history-list');
   for(const champion of season.champions){
    total++;
    const row=make('li','fa-world-history-row');
    const competition=make('a','fa-world-history-competition');
    competition.href='/competitions/'+champion.competitionId.toLowerCase()+'/history';
    competition.append(competitionMark(champion.competitionId),
     make('span','fa-world-history-competition-name',compLabel(champion.competitionId,w)));
    const holder=make('span','fa-world-history-club');
    const crest=clubCrests.get(champion.championClubId);
    if(crest){
     const img=make('img','fa-world-history-crest');img.src='/'+crest;img.alt='';img.loading='lazy';img.decoding='async';
     holder.append(img);
    }
    const club=make('a','',clubNames.get(champion.championClubId)||champion.championClubId);
    const [country,id]=champion.championClubId.split('-');
    club.href='/clubs/'+country.toLowerCase()+'/'+id+'/history';
    holder.append(club);row.append(competition,holder);list.append(row);
   }
   section.append(list);archive.append(section);
  }
  count.textContent=total?total+' '+w.count+(debugActive()?' · '+w.debugTag:''):'';
  status.hidden=total>0;
  if(!total)status.textContent=payload.seasons.length===0?
   (debugActive()?payload.world.seasonNumber===0?w.debugUnstarted:w.debugEmpty:
    payload.world.seasonNumber===0?w.unstarted:w.empty):w.filtered;
 }
 let competitionRequest=null;
 function loadCompetitionMetadata(){
  competitionRequest??=Promise.all([
   import('./match-public-context.mjs'),import('./public-image-urls.mjs')
  ]).then(([{matchPublicContext},{competitionLogoUrl}])=>{
   const names=new Map(),logos=new Map();
   for(const id of competitionIds){
    const definition=matchPublicContext({competitionId:id})?.competitions?.[0];
    if(definition?.id!==id||typeof definition.name!=='string'||!definition.name.trim())
     throw Error('Invalid published competition identity');
    names.set(id,definition.name);
    const logo=competitionLogoUrl(id,'compact');
    if(logo)logos.set(id,logo);
   }
   competitionNames=names;competitionLogos=logos;
   labels();if(payload)render();
  }).catch(()=>{competitionRequest=null}); // Fallback labels preserve navigation.
  return competitionRequest;
 }
 let identityRequest=null;
 function useIdentity(identity){
  if(identity?.schemaVersion===1&&identity.projection==='club-identity-v1'&&
     Array.isArray(identity.clubs)&&identity.clubs.length===320){
   clubNames=new Map(identity.clubs.filter(c=>clubPattern.test(c.countryId+'-'+c.clubId)&&typeof c.primaryName==='string').map(c=>[c.countryId+'-'+c.clubId,c.primaryName]));
   const publicCrests=identity.clubCrests||{};
   clubCrests=new Map(Object.entries(publicCrests).filter(([key,path])=>
    clubPattern.test(key)&&typeof path==='string'&&/^assets\/clubs\/(?:IT|ENG|ES|DE|FR|PT|NL|BR)\/(?:[1-9]|[1-3][0-9]|40)\/crest\.svg$/.test(path)));
  }
 }
 function loadIdentity(){
  identityRequest??=fetch('/clubs/_shared/identity.json',{credentials:'omit'})
   .then(r=>r.ok?r.json():null).then(identity=>{
    useIdentity(identity);
    if(payload)render();
   }).catch(()=>{identityRequest=null});
  return identityRequest;
 }
 async function load(){
  const token=++request;
  loading=true;error=false;retry.hidden=true;
  if(debugActive()){
   payload=null;labels();archive.setAttribute('aria-busy','true');
   void loadIdentity();
   setFilterDisabled(true);render();return;
  }
  archive.setAttribute('aria-busy','true');
  setFilterDisabled(true);
  status.hidden=false;status.textContent=locale().loading;
  try{
   const reply=await fetch('/api/world/history',{credentials:'omit',cache:'no-store',redirect:'error'});
   if(!reply.ok)throw Error('archive unavailable');
   const data=await reply.json();
   if(!safePayload(data))throw Error('invalid archive');
   if(token!==request||debugActive())return;
   payload=data;
   void loadIdentity();

  }catch{if(token===request&&!debugActive()){payload=null;error=true}}
  finally{
   if(token!==request||debugActive())return;
   loading=false;
   labels();
   setFilterDisabled(error||!payload?.seasons.length);
   retry.hidden=!error;
   if(!error)fromUrl();
   render();
  }
 }
 function pendingDebug(){
  if(!debugActive())return;
  ++request;payload=null;error=false;loading=true;
  archive.setAttribute('aria-busy','true');archive.replaceChildren();
  setFilterDisabled(true);retry.hidden=true;labels();render();
 }
 window.addEventListener('fa:source-change',()=>{
  if(debugActive())pendingDebug();
  else {++request;loading=false;void load();}
 });
 for(const event of ['fa:dev-progress-change','fa:dev-world-day-change'])
  window.addEventListener(event,pendingDebug);
 window.addEventListener('fa:dev-world-history',event=>{
  if(!debugActive())return;
  ++request;
  loading=false;error=!safeDebugPayload(event.detail);
  payload=error?null:event.detail;
  retry.hidden=!error;
  labels();setFilterDisabled(error||!payload?.seasons.length);
  if(!error)fromUrl();
  render();
 });
 retry.addEventListener('click',()=>{
  if(debugActive()){pendingDebug();window.dispatchEvent(new Event('fa:dev-world-history-retry'))}
  else void load();
 });
 window.addEventListener('popstate',()=>{if(payload){fromUrl();render()}});
 new MutationObserver(()=>{labels();render()})
  .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 void loadCompetitionMetadata();
 load();
})();
