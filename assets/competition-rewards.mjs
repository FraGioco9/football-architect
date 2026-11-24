// #766 — informational schedule, never a financial entitlement or settlement.
export const REWARDS_VERSION = 'draft-2';
export const REWARDS = Object.freeze({
  domestic1: Object.freeze({pool:4000000,capacity:16,shares:Object.freeze([60,15,25])}),
  domestic2: Object.freeze({pool:2000000,capacity:16,shares:Object.freeze([60,15,25])}),
  sovereign: Object.freeze({pool:8000000,capacity:24,shares:Object.freeze([40,20,40])}),
  federation: Object.freeze({pool:4000000,capacity:24,shares:Object.freeze([40,20,40])})
});
export const REWARD_IDS = Object.freeze([
  ...['BR','DE','ENG','ES','FR','IT','NL','PT'].flatMap(c=>[c+'-1',c+'-2']),
  'int-1','int-2'
]);
export function competitionRewards(id) {
  if(typeof id!=='string')return null;
  const canonical=REWARD_IDS.find(key=>key.toLowerCase()===id.toLowerCase());
  if(!canonical)return null;
  const international=canonical.startsWith('int-');
  const rule=REWARDS[international?(canonical==='int-1'?'sovereign':'federation'):('domestic'+canonical.at(-1))];
  const [participation,points,placement]=rule.shares.map(share=>rule.pool*share/100);
  return Object.freeze({id:canonical,version:REWARDS_VERSION,status:'draft-reference',international,
    pool:rule.pool,capacity:rule.capacity,shares:rule.shares,participation,points,placement,
    participationReference:participation/rule.capacity,participationIsAverage:international});
}
export function rewardTotals() {
  return REWARD_IDS.map(competitionRewards).reduce((sum,row)=>({
    pool:sum.pool+row.pool,participation:sum.participation+row.participation,
    points:sum.points+row.points,placement:sum.placement+row.placement
  }),{pool:0,participation:0,points:0,placement:0});
}

// Approved #755/#766 integer apportionment. No default equal-remainder policy.
export function largestRemainder(pool, rows, tieOrder=null) {
 if(!Number.isSafeInteger(pool)||pool<0||!Array.isArray(rows)||rows.length===0)throw new TypeError('Invalid reward pool or weights');
 const ids=new Set();
 for(const row of rows){
  if(typeof row?.id!=='string'||!row.id||ids.has(row.id)||!Number.isSafeInteger(row.weight)||row.weight<0)throw new TypeError('Invalid reward weight');
  ids.add(row.id);
 }
 const denominator=rows.reduce((total,row)=>total+BigInt(row.weight),0n);
 if(denominator===0n)return {status:'pending-zero-denominator',allocations:null};
 const entries=rows.map(row=>{
  const numerator=BigInt(pool)*BigInt(row.weight);
  return {id:row.id,amount:Number(numerator/denominator),remainder:numerator%denominator};
 });
 let remaining=pool-entries.reduce((sum,row)=>sum+row.amount,0);
 const priority=new Map();
 if(tieOrder!==null){
  if(!Array.isArray(tieOrder)||tieOrder.length!==ids.size||new Set(tieOrder).size!==ids.size||tieOrder.some(id=>!ids.has(id)))throw new TypeError('Invalid explicit remainder order');
  tieOrder.forEach((id,index)=>priority.set(id,index));
 }
 const ranked=[...entries].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:tieOrder===null?0:priority.get(a.id)-priority.get(b.id));
 // Equal remainders only matter when the final allocated unit cuts through a tied group.
 if(tieOrder===null&&remaining>0&&remaining<ranked.length&&ranked[remaining-1].remainder===ranked[remaining].remainder)return {status:'pending-tiebreak',allocations:null};
 for(let i=0;i<remaining;i++)ranked[i].amount++;
 return {status:'calculated-reference',allocations:entries.map(({id,amount})=>({id,amount}))};
}
export const INTERNATIONAL_OUTCOMES=Object.freeze([{"id":"champion","count":1,"weight":27},{"id":"runnerUp","count":1,"weight":17},{"id":"semifinalLoser","count":2,"weight":10},{"id":"quarterfinalLoser","count":4,"weight":6},{"id":"playoffLoser","count":4,"weight":3},{"id":"leagueEliminated","count":12,"weight":0}].map(row=>Object.freeze(row)));
export const CREDIT_MILESTONES=Object.freeze({participation:Object.freeze([0,28]),participationShare:50,domesticPoints:'regular-season-certified',domesticPlacement:'regular-season-certified',internationalPoints:'league-phase-certified',internationalAdvancement:'competition-certified'});
export function placementReference(rule){
 if(rule.international)return INTERNATIONAL_OUTCOMES.map(row=>({...row,amount:rule.placement*row.weight/100}));
 const rows=Array.from({length:rule.capacity},(_,i)=>({id:String(i+1),weight:rule.capacity-i}));
 const allocation=largestRemainder(rule.placement,rows);
 if(allocation.status!=='calculated-reference')return null;
 return rows.map((row,i)=>({rank:i+1,weight:row.weight,amount:allocation.allocations[i].amount}));
}
export function participationReference(rule){
 const floor=Math.floor(rule.participation/rule.capacity),higher=rule.participation%rule.capacity;
 return {floor,lowerCount:rule.capacity-higher,higher:higher?floor+1:floor,higherCount:higher,installment:rule.international?null:floor/2};
}
export function pointsReference(rule,rows,tieOrder=null){
 if(!Array.isArray(rows)||rows.length!==rule.capacity)return {status:'pending-incomplete',allocations:null};
 return largestRemainder(rule.points,rows,tieOrder);
}
