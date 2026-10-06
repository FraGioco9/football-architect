/** SIM06.01–03, .05: event-only, read-only statistics for the isolated causal prototype.
 * Missing data is explicitly unknown (null); NEVER fabricate shots-on-target or minutes.
 */
import {validateTacticalSessionShape,MATCH_STEPS,STEP_SECONDS} from './team-tactics-match.mjs';
import {validateMatchday} from './matchday.mjs';
import {ROLE_BY_ID} from './player-roles.mjs';
export const MATCH_STATISTICS_SCHEMA=1;
const bad=code=>{throw new Error(`SIM06_${code}`)};
const ok=(x,code)=>{if(!x)bad(code)};
const key=x=>String(x);
const positiveId=x=>(typeof x==='string'&&x.trim().length>0)||(Number.isSafeInteger(x)&&x>0);
const clone=x=>structuredClone(x);
const round=(n,d=3)=>Number(n.toFixed(d));
const groupKey=(e)=>e.period?.startsWith('first')||e.period==='first_half'?'first':e.period?.startsWith('second')||e.period==='second_half'?'second':e.second<2700?'first':'second';
const zero=()=>({goals:0,shots:0,shotsOnTarget:0,unclassifiedShots:0,xg:0,possessions:0,passes:0,completedPasses:0,unclassifiedPasses:0,recoveries:0,fouls:0,yellowCards:0,redCards:0,duels:0,duelsWon:0,touchesObserved:0,saves:0});
const tracked=new Set(['pass','recovery','shot','goal','foul','duel','save']);
const allowed=new Set(['possession','pass','recovery','shot','goal','foul','yellow_card','red_card','duel','save']);
function addEvent(stats,e){
 switch(e.type){
  case 'possession':stats.possessions++;break;
  case 'pass':stats.passes++;if(e.completed===true)stats.completedPasses++;else if(e.completed===undefined)stats.unclassifiedPasses++;break;
  case 'recovery':stats.recoveries++;break;
  case 'goal':case 'shot':stats.shots++;stats.xg+=e.xg;
   if(e.type==='goal')stats.goals++;
   if(e.type==='goal'||e.onTarget===true)stats.shotsOnTarget++;
   if(e.type==='shot'&&e.onTarget===undefined)stats.unclassifiedShots++;
   break;
  case 'foul':stats.fouls++;break;
  case 'yellow_card':stats.yellowCards++;break;
  case 'red_card':stats.redCards++;break;
  case 'duel':stats.duels++;if(e.won===true)stats.duelsWon++;break;
  case 'save':stats.saves++;break;
 }
 if(tracked.has(e.type)&&e.playerId!==undefined&&e.playerId!==null)stats.touchesObserved++;
}
function finish(s){return {...s,xg:round(s.xg),shotsOnTarget:s.unclassifiedShots?null:s.shotsOnTarget,
 shotOnTargetMinimum:s.shotsOnTarget,passAccuracyPct:s.passes&&!s.unclassifiedPasses?round(100*s.completedPasses/s.passes,1):null};}
