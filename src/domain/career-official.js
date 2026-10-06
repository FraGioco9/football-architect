import {enableAdvancedCareer,hasAdvancedCareer} from './advanced-career.js';
import {enableCareerTactics,careerTacticsEnabled} from './career-tactics.js';
import {enableCareerRoles,careerRolesEnabled} from './career-roles.js';
import {enableCareerMatchday,substitutionsEnabled} from './career-matchday.js';
import {enableCareerStatistics,careerStatisticsEnabled} from './career-statistics.js';
import {enableCareerTraining,hasCareerTraining} from './career-training.js';
import {enableCareerYouth,hasCareerYouth} from './career-youth.js';
import {enableCareerWorld,hasCareerWorld} from './career-world.js';
import {enableCareerCoaches,careerCoachesEnabled} from './career-coaches.js';
import {enableCareerMarket,marketEnabled} from './career-market.js';
import {enableCareerCalendar,calendarEnabled} from './career-calendar.js';
import {enableCareerScouting,scoutingEnabled} from './career-scouting.js';
import {enableCareerAIMarket,aiMarketEnabled} from './career-ai-market.js';
import {enableCareerDivisions,divisionsEnabled} from './career-divisions.js';
import {enableCareerCups,cupsEnabled} from './career-cups.js';
import {enableCareerContinental,continentalEnabled} from './career-continental.js';
import {enableCareerPersonality,personalityEnabled} from './career-personality.js';
import {enableCareerContracts,contractsEnabled} from './career-contracts.js';
import {enableCareerFinance,financeEnabled} from './career-finance.js';
import {enableCareerFacilities,facilityEnabled} from './career-facilities.js';
import {enableCareerBoard,boardEnabled} from './career-board.js';
import {enableManagerCareer,managerCareerEnabled} from './career-manager.js';

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
