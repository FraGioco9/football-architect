/* CLUB-RECORDS-01: small, source-fenced team records derived from the shared Club History read. */
((root,factory)=>{
 const ui=factory();root.faClubRecords=ui;
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const words={
  en:{allTime:'All time',team:'Team records',player:'Player records',appearances:'Most appearances',playerGoals:'Most goals',assists:'Most assists',season:'Season',verified:'Verified seasons',choose:'Select season',metric:'Record',value:'Value',source:'Season / Competition',rank:'Best league finish',wins:'Most wins',goals:'Most goals in a season',totalGoals:'Total goals scored',clean:'Most clean sheets',gd:'Best goal difference',closed:'Only completed and officially verified seasons are compared.',coverage:'Verified coverage',noMatches:'No matches played.',noArchive:'No verified completed seasons yet.',unavailable:'Verified club records are unavailable.'},
  de:{allTime:'Gesamtzeit',team:'Mannschaftsrekorde',player:'Spielerrekorde',appearances:'Meiste Einsätze',playerGoals:'Meiste Tore',assists:'Meiste Vorlagen',season:'Saison',verified:'Verifizierte Saisons',choose:'Saison wählen',metric:'Rekord',value:'Wert',source:'Saison / Wettbewerb',rank:'Beste Ligaplatzierung',wins:'Meiste Siege',goals:'Meiste Tore in einer Saison',totalGoals:'Tore insgesamt',clean:'Meiste Spiele ohne Gegentor',gd:'Beste Tordifferenz',closed:'Nur abgeschlossene und offiziell verifizierte Saisons werden verglichen.',coverage:'Verifizierter Zeitraum',noMatches:'Noch keine Spiele gespielt.',noArchive:'Noch keine verifizierte abgeschlossene Saison.',unavailable:'Verifizierte Vereinsrekorde sind nicht verfügbar.'},
  es:{allTime:'Histórico',team:'Récords del equipo',player:'Récords de jugadores',appearances:'Más apariciones',playerGoals:'Más goles',assists:'Más asistencias',season:'Temporada',verified:'Temporadas verificadas',choose:'Elegir temporada',metric:'Récord',value:'Valor',source:'Temporada / Competición',rank:'Mejor posición en liga',wins:'Más victorias',goals:'Más goles en una temporada',totalGoals:'Goles totales',clean:'Más porterías a cero',gd:'Mejor diferencia de goles',closed:'Solo se comparan temporadas completas y verificadas oficialmente.',coverage:'Cobertura verificada',noMatches:'No se han jugado partidos.',noArchive:'Todavía no hay temporadas completas verificadas.',unavailable:'Los récords verificados del club no están disponibles.'},
  fr:{allTime:'Toutes saisons',team:'Records d’équipe',player:'Records des joueurs',appearances:'Plus de matchs joués',playerGoals:'Plus de buts',assists:'Plus de passes décisives',season:'Saison',verified:'Saisons vérifiées',choose:'Choisir la saison',metric:'Record',value:'Valeur',source:'Saison / Compétition',rank:'Meilleur classement en championnat',wins:'Plus de victoires',goals:'Plus de buts en une saison',totalGoals:'Total de buts marqués',clean:'Plus de matchs sans encaisser',gd:'Meilleure différence de buts',closed:'Seules les saisons terminées et officiellement vérifiées sont comparées.',coverage:'Période vérifiée',noMatches:'Aucun match joué.',noArchive:'Aucune saison terminée et vérifiée pour le moment.',unavailable:'Les records vérifiés du club ne sont pas disponibles.'},
  it:{allTime:'Di sempre',team:'Record di squadra',player:'Record dei giocatori',appearances:'Più presenze',playerGoals:'Più gol',assists:'Più assist',season:'Stagione',verified:'Stagioni verificate',choose:'Seleziona stagione',metric:'Record',value:'Valore',source:'Stagione / Competizione',rank:'Miglior piazzamento in campionato',wins:'Più vittorie',goals:'Più gol in una stagione',totalGoals:'Gol totali segnati',clean:'Più clean sheet',gd:'Migliore differenza reti',closed:'Si confrontano soltanto le stagioni concluse e verificate ufficialmente.',coverage:'Copertura verificata',noMatches:'Nessuna partita giocata.',noArchive:'Nessuna stagione conclusa e verificata.',unavailable:'I record verificati del club non sono disponibili.'}
 };
 const metrics=[
  {key:'rank',field:'position',min:true,domestic:true},
  {key:'wins',field:'won'},
  {key:'goals',field:'goalsFor'},
  {key:'clean',field:'cleanSheets'},
  {key:'gd',field:'goalDifference'}
 ];
 function select(seasons,scope,season){
  const selected=scope==='verified'?seasons.filter(s=>s.ongoing===false):seasons.filter(s=>s.season===season);
  const aggregates=seasons.map(s=>{
   const played=(s.memberships||[]).filter(m=>m.stats?.played>0);
   const league=played.find(m=>m.category==='domestic'&&Number.isSafeInteger(m.position)&&m.position>=1);
   const totals={won:0,goalsFor:0,cleanSheets:0,goalDifference:0};
   for(const m of played)for(const key of Object.keys(totals))totals[key]+=m.stats[key];
   return {season:s.season,ongoing:s.ongoing,played,league,position:league?.position??null,...totals};
  }).filter(s=>s.played.length>0);
  const scoped=aggregates.filter(s=>scope==='verified'?s.ongoing===false:s.season===season);
  const entries=scoped.flatMap(s=>s.played.map(m=>({season:s.season,m})));
  // League finish belongs to the domestic competition; other records are
  // whole-season totals across every recorded competition, never per-cup maxima.
  const records=metrics.map(metric=>{
   if(metric.key==='goals'&&scope==='verified'){
    return {key:'totalGoals',value:aggregates.reduce((total,s)=>total+s.goalsFor,0),sources:[]};
   }
   const candidates=metric.key==='goals'?aggregates:scoped;
   const relevant=candidates.filter(s=>Number.isSafeInteger(s[metric.field])&&
    (metric.field!=='position'||s.position>=1));
   if(!relevant.length)return {key:metric.key,value:null,sources:[]};
   const value=metric.min?Math.min(...relevant.map(s=>s[metric.field])):
    Math.max(...relevant.map(s=>s[metric.field]));
   const sources=relevant.filter(s=>s[metric.field]===value).flatMap(s=>
    (metric.domestic?[s.league]:s.played).filter(Boolean).map(m=>({season:s.season,m})));
   return {key:metric.key,value,sources};
  });
  return {selected,entries,records};
 }
 function render({selected,historySnapshot,language='en',search='',ordinal}){
  const w=words[language]||words.en,clubKey=selected.countryId+'-'+selected.clubId,base=selected.base+'/records';
  const params=new URLSearchParams(search),scope=['verified','all-time'].includes(params.get('scope'))?'verified':'season';
  const valid=historySnapshot?.source==='authoritative'&&historySnapshot.clubKey===clubKey&&
   ['complete','empty'].includes(historySnapshot.coverage)&&Array.isArray(historySnapshot.seasons)&&
   Number.isInteger(historySnapshot.world?.seasonNumber)&&historySnapshot.world.seasonNumber<=2;
  const unavailable=historySnapshot?.source==='unavailable'||historySnapshot?.source==='dev';
  const current=valid?historySnapshot.world.seasonNumber:0;
  const raw=params.get('season'),requested=/^[1-9]\d{0,8}$/.test(raw||'')?Number(raw):null;
  const season=current===0?0:requested!==null&&requested<=current?requested:current;
  const label=key=>'<span data-record-label="'+key+'">'+escape(w[key])+'</span>';
  const controls='<div class="app-history-record-controls">'+[['season','season'],['verified','allTime']].map(([id,key])=>
   '<button type="button" data-record-scope="'+id+'" aria-pressed="'+(scope===id)+'">'+label(key)+'</button>'
  ).join('')+'</div>';
  const seasonNav=scope==='season'&&current>1?'<nav class="club-records-season-nav" aria-label="'+escape(w.choose)+'">'+
   Array.from({length:current},(_,i)=>i+1).map(n=>'<a class="club-records-season-link" href="'+base+
    (n===current?'':'?season='+n)+'"'+(n===season?' aria-current="page"':'')+'>'+escape(w.season+' '+n)+'</a>').join('')+'</nav>':'';
  const loading=!valid&&!unavailable;
  const data=select(valid?historySnapshot.seasons:[],scope,season);
  let note='';
  if(unavailable)note=w.unavailable;
  else if(valid){
   if(scope==='verified'&&historySnapshot.seasons.length)note=w.coverage+': '+historySnapshot.seasons.map(s=>w.season+' '+s.season).join(', ');
   if(historySnapshot.coverage==='empty'||(!data.entries.length&&scope==='season'&&data.records.every(record=>record.value===null)))note=[note,w.noMatches].filter(Boolean).join(' ');
  }
  function card({key,value=null,sources=[]}){
   const amount=loading?'<span class="app-skeleton-bar"></span>':!valid||value===null?'—':key==='rank'?ordinal(value,language):escape(key==='gd'&&value>0?'+'+value:value);
   const seasons=[...new Set(sources.map(source=>source.season))].map(year=>'<span>'+escape(w.season+' '+year)+'</span>').join('');
   return '<article class="app-competition-stat-card"><h5 class="app-competition-stat-label">'+label(key)+'</h5>'+
    '<strong class="app-competition-stat-value">'+amount+'</strong>'+(seasons?'<div class="club-records-sources">'+seasons+'</div>':'')+'</article>';
  }
  function group(key,cards,message=''){
   return '<section class="app-history-record-group"><h4>'+label(key)+'</h4>'+
    '<div class="app-competition-stat-grid">'+cards+'</div>'+(message?'<p class="club-records-note" role="status">'+escape(message)+'</p>':'')+'</section>';
  }
  return '<section class="club-records" aria-busy="'+loading+'">'+controls+seasonNav+
   group('team',data.records.map(card).join(''),note)+
   group('player',['appearances','playerGoals','assists'].map(key=>card({key})).join(''))+'</section>';
 }
 return Object.freeze({words,metrics,select,render});
});