import {clearCareerMatchdayPlans} from './career-matchday.js';
/** WRD06-RC2: beginning-of-season international handover of authoritative league.
 * Commit only from a validated, cloned candidate. Existing match results are never replayed.
 * Deliberately refuses in-season handovers until an event-complete cross-calendar adapter exists.
 */
import {leagueById} from '../leagues.js';
import {copyPlayerWithAttributes} from '../addons/domain/player-generator.mjs';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {initialMedical} from '../addons/domain/player-medical.mjs';
import {initialDevelopment} from '../addons/domain/player-development.mjs';
import {makeDefaultLineup} from './lineups.js';
import {syncCareerPersonality} from './career-personality.js';
import {contractsEnabled,syncCareerContracts} from './career-contracts.js';
import {reconcileAIMarketManagedClub} from './career-ai-market.js';
import {enableCareerBoard} from './career-board.js';
import {enableCareerFinance} from './career-finance.js';
import {enableCareerFacilities} from './career-facilities.js';
import {enableCareerTraining} from './career-training.js';
import {enableCareerYouth} from './career-youth.js';

const fail=s=>{throw Error('WRD06_INTERNATIONAL_'+s);};
const key=(country,id)=>`${country}:club:${id}`;
const foreignPlayer=(p,country)=>({id:p.globalId??`${country}:${p.id}`,name:p.name,clubId:p.clubId,position:p.position,age:p.age,ovr:p.ovr,potential:p.potential,
 wage:p.wage,contract:p.contract,apps:p.apps,goals:p.goals,nationality:p.nationality,attributes:structuredClone(p.attributeProfile.values)});
const foreignClub=(c,country)=>({...c,globalId:key(country,c.id)});
const foreignFixture=(r,country)=>({...r,matches:r.matches.map(m=>({...m,globalId:`${country}:match:${m.id}`}))});
function numericMax(players){return players.reduce((m,p)=>Math.max(m,Number.isSafeInteger(p.id)?p.id:0),0);}
function intoOfficial(p,w,id){
 const base={...p,id,globalId:p.id,foot:'Destro',fitness:95,morale:75,form:6.8,
  value:Math.max(50000,Math.round(p.ovr**3*3/1000)*1000),injury:0,assists:0,yellow:0,cleanSheets:0,history:[]};
 delete base.attributes;
 const att=copyPlayerWithAttributes({...base,position:toAddonPosition(base.position)},{seed:w.seed,countryId:w.countryId}).attributeProfile;
 if(p.attributes&&Object.keys(p.attributes).length===40)att.values=structuredClone(p.attributes);
 base.attributeProfile=att;
 base.medicalV1=initialMedical(base,{day:w.advancedV1.clockDay});
 if(w.advancedV1.trainingV1)base.developmentV1=initialDevelopment({...base,position:toAddonPosition(base.position)},
  {seed:w.seed,countryId:w.countryId,startSeason:w.season});
 return base;
}
const tidyManagerClub=c=>({...c,balance:c.balance??Math.round(c.reputation*580000),
 transferBudget:c.transferBudget??Math.round(c.reputation*270000),capacity:c.capacity??14000,
 stadium:c.stadium??`${c.city} Arena`,history:c.history??[]});
function preserveManagement(w,oldCountry,oldClub){
 let a=w.advancedV1; const oldBoard=a.boardV1, oldFinance=a.financeV1, oldFacilities=a.facilitiesV1,
 oldTraining=a.trainingV1,oldYouth=a.youthV1;
 if(oldFinance){
  delete a.financeV1;enableCareerFinance(w);
  a.financeV1.formerClubs=[...(oldFinance.formerClubs??[]),{countryId:oldCountry,clubId:oldClub.id,
   endedSeason:w.season,entries:oldFinance.entries,history:oldFinance.history,closingCashEUR:oldFinance.cashEUR,debtEUR:oldFinance.debtEUR}].slice(-20);
 }
 if(oldFacilities){
  delete a.facilitiesV1;enableCareerFacilities(w);
  a.facilitiesV1.formerClubs=[...(oldFacilities.formerClubs??[]),{countryId:oldCountry,clubId:oldClub.id,
    season:w.season,buildings:oldFacilities.buildings,staff:oldFacilities.staff,projects:oldFacilities.projects,events:oldFacilities.events}].slice(-10);
 }
 if(oldTraining){
  delete a.trainingV1;enableCareerTraining(w);
  a.trainingV1.formerCountries=[...(oldTraining.formerCountries??[]),{countryId:oldCountry,clubId:oldClub.id,
    season:w.season,seasonStats:oldTraining.seasonStats,reports:oldTraining.reports}].slice(-10);
 }
 if(oldYouth){
  delete a.youthV1;enableCareerYouth(w);a=w.advancedV1;
  a.youthV1.formerCountries=[...(oldYouth.formerCountries??[]),{countryId:oldCountry,season:w.season,
   academy:oldYouth.academy,events:oldYouth.events,retired:oldYouth.retired,departed:oldYouth.departed}].slice(-10);
 }
 if(oldBoard){
  delete a.boardV1;enableCareerBoard(w);
  a.boardV1.history=[...oldBoard.history,...a.boardV1.history].slice(-45);
  a.boardV1.events=[...oldBoard.events,...a.boardV1.events].slice(-170);
 }
}
/** Caller owns the working copy, and may commit it only after global save validation.
 * Refuse outstanding same-season bookings and undisbursed financial obligations.
 */
