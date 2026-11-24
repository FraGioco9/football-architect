import {httpJson,httpError,routeMethod,readSessionCookie,readJsonBody} from './http-contract.ts';
import {resolveAccountConfiguration} from './environment-pool.ts';
import {ApiError} from './errors.ts';
import {requireDatabase} from './database.ts';
import {requireMutationOrigin} from './origin-policy.ts';
import type {AdminSession} from './auth.ts';
import {playerCsrfFor} from './player-auth.ts';
import {authorizeUnifiedAdmin} from './unified-admin-authorization.ts';
import {readWorld} from './world-repository.ts';
import {parsePrepareRequest,parseIdempotencyKey} from './command-contract.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {prepareSeason} from './commands.ts';
import {executeLineupLifecycleV1 as executeLifecycle} from './lineup-lifecycle-command.ts';
import {rescheduleSeasonEvent} from './admin-calendar-command.ts';
import {initializeAdministrativeEvents} from './admin-calendar-initialize.ts';
import {completeConfirmationEvent} from './admin-calendar-confirm.ts';
import {confirmSeasonZeroEntrants} from './season-zero-entrants.ts';
import {advanceAdministrativeClockLineupV1 as advanceAdministrativeClock} from './admin-calendar-clock-lineup-v1.ts';
import {readAdministrativeCalendar} from './admin-calendar-read.ts';
import {stageDomesticCalendar} from './admin-domestic-stage.ts';
import {executeInternationalDraw} from './admin-international-draw.ts';
import {publishInternationalCalendarLineupV1 as publishInternationalCalendar} from './admin-calendar-publish-lineup-v1.ts';
import {closeSeasonLineupV1 as closeSeason} from './season-close-command-lineup-v1.ts';
import {archiveSeasonLineupV1 as archiveSeason} from './season-archive-command-lineup-v1.ts';
import {resetWorld} from './reset-world-command.ts';
import {resetScopes,parseResetScopes,previewAdminReset,readAdminEconomySummary,readAdminEconomyReconciliation,parseEconomyPage,readAdminEconomyClubs,readAdminEconomyLedger} from './admin-inspection.ts';
import {economicAssert,financeSessionGuard} from './economic-ledger.ts';
import {sessionGuard} from './command-guards.ts';
import {readSeasonArchives,readClosedSeasonHistory} from './season-archive-read.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {previewPlayerGeneration,readPlayerGenerationDraft,commitPlayerGeneration,listGeneratedPlayers} from './players-generation-command.ts';
import {parseContractListQuery,readPlayerContracts,changePlayerContract,changePlayerContractsBatch} from './player-club-contracts.ts';
import {readClubLicenses,findLicenseAccounts,changeClubLicense} from './club-licenses.ts';
import {prepareSeasonTwo} from './season-two-prepare-command.ts';
import {approveSeasonTwoSnapshot} from './season-two-approval-command.ts';
export interface AdminEnv {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string}
const json=(status:number,body:unknown,extra:Record<string,string>={})=>httpJson('account',status,body,extra);
const known=new Map([["/api/admin/inspection/access","GET"],["/api/admin/economy/clubs","GET"],["/api/admin/economy/ledger","GET"],["/api/admin/reset/options","GET"],["/api/admin/reset/preview","POST"],["/api/admin/economy/summary","GET"],["/api/admin/economy/reconciliation","GET"],['/api/admin/login','POST'],['/api/admin/session','GET'],['/api/admin/players','GET'],['/api/admin/players/preview','POST'],['/api/admin/players/draft','POST'],['/api/admin/players/commit','POST'],['/api/admin/contracts','GET|POST'],['/api/admin/club-licenses','GET|POST'],['/api/admin/club-licenses/accounts','GET'],['/api/admin/world','GET'],['/api/admin/seasons/events','GET'],['/api/admin/seasons/season-zero/confirm','POST'],['/api/admin/seasons/archives','GET'],['/api/admin/seasons/history','GET'],['/api/admin/seasons/next-candidate','GET'],['/api/admin/seasons/next-approve','POST'],['/api/admin/seasons/next-prepare','POST'],['/api/admin/logout','POST'],['/api/admin/seasons/prepare','POST'],['/api/admin/seasons/calendar','POST'],['/api/admin/seasons/start','POST'],['/api/admin/seasons/advance','POST'],['/api/admin/seasons/events/reschedule','POST'],['/api/admin/seasons/events/initialize','POST'],['/api/admin/seasons/events/confirm','POST'],['/api/admin/seasons/events/start','POST'],['/api/admin/seasons/events/advance','POST'],['/api/admin/seasons/events/domestic-calendar','POST'],['/api/admin/seasons/events/international-draw','POST'],['/api/admin/seasons/events/international-calendar','POST'],['/api/admin/seasons/archive','POST'],['/api/admin/seasons/close','POST'],['/api/admin/world/reset','POST']]);
export async function handleAdmin(request:Request,env:AdminEnv):Promise<Response>{
 const path=new URL(request.url).pathname,method=known.get(path);
 if(!method)return json(404,{error:{code:'not_found'}});
 const denied=method==='GET|POST'
  ?(['GET','POST'].includes(request.method)?null:json(405,{error:{code:'method_not_allowed'}},{Allow:'GET, POST'}))
  :routeMethod(request,method,'account');
 if(denied)return denied;
 try{
  const config=await resolveAccountConfiguration(request,env,'admin_unavailable'),db=requireDatabase(env.DB),now=Math.floor(Date.now()/1000);
  if(request.method==='POST'||request.headers.has('Origin'))requireMutationOrigin(request.headers.get('Origin'),config.origin);
  // One shared player identity. The legacy login and logout paths no longer
  // mint or revoke separate admin credentials.
  if(path==='/api/admin/login'||path==='/api/admin/logout')
   return json(410,{error:{code:'legacy_admin_login_retired'}});
  const playerCookie=config.cookie;
  const playerToken=readSessionCookie(request,playerCookie);
  const isWrite=request.method!=='GET';
  const player=await authorizeUnifiedAdmin(db,playerToken,now,
   isWrite?'admin.world.write':'admin.world.read',
   isWrite?request.headers.get('X-CSRF-Token'):null);
  const legacyId=player.legacyOperatorId;
  const legacy=await db.prepare('SELECT email_normalized AS email,credential_version FROM admin_accounts WHERE id=? AND enabled=1').bind(legacyId).first<{email:string;credential_version:number}>();
  if(!legacy)throw new ApiError(403,'permission_denied');
  const session:AdminSession={actor:{id:legacyId,email:player.actor.email},digest:player.digest,
   credentialVersion:legacy.credential_version,csrfDigest:player.csrfDigest,
   unified:{playerId:player.actor.id,sessionDigest:player.digest,csrfDigest:player.csrfDigest}};
  if(path==='/api/admin/session')return json(200,{actor:player.actor,csrfToken:await playerCsrfFor(playerToken)});
  if(path==='/api/admin/world')return json(200,{world:await readWorld(db)});
  if(path==='/api/admin/inspection/access'){
   if(new URL(request.url).search)throw new ApiError(422,'invalid_inspection_query');
   const write=await db.prepare("SELECT 1 AS allowed FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(player.actor.id).first();
   // A missing local/remote migration is an unavailable economy, not a grant.
   const schema=await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='economic_finance_permissions'").first();
   const finance=schema?await db.prepare("SELECT 1 AS allowed FROM economic_finance_permissions WHERE account_id=? AND capability='read'").bind(player.actor.id).first():null;
   return json(200,{reset:!!write,economy:!!finance});
  }
  if(path==='/api/admin/reset/options'){
   const write=await db.prepare("SELECT 1 AS allowed FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(player.actor.id).first();
   if(!write)throw new ApiError(403,'permission_denied');
   if(new URL(request.url).search)throw new ApiError(422,'invalid_reset_scope');
   return json(200,{scopes:resetScopes,mode:'preview_only',executable:false});
  }
  if(path==='/api/admin/reset/preview'){
   if(new URL(request.url).search)throw new ApiError(422,'invalid_reset_scope');
   const read=await db.prepare("SELECT 1 AS allowed FROM account_permissions WHERE account_id=? AND permission='admin.world.read'").bind(player.actor.id).first();
   if(!read)throw new ApiError(403,'permission_denied');
   const scopes=parseResetScopes(await readJsonBody(request));
   return json(200,await previewAdminReset(db,[sessionGuard(db,session,now),economicAssert(db,"SELECT 1 FROM account_permissions WHERE account_id=? AND permission='admin.world.read'",[player.actor.id])],scopes));
  }
  if(path.startsWith('/api/admin/economy/')){
   if(!['/api/admin/economy/clubs','/api/admin/economy/ledger'].includes(path)&&new URL(request.url).search)throw new ApiError(422,'invalid_economy_query');
   const grant=await db.prepare("SELECT 1 AS allowed FROM economic_finance_permissions WHERE account_id=? AND capability='read'").bind(player.actor.id).first();
   if(!grant)throw new ApiError(403,'permission_denied');
   // Recheck the unified actor, live finance capability and admin read/link in the same D1 batch.
   const access=[financeSessionGuard(db,player.actor.id,player.digest,player.csrfDigest,'read',now),
    economicAssert(db,`SELECT 1 FROM player_admin_operator_links l
     JOIN admin_accounts a ON a.id=l.legacy_admin_account_id JOIN player_accounts p ON p.id=l.player_account_id
     WHERE l.player_account_id=? AND l.legacy_admin_account_id=? AND a.enabled=1 AND a.email_normalized=p.email_normalized
     AND EXISTS(SELECT 1 FROM account_permissions q WHERE q.account_id=p.id AND q.permission='admin.world.read')`,[player.actor.id,legacyId])];
   if(path.endsWith('/clubs'))return json(200,await readAdminEconomyClubs(db,access,parseEconomyPage(new URL(request.url).searchParams,'clubs')));
   if(path.endsWith('/ledger'))return json(200,await readAdminEconomyLedger(db,access,parseEconomyPage(new URL(request.url).searchParams,'ledger')));
   return json(200,path.endsWith('/summary')?await readAdminEconomySummary(db,access):await readAdminEconomyReconciliation(db,access));
  }
  if(path==='/api/admin/players')return json(200,await listGeneratedPlayers(db));
  if(path==='/api/admin/contracts'&&request.method==='GET')
   return json(200,await readPlayerContracts(db,parseContractListQuery(new URL(request.url).search)));
  if(path==='/api/admin/club-licenses'&&request.method==='GET'){
   if(new URL(request.url).search)throw new ApiError(422,'invalid_club_license');
   return json(200,await readClubLicenses(db));
  }
  if(path==='/api/admin/club-licenses/accounts')
   return json(200,await findLicenseAccounts(db,new URL(request.url).search));
  if(path==='/api/admin/players/draft'){
   const params=new URL(request.url).searchParams,body=await readJsonBody(request);
   if(params.size!==0||!body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).length!==1||typeof (body as {draftId?:unknown}).draftId!=='string')
    throw new ApiError(422,'invalid_players_generation');
   return json(200,await readPlayerGenerationDraft(db,session,(body as {draftId:string}).draftId,now));
  }
  if(path==='/api/admin/seasons/next-candidate')return json(200,await readSeasonTwoCandidate(db));
  if(path==='/api/admin/seasons/archives')return json(200,await readSeasonArchives(db));
  if(path==='/api/admin/seasons/history'){
   const raw=new URL(request.url).searchParams.get('season');
   if(!raw||!/^[1-9][0-9]{0,8}$/.test(raw))throw new ApiError(422,'archive_invalid');
   return json(200,await readClosedSeasonHistory(db,Number(raw)));
  }
  if(path==='/api/admin/seasons/events')return json(200,await readAdministrativeCalendar(db));
  // Player previews and explicit approvals have their own strict contracts; an
  // ordinary Admin calendar idempotency key is not accepted as authorization.
  if(path==='/api/admin/players/preview')return json(200,await previewPlayerGeneration(db,session,await readJsonBody(request),now));
  if(path==='/api/admin/players/commit')return json(200,await commitPlayerGeneration(db,session,await readJsonBody(request),now));
  if(path==='/api/admin/contracts'&&request.method==='POST'){
   if(new URL(request.url).search)throw new ApiError(422,'invalid_player_contract');
   const body=await readJsonBody(request);
   return json(200,body&&typeof body==='object'&&!Array.isArray(body)&&'players' in body
    ?await changePlayerContractsBatch(db,session,body,now)
    :await changePlayerContract(db,session,body,now));
  }
  if(path==='/api/admin/club-licenses'&&request.method==='POST'){
   if(new URL(request.url).search)throw new ApiError(422,'invalid_club_license');
   return json(200,await changeClubLicense(db,session,await readJsonBody(request),now));
  }
  const rawCommand=await readJsonBody(request),key=parseIdempotencyKey(request.headers.get('Idempotency-Key'));
  if(path==='/api/admin/seasons/next-prepare')return json(200,await prepareSeasonTwo(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/next-approve')return json(200,await approveSeasonTwoSnapshot(db,session,rawCommand,key,now));
  if(path==='/api/admin/world/reset')return json(200,await resetWorld(db,session,rawCommand as Parameters<typeof resetWorld>[2],key,now));
  // Retire direct score-only calendar generation/start routes: the authenticated
  // milestone flow is the one canonical route into V2 day finalization.
  if(path==='/api/admin/seasons/calendar'||path==='/api/admin/seasons/start')
   return json(410,{error:{code:'legacy_season_command_retired'}});
  if(path==='/api/admin/seasons/archive')return json(200,await archiveSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/close')return json(200,await closeSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/initialize')return json(200,await initializeAdministrativeEvents(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/start'||path==='/api/admin/seasons/events/advance')return json(200,await advanceAdministrativeClock(db,session,path.endsWith('/start')?'start':'advance',parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-calendar')return json(200,await publishInternationalCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-draw')return json(200,await executeInternationalDraw(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/domestic-calendar')return json(200,await stageDomesticCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/confirm')return json(200,await completeConfirmationEvent(db,session,rawCommand,key,now));
  if(path==='/api/admin/seasons/season-zero/confirm')return json(200,await confirmSeasonZeroEntrants(db,session,rawCommand,key,now));
  if(path==='/api/admin/seasons/events/reschedule')return json(200,await rescheduleSeasonEvent(db,session,rawCommand,key,now));
  const command=parsePrepareRequest(rawCommand);
  if(path==='/api/admin/seasons/advance')return json(200,await executeLifecycle(db,session,'advance',command,key,now));
  return json(200,await prepareSeason(db,session,command,key,await loadApprovedSnapshot(),now));
 }catch(error){
  return httpError('account',error,'admin_unavailable');
 }
}
