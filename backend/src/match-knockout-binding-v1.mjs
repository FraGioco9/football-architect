/** #613: independently check persisted resolved knockout match against published reservation.
 * Preliminary source binding only: the full progression replay remains required at cutover.
 * Never treats reserved slots or future participants as actual completed match results.
 */
const fail=reason=>{throw new TypeError('Invalid knockout match binding: '+reason)};
const hex64=/^[a-f0-9]{64}$/;
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
async function hashString(value){
 const data=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function canonicalHash(value){return hashString(canonical(value))}
async function publishedSlotId({generation,season,competitionId,phaseId,slotId}){
 const input=['football-architect-match-slot-v1',generation.toLowerCase(),season,competitionId,phaseId,slotId];
 return 'm1_'+(await hashString(JSON.stringify(input))).slice(0,32);
}
const GUARD_START='INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS(';
const FAIL_SENTINEL='00000000-0000-4000-8000-000000000000';
const guard=(db,query,args)=>db.prepare(GUARD_START+query+')').bind(FAIL_SENTINEL,...args);

function validScore(result){
 return result&&result.algorithmVersion==='temporary-score-v1'&&result.provenance==='temporary-simulation'&&
  Number.isSafeInteger(result.homeGoals)&&result.homeGoals>=0&&result.homeGoals<=100&&
  Number.isSafeInteger(result.awayGoals)&&result.awayGoals>=0&&result.awayGoals<=100;
}

/** Matches stored plan fixture, slot publication and (for leg 2) a finalized prior result.
 * No direct writes; returned guards MUST be added to the future single D1 batch.
 */
export async function resolvePublishedKnockoutV1(db,{match,world,published,context}){
 if(!match||!world||!published||typeof published.slot_match_id!=='string')fail('inputs');
 const slot=await db.prepare('SELECT * FROM season_knockout_match_slots WHERE match_id=?')
  .bind(published.slot_match_id).first();
 if(!slot||slot.match_id!==published.slot_match_id||slot.generation!==world.generation||
  slot.season_number!==world.seasonNumber||slot.competition_id!==match.competitionId||
  slot.scheduled_day!==match.day||slot.source_hash!==match.sourceHash||
  !Number.isSafeInteger(slot.leg)||![1,2].includes(slot.leg)||!['neutral','higherOriginalTableRank'].includes(slot.home_policy))
  fail('published reservation');
 const expectedSlot=await publishedSlotId({generation:world.generation,season:world.seasonNumber,
  competitionId:match.competitionId,phaseId:slot.phase_id,slotId:slot.slot_id});
 if(expectedSlot!==published.slot_match_id||slot.slot_id!=='tie:'+slot.tie_id+':leg:'+slot.leg)
  fail('slot identity');
 const tie=await db.prepare('SELECT generation,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=? AND competition_id=? AND phase_id=? AND tie_id=?')
  .bind(world.seasonNumber,match.competitionId,slot.phase_id,slot.tie_id).first();
 if(!tie||tie.generation!==world.generation||!hex64.test(tie.plan_hash))fail('resolved tie');
 let plan;
 try{plan=JSON.parse(tie.plan_json)}catch{fail('tie JSON')}
 if(!plan||plan.schemaVersion!==1||plan.season!==world.seasonNumber||plan.competitionId!==match.competitionId||
  plan.phaseId!==slot.phase_id||plan.tieId!==slot.tie_id||
  plan.rulesVersion!==slot.rules_version||plan.homePolicy!==slot.home_policy||
  !Array.isArray(plan.fixtures)||![1,2].includes(plan.fixtures.length)||
  await canonicalHash(plan)!==tie.plan_hash)fail('tie source integrity');
 if(slot.home_policy==='neutral'&&plan.fixtures.length!==1)fail('neutral multi-leg');
 const entry=plan.fixtures.find(x=>x.leg===slot.leg);
 const f=entry?.fixture;
 if(!entry||!f||f.id!==match.fixtureId||f.day!==match.day||
  f.competitionId!==match.competitionId||f.marker!==slot.marker||
  f.round!==(slot.round_number??13)||f.homeClubId!==match.homeClubId||
  f.awayClubId!==match.awayClubId||entry.neutral!==(slot.home_policy==='neutral')||
  plan.fixtures.some(x=>x.fixture.day>56||x.fixture.day<1)||
  (plan.fixtures.length===1&&slot.leg!==1))fail('fixture binding');
 const guards=[
  guard(db,'SELECT 1 FROM season_knockout_match_slots WHERE match_id=? AND generation=? AND season_number=? AND competition_id=? AND phase_id=? AND tie_id=? AND leg=? AND slot_id=? AND marker=? AND scheduled_day=? AND round_number=? AND source_hash=? AND rules_version=? AND home_policy=?',
   [published.slot_match_id,slot.generation,slot.season_number,slot.competition_id,slot.phase_id,
    slot.tie_id,slot.leg,slot.slot_id,slot.marker,slot.scheduled_day,slot.round_number,
    slot.source_hash,slot.rules_version,slot.home_policy]),
  guard(db,'SELECT 1 FROM season_knockout_ties WHERE season_number=? AND competition_id=? AND phase_id=? AND tie_id=? AND generation=? AND plan_hash=? AND plan_json=?',
   [world.seasonNumber,match.competitionId,slot.phase_id,slot.tie_id,world.generation,tie.plan_hash,tie.plan_json])
 ];
 let verified;
 if(plan.fixtures.length===1)verified=slot.home_policy==='neutral'
  ?{mode:'single-knockout',neutral:true}:{mode:'single-knockout'};
 else if(slot.leg===1)verified={mode:'regulation'};
 else {
  const first=plan.fixtures[0]?.fixture;
  if(!first||first.day>=match.day||first.homeClubId!==f.awayClubId||
    first.awayClubId!==f.homeClubId||plan.fixtures[0].leg!==1)fail('first leg chronology');
  const receipt=await db.prepare('SELECT generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=? AND day=?')
   .bind(world.seasonNumber,first.day).first();
  if(!receipt||receipt.generation!==world.generation||receipt.day!==first.day||
   receipt.calendar_hash!==plan.sourceCalendarHash||receipt.simulation_version!=='temporary-score-v1'||
   !hex64.test(receipt.outcome_hash))fail('first leg evidence');
  let payload;
  try{payload=JSON.parse(receipt.outcome_json)}catch{fail('first leg JSON')}
  if(!payload||payload.schemaVersion!==1||payload.season!==world.seasonNumber||
   payload.generation!==world.generation||payload.day!==first.day||
   payload.calendarHash!==receipt.calendar_hash||payload.simulationVersion!=='temporary-score-v1'||
   !Array.isArray(payload.results)||await canonicalHash(payload)!==receipt.outcome_hash)
   fail('first leg receipt');
  const results=payload.results.filter(x=>x.fixtureId===first.id);
  if(results.length!==1||!validScore(results[0]))fail('first leg result');
  verified={mode:'second-leg',firstLegHomeGoals:results[0].homeGoals,
   firstLegAwayGoals:results[0].awayGoals};
  guards.push(guard(db,'SELECT 1 FROM season_day_outcomes WHERE season_number=? AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,first.day,world.generation,receipt.calendar_hash,
    receipt.simulation_version,receipt.outcome_hash,receipt.outcome_json]));
 }
 if(canonical(context)!==canonical(verified))fail('untrusted context');
 return {context:verified,guards,phaseId:slot.phase_id,tieId:slot.tie_id,leg:slot.leg,
  planHash:tie.plan_hash,slotMatchId:slot.match_id};
}
