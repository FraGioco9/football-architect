/** #791: explicitly enabled shared-DEV operator; no reset, deployment, migration or scheduler.
 * Each request invokes at most one existing bounded command. All financial amounts and
 * progress are sourced from the canonical services, never client cursors or SQL. */
import type {Database,Statement} from './database.ts';
import type {AdminSession} from './auth.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {readJsonBody} from './http-contract.ts';
import {readWorld} from './world-repository.ts';
import {sessionGuard,abortUnless} from './command-guards.ts';
import {financeSessionGuard,reconcileEconomy,type FinanceCapability} from './economic-ledger.ts';
import {readAdminEconomySummary,previewAdminReset} from './admin-inspection.ts';
import {buildOpeningManifest,createOpeningRehearsal,type OpeningPrivatePlan} from './opening-world-operator.ts';
import {previewRetainedOpeningInventory,type RetainedOpeningInput} from './opening-world-inventory.ts';
import {captureRetainedOpeningEvidence} from './opening-world-retained.ts';
import {readEconomicGenesis,prepareEconomicGenesis,stepEconomicGenesis,completeEconomicGenesis,earmarkNextRewardBudget,normalizeOpeningForecast,type GenesisPreparationInput} from './economic-genesis.ts';
import {planEconomicGenesis} from './economic-genesis-plan.mjs';
import {prepareRewardSettlement} from './reward-settlement-evidence.ts';
import {executeRewardSettlementBatch} from './reward-settlement-command.ts';
import {prepareRewardPayrollGuards} from './reward-calendar-gate.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
import {settleNextPayrollBatch,reconcilePayrollPayday} from './payroll-settlement-command.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
import {CURRENT_PLAYER_CONTRACTS_SQL} from './effective-player-contracts.mjs';
import {MARKET_VALUE_CONFIG} from './player-market-value.mjs';
import {refreshMarketValueIndexBatch,marketValueIndexVersion,marketValueIndexReadiness} from './player-market-value-index.ts';
import {manifestDigest,reserveRetainedFirst} from '../../tools/world-bootstrap-791/planner.mjs';

