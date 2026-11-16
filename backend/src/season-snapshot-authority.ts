/** Server-only season authority and exact transaction guards. No HTTP route here. */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import type {ApprovedSnapshot} from './catalogue-snapshot.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {loadApprovedSeasonTwoAuthority} from './season-two-initial-schedule.ts';
import {abortUnless} from './command-guards.ts';
import {ApiError} from './errors.ts';
/** V2-only Season 2 authority. Exact frozen day/match/knockout source
 * guards are produced by the same independent verifier as Season 1 closure.
 * No pre-V2 score table may certify promotion or titleholder allocation.
 */
export function seasonTwoSourceGuards(db:Database,a:Awaited<ReturnType<typeof loadApprovedSeasonTwoAuthority>>):Statement[]{
 const {source:s,approval:p}=a,r=s.archive;
 return [
  abortUnless(db,'SELECT 1 FROM season_two_approvals WHERE target_season=2 AND generation=? AND source_archive_hash=? AND snapshot_hash=? AND snapshot_json=? AND approved_by=? AND approved_at=?',
   [p.generation,p.source_archive_hash,p.snapshot_hash,p.snapshot_json,p.approved_by,p.approved_at]),
  ...s.proof.guards,
  abortUnless(db,'SELECT 1 FROM season_archives WHERE season_number=1 AND generation=? AND calendar_hash=? AND results_hash=? AND knockout_hash=? AND archive_hash=? AND results_count=4082 AND days_count=56 AND ties_count=54 AND created_at=?',
   [r.generation,r.calendar_hash,r.results_hash,r.knockout_hash,r.archive_hash,r.created_at]),
  abortUnless(db,"SELECT 1 FROM season_admin_events WHERE season_number=1 AND event_id='season:close' AND status='completed' AND receipt_hash=?",
   [r.archive_hash])
 ];
}
export async function loadSeasonSnapshotAuthority(db:Database,world:WorldV1):Promise<{snapshot:ApprovedSnapshot;guards:Statement[]}>{
 if(world.seasonNumber===1)return {snapshot:await loadApprovedSnapshot(),guards:[]};
 if(world.seasonNumber!==2)throw new ApiError(409,'unsupported_season');
 const authority=await loadApprovedSeasonTwoAuthority(db);
 if(authority.world.generation!==world.generation||authority.world.revision!==world.revision||authority.world.seasonNumber!==2||authority.world.phase!==world.phase||authority.world.day!==world.day)throw new ApiError(409,'stale_world');
 return {snapshot:authority.snapshot,guards:seasonTwoSourceGuards(db,authority)};
}
