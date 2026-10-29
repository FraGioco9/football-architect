/** Server-only season authority and exact transaction guards. No HTTP route here. */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import type {ApprovedSnapshot} from './catalogue-snapshot.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {loadApprovedSeasonTwoAuthority} from './season-two-initial-schedule.ts';
import {abortUnless} from './command-guards.ts';
import {ApiError} from './errors.ts';
export function seasonTwoSourceGuards(db:Database,a:Awaited<ReturnType<typeof loadApprovedSeasonTwoAuthority>>):Statement[]{
 const {source:s,approval:p}=a,e=s.evidence,r=s.archive;
 return [
  abortUnless(db,'SELECT 1 FROM season_two_approvals WHERE target_season=2 AND generation=? AND source_archive_hash=? AND snapshot_hash=? AND snapshot_json=? AND approved_by=? AND approved_at=?',[p.generation,p.source_archive_hash,p.snapshot_hash,p.snapshot_json,p.approved_by,p.approved_at]),
  abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=1 AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[e.season.generation,e.season.participants_hash,e.season.rules_hash,e.season.snapshot_json]),
  abortUnless(db,'SELECT 1 FROM season_calendars WHERE season_number=1 AND calendar_version=? AND calendar_hash=? AND calendar_json=?',[e.calendar.calendar_version,e.calendar.calendar_hash,e.calendar.calendar_json]),
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=1)=2',[]),
  ...e.draws.map(d=>abortUnless(db,'SELECT 1 FROM season_draws WHERE season_number=1 AND competition_id=? AND stage_id=? AND algorithm_version=? AND seed=? AND outcome_hash=? AND outcome_json=?',[d.competition_id,d.stage_id,d.algorithm_version,d.seed,d.outcome_hash,d.outcome_json])),
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=1)=56',[]),
  ...s.receipts.map(d=>abortUnless(db,'SELECT 1 FROM season_day_outcomes WHERE season_number=1 AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',[d.day,d.generation,d.calendar_hash,d.simulation_version,d.outcome_hash,d.outcome_json])),
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_knockout_ties WHERE season_number=1)=54',[]),
  ...s.ties.map(t=>abortUnless(db,'SELECT 1 FROM season_knockout_ties WHERE season_number=1 AND generation=? AND competition_id=? AND phase_id=? AND tie_id=? AND plan_hash=? AND plan_json=?',[t.generation,t.competition_id,t.phase_id,t.tie_id,t.plan_hash,t.plan_json])),
  abortUnless(db,'SELECT 1 FROM season_archives WHERE season_number=1 AND generation=? AND calendar_hash=? AND results_hash=? AND knockout_hash=? AND archive_hash=? AND results_count=? AND days_count=? AND ties_count=? AND created_at=?',[r.generation,r.calendar_hash,r.results_hash,r.knockout_hash,r.archive_hash,r.results_count,r.days_count,r.ties_count,r.created_at]),
 ];
}
export async function loadSeasonSnapshotAuthority(db:Database,world:WorldV1):Promise<{snapshot:ApprovedSnapshot;guards:Statement[]}>{
 if(world.seasonNumber===1)return {snapshot:await loadApprovedSnapshot(),guards:[]};
 if(world.seasonNumber!==2)throw new ApiError(409,'unsupported_season');
 const authority=await loadApprovedSeasonTwoAuthority(db);
 if(authority.world.generation!==world.generation||authority.world.revision!==world.revision||authority.world.seasonNumber!==2||authority.world.phase!==world.phase||authority.world.day!==world.day)throw new ApiError(409,'stale_world');
 return {snapshot:authority.snapshot,guards:seasonTwoSourceGuards(db,authority)};
}
