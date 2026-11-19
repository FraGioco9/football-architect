/* Club records from verified season totals, ordered fixtures and frozen player appearances. */
((root,factory)=>{
 const ui=factory();root.faClubRecords=ui;
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const words={
  en:{fewest:'Fewest league goals conceded',streak:'Longest unbeaten run',largest:'Biggest win',played:'Matches played',totalWins:'Total wins',totalClean:'Total clean sheets',combined:'Goals + assists',playerClean:'Clean sheets',details:'Record details',allTime:'All time',team:'Team records',player:'Player records',appearances:'Most appearances',playerGoals:'Most goals',assists:'Most assists',season:'Season',verified:'Verified seasons',choose:'Select season',metric:'Record',value:'Value',source:'Season / Competition',rank:'Best league finish',wins:'Most wins',goals:'Most goals in a season',totalGoals:'Total goals scored',clean:'Most clean sheets',gd:'Best goal difference',closed:'Only completed and officially verified seasons are compared.',coverage:'Verified coverage',noMatches:'No matches played.',noArchive:'No verified completed seasons yet.',unavailable:'Verified club records are unavailable.'},
  de:{fewest:'Wenigste Gegentore in der Liga',streak:'Längste Serie ohne Niederlage',largest:'Höchster Sieg',played:'Gespielte Spiele',totalWins:'Siege insgesamt',totalClean:'Spiele ohne Gegentor insgesamt',combined:'Tore + Vorlagen',playerClean:'Spiele ohne Gegentor',details:'Rekorddetails',allTime:'Gesamtzeit',team:'Mannschaftsrekorde',player:'Spielerrekorde',appearances:'Meiste Einsätze',playerGoals:'Meiste Tore',assists:'Meiste Vorlagen',season:'Saison',verified:'Verifizierte Saisons',choose:'Saison wählen',metric:'Rekord',value:'Wert',source:'Saison / Wettbewerb',rank:'Beste Ligaplatzierung',wins:'Meiste Siege',goals:'Meiste Tore in einer Saison',totalGoals:'Tore insgesamt',clean:'Meiste Spiele ohne Gegentor',gd:'Beste Tordifferenz',closed:'Nur abgeschlossene und offiziell verifizierte Saisons werden verglichen.',coverage:'Verifizierter Zeitraum',noMatches:'Noch keine Spiele gespielt.',noArchive:'Noch keine verifizierte abgeschlossene Saison.',unavailable:'Verifizierte Vereinsrekorde sind nicht verfügbar.'},
  es:{fewest:'Menos goles encajados en liga',streak:'Mayor racha invicta',largest:'Mayor victoria',played:'Partidos jugados',totalWins:'Victorias totales',totalClean:'Porterías a cero totales',combined:'Goles + asistencias',playerClean:'Porterías a cero',details:'Detalles del récord',allTime:'Histórico',team:'Récords del equipo',player:'Récords de jugadores',appearances:'Más apariciones',playerGoals:'Más goles',assists:'Más asistencias',season:'Temporada',verified:'Temporadas verificadas',choose:'Elegir temporada',metric:'Récord',value:'Valor',source:'Temporada / Competición',rank:'Mejor posición en liga',wins:'Más victorias',goals:'Más goles en una temporada',totalGoals:'Goles totales',clean:'Más porterías a cero',gd:'Mejor diferencia de goles',closed:'Solo se comparan temporadas completas y verificadas oficialmente.',coverage:'Cobertura verificada',noMatches:'No se han jugado partidos.',noArchive:'Todavía no hay temporadas completas verificadas.',unavailable:'Los récords verificados del club no están disponibles.'},
  fr:{fewest:'Moins de buts encaissés en championnat',streak:'Plus longue série sans défaite',largest:'Plus large victoire',played:'Matchs joués',totalWins:'Total de victoires',totalClean:'Total de matchs sans encaisser',combined:'Buts + passes décisives',playerClean:'Matchs sans encaisser',details:'Détails du record',allTime:'Toutes saisons',team:'Records d’équipe',player:'Records des joueurs',appearances:'Plus de matchs joués',playerGoals:'Plus de buts',assists:'Plus de passes décisives',season:'Saison',verified:'Saisons vérifiées',choose:'Choisir la saison',metric:'Record',value:'Valeur',source:'Saison / Compétition',rank:'Meilleur classement en championnat',wins:'Plus de victoires',goals:'Plus de buts en une saison',totalGoals:'Total de buts marqués',clean:'Plus de matchs sans encaisser',gd:'Meilleure différence de buts',closed:'Seules les saisons terminées et officiellement vérifiées sont comparées.',coverage:'Période vérifiée',noMatches:'Aucun match joué.',noArchive:'Aucune saison terminée et vérifiée pour le moment.',unavailable:'Les records vérifiés du club ne sont pas disponibles.'},
  it:{fewest:'Meno gol subiti in campionato',streak:'Serie di imbattibilità più lunga',largest:'Vittoria più larga',played:'Partite giocate',totalWins:'Vittorie totali',totalClean:'Clean sheet totali',combined:'Gol + assist',playerClean:'Clean sheet',details:'Dettagli del record',allTime:'Di sempre',team:'Record di squadra',player:'Record dei giocatori',appearances:'Più presenze',playerGoals:'Più gol',assists:'Più assist',season:'Stagione',verified:'Stagioni verificate',choose:'Seleziona stagione',metric:'Record',value:'Valore',source:'Stagione / Competizione',rank:'Miglior piazzamento in campionato',wins:'Più vittorie',goals:'Più gol in una stagione',totalGoals:'Gol totali segnati',clean:'Più clean sheet',gd:'Migliore differenza reti',closed:'Si confrontano soltanto le stagioni concluse e verificate ufficialmente.',coverage:'Copertura verificata',noMatches:'Nessuna partita giocata.',noArchive:'Nessuna stagione conclusa e verificata.',unavailable:'I record verificati del club non sono disponibili.'}
 };
 const seasonKeys=['wins','goals','fewest','clean','gd','streak'];
 const careerKeys=['rank','largest','played','totalWins','totalGoals','totalClean'];
 const playerKeys=['appearances','playerGoals','assists','combined','playerClean'];
 function best(key,rows,min=false){
  const eligible=rows.filter(r=>Number.isSafeInteger(r.value));
  if(!eligible.length)return {key,value:null,sources:[]};
  const value=(min?Math.min:Math.max)(...eligible.map(r=>r.value));
  return {key,value,sources:eligible.filter(r=>r.value===value)};
 }
 function select(seasons,scope){
  const career=scope==='verified';
  const rows=seasons.map(s=>{
   const played=s.memberships.filter(m=>m.stats?.played>0);
   const sum=field=>played.reduce((n,m)=>n+m.stats[field],0);
   const league=played.find(m=>m.category==='domestic');
   let streak=0,run=0;
   for(const match of s.matches||[]){
    run=match.scored>=match.conceded?run+1:0;streak=Math.max(streak,run);
   }
   return {...s,played:sum('played'),wins:sum('won'),goals:sum('goalsFor'),clean:sum('cleanSheets'),
    gd:sum('goalDifference'),league,fewest:s.ongoing===false?league?.leagueGoalsAgainst:null,streak:s.matches?streak:null};
  }).filter(s=>s.played>0);
  const seasonBest=(key,min=false)=>best(key,rows.map(s=>({season:s.season,value:s[key]})),min);
  const total=(key,field)=>({key,value:rows.reduce((n,s)=>n+s[field],0),sources:[]});
  const leagues=rows.filter(s=>s.ongoing===false&&s.league?.position);
  const tier=Math.min(...leagues.map(s=>Number(s.league.competitionId.split('-')[1])));
  const rank=best('rank',leagues.filter(s=>Number(s.league.competitionId.split('-')[1])===tier)
   .map(s=>({value:s.league.position,division:s.league.competitionId,season:s.season})),true);
  const matchesComplete=rows.every(s=>Array.isArray(s.matches));
  const wins=matchesComplete?rows.flatMap(s=>s.matches.filter(m=>m.scored>m.conceded)
   .map(m=>({...m,value:m.scored-m.conceded,season:s.season}))):[];
  const records=career?[rank,best('largest',wins),total('played','played'),total('totalWins','wins'),
   total('totalGoals','goals'),total('totalClean','clean')]:
   [seasonBest('wins'),seasonBest('goals'),seasonBest('fewest',true),seasonBest('clean'),seasonBest('gd'),
    matchesComplete?seasonBest('streak'):best('streak',[])];
  const complete=rows.every(s=>Array.isArray(s.players));
  const appearances=complete?rows.flatMap(s=>s.players.map(p=>({...p,season:s.season}))):[];
  const players=playerKeys.map(key=>{
   const candidates=[],totals=new Map();
   if((key==='assists'||key==='combined')&&appearances.some(p=>p.assists===null))return best(key,[]);
   for(const p of appearances){
    const value={appearances:p.appearances,playerGoals:p.goals,assists:p.assists,
     combined:p.assists===null?null:p.goals+p.assists,playerClean:p.clean}[key];
    if(!Number.isSafeInteger(value)||value<=0)continue;
    if(!career)candidates.push({id:p.id,name:p.name,season:p.season,value});
    else{
     const prior=totals.get(p.id);
     totals.set(p.id,{id:p.id,name:p.name||prior?.name,value:value+(prior?.value||0)});
    }
   }
   return best(key,career?[...totals.values()]:candidates);
  });
  return {records,players};
 }
 function playerHolders(sources,clubId){
  const holders=new Map();
  for(const source of sources){
   let holder=holders.get(source.id);
   if(!holder){
    holder={id:source.id,name:source.name||'#'+source.id,clubs:[]};
    holders.set(source.id,holder);
   }
   holder.clubs.push({clubId,season:source.season});
  }
  return [...holders.values()];
 }
 function render({selected,historySnapshot,language='en',search='',ordinal,index}){
  const w=words[language]||words.en,clubKey=selected.countryId+'-'+selected.clubId;
  const params=new URLSearchParams(search),scope=['verified','all-time'].includes(params.get('scope'))?'verified':'season';
  const valid=historySnapshot?.source==='authoritative'&&historySnapshot.clubKey===clubKey&&
   ['complete','empty'].includes(historySnapshot.coverage)&&Array.isArray(historySnapshot.seasons)&&
   Number.isInteger(historySnapshot.world?.seasonNumber)&&historySnapshot.world.seasonNumber<=2;
  const unavailable=historySnapshot?.source==='unavailable'||historySnapshot?.source==='dev';
  const label=key=>'<span data-record-label="'+key+'">'+escape(w[key])+'</span>';
  const controls='<div class="app-history-record-controls">'+[['season','season'],['verified','allTime']].map(([id,key])=>
   '<button type="button" data-record-scope="'+id+'" aria-pressed="'+(scope===id)+'">'+label(key)+'</button>'
  ).join('')+'</div>';
  const loading=!valid&&!unavailable;
  const data=select(valid?historySnapshot.seasons:[],scope);
  const note=unavailable?w.unavailable:valid&&historySnapshot.coverage==='empty'?w.noMatches:'';
  function context(source){
   const details=[];
   if(source.id)details.push('<a href="/players/'+Number(source.id)+'">'+escape(source.name||'#'+source.id)+'</a>');
   if(source.division)details.push(escape(index?.divisions.get(source.division)?.name||source.division));
   if(source.opponent)details.push(escape(index?.clubs.get(source.opponent)?.primaryName||source.opponent));
   if(source.season)details.push(escape(w.season+' '+source.season));
   return details.join(' · ');
  }
  function card({key,value,sources}){
   const first=sources[0];
   let amount='—';
   if(loading)amount='<span class="app-skeleton-bar"></span>';
   else if(valid&&value!==null){
    if(key==='rank')amount=ordinal(value,language);
    else if(key==='largest')amount=first.scored+'–'+first.conceded;
    else amount=escape(key==='gd'&&value>0?'+'+value:value);
   }
   const more=sources.length>1?'<details class="club-record-ties"><summary aria-label="'+escape(w.details)+'">+'+(sources.length-1)+'</summary>'+
    sources.slice(1).map(s=>'<div>'+(key==='largest'?s.scored+'–'+s.conceded+' · ':'')+context(s)+'</div>').join('')+'</details>':'';
   return '<article class="app-competition-stat-card"><h5 class="app-competition-stat-label">'+label(key)+'</h5>'+
    '<strong class="app-competition-stat-value">'+amount+'</strong>'+(first?'<div class="club-records-sources"><span>'+context(first)+'</span>'+more+'</div>':'')+'</article>';
  }
  function playerCard({key,value,sources}){
   const holders=playerHolders(sources,clubKey),first=holders[0];
   const count=first?(holders.length>1?holders.length-1:first.clubs.length-1):0;
   const extra=count?'<button type="button" class="app-history-player-detail" aria-haspopup="dialog" data-club-record-detail="'+key+
    '" aria-label="'+escape(w.details)+' (+'+count+')">+'+count+'</button>':'';
   const name=first?'<a class="app-history-player-name app-world-standing-club-link" href="/players/'+first.id+'">'+escape(first.name)+'</a>':'';
   const club=index?.clubs.get(clubKey)?.primaryName||clubKey;
   const subtitle=first?'<a class="app-world-standing-club-link" href="'+escape(selected.base)+'/overview">'+escape(club)+'</a>':'';
   const season=first?.clubs[0].season;
   const slot='<span class="fa-dev-stats-player-portrait" aria-hidden="true"'+(first?' data-club-record-portrait="'+first.id+'"':'')+'></span>';
   const bar='<span class="app-skeleton-bar"></span>';
   return '<article class="app-competition-stat-card" data-club-player-card><h5 class="app-competition-stat-label">'+label(key)+'</h5>'+
    '<strong class="app-competition-stat-value">'+(loading?bar:value??'—')+'</strong>'+
    '<div class="app-history-player-footer"'+(!loading&&!first?' hidden':'')+'>'+slot+'<div class="app-history-player-labels">'+
    '<div class="app-history-player-name-row">'+(loading?bar:name+extra)+'</div>'+
    '<div class="app-history-player-context">'+(loading?bar:subtitle)+'</div></div>'+
    (season?'<span class="app-history-season">'+escape(w.season+' '+season)+'</span>':'')+'</div></article>';
  }
  function group(key,cards,message=''){
   return '<section class="app-history-record-group"><h4>'+label(key)+'</h4>'+
    '<div class="app-competition-stat-grid">'+cards+'</div>'+(message?'<p class="club-records-note" role="status">'+escape(message)+'</p>':'')+'</section>';
  }
  return '<section class="club-records" aria-busy="'+loading+'">'+controls+
   group('team',data.records.map(card).join(''),note)+
   group('player',data.players.map(playerCard).join(''))+'</section>';
 }
 return Object.freeze({words,seasonKeys,careerKeys,select,playerHolders,render});
});