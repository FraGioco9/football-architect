// Domain logic: no DOM, browser storage or UI dependencies.
import {validCareerMessages} from './career-locale.js';
import {validateAdvancedCareer} from './advanced-career.js';
import {CAREER_CALENDAR_VERSION,isCareerDate,isCareerKickoff} from './career-date.js';

export function validateSave(data){
  return Boolean(data && data.version===1 && Array.isArray(data.teams)
    && [12,20].includes(data.teams.length)
    && Array.isArray(data.players) && data.players.length>=data.teams.length*18
    && Array.isArray(data.fixtures) && data.fixtures.length===2*(data.teams.length-1)
    && data.fixtures.every((r,i)=>r.round===i+1 && Array.isArray(r.matches) && r.matches.length===data.teams.length/2)
    && Number.isInteger(data.round) && data.round>=0 && data.round<=data.fixtures.length
    && Number.isInteger(data.season) && data.season>=1
    && (data.currentDate===undefined || (isCareerDate(data.currentDate) && Number.isSafeInteger(data.careerDay) && data.careerDay>=0 && isCareerDate(data.seasonStartDate) && isCareerDate(data.firstMatchDate)
      && (data.calendarModelVersion!==CAREER_CALENDAR_VERSION || (Number.isSafeInteger(data.seasonCalendarYear)
        && data.fixtures.every(r=>isCareerDate(r.date) && ['weekend','midweek'].includes(r.slot)
          && r.matches.every(m=>m.date===r.date && isCareerKickoff(m.kickoff) && m.datetime===`${m.date}T${m.kickoff}:00`))))))
    && validCareerMessages(data.inbox)
    && validateAdvancedCareer(data));
}
