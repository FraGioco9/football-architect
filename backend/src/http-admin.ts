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
import {generateSeasonCalendar} from './calendar-command.ts';
import {executeLifecycle} from './lifecycle-command.ts';
import {rescheduleSeasonEvent} from './admin-calendar-command.ts';
import {initializeAdministrativeEvents} from './admin-calendar-initialize.ts';
import {completeConfirmationEvent} from './admin-calendar-confirm.ts';
import {advanceAdministrativeClock} from './admin-calendar-clock.ts';
import {readAdministrativeCalendar} from './admin-calendar-read.ts';
import {stageDomesticCalendar} from './admin-domestic-stage.ts';
import {executeInternationalDraw} from './admin-international-draw.ts';
import {publishInternationalCalendar} from './admin-calendar-publish.ts';
import {closeSeason} from './season-close-command.ts';
import {archiveSeason} from './season-archive-command.ts';
import {resetWorld} from './reset-world-command.ts';
import {readSeasonArchives,readClosedSeasonHistory} from './season-archive-read.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {previewPlayerGeneration,readPlayerGenerationDraft,commitPlayerGeneration,listGeneratedPlayers} from './players-generation-command.ts';
import {prepareSeasonTwo} from './season-two-prepare-command.ts';
import {approveSeasonTwoSnapshot} from './season-two-approval-command.ts';
export interface AdminEnv {DB?:unknown;PLAYER_MODE?:string;PLAYER_ORIGIN?:string;PLAYER_TRUSTED_SOURCE?:string}
const json=(status:number,body:unknown,extra:Record<string,string>={})=>httpJson('account',status,body,extra);
const known=new Map([['/api/admin/login','POST'],['/api/admin/session','GET'],['/api/admin/players','GET'],['/api/admin/players/preview','POST'],['/api/admin/players/draft','POST'],['/api/admin/players/commit','POST'],['/api/admin/world','GET'],['/api/admin/seasons/events','GET'],['/api/admin/seasons/archives','GET'],['/api/admin/seasons/history','GET'],['/api/admin/seasons/next-candidate','GET'],['/api/admin/seasons/next-approve','POST'],['/api/admin/seasons/next-prepare','POST'],['/api/admin/logout','POST'],['/api/admin/seasons/prepare','POST'],['/api/admin/seasons/calendar','POST'],['/api/admin/seasons/start','POST'],['/api/admin/seasons/advance','POST'],['/api/admin/seasons/events/reschedule','POST'],['/api/admin/seasons/events/initialize','POST'],['/api/admin/seasons/events/confirm','POST'],['/api/admin/seasons/events/start','POST'],['/api/admin/seasons/events/advance','POST'],['/api/admin/seasons/events/domestic-calendar','POST'],['/api/admin/seasons/events/international-draw','POST'],['/api/admin/seasons/events/international-calendar','POST'],['/api/admin/seasons/archive','POST'],['/api/admin/seasons/close','POST'],['/api/admin/world/reset','POST']]);
export async function handleAdmin(request:Request,env:AdminEnv):Promise<Response>{
 const path=new URL(request.url).pathname,method=known.get(path);
 if(!method)return json(404,{error:{code:'not_found'}});
 const denied=routeMethod(request,method,'account');if(denied)return denied;
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
  if(path==='/api/admin/players')return json(200,await listGeneratedPlayers(db));
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
  const rawCommand=await readJsonBody(request),key=parseIdempotencyKey(request.headers.get('Idempotency-Key'));
  if(path==='/api/admin/seasons/next-prepare')return json(200,await prepareSeasonTwo(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/next-approve')return json(200,await approveSeasonTwoSnapshot(db,session,rawCommand,key,now));
  if(path==='/api/admin/world/reset')return json(200,await resetWorld(db,session,rawCommand as Parameters<typeof resetWorld>[2],key,now));
  if(path==='/api/admin/seasons/archive')return json(200,await archiveSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/close')return json(200,await closeSeason(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/initialize')return json(200,await initializeAdministrativeEvents(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/start'||path==='/api/admin/seasons/events/advance')return json(200,await advanceAdministrativeClock(db,session,path.endsWith('/start')?'start':'advance',parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-calendar')return json(200,await publishInternationalCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/international-draw')return json(200,await executeInternationalDraw(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/domestic-calendar')return json(200,await stageDomesticCalendar(db,session,parsePrepareRequest(rawCommand),key,now));
  if(path==='/api/admin/seasons/events/confirm')return json(200,await completeConfirmationEvent(db,session,rawCommand,key,now));
  if(path==='/api/admin/seasons/events/reschedule')return json(200,await rescheduleSeasonEvent(db,session,rawCommand,key,now));
  const command=parsePrepareRequest(rawCommand);
  if(path==='/api/admin/seasons/start'||path==='/api/admin/seasons/advance')return json(200,await executeLifecycle(db,session,path.endsWith('/start')?'start':'advance',command,key,now));
  if(path==='/api/admin/seasons/calendar')return json(200,await generateSeasonCalendar(db,session,command,key,now));
  return json(200,await prepareSeason(db,session,command,key,await loadApprovedSnapshot(),now));
 }catch(error){
  return httpError('account',error,'admin_unavailable');
 }
}
