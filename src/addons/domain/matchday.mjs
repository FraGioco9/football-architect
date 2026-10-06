/** SIM04 matchday domain, standalone, side-effect-free, schema v1.
 * All functions return new JSON-serializable objects. No Date, Math.random, DOM or storage.
 * Match engine integration must call the substitutions during action generation,
 * not after generating the original events.
 */
export const MATCHDAY_SCHEMA = 1;
export const DEFAULT_RULES = Object.freeze({
  maxSubstitutions: 5,
  maxWindows: 3,
  halftimeFreeWindow: true,
  extraTimeAdditionalSubstitutions: 0,
  extraTimeAdditionalWindows: 0,
  maxBench: 12,
});
export const FORMATIONS = Object.freeze({
  '442': ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
  '433': ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
  '4231': ['GK','RB','CB','CB','LB','CDM','CDM','RW','CAM','LW','ST'],
  '352': ['GK','CB','CB','CB','RM','CM','CDM','CM','LM','ST','ST'],
  '343': ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
  '532': ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
  '541': ['GK','RWB','CB','CB','CB','LWB','RM','CM','CM','LM','ST'],
  '4141': ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'],
  '41212': ['GK','RB','CB','CB','LB','CDM','RM','CAM','LM','ST','ST'],
  '4222': ['GK','RB','CB','CB','LB','CDM','CDM','CAM','CAM','ST','ST'],
});
const POS = new Set(['GK','RB','LB','CB','RWB','LWB','CDM','CM','RM','LM','CAM','RW','LW','CF','ST']);
const assert = (ok, code) => { if (!ok) throw new Error(`MATCHDAY_${code}`); };
const int = (v) => Number.isSafeInteger(v);
const id = (v) => (typeof v === 'string' && v.trim().length > 0) || (int(v) && v > 0);
const copy = (v) => structuredClone(v);
const same = (a,b) => String(a) === String(b);
const unique = (values) => new Set(values.map(String)).size === values.length;
const validRules = (r) => {
  assert(r && typeof r === 'object' && !Array.isArray(r), 'RULES_INVALID');
  for (const field of ['maxSubstitutions','maxWindows','extraTimeAdditionalSubstitutions','extraTimeAdditionalWindows','maxBench']) {
    assert(int(r[field]) && r[field] >= 0 && r[field] <= 24, `RULES_${field.toUpperCase()}`);
  }
  assert(typeof r.halftimeFreeWindow === 'boolean', 'RULES_HALFTIME');
  return r;
};
export function makeRules(overrides = {}) {
  assert(overrides && typeof overrides === 'object' && !Array.isArray(overrides), 'RULES_INVALID');
  const r = { ...DEFAULT_RULES, ...overrides };
  assert(Object.keys(overrides).every(k => k in DEFAULT_RULES), 'RULES_UNKNOWN');
  return copy(validRules(r));
}
function normalizePlayer(p) {
  assert(p && id(p.id) && typeof p.position === 'string' && POS.has(p.position.toUpperCase()), 'PLAYER_INVALID');
  const position = p.position.toUpperCase();
  const ovr = p.ovr ?? p.overall ?? 50;
  const fitness = p.fitness ?? 100;
  const morale = p.morale ?? 50;
  assert(Number.isFinite(ovr) && ovr >= 0 && ovr <= 100, 'PLAYER_OVR');
  assert(Number.isFinite(fitness) && fitness >= 0 && fitness <= 100, 'PLAYER_FITNESS');
  assert(Number.isFinite(morale) && morale >= 0 && morale <= 100, 'PLAYER_MORALE');
  return { id:p.id, position, ovr, fitness, morale, unavailable:Boolean(p.unavailable) };
}
/** Explicit XI / bench IDs. Formation is structural: 11 slots, exactly one GK slot. */
export function createMatchSheet({ teamId, players, starters, bench = [], unavailable = [], formation = '442', rules = DEFAULT_RULES }) {
  assert(id(teamId), 'TEAM_ID');
  const valid = validRules(makeRules(rules));
  assert(Array.isArray(players) && Array.isArray(starters) && Array.isArray(bench) && Array.isArray(unavailable), 'SHEET_ARRAYS');
  assert(starters.length === 11, 'STARTERS_COUNT');
  assert(bench.length <= valid.maxBench, 'BENCH_LIMIT');
  assert(unique(starters.concat(bench, unavailable)), 'SHEET_DUPLICATE');
  const roster = players.map(normalizePlayer);
  assert(unique(roster.map(p=>p.id)), 'ROSTER_DUPLICATE');
  const byId = new Map(roster.map(p=>[String(p.id),p]));
  const selected = starters.concat(bench, unavailable);
  assert(selected.every(pid=>id(pid) && byId.has(String(pid))), 'SHEET_UNKNOWN_PLAYER');
  assert(selected.every(pid=> !(byId.get(String(pid)).unavailable && !unavailable.some(x=>same(x,pid)))), 'SHEET_UNAVAILABLE');
  const slots = Array.isArray(formation) ? [...formation].map(p=>String(p).toUpperCase()) : FORMATIONS[String(formation)];
  assert(slots && slots.length === 11 && slots.filter(s=>s==='GK').length === 1 && slots.every(s=>POS.has(s)), 'FORMATION_INVALID');
  assert(starters.filter(pid=>byId.get(String(pid)).position==='GK').length === 1, 'STARTERS_GK');
  assert(byId.get(String(starters[slots.indexOf('GK')])).position === 'GK', 'GK_SLOT');
  assert(unavailable.every(pid=>byId.get(String(pid)).unavailable || !starters.includes(pid)), 'UNAVAILABLE_VALID');
  return { teamId, formation: Array.isArray(formation)?slots:String(formation), slots, players:roster,
    starters:[...starters], bench:[...bench], unavailable:[...unavailable] };
}
const teamOf = (state, teamId) => {
  assert(id(teamId) && state.teams.some(t=>same(t.teamId,teamId)), 'TEAM_NOT_FOUND');
  return state.teams.find(t=>same(t.teamId,teamId));
};
const index = (state, teamId) => state.teams.findIndex(t=>same(t.teamId,teamId));
const lookup = (team, pid) => team.players.find(p=>same(p.id,pid));
export function createMatchday({ matchId, home, away, rules = {}, kickoffSecond = 0 }) {
  assert(id(matchId) && int(kickoffSecond) && kickoffSecond >= 0, 'CONTEXT');
  const rule = makeRules(rules);
  const sheets = [home,away];
  assert(sheets.every(s=>s && id(s.teamId)), 'SHEET_REQUIRED');
  assert(!same(home.teamId,away.teamId), 'SAME_TEAM');
  assert(unique([...home.players,...away.players].map(p=>p.id)), 'CROSS_TEAM_PLAYER_ID');
  const teams = sheets.map(s=>{
    // re-validate imported/snapshot sheets
    const checked = createMatchSheet({...s, rules:rule});
    return { ...checked, onField:[...checked.starters], availableBench:[...checked.bench],
      changes:[], substitutionWindows:[], minutesLedger:checked.starters.map(pid=>({playerId:pid,from:kickoffSecond,to:null})),
      injuryExits:[] };
  });
  return { schemaVersion:MATCHDAY_SCHEMA, matchId, kickoffSecond, currentSecond:kickoffSecond,
    phase:'first_half', rules:rule, teams, events:[], finished:false, finalSecond:null, revision:0 };
}
const PHASES = ['first_half','first_stoppage','half_time','second_half','second_stoppage','extra_first','extra_first_stoppage','extra_break','extra_second','extra_second_stoppage','full_time'];
const extra = (phase) => phase.startsWith('extra_');
const isFree = (phase, rules) => (phase==='half_time' && rules.halftimeFreeWindow) || (phase==='extra_break' && rules.halftimeFreeWindow);
/** Clock is seconds since kickoff (stoppage included, break is zero-clock). */
export function advanceMatchday(state, { second, phase }) {
  validateMatchday(state);
  assert(int(second) && second >= state.currentSecond && second <= 135*60, 'CLOCK');
  assert(PHASES.includes(phase) && PHASES.indexOf(phase) >= PHASES.indexOf(state.phase), 'PHASE');
  assert(!state.finished, 'ALREADY_FINISHED');
  const result = copy(state);
  result.currentSecond=second;
  result.phase=phase;
  result.revision++;
  return result;
}
const limits = (state,phase) => ({
  subs: state.rules.maxSubstitutions + (extra(phase)?state.rules.extraTimeAdditionalSubstitutions:0),
  windows:state.rules.maxWindows + (extra(phase)?state.rules.extraTimeAdditionalWindows:0)
});
/** Automatic/manual substitutions must happen *during* action generation to affect future chances. */
export function applySubstitution(state, {teamId, outgoing, incoming, second, phase=state.phase, reason='manual'}) {
  validateMatchday(state);
  assert(!state.finished, 'ALREADY_FINISHED');
  assert(int(second) && second >= state.currentSecond && second <= 135*60, 'CLOCK');
  assert(PHASES.includes(phase) && phase!=='full_time' && PHASES.indexOf(phase)>=PHASES.indexOf(state.phase), 'PHASE');
  assert(['manual','ai','injury'].includes(reason), 'REASON');
  assert(id(outgoing) && id(incoming) && !same(outgoing,incoming), 'SUB_IDS');
  const before = teamOf(state,teamId);
  assert(before.onField.some(x=>same(x,outgoing)), 'OUT_NOT_ON_FIELD');
  assert(before.availableBench.some(x=>same(x,incoming)), 'IN_NOT_ON_BENCH');
  assert(!before.unavailable.some(x=>same(x,incoming)), 'IN_UNAVAILABLE');
  const prev = lookup(before,outgoing), next = lookup(before,incoming);
  assert(prev && next, 'PLAYER_NOT_FOUND');
  const {subs,windows} = limits(state,phase);
  assert(before.changes.length < subs, 'SUB_LIMIT');
  const key = `${phase}:${second}`;
  const counts = !isFree(phase,state.rules) && !before.substitutionWindows.includes(key);
  assert(!counts || before.substitutionWindows.length < windows, 'WINDOW_LIMIT');
  // GK for GK only, to avoid arbitrary non-GK goalkeepers; other roles are assignable.
  assert((prev.position==='GK') === (next.position==='GK'), 'GK_REPLACEMENT');
  const result=copy(state);
  const team=teamOf(result,teamId);
  const slot=team.onField.findIndex(x=>same(x,outgoing));
  team.onField[slot]=incoming;
  team.availableBench=team.availableBench.filter(x=>!same(x,incoming));
  const entry=team.minutesLedger.findLast(x=>same(x.playerId,outgoing) && x.to===null);
  assert(entry, 'LEDGER_MISSING');
  entry.to=second;
  team.minutesLedger.push({playerId:incoming,from:second,to:null});
  if(counts) team.substitutionWindows.push(key);
  const action={type:'substitution',matchId:state.matchId,teamId,playerId:outgoing,
    relatedPlayerId:incoming,second,phase,reason,windowCounted:counts,
    sequence:result.events.length};
  team.changes.push(action);
  result.events.push(action);
  result.currentSecond=second;
  result.phase=phase;
  result.revision++;
  return result;
}
/** Forced injury exit without replacement, valid even when substitution quota exhausted. */
export function removeInjured(state,{teamId,playerId,second,phase=state.phase}) {
  validateMatchday(state);
  assert(!state.finished && int(second) && second>=state.currentSecond && second<=135*60, 'CLOCK');
  assert(PHASES.includes(phase) && phase!=='full_time' && PHASES.indexOf(phase)>=PHASES.indexOf(state.phase), 'PHASE');
  const result=copy(state);
  const team=teamOf(result,teamId);
  assert(team.onField.some(x=>same(x,playerId)), 'INJURY_NOT_ON_FIELD');
  const entry=team.minutesLedger.findLast(x=>same(x.playerId,playerId) && x.to===null);
  assert(entry, 'LEDGER_MISSING');
  entry.to=second;
  team.onField=team.onField.filter(x=>!same(x,playerId));
  team.injuryExits.push({playerId,second,phase});
  result.events.push({type:'injury_exit',matchId:state.matchId,teamId,playerId,second,phase,sequence:result.events.length});
  result.currentSecond=second;result.phase=phase;result.revision++;
  return result;
}
export function finishMatchday(state,{second,phase='full_time'}) {
  validateMatchday(state);
  assert(!state.finished && int(second) && second>=state.currentSecond && second<=135*60 && phase==='full_time', 'FINISH_TIME');
  const result=copy(state);
  for (const t of result.teams) for(const span of t.minutesLedger) if(span.to===null) span.to=second;
  result.finished=true;result.finalSecond=second;result.currentSecond=second;result.phase='full_time';result.revision++;
  return result;
}
export function minutesPlayed(state, teamId) {
  validateMatchday(state);
  const team=teamOf(state,teamId), end=state.finished?state.finalSecond:state.currentSecond;
  return team.minutesLedger.map(s=>({playerId:s.playerId, seconds:Math.max(0,(s.to??end)-s.from), minutes: Math.max(0,((s.to??end)-s.from)/60)}))
    .filter(p=>p.seconds>0 || team.starters.some(x=>same(x,p.playerId)) || team.changes.some(c=>same(c.relatedPlayerId,p.playerId)));
}
export function matchAppearances(state, teamId) {
  const items=minutesPlayed(state,teamId);
  return items.filter(p=>p.seconds>0).map(p=>({...p, appearances:1, fitnessCost: Number((p.minutes/90 * 8).toFixed(2))}));
}
export function teamStrength(state,teamId) {
  validateMatchday(state);
  const t=teamOf(state,teamId);
  const players=t.onField.map(pid=>lookup(t,pid));
  const score = players.reduce((a,p)=>a+p.ovr*(0.78+0.22*p.fitness/100)*(0.95+0.1*p.morale/100),0);
  return Number((score/11).toFixed(4)); // 10-player injured teams penalized, no filler XI
}
/** Freshly loaded JSON snapshots can be checked without mutating career or save. */
export function validateMatchday(state) {
  assert(state && state.schemaVersion===MATCHDAY_SCHEMA && id(state.matchId), 'SCHEMA');
  assert(int(state.currentSecond) && int(state.kickoffSecond) && state.currentSecond>=state.kickoffSecond, 'CLOCK');
  assert(PHASES.includes(state.phase) && Array.isArray(state.teams) && state.teams.length===2, 'STATE');
  validRules(state.rules);
  assert(!same(state.teams[0].teamId,state.teams[1].teamId),'SAME_TEAM');
  for (const t of state.teams) {
    assert(Array.isArray(t.onField) && Array.isArray(t.availableBench) && Array.isArray(t.minutesLedger) && Array.isArray(t.changes) && Array.isArray(t.substitutionWindows), 'STATE_TEAMS');
    assert(t.onField.length<=11 && unique(t.onField) && unique(t.availableBench) && unique(t.onField.concat(t.availableBench)), 'STATE_FIELD');
    assert(t.onField.every(pid=>t.players.some(p=>same(p.id,pid))), 'STATE_PLAYERS');
    assert(t.changes.length <= state.rules.maxSubstitutions + state.rules.extraTimeAdditionalSubstitutions, 'STATE_SUB_LIMIT');
    assert(t.substitutionWindows.length <= state.rules.maxWindows + state.rules.extraTimeAdditionalWindows, 'STATE_WINDOWS');
    assert(t.minutesLedger.every(s=>id(s.playerId) && int(s.from) && s.from>=state.kickoffSecond && (s.to===null || (int(s.to)&&s.to>=s.from&&s.to<=state.currentSecond))), 'STATE_LEDGER');
    assert(t.onField.every(pid=>t.minutesLedger.some(s=>same(s.playerId,pid)&&s.to===null)) === !state.finished || (state.finished && t.onField.every(pid=>t.minutesLedger.some(s=>same(s.playerId,pid)&&s.to===state.finalSecond))), 'STATE_ACTIVE_LEDGER');
  }
  assert(Array.isArray(state.events) && state.events.every((e,i)=>e.sequence===i && e.matchId===state.matchId), 'STATE_EVENTS');
  assert(typeof state.finished==='boolean', 'STATE_FINISHED');
  return true;
}
export function restoreMatchday(snapshot) {
  validateMatchday(snapshot);
  return copy(snapshot);
}
