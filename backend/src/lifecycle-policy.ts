import {ApiError} from './errors.ts';
import {parseWorldV1,type WorldV1} from './types.ts';

/**
 * Pure lifecycle decision boundary for ADMIN-WORLD-01 PR2.
 * This module does not change D1, schedule matches, invent draws or publish results.
 * The command executor must validate all evidence against authoritative D1 records
 * in the same atomic transaction before applying a proposed transition.
 */
export type LifecycleCommand='start'|'advance'|'close'|'prepare-next';
export interface PrerequisiteEvidence {
  calendarComplete:boolean;
  drawsComplete:boolean;
  dueActivitiesComplete:boolean;
  resultsComplete:boolean;
  archiveComplete:boolean;
  nextSeasonSnapshotApproved:boolean;
}
export type LifecycleProposal=Readonly<{
  command:LifecycleCommand;
  before:WorldV1;
  after:WorldV1;
}>;

function requireEvidence(value:unknown):PrerequisiteEvidence {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(422,'invalid_prerequisites');
  const v=value as Record<string,unknown>;
  const keys=['calendarComplete','drawsComplete','dueActivitiesComplete','resultsComplete','archiveComplete','nextSeasonSnapshotApproved'];
  if(Object.keys(v).length!==keys.length||keys.some(k=>typeof v[k]!=='boolean'))
    throw new ApiError(422,'invalid_prerequisites');
  return v as unknown as PrerequisiteEvidence;
}
function required(condition:boolean):void {
  if(!condition)throw new ApiError(409,'prerequisites_incomplete');
}

/** Strict deterministic proposal. Not a substitute for atomic D1 source checks. */
export function proposeLifecycleTransition(
  worldInput:unknown,command:LifecycleCommand,evidenceInput:unknown,
):LifecycleProposal {
  let world:WorldV1;
  try{world=parseWorldV1(worldInput)}catch{throw new ApiError(422,'invalid_world')}
  const e=requireEvidence(evidenceInput);
  if(!['start','advance','close','prepare-next'].includes(command))
    throw new ApiError(422,'invalid_lifecycle_command');
  if(world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'revision_exhausted');
  let after:WorldV1;
  switch(command){
   case 'start':
    required(world.phase==='preparing'&&e.calendarComplete&&e.drawsComplete);
    after={...world,phase:'active',day:1,revision:world.revision+1};
    break;
   case 'advance':
    required(world.phase==='active'&&world.day<56&&e.dueActivitiesComplete);
    after={...world,day:world.day+1,revision:world.revision+1};
    break;
   case 'close':
    required(world.phase==='active'&&world.day===56&&e.dueActivitiesComplete&&e.resultsComplete&&e.archiveComplete);
    after={...world,phase:'closed',revision:world.revision+1};
    break;
   case 'prepare-next':
    required(world.phase==='closed'&&e.nextSeasonSnapshotApproved&&world.seasonNumber<Number.MAX_SAFE_INTEGER);
    after={...world,seasonNumber:world.seasonNumber+1,day:0,phase:'preparing',revision:world.revision+1};
    break;
  }
  return {command,before:world,after:parseWorldV1(after)};
}
