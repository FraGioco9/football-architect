// Public transport/normalization only. No simulation, Admin credentials, DEV source or storage.
// Reuse the public canonical calendar/fixture-choice policies; no clock inference.
import './world-calendar-model.js';
import './competition-rules.js';
const idPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw TypeError('Invalid authoritative sporting source')};
const key=club=>club.countryId+'-'+club.clubId;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
export function validPublicWorld(w){
 return object(w)&&w.schemaVersion===1&&typeof w.generation==='string'&&uuid.test(w.generation)&&count(w.revision)&&count(w.seasonNumber)&&count(w.day)&&w.day<=56&&
  (w.phase==='unstarted'?w.seasonNumber===0&&w.day===0&&w.revision===0:w.seasonNumber>0&&(w.phase==='preparing'?w.day===0:w.phase==='active'?w.day>=1:w.phase==='closed'&&w.day===56));
}
export function viewedSeasonState(input){
 const w=input?.world,d=input?.data,season=input?.selectedSeason;
 if(!validPublicWorld(w)||![1,2].includes(season)||!d||season>w.seasonNumber)return null;
 const state=d.seasonState??(season===w.seasonNumber?{day:w.day,phase:w.phase}:null);
 if(!state||!Number.isInteger(state.day)||state.day<0||state.day>56||!['preparing','active','closed'].includes(state.phase))return null;
 if(season===w.seasonNumber)return state.day===w.day&&state.phase===w.phase?state:null;
 return state.phase==='closed'&&state.day===56?state:null;
}
function sameWorld(a,b){return ['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k])}
function clubCatalog(manifest){return new Map((manifest?.divisions||[]).flatMap(d=>d.clubs||[]).map(c=>[key(c),c]))}
export function scoreValid(r,f){
 if(!object(r)||!count(r.homeGoals)||!count(r.awayGoals)||r.homeGoals>100||r.awayGoals>100||!['regulation','extra-time','penalties'].includes(r.resolution)||
   r.winnerClubId!==null&&![f.homeClubId,f.awayClubId].includes(r.winnerClubId))return false;
 const pair=p=>object(p)&&count(p.home)&&count(p.away)&&p.home<=100&&p.away<=100;
 if(r.resolution==='regulation')return r.extraTime===null&&r.penalties===null;
 if(!pair(r.extraTime)||r.homeGoals<r.extraTime.home||r.awayGoals<r.extraTime.away)return false;
 return r.resolution==='extra-time'?r.penalties===null:pair(r.penalties)&&r.penalties.home!==r.penalties.away&&r.winnerClubId===(r.penalties.home>r.penalties.away?f.homeClubId:f.awayClubId);
}
function totals(ids,fixtures){
 const rows=new Map(ids.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,cleanSheets:0}]));
 for(const f of fixtures){const s=f.result;if(!s)continue;const h=rows.get(f.homeClubId),a=rows.get(f.awayClubId);if(!h||!a)fail();
  h.played++;a.played++;h.goalsFor+=s.homeGoals;h.goalsAgainst+=s.awayGoals;a.goalsFor+=s.awayGoals;a.goalsAgainst+=s.homeGoals;
  if(s.awayGoals===0)h.cleanSheets++;if(s.homeGoals===0)a.cleanSheets++;
  if(s.homeGoals===s.awayGoals){h.drawn++;a.drawn++}else if(s.homeGoals>s.awayGoals){h.won++;a.lost++}else{a.won++;h.lost++}
 }return rows;
}
export function validateAuthoritativeSeason(input,context,manifest){
 const definition=context?.currentDefinition||context?.definition;
 if(!object(input)||input.schemaVersion!==1||input.providerId!=='authoritative-world'||input.competitionId!==definition?.id||input.selectedSeason!==context.selectedSeason||!validPublicWorld(input.world))fail();
 if(!['partial','available'].includes(input.status)){
  const allowed=input.status==='empty'?['season-not-prepared','calendar-unpublished']:input.status==='unavailable'?['unsupported-season','unsupported-world-season']:[];
  if(!allowed.includes(input.reason)||input.data!==null||input.provenance?.kind!=='none'||input.provenance.sourceRef!==null||input.provenance.resultAuthority!==null)fail();
  return freeze(structuredClone(input));
 }
 const {data:d,world:w,provenance:p}=input,viewed=viewedSeasonState(input);
 if(!viewed||![1,2].includes(w.seasonNumber)||!object(d)||d.season!==input.selectedSeason||d.rulesVersion!==definition.rules.version||input.reason!==null||
    p?.kind!=='authoritative'||p.resultAuthority!=='temporary-score-v1'||typeof p.sourceRef!=='string'||!new RegExp('^world:'+w.generation+':season:'+d.season+':[a-f0-9]{64}$').test(p.sourceRef)||
    (input.status==='available')!==(viewed.phase==='closed'))fail();
 const catalog=clubCatalog(manifest),ids=d.participants;
 if(!Array.isArray(ids)||ids.length!==definition.capacity||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)||!catalog.has(id))||
    definition.category==='domestic'&&ids.some(id=>!id.startsWith(definition.id.split('-')[0]+'-')))fail();
 const fixtures=d.fixtures,seen=new Set(),positions=new Set();
 if(!Array.isArray(fixtures))fail();
 for(const f of fixtures){
  if(!object(f)||f.competitionId!==definition.id||!ids.includes(f.homeClubId)||!ids.includes(f.awayClubId)||f.homeClubId===f.awayClubId||
     !Number.isInteger(f.day)||f.day<1||f.day>56||!Number.isInteger(f.round)||f.round<1||f.round>33||
     !/^(?:[NI](?:0[1-9]|[12][0-9]|3[0-3])|FEDERATION-FINAL|SOVEREIGN-FINAL)$/.test(f.marker)||
     f.id!==`season:${d.season}:${definition.id}:${f.marker}:${f.homeClubId}:${f.awayClubId}`||seen.has(f.id)||
     typeof f.neutral!=='boolean'||!definition.rules.phases.some(p=>p.id===f.phaseId)||
     (f.result!==null)!==(f.day<=viewed.day)||f.result!==null&&!scoreValid(f.result,f))fail();
  const phase=definition.rules.phases.find(p=>p.id===f.phaseId);
  if(phase.type==='knockout'){
   const tie=phase.ties.find(t=>t.id===f.tieId),position=f.phaseId+':'+f.tieId+':'+f.leg;
   if(!tie||!Number.isInteger(f.leg)||f.leg<1||f.leg>tie.legs||positions.has(position)||f.neutral!==(tie.homePolicy==='neutral'))fail();positions.add(position);
  }else if(f.tieId!==null||f.leg!==null||f.neutral)fail();
  seen.add(f.id);
 }
 const league=fixtures.filter(f=>f.phaseId==='league'),rounds=definition.category==='international'?6:30;
 if(league.length!==(definition.category==='international'?72:240))fail();
 for(let round=1;round<=rounds;round++){
  const games=league.filter(f=>f.round===round);
  if(games.length!==definition.capacity/2||new Set(games.flatMap(f=>[f.homeClubId,f.awayClubId])).size!==definition.capacity)fail();
 }
 const table=d.standings,leagueTotals=totals(ids,league);
 if(!object(table)||table.complete!==league.every(f=>f.result!==null)||!Array.isArray(table.rows)||table.rows.length!==ids.length||new Set(table.rows.map(r=>r.clubId)).size!==ids.length)fail();
 table.rows.forEach((r,i)=>{
  const t=leagueTotals.get(r.clubId);
  if(!t||r.rank!==i+1||['played','won','drawn','lost','goalsFor','goalsAgainst'].some(k=>r[k]!==t[k])||r.goalDifference!==t.goalsFor-t.goalsAgainst||r.points!==t.won*3+t.drawn)fail();
 });
 const stats=d.statistics,allTotals=totals(ids,fixtures),played=fixtures.filter(f=>f.result!==null),goals=played.reduce((n,f)=>n+f.result.homeGoals+f.result.awayGoals,0);
 if(!object(stats)||stats.matchesPlayed!==played.length||stats.totalGoals!==goals||stats.goalsPerMatch!==(played.length?goals/played.length:0)||stats.players!==null||stats.playerStatus!=='unavailable'||
    !Array.isArray(stats.teams)||stats.teams.length!==ids.length||new Set(stats.teams.map(t=>t.clubId)).size!==ids.length)fail();
 for(const row of stats.teams){const t=allTotals.get(row.clubId);if(!t||Object.keys(t).some(k=>row[k]!==t[k])||row.goalDifference!==t.goalsFor-t.goalsAgainst)fail()}
 if(!Array.isArray(d.calendar)||d.calendar.length!==56)fail();
 d.calendar.forEach((day,i)=>{
  const expected=fixtures.filter(f=>f.day===i+1);
  if(day.day!==i+1||!Array.isArray(day.fixtureIds)||day.fixtureIds.length!==expected.length||new Set(day.fixtureIds).size!==expected.length||expected.some(f=>!day.fixtureIds.includes(f.id))||day.played!==expected.filter(f=>f.result!==null).length)fail();
 });
 if(viewed.phase==='closed'){
  const final=fixtures.find(f=>f.marker===(definition.id==='int-1'?'SOVEREIGN-FINAL':'FEDERATION-FINAL'));
  const champion=definition.category==='international'?final?.result?.winnerClubId:table.rows[0]?.clubId;
  if(!table.complete||fixtures.some(f=>f.result===null)||!object(d.history)||d.history.season!==d.season||!/^[a-f0-9]{64}$/.test(d.history.archiveHash)||!count(d.history.closedAt)||d.history.closedAt===0||d.history.championClubId!==champion||!ids.includes(champion))fail();
 }else if(d.history!==null)fail();
 return freeze(structuredClone(input));
}
export function adaptAuthoritativeSeason(source,context,manifest){
 if(source.data===null)return null;
 const {data:d}=source,definition=context.currentDefinition||context.definition,catalog=clubCatalog(manifest),participants=d.participants.map(id=>catalog.get(id));
 const club=id=>definition.category==='international'?id:catalog.get(id).clubId;
 const fixtures=d.fixtures.map(f=>({round:f.round,phaseId:f.phaseId,tieId:f.tieId,leg:f.leg,neutral:f.neutral,
  homeId:club(f.homeClubId),awayId:club(f.awayClubId),homeGoals:f.result?.homeGoals??null,awayGoals:f.result?.awayGoals??null,kickoff:null,
  afterExtraTime:!!f.result?.extraTime,penalties:f.result?.penalties?{homeId:club(f.homeClubId),awayId:club(f.awayClubId),homeGoals:f.result.penalties.home,awayGoals:f.result.penalties.away}:null}));
 const postseason=fixtures.filter(f=>f.phaseId!=='league');
 const results=[];
 for(const f of d.fixtures.filter(f=>f.tieId!==null)){
  if(results.some(t=>t.id===f.tieId))continue;
  const games=d.fixtures.filter(g=>g.tieId===f.tieId).sort((a,b)=>a.leg-b.leg);
  results.push({id:f.tieId,tieId:f.tieId,winnerId:games.at(-1).result?.winnerClubId??null,
   legs:games.map(g=>g.result?{...fixtures[d.fixtures.indexOf(g)],homeId:g.homeClubId,awayId:g.awayClubId}:null)});
 }
 const recent=(id,all=false)=>d.fixtures.filter(f=>(all||f.phaseId==='league')&&f.result!==null&&[f.homeClubId,f.awayClubId].includes(id)).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id)).map(f=>{
  const home=f.homeClubId===id,own=home?f.result.homeGoals:f.result.awayGoals,other=home?f.result.awayGoals:f.result.homeGoals;
  return own>other?'W':own<other?'L':'D';
 });
 const statistics={overview:{matchesPlayed:d.statistics.matchesPlayed,totalGoals:d.statistics.totalGoals,goalsPerMatch:d.statistics.goalsPerMatch},
  standings:d.standings.rows.map(r=>({club:catalog.get(r.clubId),played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points,recent:recent(r.clubId).slice(-5)})),
  teams:d.statistics.teams.map(t=>{const form=recent(t.clubId,true),lastLoss=form.lastIndexOf('L');return {clubKey:t.clubId,clubName:catalog.get(t.clubId).primaryName,mp:t.played,gf:t.goalsFor,ga:t.goalsAgainst,w:t.won,cs:t.cleanSheets,ppg:t.played?(3*t.won+t.drawn)/t.played:0,gd:t.goalDifference,unbeatenStreak:form.length-lastLoss-1}}),players:[]};
 const currentChoice=viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?
  globalThis.faCompetitionRules.currentFixtureChoice(definition,globalThis.faWorldCalendarModel.projectCompetition(d.season,definition.id),{current:{season:source.world.seasonNumber,day:source.world.day}}):null;
 return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,fixtures:definition.category==='international'?fixtures:fixtures.filter(f=>f.phaseId==='league'),postseason,results,statistics,status:source.status,
  history:d.history?{season:d.history.season,archiveHash:d.history.archiveHash,closedAt:d.history.closedAt,championClubId:d.history.championClubId}:null,
  provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},world:source.world,seasonState:viewedSeasonState(source),
  currentMatchday:viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?currentChoice:null});
}
export function createAuthoritativeLoader({getContext,clear,commit,isDev,fetchJson,manifest,onState=()=>{},onWorld=()=>{}}){
 let epoch=0,controller=null,disposed=false;
 return Object.freeze({async load(){
  if(disposed||isDev())return false;
  const ticket=++epoch;controller?.abort();controller=new AbortController();const signal=controller.signal;
  clear();onState('loading');const context=getContext();if(!context)return false;
  const current=()=>!disposed&&ticket===epoch&&!isDev()&&getContext()?.revision===context.revision&&getContext()?.selectedSeason===context.selectedSeason;
  let completed=false;
  try{
   const before=await fetchJson('/api/world',{signal});if(!current()||!validPublicWorld(before?.world))return false;
   onWorld(before.world);if(!current())return false;
   const payload=await fetchJson(`/api/competitions/${context.definition.id}/seasons/${context.selectedSeason}`,{signal});if(!current())return false;
   const source=validateAuthoritativeSeason(payload,context,manifest);
   if(!sameWorld(before.world,source.world))return false;
   const after=await fetchJson('/api/world',{signal});if(!current()||!validPublicWorld(after?.world)||!sameWorld(source.world,after.world))return false;
   const accepted=commit(adaptAuthoritativeSeason(source,context,manifest),context.revision)===true;
   if(accepted){completed=true;onState(source.status)}return accepted;
  }catch{return false}finally{if(!completed&&current())onState('unavailable')}
 },dispose(){disposed=true;epoch++;controller?.abort()}});
}
