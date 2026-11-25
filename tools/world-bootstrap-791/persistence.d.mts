// #791 Node-only bridge types; persisted shapes owned by the existing D1 adapter.
import type {OpeningManifest} from './planner.mjs';
import type {WorldV1} from '../../backend/src/types.ts';
import type {readLocalOpeningInventory} from '../../backend/src/opening-world-inventory.ts';
import type {beginLocalOpeningRun,commitLocalOpeningBatch,readLocalOpeningJournal,readOpeningObservation} from '../../backend/src/opening-world-store.ts';
export type OpeningInventory=Awaited<ReturnType<typeof readLocalOpeningInventory>>;
export type OpeningRoot=Parameters<typeof beginLocalOpeningRun>[2];
export type OpeningIntents=Parameters<typeof commitLocalOpeningBatch>[5];
export type OpeningReceipts=Awaited<ReturnType<typeof readLocalOpeningJournal>>['receipts'];
export type OpeningObservation=Awaited<ReturnType<typeof readOpeningObservation>>;
export type OpeningProgress={runKey:string;committedBatches:number;totalBatches:number;completedSlots:number;remainingSlots:number;idHighWater:number;nextBatch:null|{runKey:string;index:number;offset:number;requestHash:string;entries:unknown[]};readyForReconciliation:boolean};
export function createCertifiedOpeningPersistenceRun(manifest:OpeningManifest,inventory:OpeningInventory,world:WorldV1):OpeningRoot;
export function inspectOpeningProgress(root:OpeningRoot,manifest:OpeningManifest,inventory:OpeningInventory,receipts:OpeningReceipts,observation:OpeningObservation):OpeningProgress;
export function prepareOpeningBatchIntents(root:OpeningRoot,manifest:OpeningManifest,inventory:OpeningInventory,index:number):OpeningIntents;

export type OpeningReconciliation={schema:'opening-local-reconciliation-v1';runKey:string;manifestHash:string;allocationHash:string;receiptHash:string;population:number;reused:number;generated:number;activeClubs:number;inactiveClubs:number;clubCounts:{clubKey:string;active:boolean;division:1|2|null;count:number}[];ages:Record<string,number>;positions:Record<string,number>;nationalities:Record<string,number>;terms:Record<string,number>;domestic:number;otherPlayable:number;otherCountries:number;stagedOnly:true};
export function reconcileCompletedOpening(root:OpeningRoot,manifest:OpeningManifest,inventory:OpeningInventory,receipts:OpeningReceipts,observation:OpeningObservation):OpeningReconciliation;

export type OpeningContractIntent={playerId:number;clubKey:string;division:1|2;durationSeasons:number;slotKey:string;kind:'reuse'|'generate';fingerprint:string;signingKey:string;idempotencyKey:string};
export type OpeningContractHandoff={schema:'opening-contract-handoff-v1';worldGeneration:string;runKey:string;allocationHash:string;receiptHash:string;intents:OpeningContractIntent[];digest:string};
export type OpeningSignedRow={id:number;player_id:number;world_generation:string;club_key:string;signed_at_ms:number;start_tick:number;duration_seasons:number;scheduled_end_tick:number;annual_salary_arc:number;minimum_arc:number;reference_arc:number;maximum_arc:number;policy_version:string;signed_mandate_id:number|null;ai_demand_arc:number|null;signing_key:string;closed_tick:number|null;close_reason:string|null};
export function prepareOpeningContractHandoff(root:OpeningRoot,manifest:OpeningManifest,inventory:OpeningInventory,receipts:OpeningReceipts,observation:OpeningObservation):OpeningContractHandoff;
export function inspectOpeningContractHandoff(handoff:OpeningContractHandoff,rows:OpeningSignedRow[]):{schema:'opening-contract-progress-v1';handoffDigest:string;signed:number;remaining:number;next:OpeningContractIntent|null;readyForContractReconciliation:boolean;signedDigest:string};
