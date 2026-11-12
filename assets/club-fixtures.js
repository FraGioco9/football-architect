/* Pure Club Fixtures presentation, shared by the generator and browser. */
((root,factory)=>{const api=factory();root.faClubFixtures=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const copy={
  "en": {
   "season": "Season",
   "competition": "Competition",
   "all": "All",
   "next": "Go to next match",
   "day": "Day",
   "opponent": "Opponent",
   "venue": "Venue",
   "result": "Result",
   "home": "Home",
   "away": "Away",
   "neutral": "Neutral ground",
   "unknown": "Opponent TBD",
   "extra": "After extra time",
   "penalties": "Penalties",
   "scheduled": "Scheduled",
   "fulltime": "Full time"
  },
  "de": {
   "season": "Saison",
   "competition": "Wettbewerb",
   "all": "Alle",
   "next": "Zum nächsten Spiel",
   "day": "Tag",
   "opponent": "Gegner",
   "venue": "Spielort",
   "result": "Ergebnis",
   "home": "Heim",
   "away": "Auswärts",
   "neutral": "Neutraler Platz",
   "unknown": "Gegner offen",
   "extra": "Nach Verlängerung",
   "penalties": "Elfmeterschießen",
   "scheduled": "Angesetzt",
   "fulltime": "Endstand"
  },
  "es": {
   "season": "Temporada",
   "competition": "Competición",
   "all": "Todas",
   "next": "Ir al próximo partido",
   "day": "Día",
   "opponent": "Rival",
   "venue": "Sede",
   "result": "Resultado",
   "home": "Local",
   "away": "Visitante",
   "neutral": "Campo neutral",
   "unknown": "Rival por definir",
   "extra": "Tras prórroga",
   "penalties": "Penaltis",
   "scheduled": "Programado",
   "fulltime": "Finalizado"
  },
  "fr": {
   "season": "Saison",
   "competition": "Compétition",
   "all": "Toutes",
   "next": "Aller au prochain match",
   "day": "Jour",
   "opponent": "Adversaire",
   "venue": "Lieu",
   "result": "Résultat",
   "home": "Domicile",
   "away": "Extérieur",
   "neutral": "Terrain neutre",
   "unknown": "Adversaire à définir",
   "extra": "Après prolongation",
   "penalties": "Tirs au but",
   "scheduled": "Programmé",
   "fulltime": "Terminé"
  },
  "it": {
   "season": "Stagione",
   "competition": "Competizione",
   "all": "Tutte",
   "next": "Vai alla prossima partita",
   "day": "Giorno",
   "opponent": "Avversario",
   "venue": "Sede",
   "result": "Risultato",
   "home": "Casa",
   "away": "Trasferta",
   "neutral": "Campo neutro",
   "unknown": "Avversario da definire",
   "extra": "Dopo i supplementari",
   "penalties": "Rigori",
   "scheduled": "Programmata",
   "fulltime": "Terminata"
  }
 };
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',away:'<path d="M12 2c-1 0-1.5 1-1.5 3v4L3 13v2l7.5-2v5L8 20v2l4-1 4 1v-2l-2.5-2v-5L21 15v-2l-7.5-4V5C13.5 3 13 2 12 2Z"/>',neutral:'<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>'};
 const text=(key,t)=>'<span data-club-fixture-text="'+key+'">'+esc(t[key])+'</span>';
 function control(id,label,selected,options,pendingValue=false){
  return '<div class="language-control club-fixture-select" data-club-fixture-control="'+id+'"><button type="button" class="language-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="club-fixture-'+id+'-menu" aria-label="'+esc(label)+'"><span data-club-fixture-value>'+esc(selected)+(pendingValue?' <span class="club-fp-bar club-fixture-season-loading" aria-hidden="true"></span>':'')+'</span><svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="language-menu" role="listbox" aria-label="'+esc(label)+'" id="club-fixture-'+id+'-menu" hidden>'+options.map(([value,label],i)=>'<div class="language-option" role="option" id="club-fixture-'+id+'-'+i+'" data-menu-value="'+esc(value)+'">'+esc(label)+'</div>').join('')+'</div></div>';
 }
 function render({manifest={clubs:[]},lang='en',season=null,seasons=[],filter='all',snapshot={coverage:'loading',rows:[],competitions:[]}}={}){
  const t=copy[lang]||copy.en,rows=snapshot.rows||[],competitions=snapshot.competitions||[],pending=snapshot.coverage==='loading';
  const compName=id=>competitions.find(d=>d.id===id)?.name||manifest.divisions?.find(d=>d.id===id)?.name||({'int-1':'Sovereign Cup','int-2':'Federation Cup'}[id])||id;
  const options=[['all',t.all],...competitions.map(d=>[d.id,compName(d.id)])];
  const next=rows.find(row=>row.goalsFor===null&&row.day>snapshot.day);
  const toolbar='<div class="club-fixtures-toolbar"><button type="button" class="language-trigger club-fixtures-next" data-club-fixtures-next'+(!next?' disabled':'')+'>'+text('next',t)+'</button><div class="club-fixtures-selectors">'+control('competition',t.competition,filter==='all'?t.all:compName(filter),options)+control('season',t.season,season===null?(pending?t.season:t.season+' —'):t.season+' '+season,seasons.map(s=>[s,t.season+' '+s]),season===null&&pending)+'</div></div>';
  let body='';
  if(pending)body=Array.from({length:6},()=>'<li class="club-fixture-row club-fixture-loading" aria-hidden="true"><span class="club-fixture-meta"><span class="club-fp-bar club-fixture-skeleton-day"></span><span class="club-fp-bar club-fixture-skeleton-league"></span></span><span class="club-fixture-opponent"><span class="app-world-club-crest-placeholder fa-crest-loading"></span><span class="club-fp-bar club-fixture-skeleton-name"></span></span><span class="club-fixture-venue"><span class="club-fp-bar club-fixture-skeleton-venue"></span></span><span class="club-fixture-result"><span class="club-fp-bar club-fixture-skeleton-score"></span><span class="club-fp-bar club-fixture-skeleton-status"></span></span></li>').join('');
  else body=rows.filter(row=>filter==='all'||row.competitionId===filter).map(row=>{
   const club=manifest.clubs.find(c=>c.countryId+'-'+c.clubId===row.opponentId),name=club?.primaryName||t.unknown;
   const opponentHref=club?'/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview':null;
   const crest='<span class="app-world-club-crest-placeholder fa-crest-loading"'+(club?' data-club-crest="'+esc(row.opponentId)+'"':'')+' aria-hidden="true">'+(manifest.clubCrests?.[row.opponentId]?'<img class="app-club-crest-image" src="/'+esc(manifest.clubCrests[row.opponentId])+'" alt="" decoding="async">':'')+'</span>';
   const opponent=crest+'<span>'+esc(name)+'</span>';
   const definition=competitions.find(d=>d.id===row.competitionId),rules=globalThis.faCompetitionRules,view=globalThis.faCompetitionRulesView;
   const choice=definition&&rules?.fixtureChoices(definition).find(c=>c.phaseId===row.phaseId&&(row.phaseId==='league'?c.round===row.round:definition.category!=='international'||!row.leg||c.labelParams?.leg===row.leg));
   const stage=choice&&view?view.fixturesChoiceLabel(definition,choice,lang):row.phaseId==='league'?t.day+' '+row.round:row.phaseId;
   const token=choice?.value??(row.phaseId==='league'?row.round:row.phaseId==='promotionPlayoffs'?'playoffs':row.phaseId);
   const compHref='/competitions/'+row.competitionId.toLowerCase()+'/fixtures?season='+season+'&matchday='+encodeURIComponent(token);
   const played=row.goalsFor!==null,score=played?row.goalsFor+'–'+row.goalsAgainst:'—';
   const status=!played?t.scheduled:row.resolution==='penalties'?t.penalties:row.resolution==='extra-time'?t.extra:t.fulltime;
   return '<li class="club-fixture-row'+(row===next?' is-next':'')+'" data-club-fixture-id="'+esc(row.id)+'"'+(row===next?' data-club-fixture-next tabindex="-1"':'')+'><span class="club-fixture-meta"><span>'+esc(t.day)+' '+row.day+'</span><a href="'+esc(compHref)+'">'+esc(compName(row.competitionId))+' · '+esc(stage)+'</a></span>'+(opponentHref?'<a class="club-fixture-opponent" href="'+esc(opponentHref)+'">'+opponent+'</a>':'<span class="club-fixture-opponent">'+opponent+'</span>')+'<span class="club-fixture-venue" role="img" tabindex="0" data-club-venue="'+row.venue+'" aria-label="'+esc(t[row.venue])+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+icons[row.venue]+'</svg></span><span class="club-fixture-result"><strong aria-label="'+esc(t.result+': '+score)+'">'+score+'</strong><small>'+esc(status)+(played&&row.penalties?' '+row.penalties.for+'–'+row.penalties.against:'')+'</small></span></li>';
  }).join('');
  return '<section class="club-fixtures" data-club-fixtures-state="'+esc(snapshot.coverage)+'" data-club-fixtures-source="'+esc(snapshot.source||'unknown')+'" aria-label="'+esc(t.competition)+'"><div class="club-fixtures-controls">'+toolbar+'</div><ul class="club-fixtures-list" aria-busy="'+pending+'">'+body+'</ul></section>';
 }
 function resolveSeason({current=null,requested=null,remembered=null}={}){
  const confirmed=Number.isSafeInteger(current)&&current>=0;
  if(!confirmed)return {season:requested==='1'?1:null,seasons:[],confirmed:false};
  const limit=Math.max(1,current),valid=value=>/^[1-9]\d{0,8}$/.test(String(value??''));
  const chosen=requested!==null?(valid(requested)?Number(requested):1):valid(remembered)?Number(remembered):limit;
  return {season:Math.min(limit,chosen),seasons:Array.from({length:limit},(_,i)=>limit-i),confirmed:true};
 }
 return {copy,render,resolveSeason};
});
