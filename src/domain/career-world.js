/** WRD01 — Official, opt-in eight-country career world.
 * The manager's existing league is authoritative; seven other leagues are
 * compact, incrementally simulated and saved under advancedV1.worldV1.
 * No network, ambient randomness, retroactive mutation or implicit migration.
 */
import {LEAGUES} from '../leagues.js';
import {syncCareerCoachesWorld} from './career-coaches.js';
import {makeWorld} from './world.js';
import {createFixtures} from './fixtures.js';
import {table} from './standings.js';
import {randomFactory,scopedSeed} from './rng.js';
import {generatePlayerAttributes} from '../addons/domain/player-generator.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {hashYouth,youthName} from '../addons/domain/player-youth.mjs';
import {buildOfficialLeagueArchive,validateOfficialLeagueArchive} from './career-history.js';
import {returnMarketLoansAfterArchive} from './career-market.js';

export const OFFICIAL_WORLD_COUNTRIES=Object.freeze(LEAGUES.map(l=>l.id));
const error=key=>{throw new Error('CAREER_WORLD_'+key);};
const cap=(x,a,b)=>Math.min(b,Math.max(a,x));
const isInt=x=>Number.isSafeInteger(x);
const official=w=>w?.advancedV1?.enabled===true&&w.advancedV1?.worldV1?.schemaVersion===1;
export const hasCareerWorld=official;
const own=w=>w.advancedV1.worldV1;
const playerID=(country,id)=>`${country}:${id}`;
const matchDigest=(m,r)=>hashYouth(JSON.stringify([m.id,r.homeGoals,r.awayGoals,r.shotsHome,r.shotsAway,r.xgHome,r.xgAway,r.goals]));
function snapPlayer(p,country,seed){
 const position=toAddonPosition(p.position);
 const profile=p.attributeProfile??generatePlayerAttributes({...p,position},{seed,countryId:country});
 // The field profile is stored once; do not repeat its verbose generator metadata.
 const attributes=Object.fromEntries(Object.entries(profile.values));
 return {id:playerID(country,p.id),globalId:p.globalId??playerID(country,p.id),identity:p.identity?structuredClone(p.identity):undefined,
  name:p.name,shirtNumber:p.shirtNumber??p.identity?.shirtNumber??null,clubId:p.clubId,position:p.position,age:p.age,ovr:p.ovr,potential:p.potential,
  wage:p.wage,contract:p.contract,apps:0,goals:0,nationality:p.nationality,attributes};
}
function leagueFrom(seed,code,season){
 const base=makeWorld(scopedSeed(seed,'official-world',code),code);
 return {countryId:code,name:base.competition,season,round:0,
  clubs:base.teams.map(c=>({id:c.id,globalId:`${code}:club:${c.id}`,name:c.name,short:c.short,city:c.city,reputation:c.reputation})),
  players:base.players.map(p=>snapPlayer(p,code,seed)),
  fixtures:createFixtures(base.teams.map(c=>c.id),season).map(r=>({...r,matches:r.matches.map(m=>({...m,globalId:`${code}:match:${m.id}`}))})),nextId:base.players.length+1,retired:0};
}
/** Called only after explicit user confirmation; original fixtures remain untouched. */
export function enableCareerWorld(w){
 if(!w?.clubId||!w.advancedV1?.enabled)error('REQUIRES_ADVANCED');
 if(own(w)){
  if(official(w))return w;
  error('UNKNOWN_VERSION');
 }
 if(!OFFICIAL_WORLD_COUNTRIES.includes(w.countryId))error('COUNTRY');
 const seed=w.seed>>>0;
 const universe={schemaVersion:1,season:w.season,round:w.round,day:w.advancedV1.clockDay,seed,
  leagues:LEAGUES.map(l=>l.id===w.countryId
   ?{countryId:l.id,name:w.competition,locked:true,season:w.season}
   :leagueFrom(seed,l.id,w.season)),
  history:[],retiredCount:0};
 // Respect opt-in mid-season: generate the independent earlier NPC results,
 // never replace any match in the managed league.
 for(const league of universe.leagues)if(!league.locked)simulateUntil(universe,league,alignedRound(w.round,w.fixtures.length));
 w.advancedV1.worldV1=universe;
 syncCareerCoachesWorld(w);
 if(!validateCareerWorld(w))error('INITIALIZATION');
 return w;
}
const alignedRound=(played,total)=>Math.floor(played*38/total);
function weightedScorer(players,rand){
 const weights={ATT:6,AS:3.5,AD:3.5,COC:3,CC:1.8,MED:.6,TD:.5,TS:.5,DC:.35,POR:.01};
 const weight=p=>(weights[p.position]??1)*(.5+p.ovr/100);
 let n=rand()*players.reduce((sum,p)=>sum+weight(p),0);
 for(const p of players){n-=weight(p);if(n<=0)return p;}
 return players.at(-1);
}
function poisson(rand,mean){let t=1,n=-1,stop=Math.exp(-mean);do{n++;t*=Math.max(1e-8,rand());}while(t>stop&&n<8);return n;}
function simulateFixture(universe,league,m){
 const rand=randomFactory(scopedSeed(universe.seed,'world-fixture',league.countryId,universe.season,m.id));
 const home=league.players.filter(p=>p.clubId===m.home),away=league.players.filter(p=>p.clubId===m.away);
 const strength=ps=>ps.reduce((sum,p)=>sum+p.ovr,0)/Math.max(1,ps.length);
 const diff=strength(home)-strength(away);
 const xgHome=cap(1.45+diff*.06,.25,3.7),xgAway=cap(1.10-diff*.06,.25,3.7);
 const homeGoals=poisson(rand,xgHome),awayGoals=poisson(rand,xgAway),goals=[];
 for(const [count,players,side] of [[homeGoals,home,'home'],[awayGoals,away,'away']]){
  const selectable=players.filter(p=>p.position!=='POR');
  for(let i=0;i<count;i++){
   const scorer=weightedScorer(selectable,rand);if(!scorer)error('SCORER');
   scorer.goals++;goals.push({minute:1+Math.floor(rand()*90),teamId:side==='home'?m.home:m.away,playerId:scorer.id,playerName:scorer.name});
  }
 }
 for(const p of [...home,...away])p.apps++;
 goals.sort((a,b)=>a.minute-b.minute||a.playerId.localeCompare(b.playerId));
 m.result={homeGoals,awayGoals,shotsHome:homeGoals+Math.round(xgHome*3)+2,shotsAway:awayGoals+Math.round(xgAway*3)+2,
  xgHome:Math.round(xgHome*100)/100,xgAway:Math.round(xgAway*100)/100,goals};
 m.result.digest=matchDigest(m,m.result);
}
/** O(new matchdays) rather than O(all past fixtures × all leagues). */
function simulateUntil(universe,league,target){
 if(league.round>target||target>league.fixtures.length)error('ROUND_REWIND');
 while(league.round<target){const f=league.fixtures[league.round];for(const m of f.matches)simulateFixture(universe,league,m);league.round++;}
}
/** Called exactly once after a successfully completed managed matchday. */
export function advanceCareerWorldRound(w){
 if(!official(w))return false;
 const universe=own(w);if(universe.season!==w.season||universe.round!==w.round-1)error('SYNC');
 for(const l of universe.leagues)if(!l.locked)simulateUntil(universe,l,alignedRound(w.round,w.fixtures.length,l.fixtures.length));
 universe.round=w.round;universe.day=w.advancedV1.clockDay;
 return true;
}
function rankRows(clubs,fixtures){
 const map=new Map(clubs.map(c=>[c.id,{id:c.id,name:c.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]));
 for(const day of fixtures)for(const match of day.matches){if(!match.result)continue;
  const h=map.get(match.home),a=map.get(match.away),r=match.result;h.p++;a.p++;h.gf+=r.homeGoals;h.ga+=r.awayGoals;a.gf+=r.awayGoals;a.ga+=r.homeGoals;
  if(r.homeGoals===r.awayGoals){h.d++;a.d++;h.pts++;a.pts++;}else if(r.homeGoals>r.awayGoals){h.w++;a.l++;h.pts+=3;}else{a.w++;h.l++;a.pts+=3;}
 }
 return [...map.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id-b.id);
}
function archiveLeague(w,l){
 if(l.locked){const rows=table(w);return {countryId:l.countryId,championId:rows[0]?.id??null,table:rows.map(r=>({id:r.id,name:w.teams.find(c=>c.id===r.id)?.name??r.name,pts:r.pts,p:r.p})),topScorers:w.players.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals).slice(0,10).map(p=>({id:p.globalId??playerID(l.countryId,p.id),name:p.name,goals:p.goals})),retired:0,details:buildOfficialLeagueArchive(w,l,rows)};}
 const rows=rankRows(l.clubs,l.fixtures);
 const scorers=new Map();for(const p of [...l.players,...(l.departedScorers??[])])if(p.goals){
  const existing=scorers.get(p.id);if(existing)existing.goals+=p.goals;
  else scorers.set(p.id,{id:p.id,name:p.name,goals:p.goals});
 }
 return {countryId:l.countryId,championId:rows[0].id,table:rows.map(r=>({id:r.id,name:r.name,pts:r.pts,p:r.p})),topScorers:[...scorers.values()].sort((a,b)=>b.goals-a.goals).slice(0,10),retired:l.retired,details:buildOfficialLeagueArchive(w,l,rows)};
}
function seasonRollover(universe,league,season){
 const vacancies=new Map();const kept=[];
 for(const p of league.players){
  const rand=randomFactory(scopedSeed(universe.seed,'foreign-growth',season,p.id));
  p.age++;
  const retirement=p.age>=43||(p.age>=32&&rand()<cap((p.age-31)*.025,0,.45));
  if(retirement){const key=p.clubId;vacancies.set(key,[...(vacancies.get(key)??[]),p.position]);league.retired++;continue;}
  const before=p.ovr,delta=p.age<=24&&p.ovr<p.potential?(rand()<.55?1:0):p.age>31&&rand()<.43?-1:0;
  p.ovr=cap(before+delta,35,95);p.contract=Math.max(1,p.contract-1);p.apps=0;p.goals=0;
  if(delta){for(const key of Object.keys(p.attributes))p.attributes[key]=cap(p.attributes[key]+delta,1,100);}
  kept.push(p);
 }
 const perClub=new Map(league.clubs.map(c=>[c.id,kept.filter(p=>p.clubId===c.id)]));
 for(const club of league.clubs){
  const roster=perClub.get(club.id),remaining=23-roster.length;
  const missingRoles=vacancies.get(club.id)??[];
  const lacksGK=Math.max(0,2-roster.filter(p=>p.position==='POR').length);
  const needs=cap(remaining,0,30)+Math.max(0,lacksGK-Math.max(0,remaining));
  for(let j=0;j<needs;j++){
   const serial=league.nextId++,id=playerID(league.countryId,serial);
   const rand=randomFactory(scopedSeed(universe.seed,'foreign-intake',season,id));
   const position=j<lacksGK?'POR':missingRoles.find((pos,i)=>pos!=='POR'&&i===j-lacksGK)??missingRoles.filter(pos=>pos!=='POR')[j-lacksGK]??['DC','CC','ATT','MED','AD','AS'][serial%6];
   const age=17+Math.floor(rand()*5),ovr=cap(45+Math.round(rand()*24),35,90),potential=cap(ovr+Math.round(rand()*18),ovr,95);
   const p={id,name:youthName(league.countryId,universe.seed,club.id,season,serial),clubId:club.id,position,age,ovr,potential,contract:3,apps:0,goals:0,nationality:league.countryId,wage:1500+ovr*60};
   const profile=generatePlayerAttributes({...p,position:toAddonPosition(p.position)},{seed:universe.seed,countryId:league.countryId});
   p.attributes=Object.fromEntries(Object.entries(profile.values));kept.push(p);
  }
 }
 league.players=kept;league.departedScorers=[];league.season=season;league.round=0;league.fixtures=createFixtures(league.clubs.map(c=>c.id),season).map(r=>({...r,matches:r.matches.map(m=>({...m,globalId:`${league.countryId}:match:${m.id}`}))}));
}
/** Called just before the authoritative managed season increments. */
export function advanceCareerWorldSeason(w){
 if(!official(w))return false;
 const universe=own(w);if(universe.season!==w.season||universe.round!==w.fixtures.length)error('SYNC');
 if(universe.leagues.some(l=>!l.locked&&l.round!==l.fixtures.length))error('FOREIGN_INCOMPLETE');
 const archive={season:universe.season,leagues:universe.leagues.map(l=>archiveLeague(w,l))};
 universe.history.push(archive);if(universe.history.length>50)universe.history.shift();
 // WRD05 has sealed the results: return expiring loans before foreign ageing or retirement.
 returnMarketLoansAfterArchive(w);
 // A second-division manager can return to the top flight with players
 // previously generated by the autonomous first league. When the league is
 // autonomous again, never recycle those players' global IDs: they can now be
 // owned by the manager, an overseas club, or a lower-division club.
 const divisions=w.advancedV1?.divisionsV1;
 if(divisions?.schemaVersion===1){
  const occupied=[...w.players,...universe.leagues.flatMap(l=>l.players??[]),
   ...Object.values(divisions.countries).flatMap(r=>r.lower?.players??[])];
  for(const l of universe.leagues){
   if(l.locked||l.countryId!==w.countryId)continue;
   const prefix=`${l.countryId}:`;
   const last=occupied.reduce((max,p)=>{
    const global=p.globalId??p.id;
    if(typeof global!=='string'||!global.startsWith(prefix))return max;
    const number=Number(global.slice(prefix.length));
    return Number.isSafeInteger(number)?Math.max(max,number):max;
   },0);
   const record=divisions.countries[l.countryId];
   l.nextId=Math.max(l.nextId,record?.nextForeignId??0,last+1);
   if(record)record.nextForeignId=l.nextId;
  }
 }
 for(const l of universe.leagues){if(l.locked){l.season++;continue;}seasonRollover(universe,l,universe.season+1);}
 universe.season++;universe.round=0;
 return archive;
}
/** After advanced medical's off-season step, keep the shared calendar clock aligned. */
export function syncCareerWorldClock(w){if(official(w))own(w).day=w.advancedV1.clockDay;}
/** Validation avoids replaying history or regenerating every 40-attribute profile. */
export function validateCareerWorld(w){
 const u=w?.advancedV1?.worldV1;
 if(u===undefined)return true;
 if(!official(w)||u.season!==w.season||u.round!==w.round||u.day!==w.advancedV1.clockDay||!isInt(u.seed)||u.seed!==w.seed>>>0||!Array.isArray(u.leagues)||u.leagues.length!==8||!Array.isArray(u.history)||u.history.length>50)return false;
 const ids=new Set();
 for(const [index,l] of u.leagues.entries()){
  if(l.countryId!==OFFICIAL_WORLD_COUNTRIES[index]||l.season!==u.season)return false;
  if(l.countryId===w.countryId&&l.locked){if(w.advancedV1?.divisionsV1?.managedTier===2)return false;continue;}
  if(l.countryId===w.countryId&&!l.locked&&w.advancedV1?.divisionsV1?.managedTier!==2)return false;
  if(l.locked||!Array.isArray(l.clubs)||l.clubs.length!==20||!Array.isArray(l.players)||!Array.isArray(l.fixtures)||l.fixtures.length!==38||!isInt(l.round)||l.round!==alignedRound(u.round,w.fixtures.length,l.fixtures.length)||!isInt(l.nextId)||!isInt(l.retired))return false;
  const clubIds=new Set(l.clubs.map(c=>c.id));
  if(l.departedScorers!==undefined&&(!Array.isArray(l.departedScorers)||l.departedScorers.length>300||l.departedScorers.some(p=>typeof p.id!=='string'||!OFFICIAL_WORLD_COUNTRIES.some(c=>p.id.startsWith(c+':'))||!clubIds.has(p.clubId)||typeof p.name!=='string'||!isInt(p.goals)||!isInt(p.apps))))return false;
  for(const c of l.clubs){if(c.globalId!==`${l.countryId}:club:${c.id}`||ids.has(c.globalId))return false;ids.add(c.globalId);}
  for(const p of l.players){if(typeof p.id!=='string'||!OFFICIAL_WORLD_COUNTRIES.some(country=>p.id.startsWith(country+':'))||ids.has(p.id)||!clubIds.has(p.clubId)||!isInt(p.age)||p.age<15||p.age>70||!isInt(p.ovr)||p.ovr<1||p.ovr>100||!p.attributes||Object.keys(p.attributes).length!==40||Object.values(p.attributes).some(v=>!isInt(v)||v<1||v>100))return false;ids.add(p.id);}
  for(let r=0;r<38;r++){
   const day=l.fixtures[r];if(day.round!==r+1||day.matches.length!==10)return false;
   for(const m of day.matches){if(Boolean(m.result)!==(r<l.round)||!clubIds.has(m.home)||!clubIds.has(m.away)||m.globalId!==`${l.countryId}:match:${m.id}`)return false;
    if(m.result&&(!isInt(m.result.homeGoals)||!isInt(m.result.awayGoals)||!Array.isArray(m.result.goals)||m.result.goals.length!==m.result.homeGoals+m.result.awayGoals||m.result.digest!==matchDigest(m,m.result)||m.result.goals.some(g=>!isInt(g.minute)||g.minute<1||g.minute>90||![m.home,m.away].includes(g.teamId)||typeof g.playerId!=='string'||!OFFICIAL_WORLD_COUNTRIES.some(country=>g.playerId.startsWith(country+':'))||typeof g.playerName!=='string')))return false;}
  }
 }
 return u.history.every((h,i)=>h.season===u.season-u.history.length+i&&Array.isArray(h.leagues)&&h.leagues.length===8&&h.leagues.every((l,j)=>l.countryId===OFFICIAL_WORLD_COUNTRIES[j]&&Array.isArray(l.table)&&l.table.length>=12&&l.table.length<=20&&(l.details===undefined||validateOfficialLeagueArchive(l.details,l,l.countryId))));
}
export function careerWorldLeague(w,countryId=w.countryId){
 if(!official(w))return null;
 const l=own(w).leagues.find(x=>x.countryId===countryId);if(!l)return null;
 if(l.locked)return {countryId,name:w.competition,locked:true,season:w.season,round:w.round,clubs:w.teams.map(c=>({...c,globalId:`${w.countryId}:club:${c.id}`})),players:w.players,fixtures:w.fixtures,table:table(w)};
 return {...l,locked:false,table:rankRows(l.clubs,l.fixtures)};
}
export function careerWorldScorers(w,countryId=w.countryId,limit=15){const l=careerWorldLeague(w,countryId);return l?l.players.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals).slice(0,limit):[];}
