// Public transport/normalization only. No simulation, Admin credentials, DEV source or storage.
// Reuse the public canonical calendar/fixture-choice policies; no clock inference.
import './world-calendar-model.js';
import './competition-rules.js';
import './world-clock-adapter.js';
const idPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw TypeError('Invalid authoritative sporting source')};
const key=club=>club.countryId+'-'+club.clubId;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
export const validPublicWorld=globalThis.faWorldClockAdapter.validPublicWorld;
export function viewedSeasonState(input){
 const w=input?.world,d=input?.data,season=input?.selectedSeason;
 if(!validPublicWorld(w)||![1,2].includes(season)||!d)return null;
 if(w.seasonNumber===0){
  const state=d.seasonState;
  return season===1&&w.phase==='unstarted'&&d.entrantsOnly===true&&state?.day===0&&state.phase==='unstarted'?{day:0,phase:'unstarted'}:null;
 }
 if(season>w.seasonNumber)return null;
 const state=d.seasonState??(season===w.seasonNumber?{day:w.day,phase:w.phase}:null);
 if(!state||!Number.isInteger(state.day)||state.day<0||state.day>56||!['preparing','active','closed'].includes(state.phase))return null;
 if(season===w.seasonNumber)return state.day===w.day&&state.phase===w.phase?state:null;
 return state.phase==='closed'&&state.day===56?state:null;
}
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
 const entrantsOnly=d?.entrantsOnly===true;
 const authority=entrantsOnly?'confirmed-entrants-v1':'temporary-lineup-v1';
 const zeroEntrants=w.seasonNumber===0&&entrantsOnly&&input.selectedSeason===1;
 const scope=definition.category==='international'?'international':'domestic';
 const sourcePrefix=zeroEntrants?
  'world:'+w.generation+':season:0:entrants:'+scope+':' :
  'world:'+w.generation+':season:'+d.season+':'+(entrantsOnly?'entrants:':'');
 const validSource=typeof p?.sourceRef==='string'&&p.sourceRef.startsWith(sourcePrefix)&&
  /^[a-f0-9]{64}$/.test(p.sourceRef.slice(sourcePrefix.length));
 if(!viewed||!(zeroEntrants||[1,2].includes(w.seasonNumber))||!object(d)||
    d.season!==input.selectedSeason||d.rulesVersion!==definition.rules.version||input.reason!==null||
    p?.kind!=='authoritative'||p.resultAuthority!==authority||!validSource||
    (input.status==='available')!==(viewed.phase==='closed'))fail();
 const catalog=clubCatalog(manifest),ids=d.participants;
 if(!Array.isArray(ids)||ids.length!==definition.capacity||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)||!catalog.has(id))||
    definition.category==='domestic'&&ids.some(id=>!id.startsWith(definition.id.split('-')[0]+'-')))fail();
 if(entrantsOnly){
  // Membership confirmation has no schedule, result, rank or archived history.
  if(input.status!=='partial'||!(zeroEntrants?viewed.phase==='unstarted'&&viewed.day===0:viewed.phase==='active'&&viewed.day>=1&&viewed.day<=12)||
     Object.keys(d).sort().join(',')!=='entrantsOnly,participants,rulesVersion,season,seasonState'||
     !object(d.seasonState)||d.seasonState.day!==viewed.day||d.seasonState.phase!==viewed.phase)fail();
  return freeze(structuredClone(input));
 }
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
 if(!object(stats)||stats.matchesPlayed!==played.length||stats.totalGoals!==goals||stats.goalsPerMatch!==(played.length?goals/played.length:0)||!Array.isArray(stats.players)||stats.playerStatus!=='available'||
    !Array.isArray(stats.teams)||stats.teams.length!==ids.length||new Set(stats.teams.map(t=>t.clubId)).size!==ids.length)fail();
 for(const row of stats.teams){const t=allTotals.get(row.clubId);if(!t||Object.keys(t).some(k=>row[k]!==t[k])||row.goalDifference!==t.goalsFor-t.goalsAgainst)fail()}
 const playerIdentity=new Set(),playerTotals=new Map();
 for(const p of stats.players){
  if(!object(p)||!count(p.playerId)||p.playerId===0||!ids.includes(p.clubId)||
     !count(p.appearances)||p.appearances===0||!count(p.starts)||p.starts!==p.appearances||
     // Frozen V2 appearances may be substituted before 90'; each counted
     // appearance contributes 1..120 playing minutes, never a mandatory 90.
     !count(p.minutes)||p.minutes<p.appearances||p.minutes>120*p.appearances||
     !count(p.goals))fail();
  const identity=p.clubId+':'+p.playerId;
  if(playerIdentity.has(identity))fail();playerIdentity.add(identity);
  // One player cannot appear more often than their club has played, but
  // eleven DISTINCT starters may each appear in that same match.
  const team=allTotals.get(p.clubId);
  if(!team||p.appearances>team.played)fail();
  const total=playerTotals.get(p.clubId)??{appearances:0,goals:0};
  total.appearances+=p.appearances;total.goals+=p.goals;
  playerTotals.set(p.clubId,total);
 }
 for(const [clubId,p] of playerTotals){
  const t=allTotals.get(clubId);
  if(!t||p.appearances>11*t.played||p.goals>t.goalsFor)fail();
 }
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
 if(d.entrantsOnly===true){
  // Approved membership is stored in ID order, but unranked entrants are presented by primary name.
  participants.sort((a,b)=>a.primaryName.localeCompare(b.primaryName,'en',{sensitivity:'base'})||key(a).localeCompare(key(b),'en'));
  const standings=participants.map(club=>({club,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0,recent:[]}));
  return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,entrantsOnly:true,fixtures:null,
   postseason:[],results:[],statistics:{standings,overview:{matchesPlayed:0,totalGoals:0,goalsPerMatch:0},teams:[],players:[]},
   status:source.status,history:null,
   provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},
   world:source.world,seasonState:viewedSeasonState(source),currentMatchday:null});
 }
 const club=id=>definition.category==='international'?id:catalog.get(id).clubId;
 const fixtures=d.fixtures.map(f=>({sourceFixtureId:f.id,marker:f.marker,day:f.day,
  round:f.round,phaseId:f.phaseId,tieId:f.tieId,leg:f.leg,neutral:f.neutral,
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
 const completedMatches=(id,all=false)=>d.fixtures.filter(f=>(all||f.phaseId==='league')&&f.result!==null&&[f.homeClubId,f.awayClubId].includes(id)).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 const resultFor=(id,f)=>{
  const home=f.homeClubId===id,own=home?f.result.homeGoals:f.result.awayGoals,other=home?f.result.awayGoals:f.result.homeGoals;
  return own>other?'W':own<other?'L':'D';
 };
 // Chronological form letters serve the team leaderboard. The compact table
 // needs verified fixture metadata, most recent match first.
 const recent=(id,all=false)=>completedMatches(id,all).map(f=>resultFor(id,f));
 const recentDetails=id=>completedMatches(id).slice(-5).reverse().map(f=>({
  result:resultFor(id,f),round:f.round,homeId:club(f.homeClubId),awayId:club(f.awayClubId)
 }));
 const statistics={overview:{matchesPlayed:d.statistics.matchesPlayed,totalGoals:d.statistics.totalGoals,goalsPerMatch:d.statistics.goalsPerMatch},
  standings:d.standings.rows.map(r=>({club:catalog.get(r.clubId),played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points,recent:recentDetails(r.clubId)})),
  teams:d.statistics.teams.map(t=>{const form=recent(t.clubId,true),lastLoss=form.lastIndexOf('L');return {clubKey:t.clubId,clubName:catalog.get(t.clubId).primaryName,mp:t.played,gf:t.goalsFor,ga:t.goalsAgainst,w:t.won,cs:t.cleanSheets,ppg:t.played?(3*t.won+t.drawn)/t.played:0,gd:t.goalDifference,unbeatenStreak:form.length-lastLoss-1}}),players:[]};
 const currentChoice=viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?
  globalThis.faCompetitionRules.currentFixtureChoice(definition,globalThis.faWorldCalendarModel.projectCompetition(d.season,definition.id),{current:{season:source.world.seasonNumber,day:source.world.day}}):null;
 return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,fixtures:definition.category==='international'?fixtures:fixtures.filter(f=>f.phaseId==='league'),postseason,results,statistics,status:source.status,
  history:d.history?{season:d.history.season,archiveHash:d.history.archiveHash,closedAt:d.history.closedAt,championClubId:d.history.championClubId}:null,
  provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},world:source.world,seasonState:viewedSeasonState(source),
  currentMatchday:viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?currentChoice:null});
}
/**
 * PERF-API-657 — validated immutable sporting-season snapshots, scoped to a
 * single public world generation/revision and source revision. A season viewed
 * earlier is reusable only while the authoritative world is *exactly* unchanged.
 * A confirmed canonical empty response is a valid cache entry; failed reads
 * never reach this helper.
 */
