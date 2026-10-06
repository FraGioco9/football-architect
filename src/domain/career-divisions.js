/** WRD02 — Opt-in second divisions for eight fictional football nations.
 * The managed first-division calendar remains authoritative. All divisions
 * are advanced and saved with the same season/round transaction.
 */
import {LEAGUES,getLeagueClubs} from '../leagues.js';
import {hasCareerWorld,careerWorldLeague} from './career-world.js';
import {createFixtures} from './fixtures.js';
import {randomFactory,scopedSeed} from './rng.js';
import {hashYouth,youthName} from '../addons/domain/player-youth.mjs';
import {generatePlayerAttributes,copyPlayerWithAttributes} from '../addons/domain/player-generator.mjs';
import {initialMedical} from '../addons/domain/player-medical.mjs';
import {initialDevelopment} from '../addons/domain/player-development.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {addMessage} from './history.js';
import {table} from './standings.js';

const error=key=>{throw Error(`WRD02_${key}`);};
const state=w=>w?.advancedV1?.divisionsV1;
const codes=LEAGUES.map(x=>x.id);
const positionCycle=['POR','POR','TD','TD','DC','DC','DC','DC','TS','TS','MED','MED','CC','CC','CC','COC','AD','AS','ATT','ATT','ATT','ATT','ATT'];
const cap=(x,min,max)=>Math.max(min,Math.min(max,x));
const clubKey=(country,id)=>`${country}:club:${id}`;
const goalsDigest=m=>hashYouth(JSON.stringify([m.id,m.result?.homeGoals,m.result?.awayGoals]));
export const divisionsEnabled=w=>hasCareerWorld(w)&&state(w)?.schemaVersion===1;

