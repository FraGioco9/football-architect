/* #581: view-only World History. Never derive sporting results in the browser. */
(()=>{'use strict';
 const root=document.getElementById('world-history');if(!root)return;
 const ids=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const competitionIds=ids.flatMap(c=>[1,2].map(t=>c+'-'+t)).concat('int-1','int-2');
 const clubPattern=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
 const copy={
  en:{title:'World History',intro:'Verified champions of completed seasons across all competitions.',season:'Season',country:'Champion country',competition:'Competition',allSeasons:'All seasons',allCountries:'All countries',allCompetitions:'All competitions',loading:'Loading verified archive…',unstarted:'The world has not started. No seasons have been completed.',empty:'No completed seasons are available yet.',filtered:'No champions match these filters.',error:'Verified history is unavailable. No results were substituted.',retry:'Retry',count:'champions',first:'First division',second:'Second division',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italy','England','Spain','Germany','France','Portugal','Netherlands','Brazil']},
  de:{title:'Weltgeschichte',intro:'Bestätigte Meister abgeschlossener Saisons in allen Wettbewerben.',season:'Saison',country:'Land des Meisters',competition:'Wettbewerb',allSeasons:'Alle Saisons',allCountries:'Alle Länder',allCompetitions:'Alle Wettbewerbe',loading:'Bestätigtes Archiv wird geladen…',unstarted:'Die Welt hat noch nicht begonnen. Es gibt keine abgeschlossenen Saisons.',empty:'Noch keine abgeschlossenen Saisons verfügbar.',filtered:'Keine Meister entsprechen diesen Filtern.',error:'Bestätigte Historie ist nicht verfügbar. Keine Ersatzresultate.',retry:'Erneut versuchen',count:'Meister',first:'Erste Liga',second:'Zweite Liga',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italien','England','Spanien','Deutschland','Frankreich','Portugal','Niederlande','Brasilien']},
  es:{title:'Historia mundial',intro:'Campeones verificados de temporadas finalizadas en todas las competiciones.',season:'Temporada',country:'País del campeón',competition:'Competición',allSeasons:'Todas las temporadas',allCountries:'Todos los países',allCompetitions:'Todas las competiciones',loading:'Cargando archivo verificado…',unstarted:'El mundo aún no ha comenzado. No hay temporadas completadas.',empty:'Todavía no hay temporadas completadas.',filtered:'Ningún campeón coincide con estos filtros.',error:'El historial verificado no está disponible. No se han sustituido resultados.',retry:'Reintentar',count:'campeones',first:'Primera división',second:'Segunda división',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italia','Inglaterra','España','Alemania','Francia','Portugal','Países Bajos','Brasil']},
  fr:{title:'Histoire mondiale',intro:'Champions vérifiés des saisons terminées dans toutes les compétitions.',season:'Saison',country:'Pays du champion',competition:'Compétition',allSeasons:'Toutes les saisons',allCountries:'Tous les pays',allCompetitions:'Toutes les compétitions',loading:'Chargement des archives vérifiées…',unstarted:'Le monde n’a pas encore commencé. Aucune saison terminée.',empty:'Aucune saison terminée disponible.',filtered:'Aucun champion ne correspond à ces filtres.',error:'Historique vérifié indisponible. Aucun résultat de substitution.',retry:'Réessayer',count:'champions',first:'Première division',second:'Deuxième division',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italie','Angleterre','Espagne','Allemagne','France','Portugal','Pays-Bas','Brésil']},
  it:{title:'Storia mondiale',intro:'Campioni verificati delle stagioni concluse in tutte le competizioni.',season:'Stagione',country:'Paese del campione',competition:'Competizione',allSeasons:'Tutte le stagioni',allCountries:'Tutti i paesi',allCompetitions:'Tutte le competizioni',loading:'Caricamento archivio verificato…',unstarted:'Il mondo non è ancora iniziato. Nessuna stagione completata.',empty:'Non ci sono ancora stagioni completate.',filtered:'Nessun campione corrisponde ai filtri.',error:'Archivio verificato non disponibile. Nessun risultato sostitutivo.',retry:'Riprova',count:'campioni',first:'Prima divisione',second:'Seconda divisione',sovereign:'Sovereign Cup',federation:'Federation Cup',countries:['Italia','Inghilterra','Spagna','Germania','Francia','Portogallo','Paesi Bassi','Brasile']}
 };
 const locale=()=>copy[document.documentElement.lang]||copy.en;
 const seasons=root.querySelector('#world-history-season'),countries=root.querySelector('#world-history-country'),comps=root.querySelector('#world-history-competition');
 const archive=root.querySelector('#world-history-archive'),status=root.querySelector('#world-history-status'),count=root.querySelector('#world-history-count'),retry=root.querySelector('#world-history-retry');
 let payload=null,clubNames=new Map(),clubCrests=new Map(),loading=false,error=false;
 const text=(node,value)=>{node.textContent=value;return node};
 const make=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el};
 const compLabel=(id,w)=>id==='int-1'?w.sovereign:id==='int-2'?w.federation:id.split('-')[0]+' · '+(id.endsWith('-1')?w.first:w.second);
 const safePayload=p=>p&&p.schemaVersion===1&&p.providerId==='authoritative-world-history'&&
  p.provenance?.kind==='authoritative'&&p.provenance?.source==='closed-season-archive'&&
  ['empty','available'].includes(p.status)&&p.world&&Number.isSafeInteger(p.world.seasonNumber)&&
  Array.isArray(p.seasons)&&p.seasons.every(s=>Number.isSafeInteger(s.seasonNumber)&&s.seasonNumber>=1&&
   Array.isArray(s.champions)&&s.champions.length===18&&
   s.champions.every(c=>competitionIds.includes(c.competitionId)&&clubPattern.test(c.championClubId)))&&
  new Set(p.seasons.map(s=>s.seasonNumber)).size===p.seasons.length;
 function choose(select,values,label){
  const current=select.value;
  select.replaceChildren(new Option(label,''));
  for(const [value,display] of values)select.add(new Option(display,value));
  select.value=[...select.options].some(o=>o.value===current)?current:'';
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
  text(root.querySelector('#world-history-intro'),w.intro);
  text(root.querySelector('label[for="world-history-season"]'),w.season);
  text(root.querySelector('label[for="world-history-country"]'),w.country);
  text(root.querySelector('label[for="world-history-competition"]'),w.competition);
  text(retry,w.retry);
  choose(seasons,(payload?.seasons||[]).map(s=>[String(s.seasonNumber),w.season+' '+s.seasonNumber]),w.allSeasons);
  choose(countries,ids.map((code,i)=>[code,w.countries[i]]),w.allCountries);
  choose(comps,competitionIds.map(id=>[id,compLabel(id,w)]),w.allCompetitions);
  root.querySelector('.fa-world-history-controls').setAttribute('aria-label',w.allCompetitions);
 }
 function render(){
  const w=locale();
  if(loading){status.textContent=w.loading;status.hidden=false;return;}
  archive.setAttribute('aria-busy','false');
  if(error){status.textContent=w.error;status.hidden=false;count.textContent='';archive.replaceChildren();return;}
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
    const competition=make('a','',compLabel(champion.competitionId,w));
    competition.href='/competitions/'+champion.competitionId.toLowerCase()+'/history';
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
  count.textContent=total?total+' '+w.count:'';
  status.hidden=total>0;
  if(!total)status.textContent=payload.seasons.length===0?
   (payload.world.seasonNumber===0?w.unstarted:w.empty):w.filtered;
 }
 async function load(){
  if(loading)return;loading=true;error=false;retry.hidden=true;
  archive.setAttribute('aria-busy','true');
  for(const select of [seasons,countries,comps])select.disabled=true;
  status.hidden=false;status.textContent=locale().loading;
  try{
   const [reply,identity]=await Promise.all([
    fetch('/api/world/history',{credentials:'omit',cache:'no-store',redirect:'error'}),
    fetch('/clubs/_shared/identity.json',{credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null)
   ]);
   if(!reply.ok)throw Error('archive unavailable');
   const data=await reply.json();
   if(!safePayload(data))throw Error('invalid archive');
   payload=data;
   if(identity?.schemaVersion===1&&identity.projection==='club-identity-v1'&&
      Array.isArray(identity.clubs)&&identity.clubs.length===320){
    clubNames=new Map(identity.clubs.filter(c=>clubPattern.test(c.countryId+'-'+c.clubId)&&typeof c.primaryName==='string').map(c=>[c.countryId+'-'+c.clubId,c.primaryName]));
    const publicCrests=identity.clubCrests||{};
    clubCrests=new Map(Object.entries(publicCrests).filter(([key,path])=>
     clubPattern.test(key)&&typeof path==='string'&&/^assets\/clubs\/(?:IT|ENG|ES|DE|FR|PT|NL|BR)\/(?:[1-9]|[1-3][0-9]|40)\/crest\.svg$/.test(path)));
   }
  }catch{payload=null;error=true}
  finally{
   loading=false;
   labels();
   for(const select of [seasons,countries,comps])select.disabled=error||!payload?.seasons.length;
   retry.hidden=!error;
   if(!error)fromUrl();
   render();
  }
 }
 for(const select of [seasons,countries,comps])select.addEventListener('change',updateUrl);
 retry.addEventListener('click',load);
 window.addEventListener('popstate',()=>{if(payload){fromUrl();render()}});
 new MutationObserver(()=>{const prev=[seasons.value,countries.value,comps.value];labels();
  [seasons,countries,comps].forEach((el,i)=>{el.value=prev[i]});render()})
  .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 load();
})();
