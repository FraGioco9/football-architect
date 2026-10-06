/** WRD01.01–06: deterministic, opt-in global multi-league universe.
 * The legacy career is never implicitly converted or written back.
 */
import {countryKey,YOUTH_COUNTRIES,hashYouth} from './player-youth.mjs';
import {createSeasonArchive,validateSeasonArchive} from './world-history.mjs';
import {BUILT_IN_STYLES} from './team-tactics.mjs';
import {makeCoach} from './ai-coach.mjs';
import {createTacticalSession,finishTacticalSession,summarizeTacticalSession} from './team-tactics-match.mjs';
export const UNIVERSE_SCHEMA=1;
export const EIGHT_COUNTRIES=Object.freeze(['IT','ENG','ESP','GER','FRA','NED','POR','BEL']);
const bad=k=>{throw Error(`WRD01_${k}`);};
const safe=x=>Number.isSafeInteger(x);
const id=x=>typeof x==='string'&&x.trim()&&x.length<=120&&!['__proto__','prototype','constructor'].includes(x)?x:null;
const clone=x=>structuredClone(x);
const unique=list=>new Set(list).size===list.length;
const textMeta=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
// Global IDs never change on international transfers. Their country prefix denotes genesis, not current registration.
const globalPlayerId=x=>id(x)&&EIGHT_COUNTRIES.some(code=>x.startsWith(code+':'));
const finite100=x=>typeof x==='number'&&Number.isFinite(x)&&x>=1&&x<=100;
const checkDay=x=>safe(x)&&x>=0&&x<=300000;
const digest=(fixture,result)=>hashYouth(JSON.stringify([fixture.id,result.home,result.away,result.shotsHome,result.shotsAway,result.xgHome,result.xgAway,result.possessionHome,result.foulsHome,result.foulsAway,result.goals,result.seed]));
const compact=p=>({id:String(p.id),name:String(p.name??p.fullName??p.id).slice(0,120),position:String(p.position??p.pos??'CM').slice(0,12),ovr:Number(p.ovr??p.overall??50)});
function normalizeClubs(raw,country){
 if(!Array.isArray(raw)||raw.length<2||raw.length>30||raw.length%2)bad('CLUB_COUNT');
 const used=new Set(),players=new Set();
 return raw.map(c=>{
  const local=id(String(c.id??''));if(!local||used.has(local))bad('CLUB_ID');used.add(local);
  const key=`${country}:${local}`;
  if(!Array.isArray(c.players??c.squad??[]))bad('PLAYERS');
  const squad=(c.players??c.squad??[]).map(p=>{
   const playerId=id(String(p.id??''));if(!playerId)bad('PLAYER_ID');
   const pid=`${country}:${playerId}`;if(players.has(pid))bad('PLAYER_DUPLICATE');players.add(pid);
   const x=compact(p);if(!finite100(x.ovr))bad('PLAYER_OVR');return {...clone(p),...x,id:pid,sourceId:playerId,clubId:key};
  });
  const strength=c.strength??(squad.length?squad.reduce((a,b)=>a+b.ovr,0)/squad.length:65);
  if(!finite100(strength))bad('STRENGTH');
  const city=typeof c.city==='string'&&c.city.trim()&&c.city.length<=100?c.city.trim():null;
  const foundedYear=Number.isSafeInteger(c.foundedYear)&&c.foundedYear>=1800&&c.foundedYear<=2026?c.foundedYear:null;
  const colors=Array.isArray(c.colors)&&c.colors.length===2&&c.colors.every(v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v))?[...c.colors]:null;
  return {id:key,sourceId:local,countryId:country,name:String(c.name??local).slice(0,120),strength:Number(strength.toFixed(2)),players:squad,...(city?{city}:{}),...(foundedYear?{foundedYear}:{}),...(colors?{colors}:{})};
 });
}
/** Berger circle schedule; exact home/away flip for reverse fixtures. */
export function roundRobin(clubIds){
 if(!Array.isArray(clubIds)||clubIds.length<2||clubIds.length>30||clubIds.length%2||!clubIds.every(id)||!unique(clubIds))bad('ROUND_INPUT');
 const n=clubIds.length,ring=[...clubIds],first=[];
 for(let r=0;r<n-1;r++){
  const matches=[];
  for(let j=0;j<n/2;j++){
   const left=ring[j],right=ring[n-1-j];
   matches.push((r+j)%2===0?[left,right]:[right,left]);
  }
  first.push(matches);ring.splice(1,0,ring.pop());
 }
 return [...first,...first.map(round=>round.map(([h,a])=>[a,h]))];
}
function fixturesFor(clubs,country,season,firstDay,roundDays){
 const pairs=roundRobin(clubs.map(c=>c.id));
 if(roundDays!==undefined&&(!Array.isArray(roundDays)||roundDays.length!==pairs.length||roundDays.some((x,i)=>!checkDay(x)||(i&&x<=roundDays[i-1]))))bad('ROUND_DAYS');
 return pairs.map((round,r)=>({round:r+1,day:roundDays?.[r]??firstDay+r*7,matches:round.map(([home,away],j)=>({id:`${season}:${country}:${r+1}:${j+1}`,home,away,result:null}))}));
}
export function createUniverse({leagues,seed=1,season=1,firstDay=0,activeCountry='IT',legacyLockedCountry=null}={}){
 if(!safe(seed)||seed<0||seed>0xffffffff||!safe(season)||season<1||season>500||!checkDay(firstDay))bad('SEED_SEASON');
 if(!Array.isArray(leagues)||leagues.length!==8)bad('EIGHT_LEAGUES');
 const active=countryKey(activeCountry),lock=legacyLockedCountry==null?null:countryKey(legacyLockedCountry);
 const keys=leagues.map(l=>countryKey(l.countryId));if(!unique(keys)||keys.some(k=>!EIGHT_COUNTRIES.includes(k)))bad('COUNTRY_SET');
 const ordered=EIGHT_COUNTRIES.map(code=>{
  const raw=leagues[keys.indexOf(code)];const clubs=normalizeClubs(raw.clubs,code);const locked=code===lock;
  const rounds=locked?[]:fixturesFor(clubs,code,season,firstDay+(raw.startOffsetDays??0),raw.roundDays);
  return {id:`league:${code}`,countryId:code,name:String(raw.name??`League ${code}`).slice(0,120),season,clubs,rounds,lockedLegacy:locked};
 });
 const data={schemaVersion:UNIVERSE_SCHEMA,seed,season,day:firstDay,revision:0,activeCountry:active,leagues:ordered,history:[]};
 validateUniverse(data);return data;
}
export function validateUniverse(w){
 if(!w||w.schemaVersion!==1||!safe(w.seed)||w.seed<0||w.seed>0xffffffff||!safe(w.season)||w.season<1||w.season>500||!checkDay(w.day)||!safe(w.revision)||w.revision<0||!EIGHT_COUNTRIES.includes(w.activeCountry))bad('WORLD_HEADER');
 if(!Array.isArray(w.leagues)||w.leagues.length!==8||w.leagues.some((l,i)=>l.countryId!==EIGHT_COUNTRIES[i]))bad('COUNTRIES');
 if(!Array.isArray(w.history)||w.history.length>500)bad('HISTORY');
 let prevSeason=0;
 for(const h of w.history){
  if(!safe(h?.season)||h.season<=prevSeason||h.season>=w.season||!Array.isArray(h.leagues)||h.leagues.length!==8)bad('HISTORY_SEASONS');
  prevSeason=h.season;
  if(h.schemaVersion===2){try{validateSeasonArchive(h);}catch{bad('HISTORY_INTEGRITY');}}
  else if(h.schemaVersion!==undefined||h.leagues.some((l,i)=>l.countryId!==EIGHT_COUNTRIES[i]||typeof l.lockedLegacy!=='boolean'||l.table!==null&&!Array.isArray(l.table)))bad('HISTORY_LEGACY');
 }
 const clubsGlobal=new Set(),playersGlobal=new Set(),matchesGlobal=new Set();
 for(const l of w.leagues){
  if(l.id!==`league:${l.countryId}`||l.season!==w.season||typeof l.name!=='string'||!Array.isArray(l.clubs)||l.clubs.length%2||l.clubs.length<2||l.clubs.length>30||!Array.isArray(l.rounds)||typeof l.lockedLegacy!=='boolean')bad('LEAGUE');
  const local=new Set();
  for(const c of l.clubs){
   if(!id(c.id)||!c.id.startsWith(l.countryId+':')||clubsGlobal.has(c.id)||local.has(c.id)||!finite100(c.strength)||!Array.isArray(c.players)||c.city!==undefined&&(!textMeta(c.city,100))||c.foundedYear!==undefined&&(!safe(c.foundedYear)||c.foundedYear<1800||c.foundedYear>2026)||c.colors!==undefined&&(!Array.isArray(c.colors)||c.colors.length!==2||!c.colors.every(x=>typeof x==='string'&&/^#[0-9a-fA-F]{6}$/.test(x))))bad('CLUB');
   local.add(c.id);clubsGlobal.add(c.id);
   for(const p of c.players){if(!id(p.id)||!globalPlayerId(p.id)||playersGlobal.has(p.id)||!finite100(p.ovr))bad('PLAYER');playersGlobal.add(p.id);}
  }
  if(l.lockedLegacy){if(l.rounds.length)bad('LEGACY_FIXTURES');continue;}
  if(l.rounds.length!==(l.clubs.length-1)*2)bad('ROUND_COUNT');
  const pairs=new Set();let previous=-1;
  for(const [i,r] of l.rounds.entries()){
   if(r.round!==i+1||!checkDay(r.day)||r.day<=previous||!Array.isArray(r.matches)||r.matches.length!==l.clubs.length/2)bad('ROUND');previous=r.day;
   const playing=new Set();
   for(const m of r.matches){
    if(!id(m.id)||matchesGlobal.has(m.id)||!local.has(m.home)||!local.has(m.away)||m.home===m.away||playing.has(m.home)||playing.has(m.away))bad('FIXTURE');
    playing.add(m.home);playing.add(m.away);matchesGlobal.add(m.id);pairs.add(`${m.home}|${m.away}`);
    if(m.result!==null){
     const x=m.result;
     if(r.day>w.day||!x||!safe(x.home)||!safe(x.away)||x.home<0||x.away<0||x.home>25||x.away>25||!safe(x.shotsHome)||!safe(x.shotsAway)||x.shotsHome<x.home||x.shotsAway<x.away||!Array.isArray(x.goals)||x.goals.length!==x.home+x.away||!safe(x.seed)||x.seed<0||x.seed>0xffffffff)bad('RESULT');
     for(const g of x.goals)if(!safe(g.second)||g.second<0||g.second>5400||![m.home,m.away].includes(g.teamId))bad('GOAL_EVENT');
     if(x.goals.filter(g=>g.teamId===m.home).length!==x.home||x.goals.filter(g=>g.teamId===m.away).length!==x.away||x.digest!==digest(m,x)||x.seed!==fixtureSeed(w,m))bad('RESULT_INTEGRITY');
     for(const g of x.goals)if(g.playerId!==null&&!globalPlayerId(g.playerId)||g.playerName!==undefined&&!textMeta(g.playerName,120))bad('SCORER');
     // Scorer attribution is historical: a player may legitimately move clubs after the fixture.
    }
   }
  }
  if(pairs.size!==l.clubs.length*(l.clubs.length-1))bad('PAIRINGS');
 }
 return true;
}
export function fixtureSeed(world,fixture){return hashYouth(`${world.seed}|${fixture.id}|${world.season}|WRD01`);}
/** Compact official match is causally resolved from SIM02's seeded event stream; same tactics/AI identity for both clubs. */
export function simulateLeagueFixture(world,league,match,{details=false}={}){
 const home=league.clubs.find(c=>c.id===match.home),away=league.clubs.find(c=>c.id===match.away);
 if(!home||!away)bad('FIXTURE_CLUB');
 const seed=fixtureSeed(world,match);
 const coach=club=>makeCoach({teamId:club.id,worldSeed:world.seed,country:league.countryId});
 const managerHome=coach(home),managerAway=coach(away);
 const session=finishTacticalSession(createTacticalSession({matchId:match.id,seed,analyticsMode:false,home:{id:home.id,strength:home.strength,tactics:BUILT_IN_STYLES[managerHome.style]},away:{id:away.id,strength:away.strength,tactics:BUILT_IN_STYLES[managerAway.style]}}));
 const summary=summarizeTacticalSession(session);
 const goals=session.events.filter(e=>e.type==='goal').map((e,i)=>{const club=e.teamId===home.id?home:away;const candidates=club.players.filter(p=>p.position!=='GK');const n=hashYouth(`${seed}|scorer|${i}`),player=candidates.length?candidates[n%candidates.length]:null;return {second:e.second,teamId:e.teamId,playerId:player?.id??null,...(player?{playerName:player.name}:{})};});
 const result={home:summary.home.goals,away:summary.away.goals,shotsHome:summary.home.shots,shotsAway:summary.away.shots,xgHome:summary.home.xg,xgAway:summary.away.xg,possessionHome:summary.possessionPct.home,foulsHome:summary.home.fouls,foulsAway:summary.away.fouls,goals,seed};
 result.digest=digest(match,result);
 return details?{result,events:session.events}:result;
}
export function advanceUniverse(world,{toDay,expectedRevision=world.revision}={}){
 validateUniverse(world);
 if(expectedRevision!==world.revision)bad('REVISION_CONFLICT');
 if(!checkDay(toDay)||toDay<world.day)bad('DAY_REWIND');
 if(toDay===world.day){return clone(world);}
 const next=clone(world);next.day=toDay;
 for(const league of next.leagues){if(league.lockedLegacy)continue;
  for(const round of league.rounds){if(round.day>toDay)break;for(const m of round.matches)if(m.result===null)m.result=simulateLeagueFixture(next,league,m);}
 }
 next.revision++;validateUniverse(next);return next;
}
export function nextFixtureDay(world){validateUniverse(world);let soon=Infinity;for(const l of world.leagues)for(const r of l.rounds)if(r.day>=world.day&&r.matches.some(m=>m.result===null))soon=Math.min(soon,r.day);return Number.isFinite(soon)?soon:null;}
export function advanceUniverseNext(world,options={}){
 const day=nextFixtureDay(world);return day===null?clone(world):advanceUniverse(world,{...options,toDay:Math.max(world.day+1,day)});
}
export function leagueTable(world,country){validateUniverse(world);const league=world.leagues.find(l=>l.countryId===countryKey(country));if(!league)bad('LEAGUE_UNKNOWN');
 const rows=new Map(league.clubs.map(c=>[c.id,{id:c.id,name:c.name,played:0,wins:0,draws:0,losses:0,for:0,against:0,points:0}]));
 for(const round of league.rounds)for(const m of round.matches){if(m.result===null)continue;const h=rows.get(m.home),a=rows.get(m.away),r=m.result;h.played++;a.played++;h.for+=r.home;h.against+=r.away;a.for+=r.away;a.against+=r.home;
  if(r.home===r.away){h.draws++;a.draws++;h.points++;a.points++;}else if(r.home>r.away){h.wins++;a.losses++;h.points+=3;}else{a.wins++;h.losses++;a.points+=3;}
 }
 return [...rows.values()].map(r=>({...r,diff:r.for-r.against})).sort((a,b)=>b.points-a.points||b.diff-a.diff||b.for-a.for||a.name.localeCompare(b.name));
}
export function leagueResults(world,country,{includeUnplayed=false}={}){validateUniverse(world);const l=world.leagues.find(x=>x.countryId===countryKey(country));return l.rounds.flatMap(r=>r.matches.filter(m=>includeUnplayed||m.result).map(m=>({...m,day:r.day,round:r.round})));}
export function leagueScorers(world,country,{limit=20}={}){
 validateUniverse(world);const l=world.leagues.find(x=>x.countryId===countryKey(country));const names=new Map(l.clubs.flatMap(c=>c.players.map(p=>[p.id,{id:p.id,name:p.name,clubId:c.id,clubName:c.name,goals:0}])));
 const clubNames=new Map(l.clubs.map(c=>[c.id,c.name]));
 for(const round of l.rounds)for(const m of round.matches)for(const g of m.result?.goals??[])if(g.playerId){if(!names.has(g.playerId))names.set(g.playerId,{id:g.playerId,name:g.playerName??g.playerId,clubId:g.teamId,clubName:clubNames.get(g.teamId)??g.teamId,goals:0});names.get(g.playerId).goals++;}
 return [...names.values()].filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name)).slice(0,limit);
}
export function replayLeagueFixture(world,country,matchId){
 validateUniverse(world);const l=world.leagues.find(x=>x.countryId===countryKey(country));const m=l.rounds.flatMap(r=>r.matches).find(x=>x.id===matchId);if(!m||!m.result)bad('REPLAY_NOT_PLAYED');
 const replay=simulateLeagueFixture(world,l,m,{details:true});if(JSON.stringify(replay.result)!==JSON.stringify(m.result)){
  // Old fixtures need not have an immutable roster snapshot; match statistics and event sequence
  // remain seed-deterministic, but scorer candidates may have transferred since kick-off.
  const recorded=m.result,recomputed=replay.result;
  for(const key of ['home','away','shotsHome','shotsAway','xgHome','xgAway','possessionHome','foulsHome','foulsAway','seed'])if(recorded[key]!==recomputed[key])bad('REPLAY_DIVERGED');
  if(recorded.goals.length!==recomputed.goals.length||recorded.goals.some((g,i)=>g.second!==recomputed.goals[i].second||g.teamId!==recomputed.goals[i].teamId))bad('REPLAY_DIVERGED');
  return {result:clone(recorded),events:replay.events,scorerAttribution:'historical_record'};
 }return replay;
}
export function worldSearch(world,search,{limit=30}={}){validateUniverse(world);const q=String(search??'').trim().toLocaleLowerCase();if(q.length<1)return [];const out=[];
 for(const l of world.leagues)for(const c of l.clubs){if(c.name.toLocaleLowerCase().includes(q))out.push({type:'club',countryId:l.countryId,id:c.id,name:c.name});for(const p of c.players)if(p.name.toLocaleLowerCase().includes(q))out.push({type:'player',countryId:l.countryId,id:p.id,name:p.name,clubId:c.id});}
 return out.slice(0,Math.min(100,Math.max(0,limit)));
}
export function advanceUniverseSeason(world,{firstDay,expectedRevision=world.revision}={}){
 validateUniverse(world);if(expectedRevision!==world.revision)bad('REVISION_CONFLICT');
 if(world.leagues.some(l=>!l.lockedLegacy&&l.rounds.some(r=>r.matches.some(m=>m.result===null))))bad('SEASON_INCOMPLETE');
 if(world.season>=500)bad('SEASON_LIMIT');const start=firstDay??world.day+21;if(!checkDay(start)||start<=world.day)bad('SEASON_START');
 const history=createSeasonArchive(world);
 const updated=clone(world);updated.history.push(history);updated.season++;updated.day=start;updated.revision++;
 for(const l of updated.leagues){l.season=updated.season;if(!l.lockedLegacy)l.rounds=fixturesFor(l.clubs,l.countryId,updated.season,start);}
 validateUniverse(updated);return updated;
}
export function exportUniverse(world){validateUniverse(world);return JSON.stringify(world);}
export function importUniverse(text){if(typeof text!=='string'||text.length>80_000_000)bad('IMPORT_SIZE');let world;try{world=JSON.parse(text);}catch{bad('JSON');}validateUniverse(world);return world;}
/** Legacy v1.4 is preserved verbatim, and its country is NEVER replayed. */
export function extendLegacyCareer(legacy,otherLeagues,{countryId,seed=1,explicitConsent=false}={}){
 if(!explicitConsent)bad('LEGACY_EXPLICIT_CONSENT');
 const code=countryKey(countryId??legacy?.countryId??legacy?.country);
 if(!EIGHT_COUNTRIES.includes(code)||!legacy||!Array.isArray(legacy.clubs??legacy.teams))bad('LEGACY_SCHEMA');
 const source=clone(legacy);
 if(!Array.isArray(otherLeagues)||otherLeagues.length!==7)bad('OTHER_SEVEN');
 const leagues=[{countryId:code,clubs:legacy.clubs??legacy.teams},...otherLeagues];
 const universe=createUniverse({leagues,seed,activeCountry:code,legacyLockedCountry:code});
 return {legacy:source,universe,legacyCountryId:code,notice:'Legacy competition is locked and unchanged; it remains authoritative.'};
}
