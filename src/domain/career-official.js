import {enableAdvancedCareer,hasAdvancedCareer} from './advanced-career.js';
import {enableCareerTactics,careerTacticsEnabled,validateCareerTactics} from './career-tactics.js';
import {enableCareerRoles,careerRolesEnabled,validateCareerRoles} from './career-roles.js';
import {enableCareerMatchday,substitutionsEnabled,validateCareerMatchday} from './career-matchday.js';
import {enableCareerStatistics,careerStatisticsEnabled,validateCareerStatistics} from './career-statistics.js';
import {enableCareerTraining,hasCareerTraining,validateCareerTraining} from './career-training.js';
import {enableCareerYouth,hasCareerYouth,validateCareerYouth} from './career-youth.js';
import {enableCareerWorld,hasCareerWorld,validateCareerWorld} from './career-world.js';
import {enableCareerCoaches,careerCoachesEnabled,validateCareerCoaches} from './career-coaches.js';
import {enableCareerMarket,marketEnabled,validateCareerMarket} from './career-market.js';
import {enableCareerCalendar,calendarEnabled,validateCareerCalendar} from './career-calendar.js';
import {enableCareerScouting,scoutingEnabled,validateCareerScouting} from './career-scouting.js';
import {enableCareerAIMarket,aiMarketEnabled,validateCareerAIMarket} from './career-ai-market.js';
import {enableCareerDivisions,divisionsEnabled,validateCareerDivisions} from './career-divisions.js';
import {enableCareerCups,cupsEnabled,validateCareerCups} from './career-cups.js';
import {enableCareerContinental,continentalEnabled,validateCareerContinental} from './career-continental.js';
import {enableCareerPersonality,personalityEnabled,validateCareerPersonality} from './career-personality.js';
import {enableCareerContracts,contractsEnabled,validateCareerContracts} from './career-contracts.js';
import {enableCareerFinance,financeEnabled,validateCareerFinance} from './career-finance.js';
import {enableCareerFacilities,facilityEnabled,validateCareerFacilities} from './career-facilities.js';
import {enableCareerBoard,boardEnabled,validateCareerBoard} from './career-board.js';
import {enableManagerCareer,managerCareerEnabled,validateManagerCareer} from './career-manager.js';

export const OFFICIAL_SYSTEM_KEYS=Object.freeze([
  'advanced','tactics','roles','matchday','statistics','training','youth','world','coaches',
  'market','calendar','scouting','aiMarket','divisions','cups','continental','personality',
  'contracts','finance','facilities','board','manager'
]);

export function officialCareerSystemStatus(w){
  if(!w?.clubId)return Object.fromEntries(OFFICIAL_SYSTEM_KEYS.map(key=>[key,false]));
  return {
    advanced:hasAdvancedCareer(w),
    tactics:careerTacticsEnabled(w),
    roles:careerRolesEnabled(w),
    matchday:substitutionsEnabled(w),
    statistics:careerStatisticsEnabled(w),
    training:hasCareerTraining(w),
    youth:hasCareerYouth(w),
    world:hasCareerWorld(w),
    coaches:careerCoachesEnabled(w),
    market:marketEnabled(w),
    calendar:calendarEnabled(w),
    scouting:scoutingEnabled(w),
    aiMarket:aiMarketEnabled(w),
    divisions:divisionsEnabled(w),
    cups:cupsEnabled(w),
    continental:continentalEnabled(w),
    personality:personalityEnabled(w),
    contracts:contractsEnabled(w),
    finance:financeEnabled(w),
    facilities:facilityEnabled(w),
    board:boardEnabled(w),
    manager:managerCareerEnabled(w)
  };
}

export function officialCareerValidationStatus(w){
  return {
    tactics:validateCareerTactics(w),
    roles:validateCareerRoles(w),
    matchday:validateCareerMatchday(w),
    statistics:validateCareerStatistics(w),
    training:validateCareerTraining(w),
    youth:validateCareerYouth(w),
    world:validateCareerWorld(w),
    coaches:validateCareerCoaches(w),
    market:validateCareerMarket(w),
    calendar:validateCareerCalendar(w),
    scouting:validateCareerScouting(w),
    aiMarket:validateCareerAIMarket(w),
    divisions:validateCareerDivisions(w),
    cups:validateCareerCups(w),
    continental:validateCareerContinental(w),
    personality:validateCareerPersonality(w),
    contracts:validateCareerContracts(w),
    finance:validateCareerFinance(w),
    facilities:validateCareerFacilities(w),
    board:validateCareerBoard(w),
    manager:validateManagerCareer(w)
  };
}

export function officialCareerSystemsReady(w){
  const status=officialCareerSystemStatus(w);
  return OFFICIAL_SYSTEM_KEYS.every(key=>status[key]===true);
}

/**
 * Make every shipped gameplay system part of the standard career.
 *
 * The order is dependency-driven and every enable* transition is idempotent.
 * This function is therefore also the migration path for valid older saves
 * that were created while one or more systems were still opt-in.
 */
export function ensureOfficialCareerSystems(w,{managerOrigin='',managerStyle='balanced'}={}){
  if(!w?.clubId)return {changed:false,enabled:[],status:officialCareerSystemStatus(w)};
  const before=officialCareerSystemStatus(w);

  enableAdvancedCareer(w);
  enableCareerTactics(w);
  enableCareerRoles(w);
  enableCareerMatchday(w);
  enableCareerStatistics(w);
  enableCareerTraining(w);
  enableCareerYouth(w);

  enableCareerWorld(w);
  enableCareerCoaches(w);
  enableCareerMarket(w);
  enableCareerCalendar(w);
  enableCareerScouting(w);
  enableCareerAIMarket(w);
  enableCareerDivisions(w);
  enableCareerCups(w);
  enableCareerContinental(w);

  enableCareerPersonality(w);
  enableCareerContracts(w);
  enableCareerFinance(w);
  enableCareerFacilities(w);
  enableCareerBoard(w);
  enableManagerCareer(w,{origin:managerOrigin,style:managerStyle});

  const status=officialCareerSystemStatus(w);
  const enabled=OFFICIAL_SYSTEM_KEYS.filter(key=>!before[key]&&status[key]);
  if(!OFFICIAL_SYSTEM_KEYS.every(key=>status[key]))throw new Error('CORE_OFFICIAL_SYSTEM_BOOTSTRAP_INCOMPLETE');
  return {changed:enabled.length>0,enabled,status};
}
