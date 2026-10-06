import {makeWorld} from '../src/data.js';
import {startCareer,advanceDay,validateSave} from '../src/engine.js';
import {syncCareerContracts,validateCareerContracts} from '../src/domain/career-contracts.js';
import {validCareerMessages} from '../src/domain/career-locale.js';
import {validateAdvancedCareer} from '../src/domain/advanced-career.js';
import {validateCareerWorld} from '../src/domain/career-world.js';
import {validateCareerPersonality} from '../src/domain/career-personality.js';
import {validateCareerMarket} from '../src/domain/career-market.js';
import {validateCareerCalendar} from '../src/domain/career-calendar.js';
import {validateCareerScouting} from '../src/domain/career-scouting.js';
import {validateCareerAIMarket} from '../src/domain/career-ai-market.js';
import {validateCareerCups} from '../src/domain/career-cups.js';
import {validateCareerContinental} from '../src/domain/career-continental.js';
import {validateCareerDivisions} from '../src/domain/career-divisions.js';
import {validateCareerBoard} from '../src/domain/career-board.js';
import {validateManagerCareer} from '../src/domain/career-manager.js';
import {validateCareerFinance} from '../src/domain/career-finance.js';
import {validateCareerFacilities} from '../src/domain/career-facilities.js';
import {validateCareerTactics} from '../src/domain/career-tactics.js';
import {validateCareerRoles} from '../src/domain/career-roles.js';
import {validateCareerCoaches} from '../src/domain/career-coaches.js';
import {validateCareerStatistics} from '../src/domain/career-statistics.js';
import {validateCareerMatchday} from '../src/domain/career-matchday.js';
import {validateCareerTraining} from '../src/domain/career-training.js';
import {validateCareerYouth} from '../src/domain/career-youth.js';
import {previewCalendarAdvance} from '../src/domain/career-calendar.js';
import {boardStatus} from '../src/domain/career-board.js';
import {fixtureIsDue} from '../src/domain/career-date.js';
import {careerMessageRequiresUserInput} from '../src/domain/history.js';

const w=makeWorld(190019);
startCareer(w,1,'SIM19 Domain');
const before={date:w.currentDate,clock:w.advancedV1?.clockDay,valid:validateSave(w),messages:validCareerMessages(w.inbox)};
const preNotice=previewCalendarAdvance(w,{toDay:w.advancedV1.clockDay+(fixtureIsDue(w)?0:1)});
const preBoard=boardStatus(w);
const preBlocking=(w.inbox||[]).filter(careerMessageRequiresUserInput).map(m=>({id:m.id,type:m.localeEvent?.type}));
const result=advanceDay(w);
syncCareerContracts(w);
const postNotice=previewCalendarAdvance(w,{toDay:w.advancedV1.clockDay+(fixtureIsDue(w)?0:1)});
const postBoard=boardStatus(w);
const postBlocking=(w.inbox||[]).filter(careerMessageRequiresUserInput).map(m=>({id:m.id,type:m.localeEvent?.type}));
const checks={
  save:validateSave(w),messages:validCareerMessages(w.inbox),advanced:validateAdvancedCareer(w),
  statistics:validateCareerStatistics(w),coaches:validateCareerCoaches(w),roles:validateCareerRoles(w),
  tactics:validateCareerTactics(w),matchday:validateCareerMatchday(w),contracts:validateCareerContracts(w),
  personality:validateCareerPersonality(w),training:validateCareerTraining(w),youth:validateCareerYouth(w),
  world:validateCareerWorld(w),market:validateCareerMarket(w),calendar:validateCareerCalendar(w),
  scouting:validateCareerScouting(w),aiMarket:validateCareerAIMarket(w),cups:validateCareerCups(w),
  continental:validateCareerContinental(w),divisions:validateCareerDivisions(w),board:validateCareerBoard(w),
  manager:validateManagerCareer(w),finance:validateCareerFinance(w),facilities:validateCareerFacilities(w)
};
console.log(JSON.stringify({before,gates:{preNotice,preBoard,preBlocking,postNotice,postBoard,postBlocking},after:{date:w.currentDate,clock:w.advancedV1?.clockDay,advanced:result.advanced,match:Boolean(result.match),inbox:w.inbox.slice(0,15).map(m=>({id:m.id,type:m.localeEvent?.type,requiresUserInput:m.requiresUserInput}))},checks},null,2));
if(!checks.save)process.exitCode=1;
