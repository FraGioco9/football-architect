// #766 — informational schedule, never a financial entitlement or settlement.
export const REWARDS_VERSION = 'draft-3';
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
export const CREDIT_MILESTONES=Object.freeze({participation:Object.freeze([28,56]),participationShare:50,performanceDay:56,domesticPoints:'regular-season-certified',domesticPlacement:'regular-season-certified',internationalPoints:'league-phase-certified',internationalAdvancement:'competition-certified'});
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

// Approved display symbol; no currency conversion or change to stored units.
export const REWARD_CURRENCY = '$ARC';
export function formatRewardAmount(value, locale='en', {average=false}={}){
 if(!Number.isFinite(value)||value<0||(!average&&!Number.isSafeInteger(value)))return '—';
 return (average?'≈ ':'')+(average?Math.round(value):value).toLocaleString(locale)+' '+REWARD_CURRENCY;
}
// Sporting evidence only. A complete league phase does not establish a cup outcome
// or financial certification. Unknown historical rule versions are never repriced.
export function rewardEvidenceState({id,context,worldSnapshot,debug=false}={}){
 if(debug)return 'rewardEvidenceDebug';
 const world=worldSnapshot?.source==='authoritative'?worldSnapshot.world:null;
 const source=context?.seasonData,selected=context?.selectedSeason;
 if(!Number.isSafeInteger(world?.seasonNumber)||world.seasonNumber<0)return 'rewardEvidencePending';
 if(world.seasonNumber===0)return 'rewardEvidenceZero';
 if(!Number.isSafeInteger(selected)||selected<1||selected>world.seasonNumber)return 'rewardEvidencePending';
 if(selected<world.seasonNumber)return 'rewardEvidenceHistory';
 if(typeof id!=='string'||context?.definition?.id?.toLowerCase()!==id.toLowerCase()||
    source?.provenance?.kind!=='authoritative'||source.season!==selected||
    source.world?.seasonNumber!==world.seasonNumber)return 'rewardEvidencePending';
 const rule=competitionRewards(id);
 if(!rule||!Array.isArray(source.participants)||source.participants.length!==rule.capacity)return 'rewardEvidencePending';
 if(source.entrantsOnly===true)return 'rewardEvidenceEntrants';
 const rows=source.statistics?.standings,rounds=rule.international?6:30;
 if(!Array.isArray(rows)||rows.length!==rule.capacity||!rows.every(r=>r.played===rounds))return 'rewardEvidencePartial';
 return rule.international?'rewardEvidenceLeagueComplete':'rewardEvidenceComplete';
}

// Planned pool amounts only. Individual settlement and certification are separate.
export function plannedRewardInstallments(rule){
 const [first,second]=CREDIT_MILESTONES.participation,half=rule.participation*CREDIT_MILESTONES.participationShare/100;
 if(!Number.isSafeInteger(half)||!Number.isSafeInteger(rule.points)||!Number.isSafeInteger(rule.placement))throw Error('Invalid configured reward installments');
 return [{day:first,participation:half,points:0,placement:0,total:half},{day:second,participation:rule.participation-half,points:rule.points,placement:rule.placement,total:rule.participation-half+rule.points+rule.placement}];
}

