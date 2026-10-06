// SIM01.01 — Versioned, browser-independent event contract for the future match engine.
// This module is NOT connected to the legacy v1 simulateMatch() algorithm.
import {scopedSeed} from './rng.js';

export const MATCH_EVENT_SCHEMA_VERSION = 1;
export const MATCH_EVENT_PHASES = Object.freeze([
  'first_half', 'first_half_stoppage', 'half_time',
  'second_half', 'second_half_stoppage',
  'extra_first_half', 'extra_first_half_stoppage', 'extra_half_time',
  'extra_second_half', 'extra_second_half_stoppage', 'shootout', 'full_time'
]);
export const MATCH_EVENT_TYPES = Object.freeze([
  'kickoff', 'possession', 'recovery', 'pass', 'shot', 'goal',
  'foul', 'yellow_card', 'red_card', 'injury', 'substitution',
  'half_time', 'full_time'
]);

const neutralTypes = new Set(['half_time','full_time']);
const actorTypes = new Set(['pass','shot','goal','foul','yellow_card','red_card','injury','substitution']);
const shotTypes = new Set(['shot','goal']);
const cardFor = Object.freeze({yellow_card:'yellow',red_card:'red'});
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const uint32 = x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFFFF;
const positiveId = x => Number.isSafeInteger(x) && x > 0;
const nonempty = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 160;
const int = (x,min,max) => Number.isInteger(x) && x >= min && x <= max;
const nullablePlayer = x => x === null || positiveId(x);

export function matchEventId({season,competitionId,matchId,sequence}) {
  return `evt:${season}:${encodeURIComponent(competitionId)}:${encodeURIComponent(matchId)}:${sequence}`;
}

export function matchEventSeed(matchSeed,competitionId,matchId,sequence) {
  return scopedSeed(matchSeed,'match-event',competitionId,matchId,sequence);
}

// Callers provide an explicit index and match seed; no PRNG draws, clock or global state.
// The score delta belongs to a GOAL event, not to both a SHOT and a GOAL event.
export function createMatchEvent(input) {
  if (!object(input)) throw new TypeError('MATCH_EVENT_INPUT: expected an object');
  const {
    competitionId, matchId, season, homeTeamId, awayTeamId,
    sequence, minute, second = 0, phase, type,
    teamId = null, playerId = null, relatedPlayerId = null,
    xg = null, matchSeed, injuryMatches = null
  } = input;
  const goal = type === 'goal';
  const event = {
    schemaVersion:MATCH_EVENT_SCHEMA_VERSION,
    id:matchEventId({season,competitionId,matchId,sequence}),
    matchId,competitionId,season,homeTeamId,awayTeamId,sequence,
    minute,second,phase,type,teamId,playerId,relatedPlayerId,xg,
    matchSeed,seed:matchEventSeed(matchSeed,competitionId,matchId,sequence),
    consequences:{
      score:{home:goal && teamId === homeTeamId ? 1 : 0,away:goal && teamId === awayTeamId ? 1 : 0},
      card:cardFor[type] || null,
      injuryMatches:type === 'injury' ? injuryMatches : null,
      replacementPlayerId:type === 'substitution' ? relatedPlayerId : null
    }
  };
  assertMatchEvent(event);
  return event;
}

