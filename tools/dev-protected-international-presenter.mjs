// I05 DEV-only native International Fixtures transaction. No public import.
import {attachProtectedPresenter} from "./dev-protected-page-bridge.mjs";
const fail=message=>{throw Error("I05 International: "+message)};
function prepareSeason(payload,definition,season){
 if(payload?.acceptance!=="UNSEALED_NOT_FOR_RUNTIME"||!Array.isArray(payload.clubs)||
    payload.clubs.length!==24||!Array.isArray(payload.fixtures)||!Array.isArray(payload.standings))
  fail("unverified candidate");
 const clubs=new Map(payload.clubs.map(c=>[c.canonicalId,c]));
 if(clubs.size!==24||payload.participants.some(id=>!clubs.has(id)))fail("membership");
 const losses=new Map(payload.participants.map(id=>[id,0]));
 for(const event of payload.fixtures.filter(e=>e.phaseId==="league"&&e.result!==null)){
  const h=event.result.homeGoals,a=event.result.awayGoals;
  if(!Number.isSafeInteger(h)||!Number.isSafeInteger(a))fail("invalid league score");
  if(h<a)losses.set(event.homeId,(losses.get(event.homeId)||0)+1);
  if(a<h)losses.set(event.awayId,(losses.get(event.awayId)||0)+1);
 }
 const standings=payload.standings.map(row=>{
  const club=clubs.get(row.clubId);if(!club)fail("ranking identity");
  const played=row.played,won=row.wins,lost=losses.get(row.clubId);
  if(!Number.isSafeInteger(played)||!Number.isSafeInteger(won)||!Number.isSafeInteger(lost)||played-won-lost<0)
   fail("invalid ranking totals");
  return {club,played,won,drawn:played-won-lost,lost,
   gf:row.goalsFor,ga:row.goalsAgainst,gd:row.goalDifference,pts:row.points};
 });
 const fixtures=[];
 for(const event of payload.fixtures){
  if(event.phaseId==="league"){
   fixtures.push({phaseId:"league",round:Number(event.roundId),homeId:event.homeId,awayId:event.awayId,
    homeGoals:event.result?.homeGoals??null,awayGoals:event.result?.awayGoals??null,kickoff:null});
   continue;
  }
  if(!event.result)continue; // Future knockout slots stay in the existing fixed UI.
  const phase=definition.rules.phases.find(p=>p.ties?.some(t=>t.id===event.phaseId));
  const tie=phase?.ties.find(t=>t.id===event.phaseId);
  const leg=Number(event.eventId?.match(/:(1|2)$/)?.[1]);
  if(!tie||!Number.isInteger(leg)||leg<1||leg>tie.legs)fail("unknown knockout stage");
  fixtures.push({phaseId:phase.id,round:phase.id,tieId:tie.id,leg,
   homeId:event.homeId,awayId:event.awayId,neutral:tie.homePolicy==="neutral",
   homeGoals:event.result.homeGoals,awayGoals:event.result.awayGoals,kickoff:null,
   penalties:event.tiebreak?.penalties??null});
 }
 const results=payload.resolvedTies.map(t=>({tieId:t.tieId,winnerId:t.winner}));
 return {season,competitionId:definition.id,rulesVersion:definition.rules.version,rulesSnapshot:definition.rules,
  participants:payload.clubs,fixtures,results,statistics:{standings},
  status:payload.history.status==="candidate-complete"?"available":"partial",
  provenance:{kind:"debug",namespace:"local-debug",datasetId:payload.source.datasetId}};
}
export function attachProtectedInternationalPresenter({competitionId}){
 if(!/^int-[12]$/.test(competitionId))return ()=>{};
 return attachProtectedPresenter({
  kind:"international",
  prepare(payload,{cursor}){
   const context=window.faCompetitionContext;
   const definition=context?.currentDefinition||context?.definition;
   if(cursor.competitionId!==competitionId||definition?.id!==competitionId||
      typeof window.faFixtures?.prepare!=="function"||
      typeof window.faFixtures?.snapshot!=="function"||
      typeof window.faCompetitionContextApi?.prepareProtectedInternationalSeasonData!=="function")
    fail("shared renderer unavailable");
   const data=prepareSeason(payload,definition,cursor.seasonNumber);
   const tx=window.faCompetitionContextApi.prepareProtectedInternationalSeasonData(data,context.revision);
   return {tx,data,definition,restore:window.faFixtures.snapshot(),committed:false};
  },
  commit(p){
   try{
    p.tx.commit();
    const apply=window.faFixtures.prepare(p.data.fixtures,{definition:p.definition,
      participants:p.data.participants,currentMatchday:null});
    apply();p.committed=true;p.tx.publish();
   }catch(error){try{p.restore()}catch{}p.tx.rollback();throw error}
  },
  rollback(p){if(p.tx.isCurrent()){if(p.committed)p.restore();p.tx.rollback()}}
 });
}
