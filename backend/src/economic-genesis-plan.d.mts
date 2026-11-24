import type {LedgerIntent,EconomicHold} from './economic-ledger.ts';
export type GenesisInput={version:string;clubs:readonly {clubKey:string;amountArc:number}[];freeReserveArc:number;issuanceLimitArc:number};
export type GenesisPlan=Readonly<{
 version:string;status:'draft';clubs:readonly Readonly<{clubKey:string;amountArc:number}>[];
 clubCapitalArc:number;freeReserveArc:number;annualRewardsArc:number;rewardVersion:string;
 reserveAfterFundingArc:number;grossGenesisArc:number;issuanceLimitArc:number;
 policy:Readonly<{genesisReserveArc:number;issuanceLimitArc:number;clubOpeningJson:string;rulesJson:string}>;
 intents:readonly LedgerIntent[];
}>;
export function planEconomicGenesis(input:GenesisInput):GenesisPlan;
export function inspectGenesisReceipts(plan:GenesisPlan,receipts:readonly unknown[]):Readonly<{
 state:'uninitialized'|'funding'|'funded-unverified';genesisPosted:boolean;fundedClubs:number;fundedArc:number;
 pendingClubs:number;expectedReserveArc:number;pending:readonly LedgerIntent[];
}>;
export function planGenesisRewardHold(plan:GenesisPlan,generation:string,season:number):EconomicHold;
