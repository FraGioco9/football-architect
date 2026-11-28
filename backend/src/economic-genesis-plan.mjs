/** #775 — pure DRAFT genesis plan and receipt preview. No DB writes, clock or activation. */
import clubs from '../../data/clubs.json' with {type:'json'};
import seasonOne from '../catalogues/season-1.approval.json' with {type:'json'};
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
const activeClubs=new Set(seasonOne.manifest.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>b.clubIds));
const LIMIT=1000000000000;
const actor="economic-genesis-v1";
const validInt=(x,min)=>Number.isSafeInteger(x)&&x>=min&&x<=LIMIT;
const fail=code=>{throw new Error("economic_genesis_"+code)};
const order=(a,b)=>a<b?-1:a>b?1:0;
function buildPlan(input,keys,budget){
 if(!input||typeof input.version!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(input.version))fail("invalid_version");
 if(keys.length!==320||new Set(keys).size!==320)fail("invalid_catalogue");
 if(!Array.isArray(input.clubs)||input.clubs.length!==320)fail("incomplete_clubs");
 if(!validInt(input.freeReserveArc,0)||!validInt(input.issuanceLimitArc,1)||!validInt(budget.annual,1))fail("invalid_amount");
 const byKey=new Map();
 for(const row of input.clubs){
  if(!row||!keys.includes(row.clubKey)||byKey.has(row.clubKey)||!validInt(row.amountArc,activeClubs.has(row.clubKey)?1:0))fail("invalid_club");
  byKey.set(row.clubKey,row.amountArc);
 }
 const clubs=[...keys].sort(order).map(clubKey=>Object.freeze({clubKey,amountArc:byKey.get(clubKey)}));
 const capital=clubs.reduce((sum,row)=>sum+row.amountArc,0);
 const reserveAfterFundingArc=input.freeReserveArc+budget.annual;
 const grossGenesisArc=capital+reserveAfterFundingArc;
 if(!validInt(capital,1)||!validInt(grossGenesisArc,1)||grossGenesisArc>input.issuanceLimitArc)fail("issuance_limit");
 const version=input.version;
 const posting=(businessKey,purpose,sourceId,from,to,amount)=>Object.freeze({
  businessKey,requestKey:businessKey,purpose,actorKind:"system",actorId:actor,configVersion:version,sourceId,
  lines:Object.freeze([{accountId:from,amountArc:-amount},{accountId:to,amountArc:amount}].sort((a,b)=>order(a.accountId,b.accountId)).map(Object.freeze))
 });
 const intents=[posting("economic-genesis:reserve","GENESIS_RESERVE","economic-genesis","issuance","reserve",grossGenesisArc),
  ...clubs.filter(c=>c.amountArc>0).map(c=>posting("economic-genesis:club:"+c.clubKey,"CLUB_OPENING",c.clubKey,"reserve","club:"+c.clubKey,c.amountArc))];
 return Object.freeze({version,status:"draft",clubs:Object.freeze(clubs),clubCapitalArc:capital,freeReserveArc:input.freeReserveArc,
  annualRewardsArc:budget.annual,rewardVersion:budget.version,reserveAfterFundingArc,grossGenesisArc,issuanceLimitArc:input.issuanceLimitArc,
  policy:Object.freeze({genesisReserveArc:grossGenesisArc,issuanceLimitArc:input.issuanceLimitArc,
   clubOpeningJson:JSON.stringify(Object.fromEntries(clubs.map(c=>[c.clubKey,c.amountArc]))),
   rulesJson:JSON.stringify({draft:true,genesisProtocol:1,rewardVersion:budget.version,annualRewardsArc:budget.annual,freeReserveArc:input.freeReserveArc})}),
  intents:Object.freeze(intents)});
}
function inspectReceipts(plan,receipts){
 if(!Array.isArray(receipts)||receipts.length>plan.intents.length)fail("unexpected_journal");
 const expected=new Map(plan.intents.map(i=>[i.businessKey,i]));
 const seen=new Set(),ids=new Set();let fundedArc=0,genesisPosted=false;
 for(const r of receipts){
  const i=expected.get(r?.business_key);
  if(!i||seen.has(r.business_key)||typeof r.id!=="string"||!r.id||ids.has(r.id)||
    r.request_key!==i.requestKey||r.actor_kind!==i.actorKind||r.actor_id!==i.actorId||
    r.purpose!==i.purpose||r.source_id!==i.sourceId||r.config_version!==i.configVersion||
    r.reversal_of!==null||r.hold_id!==null||r.generation!==null||r.season!==null||r.day!==null||
    typeof r.request_hash!=="string"||!/^[0-9a-f]{64}$/.test(r.request_hash))fail("receipt_mismatch");
  let lines;try{lines=JSON.parse(r.lines_json)}catch{fail("receipt_mismatch")}
  if(!Array.isArray(lines)||lines.length!==i.lines.length||
    lines.some((l,n)=>!l||l.accountId!==i.lines[n].accountId||l.amountArc!==i.lines[n].amountArc))fail("receipt_mismatch");
  seen.add(r.business_key);ids.add(r.id);
  if(i.purpose==="GENESIS_RESERVE")genesisPosted=true;
  else fundedArc+=i.lines.find(l=>l.amountArc>0).amountArc;
 }
 const expectedFundedClubs=plan.intents.length-1;
 const fundedClubs=seen.size-(genesisPosted?1:0);
 if(!genesisPosted&&fundedClubs>0)fail("missing_genesis");
 return Object.freeze({state:!genesisPosted?"uninitialized":fundedClubs===expectedFundedClubs?"funded-unverified":"funding",
  genesisPosted,fundedClubs,fundedArc,pendingClubs:expectedFundedClubs-fundedClubs,
  expectedReserveArc:genesisPosted?plan.grossGenesisArc-fundedArc:0,
  pending:Object.freeze(plan.intents.filter(i=>!seen.has(i.businessKey)))});
}
function rewardHold(plan,generation,season){
 if(typeof generation!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(generation)||!Number.isSafeInteger(season)||season<1)fail("invalid_reward_scope");
 const id=["reward-budget",generation,season,plan.rewardVersion].join(":");
 return Object.freeze({id,sourceId:id,accountId:"reserve",purpose:"REWARD_BUDGET",actorId:"reward-settlement-v1",configVersion:plan.version,amountArc:plan.annualRewardsArc});
}
const keys=Object.freeze(clubs.map(c=>c.countryId+'-'+c.clubId));
export function planEconomicGenesis(input){
 return buildPlan(input,keys,rewardCalendarBudget());
}
export {inspectReceipts as inspectGenesisReceipts,rewardHold as planGenesisRewardHold};
