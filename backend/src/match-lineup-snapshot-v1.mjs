/** #613: isolated unpaginated roster source and future guarded receipt insert plan.
 * No HTTP/world-command entrypoint imports this module. No database batch executed here.
 */
import {ATTRIBUTES} from './players-generator-core.mjs';
import {simulateMatchV1,attachTestRatingsV1,buildCandidateMatchReceiptV1,LINEUP_SIMULATOR_VERSION} from './temporary-lineup-v1.mjs';
import {planRecordedMatchTimelineV1} from './match-recorded-events-v1.mjs';
import {sealMatchMvpV1} from './match-mvp-v1.mjs';
import {resolvePublishedKnockoutV1} from './match-knockout-binding-v1.mjs';

const clubPattern=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
const hex64=/^[0-9a-f]{64}$/;
const roles=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const fail=(reason)=>{throw new TypeError('Invalid lineup snapshot: '+reason)};
const validId=value=>Number.isSafeInteger(value)&&value>0;
const rosterSql='SELECT p.id,p.payload_json,a.club_key FROM player_club_affiliations a JOIN generated_players p ON p.id=a.player_id WHERE a.club_key IN (?,?) ORDER BY a.club_key ASC,p.id ASC';
const worldSql='SELECT generation,revision,season_number AS seasonNumber,day,phase FROM world_state WHERE id=1';
const sentinel='00000000-0000-4000-8000-000000000000';

function guard(db,condition,args){
 return db.prepare('INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS('+condition+')').bind(sentinel,...args);
}
async function digest(value){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function sameWorld(a,b){
 return !!a&&!!b&&a.generation===b.generation&&a.revision===b.revision&&
  a.seasonNumber===b.seasonNumber&&a.day===b.day&&a.phase===b.phase;
}
function checkedWorld(world){
 if(!world||typeof world!=='object'||typeof world.generation!=='string'||world.generation.length!==36||
  !Number.isSafeInteger(world.revision)||world.revision<0||!validId(world.seasonNumber)||
  !Number.isInteger(world.day)||world.day<0||world.day>56||
  !['active','preparing'].includes(world.phase))fail('world');
}
function projectPlayer(row){
 if(!validId(row?.id)||typeof row.payload_json!=='string'||!clubPattern.test(row.club_key))
  fail('stored player row');
 let raw;
 try{raw=JSON.parse(row.payload_json)}catch{fail('player JSON')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  !['active','retired'].includes(raw.career_status))fail('career status');
 if(raw.career_status==='retired')return {id:row.id,career_status:'retired'};
 if(!roles.has(raw.primary_position)||!Array.isArray(raw.secondary_positions)||
  raw.secondary_positions.some(x=>!roles.has(x))||
  new Set([raw.primary_position,...raw.secondary_positions]).size!==raw.secondary_positions.length+1||
  !raw.attributes||typeof raw.attributes!=='object'||
  ATTRIBUTES.some(k=>!Number.isInteger(raw.attributes[k])||raw.attributes[k]<1||raw.attributes[k]>99))
  fail('active footballer data');
 return {id:row.id,career_status:'active',
  name:typeof raw.first_name==='string'&&raw.first_name.trim()&&typeof raw.last_name==='string'&&raw.last_name.trim()?raw.first_name.trim()+' '+raw.last_name.trim():null,
  nationality:typeof raw.nationality==='string'&&/^[A-Z]{3}$/.test(raw.nationality)?raw.nationality:null,
  primary_position:raw.primary_position,
  secondary_positions:[...raw.secondary_positions],
  attributes:Object.fromEntries(ATTRIBUTES.map(k=>[k,raw.attributes[k]]))};
}
/** Read one complete two-club affiliation snapshot. The caller MUST commit all
 * returned guards inside the authorized day transaction or discard this snapshot.
 */
export async function readFrozenMatchRostersV1(db,{homeClubId,awayClubId,world}){
 checkedWorld(world);
 if(!clubPattern.test(homeClubId)||!clubPattern.test(awayClubId)||homeClubId===awayClubId)
  fail('club identity');
 const before=await db.prepare(worldSql).first();
 if(!sameWorld(before,world))fail('stale world');
 const result=await db.prepare(rosterSql).bind(homeClubId,awayClubId).all();
 if(!Array.isArray(result?.results))fail('affiliation rows');
 const rows=result.results,seen=new Set(),homeRoster=[],awayRoster=[],source=[];
 for(const row of rows){
  if(seen.has(row.id)||![homeClubId,awayClubId].includes(row.club_key))fail('duplicate/cross-club player');
  seen.add(row.id);
  const player=projectPlayer(row);
  (row.club_key===homeClubId?homeRoster:awayRoster).push(player);
  source.push([row.id,row.club_key,row.payload_json]);
 }
 const after=await db.prepare(worldSql).first();
 if(!sameWorld(after,world))fail('world changed during snapshot');
 homeRoster.sort((a,b)=>a.id-b.id);awayRoster.sort((a,b)=>a.id-b.id);
 source.sort((a,b)=>a[1]<b[1]?-1:a[1]>b[1]?1:a[0]-b[0]);
 const guards=[
  guard(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND day=? AND phase=?',
   [world.generation,world.revision,world.seasonNumber,world.day,world.phase]),
  guard(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM player_club_affiliations WHERE club_key IN (?,?))=?',
   [homeClubId,awayClubId,rows.length]),
  ...source.map(([id,club,payload])=>guard(db,
   'SELECT 1 FROM player_club_affiliations a JOIN generated_players p ON p.id=a.player_id WHERE p.id=? AND a.club_key=? AND p.payload_json=?',
   [id,club,payload]))
 ];
 return {homeRoster,awayRoster,guards,playerCount:rows.length,
  sourceDigest:await digest([homeClubId,awayClubId,source])};
}

