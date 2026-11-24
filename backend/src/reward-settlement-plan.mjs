/** #776: pure, inert Rewards planner. The caller MUST independently verify sporting
 * authority, pin season policy, and authorize funds and writes. No DB, clock, HTTP,
 * funding, or ledger posting here. A valid projection is not certification. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {REWARDS_VERSION,REWARD_IDS,competitionRewards,pointsReference,placementReference,participationInstallments,plannedRewardInstallments,rewardTotals} from '../../assets/competition-rewards.mjs';

const clubKeys=new Set(clubs.map(c=>c.countryId+'-'+c.clubId));
const textOrder=(a,b)=>a<b?-1:a>b?1:0;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const fail=code=>{throw Error('reward_'+code)};
const boundedText=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x&&!/[\u0000-\u001f]/.test(x);
const total=rows=>rows.reduce((s,r)=>s+r.amountArc,0);

export function planRewardSettlement(input){
 if(!input||!uuid(input.generation)||!integer(input.season)||input.season===0||
    ![28,56].includes(input.day)||input.rewardVersion!==REWARDS_VERSION||!hash(input.evidenceHash))fail('invalid_scope');
 const {generation,season,day,rewardVersion,evidenceHash}=input;
 if(!Array.isArray(input.competitions)||input.competitions.length!==REWARD_IDS.length)fail('incomplete_world');
 const byId=new Map(input.competitions.map(c=>[c?.competitionId,c]));
 if(byId.size!==REWARD_IDS.length||REWARD_IDS.some(id=>!byId.has(id)))fail('incomplete_world');
 const domestic=new Set(),international=new Set(),rows=[];
 let expected=0,annualBudgetArc=0,startingHoldArc=0;
 for(const competitionId of REWARD_IDS){
  const rule=competitionRewards(competitionId),c=byId.get(competitionId);
  const entrants=c.entrants;
  if(!Array.isArray(entrants)||entrants.length!==rule.capacity||new Set(entrants).size!==rule.capacity||
     entrants.some(k=>!clubKeys.has(k)))fail('invalid_entrants');
  const membership=new Set(entrants),global=rule.international?international:domestic;
  for(const k of entrants){
   if(global.has(k)||(!rule.international&&k.split('-')[0]!==competitionId.split('-')[0]))fail('invalid_membership');
   global.add(k);
  }
  const amounts=[];
  const add=(clubKey,component,amountArc)=>{
   if(!integer(amountArc)||!membership.has(clubKey))fail('invalid_amount');
   const businessKey=['reward',generation,season,competitionId,component,clubKey,day].join(':');
   amounts.push(Object.freeze({businessKey,competitionId,clubKey,component,amountArc}));
  };
  const [first,second]=participationInstallments(rule);
  for(const k of entrants)add(k,'participation',day===28?first:second);
  const schedule=plannedRewardInstallments(rule),due=schedule.find(s=>s.day===day);
  if(day===56){
   const table=c.table;
   if(!Array.isArray(table)||table.length!==rule.capacity||new Set(table.map(t=>t?.clubId)).size!==rule.capacity||
      new Set(table.map(t=>t?.rank)).size!==rule.capacity||table.some(t=>!membership.has(t.clubId)||
      !Number.isInteger(t.rank)||t.rank<1||t.rank>rule.capacity||
      t.played!==(rule.international?6:30)||!integer(t.points)||t.points>3*t.played))fail('incomplete_table');
   const ranked=[...table].sort((a,b)=>a.rank-b.rank||textOrder(a.clubId,b.clubId));
   if(ranked.some((t,i)=>i>0&&t.points>ranked[i-1].points))fail('invalid_rank');
   const allocation=pointsReference(rule,ranked.map(t=>({id:t.clubId,weight:t.points})),ranked.map(t=>t.clubId));
   if(allocation.status!=='calculated-reference')fail(allocation.status);
   for(const a of allocation.allocations)add(a.id,'points',a.amount);
   const placement=placementReference(rule);
   if(!rule.international){
    for(const t of ranked)add(t.clubId,'placement',placement[t.rank-1].amount);
   }else{
    const outcomes=c.outcomes,awards=new Map(placement.map(p=>[p.id,p]));
    if(!Array.isArray(outcomes)||outcomes.length!==rule.capacity||new Set(outcomes.map(o=>o?.clubId)).size!==rule.capacity||
       outcomes.some(o=>!membership.has(o.clubId)||!awards.has(o.outcome)))fail('incomplete_outcomes');
    const qualified=new Set(ranked.slice(0,12).map(t=>t.clubId));
    for(const p of placement)if(outcomes.filter(o=>o.outcome===p.id).length!==p.count)fail('invalid_outcome_count');
    for(const o of outcomes){
     if(qualified.has(o.clubId)===(o.outcome==='leagueEliminated'))fail('invalid_outcome_membership');
     add(o.clubId,'placement',awards.get(o.outcome).amount);
    }
   }
  }
  for(const component of ['participation','points','placement']){
   if(total(amounts.filter(a=>a.component===component))!==due[component])fail('component_mismatch');
  }
  if(total(amounts)!==due.total)fail('competition_mismatch');
  rows.push(...amounts);expected+=due.total;annualBudgetArc+=rule.pool;
  startingHoldArc+=day===28?rule.pool:schedule[1].total;
 }
 if([...international].some(k=>!domestic.has(k)))fail('invalid_cup_membership');
 if(annualBudgetArc!==rewardTotals().pool||total(rows)!==expected||
    new Set(rows.map(r=>r.businessKey)).size!==rows.length)fail('world_mismatch');
 rows.sort((a,b)=>textOrder(a.businessKey,b.businessKey));
 return Object.freeze({generation,season,day,rewardVersion,evidenceHash,annualBudgetArc,startingHoldArc,
  totalArc:expected,endingHoldArc:startingHoldArc-expected,rows:Object.freeze(rows)});
}

// Deterministic projection into the existing ledger contract. No authority or write.
export function rewardPostingIntents(plan,binding){
 if(!plan||!binding||!hash(binding.manifestHash)||!boundedText(binding.configVersion,100)||
    !boundedText(binding.actorId,160)||!boundedText(binding.holdId,240))fail('invalid_binding');
 const sourceId='reward-manifest:'+binding.manifestHash;
 return plan.rows.filter(r=>r.amountArc>0).map(r=>({
  businessKey:r.businessKey,requestKey:r.businessKey,purpose:'REWARD',actorKind:'system',
  actorId:binding.actorId,configVersion:binding.configVersion,sourceId,
  generation:plan.generation,season:plan.season,day:plan.day,holdId:binding.holdId,
  lines:[{accountId:'club:'+r.clubKey,amountArc:r.amountArc},{accountId:'reserve',amountArc:-r.amountArc}]
 }));
}

// Caller supplies complete scope receipts and reversal references from the ledger,
// and a guarded hold/global reconciliation read. Unknown reads MUST NOT be passed as clean.
export function reconcileRewardPlan(plan,binding,{receipts,reversedIds,holdRemainingArc,ledgerOk}={}){
 const intents=rewardPostingIntents(plan,binding),expected=new Map(intents.map(i=>[i.businessKey,i]));
 if(!Array.isArray(receipts)||!Array.isArray(reversedIds)||!integer(holdRemainingArc)||typeof ledgerOk!=='boolean')
  return {status:'unknown',missingKeys:[],paidArc:null};
 const mismatch=()=>({status:'mismatch',missingKeys:[],paidArc:null});
 if(!ledgerOk)return mismatch();
 const seen=new Set(),ids=new Set(),reversed=new Set(reversedIds);
 let paidArc=0;
 for(const r of receipts){
  const i=expected.get(r?.business_key);
  if(!i||seen.has(i.businessKey)||!boundedText(r.id,240)||ids.has(r.id)||reversed.has(r.id)||r.reversal_of!==null||
     r.request_key!==i.requestKey||r.purpose!==i.purpose||r.actor_kind!==i.actorKind||r.actor_id!==i.actorId||
     r.config_version!==i.configVersion||r.source_id!==i.sourceId||r.generation!==i.generation||
     r.season!==i.season||r.day!==i.day||r.hold_id!==i.holdId)return mismatch();
  let lines;try{lines=JSON.parse(r.lines_json)}catch{return mismatch()}
  if(!Array.isArray(lines)||lines.length!==i.lines.length||
     i.lines.some(l=>!lines.some(x=>x?.accountId===l.accountId&&x.amountArc===l.amountArc)))return mismatch();
  seen.add(i.businessKey);ids.add(r.id);
  paidArc+=i.lines.find(l=>l.amountArc>0).amountArc;
 }
 if(holdRemainingArc!==plan.startingHoldArc-paidArc)return mismatch();
 const missingKeys=intents.filter(i=>!seen.has(i.businessKey)).map(i=>i.businessKey);
 return {status:missingKeys.length?'pending':'complete',missingKeys,paidArc};
}