export function createCompetitionSeasonReadCache({limit=8}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>32)throw TypeError('Invalid cache limit');
 const entries=new Map();
 const cacheKey=(competitionId,season,snapshot)=>{
  const world=snapshot?.world;
  if(!/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId)||
     !Number.isSafeInteger(season)||season<1||
     snapshot?.source!=='authoritative'||snapshot.worldStatus!=='ready'||
     !Number.isSafeInteger(snapshot.sourceRevision)||snapshot.sourceRevision<0||
     !validPublicWorld(world)||season>world.seasonNumber&&(world.seasonNumber!==0||season!==1))return null;
  return JSON.stringify([competitionId,season,snapshot.sourceRevision,
   world.generation,world.revision,world.seasonNumber,world.day,world.phase]);
 };
 return Object.freeze({
  remember({competitionId,season,snapshot,data}){
   const key=cacheKey(competitionId,season,snapshot);
   if(!key||data!==null&&(data?.provenance?.kind!=='authoritative'||
      data.season!==season||!globalThis.faWorldClockAdapter.sameWorld(data.world,snapshot.world)))
    return false;
   const copy=data===null?null:freeze(structuredClone(data));
   entries.delete(key);entries.set(key,copy);
   while(entries.size>limit)entries.delete(entries.keys().next().value);
   return true;
  },
  find({competitionId,season,snapshot}){
   const key=cacheKey(competitionId,season,snapshot);
   // The wrapper distinguishes a verified empty season from a cache miss.
   return key&&entries.has(key)?{data:entries.get(key)}:null;
  },
  clear(){entries.clear()},
  size(){return entries.size}
 });
}