const playerEmpty=(id,teamId,position=null,role=null)=>({playerId:id,teamId,position,role,...zero(),minutes:null,rating:null});
function lineups(tactical,matchday){
 const m=new Map();
 tactical.initialTeams.forEach(t=>{
  for(const row of t.rolePlan?.assignments??[]){
   const k=key(row.playerId);ok(!m.has(k),'PLAYER_DUPLICATE');
   m.set(k,{playerId:row.playerId,teamId:t.id,position:row.position,role:row.role});
  }
 });
 for(const t of matchday?.teams??[]){for(const p of t.players){const k=key(p.id),prior=m.get(k);
  if(prior)ok(key(prior.teamId)===key(t.teamId),'PLAYER_TEAM_MISMATCH');
  if(!prior)m.set(k,{playerId:p.id,teamId:t.teamId,position:p.position,role:null});
 }}
 return m;
}
function minutesFromLedger(matchday,tactical,owner){
 if(!matchday)return false;
 validateMatchday(matchday);
 ok(key(matchday.matchId)===key(tactical.matchId),'LEDGER_MATCH');
 ok(matchday.teams.length===2&&matchday.teams.every(t=>owner.has(key(t.teamId))),'LEDGER_TEAMS');
 // Do not assume the completed tactical session implies the separately controlled matchday was finalized.
 if(!matchday.finished||matchday.finalSecond!==MATCH_STEPS*STEP_SECONDS)return false;
 return true;
}
function addPlayerEvent(players,known,e){
 if(e.playerId===undefined||e.playerId===null)return;
 ok(positiveId(e.playerId),'PLAYER_ID');const k=key(e.playerId),meta=known.get(k);
 if(meta)ok(key(meta.teamId)===key(e.teamId),'PLAYER_TEAM_MISMATCH');
 const row=players.get(k)??playerEmpty(e.playerId,e.teamId,meta?.position??null,meta?.role??null);
 if(players.has(k))ok(key(row.teamId)===key(e.teamId),'PLAYER_TEAM_MISMATCH');
 addEvent(row,e);players.set(k,row);
}
function playerRating(p){
 // Only an illustrative, evidence-based rating. Never assign a score with no minutes or too few tracked actions.
 const participation=p.passes+p.shots+p.recoveries+p.fouls+p.duels+p.saves;
 if(p.minutes===null||p.minutes<15||participation<3)return null;
 const role=p.position??'';
 const isDef=['GK','CB','LB','RB','LWB','RWB','CDM'].includes(role);
 const roleEffects=ROLE_BY_ID[p.role]?.effect;
 const passWeight=0.012+(roleEffects?.passing>=3?0.005:0);
 const shotWeight=0.08+(roleEffects?.shooting>=3?0.025:0);
 const value=6.0 + Math.min(1.7,p.goals*0.9) +Math.min(0.8,p.shots*shotWeight)
  +Math.min(0.6,p.completedPasses*passWeight)+Math.min(isDef?0.8:0.45,p.recoveries*0.11)
  + Math.min(0.6,p.saves*0.15)-Math.min(0.7,p.fouls*0.09)-p.redCards*1.2-p.yellowCards*0.2;
 return round(Math.max(1,Math.min(10,value)),1);
}
/** Input: a SIM02 tactical session, or the SIM05 duel containing `.tactical` and `.matchday`. */
export function deriveMatchStatistics(input,{season=1,competitionId='LEAGUE',matchday=null}={}){
 ok(input&&typeof input==='object','INPUT');
 const tactical=input.tactical??input;
 const sheet=matchday??input.matchday??null;
 validateTacticalSessionShape(tactical);
 ok(Number.isSafeInteger(season)&&season>=1&&season<=9999,'SEASON');
 ok(positiveId(competitionId),'COMPETITION');
 const teams=tactical.initialTeams;
 ok(teams.length===2&&key(teams[0].id)!==key(teams[1].id),'TEAMS');
 const owner=new Map([[key(teams[0].id),'home'],[key(teams[1].id),'away']]);
 const actualLedger=minutesFromLedger(sheet,tactical,owner);
 const sums={home:zero(),away:zero()};
 const halves={first:{home:zero(),away:zero()},second:{home:zero(),away:zero()}};
 const known=lineups(tactical,sheet),players=new Map(),seen=new Set(),goals=[];
 let previousStep=-1;let lastSecond=-1;
 for(const e of tactical.events){
  ok(e&&typeof e==='object'&&allowed.has(e.type),'EVENT_TYPE');
  ok(typeof e.id==='string'&&e.id.trim()&&!seen.has(e.id),'EVENT_DUPLICATE');seen.add(e.id);
  ok(Number.isSafeInteger(e.step)&&e.step>=0&&e.step<tactical.cursor&&e.step>=previousStep,'EVENT_STEP');
  ok(Number.isSafeInteger(e.second)&&e.second>=0&&e.second<=MATCH_STEPS*STEP_SECONDS&&e.second>=lastSecond,'EVENT_TIME');
  ok(key(teams[e.side==='home'?0:e.side==='away'?1:-1]?.id)===key(e.teamId),'EVENT_TEAM');
  if(e.type==='goal'||e.type==='shot'){
   ok(Number.isFinite(e.xg)&&e.xg>=0&&e.xg<=1,'EVENT_XG');
   ok(e.onTarget===undefined||typeof e.onTarget==='boolean','EVENT_ON_TARGET');
   ok(!(e.type==='goal'&&e.onTarget===false),'GOAL_OFF_TARGET');
  }
  if(e.type==='pass')ok(e.completed===undefined||typeof e.completed==='boolean','PASS_COMPLETED');
  if(e.type==='duel')ok(e.won===undefined||typeof e.won==='boolean','DUEL_WON');
  if(e.playerId!==undefined&&e.playerId!==null){
   ok(positiveId(e.playerId),'PLAYER_ID');
   if(actualLedger){const t=sheet.teams.find(t=>key(t.teamId)===key(e.teamId));
    ok(t?.minutesLedger.some(span=>key(span.playerId)===key(e.playerId)&&span.from<=e.second&&e.second<span.to),'EVENT_OFF_FIELD');}
  }
  previousStep=e.step;lastSecond=e.second;
  addEvent(sums[e.side],e);addEvent(halves[groupKey(e)][e.side],e);
  addPlayerEvent(players,known,e);
  if(e.type==='goal')goals.push({id:e.id,teamId:e.teamId,side:e.side,playerId:e.playerId??null,second:e.second,minute:Math.floor(e.second/60)+1,score:null});
 }
 // Add participants without recorded touches, so starters and unused bench are handled correctly.
 for(const [k,meta] of known)if(!players.has(k))players.set(k,playerEmpty(meta.playerId,meta.teamId,meta.position,meta.role));
 if(actualLedger){for(const t of sheet.teams){for(const span of t.minutesLedger){
  const k=key(span.playerId),meta=known.get(k),p=players.get(k)??playerEmpty(span.playerId,t.teamId,meta?.position??null,meta?.role??null);
  ok(key(p.teamId)===key(t.teamId),'LEDGER_PLAYER_TEAM');
  p.minutes=(p.minutes??0)+(span.to-span.from)/60;
  players.set(k,p);
 }} }
 const score={home:0,away:0};
 for(const g of goals){score[g.side]++;g.score={...score};}
 const total=sums.home.possessions+sums.away.possessions;
 const possessionPct=total?{home:round(sums.home.possessions/total*100,1),away:round(sums.away.possessions/total*100,1)}:{home:null,away:null};
 if(total)possessionPct.away=round(100-possessionPct.home,1);
 const rows=[...players.values()].map(p=>({...finish(p),minutes:p.minutes===null?null:round(p.minutes,2),rating:playerRating(p)}))
  .sort((a,b)=>key(a.teamId).localeCompare(key(b.teamId))||key(a.playerId).localeCompare(key(b.playerId),undefined,{numeric:true}));
 const report={schemaVersion:MATCH_STATISTICS_SCHEMA,matchId:tactical.matchId,competitionId,season,
  completed:tactical.cursor===MATCH_STEPS,cursor:tactical.cursor,seconds:tactical.cursor*STEP_SECONDS,
  homeTeamId:teams[0].id,awayTeamId:teams[1].id,
  home:finish(sums.home),away:finish(sums.away),
  possessionPct,periods:{first:{home:finish(halves.first.home),away:finish(halves.first.away)},
   second:{home:finish(halves.second.home),away:finish(halves.second.away)}},
  goals,players:rows,
  quality:{minutesVerified:actualLedger,shotsOnTargetComplete:sums.home.unclassifiedShots+sums.away.unclassifiedShots===0,
   uncreditedActions:tactical.events.filter(e=>tracked.has(e.type)&&(e.playerId===null||e.playerId===undefined)).length,
   simulatedPossessions:true,eventsObserved:tactical.events.length},
 };
 verifyMatchStatistics(report);return report;
}
export function verifyMatchStatistics(report){
 ok(report&&report.schemaVersion===MATCH_STATISTICS_SCHEMA&&positiveId(report.matchId)&&positiveId(report.competitionId),'REPORT_SCHEMA');
 ok(Number.isSafeInteger(report.season)&&report.season>0&&Number.isSafeInteger(report.cursor)&&report.cursor>=0&&report.cursor<=MATCH_STEPS,'REPORT_TIME');
 ok(Array.isArray(report.players)&&Array.isArray(report.goals),'REPORT_ARRAY');
 for(const t of ['home','away']){
  const row=report[t],periods=['first','second'].map(k=>report.periods?.[k]?.[t]);
  ok(row&&periods.every(Boolean),'REPORT_PERIODS');
  ok(row.goals<=row.shots&&row.shots>=0&&row.xg>=0&&row.completedPasses+row.unclassifiedPasses<=row.passes,'REPORT_COUNTS');
  ok(row.shotOnTargetMinimum>=row.goals&&row.shotOnTargetMinimum<=row.shots,'REPORT_TARGETS');
  ok(row.shotsOnTarget===null||row.shotsOnTarget>=row.goals&&row.shotsOnTarget<=row.shots,'REPORT_ON_TARGET');
  for(const k of ['goals','shots','possessions','passes','completedPasses','recoveries','fouls','yellowCards','redCards','duels','duelsWon','unclassifiedShots','unclassifiedPasses']){
   ok(periods[0][k]+periods[1][k]===row[k],'REPORT_PERIOD_SUM');
  }
  ok(Math.abs(periods[0].xg+periods[1].xg-row.xg)<=0.002,'REPORT_XG_SUM');
  ok(row.passAccuracyPct===null||row.passAccuracyPct>=0&&row.passAccuracyPct<=100,'REPORT_ACCURACY');
 }
 const goals=report.goals.reduce((a,g)=>(a[g.side]++,a),{home:0,away:0});
 ok(goals.home===report.home.goals&&goals.away===report.away.goals,'REPORT_GOALS');
 ok(report.possessionPct.home===null&&report.possessionPct.away===null||
  Number.isFinite(report.possessionPct.home)&&Number.isFinite(report.possessionPct.away)&&Math.abs(report.possessionPct.home+report.possessionPct.away-100)<0.01,'REPORT_POSSESSION');
 const seen=new Set();for(const p of report.players){const id=key(p.playerId);ok(positiveId(p.playerId)&&!seen.has(id),'REPORT_PLAYER');seen.add(id);
  ok([key(report.homeTeamId),key(report.awayTeamId)].includes(key(p.teamId)),'REPORT_PLAYER_TEAM');
  ok(p.minutes===null||Number.isFinite(p.minutes)&&p.minutes>=0&&p.minutes<=90,'REPORT_MINUTES');
  ok(p.rating===null||Number.isFinite(p.rating)&&p.rating>=1&&p.rating<=10,'REPORT_RATING');}
 return true;
}
