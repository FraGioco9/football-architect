// SIM01.03 — Pure regular-time schedule, official clock and completed-timeline invariants.
// Elapsed seconds include first-half stoppage, keeping stored event timestamps monotonic.
// Displayed minutes are offset after half-time (46..90, then 90+N).
import {randomFactory,scopedSeed} from './rng.js';
import {inspectMatchEventTimeline,scoreFromMatchEvents} from './match-events.js';

const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const elapsed=e=>e.minute*60+e.second;

export function regularMatchSchedule(matchSeed){
  if(!integer(matchSeed,0,0xffffffff)) throw new RangeError('MATCH_CLOCK_SEED: expected uint32');
  // Independent from action RNG: does not perturb the legacy simulator or preview draw stream.
  const stoppageRng=randomFactory(scopedSeed(matchSeed,'regular-match-stoppage'));
  const firstHalfStoppageMinutes=1+Math.floor(stoppageRng()*4);
  const secondHalfStoppageMinutes=2+Math.floor(stoppageRng()*5);
  const halfTimeSecond=2700+firstHalfStoppageMinutes*60;
  const secondHalfStoppageSecond=halfTimeSecond+2700;
  const fullTimeSecond=secondHalfStoppageSecond+secondHalfStoppageMinutes*60;
  return {
    firstHalfStoppageMinutes,secondHalfStoppageMinutes,
    halfTimeSecond,secondHalfStoppageSecond,fullTimeSecond,
    windows:[
      {phase:'first_half',start:0,end:2700},
      {phase:'first_half_stoppage',start:2700,end:halfTimeSecond},
      {phase:'second_half',start:halfTimeSecond,end:secondHalfStoppageSecond},
      {phase:'second_half_stoppage',start:secondHalfStoppageSecond,end:fullTimeSecond}
    ]
  };
}

/** The timestamp is elapsed match time; the official display resets its offset after half-time. */
export function officialMatchClock(event){
  if(!event || !integer(event.matchSeed,0,0xffffffff) || !integer(event.minute,0,135) ||
    !integer(event.second,0,59)) throw new TypeError('MATCH_CLOCK_EVENT: invalid event');
  const schedule=regularMatchSchedule(event.matchSeed);
  const time=elapsed(event);
  switch(event.phase){
    case 'first_half':return `${Math.floor(time/60)+1}'`;
    case 'first_half_stoppage':return `45+${Math.floor((time-2700)/60)+1}'`;
    case 'half_time':return 'HT';
    case 'second_half':return `${Math.floor((time-schedule.halfTimeSecond)/60)+46}'`;
    case 'second_half_stoppage':return `90+${Math.floor((time-schedule.secondHalfStoppageSecond)/60)+1}'`;
    case 'full_time':return 'FT';
    default:throw new RangeError('MATCH_CLOCK_PHASE: unsupported regular-time phase');
  }
}

/** Validates the *entire* regular-time fixture, not a partial or legacy v1 event stream. */
export function inspectCompletedMatchTimeline(events){
  const base=inspectMatchEventTimeline(events);
  if(!base.ok) return base;
  const issues=[];
  const fail=(code,path)=>issues.push({code,path});
  if(!events.length) return {ok:false,issues:[{code:'MATCH_EMPTY',path:'$'}]};
  const schedule=regularMatchSchedule(events[0].matchSeed);
  const {halfTimeSecond,secondHalfStoppageSecond,fullTimeSecond}=schedule;
  const halfTimes=events.filter(e=>e.type==='half_time');
  const fullTimes=events.filter(e=>e.type==='full_time');
  if(halfTimes.length!==1) fail('HALF_TIME_COUNT','$');
  if(fullTimes.length!==1) fail('FULL_TIME_COUNT','$');
  const first=events[0];
  if(first.type!=='kickoff'||first.phase!=='first_half'||elapsed(first)!==0||first.teamId!==first.homeTeamId)
    fail('FIRST_KICKOFF','[0]');
  const halfIndex=events.findIndex(e=>e.type==='half_time');
  if(halfIndex!==-1){
    if(elapsed(events[halfIndex])!==halfTimeSecond||events[halfIndex].phase!=='half_time')
      fail('HALF_TIME_CLOCK',`[${halfIndex}]`);
    const next=events[halfIndex+1];
    if(!next||next.type!=='kickoff'||next.phase!=='second_half'||
        elapsed(next)!==halfTimeSecond||next.teamId!==first.awayTeamId)
      fail('SECOND_KICKOFF',`[${halfIndex+1}]`);
  }
  const fullIndex=events.findIndex(e=>e.type==='full_time');
  if(fullIndex!==-1){
    if(fullIndex!==events.length-1) fail('EVENT_AFTER_WHISTLE',`[${fullIndex}]`);
    if(elapsed(events[fullIndex])!==fullTimeSecond||events[fullIndex].phase!=='full_time')
      fail('FULL_TIME_CLOCK',`[${fullIndex}]`);
  }
  const windows=new Map(schedule.windows.map(w=>[w.phase,w]));
  const seen=new Set();
  const scoringActions=new Set();
  for(let i=0;i<events.length;i++){
    const e=events[i],time=elapsed(e);
    const segment=windows.get(e.phase);
    if(segment){
      seen.add(e.phase);
      if(time<segment.start||time>=segment.end) fail('PHASE_TIME',`[${i}].minute`);
      if(e.type==='half_time'||e.type==='full_time') fail('WHISTLE_WITHIN_PLAY',`[${i}].type`);
    }else if(e.phase==='half_time'){
      if(e.type!=='half_time'||time!==halfTimeSecond) fail('HALF_TIME_PHASE',`[${i}]`);
    }else if(e.phase==='full_time'){
      if(e.type!=='full_time'||time!==fullTimeSecond) fail('FULL_TIME_PHASE',`[${i}]`);
    }else fail('EXTRA_TIME_NOT_SUPPORTED',`[${i}].phase`);
    if(e.type==='goal'||e.type==='shot'){
      const key=`${time}:${e.teamId}:${e.playerId}`;
      if(scoringActions.has(key)) fail('DUPLICATE_ATTEMPT',`[${i}]`);
      scoringActions.add(key);
    }
  }
  for(const phase of windows.keys()) if(!seen.has(phase)) fail('MISSING_PHASE',phase);
  return {ok:issues.length===0,issues,schedule};
}

export function summarizeCompletedMatchTimeline(events){
  const report=inspectCompletedMatchTimeline(events);
  if(!report.ok) throw new Error(`MATCH_TIMELINE_INCOMPLETE: ${report.issues.map(x=>x.code).join(',')}`);
  const halftimeIndex=events.findIndex(e=>e.type==='half_time');
  const halftime=scoreFromMatchEvents(events.slice(0,halftimeIndex));
  const final=scoreFromMatchEvents(events);
  return {
    halfTime:{home:halftime.home,away:halftime.away},
    fullTime:{home:final.home,away:final.away},
    firstHalfStoppageMinutes:report.schedule.firstHalfStoppageMinutes,
    secondHalfStoppageMinutes:report.schedule.secondHalfStoppageMinutes,
    elapsedMinutes:report.schedule.fullTimeSecond/60,
    finalWhistleEventId:events.at(-1).id
  };
}
