/** Single read of all approved V4.2 images for a verified frozen starting XI.
 * This avoids per-player API fetches until the deployment static manifest (#733).
 */
import type {Database} from './database.ts';
import type {MatchStatistics} from './match-player-statistics.mjs';
type ApprovedRow={player_id:number};
export async function approvedMatchPortraitKeys(db:Database,stats:MatchStatistics){
 const ids=[...new Set([...stats.home.players,...stats.away.players]
  .filter(p=>p.started===true&&Number.isSafeInteger(p.playerId)&&p.playerId>0)
  .map(p=>p.playerId))];
 if(ids.length>22)throw new TypeError('Invalid frozen starting XI');
 const approved=new Set<number>();
 if(ids.length){
  const sql=`SELECT player_id FROM player_portrait_profiles
   WHERE player_id IN (${ids.map(()=>'?').join(',')})
   AND status='approved' AND schema_version='player-portraits-v5'
   AND prompt_version='player-portrait-v4.2'
   AND asset_key=('assets/players/portraits/' || player_id || '.webp')`;
  const rows=(await db.prepare(sql).bind(...ids).all<ApprovedRow>()).results;
  for(const row of rows){
   if(!ids.includes(row.player_id)||approved.has(row.player_id))
    throw new TypeError('Invalid approved portrait read');
   approved.add(row.player_id);
  }
 }
 const map=(players:MatchStatistics['home']['players'])=>players.map(p=>({
  ...p,portraitApproved:p.started===true&&approved.has(p.playerId)
 }));
 return {...stats,home:{...stats.home,players:map(stats.home.players)},
  away:{...stats.away,players:map(stats.away.players)}};
}
