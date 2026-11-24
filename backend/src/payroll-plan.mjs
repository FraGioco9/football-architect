/** #778 isolated payroll planning. Trusted persistence adapters must certify all inputs. No writes. */
import { earnedBetween, canAffordNextPayday, CONTRACT_POLICY } from './player-contract-policy.ts';
const DAYS=CONTRACT_POLICY.earningDays, LIMIT=1_000_000_000_000;
function integer(n,min=0,max=LIMIT){if(!Number.isSafeInteger(n)||n<min||n>max)throw new RangeError('invalid_payroll_integer');return n;}
function id(n){return integer(n,1,Number.MAX_SAFE_INTEGER);}
function key(s){if(typeof s!=='string'||!s.length||s.length>160)throw new TypeError('invalid_payroll_key');return s;}
function compare(a,b){return a<b?-1:a>b?1:0;}
function total(values){return integer(values.reduce((s,n)=>s+integer(n),0),0,Number.MAX_SAFE_INTEGER);}
function period(season,day){id(season);if(day!==28&&day!==56)throw new RangeError('invalid_payday');const first=integer((season-1)*DAYS,0,Number.MAX_SAFE_INTEGER-DAYS);return {first,start:first+day-28,end:first+day};}
export function planContractClaims(contract,mandates,season,day,effectiveAnnualSalary){
 const {first,start,end}=period(season,day);
 id(contract.id);id(contract.playerId);key(contract.clubKey);key(contract.generation);
 integer(contract.startTick,0,Number.MAX_SAFE_INTEGER);integer(contract.endTick,contract.startTick,Number.MAX_SAFE_INTEGER);
 const wage=integer(effectiveAnnualSalary,1);
 const history=mandates.slice().sort((a,b)=>a.startTick-b.startTick||a.id-b.id);
 const seen=new Set();let previousEnd=-1;
 for(const m of history){
  id(m.id);key(m.accountId);integer(m.startTick,0,Number.MAX_SAFE_INTEGER);
  if(m.endTick!==null)integer(m.endTick,m.startTick,Number.MAX_SAFE_INTEGER);
  if(m.playerId!==contract.playerId||m.generation!==contract.generation||seen.has(m.id)||m.startTick<previousEnd)throw new Error('invalid_mandate_history');
  seen.add(m.id);previousEnd=m.endTick??Infinity;
 }
 const origin=Math.max(first,contract.startTick),from=Math.max(start,origin),to=Math.min(end,contract.endTick);
 if(from>=to)return [];
 const effective=history.filter(m=>m.endTick===null||m.endTick>m.startTick);
 const cuts=[...new Set([from,to,...effective.flatMap(m=>[m.startTick,m.endTick]).filter(t=>t!==null&&t>from&&t<to)])].sort((a,b)=>a-b);
 const claims=[];
 for(let i=1;i<cuts.length;i++){
  const a=cuts[i-1],b=cuts[i],m=effective.find(x=>x.startTick<=a&&(x.endTick===null||x.endTick>a));
  const due=earnedBetween(wage,a-origin,b-origin);
  if(due===0)continue;
  claims.push({id:`payroll:${contract.generation}:${contract.id}:${season}:${day}:${a}:${b}`,generation:contract.generation,contractId:contract.id,playerId:contract.playerId,clubKey:contract.clubKey,season,day,fromTick:a,toTick:b,annualSalaryArc:wage,mandateId:m?.id??null,accountId:m?.accountId??null,dueArc:due,previousPaidArc:0});
 }
 return claims;
}
export function allocateClubPayroll(clubKey,claims,cashArc,season,day,generation){
 key(clubKey);key(generation);integer(cashArc);
 const current=period(season,day).end, seen=new Set();
 const rows=claims.map(c=>{
  key(c.id);integer(c.dueArc,1);integer(c.previousPaidArc,0,c.dueArc);
  const due=period(c.season,c.day).end;
  if(c.clubKey!==clubKey||c.generation!==generation||due>current||seen.has(c.id))throw new Error('invalid_payroll_claim_scope');
  seen.add(c.id);return {...c,dueTick:due,outstanding:c.dueArc-c.previousPaidArc,paidArc:0};
 }).sort((a,b)=>a.dueTick-b.dueTick||compare(a.id,b.id));
 let remaining=cashArc;
 for(let i=0;i<rows.length;){
  let j=i+1;while(j<rows.length&&rows[j].dueTick===rows[i].dueTick)j++;
  const group=rows.slice(i,j),sum=total(group.map(x=>x.outstanding)),budget=Math.min(remaining,sum);
  if(budget>0){
   let allocated=0;
   const ranked=group.map(row=>{
    const product=BigInt(row.outstanding)*BigInt(budget);
    row.paidArc=Number(product/BigInt(sum));allocated+=row.paidArc;
    return {row,remainder:product%BigInt(sum)};
   }).sort((a,b)=>a.remainder===b.remainder?compare(a.row.id,b.row.id):a.remainder>b.remainder?-1:1);
   for(let k=0;k<budget-allocated;k++)ranked[k].row.paidArc++;
   remaining-=budget;
  }
  i=j;
 }
 const allocations=rows.map(({dueTick,outstanding,...row})=>({...row,arrearsArc:outstanding-row.paidArc}));
 return {clubKey,generation,season,day,cashArc,remainingCashArc:remaining,dueArc:total(rows.map(x=>x.outstanding)),paidArc:total(allocations.map(x=>x.paidArc)),arrearsArc:total(allocations.map(x=>x.arrearsArc)),allocations};
}
export function nextPaydayAffordability({uncommittedCash,uncreditedGuaranteedParticipation,committedUncoveredWages,arrears,newDue}){
 const input={uncommittedCash,uncreditedGuaranteedParticipation,committedUncoveredWages,arrears,newDue};
 for(const n of Object.values(input))integer(n);
 const required=total([committedUncoveredWages,newDue]);
 const signable=canAffordNextPayday(input);
 return {signable,requiredArc:required,additionalCashHoldArc:signable?Math.min(uncommittedCash,required):0};
}
