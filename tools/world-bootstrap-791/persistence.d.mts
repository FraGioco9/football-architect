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
