// Domain logic: no DOM, browser storage or UI dependencies.
import {clamp} from './rules.js';
import {clearCareerMatchdayPlans} from './career-matchday.js';
import {personalityEnabled,syncCareerPersonality,settleCareerPersonalityRound,settleCareerPersonalitySeason} from './career-personality.js';
import {contractsEnabled,syncCareerContracts,settleCareerContractsRound} from './career-contracts.js';
import {randomFactory,roundSeed,seasonSeed} from './rng.js';
import {createFixtures} from './fixtures.js';
import {makeDefaultLineup} from './lineups.js';
import {clubById,clubPlayers,playerById,clubMatch,fullName,myClub} from './selectors.js';
import {addMessage} from './history.js';
import {table} from './standings.js';
import {simulateMatch} from './match.js';
import {compactMoney} from './format.js';
import {hasAdvancedCareer,advanceAdvancedDay,prepareAdvancedRound,simulateAdvancedMatch,settleAdvancedLegacyAbsences,settleAdvancedSeason} from './advanced-career.js';
import {hasCareerTraining,settleCareerTrainingSeason,openCareerTrainingSeason} from './career-training.js';
import {hasCareerYouth,settleCareerYouthSeason} from './career-youth.js';
import {hasCareerWorld,advanceCareerWorldRound,advanceCareerWorldSeason,syncCareerWorldClock} from './career-world.js';
import {syncCareerCoachesWorld} from './career-coaches.js';
import {settleCareerMarketSeason,expireCareerMarketOffers} from './career-market.js';
import {advanceCareerScouting,settleCareerScoutingSeason} from './career-scouting.js';
import {advanceCareerAIMarket,settleCareerAIMarketSeason} from './career-ai-market.js';
import {advanceCareerCupsDay,advanceCareerCupsRound,archiveCareerCupsSeason,openCareerCupsSeason} from './career-cups.js';
import {advanceCareerContinentalDay,advanceCareerContinentalRound,archiveCareerContinentalSeason,captureContinentalQualifiers,openCareerContinentalSeason} from './career-continental.js';
import {advanceCareerDivisionsRound,captureDivisionSeason,openCareerDivisionsSeason} from './career-divisions.js';
import {boardEnabled,boardStatus,recordBoardRound,settleBoardSeason,openBoardSeason} from './career-board.js';
import {advanceManagerCareerRound,settleManagerCareerSeason,openManagerCareerSeason} from './career-manager.js';
import {financeEnabled,reconcileCareerFinance,settleCareerFinanceRound,postCareerPrize,closeCareerFinanceSeason,openCareerFinanceSeason} from './career-finance.js';
import {facilityEnabled,facilityImpact,advanceCareerFacilitiesRound,openCareerFacilitiesSeason} from './career-facilities.js';
import {calendarEnabled,previewCalendarAdvance,processCareerCalendarRound,settleCareerCalendarRound,beforeCareerCalendarSeason,afterCareerCalendarSeason,releaseCareerFreeAgent} from './career-calendar.js';
import {ensureCareerDates,advanceCareerDate,fixtureIsDue,openNextSeasonDates,nextSeasonCalendarPlan,addDaysISO,daysBetweenISO,formatCareerDateTime} from './career-date.js';
import {playerAgeOnDate} from './player-identity.js';
import {ensureOfficialCareerSystems} from './career-official.js';

function syncIdentityAges(w){
  if(!w?.currentDate||!Array.isArray(w.players))return;
  for(const player of w.players)if(player.identity?.birthDate){
    const age=playerAgeOnDate(player.identity.birthDate,w.currentDate);
    player.age=age;
    // PLYR-01 updates the visible age daily. PLY03 keeps the same age in
    // the development snapshot, which is validated by MGT04 each training day.
    // A birthday must not invalidate the first daily tick or advance a season.
    if(player.developmentV1&&player.developmentV1.age!==age)
      player.developmentV1.age=age;
  }
}

