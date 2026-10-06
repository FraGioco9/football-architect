/** WRD05 — read-only historical projections built from settled official WRD01 matches.
 * Attach one compact, checksummed details object per completed league season.
 * Legacy snapshots without details remain valid, and no fixture is re-simulated.
 */
import {getLeagueClubs,LEAGUES} from '../leagues.js';
import {hashYouth} from '../addons/domain/player-youth.mjs';
import {LEAGUES as WORLD_LEAGUES} from '../leagues.js';

const fail=code=>{throw Error(`CAREER_HISTORY_${code}`);};
const validInt=n=>Number.isSafeInteger(n)&&n>=0;
const hasWorld=w=>w?.advancedV1?.enabled===true&&w.advancedV1?.worldV1?.schemaVersion===1;
const key=(a,b)=>[String(a),String(b)].sort((x,y)=>Number(x)-Number(y)).join(':');
export const OFFICIAL_HISTORY_VERSION=1;

export function buildOfficialLeagueArchive(w,league,ranking){
 const clubs=league.locked?w.teams:league.clubs;
 const players=league.locked?w.players.filter(p=>p.clubId>0||p.historicalClubId):[...league.players,...(league.departedScorers??[])];
 const rounds=league.locked?w.fixtures:league.fixtures;
 if(rounds.some(round=>round.matches.some(m=>!m.result)))fail('INCOMPLETE');
 const known=new Map(clubs.map(c=>[c.id,c]));
 const rows=ranking.map((r,i)=>({clubId:r.id,name:known.get(r.id)?.name??r.name,rank:i+1,p:r.p,w:r.w,d:r.d,l:r.l,gf:r.gf,ga:r.ga,pts:r.pts}));
 const leaderboard=new Map();
 for(const p of players.filter(p=>p.goals>0)){
  const id=p.globalId??(typeof p.id==='string'?p.id:`${league.countryId}:${p.id}`);
  const prev=leaderboard.get(id);
  if(prev){prev.goals+=p.goals;prev.apps+=p.apps;}
  else leaderboard.set(id,{id,name:p.name,clubId:p.clubId||p.historicalClubId,goals:p.goals,apps:p.apps});
 }
 const leaders=[...leaderboard.values()].sort((a,b)=>b.goals-a.goals||a.id.localeCompare(b.id)).slice(0,24);
 const matches=rounds.flatMap(r=>r.matches.map(m=>({round:r.round,home:m.home,away:m.away,homeGoals:m.result.homeGoals,awayGoals:m.result.awayGoals})));
 const scored=matches.reduce((n,m)=>n+m.homeGoals+m.awayGoals,0);
 const biggest=matches.slice().sort((a,b)=>Math.abs(b.homeGoals-b.awayGoals)-Math.abs(a.homeGoals-a.awayGoals)||a.round-b.round||a.home-b.home)[0];
 const position=new Map(rows.map(r=>[r.clubId,r.rank]));
 const rivalries=[];
 for(let i=0;i<clubs.length;i++)for(let j=i+1;j<clubs.length;j++){
  const a=clubs[i],b=clubs[j],city=String(a.city||'').trim().toLocaleLowerCase()===String(b.city||'').trim().toLocaleLowerCase()&&!!a.city;
  const proximity=Math.abs(position.get(a.id)-position.get(b.id));
  if(!city&&proximity>2)continue;
  const meetings=matches.filter(m=>key(m.home,m.away)===key(a.id,b.id));
  if(!meetings.length)continue;
  const entry={a:a.id,b:b.id,kind:city?'city':'sporting',city:city?a.city:null,meetings:meetings.length,winsA:0,winsB:0,draws:0,goalsA:0,goalsB:0};
  for(const m of meetings){const ga=m.home===a.id?m.homeGoals:m.awayGoals,gb=m.home===a.id?m.awayGoals:m.homeGoals;
   entry.goalsA+=ga;entry.goalsB+=gb;if(ga>gb)entry.winsA++;else if(ga<gb)entry.winsB++;else entry.draws++;}
  rivalries.push({...entry,closeness:proximity});
 }
 rivalries.sort((a,b)=>(a.kind===b.kind?0:a.kind==='city'?-1:1)||a.closeness-b.closeness||a.a-b.a||a.b-b.b);
 const compactRivalries=rivalries.slice(0,14).map(({closeness,...entry})=>entry);
 const top=leaders[0]?.goals??0;
 const data={version:OFFICIAL_HISTORY_VERSION,countryId:league.countryId,rows,leaders,
  awards:{championId:rows[0]?.clubId??null,topScorerIds:top?leaders.filter(p=>p.goals===top).map(p=>p.id):[]},
  summary:{matches:matches.length,goals:scored,biggestWin:biggest?{...biggest}:null},rivalries:compactRivalries};
 return {...data,digest:hashYouth(JSON.stringify(data))};
}

