/* CLUB-RECORDS-01: small, source-fenced team records derived from the shared Club History read. */
((root,factory)=>{
 const routes=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./routes-registry.js'):root.faRoutesRegistry;
 const ui=factory(routes);root.faClubRecords=ui;
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
})(typeof window!=='undefined'?window:globalThis,(routes)=>{
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const words={
  en:{allTime:'All time',team:'Team records',player:'Player records',appearances:'Most appearances',playerGoals:'Most goals',assists:'Most assists',playerUnavailable:'Player records unavailable.',season:'Season',verified:'Verified seasons',choose:'Select season',metric:'Record',value:'Value',source:'Season / Competition',rank:'Best league finish',wins:'Most wins',goals:'Most goals scored',clean:'Most clean sheets',gd:'Best goal difference',partial:'Ongoing season: figures may change and are not historical records.',closed:'Only completed and officially verified seasons are compared.',coverage:'Verified coverage',noMatches:'No matches played.',noArchive:'No verified completed seasons yet.',unavailable:'Verified club records are unavailable.'},
  de:{allTime:'Gesamtzeit',team:'Mannschaftsrekorde',player:'Spielerrekorde',appearances:'Meiste Einsätze',playerGoals:'Meiste Tore',assists:'Meiste Vorlagen',playerUnavailable:'Spielerrekorde nicht verfügbar.',season:'Saison',verified:'Verifizierte Saisons',choose:'Saison wählen',metric:'Rekord',value:'Wert',source:'Saison / Wettbewerb',rank:'Beste Ligaplatzierung',wins:'Meiste Siege',goals:'Meiste Tore',clean:'Meiste Spiele ohne Gegentor',gd:'Beste Tordifferenz',partial:'Laufende Saison: Diese Werte können sich ändern und sind keine historischen Rekorde.',closed:'Nur abgeschlossene und offiziell verifizierte Saisons werden verglichen.',coverage:'Verifizierter Zeitraum',noMatches:'Noch keine Spiele gespielt.',noArchive:'Noch keine verifizierte abgeschlossene Saison.',unavailable:'Verifizierte Vereinsrekorde sind nicht verfügbar.'},
  es:{allTime:'Histórico',team:'Récords del equipo',player:'Récords de jugadores',appearances:'Más apariciones',playerGoals:'Más goles',assists:'Más asistencias',playerUnavailable:'Récords de jugadores no disponibles.',season:'Temporada',verified:'Temporadas verificadas',choose:'Elegir temporada',metric:'Récord',value:'Valor',source:'Temporada / Competición',rank:'Mejor posición en liga',wins:'Más victorias',goals:'Más goles marcados',clean:'Más porterías a cero',gd:'Mejor diferencia de goles',partial:'Temporada en curso: las cifras pueden cambiar y no son récords históricos.',closed:'Solo se comparan temporadas completas y verificadas oficialmente.',coverage:'Cobertura verificada',noMatches:'No se han jugado partidos.',noArchive:'Todavía no hay temporadas completas verificadas.',unavailable:'Los récords verificados del club no están disponibles.'},
  fr:{allTime:'Toutes saisons',team:'Records d’équipe',player:'Records des joueurs',appearances:'Plus de matchs joués',playerGoals:'Plus de buts',assists:'Plus de passes décisives',playerUnavailable:'Records des joueurs indisponibles.',season:'Saison',verified:'Saisons vérifiées',choose:'Choisir la saison',metric:'Record',value:'Valeur',source:'Saison / Compétition',rank:'Meilleur classement en championnat',wins:'Plus de victoires',goals:'Plus de buts marqués',clean:'Plus de matchs sans encaisser',gd:'Meilleure différence de buts',partial:'Saison en cours : ces données peuvent changer et ne sont pas des records historiques.',closed:'Seules les saisons terminées et officiellement vérifiées sont comparées.',coverage:'Période vérifiée',noMatches:'Aucun match joué.',noArchive:'Aucune saison terminée et vérifiée pour le moment.',unavailable:'Les records vérifiés du club ne sont pas disponibles.'},
  it:{allTime:'Di sempre',team:'Record di squadra',player:'Record dei giocatori',appearances:'Più presenze',playerGoals:'Più gol',assists:'Più assist',playerUnavailable:'Record dei giocatori non disponibili.',season:'Stagione',verified:'Stagioni verificate',choose:'Seleziona stagione',metric:'Record',value:'Valore',source:'Stagione / Competizione',rank:'Miglior piazzamento in campionato',wins:'Più vittorie',goals:'Più gol segnati',clean:'Più clean sheet',gd:'Migliore differenza reti',partial:'Stagione in corso: i valori possono cambiare e non sono record storici.',closed:'Si confrontano soltanto le stagioni concluse e verificate ufficialmente.',coverage:'Copertura verificata',noMatches:'Nessuna partita giocata.',noArchive:'Nessuna stagione conclusa e verificata.',unavailable:'I record verificati del club non sono disponibili.'}
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
  const aggregates=selected.map(s=>{
   const played=(s.memberships||[]).filter(m=>m.stats?.played>0);
   const league=played.find(m=>m.category==='domestic'&&Number.isSafeInteger(m.position)&&m.position>=1);
   const totals={won:0,goalsFor:0,cleanSheets:0,goalDifference:0};
   for(const m of played)for(const key of Object.keys(totals))totals[key]+=m.stats[key];
   return {season:s.season,played,league,position:league?.position??null,...totals};
  }).filter(s=>s.played.length>0);
  const entries=aggregates.flatMap(s=>s.played.map(m=>({season:s.season,m})));
  // League finish belongs to the domestic competition; other records are
  // whole-season totals across every recorded competition, never per-cup maxima.
  const records=metrics.map(metric=>{
   const relevant=aggregates.filter(s=>Number.isSafeInteger(s[metric.field])&&
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
 function render({selected,historySnapshot,language='en',search='',divisions=[]}){
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
   if(scope==='verified')note=data.selected.length?w.coverage+': '+data.selected.map(s=>w.season+' '+s.season).join(', ')+'. '+w.closed:w.noArchive;
   else if(data.selected[0]?.ongoing)note=w.partial;
   if(!data.entries.length&&(scope==='season'||data.selected.length))note=[note,w.noMatches].filter(Boolean).join(' ');
  }
  const names=new Map(divisions.map(d=>[d.id,d.name]));
  function card({key,value=null,sources=[]}){
   const amount=loading?'<span class="app-skeleton-bar"></span>':value===null?'—':escape(key==='gd'&&value>0?'+'+value:value);
   const links=sources.map(({season:year,m})=>{
    const href=routes.buildRoute({kind:m.category==='domestic'?'competition':'cup',id:m.competitionId.toLowerCase(),view:'standings'})+'?season='+year;
    return '<a class="club-records-source-link" href="'+escape(href)+'">'+escape(w.season+' '+year+' · '+(names.get(m.competitionId)||m.name))+'</a>';
   }).join('');
   return '<article class="app-competition-stat-card"><h5 class="app-competition-stat-label">'+label(key)+'</h5>'+
    '<strong class="app-competition-stat-value">'+amount+'</strong>'+(links?'<div class="club-records-sources">'+links+'</div>':'')+'</article>';
  }
  function group(key,cards,message){
   return '<section class="app-history-record-group"><h4>'+label(key)+'</h4>'+
    '<div class="app-competition-stat-grid">'+cards+'</div><p class="club-records-note" role="status">'+escape(message)+'</p></section>';
  }
  return '<section class="club-records" aria-busy="'+loading+'">'+controls+seasonNav+
   group('team',data.records.map(card).join(''),note)+
   group('player',['appearances','playerGoals','assists'].map(key=>card({key})).join(''),loading?'':w.playerUnavailable)+'</section>';
 }
 return Object.freeze({words,metrics,select,render});
});