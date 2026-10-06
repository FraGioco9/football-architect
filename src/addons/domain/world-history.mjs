/** WRD05.01–05: evidence-backed, compact, immutable season archive.
 * Only settled WRD01 league events can produce winners, scorers or head-to-head facts.
 * Cup results and promotions remain unavailable until their engines exist.
 */
import {EIGHT_COUNTRIES,validateUniverse,leagueTable,leagueScorers} from './world-leagues.mjs';
import {hashYouth} from './player-youth.mjs';
export const HISTORY_SCHEMA_VERSION=2;
const fail=code=>{throw Error(`WRD05_${code}`);};
const copy=v=>structuredClone(v);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const text=(v,max=160)=>typeof v==='string'&&v.length>0&&v.length<=max;
const fingerprint=x=>hashYouth(JSON.stringify(x)); // corruption detection, NOT authentication
const pairKey=(a,b)=>[a,b].sort().join('|');
const archivedLeagues=world=>world.history.flatMap(h=>h.leagues.map(l=>({...l,season:h.season})));
const standingIdentity=t=>t.map(r=>({id:r.id,name:r.name,played:r.played,wins:r.wins,draws:r.draws,losses:r.losses,for:r.for,against:r.against,diff:r.diff,points:r.points}));

function compactRivalries(league,table){
 const ranks=new Map(table.map((r,i)=>[r.id,i]));
 const clubMap=new Map(league.clubs.map(c=>[c.id,c]));
 const all=[];
 for(let i=0;i<league.clubs.length;i++)for(let j=i+1;j<league.clubs.length;j++){
  const a=league.clubs[i],b=league.clubs[j];
  const derby=!!(a.city&&b.city&&a.city.trim().toLocaleLowerCase()===b.city.trim().toLocaleLowerCase());
  const close=Math.abs(ranks.get(a.id)-ranks.get(b.id));
  if(!derby&&close>2)continue;
  const games=league.rounds.flatMap(r=>r.matches.filter(m=>m.result&&pairKey(m.home,m.away)===pairKey(a.id,b.id)));
  const record={a:a.id,b:b.id,kind:derby?'city':'sporting',city:derby?a.city:null,meetings:games.length,winsA:0,winsB:0,draws:0,goalsA:0,goalsB:0};
  for(const m of games){const left=m.home===a.id?m.result.home:m.result.away,right=m.home===a.id?m.result.away:m.result.home;
   record.goalsA+=left;record.goalsB+=right;if(left>right)record.winsA++;else if(right>left)record.winsB++;else record.draws++;}
  all.push({...record,closeness:close});
 }
 return all.sort((a,b)=>(a.kind===b.kind?0:a.kind==='city'?-1:1)||a.closeness-b.closeness||pairKey(a.a,a.b).localeCompare(pairKey(b.a,b.b)))
  .slice(0,Math.max(12,league.clubs.length*2)).map(({closeness,...r})=>r);
}
/** Build a factually supported immutable snapshot. This does not advance the world. */
export function createSeasonArchive(world){
 validateUniverse(world);
 for(const league of world.leagues)if(!league.lockedLegacy&&league.rounds.some(r=>r.matches.some(m=>!m.result)))fail('SEASON_INCOMPLETE');
 const leagues=world.leagues.map(league=>{
  if(league.lockedLegacy)return {countryId:league.countryId,lockedLegacy:true,table:null,scorers:[],championId:null,awards:{},rivalries:[]};
  const table=standingIdentity(leagueTable(world,league.countryId));
  const scorers=leagueScorers(world,league.countryId,{limit:Number.MAX_SAFE_INTEGER})
   .map(p=>({id:p.id,name:p.name,clubId:p.clubId,goals:p.goals}));
  const best=scorers[0]?.goals??0;
  return {countryId:league.countryId,lockedLegacy:false,table,scorers,championId:table[0]?.id??null,
   awards:{champion:table[0]?.id??null,topScorers:best?scorers.filter(p=>p.goals===best).map(p=>p.id):[]},
   rivalries:compactRivalries(league,table)};
 });
 const data={schemaVersion:HISTORY_SCHEMA_VERSION,season:world.season,leagues};
 data.checksum=fingerprint(data);
 validateSeasonArchive(data);
 return data;
}
/** Validate independently of the current roster: historical club/player IDs must survive transfers and retirement. */
export function validateSeasonArchive(snapshot){
 if(!snapshot||snapshot.schemaVersion!==HISTORY_SCHEMA_VERSION||!Number.isSafeInteger(snapshot.season)||snapshot.season<1||snapshot.season>500||!Array.isArray(snapshot.leagues)||snapshot.leagues.length!==8||typeof snapshot.checksum!=='number')fail('SCHEMA');
 const {checksum,...raw}=snapshot;if(fingerprint(raw)!==checksum)fail('CHECKSUM');
 for(const [i,l] of snapshot.leagues.entries()){
  if(l.countryId!==EIGHT_COUNTRIES[i]||typeof l.lockedLegacy!=='boolean'||!Array.isArray(l.scorers)||!Array.isArray(l.rivalries)||!l.awards||typeof l.awards!=='object')fail('LEAGUE');
  if(l.lockedLegacy){if(l.table!==null||l.championId!==null||l.scorers.length||l.rivalries.length||Object.keys(l.awards).length)fail('LEGACY');continue;}
  if(!Array.isArray(l.table)||l.table.length<2||l.table.length>30||l.table.length%2||l.scorers.length>1000||l.rivalries.length>60)fail('CAPACITY');
  const teamIds=new Set();let forTotal=0,againstTotal=0;
  for(const r of l.table){
   if(!text(r.id)||teamIds.has(r.id)||!text(r.name)||!['played','wins','draws','losses','for','against','points'].every(k=>integer(r[k]))||r.played!==r.wins+r.draws+r.losses||r.points!==r.wins*3+r.draws||r.diff!==r.for-r.against)fail('TABLE');
   teamIds.add(r.id);forTotal+=r.for;againstTotal+=r.against;
  }
  if(forTotal!==againstTotal||l.championId!==l.table[0].id||l.awards.champion!==l.championId||!Array.isArray(l.awards.topScorers))fail('CHAMPION');
  const playerIds=new Set();let previous=Infinity;
  for(const s of l.scorers){if(!text(s.id)||playerIds.has(s.id)||!text(s.name)||!teamIds.has(s.clubId)||!integer(s.goals)||s.goals===0||s.goals>previous)fail('SCORERS');playerIds.add(s.id);previous=s.goals;}
  if(l.scorers.reduce((n,s)=>n+s.goals,0)>forTotal||JSON.stringify(l.awards.topScorers)!==JSON.stringify(l.scorers.filter(s=>s.goals===l.scorers[0]?.goals).map(s=>s.id)))fail('GOLDEN_BOOT');
  const pairIds=new Set();
  for(const p of l.rivalries){if(!teamIds.has(p.a)||!teamIds.has(p.b)||p.a===p.b||!['city','sporting'].includes(p.kind)||(!p.city&&p.kind==='city')||!['meetings','winsA','winsB','draws','goalsA','goalsB'].every(k=>integer(p[k]))||p.meetings!==p.winsA+p.winsB+p.draws||p.meetings>2||pairIds.has(pairKey(p.a,p.b)))fail('RIVALRY');pairIds.add(pairKey(p.a,p.b));}
 }
 return true;
}
export function historySeason(world,season,country){
 validateUniverse(world);if(!Number.isSafeInteger(season)||season<1)fail('SEASON');
 if(!EIGHT_COUNTRIES.includes(country))fail('COUNTRY');
 const item=world.history.find(x=>x.season===season);
 if(!item)return null;
 const l=item.leagues.find(x=>x.countryId===country);
 return l?copy({...l,season:item.season,available:l.table!==null,rich:item.schemaVersion===HISTORY_SCHEMA_VERSION}):null;
}
/** Historical honours are derived, never copied into another source of truth. */
export function historicalHonours(world,{clubId=null,playerId=null,country=null}={}){
 validateUniverse(world);
 if(clubId!==null&&!text(clubId)||playerId!==null&&!text(playerId)||country!==null&&!EIGHT_COUNTRIES.includes(country))fail('FILTER');
 const honours=[];
 for(const h of world.history)for(const l of h.leagues){
  if(country&&l.countryId!==country||l.lockedLegacy)continue;
  if(clubId===null&&playerId===null||clubId&&l.table?.[0]?.id===clubId)honours.push({season:h.season,countryId:l.countryId,type:'champion',clubId:l.table[0].id});
  if(h.schemaVersion===HISTORY_SCHEMA_VERSION&&l.awards?.topScorers)for(const id of l.awards.topScorers)if(playerId===null&&clubId===null||playerId===id||clubId&&l.scorers.find(s=>s.id===id)?.clubId===clubId)honours.push({season:h.season,countryId:l.countryId,type:'top_scorer',playerId:id,goals:l.scorers.find(s=>s.id===id)?.goals});
 }
 return honours.sort((a,b)=>a.season-b.season||a.countryId.localeCompare(b.countryId)||a.type.localeCompare(b.type));
}
/** Records retain season and evidence so the UI can link back to the archived table. */
export function historicalRecords(world,{country=null}={}){
 validateUniverse(world);if(country!==null&&!EIGHT_COUNTRIES.includes(country))fail('COUNTRY');
 const records=[];
 const definitions=[['points','points','high'],['wins','wins','high'],['goals','for','high'],['defence','against','low'],['goal_difference','diff','high']];
 for(const l of archivedLeagues(world)){
  if(country&&l.countryId!==country||l.lockedLegacy||!l.table?.length)continue;
  for(const [type,key,direction] of definitions){
   const row=[...l.table].sort((a,b)=>(direction==='high'?b[key]-a[key]:a[key]-b[key])||a.id.localeCompare(b.id))[0];
   records.push({type,season:l.season,countryId:l.countryId,clubId:row.id,clubName:row.name,value:row[key]});
  }
  if(l.scorers?.length)records.push({type:'top_scorer',season:l.season,countryId:l.countryId,playerId:l.scorers[0].id,playerName:l.scorers[0].name,clubId:l.scorers[0].clubId,value:l.scorers[0].goals});
 }
 return records.sort((a,b)=>a.countryId.localeCompare(b.countryId)||a.type.localeCompare(b.type)||b.value-a.value||a.season-b.season);
}
/** Complete per-season club table results, including seasons without honours. */
export function historicalClubSeasons(world,clubId){
 validateUniverse(world);if(!text(clubId))fail('CLUB');
 const out=[];
 for(const h of world.history)for(const league of h.leagues){
  if(league.lockedLegacy||!league.table)continue;
  const index=league.table.findIndex(t=>t.id===clubId);if(index<0)continue;
  out.push({season:h.season,countryId:league.countryId,rank:index+1,...copy(league.table[index]),champion:index===0});
 }
 return out.sort((a,b)=>a.season-b.season);
}
/** Recorded goal totals only; unknown player stats are not estimated. */
export function historicalPlayerSeasons(world,playerId){
 validateUniverse(world);if(!text(playerId))fail('PLAYER');
 const out=[];
 for(const h of world.history)for(const l of h.leagues){
  if(l.lockedLegacy||!Array.isArray(l.scorers))continue;
  const row=l.scorers.find(p=>p.id===playerId);if(row)out.push({season:h.season,countryId:l.countryId,...copy(row)});
 }
 return out.sort((a,b)=>a.season-b.season);
}
/** All rivalry figures are sourced from recorded fixtures; never create fabricated incidents. */
export function historicalRivalries(world,country,{limit=18,untilSeason=null}={}){
 validateUniverse(world);if(!EIGHT_COUNTRIES.includes(country)||!integer(limit)||limit>100||untilSeason!==null&&(!integer(untilSeason)||untilSeason<1))fail('RIVALRIES_FILTER');
 const records=new Map();
 for(const h of world.history){if(untilSeason!==null&&h.season>untilSeason)continue;const l=h.schemaVersion===HISTORY_SCHEMA_VERSION?h.leagues.find(x=>x.countryId===country):null;
  for(const p of l?.rivalries??[]){const key=pairKey(p.a,p.b);const r=records.get(key)??{...copy(p),seasons:[]};
   if(records.has(key)){r.meetings+=p.meetings;r.winsA+=p.winsA;r.winsB+=p.winsB;r.draws+=p.draws;r.goalsA+=p.goalsA;r.goalsB+=p.goalsB;}
   r.seasons.push(h.season);records.set(key,r);
  }
 }
 return [...records.values()].sort((a,b)=>(a.kind===b.kind?0:a.kind==='city'?-1:1)||b.meetings-a.meetings||pairKey(a.a,a.b).localeCompare(pairKey(b.a,b.b))).slice(0,limit);
}
const palette=[['#265d92','#d9e8f2'],['#8b373e','#f9e8d1'],['#286b5c','#e8e0cb'],['#735190','#f3ddf1'],['#a45e27','#fbe9cc'],['#2f526f','#f0f2f7']];
/** Fictional lore only; zero assertions about real clubs or actual historical incidents. */
export function clubIdentity(world,clubId,{lang='it',untilSeason=null}={}){
 validateUniverse(world);if(!text(clubId)||untilSeason!==null&&(!integer(untilSeason)||untilSeason<1))fail('CLUB');
 const club=world.leagues.flatMap(l=>l.clubs).find(c=>c.id===clubId);if(!club)fail('CLUB');
 const n=hashYouth(`${world.seed}|${club.id}|WRD05`);const i=n%palette.length;
 const founded=club.foundedYear??(1880+n%118),colors=Array.isArray(club.colors)&&club.colors.length===2?club.colors:palette[i];
 const titles=historicalHonours(world,{clubId}).filter(a=>a.type==='champion'&&(untilSeason===null||a.season<=untilSeason)).length;
 const reputation=Math.min(95,25+titles*9+Math.round(club.strength*.35));
 const en=String(lang).toLowerCase().startsWith('en');
 const narrative=en?`${club.name} is a fictional club${club.city?` based in ${club.city}`:''}. Its invented founding year is ${founded}. The archive records ${titles} completed league title${titles===1?'':'s'}; no real-world club history is implied.`:
  `${club.name} è una società immaginaria${club.city?` ambientata a ${club.city}`:''}. L'anno di fondazione fittizio è ${founded}. L'archivio registra ${titles} titol${titles===1?'o':'i'} di campionato completat${titles===1?'o':'i'}; non vengono attribuiti fatti a società reali.`;
 return {id:club.id,name:club.name,countryId:club.countryId,city:club.city??null,foundedYear:founded,colors,reputation,titles,narrative,fictional:true,provenance:club.foundedYear?'provided-fictional':'seeded-fictional'};
}
/** Inspect archive density without retaining entire fixture event streams. */
export function historyFootprint(world){validateUniverse(world);return {seasons:world.history.length,storedBytes:BufferLikeByteLength(JSON.stringify(world.history)),retainedFixtures:world.history.reduce((n,h)=>n+h.leagues.reduce((s,l)=>s+(l.fixtures?.length??0),0),0)};}
function BufferLikeByteLength(s){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(s).byteLength:unescape(encodeURIComponent(s)).length;}