/** Validation runs on import, IndexedDB hydration and post-season commits.
 * Reject truncated/tampered WRD05 snapshots, but accept un-enriched WRD01 saves.
 */
export function validateOfficialLeagueArchive(details,legacy,countryId){
 if(!details||details.version!==1||details.countryId!==countryId||!validInt(details.digest)||!Array.isArray(details.rows)||!Array.isArray(details.leaders)||!Array.isArray(details.rivalries)||!details.summary||!details.awards)return false;
 const {digest,...raw}=details;if(hashYouth(JSON.stringify(raw))!==digest)return false;
 const ids=new Set();
 if(details.rows.length!==legacy.table?.length)return false;
 for(const [i,r] of details.rows.entries()){
  const base=legacy.table[i];if(r.clubId!==base.id||r.name!==base.name||r.pts!==base.pts||r.p!==base.p||r.rank!==i+1||ids.has(r.clubId)||![r.p,r.w,r.d,r.l,r.gf,r.ga,r.pts].every(validInt)||r.p!==r.w+r.d+r.l)return false;ids.add(r.clubId);
 }
 if(details.awards.championId!==legacy.championId||!Array.isArray(details.awards.topScorerIds))return false;
 if(!validInt(details.summary.matches)||!validInt(details.summary.goals)||details.leaders.length>24||details.rivalries.length>14)return false;
 for(const p of details.leaders)if(typeof p.id!=='string'||!WORLD_LEAGUES.some(league=>p.id.startsWith(league.id+':'))||!ids.has(p.clubId)||typeof p.name!=='string'||![p.goals,p.apps].every(validInt))return false;
 for(const r of details.rivalries)if(!ids.has(r.a)||!ids.has(r.b)||r.a===r.b||!['city','sporting'].includes(r.kind)||![r.meetings,r.winsA,r.winsB,r.draws,r.goalsA,r.goalsB].every(validInt)||r.meetings!==r.winsA+r.winsB+r.draws)return false;
 return true;
}

