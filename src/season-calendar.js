/** Real ISO days are internal; career-relative seasons and transfer windows are displayed. */
import {validDate,validTime,sessionTime} from './simulation.js';

export function seasonOpeningYear(date){
 if(!validDate(date))throw new Error('Invalid calendar date');
 const year=Number(date.slice(0,4));
 return Number(date.slice(5,7))>=7?year:year-1;
}
export function preseasonStart(date){
 return seasonOpeningYear(date)+'-07-01';
}
export function seasonCalendar(date,startedAt=date){
 const year=seasonOpeningYear(date);
 const firstYear=seasonOpeningYear(startedAt);
 if(firstYear>year)throw new Error('Career cannot predate its beginning');
 const start=year+'-07-01';
 const seasonStart=year+'-08-15';
 const breakStart=(year+1)+'-06-01';
 const nextStart=(year+1)+'-07-01';
 const phase=date<seasonStart?'preseason':date<breakStart?'season':'offseason';
 return Object.freeze({
  season:year-firstYear+1,
  phase,
  preseasonStart:start,
  seasonStart,
  offseasonStart:breakStart,
  nextPreseasonStart:nextStart
 });
}
/** Windows include their opening instant and exclude the next-month midnight. */
export function transferMarket(date,time='08:00'){
 if(!validDate(date)||!validTime(time))throw new Error('Invalid market instant');
 const year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
 const window=month===7||month===8?'summer':month===1?'winter':null;
 const closesAt=window==='summer'?year+'-09-01T00:00':
  window==='winter'?year+'-02-01T00:00':null;
 const opensAt=window==='summer'?year+'-07-01T00:00':
  window==='winter'?year+'-01-01T00:00':null;
 // The clock is validated even though 00:00 is exactly the next day's boundary.
 return Object.freeze({open:window!==null,window,opensAt,closesAt});
}
export function transferMarketFor(state){
 return transferMarket(state.date,sessionTime(state));
}
