// SIM01.04 — deterministic, entirely in-memory playback of a completed causal match.
// A different UI speed changes only the advancement rate, never the event stream.
import {inspectCompletedMatchTimeline,regularMatchSchedule,officialMatchClock} from './domain/match-timeline.js';

const eventSeconds=e=>e.minute*60+e.second;
const round=n=>Math.round(n*100)/100;

export function createMatchPlayback(record){
  if(!record || !Array.isArray(record.events))throw new TypeError('MATCH_PLAYBACK_RECORD: expected a match record');
  const inspection=inspectCompletedMatchTimeline(record.events);
  if(!inspection.ok)throw new Error('MATCH_PLAYBACK_TIMELINE: '+inspection.issues.map(i=>i.code).join(','));
  if(record.matchId!==record.events[0].matchId ||
     record.homeTeamId!==record.events[0].homeTeamId || record.awayTeamId!==record.events[0].awayTeamId ||
     record.matchSeed!==record.events[0].matchSeed)throw new Error('MATCH_PLAYBACK_CONTEXT: mismatch');
  return {record,cursor:0,paused:false,speed:1};
}
export function advanceMatchPlayback(playback,count=1){
  if(!playback||!Number.isSafeInteger(count)||count<0)throw new TypeError('MATCH_PLAYBACK_ADVANCE: invalid count');
  return {...playback,cursor:Math.min(playback.record.events.length,playback.cursor+count)};
}
export function finishMatchPlayback(playback){return advanceMatchPlayback(playback,playback.record.events.length);}
export function setMatchPlaybackPaused(playback,paused){
  if(typeof paused!=='boolean')throw new TypeError('MATCH_PLAYBACK_PAUSE: expected boolean');
  return {...playback,paused};
}
export function setMatchPlaybackSpeed(playback,speed){
  if(![1,2,4].includes(speed))throw new RangeError('MATCH_PLAYBACK_SPEED: use 1, 2 or 4');
  return {...playback,speed};
}
export function matchPlaybackSnapshot(playback){
  if(!playback||!Array.isArray(playback.record?.events)||!Number.isInteger(playback.cursor)||
    playback.cursor<0||playback.cursor>playback.record.events.length)throw new TypeError('MATCH_PLAYBACK_STATE');
  const {record,cursor}=playback;
  const visible=record.events.slice(0,cursor),latest=visible.at(-1);
  const sum={homeGoals:0,awayGoals:0,shotsHome:0,shotsAway:0,xgHome:0,xgAway:0,passesHome:0,passesAway:0,possessionsHome:0,possessionsAway:0};
  for(const e of visible){
    sum.homeGoals+=e.consequences.score.home;
    sum.awayGoals+=e.consequences.score.away;
    const home=e.teamId===record.homeTeamId;
    if(e.type==='goal'||e.type==='shot'){
      sum[home?'shotsHome':'shotsAway']++;
      sum[home?'xgHome':'xgAway']+=e.xg;
    }
    if(e.type==='pass')sum[home?'passesHome':'passesAway']++;
    if(e.type==='possession')sum[home?'possessionsHome':'possessionsAway']++;
  }
  sum.xgHome=round(sum.xgHome);sum.xgAway=round(sum.xgAway);
  const schedule=regularMatchSchedule(record.matchSeed);
  const complete=cursor===record.events.length;
  const halfReached=visible.some(e=>e.type==='half_time');
  const halfTime=visible.find(e=>e.type==='half_time');
  const halftimeIndex=halfTime?visible.indexOf(halfTime):-1;
  const halfGoals=halfTime?visible.slice(0,halftimeIndex).reduce((tot,e)=>({home:tot.home+e.consequences.score.home,away:tot.away+e.consequences.score.away}),{home:0,away:0}):null;
  return {cursor,total:record.events.length,finished:complete,paused:playback.paused,speed:playback.speed,
    clock:latest?officialMatchClock(latest):"0'",phase:latest?.phase||'not_started',
    elapsedSecond:latest?eventSeconds(latest):0,progress:Math.round((cursor/record.events.length)*100),
    firstHalfStoppageMinutes:schedule.firstHalfStoppageMinutes,secondHalfStoppageMinutes:schedule.secondHalfStoppageMinutes,
    halftime:halfReached?halfGoals:null,stats:sum,visibleEvents:visible,
    // Timeline is displayed newest first; only salient actions become commentary entries.
    highlights:visible.filter(e=>['kickoff','shot','goal','half_time','full_time','recovery'].includes(e.type)).slice(-32).reverse()};
}