export function officialArchive(w,country=w?.countryId,season=null){
 if(!hasWorld(w))return null;
 const world=w.advancedV1.worldV1;
 const h=season===null?world.history.at(-1):world.history.find(x=>x.season===season);
 return h?{season:h.season,...h.leagues.find(l=>l.countryId===country)}:null;
}
export function officialHistorySeasons(w){return hasWorld(w)?w.advancedV1.worldV1.history.map(s=>s.season):[];}
export function officialHonours(w,country,clubId=null){
 if(!hasWorld(w))return [];
 return w.advancedV1.worldV1.history.flatMap(h=>h.leagues.filter(l=>l.countryId===country&&(clubId===null||l.championId===clubId))
  .map(l=>({season:h.season,countryId:country,clubId:l.championId,clubName:l.table.find(x=>x.id===l.championId)?.name??'',scorer:l.details?.leaders[0]??l.topScorers?.[0]??null,verified:l.details!==undefined})));
}
export function officialClubHistory(w,country,clubId){
 if(!hasWorld(w))return [];
 return w.advancedV1.worldV1.history.flatMap(h=>h.leagues.filter(l=>l.countryId===country).map(l=>{
  const row=l.details?.rows.find(x=>x.clubId===clubId),legacy=l.table.find(x=>x.id===clubId);
  return legacy?{season:h.season,clubId,rank:row?.rank??l.table.findIndex(x=>x.id===clubId)+1,points:legacy.pts,played:legacy.p,
   wins:row?.w??null,goalsFor:row?.gf??null,goalsAgainst:row?.ga??null,champion:l.championId===clubId,verified:!!row}:null;
 }).filter(Boolean));
}
export function officialPlayerHistory(w,country,playerId){
 if(!hasWorld(w))return [];
 return w.advancedV1.worldV1.history.flatMap(h=>h.leagues.filter(l=>l.countryId===country).flatMap(l=>{
  const p=l.details?.leaders?.find(x=>x.id===playerId)||l.topScorers?.find(x=>x.id===playerId);
  return p?[{season:h.season,...p}]:[];
 }));
}
export function officialRecords(w,country,{throughSeason=null}={}){
 if(!hasWorld(w))return [];
 const records=[];
 for(const h of w.advancedV1.worldV1.history){if(throughSeason!==null&&h.season>throughSeason)break;
  const l=h.leagues.find(x=>x.countryId===country);if(!l?.details)continue;
  for(const row of l.details.rows){records.push({season:h.season,type:'points',value:row.pts,clubId:row.clubId,name:row.name});records.push({season:h.season,type:'goals',value:row.gf,clubId:row.clubId,name:row.name});records.push({season:h.season,type:'wins',value:row.w,clubId:row.clubId,name:row.name});}
  for(const p of l.details.leaders)records.push({season:h.season,type:'scorer',value:p.goals,playerId:p.id,clubId:p.clubId,name:p.name});
 }
 return ['points','goals','wins','scorer'].map(type=>records.filter(r=>r.type===type).sort((a,b)=>b.value-a.value||a.season-b.season||String(a.name).localeCompare(String(b.name)))[0]).filter(Boolean);
}
export function officialRivalries(w,country,{throughSeason=null,limit=10}={}){
 if(!hasWorld(w))return [];
 const map=new Map();
 for(const h of w.advancedV1.worldV1.history){if(throughSeason!==null&&h.season>throughSeason)continue;
  const l=h.leagues.find(x=>x.countryId===country);if(!l?.details)continue;
  for(const r of l.details.rivalries){const k=key(r.a,r.b),old=map.get(k);
   if(!old)map.set(k,{...r,seasons:1});else{old.meetings+=r.meetings;old.winsA+=r.winsA;old.winsB+=r.winsB;old.draws+=r.draws;old.goalsA+=r.goalsA;old.goalsB+=r.goalsB;old.seasons++;if(r.kind==='city')old.kind='city';}
  }
 }
 return [...map.values()].sort((a,b)=>(a.kind===b.kind?0:a.kind==='city'?-1:1)||b.meetings-a.meetings||a.a-b.a).slice(0,limit);
}
/** Fictional metadata from the league catalog, not a claim about real clubs. */
export function officialClubNarrative(w,country,clubId,lang='it',throughSeason=null){
 const c=officialClubIdentity(w,country,clubId);if(!c)return '';
 const seasons=officialClubHistory(w,country,clubId).filter(x=>throughSeason===null||x.season<=throughSeason);
 const championYears=seasons.filter(s=>s.champion).map(s=>s.season);
 const best=seasons.length?Math.min(...seasons.map(s=>s.rank)):null;
 const english=lang==='en';
 if(english)return `${c.name} is a fictional club based in ${c.city}. Its fictional founding year is ${c.founded??'not available'}. ${seasons.length?`Across ${seasons.length} recorded completed seasons, its highest finish is ${best}.`: 'No completed seasons are yet recorded.'} ${championYears.length?`Recorded league titles: ${championYears.length}, in season${championYears.length===1?'':'s'} ${championYears.join(', ')}.`:'No league title is recorded.'} No real-world club history is implied.`;
 return `${c.name} è una società immaginaria di ${c.city}, fondata nel ${c.founded??'periodo non registrato'} (data fittizia). ${seasons.length?`Nelle ${seasons.length} stagioni concluse registrate il miglior piazzamento è ${best}°.`:'Non risultano ancora stagioni concluse.'} ${championYears.length?`Titoli in campionato registrati: ${championYears.length}, nelle stagioni ${championYears.join(', ')}.`:'Non risultano titoli in campionato.'} Nessun riferimento alla storia di club reali.`;
}
export function officialClubIdentity(w,country,clubId){
 const c=getLeagueClubs(country).find(c=>c.id===clubId);
 if(!c)return null;
 const titles=officialHonours(w,country,clubId).length;
 return {id:c.id,name:c.name,city:c.city,founded:c.founded??null,colors:c.colors??['#42dcb0','#135546'],reputation:c.reputation??null,titles};
}