// Season-specific sporting estimates, including archives. Current DRAFT rules, never payment evidence.
export function seasonRewardReference(id,context,{debug=false}={}){
 const rule=competitionRewards(id),data=context?.seasonData;
 if(!rule||!data||data.season!==context.selectedSeason||context.definition?.id?.toLowerCase()!==rule.id.toLowerCase()||debug||data.provenance?.kind!=='authoritative')return null;
 const state=data.seasonState,day=state?.phase==='closed'?56:state?.day;
 if(!Number.isSafeInteger(day)||day<0||!Array.isArray(data.participants)||data.participants.length!==rule.capacity)return null;
 const key=club=>club?.countryId+'-'+club?.clubId;
 const clubs=new Map(data.participants.map(club=>[key(club),club]));
 if(clubs.size!==rule.capacity||[...clubs.values()].some(c=>typeof c.primaryName!=='string'||!c.primaryName.trim()))return null;
 // Read-only DRAFT reference: stable canonical key resolves equal remainders
 // for display only. The financial settlement ordering remains open (#755/#776).
 const order=[...clubs.keys()].sort();
 const equalWeights=order.map(id=>({id,weight:1}));
 const participationPool=day<CREDIT_MILESTONES.participation[0]?0:day<CREDIT_MILESTONES.performanceDay?rule.participation/2:rule.participation;
 const participation=new Map(largestRemainder(participationPool,equalWeights,order).allocations.map(x=>[x.id,x.amount]));
 const rows=[...clubs].map(([id,club])=>({id,club,amount:participation.get(id)}));
 const pending=()=>({rows:rows.map(x=>({...x,amount:null})).sort((a,b)=>a.club.primaryName.localeCompare(b.club.primaryName,'en')),pending:true});
 if(day>=56){
  const table=data.statistics?.standings,rounds=rule.international?6:30;
  const valid=Array.isArray(table)&&table.length===rule.capacity&&new Set(table.map(x=>key(x.club))).size===rule.capacity&&table.every(x=>clubs.has(key(x.club))&&x.played===rounds&&Number.isSafeInteger(x.pts)&&x.pts>=0);
  const total=valid?table.reduce((sum,x)=>sum+x.pts,0):0;
  if(!total)return pending();
  const pointsAllocation=pointsReference(rule,table.map(x=>({id:key(x.club),weight:x.pts})),order);
  if(pointsAllocation.status!=='calculated-reference')return pending();
  const points=new Map(pointsAllocation.allocations.map(x=>[x.id,x.amount]));
  const placement=new Map();
  if(!rule.international){
   const reference=placementReference(rule);
   if(!reference)return pending();
   table.forEach((x,i)=>placement.set(key(x.club),reference[i].amount));
  }else{
   const weights={playoffs:3,quarterfinals:6,semifinals:10,final:17};
   table.slice(12).forEach(x=>placement.set(key(x.club),0));
   const phases=context.definition.rules?.phases?.filter(x=>x.type==='knockout'),results=data.results;
   if(!Array.isArray(phases)||phases.length!==4||!Array.isArray(results))return pending();
   for(const phase of phases){
    if(!Object.hasOwn(weights,phase.id)||!Array.isArray(phase.ties))return pending();
    for(const tie of phase.ties){
     const matches=results.filter(x=>(x.id||x.tieId)===tie.id),result=matches[0],leg=result?.legs?.[0],winner=result?.winnerId;
     if(matches.length!==1||!leg||!Array.isArray(result.legs)||result.legs.length!==tie.legs||result.legs.some(x=>!x)||!clubs.has(leg.homeId)||!clubs.has(leg.awayId)||leg.homeId===leg.awayId||![leg.homeId,leg.awayId].includes(winner))return pending();
     const loser=leg.homeId===winner?leg.awayId:leg.homeId;
     if(placement.has(loser)||placement.has(winner))return pending();
     placement.set(loser,rule.placement*weights[phase.id]/100);
     if(phase.id==='final')placement.set(winner,rule.placement*27/100);
    }
   }
   if(placement.size!==rule.capacity||[...placement.values()].reduce((a,b)=>a+b,0)!==rule.placement)return pending();
  }
  for(const row of rows)row.amount+=points.get(row.id)+placement.get(row.id);
 }
 rows.sort((a,b)=>b.amount-a.amount||a.club.primaryName.localeCompare(b.club.primaryName,'en',{sensitivity:'base'})||a.id.localeCompare(b.id));
 return {rows,pending:false};
}
// The selected season, not the global current season, controls presentation.
// Closed archives can be identified before their results load via the verified world clock.
export function rewardSeasonFinished(context,snapshot,model=null,debug=false){
 const season=context?.selectedSeason,data=context?.seasonData;
 if(!Number.isSafeInteger(season)||season<1)return false;
 if(debug)return snapshot?.source==='dev'&&Number.isSafeInteger(snapshot.current?.season)&&season<snapshot.current.season;
 if(data?.season===season&&data.provenance?.kind==='authoritative'){
  if(data.seasonState?.phase==='closed')return true;
  if(data.seasonState?.day>=CREDIT_MILESTONES.performanceDay&&model&&!model.pending)return true;
 }
 const world=snapshot?.source==='authoritative'?snapshot.world:null;
 return Number.isSafeInteger(world?.seasonNumber)&&(season<world.seasonNumber||season===world.seasonNumber&&world.phase==='closed');
}
