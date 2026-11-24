import test from 'node:test';
import {planContractClaims,allocateClubPayroll,nextPaydayAffordability} from '../src/payroll-plan.mjs';
function assert(ok,msg){if(!ok)throw new Error(msg);}
function same(a,b){assert(JSON.stringify(a)===JSON.stringify(b),`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);}
function rejects(fn){let failed=false;try{fn()}catch{failed=true}assert(failed,'expected rejection');}
function suite(){
 const c={id:1,playerId:7,clubKey:'IT-1',generation:'fixture',startTick:0,endTick:112};
 const m={id:1,playerId:7,generation:'fixture',accountId:'agent-a',startTick:14,endTick:28};
 const n={...m,id:2,accountId:'agent-b',startTick:28,endTick:null};
 const mk=(id,dueArc,season=1,day=28,previousPaidArc=0)=>({id,clubKey:c.clubKey,generation:c.generation,dueArc,season,day,previousPaidArc});
 const alloc=(claims,cash,season=1,day=56)=>allocateClubPayroll(c.clubKey,claims,cash,season,day,c.generation);
 same(planContractClaims(c,[],1,28,101).map(x=>x.dueArc),[50]);
 same(planContractClaims(c,[],1,56,101).map(x=>x.dueArc),[51]);
 same(planContractClaims({...c,startTick:14},[],1,28,1000).map(x=>x.dueArc),[250]);
 same(planContractClaims({...c,startTick:14},[],1,56,1000).map(x=>x.dueArc),[500]);
 same(planContractClaims(c,[n,m],1,28,1120).map(x=>[x.accountId,x.dueArc]),[[null,280],['agent-a',280]]);
 same(planContractClaims(c,[m,n],1,56,1120).map(x=>[x.accountId,x.dueArc]),[['agent-b',560]]);
 same(planContractClaims({...c,endTick:20},[m],1,56,101),[]);
 same(planContractClaims(c,[],2,28,40).map(x=>x.dueArc),[20]);
 rejects(()=>planContractClaims(c,[m,{...n,startTick:27}],1,28,101));
 rejects(()=>planContractClaims(c,[{...m,generation:'other'}],1,28,101));
 const claims=[mk('a',500),mk('b',300),mk('c',200)];
 same(alloc(claims,600).allocations.map(x=>[x.paidArc,x.arrearsArc]),[[300,200],[180,120],[120,80]]);
 same(alloc(claims.slice().reverse(),600),alloc(claims,600));
 same(alloc([mk('b',1),mk('a',1),mk('c',1)],2).allocations.map(x=>x.paidArc),[1,1,0]);
 same(alloc([mk('new',100,2,28),mk('old',100,1,56,40)],80,2,28).allocations.map(x=>x.paidArc),[60,20]);
 same(alloc(claims,0).arrearsArc,1000);
 same(alloc(claims,2000).remainingCashArc,1000);
 same(alloc([mk('a',1e12),mk('b',1e12)],1e12).allocations.map(x=>x.paidArc),[5e11,5e11]);
 rejects(()=>alloc([mk('a',1),mk('a',2)],10));
 rejects(()=>alloc([mk('a',1,2,28)],10));
 rejects(()=>alloc([{...mk('a',1),clubKey:'other'}],10));
 const f={uncommittedCash:2000,uncreditedGuaranteedParticipation:3000,committedUncoveredWages:3500,arrears:0,newDue:500};
 same(nextPaydayAffordability(f),{signable:true,requiredArc:4000,additionalCashHoldArc:2000});
 same(nextPaydayAffordability({...f,arrears:1}).signable,false);
 same(nextPaydayAffordability({...f,newDue:1600}).signable,false);
 for(let i=1;i<=100;i++){
  const rows=Array.from({length:25},(_,j)=>mk(`p${j}`,1+(i*7919+j*1297)%999));
  const result=alloc(rows,i*67);
  same(result.dueArc,result.paidArc+result.arrearsArc);
  same(result.cashArc,result.paidArc+result.remainingCashArc);
  assert(result.allocations.every(x=>x.paidArc>=0&&x.arrearsArc>=0),'negative allocation');
 }
}
test('payroll accrual, routing, priority, exact allocation and affordability',suite);
