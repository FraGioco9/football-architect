// SIM01.03 — isolated deterministic causal match preview with full regular-time timeline.
// Does not replace simulateMatch or write to a career.
import {createMatchEvent, inspectMatchEventTimeline, scoreFromMatchEvents} from './match-events.js';
import {randomFactory, matchSeed as deriveMatchSeed} from './rng.js';
import {regularMatchSchedule,inspectCompletedMatchTimeline,summarizeCompletedMatchTimeline} from './match-timeline.js';
import {formationSlots, teamStrength} from './lineups.js';
import {playerById} from './selectors.js';
import {clamp} from './rules.js';

const ATTACK_ROLES = new Set(['ATT','AS','AD','COC']);
const MIDFIELD_ROLES = new Set(['CC','MED','COC','AS','AD']);
const DEFENCE_ROLES = new Set(['POR','DC','TS','TD','MED']);
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const round = n => Math.round(n * 10000) / 10000;

function weighted(rand, players, purpose, exclude = null) {
  const choices = players.filter(p => p.id !== exclude);
  if (!choices.length) return null;
  const weight = player => {
    const role = purpose === 'shot' ? (ATTACK_ROLES.has(player.position) ? 4.5 : MIDFIELD_ROLES.has(player.position) ? 1.5 : .20)
      : purpose === 'pass' ? (MIDFIELD_ROLES.has(player.position) ? 3 : DEFENCE_ROLES.has(player.position) ? 1.5 : 1)
      : (DEFENCE_ROLES.has(player.position) ? 2.5 : 1.3);
    return role * clamp(player.ovr / 75, .45, 1.7) * clamp((player.fitness ?? 85) / 85, .55, 1.15);
  };
  const total = choices.reduce((sum, p) => sum + weight(p), 0);
  let pointer = rand() * total;
  for (const p of choices) if ((pointer -= weight(p)) <= 0) return p;
  return choices.at(-1);
}

function teamProfile(world, teamId) {
  const ids = formationSlots(world,teamId);
  const lineup = ids.map(id => playerById(world,id)).filter(Boolean);
  if (lineup.length < 7 || new Set(lineup.map(p => p.id)).size !== lineup.length ||
      lineup.some(p => p.clubId !== teamId || p.injury)) {
    throw new Error(`MATCH_ACTION_LINEUP: invalid starting lineup for ${teamId}`);
  }
  const mean = players => players.length ? players.reduce((sum,p)=>sum+p.ovr,0)/players.length : teamStrength(world,teamId);
  const attack = lineup.filter(p => ATTACK_ROLES.has(p.position));
  const defense = lineup.filter(p => DEFENCE_ROLES.has(p.position));
  const style = world.clubId === teamId ? world.tactic : 'Equilibrata';
  const pressing = world.clubId === teamId ? world.pressing : 'Normale';
  const tempo = world.clubId === teamId ? world.tempo : 'Normale';
  return {id:teamId,lineup,strength:teamStrength(world,teamId),attack:mean(attack),defense:mean(defense),
    fitness:lineup.reduce((sum,p)=>sum+(p.fitness??85),0)/lineup.length,style,pressing,tempo};
}

/**
 * Generate a reproducible *preview* of two halves and their stoppage time.
 * Every shot is independently resolved via rand() < xG and becomes either
 * `shot` or `goal` (never both). Score is summed exclusively from the events.
 * Half-time, second kickoff, added time and final whistle are first-class events.
 *
 * @param {object} world existing career, read-only
 * @param {object} fixture an existing {id,home,away} match
 * @param {{seed?: number}} options optional explicit uint32 match seed
 */