function newLeague(w,config){
 const country=config.id,random=randomFactory(scopedSeed(w.seed,'wrd02-founders',country));
 const clubs=getLeagueClubs(country).map((base,i)=>({id:21+i,globalId:clubKey(country,21+i),name:`${['Unione','Atletico','Sportiva','Racing','Stella'][i%5]} ${base.city} ${['Nuova','Aurora','Verde','Civica'][i%4]}`,short:`${country} ${21+i}`,city:base.city,reputation:cap(45+Math.round(random()*22),40,70)}));
 const players=[];let nextId=100001;
 for(const club of clubs)for(const position of positionCycle){
  const serial=nextId++,id=`${country}:${serial}`,rand=randomFactory(scopedSeed(w.seed,'wrd02-player',country,serial));
  const age=17+Math.floor(rand()*16),ovr=cap(Math.round(club.reputation-6+(rand()-.5)*17),38,78),potential=cap(ovr+Math.round(rand()*17),ovr,90);
  const p={id,name:youthName(country,w.seed,club.id,w.season,serial),clubId:club.id,position,age,ovr,potential,contract:2+Math.floor(rand()*4),wage:Math.round(900+ovr*48),nationality:country,apps:0,goals:0};
  p.attributes=generatePlayerAttributes({...p,position:toAddonPosition(position)},{seed:w.seed,countryId:country}).values;
  players.push(p);
 }
 return {countryId:country,name:`${config.competition} · ${country} Divisione Due`,season:w.season,round:0,clubs,players,fixtures:createFixtures(clubs.map(c=>c.id),w.season),nextId,retired:0};
}
function ranking(league){
 const rows=new Map(league.clubs.map(c=>[c.id,{id:c.id,name:c.name,p:0,pts:0,gf:0,ga:0}]));
 for(const day of league.fixtures)for(const match of day.matches){if(!match.result)continue;
  const h=rows.get(match.home),a=rows.get(match.away);if(!h||!a)error('MISSING_CLUB');
  h.p++;a.p++;h.gf+=match.result.homeGoals;h.ga+=match.result.awayGoals;a.gf+=match.result.awayGoals;a.ga+=match.result.homeGoals;
  if(match.result.homeGoals===match.result.awayGoals){h.pts++;a.pts++;}else if(match.result.homeGoals>match.result.awayGoals)h.pts+=3;else a.pts+=3;
 }
 return [...rows.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id-b.id);
}
const poisson=(r,mean)=>{let t=1,n=-1,limit=Math.exp(-mean);do{n++;t*=Math.max(1e-8,r());}while(t>limit&&n<8);return n;};
function simulate(league,w,target){
 while(league.round<target){const day=league.fixtures[league.round];
  for(const match of day.matches){const r=randomFactory(scopedSeed(w.seed,'wrd02-game',league.countryId,league.season,match.id));
   const strength=id=>{const pool=league.players.filter(p=>p.clubId===id);return pool.reduce((sum,p)=>sum+p.ovr,0)/Math.max(pool.length,1);};
   const diff=strength(match.home)-strength(match.away),homeGoals=poisson(r,cap(1.35+diff*.055,.25,3.4)),awayGoals=poisson(r,cap(1.12-diff*.055,.25,3.4));
   match.result={homeGoals,awayGoals};match.result.digest=goalsDigest(match);
   for(const id of [match.home,match.away])for(const p of league.players)if(p.clubId===id)p.apps++;
   for(const [id,count] of [[match.home,homeGoals],[match.away,awayGoals]]){
    const attackers=league.players.filter(p=>p.clubId===id&&p.position!=='POR');
    for(let i=0;i<count;i++)attackers[Math.floor(r()*attackers.length)].goals++;
   }
  }
  league.round++;
 }
}
export function enableCareerDivisions(w){
 if(!hasCareerWorld(w))error('REQUIRES_WORLD');if(divisionsEnabled(w))return w;if(state(w)!==undefined)error('UNKNOWN_SCHEMA');
 const countries=Object.fromEntries(LEAGUES.map(config=>[config.id,{lower:newLeague(w,config),history:[],reputation:60}]));
 const s={schemaVersion:1,season:w.season,round:w.round,revision:0,managedTier:1,countries,movements:[],rules:{directPromotion:2,playoffPlaces:[3,4,5,6],relegations:3}};
 for(const record of Object.values(countries))simulate(record.lower,w,w.round);
 if(w.advancedV1.marketV1)for(const country of codes)for(const club of countries[country].lower.clubs){
  const key=clubKey(country,club.id);
  w.advancedV1.marketV1.foreignFinances[key]??={balance:Math.max(12_000_000,Math.round(club.reputation*750_000)),budget:Math.max(6_000_000,Math.round(club.reputation*350_000))};
 }
 w.advancedV1.divisionsV1=s;
 if(!validateCareerDivisions(w))error('INITIALIZATION');return w;
}
export function advanceCareerDivisionsRound(w){if(!divisionsEnabled(w))return false;
 const s=state(w);if(s.season!==w.season||s.round!==w.round-1)error('ROUND_SYNC');
 for(const record of Object.values(s.countries)){if(record.lower.managed)record.lower.round=w.round;else simulate(record.lower,w,w.round);}
 s.round=w.round;s.revision++;return true;
}
function playoff(w,country,lower,rows){
 const seeds=rows.slice(2,6),r=randomFactory(scopedSeed(w.seed,'wrd02-playoff',country,w.season));
 const game=(a,b,label)=>{const home=lower.players.filter(p=>p.clubId===a.id).reduce((sum,p)=>sum+p.ovr,0)/23,away=lower.players.filter(p=>p.clubId===b.id).reduce((sum,p)=>sum+p.ovr,0)/23;
  const goalsA=poisson(r,cap(1.32+(home-away)*.04,.3,3.3)),goalsB=poisson(r,cap(1.10+(away-home)*.04,.3,3.3));
  const winner=goalsA>goalsB?a:goalsB>goalsA?b:(r()<.5?a:b);
  return {label,homeId:a.id,awayId:b.id,homeGoals:goalsA,awayGoals:goalsB,winnerId:winner.id,winner};};
 const a=game(seeds[0],seeds[3],'semi1'),b=game(seeds[1],seeds[2],'semi2'),final=game(a.winner,b.winner,'final');
 return {winnerId:final.winnerId,matches:[a,b,final].map(({winner,...x})=>x)};
}
export function captureDivisionSeason(w){if(!divisionsEnabled(w))return null;
 if(w.round!==w.fixtures.length)error('EARLY_SEASON');const s=state(w),plan={season:w.season,countries:{}};
 for(const country of codes){const upper=careerWorldLeague(w,country),record=s.countries[country],lower=record.lower;
  if(lower.round!==(lower.managed?w.fixtures.length:lower.fixtures.length)||upper.round!==upper.fixtures.length)error('INCOMPLETE');
  const top=upper.table.map(r=>({id:r.id,name:r.name,pts:r.pts})),bottom=ranking(lower.managed?{...lower,clubs:w.teams,fixtures:w.fixtures}:lower),play=playoff(w,country,lower.managed?{...lower,players:w.players}:lower,bottom);
  const promoted=[bottom[0].id,bottom[1].id,play.winnerId],relegated=top.slice(-3).map(r=>r.id);

  plan.countries[country]={top,bottom:bottom.map(({id,name,pts})=>({id,name,pts})),promoted,relegated,playoff:play};
 }
 plan.nextManagedTier=plan.countries[w.countryId].relegated.includes(w.clubId)?2:plan.countries[w.countryId].promoted.includes(w.clubId)?1:(s.managedTier??1);
 return plan;
}
const toForeign=(p,country)=>({id:p.globalId??(typeof p.id==='string'?p.id:`${country}:${p.id}`),name:p.name,clubId:p.clubId,position:p.position,age:p.age,ovr:p.ovr,potential:p.potential,wage:p.wage,contract:p.contract,apps:0,goals:0,nationality:p.nationality,attributes:p.attributes??p.attributeProfile?.values});
function toManaged(w,p){const id=Math.max(0,...w.players.map(x=>x.id),w.advancedV1?.youthV1?.nextPlayerId??0)+1,raw={...p,id,globalId:p.id,foot:'Destro',fitness:95,morale:75,form:6.8,value:Math.round(p.ovr**3*3/1000)*1000,injury:0,apps:0,goals:0,assists:0,yellow:0,cleanSheets:0,history:[]};
 delete raw.attributes;raw.attributeProfile=copyPlayerWithAttributes({...raw,position:toAddonPosition(raw.position)},{seed:w.seed,countryId:w.countryId}).attributeProfile;
 raw.medicalV1=initialMedical(raw,{day:w.advancedV1.clockDay});
 if(w.advancedV1.trainingV1)raw.developmentV1=initialDevelopment({...raw,position:toAddonPosition(raw.position)},{seed:w.seed,countryId:w.countryId,startSeason:w.season});
 return raw;}
