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
  const priorSlot=await publishedSlotId({generation:world.generation,season:world.seasonNumber,
   competitionId:match.competitionId,phaseId:slot.phase_id,slotId:'tie:'+slot.tie_id+':leg:1'});
  const frozen=await db.prepare('SELECT public_match_id,slot_match_id,generation,season_number,day,fixture_id,algorithm_version,receipt_hash,receipt_json FROM match_lineup_result_receipts WHERE slot_match_id=? AND generation=? AND season_number=?')
   .bind(priorSlot,world.generation,world.seasonNumber).first();
  if(!frozen||frozen.slot_match_id!==priorSlot||frozen.generation!==world.generation||
   frozen.season_number!==world.seasonNumber||frozen.day!==first.day||
   frozen.fixture_id!==first.id||frozen.algorithm_version!=='temporary-lineup-v1'||
   !hex64.test(frozen.receipt_hash))fail('first leg evidence');
  let prior;
  try{prior=JSON.parse(frozen.receipt_json)}catch{fail('first leg JSON')}
  const oldFixture=prior?.fixture,oldResult=prior?.result;
  if(prior?.schemaVersion!==1||prior.authority!=='official'||
   prior.algorithmVersion!=='temporary-lineup-v1'||
   oldFixture?.matchId!==frozen.public_match_id||
   oldFixture?.fixtureId!==first.id||oldFixture?.generation!==world.generation||
   oldFixture?.season!==world.seasonNumber||oldFixture?.day!==first.day||
   oldFixture?.homeClubId!==first.homeClubId||oldFixture?.awayClubId!==first.awayClubId||
   oldResult?.algorithmVersion!=='temporary-lineup-v1'||
   oldResult?.context?.mode!=='regulation'||
   oldResult?.resolution!=='regulation'||oldResult?.matchKey!==first.id||
   !Number.isSafeInteger(oldResult.homeGoals)||oldResult.homeGoals<0||
   !Number.isSafeInteger(oldResult.awayGoals)||oldResult.awayGoals<0||
   await hashString(JSON.stringify(prior))!==frozen.receipt_hash)
   fail('first leg receipt');
  const dayRow=await db.prepare('SELECT generation,day,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_lineup_day_outcomes WHERE season_number=? AND day=?')
   .bind(world.seasonNumber,first.day).first();
  if(!dayRow||dayRow.generation!==world.generation||dayRow.day!==first.day||
   dayRow.calendar_hash!==plan.sourceCalendarHash||
   dayRow.simulation_version!=='temporary-lineup-v1'||!hex64.test(dayRow.outcome_hash))
   fail('first leg day');
  let dayPayload;
  try{dayPayload=JSON.parse(dayRow.outcome_json)}catch{fail('first leg day JSON')}
  if(dayPayload?.schemaVersion!==2||dayPayload.season!==world.seasonNumber||
   dayPayload.generation!==world.generation||dayPayload.day!==first.day||
   dayPayload.calendarHash!==plan.sourceCalendarHash||
   dayPayload.simulationVersion!=='temporary-lineup-v1'||
   !Array.isArray(dayPayload.results)||
   await canonicalHash(dayPayload)!==dayRow.outcome_hash)fail('first leg day receipt');
  const reference=dayPayload.results.filter(x=>x.matchId===frozen.public_match_id||x.fixtureId===first.id);
  if(reference.length!==1||reference[0].matchId!==frozen.public_match_id||
   reference[0].fixtureId!==first.id||reference[0].receiptHash!==frozen.receipt_hash||
   reference[0].homeGoals!==oldResult.homeGoals||reference[0].awayGoals!==oldResult.awayGoals)
   fail('first leg result link');
  verified={mode:'second-leg',firstLegHomeGoals:oldResult.homeGoals,
   firstLegAwayGoals:oldResult.awayGoals};
  guards.push(guard(db,'SELECT 1 FROM match_lineup_result_receipts WHERE slot_match_id=? AND generation=? AND season_number=? AND day=? AND fixture_id=? AND receipt_hash=? AND receipt_json=?',
   [priorSlot,world.generation,world.seasonNumber,first.day,first.id,
    frozen.receipt_hash,frozen.receipt_json]));
  guards.push(guard(db,'SELECT 1 FROM season_lineup_day_outcomes WHERE season_number=? AND day=? AND generation=? AND calendar_hash=? AND simulation_version=? AND outcome_hash=? AND outcome_json=?',
   [world.seasonNumber,first.day,world.generation,dayRow.calendar_hash,
    dayRow.simulation_version,dayRow.outcome_hash,dayRow.outcome_json]));
 }
 if(canonical(context)!==canonical(verified))fail('untrusted context');
 return {context:verified,guards,phaseId:slot.phase_id,tieId:slot.tie_id,leg:slot.leg,
  planHash:tie.plan_hash,slotMatchId:slot.match_id};
}
