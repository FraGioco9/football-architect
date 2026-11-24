/** #777 — inert contract rules; only trusted server adapters may supply reference/authority/funding inputs. */
export const CONTRACT_POLICY=Object.freeze({
 version:'contract-draft-v1', floors:Object.freeze({1:40,2:20}),
 ceilingMultiple:2, aiNumerator:5, aiDenominator:4, earningDays:56,
 offerLifetimeMs:7*24*60*60*1000,
});
// Technical integer safety bound, not a gameplay ceiling.
const LIMIT=1_000_000_000_000;
const integer=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function requireInt(n:number,min:number,max:number):void {
 if(!integer(n,min,max))throw new RangeError('invalid_contract_integer');
}
export type Division=1|2;
export type Representation='human'|'ai';
export type SalaryBounds={minimum:number;reference:number;maximum:number;aiDemand:number};
/** rawReference must come from a versioned server-side player/destination forecast, not a request. */
export function salaryBounds(division:Division,rawReference:number):SalaryBounds {
 if(division!==1&&division!==2)throw new RangeError('invalid_division');
 if(!Number.isFinite(rawReference)||rawReference<0||rawReference>LIMIT/2)throw new RangeError('invalid_salary_reference');
 const minimum=CONTRACT_POLICY.floors[division];
 const reference=Math.max(minimum,Math.ceil(rawReference));
 return {minimum,reference,maximum:reference*CONTRACT_POLICY.ceilingMultiple,
  aiDemand:Math.ceil(reference*CONTRACT_POLICY.aiNumerator/CONTRACT_POLICY.aiDenominator)};
}
export function validAnnualSalary(wage:number,bounds:SalaryBounds,agent:Representation):boolean {
 return (agent==='human'||agent==='ai')&&integer(wage,bounds.minimum,bounds.maximum)
  &&(agent!=='ai'||wage===bounds.aiDemand);
}
export type SportingDate={season:number;day:number};
/** The adapter must establish that start is the next unplayed sporting day. No transition-day accrual. */
export function contractEnd(start:SportingDate,duration:number):SportingDate {
 requireInt(start.season,1,Number.MAX_SAFE_INTEGER-2);
 requireInt(start.day,1,CONTRACT_POLICY.earningDays);requireInt(duration,1,3);
 return {season:start.season+duration-1,day:CONTRACT_POLICY.earningDays};
}
/** Cumulative rounding; subtract consecutive cumulative amounts rather than rounding each installment. */
export function accruedSalary(wage:number,elapsedDays:number):number {
 requireInt(wage,0,LIMIT);requireInt(elapsedDays,0,CONTRACT_POLICY.earningDays);
 return Math.floor(wage*elapsedDays/CONTRACT_POLICY.earningDays);
}
export function earnedBetween(wage:number,fromElapsed:number,toElapsed:number):number {
 if(fromElapsed>toElapsed)throw new RangeError('invalid_earning_interval');
 return accruedSalary(wage,toElapsed)-accruedSalary(wage,fromElapsed);
}
export function promotionSalary(wage:number,destination:Division):number {
 requireInt(wage,1,LIMIT);
 if(destination!==1&&destination!==2)throw new RangeError('invalid_division');
 return Math.max(wage,CONTRACT_POLICY.floors[destination]);
}
export type Affordability={uncommittedCash:number;uncreditedGuaranteedParticipation:number;
 committedUncoveredWages:number;arrears:number;newDue:number};
/** Inputs must be non-overlapping, certified and rechecked in the signing transaction.
 * No IO or posting occurs here; unknown funds must not be represented as zero.
 */
export function canAffordNextPayday(input:Affordability):boolean {
 const {uncommittedCash,uncreditedGuaranteedParticipation,committedUncoveredWages,arrears,newDue}=input;
 for(const v of [uncommittedCash,uncreditedGuaranteedParticipation,committedUncoveredWages,arrears,newDue])requireInt(v,0,LIMIT);
 return arrears===0&&uncommittedCash+uncreditedGuaranteedParticipation>=committedUncoveredWages+newDue;
}
export type RecruitmentKind='opening'|'renewal'|'free-agent'|'transfer'|'own-academy';
/** Restriction only, not authorization; academy/opening fulfilment is separately gated. */
export function clubMayRecruit(kind:RecruitmentKind,manager:Representation):boolean {
 if(!['opening','renewal','free-agent','transfer','own-academy'].includes(kind))return false;
 return manager==='human'||(manager==='ai'&&['opening','renewal','own-academy'].includes(kind));
}
/** AI player representatives do not participate in counteroffer threads. */
export function canCounterOffer(agent:Representation):boolean {return agent==='human'}
export function offerExpiresAt(createdAt:number):number {
 requireInt(createdAt,1,Number.MAX_SAFE_INTEGER-CONTRACT_POLICY.offerLifetimeMs);
 return createdAt+CONTRACT_POLICY.offerLifetimeMs;
}