export function startCareer(w,clubId,manager){
  ensureCareerDates(w);
  syncIdentityAges(w);
  if(!clubById(w,clubId))throw new Error('Club non valido.');
  const managerName=typeof manager==='string'?manager.trim():'';
  if(!managerName)throw new Error('Nome allenatore obbligatorio.');
  w.clubId=Number(clubId);
  w.manager=managerName.slice(0,50);
  w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation);
  ensureOfficialCareerSystems(w);
  addMessage(w,'Benvenuto sulla panchina',`La dirigenza di ${myClub(w).name} ti ha affidato la prima squadra. Il tuo obiettivo è costruire un progetto competitivo nella competizione ${w.competition||'Lega Aurora'}.`,'welcome',{type:'welcome',params:{club:myClub(w).name,league:w.competition||'Lega Aurora'}});
  const opening=clubMatch(w.fixtures[0],w.clubId),openingOpponent=fullName(w,opening.home===w.clubId?opening.away:opening.home);
  addMessage(w,'Prestagione iniziata',`La preparazione parte il ${formatCareerDateTime(w.currentDate,null,'it')}. Il campionato comprende ${w.teams.length} club e ${w.fixtures.length} giornate; la prima partita contro ${openingOpponent} è fissata per ${formatCareerDateTime(opening.date,opening.kickoff,'it')}.`,'calendar',{type:'calendar.start',params:{clubs:w.teams.length,rounds:w.fixtures.length,opponent:openingOpponent}});
  return w;
}

export function advanceDay(w,{calendarConfirmationToken=null,simulateDueMatch=true}={}){
  const candidate=structuredClone(w);
  const result=advanceDayMutating(candidate,{calendarConfirmationToken,simulateDueMatch});
  Object.assign(w,candidate);
  return result;
}
function advanceDayMutating(w,{calendarConfirmationToken=null,simulateDueMatch=true}={}){
  ensureCareerDates(w);
  if(fixtureIsDue(w)){
    if(!simulateDueMatch)return {date:w.currentDate,advanced:false,matchDue:true,match:null};
    const match=simulateRoundMutating(w,{calendarConfirmationToken,advanceDays:0,calendarAlreadySettled:true});
    return {date:w.currentDate,advanced:false,matchDue:false,match};
  }
  const calendarPreview=calendarEnabled(w)?previewCalendarAdvance(w,{toDay:w.advancedV1.clockDay+1}):null;
  if(calendarPreview)processCareerCalendarRound(w,{confirmationToken:calendarConfirmationToken,preview:calendarPreview});
  advanceCareerDate(w);
  syncIdentityAges(w);
  if(hasAdvancedCareer(w)){
    advanceAdvancedDay(w);
    if(w.advancedV1.clockDay!==w.careerDay)throw new Error('CAREER_DATE_CLOCK_DESYNC');
    if(personalityEnabled(w))syncCareerPersonality(w);
    if(hasCareerWorld(w))syncCareerWorldClock(w);
    advanceCareerScouting(w);
    advanceCareerCupsDay(w,{simulateManagedCup:simulateAdvancedMatch});
    advanceCareerContinentalDay(w,{simulateManagedCup:simulateAdvancedMatch});
  }
  if(calendarPreview)settleCareerCalendarRound(w,{preview:calendarPreview});
  expireCareerMarketOffers(w);
  if(financeEnabled(w))reconcileCareerFinance(w,{reason:'external'});
  if(facilityEnabled(w))advanceCareerFacilitiesRound(w);
  let match=null,matchDue=fixtureIsDue(w);
  if(matchDue&&simulateDueMatch){
    match=simulateRoundMutating(w,{calendarConfirmationToken,advanceDays:0,calendarAlreadySettled:true});
    matchDue=false;
  }
  w.updatedAt=new Date().toISOString();
  return {date:w.currentDate,advanced:true,matchDue,match};
}

