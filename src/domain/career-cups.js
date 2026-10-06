/** WRD03 — Eight national knockout cups, stored in the authoritative career.
 * No legacy results, fixture dates, or league scorer totals are rewritten.
 */
import {LEAGUES} from '../leagues.js';
import {hasCareerWorld,careerWorldLeague} from './career-world.js';
import {randomFactory,scopedSeed} from './rng.js';
import {addMessage} from './history.js';
import {hashYouth} from '../addons/domain/player-youth.mjs';
import {competitionGapSlots,competitionDateForGap,competitionKickoffTime,isCareerDate,isCareerKickoff} from './career-date.js';

const fail=k=>{throw Error(`WRD03_${k}`);};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const state=w=>w?.advancedV1?.cupsV1;
export const cupsEnabled=w=>hasCareerWorld(w)&&state(w)?.schemaVersion===1;
const cupName={IT:['Coppa delle Torri','Towers Cup'],ENG:['Coppa delle Contee','Counties Cup'],ES:['Coppa del Sol','Sun Cup'],DE:['Pokal der Städte','Cities Cup'],FR:['Coupe des Cités','Cities Cup'],NL:['Beker der Steden','Cities Cup'],PT:['Taça das Estrelas','Stars Cup'],BR:['Copa das Estrelas','Stars Cup']};
const PRIZES=[120000,250000,450000,800000,1500000]; // EUR, per advancing side (first round through final)
const shuffle=(list,seed)=>{const result=[...list],random=randomFactory(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
const nearestPower=n=>2**Math.floor(Math.log2(n));
const legacySlots=(total,stages)=>Array.from({length:stages},(_,i)=>Math.max(1,Math.min(total-1,Math.round(total*(i+1)/(stages+1)))));
const slots=(w,stages)=>competitionGapSlots(w.fixtures,stages,{seed:w.seed,season:w.season,label:'national-cup'});
function scheduleCupMatches(w,country,index,leagueRound,matches){
 const date=competitionDateForGap(w.fixtures,leagueRound,{seed:w.seed,season:w.season,label:`cup-${country}`,index});
 for(let i=0;i<matches.length;i++){
  const kickoff=competitionKickoffTime(country,{seed:w.seed,season:w.season,label:`cup-${country}-${index}`,index:i});
  matches[i].date=date;matches[i].kickoff=kickoff;matches[i].datetime=`${date}T${kickoff}:00`;
 }
 return date;
}
function createCup(w,country,participants=null){
 const l=careerWorldLeague(w,country);if(!l)fail('COUNTRY');
 const valid=new Set(l.clubs.map(c=>c.id));const ids=participants??l.clubs.map(c=>c.id);
 if(!Array.isArray(ids)||ids.length<8||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!valid.has(id)))fail('PARTICIPANTS');
 const order=shuffle(ids,scopedSeed(w.seed,'wrd03-draw',w.season,country));
 const lower=nearestPower(ids.length),playin=ids.length-lower;const participantsInPlay=order.slice(0,playin*2),byes=order.slice(playin*2);
 const stages=(Math.log2(lower)|0)+(playin?1:0),calendar=slots(w,stages);
 const matches=(playin?participantsInPlay:order).reduce((out,id,i,a)=>{if(i%2===0)out.push({id:`cup:${w.season}:${country}:1:${out.length+1}`,home:id,away:a[i+1],result:null});return out;},[]);
 const date=scheduleCupMatches(w,country,1,calendar[0],matches);
 return {countryId:country,name:cupName[country][0],season:w.season,participants:[...ids],calendar,rounds:[{index:1,leagueRound:calendar[0],date,byes,draw:order,matches}],championId:null,awards:[],scorers:[]};
}
export function enableCareerCups(w,{participantsByCountry={}}={}){
 if(!hasCareerWorld(w))fail('REQUIRES_WORLD');if(cupsEnabled(w))return w;if(state(w)!==undefined)fail('UNKNOWN_SCHEMA');
 if(Object.keys(participantsByCountry).some(k=>!LEAGUES.some(l=>l.id===k)))fail('COUNTRY');
 const deferred=w.round>=slots(w,5)[0];
 w.advancedV1.cupsV1={schemaVersion:1,season:w.season,round:w.round,revision:0,deferred,cups:deferred?[]:LEAGUES.map(l=>createCup(w,l.id,participantsByCountry[l.id])),history:[],unpaidForeign:{}};
 if(!validateCareerCups(w))fail('INITIALIZATION');return w;
}
const clone=o=>structuredClone(o);
const teamPlayers=(w,country,clubId)=>country===w.countryId&&w.teams.some(c=>c.id===clubId)?w.players.filter(p=>p.clubId===clubId):w.advancedV1.worldV1.leagues.find(l=>l.countryId===country&&!l.locked)?.players.filter(p=>p.clubId===clubId)??[];
function poisson(r,mean){let count=-1,k=1,threshold=Math.exp(-mean);do{count++;k*=Math.max(1e-8,r());}while(k>threshold&&count<8);return Math.min(7,count);}
function pickScorer(players,r){const available=players.filter(p=>p.position!=='POR');if(!available.length)return null;const weighted=available.map(p=>(['ATT','AS','AD','COC'].includes(p.position)?4:1)*(0.6+p.ovr/100));let value=r()*weighted.reduce((a,b)=>a+b,0);for(let i=0;i<weighted.length;i++){value-=weighted[i];if(value<=0)return available[i];}return available.at(-1);}
const playerKey=(w,country,p)=>typeof p.id==='string'?p.id:p.globalId??`${country}:${p.id}`;
function scoreGame(w,cup,round,m,simulateManagedCup){
 const r=randomFactory(scopedSeed(w.seed,'wrd03-match',w.season,cup.countryId,m.id));
 const home=teamPlayers(w,cup.countryId,m.home),away=teamPlayers(w,cup.countryId,m.away);
 if(home.length<11||away.length<11)fail('ROSTER');
 let homeGoals,awayGoals,goals=[];let advanced=false;
 if(cup.countryId===w.countryId&&(m.home===w.clubId||m.away===w.clubId)){
  // Use the SIM01 official tactical match engine for the managed team's cup tie.
  // Cup statistics are recorded separately; league-only goals/appearances stay intact.
  const old=w.players.map(p=>[p.id,p.apps,p.goals,p.assists,p.yellow,p.cleanSheets,p.form]);
  const sim={id:m.id,home:m.home,away:m.away,result:null};const result=simulateManagedCup(w,sim);advanced=true;
  homeGoals=result.homeGoals;awayGoals=result.awayGoals;
  goals=result.goals.map(g=>{const p=w.players.find(x=>x.id===g.scorerId);return {minute:g.minute,side:g.side,playerId:p?playerKey(w,cup.countryId,p):'',playerName:p?.name??''};});
  const before=new Map(old.map(x=>[x[0],x]));for(const p of w.players){const saved=before.get(p.id);[p.apps,p.goals,p.assists,p.yellow,p.cleanSheets,p.form]=saved.slice(1);}
 }else{
  const mean=p=>Math.max(0.35,Math.min(3.2,p.reduce((sum,x)=>sum+x.ovr,0)/p.length/35-0.2));
  const sh=mean(home),sa=mean(away);homeGoals=poisson(r,1.18+(sh-sa)*0.75+0.18);awayGoals=poisson(r,1.12+(sa-sh)*0.75);
  const goalFor=(list,count,side)=>{for(let i=0;i<count;i++){const p=pickScorer(list,r);if(p)goals.push({minute:1+Math.floor(r()*90),side,playerId:playerKey(w,cup.countryId,p),playerName:p.name});}};
  goalFor(home,homeGoals,'home');goalFor(away,awayGoals,'away');
 }
 const ordinary={homeGoals,awayGoals};let extraTime=null,penalties=null;
 if(homeGoals===awayGoals){
  const h=poisson(r,.32),a=poisson(r,.32);extraTime={homeGoals:h,awayGoals:a};
  const add=(list,count,side)=>{for(let i=0;i<count;i++){const p=pickScorer(list,r);if(p)goals.push({minute:91+Math.floor(r()*30),side,playerId:playerKey(w,cup.countryId,p),playerName:p.name});}};
  add(home,h,'home');add(away,a,'away');homeGoals+=h;awayGoals+=a;
  if(homeGoals===awayGoals){let ph=3+Math.floor(r()*3),pa=3+Math.floor(r()*3);if(ph===pa){if(r()<.5)ph++;else pa++;}penalties={home:ph,away:pa};}
 }
 const winnerId=homeGoals>awayGoals?m.home:homeGoals<awayGoals?m.away:penalties.home>penalties.away?m.home:m.away;
 goals.sort((a,b)=>a.minute-b.minute||a.playerId.localeCompare(b.playerId));
 const result={...ordinary,extraTime,penalties,winnerId,goals,engine:advanced?'SIM01':'WRD03',season:w.season};
 result.digest=hashYouth(JSON.stringify(result));return result;
}
function account(w,country,clubId){if(country===w.countryId)return w.teams.find(c=>c.id===clubId);return w.advancedV1.marketV1?.foreignFinances?.[`${country}:club:${clubId}`]??null;}
function payout(w,cup,winnerId,round){const amount=PRIZES[Math.min(round.index-1,PRIZES.length-1)],key=`${cup.countryId}:club:${winnerId}`;
 const record={round:round.index,clubId:winnerId,amountEUR:amount};cup.awards.push(record);
 const c=account(w,cup.countryId,winnerId);if(c){c.balance+=amount;if(c.transferBudget!==undefined)c.transferBudget+=Math.round(amount*.6);else if(c.budget!==undefined)c.budget+=Math.round(amount*.6);}else{const s=state(w);s.unpaidForeign[key]=(s.unpaidForeign[key]??0)+amount;}
}
/** Catch up foreign bonuses after MKT01 finances become available, never credit twice. */
export function settleCupCredits(w){if(!cupsEnabled(w))return 0;const s=state(w);let count=0;for(const [key,amount] of Object.entries(s.unpaidForeign)){const [country,,id]=key.split(':'),c=account(w,country,Number(id));if(!c)continue;c.balance+=amount;if(c.budget!==undefined)c.budget+=Math.round(amount*.6);else if(c.transferBudget!==undefined)c.transferBudget+=Math.round(amount*.6);delete s.unpaidForeign[key];count++;}return count;}
function processDueCups(w,{simulateManagedCup=null,fromRound=false}={}){
 const s=state(w);if(s.deferred)return false;let changed=false;
 for(const cup of s.cups){
  const current=cup.rounds.at(-1),dateAware=isCareerDate(current?.date);
  const due=current&&!current.matches.every(m=>m.result)&&(dateAware?current.date<=w.currentDate:fromRound&&current.leagueRound===w.round);
  if(!due)continue;
  for(const match of current.matches){match.result=scoreGame(w,cup,current,match,simulateManagedCup);payout(w,cup,match.result.winnerId,current);for(const goal of match.result.goals){const row=cup.scorers.find(x=>x.id===goal.playerId);if(row)row.goals++;else cup.scorers.push({id:goal.playerId,name:goal.playerName,goals:1});}}
  const winners=[...current.byes,...current.matches.map(m=>m.result.winnerId)];
  if(winners.length===1){cup.championId=winners[0];addMessage(w,'Coppa nazionale conclusa',`${cup.name}: campione ${careerWorldLeague(w,cup.countryId).clubs.find(c=>c.id===cup.championId)?.name??''}.`,'cup',{type:'cup.winner',params:{country:cup.countryId,season:w.season,club:careerWorldLeague(w,cup.countryId).clubs.find(c=>c.id===cup.championId)?.name??String(cup.championId)}});}
  else{
   const index=current.index+1,draw=shuffle(winners,scopedSeed(w.seed,'wrd03-round-draw',w.season,cup.countryId,index)),matches=[];
   for(let i=0;i<draw.length;i+=2)matches.push({id:`cup:${w.season}:${cup.countryId}:${index}:${i/2+1}`,home:draw[i],away:draw[i+1],result:null});
   const leagueRound=cup.calendar[index-1];
   if(dateAware){const date=scheduleCupMatches(w,cup.countryId,index,leagueRound,matches);cup.rounds.push({index,leagueRound,date,byes:[],draw,matches});}
   else cup.rounds.push({index,leagueRound,byes:[],draw,matches});
  }
  changed=true;
 }
 if(changed){s.revision++;settleCupCredits(w);}return changed;
}
export function advanceCareerCupsDay(w,{simulateManagedCup=null}={}){
 if(!cupsEnabled(w))return false;const s=state(w);
 if(s.season!==w.season||s.round!==w.round)fail('SYNC');
 return processDueCups(w,{simulateManagedCup,fromRound:false});
}
export function advanceCareerCupsRound(w,{simulateManagedCup=null}={}){
 if(!cupsEnabled(w))return false;const s=state(w);
 if(s.season!==w.season||![w.round-1,w.round].includes(s.round))fail('SYNC');
 if(s.round===w.round-1)s.round=w.round;
 return processDueCups(w,{simulateManagedCup,fromRound:true});
}
/** Called before season increment so cup history belongs to the exact season. */
export function archiveCareerCupsSeason(w){if(!cupsEnabled(w))return false;const s=state(w);if(s.season!==w.season||s.round!==w.fixtures.length)fail('SYNC');
 if(!s.deferred){if(s.cups.some(c=>!c.championId))fail('INCOMPLETE');s.history.push({season:w.season,cups:s.cups.map(c=>clone(c))});if(s.history.length>50)s.history.shift();}
 return true;
}
/** Called after the official world advances to the next season. */
export function openCareerCupsSeason(w){if(!cupsEnabled(w))return false;const s=state(w);s.season=w.season;s.round=0;s.deferred=false;s.cups=LEAGUES.map(l=>createCup(w,l.id));s.revision++;return true;}
export function cupForCountry(w,country){return cupsEnabled(w)?state(w).cups.find(c=>c.countryId===country)??null:null;}
export function cupHonours(w,country){return cupsEnabled(w)?state(w).history.map(h=>({season:h.season,cup:h.cups.find(c=>c.countryId===country)})).filter(x=>x.cup).map(x=>({season:x.season,championId:x.cup.championId,name:x.cup.name,topScorers:x.cup.scorers.slice().sort((a,b)=>b.goals-a.goals).slice(0,3)})):[];}
function goodCup(c,w,season){const league=careerWorldLeague(w,c.countryId),clubs=new Set(season===w.season?league?.clubs.map(x=>x.id):c.participants);if(!clubs||!Number.isSafeInteger(c.season)||c.season!==season||!Array.isArray(c.participants)||c.participants.length<8||c.participants.length>20||new Set(c.participants).size!==c.participants.length||c.participants.some(x=>!clubs.has(x))||!Array.isArray(c.calendar)||!Array.isArray(c.rounds)||c.rounds.length>5||c.rounds.length<1||!Array.isArray(c.awards)||!Array.isArray(c.scorers))return false;
 const dateAware=isCareerDate(c.rounds[0]?.date);
 const stages=(Math.log2(nearestPower(c.participants.length))|0)+(c.participants.length>nearestPower(c.participants.length)?1:0);
 const expectedSlots=dateAware?slots(w,stages):legacySlots(w.fixtures.length,stages);
 if(c.calendar.length!==stages||c.calendar.some((r,i)=>!Number.isSafeInteger(r)||r<1||r>=w.fixtures.length||(season===w.season&&r!==expectedSlots[i])))return false;
 const seen=new Set();for(const [ix,r] of c.rounds.entries()){
  if(r.index!==ix+1||r.leagueRound!==c.calendar[ix]||(dateAware&&!isCareerDate(r.date))||(!dateAware&&r.date!==undefined)||!Array.isArray(r.matches)||!Array.isArray(r.byes)||!Array.isArray(r.draw))return false;
  if(ix===0&&r.matches.length!==(c.participants.length-nearestPower(c.participants.length)||c.participants.length/2))return false;
  const ids=[...r.byes,...r.matches.flatMap(m=>[m.home,m.away])];if(new Set(ids).size!==ids.length||ids.some(id=>!clubs.has(id)))return false;
  if(ix===0&&(ids.length!==c.participants.length||ids.some(id=>!c.participants.includes(id))))return false;
  if(ix>0){const prev=c.rounds[ix-1];if(!prev.matches.every(m=>m.result))return false;const advancing=[...prev.byes,...prev.matches.map(m=>m.result.winnerId)];if(advancing.length!==ids.length||advancing.some(id=>!ids.includes(id)))return false;}
  const played=season===w.season?(dateAware?r.date<=w.currentDate:r.leagueRound<=w.round):true;
  if(r.matches.some(m=>{if(!/^cup:\d+:(IT|ENG|ES|DE|FR|NL|PT|BR):\d+:\d+$/.test(m.id)||seen.has(m.id)||(dateAware&&(m.date!==r.date||!isCareerKickoff(m.kickoff)||m.datetime!==`${m.date}T${m.kickoff}:00`))||(!dateAware&&(m.date!==undefined||m.kickoff!==undefined||m.datetime!==undefined)))return true;seen.add(m.id);if(Boolean(m.result)!==played)return true;if(!m.result)return false;const t=m.result;if(!integer(t.homeGoals)||!integer(t.awayGoals)||t.season!==season||![m.home,m.away].includes(t.winnerId)||!Array.isArray(t.goals)||!['SIM01','WRD03'].includes(t.engine)||!integer(t.digest))return true;const {digest,...unsigned}=t;if(hashYouth(JSON.stringify(unsigned))!==digest)return true;const eh=t.extraTime?.homeGoals??0,ea=t.extraTime?.awayGoals??0;if(!integer(eh)||!integer(ea)||t.goals.length!==t.homeGoals+t.awayGoals+eh+ea)return true;if(t.homeGoals+eh===t.awayGoals+ea?!t.penalties:t.penalties)return true;const calculated=t.homeGoals+eh>t.awayGoals+ea?m.home:t.homeGoals+eh<t.awayGoals+ea?m.away:t.penalties.home>t.penalties.away?m.home:m.away;return calculated!==t.winnerId||t.goals.some(g=>!integer(g.minute)||g.minute<1||g.minute>120||!['home','away'].includes(g.side)||typeof g.playerId!=='string'||typeof g.playerName!=='string');}))return false;
 }
 if(c.championId!==null&&!clubs.has(c.championId))return false;
 if(c.championId!==null&&(c.rounds.at(-1).matches.length!==1||c.rounds.at(-1).matches[0].result?.winnerId!==c.championId))return false;
 if(c.awards.some(a=>!integer(a.round)||!clubs.has(a.clubId)||!integer(a.amountEUR)))return false;
 if(c.scorers.some(p=>typeof p.id!=='string'||typeof p.name!=='string'||!integer(p.goals)))return false;
 return true;
}
export function validateCareerCups(w){const s=state(w);if(s===undefined)return true;if(!hasCareerWorld(w)||s?.schemaVersion!==1||s.season!==w.season||s.round!==w.round||!integer(s.revision)||typeof s.deferred!=='boolean'||!Array.isArray(s.cups)||!Array.isArray(s.history)||s.history.length>50||!s.unpaidForeign||typeof s.unpaidForeign!=='object')return false;
 if(s.deferred&&s.cups.length||!s.deferred&&(s.cups.length!==8||s.cups.some((c,i)=>c.countryId!==LEAGUES[i].id||!goodCup(c,w,w.season))))return false;
 if(Object.entries(s.unpaidForeign).some(([k,v])=>!/^(IT|ENG|ES|DE|FR|NL|PT|BR):club:\d+$/.test(k)||!integer(v)))return false;
 return s.history.every((h,i)=>integer(h.season)&&h.season<w.season&&(i===0||s.history[i-1].season<h.season)&&h.cups?.length===8&&h.cups.every((c,j)=>c.countryId===LEAGUES[j].id&&goodCup(c,w,h.season)&&c.championId!==null));
}
