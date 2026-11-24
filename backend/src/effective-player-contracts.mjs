/** #777 Phase B: one authoritative relationship derived from signed terms.
 * SQL fragments are compile-time constants only; never append client expressions.
 * No persistent mirror and no legacy affiliation fallback.
 */
const effectiveRelation=(tick,phaseCondition)=>`(
 SELECT c.player_id,c.club_key,c.id AS contract_id
 FROM player_signed_contracts c
 JOIN world_state w ON w.id=1 AND w.generation=c.world_generation
 JOIN generated_players g ON g.id=c.player_id
 WHERE json_extract(g.payload_json,'$.career_status')='active'
 AND (${phaseCondition})
 AND c.start_tick<=(${tick})
 AND c.scheduled_end_tick>(${tick})
 AND (c.closed_tick IS NULL OR c.closed_tick>(${tick}))
)`;
// At Season 0 / preparing day 0, expose opening day-1 signed terms for roster
// inspection only. This projection never earns salary or advances the clock.
// At a closed season, the roster is still the last sporting day's roster;
// expiry takes effect at the first tick of the next season.
export const CURRENT_PLAYER_CONTRACTS_SQL=effectiveRelation(
 'CASE WHEN w.season_number=0 THEN 0 ELSE (w.season_number-1)*56+MAX(w.day,1)-1 END',
 "w.phase IN ('unstarted','preparing','active','closed')"
);
// Day finalization plans matches for world.day+1, not the already completed day.
// Do not cross a transition or treat closed Season 56 as a playable day.
export const NEXT_MATCH_PLAYER_CONTRACTS_SQL=effectiveRelation(
 '(w.season_number-1)*56+w.day',
 "w.season_number>0 AND ((w.phase='preparing' AND w.day=0) OR (w.phase='active' AND w.day BETWEEN 1 AND 55))"
);
