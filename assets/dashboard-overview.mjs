/* PAGE-DASH-01: source-backed Dashboard, anonymous GET only; no own /api/world read. */
import './world-calendar-model.js';
import './world-clock-adapter.js';
import {publicClubIdentityCatalog} from './match-public-context.mjs';

const sameWorld=(a,b)=>!!a&&!!b&&['generation','revision','seasonNumber','day','phase'].every(k=>a[k]===b[k]);
const score=n=>Number.isSafeInteger(n)&&n>=0;
export function chooseDashboardDays(days,day){
 if(!Array.isArray(days)||!Number.isInteger(day)||day<0||day>56)return [];
 const official=days.filter(d=>Number.isInteger(d?.day)&&d.day>=1&&d.day<=56&&Array.isArray(d.events)&&d.events.length);
 return [...official.filter(d=>d.day<day).slice(-2),...official.filter(d=>d.day>=day).slice(0,2)].map(d=>d.day);
}
export function validDashboardDirectory(d,world,season,day){
 if(!d||d.schemaVersion!==1||d.providerId!=='authoritative-world'||!sameWorld(d.world,world)||
    d.selectedSeason!==season||d.day!==day||!['published','partial','unpublished','unavailable'].includes(d.publication)||!Array.isArray(d.fixtures))return false;
 const seen=new Set();
 for(const f of d.fixtures){
  if(!f||typeof f.matchId!=='string'||!/^[1-9]\d*$/.test(f.matchId)||!Number.isSafeInteger(Number(f.matchId))||
     seen.has(f.matchId)||!/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(f.competitionId)||
     !['completed','scheduled','awaiting_participants'].includes(f.status))return false;
  seen.add(f.matchId);
  for(const club of [f.homeClubId,f.awayClubId])if(club!==null&&(typeof club!=='string'||!/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/.test(club)))return false;
  if((f.status==='completed')!==(f.result!==null))return false;
  if(f.status==='scheduled'&&(!f.homeClubId||!f.awayClubId))return false;
  if(f.status==='completed'&&(!f.homeClubId||!f.awayClubId||!score(f.result?.homeGoals)||!score(f.result?.awayGoals)))return false;
 }
 return true;
}
export function pickDashboardMatches(days,current){
 const rows=days.filter(d=>d&&!d.error&&['published','partial'].includes(d.publication)).flatMap(d=>d.fixtures.map(f=>({...f,day:d.day})));
 return {recent:rows.filter(f=>f.day<=current&&f.status==='completed'&&f.result!==null).sort((a,b)=>b.day-a.day).slice(0,4),
         next:rows.filter(f=>f.day>=current&&f.status==='scheduled'&&f.homeClubId&&f.awayClubId).sort((a,b)=>a.day-b.day).slice(0,4)};
}
const glossary={"en":{"world":"World overview","calendar":"Calendar","season":"Season","day":"Sporting day","phase":"World phase","recent":"Recent results","next":"Upcoming fixtures","matches":"All matches","competitions":"Competitions","explore":"Explore","domestic":"Domestic divisions","international":"International cups","catalogue":"Competition catalogue, not a claim of active fixtures.","events":"World events","planned":"Planned calendar markers, not proof of played matches.","retry":"Retry","more":"More information","loading":"Loading world data…","unavailable":"World data unavailable.","unstarted":"The world has not started; no match results exist.","preparing":"Preparing","active":"In progress","closed":"Closed","unknown":"Unavailable","debug":"Debug mode: public match results are not inferred.","noRecent":"No verified recent results in the selected sporting days.","noNext":"No published upcoming fixtures in the selected sporting days.","noEvents":"No further planned events this season.","noSeasonEvents":"No active season events.","missing":"Some match data is unavailable or unpublished.","national":"Domestic round","internationalRound":"International round","federationFinal":"Federation Cup final","sovereignFinal":"Sovereign Cup final","gameDay":"Day"},"it":{"world":"Panoramica del mondo","calendar":"Calendario","season":"Stagione","day":"Giornata sportiva","phase":"Fase del mondo","recent":"Ultimi risultati","next":"Prossime partite","matches":"Tutte le partite","competitions":"Competizioni","explore":"Esplora","domestic":"Divisioni nazionali","international":"Coppe internazionali","catalogue":"Catalogo delle competizioni, non conferma di partite attive.","events":"Eventi del mondo","planned":"Eventi pianificati, non prova di partite disputate.","retry":"Riprova","more":"Altre informazioni","loading":"Caricamento dei dati ufficiali…","unavailable":"Dati del mondo non disponibili.","unstarted":"Il mondo non è ancora iniziato; non ci sono risultati.","preparing":"Preparazione","active":"In corso","closed":"Conclusa","unknown":"Non disponibile","debug":"Modalità Debug: i risultati ufficiali non vengono dedotti.","noRecent":"Nessun risultato verificato nelle giornate considerate.","noNext":"Nessuna prossima partita pubblicata nelle giornate considerate.","noEvents":"Nessun altro evento pianificato in questa stagione.","noSeasonEvents":"Nessun evento in una stagione attiva.","missing":"Alcuni dati delle partite non sono disponibili o pubblicati.","national":"Giornata nazionale","internationalRound":"Turno internazionale","federationFinal":"Finale Federation Cup","sovereignFinal":"Finale Sovereign Cup","gameDay":"Giorno"},"de":{"world":"Weltübersicht","calendar":"Kalender","season":"Saison","day":"Spieltag","phase":"Weltphase","recent":"Letzte Ergebnisse","next":"Nächste Spiele","matches":"Alle Spiele","competitions":"Wettbewerbe","explore":"Entdecken","domestic":"Nationale Ligen","international":"Internationale Pokale","catalogue":"Wettbewerbsübersicht, kein Nachweis aktiver Spiele.","events":"Weltereignisse","planned":"Geplante Termine, kein Nachweis gespielter Partien.","retry":"Erneut versuchen","more":"Weitere Informationen","loading":"Weltdaten werden geladen…","unavailable":"Weltdaten nicht verfügbar.","unstarted":"Die Welt hat noch nicht begonnen; es gibt keine Ergebnisse.","preparing":"Vorbereitung","active":"Läuft","closed":"Beendet","unknown":"Nicht verfügbar","debug":"Debug-Modus: offizielle Spielergebnisse werden nicht abgeleitet.","noRecent":"Keine bestätigten letzten Ergebnisse für diese Spieltage.","noNext":"Keine veröffentlichten bevorstehenden Spiele für diese Spieltage.","noEvents":"Keine weiteren geplanten Termine in dieser Saison.","noSeasonEvents":"Keine aktiven Saisonereignisse.","missing":"Einige Spieldaten sind nicht verfügbar oder unveröffentlicht.","national":"Nationaler Spieltag","internationalRound":"Internationaler Spieltag","federationFinal":"Federation-Cup-Finale","sovereignFinal":"Sovereign-Cup-Finale","gameDay":"Tag"},"es":{"world":"Panorama del mundo","calendar":"Calendario","season":"Temporada","day":"Día deportivo","phase":"Fase del mundo","recent":"Últimos resultados","next":"Próximos partidos","matches":"Todos los partidos","competitions":"Competiciones","explore":"Explorar","domestic":"Divisiones nacionales","international":"Copas internacionales","catalogue":"Catálogo de competiciones, no prueba de partidos activos.","events":"Eventos del mundo","planned":"Eventos previstos, no prueba de partidos disputados.","retry":"Reintentar","more":"Más información","loading":"Cargando datos oficiales…","unavailable":"Datos del mundo no disponibles.","unstarted":"El mundo aún no ha comenzado; no hay resultados.","preparing":"Preparación","active":"En curso","closed":"Finalizada","unknown":"No disponible","debug":"Modo Debug: no se infieren resultados oficiales.","noRecent":"Sin resultados verificados en los días considerados.","noNext":"Sin próximos partidos publicados en los días considerados.","noEvents":"No quedan eventos previstos esta temporada.","noSeasonEvents":"No hay eventos de temporada activa.","missing":"Algunos datos no están disponibles o publicados.","national":"Jornada nacional","internationalRound":"Jornada internacional","federationFinal":"Final de la Federation Cup","sovereignFinal":"Final de la Sovereign Cup","gameDay":"Día"},"fr":{"world":"Vue d’ensemble du monde","calendar":"Calendrier","season":"Saison","day":"Jour sportif","phase":"Phase du monde","recent":"Résultats récents","next":"Prochains matchs","matches":"Tous les matchs","competitions":"Compétitions","explore":"Explorer","domestic":"Divisions nationales","international":"Coupes internationales","catalogue":"Catalogue des compétitions, pas une preuve de matchs actifs.","events":"Événements du monde","planned":"Événements prévus, sans preuve de matchs joués.","retry":"Réessayer","more":"Plus d’informations","loading":"Chargement des données officielles…","unavailable":"Données du monde indisponibles.","unstarted":"Le monde n’a pas démarré ; aucun résultat.","preparing":"Préparation","active":"En cours","closed":"Terminée","unknown":"Indisponible","debug":"Mode Debug : aucun résultat officiel n’est déduit.","noRecent":"Aucun résultat vérifié sur les jours examinés.","noNext":"Aucun prochain match publié sur les jours examinés.","noEvents":"Plus d’événements prévus cette saison.","noSeasonEvents":"Pas d’événement de saison active.","missing":"Certaines données sont indisponibles ou non publiées.","national":"Journée nationale","internationalRound":"Tour international","federationFinal":"Finale Federation Cup","sovereignFinal":"Finale Sovereign Cup","gameDay":"Jour"}};
;
if(typeof document!=='undefined'){
 const root=document.querySelector('.fa-dashboard-overview');
 if(root){
  const lookup=(kind,name)=>root.querySelector('[data-dash-'+kind+'="'+name+'"]');
  const lists=Object.fromEntries(['recent','next','events'].map(k=>[k,lookup('list',k)]));
  const skeletons=Object.fromEntries(Object.entries(lists).map(([k,el])=>[k,el.innerHTML]));
  const teams=new Map(publicClubIdentityCatalog().clubs.map(c=>[c.countryId+'-'+c.clubId,c]));
  const state=window.faWorldState;
  let controller=null,epoch=0,key='',world=null,verified=null;
  const language=()=>Object.hasOwn(glossary,document.documentElement.lang)?document.documentElement.lang:'en';
  const t=k=>glossary[language()][k]??glossary.en[k];
  const write=(kind,id,value)=>{const e=lookup(kind,id);if(e)e.textContent=value};
  const blank=()=>{for(const [k,l] of Object.entries(lists)){l.innerHTML=skeletons[k];l.setAttribute('aria-busy','true')}for(const n of ['recent','next','events'])write('note',n,'');lookup('retry','')?.setAttribute('hidden','')};
  const stop=()=>{epoch++;controller?.abort();controller=null;key=''};
  function localize(){
   root.querySelectorAll('[data-dash-text]').forEach(e=>e.textContent=t(e.dataset.dashText));
   root.querySelector('[data-dash-more]')?.setAttribute('aria-label',t('more'));
  }
  function clock(w,debug=false){
   write('value','season',w?String(w.seasonNumber):'—');
   write('value','day',w?(w.day?w.day+' / 56':'—'):'—');
   write('value','phase',debug?'Debug':w?.phase==='unstarted'?t('unstarted'):w?.phase==='preparing'?t('preparing'):w?.phase==='active'?t('active'):w?.phase==='closed'?t('closed'):'—');
   write('note','world',debug?t('debug'):!w?t('unavailable'):w.phase==='unstarted'?t('unstarted'):w.phase==='preparing'?t('preparing'):'');
  }
  function put(kind,items){
   lists[kind].replaceChildren(...items);
   lists[kind].setAttribute('aria-busy','false');
  }
  function matchItems(rows){
   return rows.flatMap(f=>{
    const home=teams.get(f.homeClubId),away=teams.get(f.awayClubId);
    if(!home||!away)return [];
    const li=document.createElement('li'),a=document.createElement('a');
    a.href=window.faAppHref?.('/matches/'+f.matchId)??'/matches/'+f.matchId;
    const name=document.createElement('span');name.className='fa-dashboard-names';name.textContent=home.primaryName+' – '+away.primaryName;
    const detail=document.createElement('strong');detail.textContent=f.status==='completed'?f.result.homeGoals+' – '+f.result.awayGoals:t('gameDay')+' '+f.day;
    a.append(name,detail);a.setAttribute('aria-label',name.textContent+', '+detail.textContent);
    li.append(a);return [li];
   });
  }
  function events(){
   if(!world?.seasonNumber){put('events',[]);write('note','events',t('noSeasonEvents'));return}
   const entries=window.faWorldCalendarModel.createSeason(world.seasonNumber).days
    .filter(d=>d.day>=Math.max(1,world.day)&&d.events.length).slice(0,3);
   put('events',entries.map(d=>{
    const li=document.createElement('li'),a=document.createElement('a');
    const href='/calendar?season='+world.seasonNumber+'&calendarView=week&week='+Math.ceil(d.day/7);
    a.href=window.faAppHref?.(href)??href;
    const name=document.createElement('span');name.className='fa-dashboard-names';
    name.textContent=d.events.map(e=>e.marker==='FEDERATION-FINAL'?t('federationFinal'):e.marker==='SOVEREIGN-FINAL'?t('sovereignFinal'):(e.family==='national'?t('national'):t('internationalRound'))+(e.round?' '+e.round:'')).join(' · ');
    const day=document.createElement('small');day.textContent=t('gameDay')+' '+d.day;
    a.append(name,day);li.append(a);return li;
   }));
   write('note','events',entries.length?'':t('noEvents'));
  }
  function show(){
   if(!world||!verified)return;
   const selected=pickDashboardMatches(verified.days,world.day);
   put('recent',matchItems(selected.recent));put('next',matchItems(selected.next));
   write('note','recent',verified.incomplete?t('missing'):selected.recent.length?'':t('noRecent'));
   write('note','next',verified.incomplete?t('missing'):selected.next.length?'':t('noNext'));
   lookup('retry','').hidden=!verified.failed;
   events();
  }
  async function load(w){
   const nextKey=[w.generation,w.revision,w.seasonNumber,w.day,w.phase].join('/');
   if(key===nextKey)return;
   stop();key=nextKey;world=w;verified=null;blank();events();
   if(!w.seasonNumber){
    put('recent',[]);put('next',[]);
    write('note','recent',t('unstarted'));write('note','next',t('unstarted'));return;
   }
   const days=chooseDashboardDays(window.faWorldCalendarModel.createSeason(w.seasonNumber).days,w.day);
   if(!days.length){verified={days:[],failed:false,incomplete:false};show();return}
   const ticket=epoch,requestController=new AbortController();controller=requestController;
   const timeout=setTimeout(()=>requestController.abort(),8000);
   try{
    const responses=await Promise.all(days.map(async day=>{
     try{
      const response=await fetch('/api/matches?season='+w.seasonNumber+'&day='+day,
        {signal:requestController.signal,credentials:'omit',cache:'no-store'});
      if(response.status===409)throw Error('stale');
      if(!response.ok)throw Error('unavailable');
      const data=await response.json();
      if(!sameWorld(data?.world,w))throw Error('stale');
      if(!validDashboardDirectory(data,w,w.seasonNumber,day))throw Error('invalid');
      return {day,publication:data.publication,fixtures:data.fixtures};
     }catch(err){return {day,error:err.message==='stale'?'stale':'unavailable'}}
    }));
    if(ticket!==epoch||!sameWorld(state?.get?.().world,w))return;
    if(responses.some(d=>d.error==='stale')){dispatchEvent(new Event('fa:world-invalidated'));return}
    verified={days:responses,failed:responses.some(d=>!!d.error),
      incomplete:responses.some(d=>!!d.error||['partial','unpublished','unavailable'].includes(d.publication))};
    show();
   }finally{clearTimeout(timeout)}
  }
  function update(snapshot){
   localize();
   if(snapshot?.source==='dev'){
    stop();blank();world=null;clock({seasonNumber:snapshot.current?.season??0,day:snapshot.current?.day??0,phase:'debug'},true);
    put('recent',[]);put('next',[]);write('note','recent',t('debug'));write('note','next',t('debug'));events();return;
   }
   if(snapshot?.worldStatus!=='ready'||!window.faWorldClockAdapter.validPublicWorld(snapshot.world)){
    stop();blank();world=null;
    if(snapshot?.worldStatus==='unavailable'){
     clock(null);put('recent',[]);put('next',[]);write('note','recent',t('unavailable'));write('note','next',t('unavailable'));events();
    }else write('note','world',t('loading'));
    return;
   }
   const w=snapshot.world;
   clock(w);const currentKey=[w.generation,w.revision,w.seasonNumber,w.day,w.phase].join('/');
   if(currentKey!==key)void load(w);
   else if(verified)show();
   else events();
  }
  function invalidated(){stop();blank();write('note','world',t('loading'))}
  root.querySelector('[data-dash-retry]').addEventListener('click',()=>{key='';update(state?.get?.())});
  new MutationObserver(()=>update(state?.get?.())).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  addEventListener('fa:world-invalidated',invalidated);
  addEventListener('fa:source-change',invalidated);
  addEventListener('pageshow',e=>{if(e.persisted)invalidated()});
  if(state?.subscribe){state.subscribe(update);update(state.get())}else update(null);
 }
}
