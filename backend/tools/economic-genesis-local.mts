/** Explicit disposable local-only operator, no CLI, no automatic run or remote binding. */
import {openLocalDatabase} from './operator-local.mts';
import type {AdminSession} from '../src/auth.ts';
import {financeSessionGuard} from '../src/economic-ledger.ts';
import {prepareEconomicGenesis,stepEconomicGenesis,completeEconomicGenesis,earmarkNextRewardBudget,readEconomicGenesis} from '../src/economic-genesis.ts';
import type {GenesisInput} from '../src/economic-genesis-plan.mjs';
export async function openLocalEconomicGenesis(persistTo:string){
 const handle=await openLocalDatabase(persistTo,{requireExisting:true,migrate:false}),db=handle.db;
 function guards(session:AdminSession,now:number,capability:'read'|'fund'|'reserve'){
  const u=session.unified;if(!u)throw Error('unified finance session required');
  return [financeSessionGuard(db,u.playerId,u.sessionDigest,u.csrfDigest,capability,now)];
 }
 return {
  close:handle.close,
  preview:(session:AdminSession,now:number)=>readEconomicGenesis(db,guards(session,now,'read')),
  prepare:(input:GenesisInput,session:AdminSession,now:number)=>prepareEconomicGenesis(db,input,session.unified?.playerId??'',guards(session,now,'fund'),now),
  step:(session:AdminSession,now:number)=>stepEconomicGenesis(db,guards(session,now,'fund'),now),
  complete:(session:AdminSession,now:number)=>completeEconomicGenesis(db,[...guards(session,now,'fund'),...guards(session,now,'reserve')],now),
  earmarkNext:(session:AdminSession,now:number)=>earmarkNextRewardBudget(db,guards(session,now,'reserve'),now)
 };
}
