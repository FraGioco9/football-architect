import type {LedgerIntent} from './economic-ledger.ts';
export type RewardProjection={competitionId:string;entrants:readonly string[];table?:readonly {clubId:string;rank:number;played:number;points:number}[];outcomes?:readonly {clubId:string;outcome:string}[]};
export type RewardInput={generation:string;season:number;day:28|56;rewardVersion:string;evidenceHash:string;competitions:readonly RewardProjection[]};
export type RewardPlan=Readonly<{generation:string;season:number;day:28|56;rewardVersion:string;evidenceHash:string;annualBudgetArc:number;startingHoldArc:number;totalArc:number;endingHoldArc:number;rows:readonly Readonly<{businessKey:string;competitionId:string;clubKey:string;component:string;amountArc:number}>[]}>;
export type RewardBinding={manifestHash:string;configVersion:string;actorId:string;holdId:string};
export function planRewardSettlement(input:RewardInput):RewardPlan;
export function rewardPostingIntents(plan:RewardPlan,binding:RewardBinding):LedgerIntent[];
export function reconcileRewardPlan(plan:RewardPlan,binding:RewardBinding,evidence?:{receipts:readonly unknown[];reversedIds:readonly string[];holdRemainingArc:number;ledgerOk:boolean}):{status:'unknown'|'mismatch'|'pending'|'complete';missingKeys:string[];paidArc:number|null};
