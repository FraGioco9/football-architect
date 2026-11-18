/* CLUB-RECORDS-01: small, source-fenced team records derived from the shared Club History read. */
((root,factory)=>{
 const routes=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./routes-registry.js'):root.faRoutesRegistry;
 const ui=factory(routes);root.faClubRecords=ui;
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
})(typeof window!=='undefined'?window:globalThis,(routes)=>{
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const words={
  en:{season:'Season',verified:'Verified seasons',choose:'Select season',metric:'Record',value:'Value',source:'Season / Competition',rank:'Best league finish',wins:'Most wins',goals:'Most goals scored',clean:'Most clean sheets',gd:'Best goal difference',partial:'Ongoing season: figures may change and are not historical records.',closed:'Only completed and officially verified seasons are compared.',coverage:'Verified coverage',noMatches:'No matches played.',noArchive:'No verified completed seasons yet.',unavailable:'Verified club records are unavailable.'},
  de:{season:'Saison',verified:'Verifizierte Saisons',choose:'Saison wählen',metric:'Rekord',value:'Wert',source:'Saison / Wettbewerb',rank:'Beste Ligaplatzierung',wins:'Meiste Siege',goals:'Meiste Tore',clean:'Meiste Spiele ohne Gegentor',gd:'Beste Tordifferenz',partial:'Laufende Saison: Diese Werte können sich ändern und sind keine historischen Rekorde.',closed:'Nur abgeschlossene und offiziell verifizierte Saisons werden verglichen.',coverage:'Verifizierter Zeitraum',noMatches:'Noch keine Spiele gespielt.',noArchive:'Noch keine verifizierte abgeschlossene Saison.',unavailable:'Verifizierte Vereinsrekorde sind nicht verfügbar.'},
  es:{season:'Temporada',verified:'Temporadas verificadas',choose:'Elegir temporada',metric:'Récord',value:'Valor',source:'Temporada / Competición',rank:'Mejor posición en liga',wins:'Más victorias',goals:'Más goles marcados',clean:'Más porterías a cero',gd:'Mejor diferencia de goles',partial:'Temporada en curso: las cifras pueden cambiar y no son récords históricos.',closed:'Solo se comparan temporadas completas y verificadas oficialmente.',coverage:'Cobertura verificada',noMatches:'No se han jugado partidos.',noArchive:'Todavía no hay temporadas completas verificadas.',unavailable:'Los récords verificados del club no están disponibles.'},
  fr:{season:'Saison',verified:'Saisons vérifiées',choose:'Choisir la saison',metric:'Record',value:'Valeur',source:'Saison / Compétition',rank:'Meilleur classement en championnat',wins:'Plus de victoires',goals:'Plus de buts marqués',clean:'Plus de matchs sans encaisser',gd:'Meilleure différence de buts',partial:'Saison en cours : ces données peuvent changer et ne sont pas des records historiques.',closed:'Seules les saisons terminées et officiellement vérifiées sont comparées.',coverage:'Période vérifiée',noMatches:'Aucun match joué.',noArchive:'Aucune saison terminée et vérifiée pour le moment.',unavailable:'Les records vérifiés du club ne sont pas disponibles.'},
  it:{season:'Stagione',verified:'Stagioni verificate',choose:'Seleziona stagione',metric:'Record',value:'Valore',source:'Stagione / Competizione',rank:'Miglior piazzamento in campionato',wins:'Più vittorie',goals:'Più gol segnati',clean:'Più clean sheet',gd:'Migliore differenza reti',partial:'Stagione in corso: i valori possono cambiare e non sono record storici.',closed:'Si confrontano soltanto le stagioni concluse e verificate ufficialmente.',coverage:'Copertura verificata',noMatches:'Nessuna partita giocata.',noArchive:'Nessuna stagione conclusa e verificata.',unavailable:'I record verificati del club non sono disponibili.'}
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
  const entries=selected.flatMap(s=>(s.memberships||[]).filter(m=>m.stats?.played>0).map(m=>({season:s.season,m})));
  const records=metrics.map(metric=>{
   const relevant=entries.filter(({m})=>(!metric.domestic||m.category==='domestic')&&
    Number.isSafeInteger(metric.field==='position'?m.position:m.stats[metric.field]));
   if(!relevant.length)return {key:metric.key,value:null,sources:[]};
   const values=relevant.map(({m})=>metric.field==='position'?m.position:m.stats[metric.field]);
   const value=metric.min?Math.min(...values):Math.max(...values);
   return {key:metric.key,value,sources:relevant.filter((_,i)=>values[i]===value)};
  });
  return {selected,entries,records};
 }
 function render({selected,historySnapshot,language='en',search='',divisions=[]}){
  const w=words[language]||words.en,clubKey=selected.countryId+'-'+selected.clubId,base=selected.base+'/records';
  const params=new URLSearchParams(search),scope=params.get('scope')==='verified'?'verified':'season';
  const valid=historySnapshot?.source==='authoritative'&&historySnapshot.clubKey===clubKey&&
   ['complete','empty'].includes(historySnapshot.coverage)&&Array.isArray(historySnapshot.seasons)&&
   Number.isInteger(historySnapshot.world?.seasonNumber)&&historySnapshot.world.seasonNumber<=2;
  const unavailable=historySnapshot?.source==='unavailable'||historySnapshot?.source==='dev';
  const current=valid?historySnapshot.world.seasonNumber:0;
  const raw=params.get('season'),requested=/^[1-9]\d{0,8}$/.test(raw||'')?Number(raw):null;
  const season=current===0?0:requested!==null&&requested<=current?requested:current;
  const hrefForScope=id=>base+(id==='verified'?'?scope=verified':season>0&&season!==current?'?season='+season:'');
  const tabs='<nav class="club-records-scopes" aria-label="'+escape(w.metric)+'">'+
   [['season',w.season],['verified',w.verified]].map(([id,label])=>'<a class="app-competition-tab'+
    (scope===id?' is-active':'')+'" href="'+hrefForScope(id)+'"'+
    (scope===id?' aria-current="page"':'')+'>'+escape(label)+'</a>').join('')+'</nav>';
  const selectSeason='<nav class="club-records-season-nav" aria-label="'+escape(w.choose)+'">'+
   (scope==='season'?Array.from({length:current},(_,i)=>i+1).map(n=>'<a class="club-records-season-link'+
    (n===season?' is-active':'')+'" href="'+base+(n===current?'':'?season='+n)+'"'+
    (n===season?' aria-current="page"':'')+'>'+escape(w.season+' '+n)+'</a>').join(''):'')+'</nav>';
  const header='<thead><tr><th scope="col">'+escape(w.metric)+'</th><th scope="col">'+escape(w.value)+
   '</th><th scope="col">'+escape(w.source)+'</th></tr></thead>';
  const table=body=>'<div class="club-records-table-wrap"><table class="club-records-table" aria-label="'+escape(w.metric)+'">'+header+body+'</table></div>';
  const status=message=>'<p class="club-records-status" role="status">'+escape(message)+'</p>';
  const loading=table('<tbody>'+metrics.map(metric=>'<tr><th scope="row">'+escape(w[metric.key])+
   '</th><td><span class="club-records-placeholder club-fp-bar" aria-hidden="true"></span></td>'+
   '<td><span class="club-records-placeholder-source club-fp-bar" aria-hidden="true"></span></td></tr>').join('')+'</tbody>');
  let contents=loading,note='';
  if(unavailable)contents=status(w.unavailable);
  else if(valid){
   const {selected:eligible,entries,records}=select(historySnapshot.seasons,scope,season);
   if(scope==='verified'){
    note=eligible.length?w.coverage+': '+eligible.map(s=>w.season+' '+s.season).join(', ')+'. '+w.closed:w.closed;
   }else if(eligible[0]?.ongoing)note=w.partial;
   if(!eligible.length||!entries.length)contents=status(scope==='verified'?w.noArchive:w.noMatches);
   else{
    const names=new Map(divisions.map(d=>[d.id,d.name]));
    contents=table('<tbody>'+records.map(record=>{
     const value=record.value===null?'—':record.key==='gd'&&record.value>0?'+'+record.value:String(record.value);
     const sources=record.sources.map(({season:year,m})=>{
      const href=routes.buildRoute({kind:m.category==='domestic'?'competition':'cup',
       id:m.competitionId.toLowerCase(),view:'standings'})+'?season='+year;
      return '<a class="club-records-source-link" href="'+escape(href)+'">'+
       escape(w.season+' '+year+' · '+(names.get(m.competitionId)||m.name))+'</a>';
     }).join('<span class="club-records-divider" aria-hidden="true"> · </span>');
     return '<tr><th scope="row">'+escape(w[record.key])+'</th><td class="club-records-value">'+
      escape(value)+'</td><td class="club-records-source">'+sources+'</td></tr>';
    }).join('')+'</tbody>');
   }
  }
  return '<section class="club-records" aria-busy="'+(!valid&&!unavailable)+'">'+tabs+selectSeason+
   '<p class="club-records-note">'+escape(note)+'</p>'+contents+'</section>';
 }
 return Object.freeze({words,metrics,select,render});
});