export function createAuthoritativeLoader({getContext,clear,commit,isDev,fetchJson,manifest,onState=()=>{},onWorld=()=>{}}){
 let context,retained=false;
 return globalThis.faWorldClockAdapter.createSnapshotReader({
  getIdentity:()=>{const c=getContext();return c?JSON.stringify([c.definition?.id,c.selectedSeason,c.revision]):null},
  isEnabled:()=>!isDev(),clear:()=>{retained=!!getContext()?.seasonData;if(!retained)clear();context=getContext()},
  onState:state=>{if(state==='unavailable'&&retained)clear();onState(state)},
  // Reuse the authoritative global clock; the season payload carries its
  // own verified world revision and provenance.
  useSharedWorld:true,
  fetchWorld:async options=>(await fetchJson('/api/world',options))?.world,
  onBeforeWorld:onWorld,
  read:options=>fetchJson(`/api/competitions/${context.definition.id}/seasons/${context.selectedSeason}`,options),
  validate:payload=>validateAuthoritativeSeason(payload,context,manifest),
  commit:source=>commit(adaptAuthoritativeSeason(source,context,manifest),context.revision)
 });
}
:
  '^world:'+w.generation+':season:'+d.season+':'+(entrantsOnly?'entrants:':'')+'[a-f0-9]{64}
 const catalog=clubCatalog(manifest),ids=d.participants;
 if(!Array.isArray(ids)||ids.length!==definition.capacity||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)||!catalog.has(id))||
    definition.category==='domestic'&&ids.some(id=>!id.startsWith(definition.id.split('-')[0]+'-')))fail();
 if(entrantsOnly){
  // Membership confirmation has no schedule, result, rank or archived history.
  if(input.status!=='partial'||viewed.phase!=='active'||viewed.day<1||viewed.day>12||
     Object.keys(d).sort().join(',')!=='entrantsOnly,participants,rulesVersion,season,seasonState'||
     !object(d.seasonState)||d.seasonState.day!==viewed.day||d.seasonState.phase!==viewed.phase)fail();
  return freeze(structuredClone(input));
 }
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
 if(!object(stats)||stats.matchesPlayed!==played.length||stats.totalGoals!==goals||stats.goalsPerMatch!==(played.length?goals/played.length:0)||!Array.isArray(stats.players)||stats.playerStatus!=='available'||
    !Array.isArray(stats.teams)||stats.teams.length!==ids.length||new Set(stats.teams.map(t=>t.clubId)).size!==ids.length)fail();
 for(const row of stats.teams){const t=allTotals.get(row.clubId);if(!t||Object.keys(t).some(k=>row[k]!==t[k])||row.goalDifference!==t.goalsFor-t.goalsAgainst)fail()}
 const playerIdentity=new Set(),playerTotals=new Map();
 for(const p of stats.players){
  if(!object(p)||!count(p.playerId)||p.playerId===0||!ids.includes(p.clubId)||
     !count(p.appearances)||p.appearances===0||!count(p.starts)||p.starts!==p.appearances||
     // Frozen V2 appearances may be substituted before 90'; each counted
     // appearance contributes 1..120 playing minutes, never a mandatory 90.
     !count(p.minutes)||p.minutes<p.appearances||p.minutes>120*p.appearances||
     !count(p.goals))fail();
  const identity=p.clubId+':'+p.playerId;
  if(playerIdentity.has(identity))fail();playerIdentity.add(identity);
  // One player cannot appear more often than their club has played, but
  // eleven DISTINCT starters may each appear in that same match.
  const team=allTotals.get(p.clubId);
  if(!team||p.appearances>team.played)fail();
  const total=playerTotals.get(p.clubId)??{appearances:0,goals:0};
  total.appearances+=p.appearances;total.goals+=p.goals;
  playerTotals.set(p.clubId,total);
 }
 for(const [clubId,p] of playerTotals){
  const t=allTotals.get(clubId);
  if(!t||p.appearances>11*t.played||p.goals>t.goalsFor)fail();
 }
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
 if(d.entrantsOnly===true){
  // Approved membership is stored in ID order, but unranked entrants are presented by primary name.
  participants.sort((a,b)=>a.primaryName.localeCompare(b.primaryName,'en',{sensitivity:'base'})||key(a).localeCompare(key(b),'en'));
  const standings=participants.map(club=>({club,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0,recent:[]}));
  return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,entrantsOnly:true,fixtures:null,
   postseason:[],results:[],statistics:{standings,overview:{matchesPlayed:0,totalGoals:0,goalsPerMatch:0},teams:[],players:[]},
   status:source.status,history:null,
   provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},
   world:source.world,seasonState:viewedSeasonState(source),currentMatchday:null});
 }
 const club=id=>definition.category==='international'?id:catalog.get(id).clubId;
 const fixtures=d.fixtures.map(f=>({sourceFixtureId:f.id,marker:f.marker,day:f.day,
  round:f.round,phaseId:f.phaseId,tieId:f.tieId,leg:f.leg,neutral:f.neutral,
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
 const completedMatches=(id,all=false)=>d.fixtures.filter(f=>(all||f.phaseId==='league')&&f.result!==null&&[f.homeClubId,f.awayClubId].includes(id)).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 const resultFor=(id,f)=>{
  const home=f.homeClubId===id,own=home?f.result.homeGoals:f.result.awayGoals,other=home?f.result.awayGoals:f.result.homeGoals;
  return own>other?'W':own<other?'L':'D';
 };
 // Chronological form letters serve the team leaderboard. The compact table
 // needs verified fixture metadata, most recent match first.
 const recent=(id,all=false)=>completedMatches(id,all).map(f=>resultFor(id,f));
 const recentDetails=id=>completedMatches(id).slice(-5).reverse().map(f=>({
  result:resultFor(id,f),round:f.round,homeId:club(f.homeClubId),awayId:club(f.awayClubId)
 }));
 const statistics={overview:{matchesPlayed:d.statistics.matchesPlayed,totalGoals:d.statistics.totalGoals,goalsPerMatch:d.statistics.goalsPerMatch},
  standings:d.standings.rows.map(r=>({club:catalog.get(r.clubId),played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points,recent:recentDetails(r.clubId)})),
  teams:d.statistics.teams.map(t=>{const form=recent(t.clubId,true),lastLoss=form.lastIndexOf('L');return {clubKey:t.clubId,clubName:catalog.get(t.clubId).primaryName,mp:t.played,gf:t.goalsFor,ga:t.goalsAgainst,w:t.won,cs:t.cleanSheets,ppg:t.played?(3*t.won+t.drawn)/t.played:0,gd:t.goalDifference,unbeatenStreak:form.length-lastLoss-1}}),players:[]};
 const currentChoice=viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?
  globalThis.faCompetitionRules.currentFixtureChoice(definition,globalThis.faWorldCalendarModel.projectCompetition(d.season,definition.id),{current:{season:source.world.seasonNumber,day:source.world.day}}):null;
 return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,fixtures:definition.category==='international'?fixtures:fixtures.filter(f=>f.phaseId==='league'),postseason,results,statistics,status:source.status,
  history:d.history?{season:d.history.season,archiveHash:d.history.archiveHash,closedAt:d.history.closedAt,championClubId:d.history.championClubId}:null,
  provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},world:source.world,seasonState:viewedSeasonState(source),
  currentMatchday:viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?currentChoice:null});
}
/**
 * PERF-API-657 — validated immutable sporting-season snapshots, scoped to a
 * single public world generation/revision and source revision. A season viewed
 * earlier is reusable only while the authoritative world is *exactly* unchanged.
 * A confirmed canonical empty response is a valid cache entry; failed reads
 * never reach this helper.
 */