export function simulateRound(w,{calendarConfirmationToken=null,advanceDays=null,calendarAlreadySettled=false}={}){
  ensureCareerDates(w);
  const next=w.fixtures[w.round],resolvedAdvanceDays=advanceDays===null
    ?(next?Math.max(0,daysBetweenISO(w.currentDate,next.date)):0)
    :advanceDays;
  // Advanced transitions are transactional: a failure never half-plays a matchday.
  if(hasAdvancedCareer(w)){
    const candidate=structuredClone(w);
    simulateRoundMutating(candidate,{calendarConfirmationToken,advanceDays:resolvedAdvanceDays,calendarAlreadySettled});
    Object.assign(w,candidate);
    return clubMatch(w.fixtures[w.round-1],w.clubId);
  }
  return simulateRoundMutating(w,{calendarConfirmationToken,advanceDays:resolvedAdvanceDays,calendarAlreadySettled});
}
function simulateRoundMutating(w,{calendarConfirmationToken=null,advanceDays=7,calendarAlreadySettled=false}={}){
  ensureCareerDates(w);
  if(!Number.isSafeInteger(advanceDays)||advanceDays<0||advanceDays>120)throw new Error('CAREER_ADVANCE_DAYS');
  if(financeEnabled(w))reconcileCareerFinance(w,{reason:'round'});
  const calendarPreview=calendarEnabled(w)&&!calendarAlreadySettled&&advanceDays>0?previewCalendarAdvance(w,{toDay:w.advancedV1.clockDay+advanceDays}):null;
  if(calendarPreview)processCareerCalendarRound(w,{confirmationToken:calendarConfirmationToken,preview:calendarPreview});
  if(boardEnabled(w)&&boardStatus(w)!=='active')throw new Error('MGT01_MANAGER_NOT_ACTIVE');
  if(!w.clubId)throw new Error('Seleziona prima un club.');
  if(w.lineup.length!==11||w.lineup.some(id=>!id))throw new Error('La formazione è incompleta: seleziona undici titolari prima di giocare.');
  if(w.round>=w.fixtures.length)throw new Error('Stagione terminata: avvia quella successiva.');
  const week=w.fixtures[w.round];
  const rand=randomFactory(roundSeed(w.seed,w.season,week.round));
  const enhanced=hasAdvancedCareer(w);
  const recovering=enhanced?[]:w.players.filter(p=>p.injury>0).map(p=>p.id);
  if(advanceDays>0){
    for(let day=0;day<advanceDays;day++)advanceCareerDate(w);
    syncIdentityAges(w);
    if(enhanced){prepareAdvancedRound(w,{days:advanceDays});if(w.advancedV1.clockDay!==w.careerDay)throw new Error('CAREER_DATE_CLOCK_DESYNC');}
  }
  if(!enhanced)for(const p of w.players)p.fitness=clamp(p.fitness+12,0,100);
  for(const match of week.matches){
    if(enhanced)simulateAdvancedMatch(w,match);
    else simulateMatch(w,match,rand);
  }
  if(enhanced)settleAdvancedLegacyAbsences(w);
  else for(const id of recovering){const p=playerById(w,id);if(p)p.injury=Math.max(0,p.injury-1);}
  w.round++;
  if(hasCareerWorld(w))advanceCareerWorldRound(w);
  advanceCareerDivisionsRound(w);
  advanceCareerCupsRound(w,{simulateManagedCup:simulateAdvancedMatch});
  advanceCareerContinentalRound(w,{simulateManagedCup:simulateAdvancedMatch});
  if(calendarPreview)settleCareerCalendarRound(w,{preview:calendarPreview});
  expireCareerMarketOffers(w);
  advanceCareerScouting(w);
  advanceCareerAIMarket(w);
  for(const club of w.teams){
    const wage=clubPlayers(w,club.id).reduce((sum,p)=>sum+p.wage,0);
    const atHome=week.matches.find(m=>m.home===club.id);
    const revenue=atHome?Math.round((club.capacity*(.62+rand()*.32)*24)/1000)*1000:0;
    const sponsors=85000+club.reputation*2500;
    club.balance+=revenue+sponsors-wage;
    if(club.id===w.clubId)w.financeHistory.push({round:w.round,season:w.season,revenue:revenue+sponsors,wages:wage,balance:club.balance});
  }
  if(financeEnabled(w))settleCareerFinanceRound(w);
  if(facilityEnabled(w))advanceCareerFacilitiesRound(w);
  const match=clubMatch(week,w.clubId),result=match.result,ours=match.home===w.clubId?result.homeGoals:result.awayGoals,theirs=match.home===w.clubId?result.awayGoals:result.homeGoals;
  const opponent=fullName(w,match.home===w.clubId?match.away:match.home);
  w.lastMatchId=match.id;
  const outcome=ours>theirs?'Vittoria':ours===theirs?'Pareggio':'Sconfitta';
  addMessage(w,`${outcome} contro ${opponent}`,`Giornata ${week.round}: ${fullName(w,match.home)} ${result.homeGoals}–${result.awayGoals} ${fullName(w,match.away)}. ${ours>theirs?'La squadra ha conquistato tre punti.':ours===theirs?'Un punto aggiunto alla classifica.':'Ora il gruppo deve reagire.'}`,'match',{type:'match.official',params:{round:week.round,home:fullName(w,match.home),away:fullName(w,match.away),homeGoals:result.homeGoals,awayGoals:result.awayGoals,outcome:ours>theirs?'win':ours===theirs?'draw':'loss'}});
  settleCareerPersonalityRound(w,{result:ours>theirs?'win':ours<theirs?'loss':'draw',playedIds:w.lineup.filter(Boolean)});
  if(contractsEnabled(w))settleCareerContractsRound(w,{matchId:match.id,startedIds:w.lineup});
  recordBoardRound(w,{result,ours,theirs});
  advanceManagerCareerRound(w);
  const injuries=clubPlayers(w,w.clubId).filter(p=>p.injury>0);
  if(injuries.length)addMessage(w,'Situazione infermeria',`${injuries.map(p=>`${p.name} (${p.injury} ${p.injury===1?'giornata':'giornate'})`).join(', ')}. I giocatori indisponibili non verranno convocati.`,'medical');
  if(!hasCareerTraining(w)&&w.round%3===0){
    const eligible=clubPlayers(w,w.clubId).filter(p=>p.age<=28&&p.ovr<p.potential);
    const offense=['ATT','AD','AS','COC'],defense=['POR','TD','DC','TS','MED'];
    const affinity=p=>w.training==='Giovani'?(p.age<=22?15:0):w.training==='Attacco'?(offense.includes(p.position)?12:0):w.training==='Difesa'?(defense.includes(p.position)?12:0):0;
    const max=w.training==='Giovani'?5:3;
    eligible.sort((a,b)=>(b.potential-b.ovr)+affinity(b)-(a.potential-a.ovr)-affinity(a));
    const improved=[];
    for(const p of eligible.slice(0,max)){
      const specialty=affinity(p)>0;
      if(rand()<(specialty?.75:.46)){
        p.ovr++;p.value=Math.round(p.value*1.07/50000)*50000;improved.push(p.name);
      }
    }
    if(improved.length)addMessage(w,'Report allenamento',`Progressi tecnici rilevati: ${improved.join(', ')}. Il lavoro sul campo inizia a dare risultati.`,'training',{type:'training.progress',params:{players:improved.join(', ')}});
  }
  const healthyLineup=w.lineup.map(id=>id&&!playerById(w,id)?.injury?id:null);
  if(healthyLineup.some((id,i)=>id!==w.lineup[i]))w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation,healthyLineup);
  w.updatedAt=new Date().toISOString();
  return match;
}

