// Domain logic: no DOM, browser storage or UI dependencies.
import {validCareerMessages} from './career-locale.js';
import {validateAdvancedCareer} from './advanced-career.js';
import {CAREER_CALENDAR_VERSION,isCareerDate,isCareerKickoff,validateFixtureRescheduleState} from './career-date.js';
import {validatePlayerIdentity} from './player-identity.js';


function validPlayerIdentities(data){
  if(!Array.isArray(data?.players))return false;
  try{
    for(const player of data.players){
      if(player.identity===undefined||player.identity===null)continue; // legacy player
      if(typeof player.globalId!=='string'||!player.globalId.trim())return false;
      validatePlayerIdentity(player.identity,{referenceDate:data.currentDate,expectedAge:player.age});
      if(player.name!==player.identity.displayName)return false;
      if(player.shirtNumber!==player.identity.shirtNumber)return false;
      const expectedFoot=player.identity.preferredFoot==='left'?'Sinistro':'Destro';
      if(player.foot!==expectedFoot)return false;
    }
    return true;
  }catch{return false;}
}

export function validateSave(data){
  return Boolean(data && data.version===1 && Array.isArray(data.teams)
    && [12,20].includes(data.teams.length)
    && Array.isArray(data.players) && data.players.length>=data.teams.length*18
    && validPlayerIdentities(data)
    && Array.isArray(data.fixtures) && data.fixtures.length===2*(data.teams.length-1)
    && data.fixtures.every((r,i)=>r.round===i+1 && Array.isArray(r.matches) && r.matches.length===data.teams.length/2)
    && Number.isInteger(data.round) && data.round>=0 && data.round<=data.fixtures.length
    && Number.isInteger(data.season) && data.season>=1
    && (data.currentDate===undefined || (isCareerDate(data.currentDate) && Number.isSafeInteger(data.careerDay) && data.careerDay>=0 && isCareerDate(data.seasonStartDate) && isCareerDate(data.firstMatchDate)
      && (data.calendarModelVersion!==CAREER_CALENDAR_VERSION || (Number.isSafeInteger(data.seasonCalendarYear)
        && data.fixtures.every(r=>isCareerDate(r.date) && ['weekend','midweek'].includes(r.slot) && validateFixtureRescheduleState(r)
          && r.matches.every(m=>m.date===r.date && isCareerKickoff(m.kickoff) && m.datetime===`${m.date}T${m.kickoff}:00`))))))
    && validCareerMessages(data.inbox)
    && validateAdvancedCareer(data));
}