export function createCompetitionSeasonReadCache({limit=8}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>32)throw TypeError('Invalid cache limit');
 const entries=new Map();
 const cacheKey=(competitionId,season,snapshot)=>{
  const world=snapshot?.world;
  if(!/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId)||
     !Number.isSafeInteger(season)||season<1||
     snapshot?.source!=='authoritative'||snapshot.worldStatus!=='ready'||
     !Number.isSafeInteger(snapshot.sourceRevision)||snapshot.sourceRevision<0||
     !validPublicWorld(world)||season>world.seasonNumber)return null;
  return JSON.stringify([competitionId,season,snapshot.sourceRevision,
   world.generation,world.revision,world.seasonNumber,world.day,world.phase]);
 };
 return Object.freeze({
  remember({competitionId,season,snapshot,data}){
   const key=cacheKey(competitionId,season,snapshot);
   if(!key||data!==null&&(data?.provenance?.kind!=='authoritative'||
      data.season!==season||!globalThis.faWorldClockAdapter.sameWorld(data.world,snapshot.world)))
    return false;
   const copy=data===null?null:freeze(structuredClone(data));
   entries.delete(key);entries.set(key,copy);
   while(entries.size>limit)entries.delete(entries.keys().next().value);
   return true;
  },
  find({competitionId,season,snapshot}){
   const key=cacheKey(competitionId,season,snapshot);
   // The wrapper distinguishes a verified empty season from a cache miss.
   return key&&entries.has(key)?{data:entries.get(key)}:null;
  },
  clear(){entries.clear()},
  size(){return entries.size}
 });
}