export function generateMatchActions(world, fixture, options = {}) {
  if (!world || !fixture || typeof fixture.id !== 'string' || !fixture.id ||
      !Number.isSafeInteger(fixture.home) || !Number.isSafeInteger(fixture.away) ||
      fixture.home <= 0 || fixture.away <= 0 || fixture.home === fixture.away ||
      !Number.isInteger(world.season) || world.season < 1 || world.season > 1000000 ||
      typeof world.countryId !== 'string' || !world.countryId.trim() || !uint32(world.seed)) {
    throw new TypeError('MATCH_ACTION_CONTEXT: invalid career or fixture');
  }
  if (!Array.isArray(world.teams) || ![fixture.home,fixture.away].every(id => world.teams.some(t => t.id === id))) {
    throw new Error('MATCH_ACTION_TEAMS: fixture clubs are not in the career');
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('MATCH_ACTION_OPTIONS: expected an object');
  }
  const seed = options.seed === undefined
    ? deriveMatchSeed(world.seed,world.season,world.countryId,fixture.id) : options.seed;
  if (!uint32(seed)) throw new RangeError('MATCH_ACTION_SEED: expected uint32');
  const rand = randomFactory(seed);
  const profile = {home:teamProfile(world,fixture.home),away:teamProfile(world,fixture.away)};
  const ctx = {season:world.season,competitionId:world.countryId,matchId:fixture.id,
    homeTeamId:fixture.home,awayTeamId:fixture.away,matchSeed:seed};
  const schedule=regularMatchSchedule(seed);
  const events = [];
  let activePhase='first_half';
  const push = (type,side,time,properties={}) => {
    const secondOfMatch=time;
    const minute = Math.floor(secondOfMatch/60);
    const second = secondOfMatch % 60;
    const teamId = side === null ? null : profile[side].id;
    const event = createMatchEvent({ ...ctx, sequence:events.length, minute, second,
      phase:activePhase, type, teamId, ...properties });
    events.push(event);
    return event;
  };

  // One bounded 45-second possession tick; each period is isolated by a whistle.
  // Scores arise from independently resolved xG shots, including added time.
  let owner = 'home';
  let restart = 'kickoff';
  const playWindow=segment=>{
    activePhase=segment.phase;
    for (let start=segment.start;start<segment.end;start+=45){
      // All action timestamps must remain strictly within their designated phase.
      const at=offset=>Math.min(segment.end-1,start+offset);
      if(restart) {
        const actor=weighted(rand,profile[owner].lineup,restart==='recovery'?'recovery':'pass');
        push(restart,owner,at(0),{playerId:actor.id});
      }
      push('possession',owner,at(2),{playerId:null});
      const attacking = profile[owner], defending = profile[owner==='home'?'away':'home'];
      const advantage = (attacking.attack-defending.defense)*.012 + (attacking.strength-defending.strength)*.006
        + (owner==='home'?.12:0) + (attacking.style==='Offensiva'?.13:attacking.style==='Prudente'?-.11:0);
      const stamina = clamp((attacking.fitness-65)/25,0,1);
      const passing = 1+(rand()<clamp(.48 + stamina*.20 + advantage*.10,.25,.85)?1:0);
      const distributor = weighted(rand,attacking.lineup,'pass');
      for(let i=0;i<passing;i++){
        const passer=i===0?distributor:weighted(rand,attacking.lineup,'pass');
        push('pass',owner,at(7+i*9),{playerId:passer.id});
      }
      const rate = clamp((.195 + advantage*.05)*(attacking.tempo==='Alto'?1.16:attacking.tempo==='Basso'?.87:1),.08,.35);
      if(rand()<rate){
        const striker=weighted(rand,attacking.lineup,'shot');
        // Shot position/skill, defensive shape, fitness and tactics shape xG.
        const playerQuality=(striker.ovr-70)*.0022;
        const placement=rand();
        const quality=clamp((.018+placement*placement*.255+playerQuality) *
          clamp(1 + advantage*.38 + (attacking.fitness-85)*.004,.60,1.45), .012,.68);
        const xg=round(quality);
        const goal=rand()<xg; // The result is *not* determined in advance.
        const assist=goal && rand()<.64 ? weighted(rand,attacking.lineup,'pass',striker.id) : null;
        push(goal?'goal':'shot',owner,at(35),{playerId:striker.id,xg,relatedPlayerId:assist?.id??null});
        owner=owner==='home'?'away':'home';
        restart=goal?'kickoff':'recovery';
      } else {
        const retaining=clamp(.49 + advantage*.17 + (stamina-.5)*.08 -
          (defending.pressing==='Alto'?.08:defending.pressing==='Basso'?-.05:0),.25,.78);
        if(rand()>retaining){owner=owner==='home'?'away':'home';restart='recovery';}
        else restart=null;
      }
    }
  };
  playWindow(schedule.windows[0]);
  playWindow(schedule.windows[1]);
  activePhase='half_time';
  push('half_time',null,schedule.halfTimeSecond);
  owner='away';restart='kickoff';
  playWindow(schedule.windows[2]);
  playWindow(schedule.windows[3]);
  activePhase='full_time';
  push('full_time',null,schedule.fullTimeSecond);
  const report=inspectCompletedMatchTimeline(events);
  if(!report.ok) throw new Error(`MATCH_ACTION_TIMELINE: ${report.issues.map(x=>x.code).join(',')}`);
  const summary=summarizeMatchActions(events);
  const timeline=summarizeCompletedMatchTimeline(events);
  return {competitionId:ctx.competitionId,matchId:ctx.matchId,season:ctx.season,
    matchSeed:seed,homeTeamId:ctx.homeTeamId,awayTeamId:ctx.awayTeamId,events,summary,timeline};
}

/** Derive every displayed statistic from a validated event stream, never from a chosen result. */
export function summarizeMatchActions(events) {
  if (!Array.isArray(events) || !events.length) throw new Error('MATCH_ACTION_EMPTY: no actions');
  const report=inspectMatchEventTimeline(events);
  if (!report.ok) throw new Error(`MATCH_ACTION_TIMELINE: ${report.issues.map(x=>x.code).join(',')}`);
  if(events.some(e=>e.type==='half_time'||e.type==='full_time')) {
    const completed=inspectCompletedMatchTimeline(events);
    if(!completed.ok) throw new Error(`MATCH_ACTION_TIMELINE: ${completed.issues.map(x=>x.code).join(',')}`);
  }
  const homeId=events[0].homeTeamId, awayId=events[0].awayTeamId;
  const score=scoreFromMatchEvents(events);
  const summary={homeGoals:score.home,awayGoals:score.away,shotsHome:0,shotsAway:0,
    xgHome:0,xgAway:0,possessionsHome:0,possessionsAway:0,passesHome:0,passesAway:0};
  for(const event of events){
    const home=event.teamId===homeId;
    if(event.type==='shot' || event.type==='goal'){
      summary[home?'shotsHome':'shotsAway']++;
      summary[home?'xgHome':'xgAway']+=event.xg;
    }
    if(event.type==='possession') summary[home?'possessionsHome':'possessionsAway']++;
    if(event.type==='pass') summary[home?'passesHome':'passesAway']++;
  }
  summary.xgHome=round(summary.xgHome);
  summary.xgAway=round(summary.xgAway);
  return summary;
}