const MAX_BYTES=8*1024*1024;
const invalid=()=>new ApiError(422,'dev_operator_invalid');
const blocked=()=>new ApiError(409,'dev_operator_prerequisites');
const requiredMigrations=['0042_opening_world_runs.sql','0043_reward_calendar_milestones.sql','0044_payroll_obligations.sql','0045_economic_genesis_guards.sql','0046_player_lifecycle_season_two.sql'];
const requiredObjects=['opening_world_runs','opening_world_staging','economic_genesis_status','payroll_runs','payroll_claim_outstanding','player_contract_promotion_salary','player_lifecycle_season_two'];
const readActions=['fit-preview','prepare','fund-preview','roster-check'] as const;
const writeActions=['rebase','fund','populate','sign','publish','settle','reserve-next','refresh-values'] as const;
type Action=typeof readActions[number]|typeof writeActions[number];
const actionFields:Record<Action,readonly string[]>={
 'fit-preview':['seed'],prepare:['seed','evidenceJson','resetReceiptJson'],'fund-preview':['planJson','fundingJson'],
 rebase:['evidenceJson','resetReceiptJson'],fund:['planJson','fundingJson','approvalHash'],
 populate:['planJson'],sign:['planJson'],publish:['planJson'],settle:[],
 'reserve-next':[],'refresh-values':[],'roster-check':[]
};
const isObject=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function exact(x:Record<string,unknown>,keys:readonly string[]){
 if(!same(Object.keys(x).sort(),[...keys].sort()))throw invalid();
}
function string(x:unknown,max=MAX_BYTES):string{
 if(typeof x!=='string'||!x.length||x.length>max)throw invalid();return x;
}
function jsonValue(x:unknown):unknown{
 try{return JSON.parse(string(x))}catch{throw invalid()}
}
export function parseDevOperatorRequest(value:unknown){
 if(!isObject(value))throw invalid();
 exact(value,['action','expectedGeneration','expectedSeason','expectedDay','confirmation','data']);
 const a=value.action;
 if(typeof a!=='string'||!Object.hasOwn(actionFields,a))throw invalid();
 const action=a as Action,write=(writeActions as readonly string[]).includes(action);
 const generation=string(value.expectedGeneration,36),season=value.expectedSeason,day=value.expectedDay;
 if(!/^[a-f0-9-]{36}$/.test(generation)||typeof season!=='number'||!Number.isSafeInteger(season)||season<0||typeof day!=='number'||!Number.isSafeInteger(day)||day<0||day>56||!isObject(value.data))throw invalid();
 exact(value.data,actionFields[action]);
 for(const v of Object.values(value.data))string(v);
 const confirmation=write?'DEV '+action+' '+generation+' '+season+':'+day:'';
 if(value.confirmation!==confirmation)throw invalid();
 return {action,write,generation,season,day,data:value.data};
}
function finance(db:Database,session:AdminSession,now:number,...caps:FinanceCapability[]):Statement[]{
 const u=session.unified;if(!u)throw new ApiError(403,'permission_denied');
 return caps.map(c=>financeSessionGuard(db,u.playerId,u.sessionDigest,u.csrfDigest,c,now));
}
function worldGuard(db:Database,w:WorldV1){
 return abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND day=? AND phase=?',[w.generation,w.revision,w.seasonNumber,w.day,w.phase]);
}
export async function readDevOperatorSchema(db:Database){
 const registry=await db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='d1_migrations'").first();
 const names=registry?(await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{name:string}>()).results.map(r=>r.name):[];
 const objects=(await db.prepare('SELECT name FROM sqlite_schema WHERE name IN (SELECT value FROM json_each(?))').bind(JSON.stringify(requiredObjects)).all<{name:string}>()).results.map(r=>r.name);
 const missingMigrations=requiredMigrations.filter(n=>!names.includes(n)),missingObjects=requiredObjects.filter(n=>!objects.includes(n));
 return {appliedMigrations:names,missingMigrations,missingObjects,ready:missingMigrations.length===0&&missingObjects.length===0};
}
function retained(data:Record<string,unknown>):RetainedOpeningInput{
 const evidence=jsonValue(data.evidenceJson),receipt=jsonValue(data.resetReceiptJson);
 if(!isObject(evidence)||!Array.isArray(evidence.players)||evidence.players.length!==150||!isObject(receipt)||receipt.sourceDigest!==evidence.digest)throw blocked();
 return {evidence:evidence as RetainedOpeningInput['evidence'],resetOperationId:string(receipt.operationId,36)};
}
function readPlan(data:Record<string,unknown>):OpeningPrivatePlan{
 const plan=jsonValue(data.planJson);
 if(!isObject(plan)||plan.schema!=='opening-local-rehearsal-v1'||typeof plan.seed!=='string'||!isObject(plan.root)||!Array.isArray(plan.root.baseline)||plan.root.baseline.length!==150||!isObject(plan.inventory)||!isObject(plan.retained))throw blocked();
 return plan as OpeningPrivatePlan;
}
const seedValue=(v:unknown)=>{const seed=string(v,24);if(!/^[A-Za-z0-9_.:-]+$/.test(seed))throw invalid();return seed};
function compactProgress(p:{committedBatches:number;totalBatches:number;completedSlots:number;remainingSlots:number;readyForReconciliation:boolean}){
 return {committedBatches:p.committedBatches,totalBatches:p.totalBatches,completedSlots:p.completedSlots,remainingSlots:p.remainingSlots,done:p.readyForReconciliation};
}
async function status(db:Database,session:AdminSession,now:number,source:string){
 const access=finance(db,session,now,'read');
 await db.batch(access);
 const world=await readWorld(db),schema=await readDevOperatorSchema(db);
 // No partially applied schema is presumed safe or silently migrated.
 const reset=await previewAdminReset(db,access,['sporting']);
 const licenses=(await db.batch([...access,db.prepare('SELECT club_key FROM club_license_state WHERE account_id IS NOT NULL ORDER BY club_key')])).at(-1)!.results.map(x=>x.club_key);
 const financeSummary=schema.ready?await readAdminEconomySummary(db,access):null;
 const fk=await db.prepare('PRAGMA foreign_key_check').all();
 await db.batch([...access,worldGuard(db,world)]);
 return {pool:'dev-preview',database:'football-architect-dev',source,world,schema,counts:reset.counts,
  resetBlockers:reset.blockers,licenses,foreignKeyViolations:fk.results.length,
  economy:financeSummary?{status:financeSummary.status,genesis:financeSummary.genesis,rewards:financeSummary.rewards,payroll:financeSummary.payroll}:null};
}
async function fundingInput(data:Record<string,unknown>,world:WorldV1):Promise<GenesisPreparationInput>{
 const raw=jsonValue(data.fundingJson);
 if(!isObject(raw))throw invalid();
 exact(raw,['version','clubs','freeReserveArc','issuanceLimitArc','expectedRewardsByClub']);
 const snapshot=await loadApprovedSnapshot();
 const base={version:raw.version,clubs:raw.clubs,freeReserveArc:raw.freeReserveArc,issuanceLimitArc:raw.issuanceLimitArc} as GenesisPreparationInput;
 // The owner supplies amounts/forecast; the server supplies the canonical version and snapshot pins.
 const normalized=await normalizeOpeningForecast({schema:'opening-contract-forecast-v1',worldGeneration:world.generation,
  participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,formulaVersion:MARKET_VALUE_CONFIG.version,
  expectedRewardsByClub:raw.expectedRewardsByClub as Record<string,number>},world.generation);
 if(!normalized)throw blocked();
 const plan=planEconomicGenesis(base);
 return {version:plan.version,clubs:plan.clubs,freeReserveArc:plan.freeReserveArc,issuanceLimitArc:plan.issuanceLimitArc,openingContracts:normalized};
}
export async function executeDevOperator(request:Request,db:Database,session:AdminSession,now:number,source:string){
 if(new URL(request.url).search)throw invalid();
 if(request.method==='GET')return status(db,session,now,source);
 const cmd=parseDevOperatorRequest(await readJsonBody(request,MAX_BYTES)),world=await readWorld(db),{action,data}=cmd;
 if(world.generation!==cmd.generation||world.seasonNumber!==cmd.season||world.day!==cmd.day)throw blocked();
 const schema=await readDevOperatorSchema(db);
 if(!schema.ready)throw new ApiError(409,'dev_operator_schema_not_ready');
 const read=finance(db,session,now,'read'),guard=worldGuard(db,world);
 await db.batch([sessionGuard(db,session,now),...read,guard]);
 if(action==='fit-preview'){
  if(world.seasonNumber===0)throw blocked();
  const evidence=await captureRetainedOpeningEvidence(db),inventory=await previewRetainedOpeningInventory(db);
  if(!same(evidence.world,world)||evidence.players.length!==150||inventory.players.length!==150||!inventory.players.every((p,i)=>p.readyForReuse&&p.id===evidence.players[i].id&&p.fingerprint===evidence.players[i].fingerprint))throw blocked();
  const previewWorld:WorldV1={...world,revision:0,seasonNumber:0,day:0,phase:'unstarted'};
  const manifest=reserveRetainedFirst(await buildOpeningManifest(previewWorld,seedValue(data.seed),source),inventory);
  // This is deliberately only a projected fit, not a root or write authorization.
  if(manifest.slots.length!==6400)throw blocked();
  await db.batch([...read,guard]);
  return {projectedOnly:true,retained:150,newPlayers:6250,slots:6400,evidenceDigest:evidence.digest};
 }
 if(action==='roster-check'){
  if(world.seasonNumber!==2||world.phase!=='preparing'||world.day!==0)throw blocked();
  const authority=await loadSeasonSnapshotAuthority(db,world);
  const clubs=authority.snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>[...b.clubIds]).sort();
  if(clubs.length!==256||new Set(clubs).size!==256)throw blocked();
  const rows=(await db.batch([...read,guard,...authority.guards,db.prepare(`SELECT a.club_key,COUNT(*) AS players,
   SUM(CASE WHEN json_extract(p.payload_json,'$.primary_position')='GK' THEN 1 ELSE 0 END) AS goalkeepers
   FROM ${CURRENT_PLAYER_CONTRACTS_SQL} a JOIN generated_players p ON p.id=a.player_id GROUP BY a.club_key`)] )).at(-1)!.results;
  const byClub=new Map(rows.map(r=>[String(r.club_key),r]));
  const rosters=clubs.map(clubKey=>({clubKey,players:Number(byClub.get(clubKey)?.players??0),goalkeepers:Number(byClub.get(clubKey)?.goalkeepers??0)}));
  const shortages=rosters.filter(r=>r.players<11||r.goalkeepers<1);
  const values=await marketValueIndexReadiness(db,await marketValueIndexVersion()).first<{ready:number}>();
  await db.batch([...read,guard]);
  return {rosters,shortages,marketValuesReady:values?.ready===1,ready:shortages.length===0&&values?.ready===1};
 }
 if(action==='refresh-values'){
  if(world.seasonNumber!==2||world.phase!=='preparing'||world.day!==0)throw blocked();
  const result=await refreshMarketValueIndexBatch(db,100,[sessionGuard(db,session,now),...read,guard]);
  return {...result,done:result.ready};
 }
 if(action==='reserve-next'){
  if(world.seasonNumber!==1||world.phase!=='closed'||world.day!==56)throw blocked();
  await earmarkNextRewardBudget(db,[sessionGuard(db,session,now),...finance(db,session,now,'read','reserve'),guard],now);
  return {done:true,season:2};
 }
 if(action==='settle'){
  if(![1,2].includes(world.seasonNumber)||world.phase!=='active'||(world.day!==28&&world.day!==56))throw blocked();
  const post=finance(db,session,now,'read','post');
  const result=await db.batch([...post,guard,db.prepare("SELECT c.active_version,p.rules_json FROM economic_control c JOIN economic_policy_versions p ON p.version=c.active_version WHERE c.id=1 AND c.posting_enabled=1"),db.prepare("SELECT status FROM season_admin_events WHERE season_number=? AND event_id=? AND kind='settle-rewards'").bind(world.seasonNumber,'rewards:'+world.day)]);
  const policy=result.at(-2)!.results[0],event=result.at(-1)!.results[0],budget=rewardCalendarBudget();
  if(!policy||typeof policy.active_version!=='string'||typeof policy.rules_json!=='string'||JSON.parse(policy.rules_json).rewardVersion!==budget.version||!event)throw blocked();
  if(event.status==='scheduled'){
   const prepared=await prepareRewardSettlement(db,{rewardVersion:budget.version,configVersion:policy.active_version});
   const p=prepared.manifest.plan;
   if(prepared.worldRevision!==world.revision||p.generation!==world.generation||p.season!==world.seasonNumber||p.day!==world.day)throw blocked();
   const report=await executeRewardSettlementBatch(db,session,prepared,now,true);
   return {stage:'rewards',done:false,paidArc:report.paidArc,pending:report.missingKeys.length};
  }
  if(event.status!=='completed')throw blocked();
  await db.batch([...post,guard,...await prepareRewardPayrollGuards(db,world,world.day,true)]);
  const next=await settleNextPayrollBatch(db,session,now,world);
  if(next!==null)return {stage:'payroll',done:false};
  const report=await reconcilePayrollPayday(db,session,now);
  if(report.generation!==world.generation||report.season!==world.seasonNumber||report.day!==world.day||report.status!=='complete'||report.clubsComplete!==320||report.pendingArc!==0||!(await reconcileEconomy(db,[...read,guard])).ok)throw blocked();
  return {stage:'reconciled',done:true,report};
 }
 // Opening phases may never be redirected to a started season.
 if(world.seasonNumber!==0||world.phase!=='unstarted'||world.day!==0)throw blocked();
 let saved:OpeningPrivatePlan|undefined;
 const runner=createOpeningRehearsal(db,{read:async()=>readPlan(data),save:async p=>{saved=p}},(w,s)=>buildOpeningManifest(w,s,source));
 if(action==='rebase'){
  const input=retained(data);
  const report=await runner.rebaseRetained(session,input,now);
  if(report.preservedPlayers!==150)throw blocked();
  return {done:true,report};
 }
 if(action==='prepare'){
  const summary=await runner.prepare(seedValue(data.seed),retained(data));
  if(summary.reused!==150||summary.newPlayers!==6250||!saved)throw blocked();
  await db.batch([...read,guard]);
  return {done:true,summary,planJson:JSON.stringify(saved)};
 }
 if(action==='fund-preview'||action==='fund'){
  if(world.revision!==0)throw blocked();
  const opening=await runner.validatePrepared();
  if(opening.reused!==150||opening.newPlayers!==6250)throw blocked();
  const input=await fundingInput(data,world),plan=planEconomicGenesis(input);
  const approvalHash=manifestDigest({runKey:opening.runKey,input});
  if(action==='fund-preview')return {approvalHash,version:plan.version,clubCapitalArc:plan.clubCapitalArc,clubs:plan.clubs,
    freeReserveArc:plan.freeReserveArc,annualRewardsArc:plan.annualRewardsArc,grossGenesisArc:plan.grossGenesisArc,issuanceLimitArc:plan.issuanceLimitArc,forecast:input.openingContracts};
  if(data.approvalHash!==approvalHash)throw blocked();
  const access=[sessionGuard(db,session,now),...finance(db,session,now,'read','fund','reserve'),guard];
  const prior=await readEconomicGenesis(db,access);
  let result=await prepareEconomicGenesis(db,input,session.unified!.playerId,access,now);
  if(prior&&result?.completed!==1)result=result?.funded_clubs===320?await completeEconomicGenesis(db,access,now):await stepEconomicGenesis(db,access,now);
  return {done:result?.completed===1,genesis:result};
 }
 if(action==='populate'||action==='sign'||action==='publish'){
  const plan=readPlan(data);
  if(plan.root.worldGeneration!==world.generation)throw blocked();
  // Require the same private root even when a publication receipt already exists.
  const root=await db.prepare('SELECT run_key FROM opening_world_runs WHERE world_generation=? AND batch_index=-1').bind(world.generation).first<{run_key:string}>();
  if(root&&root.run_key!==plan.root.runKey)throw blocked();
  if(action==='populate'){
   if(world.revision!==0)throw blocked();
   if(!root){
    const opening=await runner.validatePrepared();
    if(opening.reused!==150||opening.newPlayers!==6250)throw blocked();
    return compactProgress(await runner.start(session,now));
   }
   return compactProgress(await runner.step(session,now));
  }
  if(!root)throw blocked();
  if(action==='sign'){
   const progress=await runner.signNextClub(session,now,5);
   return {signed:progress.signed,remaining:progress.remaining,done:progress.readyForContractReconciliation};
  }
  return {done:true,publication:await runner.publish(session,now)};
 }
 throw invalid();
}