export function createAuthoritativeLoader({getContext,clear,commit,isDev,fetchJson,manifest,onState=()=>{},onWorld=()=>{}}){
 let context,retained=false;
 return globalThis.faWorldClockAdapter.createSnapshotReader({
  getIdentity:()=>{const c=getContext();return c?JSON.stringify([c.definition?.id,c.selectedSeason,c.revision]):null},
  isEnabled:()=>!isDev(),clear:()=>{retained=!!getContext()?.seasonData;if(!retained)clear();context=getContext()},
  onState:state=>{if(state==='unavailable'&&retained)clear();onState(state)},
  // Reuse the authoritative global clock; the season payload carries its
  // own verified world revision and provenance.
  useSharedWorld:true,
  fetchWorld:async options=>(await fetchJson('/api/world',options))?.world,
  onBeforeWorld:onWorld,
  read:options=>fetchJson(`/api/competitions/${context.definition.id}/seasons/${context.selectedSeason}`,options),
  validate:payload=>validateAuthoritativeSeason(payload,context,manifest),
  commit:source=>commit(adaptAuthoritativeSeason(source,context,manifest),context.revision)
 });
}
;
 if(!viewed||!(zeroEntrants||[1,2].includes(w.seasonNumber))||!object(d)||d.season!==input.selectedSeason||d.rulesVersion!==definition.rules.version||input.reason!==null||
    p?.kind!=='authoritative'||p.resultAuthority!==authority||typeof p.sourceRef!=='string'||!new RegExp(sourcePattern).test(p.sourceRef)||
    (input.status==='available')!==(viewed.phase==='closed'))fail();
 const catalog=clubCatalog(manifest),ids=d.participants;
 if(!Array.isArray(ids)||ids.length!==definition.capacity||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)||!catalog.has(id))||
    definition.category==='domestic'&&ids.some(id=>!id.startsWith(definition.id.split('-')[0]+'-')))fail();
 if(entrantsOnly){
  // Membership confirmation has no schedule, result, rank or archived history.
  if(input.status!=='partial'||viewed.phase!=='active'||viewed.day<1||viewed.day>12||
     Object.keys(d).sort().join(',')!=='entrantsOnly,participants,rulesVersion,season,seasonState'||
     !object(d.seasonState)||d.seasonState.day!==viewed.day||d.seasonState.phase!==viewed.phase)fail();
  return freeze(structuredClone(input));
 }
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
 if(!object(stats)||stats.matchesPlayed!==played.length||stats.totalGoals!==goals||stats.goalsPerMatch!==(played.length?goals/played.length:0)||!Array.isArray(stats.players)||stats.playerStatus!=='available'||
    !Array.isArray(stats.teams)||stats.teams.length!==ids.length||new Set(stats.teams.map(t=>t.clubId)).size!==ids.length)fail();
 for(const row of stats.teams){const t=allTotals.get(row.clubId);if(!t||Object.keys(t).some(k=>row[k]!==t[k])||row.goalDifference!==t.goalsFor-t.goalsAgainst)fail()}
 const playerIdentity=new Set(),playerTotals=new Map();
 for(const p of stats.players){
  if(!object(p)||!count(p.playerId)||p.playerId===0||!ids.includes(p.clubId)||
     !count(p.appearances)||p.appearances===0||!count(p.starts)||p.starts!==p.appearances||
     // Frozen V2 appearances may be substituted before 90'; each counted
     // appearance contributes 1..120 playing minutes, never a mandatory 90.
     !count(p.minutes)||p.minutes<p.appearances||p.minutes>120*p.appearances||
     !count(p.goals))fail();
  const identity=p.clubId+':'+p.playerId;
  if(playerIdentity.has(identity))fail();playerIdentity.add(identity);
  // One player cannot appear more often than their club has played, but
  // eleven DISTINCT starters may each appear in that same match.
  const team=allTotals.get(p.clubId);
  if(!team||p.appearances>team.played)fail();
  const total=playerTotals.get(p.clubId)??{appearances:0,goals:0};
  total.appearances+=p.appearances;total.goals+=p.goals;
  playerTotals.set(p.clubId,total);
 }
 for(const [clubId,p] of playerTotals){
  const t=allTotals.get(clubId);
  if(!t||p.appearances>11*t.played||p.goals>t.goalsFor)fail();
 }
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
 if(d.entrantsOnly===true){
  // Approved membership is stored in ID order, but unranked entrants are presented by primary name.
  participants.sort((a,b)=>a.primaryName.localeCompare(b.primaryName,'en',{sensitivity:'base'})||key(a).localeCompare(key(b),'en'));
  const standings=participants.map(club=>({club,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0,recent:[]}));
  return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,entrantsOnly:true,fixtures:null,
   postseason:[],results:[],statistics:{standings,overview:{matchesPlayed:0,totalGoals:0,goalsPerMatch:0},teams:[],players:[]},
   status:source.status,history:null,
   provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},
   world:source.world,seasonState:viewedSeasonState(source),currentMatchday:null});
 }
 const club=id=>definition.category==='international'?id:catalog.get(id).clubId;
 const fixtures=d.fixtures.map(f=>({sourceFixtureId:f.id,marker:f.marker,day:f.day,
  round:f.round,phaseId:f.phaseId,tieId:f.tieId,leg:f.leg,neutral:f.neutral,
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
 const completedMatches=(id,all=false)=>d.fixtures.filter(f=>(all||f.phaseId==='league')&&f.result!==null&&[f.homeClubId,f.awayClubId].includes(id)).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 const resultFor=(id,f)=>{
  const home=f.homeClubId===id,own=home?f.result.homeGoals:f.result.awayGoals,other=home?f.result.awayGoals:f.result.homeGoals;
  return own>other?'W':own<other?'L':'D';
 };
 // Chronological form letters serve the team leaderboard. The compact table
 // needs verified fixture metadata, most recent match first.
 const recent=(id,all=false)=>completedMatches(id,all).map(f=>resultFor(id,f));
 const recentDetails=id=>completedMatches(id).slice(-5).reverse().map(f=>({
  result:resultFor(id,f),round:f.round,homeId:club(f.homeClubId),awayId:club(f.awayClubId)
 }));
 const statistics={overview:{matchesPlayed:d.statistics.matchesPlayed,totalGoals:d.statistics.totalGoals,goalsPerMatch:d.statistics.goalsPerMatch},
  standings:d.standings.rows.map(r=>({club:catalog.get(r.clubId),played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.goalsFor,ga:r.goalsAgainst,gd:r.goalDifference,pts:r.points,recent:recentDetails(r.clubId)})),
  teams:d.statistics.teams.map(t=>{const form=recent(t.clubId,true),lastLoss=form.lastIndexOf('L');return {clubKey:t.clubId,clubName:catalog.get(t.clubId).primaryName,mp:t.played,gf:t.goalsFor,ga:t.goalsAgainst,w:t.won,cs:t.cleanSheets,ppg:t.played?(3*t.won+t.drawn)/t.played:0,gd:t.goalDifference,unbeatenStreak:form.length-lastLoss-1}}),players:[]};
 const currentChoice=viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?
  globalThis.faCompetitionRules.currentFixtureChoice(definition,globalThis.faWorldCalendarModel.projectCompetition(d.season,definition.id),{current:{season:source.world.seasonNumber,day:source.world.day}}):null;
 return freeze({season:d.season,rulesVersion:d.rulesVersion,participants,fixtures:definition.category==='international'?fixtures:fixtures.filter(f=>f.phaseId==='league'),postseason,results,statistics,status:source.status,
  history:d.history?{season:d.history.season,archiveHash:d.history.archiveHash,closedAt:d.history.closedAt,championClubId:d.history.championClubId}:null,
  provenance:{kind:'authoritative',sourceRef:source.provenance.sourceRef,resultAuthority:source.provenance.resultAuthority},world:source.world,seasonState:viewedSeasonState(source),
  currentMatchday:viewedSeasonState(source)?.phase==='active'&&source.world.seasonNumber===d.season?currentChoice:null});
}
/**
 * PERF-API-657 — validated immutable sporting-season snapshots, scoped to a
 * single public world generation/revision and source revision. A season viewed
 * earlier is reusable only while the authoritative world is *exactly* unchanged.
 * A confirmed canonical empty response is a valid cache entry; failed reads
 * never reach this helper.
 */
export function createCompetitionSeasonReadCache({limit=8}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>32)throw TypeError('Invalid cache limit');
 const entries=new Map();
 const cacheKey=(competitionId,season,snapshot)=>{
  const world=snapshot?.world;
  if(!/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId)||
     !Number.isSafeInteger(season)||season<1||
     snapshot?.source!=='authoritative'||snapshot.worldStatus!=='ready'||
     !Number.isSafeInteger(snapshot.sourceRevision)||snapshot.sourceRevision<0||
     !validPublicWorld(world)||season>world.seasonNumber)return null;
  return JSON.stringify([competitionId,season,snapshot.sourceRevision,
   world.generation,world.revision,world.seasonNumber,world.day,world.phase]);
 };
 return Object.freeze({
  remember({competitionId,season,snapshot,data}){
   const key=cacheKey(competitionId,season,snapshot);
   if(!key||data!==null&&(data?.provenance?.kind!=='authoritative'||
      data.season!==season||!globalThis.faWorldClockAdapter.sameWorld(data.world,snapshot.world)))
    return false;
   const copy=data===null?null:freeze(structuredClone(data));
   entries.delete(key);entries.set(key,copy);
   while(entries.size>limit)entries.delete(entries.keys().next().value);
   return true;
  },
  find({competitionId,season,snapshot}){
   const key=cacheKey(competitionId,season,snapshot);
   // The wrapper distinguishes a verified empty season from a cache miss.
   return key&&entries.has(key)?{data:entries.get(key)}:null;
  },
  clear(){entries.clear()},
  size(){return entries.size}
 });
}

export function createAuthoritativeLoader({getContext,clear,commit,isDev,fetchJson,manifest,onState=()=>{},onWorld=()=>{}}){
 let context,retained=false;
 return globalThis.faWorldClockAdapter.createSnapshotReader({
  getIdentity:()=>{const c=getContext();return c?JSON.stringify([c.definition?.id,c.selectedSeason,c.revision]):null},
  isEnabled:()=>!isDev(),clear:()=>{retained=!!getContext()?.seasonData;if(!retained)clear();context=getContext()},
  onState:state=>{if(state==='unavailable'&&retained)clear();onState(state)},
  // Reuse the authoritative global clock; the season payload carries its
  // own verified world revision and provenance.
  useSharedWorld:true,
  fetchWorld:async options=>(await fetchJson('/api/world',options))?.world,
  onBeforeWorld:onWorld,
  read:options=>fetchJson(`/api/competitions/${context.definition.id}/seasons/${context.selectedSeason}`,options),
  validate:payload=>validateAuthoritativeSeason(payload,context,manifest),
  commit:source=>commit(adaptAuthoritativeSeason(source,context,manifest),context.revision)
 });
}