function adjustReputation(club,shift){club.reputation=cap(Math.round(club.reputation+shift),30,96);
 if(Number.isFinite(club.balance))club.balance=Math.max(0,Math.round(club.balance*(shift>0?1.12:.88)));
 if(Number.isFinite(club.transferBudget))club.transferBudget=Math.max(0,Math.round(club.transferBudget*(shift>0?1.15:.80)));}
function managedForeign(w,p,country){return toForeign(p,country);}
// Unattached players belong to the free-agent pool, not to either league's
// roster. In particular, a season rollover can otherwise clone them into the
// first division and later register the same global ID at a foreign club.
function sourceForeign(w,players,removed,country){return players.filter(p=>p.clubId>0&&!removed.has(p.clubId)).map(p=>managedForeign(w,p,country));}
function intoManaged(w,players,keep){
 const converted=[...keep];
 for(const p of players)converted.push(toManaged({...w,players:converted},p));
 return converted;
}
function tierHistoryEffects(w,record,country,entry,topTeams,lowerTeams){
 // Only clubs changing tier receive the promotion/relegation attractiveness shift.
 const promoted=new Set(entry.promoted),relegated=new Set(entry.relegated);
 for(const club of topTeams){
  club.divisionTier=1;club.attractiveness=cap(Math.round((club.attractiveness??club.reputation)+(promoted.has(club.id)?8:0)),25,100);
  club.boardObjective={season:w.season,tier:1,target:promoted.has(club.id)?'avoid_relegation':club.reputation>=73?'top_half':'safety',minimumRank:promoted.has(club.id)?17:club.reputation>=73?10:16};
 }
 for(const club of lowerTeams){
  club.divisionTier=2;club.attractiveness=cap(Math.round((club.attractiveness??club.reputation)-(relegated.has(club.id)?8:0)),20,95);
  club.boardObjective={season:w.season,tier:2,target:relegated.has(club.id)?'promotion_push':club.reputation>=60?'playoffs':'stability',minimumRank:relegated.has(club.id)?6:club.reputation>=60?6:14};
 }
 // A rivalry is recorded only for two clubs sharing a real city and a tier.
 const rivalry=(record.rivalries??=[]);
 for(const clubs of [topTeams,lowerTeams])for(let i=0;i<clubs.length;i++)for(let j=i+1;j<clubs.length;j++){
  const a=clubs[i],b=clubs[j];if(!a.city||a.city!==b.city)continue;
  const small=Math.min(a.id,b.id),large=Math.max(a.id,b.id);
  if(!rivalry.some(r=>r.a===small&&r.b===large))rivalry.push({a:small,b:large,originSeason:w.season,kind:'city'});
 }
 record.rivalries=rivalry.slice(-100);
 record.reputation=cap(Math.round(record.reputation??60),30,100);
}
export function openCareerDivisionsSeason(w,plan){if(!divisionsEnabled(w))return false;
 const s=state(w);if(!plan||plan.season!==w.season-1||s.season!==plan.season)error('SEASON_SYNC');
 const oldTier=s.managedTier??1, nextTier=plan.nextManagedTier??oldTier;
 const changes=[];
 for(const country of codes){
  const entry=plan.countries[country],record=s.countries[country],priorLower=record.lower,
   world=w.advancedV1.worldV1.leagues.find(x=>x.countryId===country),managed=country===w.countryId;
  const upperTeams=world.locked?w.teams:world.clubs;
  const upperPlayers=world.locked?w.players:world.players;
  const lowerTeams=priorLower.managed?w.teams:priorLower.clubs;
  const lowerPlayers=priorLower.managed?w.players:priorLower.players;
  const relegated=new Set(entry.relegated),promoted=new Set(entry.promoted);
  const fallingTeams=upperTeams.filter(t=>relegated.has(t.id)),risingTeams=lowerTeams.filter(t=>promoted.has(t.id));
  if(fallingTeams.length!==3||risingTeams.length!==3)error('CLUB_SWAP');
  const topNext=[...upperTeams.filter(c=>!relegated.has(c.id)),...risingTeams.map(c=>({...c}))],
   bottomNext=[...lowerTeams.filter(c=>!promoted.has(c.id)),...fallingTeams.map(c=>({...c}))];
  const fallingPlayers=upperPlayers.filter(p=>relegated.has(p.clubId)),risingPlayers=lowerPlayers.filter(p=>promoted.has(p.clubId));
  for(const c of topNext.filter(c=>promoted.has(c.id)))adjustReputation(c,5);
  for(const c of bottomNext.filter(c=>relegated.has(c.id)))adjustReputation(c,-5);
  tierHistoryEffects(w,record,country,entry,topNext,bottomNext);
  const topForeign=[...sourceForeign(w,upperPlayers,relegated,country),...risingPlayers.map(p=>managedForeign(w,p,country))];
  const lowerForeign=[...sourceForeign(w,lowerPlayers,promoted,country),...fallingPlayers.map(p=>managedForeign(w,p,country))];
  const topFixture=()=>createFixtures(topNext.map(c=>c.id),w.season).map(r=>({...r,matches:r.matches.map(m=>({...m,globalId:`${country}:match:${m.id}`}))}));
  if(managed){
   record.nextForeignId=Math.max(record.nextForeignId??2_000_000,world.nextId??0);
   const playableTeams=nextTier===1?topNext:bottomNext;
   // Preserve unsigned players through manager-tier changes as a distinct
   // pool. They must not be exported to an NPC division or duplicated there.
   const originalKeep=oldTier===nextTier?w.players.filter(p=>!(nextTier===1?relegated:promoted).has(p.clubId)):w.players.filter(p=>p.clubId===0||(nextTier===1?promoted:relegated).has(p.clubId));
   const otherPlayers=nextTier===1?topForeign:lowerForeign;
   const keptGlobalIds=new Set(originalKeep.map(p=>p.globalId??`${country}:${p.id}`));
   const incoming=otherPlayers.filter(p=>!keptGlobalIds.has(p.id));
   w.teams=playableTeams.map(c=>({...c,balance:c.balance??Math.round(c.reputation*580000),transferBudget:c.transferBudget??Math.round(c.reputation*270000),capacity:c.capacity??14000,stadium:c.stadium??`${c.city} Arena`,history:c.history??[]}));
   w.players=intoManaged(w,incoming,originalKeep);
   if(w.advancedV1.youthV1){
    const youth=w.advancedV1.youthV1;
    // Preserve academy histories where the club remains, initialize new participants,
    // and reserve all newly converted IDs for future PLY06 intakes.
    youth.academy=Object.fromEntries(w.teams.map(c=>[String(c.id),youth.academy[String(c.id)]??[]]));
    const existing=new Set(youth.usedIds);
    for(const p of w.players)if(!existing.has(p.id)){youth.usedIds.push(p.id);existing.add(p.id);}
    youth.nextPlayerId=Math.max(youth.nextPlayerId,0,...youth.usedIds)+1;
   }
   const playerIds=new Set(w.players.map(p=>p.id));
   w.advancedV1.roles=Object.fromEntries(Object.entries(w.advancedV1.roles??{}).filter(([id])=>playerIds.has(Number(id))));
   w.advancedV1.legacyInjuryRounds=Object.fromEntries(Object.entries(w.advancedV1.legacyInjuryRounds??{}).filter(([id])=>playerIds.has(Number(id))));
   w.competition=nextTier===1?world.name:`${world.name} · Divisione Due`;
   w.fixtures=createFixtures(w.teams.map(c=>c.id),w.season);
   if(nextTier===1){
    world.locked=true;delete world.clubs;delete world.players;delete world.fixtures;delete world.round;delete world.nextId;delete world.retired;delete world.departedScorers;
   }else{
    const used=[...w.players,...topForeign,...lowerForeign,...w.advancedV1.worldV1.leagues.flatMap(l=>l.players??[])];
    const highest=used.reduce((max,p)=>{
     const id=p.globalId??p.id,prefix=`${country}:`;
     if(typeof id!=='string'||!id.startsWith(prefix))return max;
     const n=Number(id.slice(prefix.length));return Number.isSafeInteger(n)?Math.max(max,n):max;
    },1_999_999);
    world.locked=false;
    Object.assign(world,{clubs:topNext.map(c=>({...c,globalId:clubKey(country,c.id)})),players:topForeign,fixtures:topFixture(),round:0,nextId:Math.max(record.nextForeignId,highest+1),retired:world.retired??0});
   }
  }else{
   world.clubs=topNext.map(c=>({...c,globalId:clubKey(country,c.id)}));world.players=topForeign;world.fixtures=topFixture();world.round=0;
  }
  const lower=managed&&nextTier===2
   ?{countryId:country,name:priorLower.name,season:w.season,round:0,managed:true,nextId:priorLower.nextId,retired:priorLower.retired??0}
   :{countryId:country,name:priorLower.name,season:w.season,round:0,managed:false,
     clubs:bottomNext.map(c=>({...c})),players:lowerForeign.map(p=>({...p})),fixtures:createFixtures(bottomNext.map(c=>c.id),w.season),nextId:priorLower.nextId,retired:priorLower.retired??0};
  if(!lower.managed){
   // Replace retired second-tier players and recruit eligible academy prospects.
   const refreshed=[];
   for(const p of lower.players){const r=randomFactory(scopedSeed(w.seed,'wrd02-growth',w.season,p.id));p.age++;if(p.age>=43||(p.age>=33&&r()<Math.min(.4,(p.age-31)*.025))){lower.retired++;continue;}
    p.ovr=cap(p.ovr+(p.age<=24&&p.ovr<p.potential&&r()<.48?1:p.age>31&&r()<.36?-1:0),35,95);p.contract=Math.max(1,p.contract-1);p.apps=0;p.goals=0;refreshed.push(p);}
   for(const club of lower.clubs){const roster=refreshed.filter(p=>p.clubId===club.id);for(let i=roster.length;i<23;i++){
     const serial=lower.nextId++,id=`${country}:${serial}`,rnd=randomFactory(scopedSeed(w.seed,'wrd02-youth',country,w.season,serial));
     const position=i<2?'POR':positionCycle[serial%positionCycle.length],age=17+Math.floor(rnd()*5),ovr=cap(Math.round(club.reputation-8+rnd()*16),38,78),potential=cap(ovr+Math.floor(rnd()*18),ovr,92);
     const p={id,name:youthName(country,w.seed,club.id,w.season,serial),clubId:club.id,position,age,ovr,potential,wage:1200+ovr*48,contract:3,apps:0,goals:0,nationality:country};p.attributes=generatePlayerAttributes({...p,position:toAddonPosition(position)},{seed:w.seed,countryId:country}).values;refreshed.push(p);
   }}lower.players=refreshed;
  }
  record.lower=lower;
  const event={season:plan.season,countryId:country,promoted:entry.promoted,relegated:entry.relegated,playoff:entry.playoff,top:entry.top,bottom:entry.bottom};
  record.history.push(event);record.history=record.history.slice(-30);changes.push(event);
  if(w.advancedV1.marketV1)for(const club of [...topNext,...bottomNext]){
   const k=clubKey(country,club.id),finance=w.advancedV1.marketV1.foreignFinances;
   finance[k]??={balance:Math.max(12_000_000,Math.round(club.reputation*750_000)),budget:Math.max(6_000_000,Math.round(club.reputation*350_000))};
   if(promoted.has(club.id)||relegated.has(club.id)){
    const multiplier=promoted.has(club.id)?1.15:.85;
    finance[k].budget=Math.max(0,Math.round(finance[k].budget*multiplier));
   }
  }
 }
 s.managedTier=nextTier;s.movements.push({season:plan.season,countries:changes.map(x=>({countryId:x.countryId,promoted:x.promoted,relegated:x.relegated}))});s.movements=s.movements.slice(-30);
 s.season=w.season;s.round=0;s.revision++;
 addMessage(w,'Promozioni e retrocessioni',`Stagione ${plan.season}: nuove promozioni e retrocessioni registrate negli otto Paesi.`,'calendar',{type:'divisions.changes',params:{season:plan.season}});
 return true;
}
export function divisionLeague(w,country){if(!divisionsEnabled(w))return null;const l=state(w).countries[country]?.lower;if(!l)return null;return l.managed?{...l,clubs:w.teams,players:w.players,fixtures:w.fixtures}:l;}
export function divisionTable(w,country){const l=divisionLeague(w,country);return l?(l.managed?table(w):ranking(l)):[];}
export function divisionArchive(w,country){return divisionsEnabled(w)?state(w).countries[country]?.history??[]:[];}
export function validateCareerDivisions(w){const s=state(w);if(s===undefined)return true;
 if(!hasCareerWorld(w)||s.schemaVersion!==1||s.season!==w.season||s.round!==w.round||!Number.isSafeInteger(s.revision)||!s.countries||!Array.isArray(s.movements)||s.movements.length>30||!s.rules||![1,2].includes(s.managedTier??1))return false;
 for(const country of codes){const rec=s.countries[country],l=rec?.lower,top=careerWorldLeague(w,country);if(!l||!top||l.countryId!==country||l.season!==w.season||l.round!==w.round||!Array.isArray(rec.history)||rec.history.length>30)return false;
  if(l.managed){if(country!==w.countryId||s.managedTier!==2||top.locked||w.teams.length!==20||w.players.length<360||w.fixtures.length!==38)return false;continue;}
  if(l.clubs.length!==20||l.fixtures.length!==38||!Array.isArray(l.players))return false;
  const topIds=new Set(top.clubs.map(c=>c.id)),lowerIds=new Set(l.clubs.map(c=>c.id));if(topIds.size!==20||lowerIds.size!==20||[...topIds].some(x=>lowerIds.has(x)))return false;
  if(l.players.length<20*18||l.players.length>20*32||new Set(l.players.map(p=>p.id)).size!==l.players.length||l.players.some(p=>!lowerIds.has(p.clubId)||typeof p.id!=='string'||p.attributes&&Object.keys(p.attributes).length!==40))return false;
  for(const [i,day] of l.fixtures.entries()){if(day.round!==i+1||day.matches.length!==10)return false;for(const m of day.matches){if(!lowerIds.has(m.home)||!lowerIds.has(m.away)||Boolean(m.result)!==(i<l.round))return false;if(m.result&&(!Number.isSafeInteger(m.result.homeGoals)||!Number.isSafeInteger(m.result.awayGoals)||m.result.digest!==goalsDigest(m)))return false;}}
  for(const h of rec.history){if(!Number.isSafeInteger(h.season)||h.season>=w.season||new Set(h.promoted).size!==3||new Set(h.relegated).size!==3||h.playoff?.matches?.length!==3||h.top?.length!==20||h.bottom?.length!==20)return false;}
 }
 return true;
}