export function newSeason(w){
  if(hasCareerTraining(w)||hasCareerWorld(w)){const candidate=structuredClone(w);const result=newSeasonMutating(candidate);Object.assign(w,candidate);return result;}
  return newSeasonMutating(w);
}
function newSeasonMutating(w){
  if(boardEnabled(w)&&boardStatus(w)==='retired')throw new Error('MGT01_MANAGER_RETIRED');
  if(w.round<w.fixtures.length)throw new Error('Termina il campionato prima di iniziare una nuova stagione.');
  clearCareerMatchdayPlans(w);
  beforeCareerCalendarSeason(w);
  const nextCalendar=nextSeasonCalendarPlan(w);
  const previous=table(w),position=previous.findIndex(r=>r.id===w.clubId)+1;
  const boardReview=settleBoardSeason(w);
  settleManagerCareerSeason(w,{boardReview});
  const prize=(w.teams.length+1-position)*850000+1200000;
  myClub(w).balance+=prize;myClub(w).transferBudget+=Math.round(prize*.7);
  if(financeEnabled(w)){postCareerPrize(w,prize);closeCareerFinanceSeason(w);}
  const developed=hasCareerTraining(w)&&settleCareerTrainingSeason(w);
  // Archive WRD03 cup results independently before the world/roster rollover.
  archiveCareerCupsSeason(w);
  archiveCareerContinentalSeason(w);
  const continentalQualifiers=captureContinentalQualifiers(w);
  const divisionPlan=captureDivisionSeason(w);
  // WRD05 must snapshot this season's scorers BEFORE PLY06 retires/removes them.
  // newSeason clones the whole career, so a subsequent failure rolls back both.
  if(hasCareerWorld(w))advanceCareerWorldSeason(w);
  const youthRollover=hasCareerYouth(w)&&settleCareerYouthSeason(w);
  if(youthRollover&&facilityEnabled(w)){
    const bonus=Math.min(2,Math.floor((facilityImpact(w).academyBonus+1)/2));
    if(bonus)for(const p of w.advancedV1.youthV1.academy[String(w.clubId)]??[]){p.potential=Math.min(99,p.potential+bonus);}
  }
  w.season++;w.round=0;
  // Settles debts and returns loans in the same season checkpoint; a failure rolls back all leagues.
  settleCareerMarketSeason(w);
  w.fixtures=createFixtures(w.teams.map(c=>c.id),w.season);
  if(divisionPlan){openCareerDivisionsSeason(w,divisionPlan);w.fixtures=createFixtures(w.teams.map(c=>c.id),w.season);}
  syncCareerCoachesWorld(w);
  const rand=randomFactory(seasonSeed(w.seed,w.season));
  for(const p of w.players){
    if(p.identity?.birthDate)p.age=playerAgeOnDate(p.identity.birthDate,nextCalendar.seasonStartDate);
    else if(!youthRollover)p.age++;
    p.contract=Math.max(1,p.contract-1);p.fitness=95;p.injury=0;p.morale=clamp(p.morale+12,55,95);
    p.apps=0;if(p.minutesPlayed!==undefined)p.minutesPlayed=0;p.goals=0;p.assists=0;p.yellow=0;p.cleanSheets=0;p.form=6.8;
    if(!developed&&p.age>30&&rand()<.3)p.ovr=Math.max(48,p.ovr-1);
  }
  if(hasAdvancedCareer(w)){
    settleAdvancedSeason(w,{days:nextCalendar.days});
    w.currentDate=addDaysISO(w.currentDate,nextCalendar.days);w.careerDay+=nextCalendar.days;
    if(w.advancedV1.clockDay!==w.careerDay)throw new Error('CAREER_DATE_CLOCK_DESYNC');
  }else{
    w.currentDate=addDaysISO(w.currentDate,nextCalendar.days);w.careerDay+=nextCalendar.days;
  }
  openNextSeasonDates(w,{plan:nextCalendar});
  settleCareerPersonalitySeason(w);
  if(hasCareerWorld(w))syncCareerWorldClock(w);
  openBoardSeason(w);
  openManagerCareerSeason(w);
  if(financeEnabled(w))openCareerFinanceSeason(w);
  if(facilityEnabled(w))openCareerFacilitiesSeason(w);
  openCareerCupsSeason(w);
  if(continentalQualifiers)openCareerContinentalSeason(w,continentalQualifiers);
  afterCareerCalendarSeason(w);
  if(contractsEnabled(w)){
    // Natural expiries follow the existing MKT02 free-agent register. Never
    // remove a player if that would violate minimum squad/goalkeeper rules.
    const book=w.advancedV1.contractsV1;
    if(calendarEnabled(w))for(const [id,contract] of Object.entries(book.contracts)){
      if(contract.terms.endSeason>=w.season)continue;
      const p=w.players.find(item=>String(item.id)===id&&item.clubId===w.clubId);
      if(!p)continue;
      const squad=clubPlayers(w,w.clubId);
      if(squad.length<=18||(p.position==='POR'&&squad.filter(x=>x.position==='POR').length<2))continue;
      const internationalId=p.globalId??`${w.countryId}:${p.id}`;
      // Pending market transfers/loans retain their original registration.
      const pending=Object.values(w.advancedV1.calendarV1.pending||{}).some(x=>x.playerId===internationalId);
      const loans=w.advancedV1.marketV1?.loans||{};
      if(pending||loans[internationalId])continue;
      releaseCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:internationalId,consent:true});
    }
    syncCareerContracts(w);
  }
  settleCareerScoutingSeason(w);
  settleCareerAIMarketSeason(w);
  if(developed)openCareerTrainingSeason(w);
  w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation);
  addMessage(w,`Stagione ${w.season}: prestagione al via`,`Hai chiuso la precedente stagione al ${position}° posto. La nuova preparazione parte il ${formatCareerDateTime(w.currentDate,null,'it')} e la prima giornata è fissata per ${formatCareerDateTime(w.fixtures[0].date,w.fixtures[0].matches[0]?.kickoff,'it')}. La società ha stanziato ${compactMoney(prize)} in premi e nuovi fondi.`,'calendar',{type:'season.new',params:{season:w.season,position,prizeEURMinor:Math.round(prize*100)}});
  w.lastMatchId=null;w.updatedAt=new Date().toISOString();
  return {position,prize};
}
