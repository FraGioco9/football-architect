/** PLYR-05 REC-03 — exclusively verified SIM06 snapshots, WRD05 historical
 * leaderboard entries and recorded market movements. No backfilling and no
 * reliance on the mutable player's season counters or potential.
 */
import {careerStatisticsEnabled} from './domain/career-statistics.js';
import {validateStatisticsArchive} from './addons/domain/match-statistics-archive.mjs';
import {officialPlayerHistory} from './domain/career-history.js';
import {esc} from './ui-components.js';

const tr=(lang,it,en)=>lang==='en'?en:it;
const textId=id=>String(id??'');
const nice=(value,lang,digits=0)=>new Intl.NumberFormat(lang==='en'?'en-GB':'it-IT',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
const safeInt=value=>Number.isSafeInteger(value)&&value>=0;
const small=(label,value)=>`<div class="plyr053-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
const blank=(lang,messageIt,messageEn)=>`<p class="plyr053-empty">${tr(lang,messageIt,messageEn)}</p>`;
const formatMatchId=(id,lang)=>`${tr(lang,'Partita','Match')} #${textId(id)}`;
const playerKeys=(player,w)=>new Set([textId(player.id),textId(player.globalId??`${w.countryId}:${player.id}`)]);
const hasParticipated=p=>p.minutes===null?Number(p.touchesObserved)>0:Number(p.minutes)>0;
const round=(value)=>Math.round(value*100)/100;

export function readOfficialPlayerRecords(w,player){
 const refs=playerKeys(player,w),performance=[],history=[],movements=[];
 const archive=w.advancedV1?.statisticsV1?.archive;
 let archiveInvalid=false;
 if(careerStatisticsEnabled(w)&&archive){
   try {
     validateStatisticsArchive(archive);
     for(const entry of archive.matches){
       const r=entry.report;
       for(const p of r.players){
         if(!refs.has(textId(p.playerId))||!hasParticipated(p))continue;
         performance.push({season:r.season,competitionId:String(r.competitionId),matchId:r.matchId,teamId:p.teamId,
           homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId,
           minutes:p.minutes,rating:p.rating,
           goals:p.goals,shots:p.shots,passes:p.passes,completedPasses:p.completedPasses,
           recoveries:p.recoveries,yellowCards:p.yellowCards,redCards:p.redCards,
           touchesObserved:p.touchesObserved});
       }
     }
   }catch{archiveInvalid=true;performance.length=0;}
 }
 const countries=[...new Set([w.countryId,...(w.advancedV1?.worldV1?.leagues??[]).map(l=>l.countryId)].filter(Boolean))];
 const globalId=textId(player.globalId??`${w.countryId}:${player.id}`);
 for(const country of countries){
   // WRD05 records only the top scorers of completed competitions; this is
   // NOT a complete season-by-season player history.
   try{
     const rows=officialPlayerHistory(w,country,globalId);
     for(const row of rows)if(Number.isSafeInteger(row.season)&&row.season>0&&safeInt(row.goals)&&safeInt(row.apps)){
       history.push({season:row.season,country,clubId:row.clubId,goals:row.goals,apps:row.apps,source:'leaderboard'});
     }
   }catch{/* An unavailable optional archive cannot become fabricated history. */}
 }
 const recordedMovements=w.advancedV1?.marketV1?.movements;
 if(Array.isArray(recordedMovements))for(const move of recordedMovements){
   if(textId(move.playerId)!==globalId||!Number.isSafeInteger(move.season))continue;
   movements.push({season:move.season,from:String(move.from??''),to:String(move.to??''),type:String(move.type??'')});
 }
 performance.sort((a,b)=>b.season-a.season||a.competitionId.localeCompare(b.competitionId)||String(a.matchId).localeCompare(String(b.matchId)));
 history.sort((a,b)=>b.season-a.season||a.country.localeCompare(b.country));
 movements.sort((a,b)=>b.season-a.season);
 return {performance,history,movements,archiveInvalid,hasOfficialStats:careerStatisticsEnabled(w)};
}
export function summariseRecordedMatches(rows){
 if(!rows.length)return null;
 const sum=key=>rows.reduce((n,p)=>n+(Number.isFinite(p[key])?p[key]:0),0);
 const minutesKnown=rows.every(p=>p.minutes!==null&&Number.isFinite(p.minutes));
 const ratings=rows.map(p=>p.rating).filter(Number.isFinite);
 return {appearances:rows.length,goals:sum('goals'),shots:sum('shots'),passes:sum('passes'),
   completedPasses:sum('completedPasses'),recoveries:sum('recoveries'),yellowCards:sum('yellowCards'),
   redCards:sum('redCards'),minutes:minutesKnown?round(sum('minutes')):null,
   minutesKnown:rows.filter(p=>p.minutes!==null).length,
   avgRating:ratings.length?round(ratings.reduce((a,b)=>a+b,0)/ratings.length):null,ratingCoverage:ratings.length};
}
const competitionLabel=(id,lang)=>{
 if(/^league:[A-Z]{2,3}$/.test(id))return `${tr(lang,'Campionato','League')} ${id.slice(7)}`;
 return id;
};
export function renderPlayerPerformancePanel(w,player,ui,{records=null}={}){
 const lang=ui.language==='en'?'en':'it',data=records??readOfficialPlayerRecords(w,player);
 if(data.archiveInvalid)return blank(lang,'Archivio delle statistiche non verificabile. Nessun dato è stato mostrato.','Statistics archive cannot be verified. No data has been displayed.');
 if(!data.hasOfficialStats)return blank(lang,'L’archivio ufficiale delle statistiche non è disponibile in questa carriera.','The official match statistics archive is not available in this career.');
 const seasons=[...new Set([w.season,...data.performance.map(p=>p.season)].filter(x=>Number.isSafeInteger(x)&&x>0))].sort((a,b)=>b-a);
 const selectedSeason=seasons.includes(Number(ui.playerStatsSeason))?Number(ui.playerStatsSeason):seasons[0]??null;
 const competitionIds=[...new Set(data.performance.filter(p=>p.season===selectedSeason).map(p=>p.competitionId))].sort();
 const selectedCompetition=competitionIds.includes(ui.playerStatsCompetition)?ui.playerStatsCompetition:'all';
 const filtered=data.performance.filter(p=>p.season===selectedSeason&&(selectedCompetition==='all'||p.competitionId===selectedCompetition));
 const summary=summariseRecordedMatches(filtered);
 const selectSeason=`<label>${tr(lang,'Stagione','Season')} <select data-player-stats-season aria-label="${tr(lang,'Seleziona stagione','Select season')}">${seasons.map(season=>`<option value="${season}"${season===selectedSeason?' selected':''}>${season}</option>`).join('')}</select></label>`;
 const selectCompetition=`<label>${tr(lang,'Competizione','Competition')} <select data-player-stats-competition aria-label="${tr(lang,'Seleziona competizione','Select competition')}"><option value="all"${selectedCompetition==='all'?' selected':''}>${tr(lang,'Tutte le competizioni registrate','All recorded competitions')}</option>${competitionIds.map(c=>`<option value="${esc(c)}"${c===selectedCompetition?' selected':''}>${esc(competitionLabel(c,lang))}</option>`).join('')}</select></label>`;
 if(!summary)return `<div class="plyr053-performance"><div class="plyr053-filters">${selectSeason}${selectCompetition}</div>${blank(lang,'Nessuna prestazione disponibile negli archivi ufficiali per questi filtri.','No performance available from the official records for these filters.')}${coverageNote(lang)}</div>`;
 const fields=[
  [tr(lang,'Presenze registrate','Recorded appearances'),summary.appearances],
  [tr(lang,'Gol','Goals'),summary.goals],
  [tr(lang,'Minuti verificati','Verified minutes'),summary.minutes===null?'—':nice(summary.minutes,lang,2)],
  [tr(lang,'Voto medio disponibile','Available average rating'),summary.avgRating===null?'—':nice(summary.avgRating,lang,2)],
  [tr(lang,'Tiri registrati','Recorded shots'),summary.shots],
  [tr(lang,'Passaggi registrati','Recorded passes'),summary.passes],
  [tr(lang,'Passaggi completati','Completed passes'),summary.completedPasses],
  [tr(lang,'Recuperi','Recoveries'),summary.recoveries],
  [tr(lang,'Ammonizioni','Yellow cards'),summary.yellowCards],
  [tr(lang,'Espulsioni','Red cards'),summary.redCards],
  [tr(lang,'Assist non rilevati','Assists not recorded'),'—']
 ];
 const matches=filtered.slice().sort((a,b)=>String(b.matchId).localeCompare(String(a.matchId)));
 return `<div class="plyr053-performance">
  <div class="plyr053-filters">${selectSeason}${selectCompetition}</div>
  <div class="plyr053-stats">${fields.map(([label,value])=>small(label,value)).join('')}</div>
  <p class="plyr053-coverage">${tr(lang,'Copertura minuti','Minutes coverage')}: ${summary.minutesKnown}/${summary.appearances} · ${tr(lang,'Partite con voto','Matches with rating')}: ${summary.ratingCoverage}/${summary.appearances}</p>
  <section class="plyr053-block"><h3>${tr(lang,'Partite registrate','Recorded matches')}</h3>
    <div class="plyr053-scroll" role="region" tabindex="0" aria-label="${tr(lang,'Partite registrate','Recorded matches')}">
      <table><thead><tr><th>${tr(lang,'Gara','Match')}</th><th>${tr(lang,'Competizione','Competition')}</th><th>${tr(lang,'Min.','Min.')}</th><th>${tr(lang,'Gol','Goals')}</th><th>${tr(lang,'Voto','Rating')}</th></tr></thead>
      <tbody>${matches.map(p=>`<tr><td>${esc(formatMatchId(p.matchId,lang))}</td><td>${esc(competitionLabel(p.competitionId,lang))}</td><td>${p.minutes===null?'—':nice(p.minutes,lang,2)}</td><td>${p.goals}</td><td>${p.rating===null?'—':nice(p.rating,lang,1)}</td></tr>`).join('')}</tbody></table>
    </div>
  </section>
  ${coverageNote(lang)}
 </div>`;
}
function coverageNote(lang){
 return `<p class="plyr053-coverage">${tr(lang,
   'Solo partite effettivamente registrate nell’archivio SIM06; non rappresentano necessariamente tutta la stagione. Assist e minuti non verificabili non vengono inventati.',
   'Only matches actually recorded in the SIM06 archive; they may not cover the entire season. Assists and unverified minutes are never fabricated.')}</p>`;
}
export function renderPlayerCareerPanel(w,player,ui,{records=null}={}){
 const lang=ui.language==='en'?'en':'it',data=records??readOfficialPlayerRecords(w,player);
 if(data.archiveInvalid)return blank(lang,'Archivio delle statistiche non verificabile. Lo storico delle partite non è mostrato.','Statistics archive cannot be verified. Match history is not displayed.');
 const keys=new Map();
 for(const row of data.performance){
   const key=`${row.season}|${row.competitionId}|${textId(row.teamId)}`;
   if(!keys.has(key))keys.set(key,[]);
   keys.get(key).push(row);
 }
 const seasons=[...keys.entries()].map(([key,rows])=>{
   const [season,competitionId,teamId]=key.split('|');
   return {season:Number(season),competitionId,teamId,summary:summariseRecordedMatches(rows)};
 }).sort((a,b)=>b.season-a.season||a.competitionId.localeCompare(b.competitionId));
 const matches=seasons.length?`<section class="plyr053-block"><h3>${tr(lang,'Stagioni documentate — partite SIM06','Recorded seasons — SIM06 matches')}</h3>
  <div class="plyr053-scroll" role="region" tabindex="0"><table><thead><tr>
   <th>${tr(lang,'Stagione','Season')}</th><th>${tr(lang,'Competizione','Competition')}</th><th>${tr(lang,'Club registrato','Recorded club')}</th><th>${tr(lang,'Presenze','Apps')}</th><th>${tr(lang,'Gol','Goals')}</th><th>${tr(lang,'Minuti','Minutes')}</th></tr></thead>
   <tbody>${seasons.map(x=>`<tr><td>${x.season}</td><td>${esc(competitionLabel(x.competitionId,lang))}</td><td>#${esc(x.teamId)}</td><td>${x.summary.appearances}</td><td>${x.summary.goals}</td><td>${x.summary.minutes===null?'—':nice(x.summary.minutes,lang,2)}</td></tr>`).join('')}</tbody></table></div>
  <p class="plyr053-coverage">${tr(lang,'Copertura limitata alle partite verificate SIM06. Le stagioni incomplete non sono integrate artificialmente.','Coverage is limited to verified SIM06 matches. Incomplete seasons are not artificially filled in.')}</p></section>`:'';
 const leaderboard=data.history.length?`<section class="plyr053-block"><h3>${tr(lang,'Archivio marcatori WRD05','WRD05 scorer archive')}</h3>
  <div class="plyr053-scroll" role="region" tabindex="0"><table><thead><tr><th>${tr(lang,'Stagione','Season')}</th><th>${tr(lang,'Campionato','League')}</th><th>${tr(lang,'Club','Club')}</th><th>${tr(lang,'Presenze archiviate','Archived apps')}</th><th>${tr(lang,'Gol archiviati','Archived goals')}</th></tr></thead>
  <tbody>${data.history.map(x=>`<tr><td>${x.season}</td><td>${esc(x.country)}</td><td>#${esc(x.clubId)}</td><td>${x.apps}</td><td>${x.goals}</td></tr>`).join('')}</tbody></table></div>
  <p class="plyr053-coverage">${tr(lang,'Questo archivio contiene soltanto i calciatori presenti nelle classifiche marcatori registrate, non tutta la carriera. Non sommare i dati WRD05 con quelli SIM06.','This archive includes only players listed in recorded scoring leaderboards, not the entire career. Do not add WRD05 figures to SIM06 totals.')}</p>
 </section>`:'';
 const movements=data.movements.length?`<section class="plyr053-block"><h3>${tr(lang,'Trasferimenti registrati','Recorded transfers')}</h3><ul class="plyr053-moves">${data.movements.map(x=>`<li><strong>${x.season}</strong><span>${esc(x.from||'—')} → ${esc(x.to||'—')}</span><small>${esc(x.type||'—')}</small></li>`).join('')}</ul></section>`:'';
 return `<div class="plyr053-career">
  ${matches}${leaderboard}${movements}
  ${!matches&&!leaderboard&&!movements?blank(lang,'Nessuno storico verificabile è disponibile. Le stagioni senza dati ufficiali restano vuote.','No verifiable career history is available. Seasons without official data remain empty.'):''}
 </div>`;
}