/** League fixture only: knockout slot/actual-participant binding remains an explicit
 * fail-closed future step. Stages a write for the protected caller's SINGLE D1 batch.
 */
export async function planMatchSimulationReceiptV1(db,{match,world,seed,context,now,pendingTie}){
 checkedWorld(world);
 if(!match||!validId(match.matchId)||match.season!==world.seasonNumber||
  !Number.isInteger(match.day)||match.day<1||match.day>56||match.day!==world.day+1||
  typeof match.fixtureId!=='string'||!hex64.test(match.sourceHash)||
  !Number.isSafeInteger(now)||now<=0)fail('match metadata');
 const snapshot=await readFrozenMatchRostersV1(db,{
  homeClubId:match.homeClubId,awayClubId:match.awayClubId,world
 });
 const published=await db.prepare('SELECT id,slot_match_id,generation,season_number FROM public_match_numbers WHERE id=?')
  .bind(match.matchId).first();
 if(!published||published.id!==match.matchId||published.generation!==world.generation||
  published.season_number!==world.seasonNumber)fail('published match number');
 const league=await db.prepare('SELECT source_fixture_id,competition_id,scheduled_day,home_club_id,away_club_id,source_hash FROM season_match_slots WHERE match_id=?')
  .bind(published.slot_match_id).first();
 if(league&&(league.source_fixture_id!==match.fixtureId||league.competition_id!==match.competitionId||
  league.scheduled_day!==match.day||league.home_club_id!==match.homeClubId||
  league.away_club_id!==match.awayClubId||league.source_hash!==match.sourceHash))
  fail('published league source');
 // A missing league slot is not permission to invent a knockout fixture:
 // independently validate an existing published reservation plus resolved tie proof.
 const knockout=league?null:await resolvePublishedKnockoutV1(db,{
  match,world,published,context,pendingTie
 });
 const score=await simulateMatchV1({
  homeRoster:snapshot.homeRoster,awayRoster:snapshot.awayRoster,
  matchKey:match.fixtureId,seed,homeClubId:match.homeClubId,
  awayClubId:match.awayClubId,context
 });
 // Score/ET/shootout stay under the ONE canonical temporary-lineup-v1 authority.
 // Official events are computed once from the frozen source roster BEFORE the
 // receipt is atomically persisted, never on a public read or replay.
 const timeline=await planRecordedMatchTimelineV1({result:score,
  homeRoster:snapshot.homeRoster,awayRoster:snapshot.awayRoster});
 const outcome=attachTestRatingsV1({...score,...timeline,
  home:{...score.home,...timeline.home},away:{...score.away,...timeline.away}});
 // Identity is frozen AFTER simulation, so names never influence seeded scores.
 const identities=new Map([...snapshot.homeRoster,...snapshot.awayRoster].map(p=>[p.id,p]));
 outcome.playerIdentityVersion='player-identity-v1';
 outcome.playerIdentities=[...outcome.home.appearances,...outcome.away.appearances].map(p=>({
  playerId:p.playerId,name:identities.get(p.playerId)?.name??null,nationality:identities.get(p.playerId)?.nationality??null
 })).sort((a,b)=>a.playerId-b.playerId);
 sealMatchMvpV1(outcome); // Versioned MVP proof, sealed with this new receipt.
 const candidate=await buildCandidateMatchReceiptV1({
  matchId:match.matchId,fixtureId:match.fixtureId,competitionId:match.competitionId,
  season:match.season,day:match.day,generation:world.generation,sourceHash:match.sourceHash,
  homeClubId:match.homeClubId,awayClubId:match.awayClubId
 },outcome);
 if(candidate.authority!=='candidate-only'||candidate.algorithmVersion!==LINEUP_SIMULATOR_VERSION)
  fail('candidate evidence');
 const receipt={schemaVersion:candidate.schemaVersion,authority:'official',algorithmVersion:LINEUP_SIMULATOR_VERSION,
  rosterSourceDigest:snapshot.sourceDigest,sourceCandidateDigest:candidate.receiptDigest,
  fixture:candidate.fixture,result:candidate.result};
 const receiptHash=await digest(receipt);
 const guards=[
  ...snapshot.guards,
  ...(knockout?.guards??[]),
  guard(db,'SELECT 1 FROM public_match_numbers WHERE id=? AND slot_match_id=? AND generation=? AND season_number=?',
   [match.matchId,published.slot_match_id,world.generation,world.seasonNumber]),
  ...(league?[guard(db,'SELECT 1 FROM season_match_slots WHERE match_id=? AND source_fixture_id=? AND competition_id=? AND scheduled_day=? AND home_club_id=? AND away_club_id=? AND source_hash=?',
   [published.slot_match_id,match.fixtureId,match.competitionId,match.day,match.homeClubId,match.awayClubId,match.sourceHash])]:[]),
  guard(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM match_lineup_result_receipts WHERE public_match_id=?)',[match.matchId])
 ];
 const insert=db.prepare('INSERT INTO match_lineup_result_receipts(public_match_id,slot_match_id,generation,season_number,day,fixture_id,algorithm_version,receipt_hash,receipt_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .bind(match.matchId,published.slot_match_id,world.generation,world.seasonNumber,match.day,
   match.fixtureId,LINEUP_SIMULATOR_VERSION,receiptHash,JSON.stringify(receipt),now);
 return {kind:'lineup_candidate',guards,writes:[insert],receiptHash,
  sourceDigest:snapshot.sourceDigest,receipt};
}