// Returns machine-readable errors without rewriting an imported event or throwing.
export function validateMatchEvent(event) {
  const issues=[];
  const fail=(code,path)=>issues.push({code,path});
  if(!object(event)) return {ok:false,issues:[{code:'EVENT_INVALID',path:'$'}]};
  if(event.schemaVersion !== MATCH_EVENT_SCHEMA_VERSION) fail('EVENT_SCHEMA','schemaVersion');
  if(!nonempty(event.matchId)) fail('MATCH_ID','matchId');
  if(!nonempty(event.competitionId)) fail('COMPETITION_ID','competitionId');
  if(!int(event.season,1,1000000)) fail('SEASON','season');
  if(!positiveId(event.homeTeamId)) fail('HOME_TEAM','homeTeamId');
  if(!positiveId(event.awayTeamId) || event.awayTeamId === event.homeTeamId) fail('AWAY_TEAM','awayTeamId');
  if(!int(event.sequence,0,1000000)) fail('SEQUENCE','sequence');
  if(!int(event.minute,0,135)) fail('MINUTE','minute');
  if(!int(event.second,0,59)) fail('SECOND','second');
  if(!MATCH_EVENT_PHASES.includes(event.phase)) fail('PHASE','phase');
  if(!MATCH_EVENT_TYPES.includes(event.type)) fail('TYPE','type');
  if(event.teamId !== null && event.teamId !== event.homeTeamId && event.teamId !== event.awayTeamId) fail('TEAM','teamId');
  if(!nullablePlayer(event.playerId)) fail('PLAYER','playerId');
  if(!nullablePlayer(event.relatedPlayerId)) fail('RELATED_PLAYER','relatedPlayerId');
  if(event.relatedPlayerId !== null && event.relatedPlayerId === event.playerId) fail('SAME_PLAYERS','relatedPlayerId');
  if(!uint32(event.matchSeed)) fail('MATCH_SEED','matchSeed');
  if(!uint32(event.seed)) fail('EVENT_SEED','seed');
  if(!nonempty(event.id)) fail('EVENT_ID','id');

  if(MATCH_EVENT_TYPES.includes(event.type)) {
    if(neutralTypes.has(event.type)) {
      if(event.teamId !== null || event.playerId !== null || event.relatedPlayerId !== null) fail('NEUTRAL_ACTOR','teamId');
    } else {
      if(event.teamId === null) fail('TEAM_REQUIRED','teamId');
      if(actorTypes.has(event.type) && event.playerId === null) fail('PLAYER_REQUIRED','playerId');
    }
    if(event.relatedPlayerId !== null && !['goal','substitution'].includes(event.type)) fail('RELATED_NOT_ALLOWED','relatedPlayerId');
    if(shotTypes.has(event.type)) {
      if(typeof event.xg !== 'number' || !Number.isFinite(event.xg) || event.xg < 0 || event.xg > 1) fail('XG_REQUIRED','xg');
    } else if(event.xg !== null) fail('XG_NOT_ALLOWED','xg');
  }

  if(!object(event.consequences)) fail('CONSEQUENCES','consequences');
  else {
    const c=event.consequences;
    if(!object(c.score) || !int(c.score.home,0,1) || !int(c.score.away,0,1)) fail('SCORE_DELTA','consequences.score');
    else {
      const expectedHome=Number(event.type==='goal'&&event.teamId===event.homeTeamId);
      const expectedAway=Number(event.type==='goal'&&event.teamId===event.awayTeamId);
      if(c.score.home!==expectedHome || c.score.away!==expectedAway) fail('GOAL_DELTA','consequences.score');
    }
    if(c.card !== (cardFor[event.type]||null)) fail('CARD_EFFECT','consequences.card');
    if(event.type==='injury') {
      if(!int(c.injuryMatches,1,52)) fail('INJURY_EFFECT','consequences.injuryMatches');
    } else if(c.injuryMatches !== null) fail('INJURY_NOT_ALLOWED','consequences.injuryMatches');
    if(event.type==='substitution') {
      if(!positiveId(c.replacementPlayerId) || c.replacementPlayerId!==event.relatedPlayerId) fail('SUBSTITUTION_EFFECT','consequences.replacementPlayerId');
    } else if(c.replacementPlayerId !== null) fail('SUBSTITUTION_NOT_ALLOWED','consequences.replacementPlayerId');
  }
  if(event.type==='injury' && (!object(event.consequences) || event.consequences.injuryMatches === null)) fail('INJURY_REQUIRED','consequences.injuryMatches');
  if(event.type==='substitution' && event.relatedPlayerId===null) fail('SUBSTITUTE_REQUIRED','relatedPlayerId');
  if(event.type==='half_time' && event.phase!=='half_time') fail('HALFTIME_PHASE','phase');
  if(event.type==='half_time' && Number.isInteger(event.minute) && event.minute<45) fail('HALFTIME_MINUTE','minute');
  if(event.type==='full_time' && event.phase!=='full_time') fail('FULLTIME_PHASE','phase');
  if(event.type==='full_time' && Number.isInteger(event.minute) && event.minute<90) fail('FULLTIME_MINUTE','minute');

  if(nonempty(event.competitionId) && nonempty(event.matchId) && int(event.season,1,1000000) && int(event.sequence,0,1000000)) {
    if(event.id!==matchEventId(event)) fail('EVENT_ID_MISMATCH','id');
    if(uint32(event.matchSeed) && event.seed!==matchEventSeed(event.matchSeed,event.competitionId,event.matchId,event.sequence)) fail('SEED_MISMATCH','seed');
  }
  return {ok:issues.length===0,issues};
}

export function assertMatchEvent(event) {
  const report=validateMatchEvent(event);
  if(!report.ok) {
    const error=new Error(`Invalid match event: ${report.issues.map(x=>x.code).join(', ')}`);
    error.issues=report.issues;
    throw error;
  }
  return event;
}

// Read-only timeline checks; these validate the contract, not the match simulation.
export function inspectMatchEventTimeline(events) {
  const issues=[];
  const fail=(code,path)=>issues.push({code,path});
  if(!Array.isArray(events)) return {ok:false,issues:[{code:'TIMELINE_INVALID',path:'$'}]};
  const ids=new Set();
  let previous=null;
  for(let i=0;i<events.length;i++){
    const event=events[i];
    const report=validateMatchEvent(event);
    issues.push(...report.issues.map(x=>({...x,path:`[${i}].${x.path}`})));
    if(!object(event)) continue;
    if(event.sequence!==i) fail('NON_CONTIGUOUS_SEQUENCE',`[${i}].sequence`);
    if(ids.has(event.id)) fail('DUPLICATE_EVENT_ID',`[${i}].id`);
    ids.add(event.id);
    if(previous){
      for(const key of ['matchId','competitionId','season','homeTeamId','awayTeamId','matchSeed']){
        if(event[key]!==previous[key]) fail('TIMELINE_MATCH_MISMATCH',`[${i}].${key}`);
      }
      if(Number.isInteger(event.minute)&&Number.isInteger(event.second)&&
          event.minute*60+event.second < previous.minute*60+previous.second) fail('TIMELINE_CLOCK',`[${i}].minute`);
      if(MATCH_EVENT_PHASES.indexOf(event.phase)<MATCH_EVENT_PHASES.indexOf(previous.phase)) fail('TIMELINE_PHASE',`[${i}].phase`);
    }
    previous=event;
  }
  return {ok:issues.length===0,issues};
}

export function scoreFromMatchEvents(events) {
  const report=inspectMatchEventTimeline(events);
  if(!report.ok) throw new Error(`Invalid event timeline: ${report.issues.map(x=>x.code).join(', ')}`);
  return events.reduce((score,event)=>({
    home:score.home+event.consequences.score.home,
    away:score.away+event.consequences.score.away
  }),{home:0,away:0});
}