export function migrateManagerCountryAtSeasonStart(w,destinationCountry,destinationClub){
 const a=w.advancedV1,universe=a?.worldV1,divisions=a?.divisionsV1;
 if(!universe||!a?.managerV1||w.round!==0||universe.round!==0)fail('ONLY_BEFORE_FIRST_MATCH');
 if(!universe.leagues.every(l=>l.locked||l.round===0)|| (divisions&&!Object.values(divisions.countries).every(v=>v.lower.round===0)))fail('ROUND_SYNC');
 if(a.calendarV1&&Object.keys(a.calendarV1.pending).length)fail('UNSETTLED_BOOKINGS');
 if(w.players.some(p=>p.clubId===0&&(!contractsEnabled(w)||!w.advancedV1.calendarV1?.freeAgents[p.globalId??`${w.countryId}:${p.id}`])))fail('UNATTACHED_PLAYERS');
 const sourceCode=w.countryId,sourceTier=divisions?.managedTier??1;
 if(destinationCountry===sourceCode)fail('SAME_COUNTRY');
 const from=universe.leagues.find(l=>l.countryId===sourceCode),to=universe.leagues.find(l=>l.countryId===destinationCountry);
 if(!from||!to||to.locked||!to.clubs.some(c=>c.id===destinationClub)||to.round!==0)fail('DESTINATION');
 const oldClub=w.teams.find(c=>c.id===w.clubId);if(!oldClub)fail('OLD_CLUB');
 const destinationPlayers=to.players.map(p=>({...p})),destinationTeams=to.clubs.map(c=>({...c})),destinationFixtures=structuredClone(to.fixtures);
 const sourceClubs=w.teams.map(c=>foreignClub(c,sourceCode)),sourcePlayers=w.players.filter(p=>p.clubId>0).map(p=>foreignPlayer(p,sourceCode));
 const originMatchdays=w.fixtures.map(r=>foreignFixture(r,sourceCode));
 if(originMatchdays.some(r=>r.matches.some(m=>m.result))||destinationFixtures.some(r=>r.matches.some(m=>m.result)))fail('PLAYED_GAMES');
 // The country now controlled by the user previously had a complete, independent league.
 // The departed competition becomes autonomous without replacing any other country's data.
 if(sourceTier===1){
  Object.assign(from,{locked:false,clubs:sourceClubs,players:sourcePlayers,fixtures:originMatchdays,round:0,
   nextId:Math.max(2_000_000,numericMax(w.players)+1,divisions?.countries?.[sourceCode]?.nextForeignId??0),retired:from.retired??0});
 }else{
  const lower=divisions?.countries[sourceCode]?.lower;if(!lower?.managed)fail('LOWER_MISMATCH');
  Object.assign(lower,{managed:false,clubs:sourceClubs,players:sourcePlayers,fixtures:originMatchdays,round:0});
 }
 if(a.marketV1){for(const c of w.teams){const k=key(sourceCode,c.id);
   a.marketV1.foreignFinances[k]={balance:c.balance,budget:c.transferBudget};}}
 clearCareerMatchdayPlans(w);
 w.countryId=destinationCountry;const conf=leagueById(destinationCountry);
 w.country=conf.country.it;w.countryEn=conf.country.en;w.countryFlag=conf.flag;w.competition=to.name;
 w.teams=destinationTeams.map(c=>{const bank=a.marketV1?.foreignFinances?.[key(destinationCountry,c.id)];
  return tidyManagerClub({...c,...(bank?{balance:bank.balance,transferBudget:bank.budget}:{})});
 });w.clubId=destinationClub;
 const used=new Set([...(a.youthV1?.usedIds??[]),...w.players.map(p=>p.id)]);
 let nextId=Math.max(0,...used)+1;
 w.players=destinationPlayers.map(p=>{while(used.has(nextId))nextId++;const id=nextId++;used.add(id);return intoOfficial(p,w,id);});
 w.fixtures=destinationFixtures;
 to.locked=true;for(const k of ['clubs','players','fixtures','round','nextId','retired','departedScorers'])delete to[k];
 if(divisions){divisions.managedTier=1;divisions.countries[destinationCountry].lower.managed=false;}
 a.roles={};a.legacyInjuryRounds={};
 w.lineup=makeDefaultLineup(w.players,w.clubId,w.formation);w.lastMatchId=null;
 // These are legacy *numeric* player refs: keep the old lists as historic manager data,
 // never let them point to coincidentally equal local IDs after a country switch.
 const s=a.managerV1;s.previousPlayerReferences=[...(s.previousPlayerReferences??[]),
  {countryId:sourceCode,season:w.season,watchlist:w.watchlist,transfers:w.transfers}].slice(-10);
 w.watchlist=[];w.transfers=[];
 preserveManagement(w,sourceCode,oldClub);
 reconcileAIMarketManagedClub(w,key(sourceCode,oldClub.id));
 syncCareerPersonality(w);
 return {from:sourceCode,to:destinationCountry,clubId:destinationClub};
}
