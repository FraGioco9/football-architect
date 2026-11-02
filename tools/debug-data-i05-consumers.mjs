// I05 candidate-only bridge for protected views. Not imported by public UI.
import {validateProtectedView,projectProtectedCalendar,projectProtectedClubSchedule} from "./debug-data-i05-view-adapters.mjs";
export function prepareProtectedConsumers(view,cursor){
 validateProtectedView(view,cursor);
 const calendar=projectProtectedCalendar(view,cursor);
 return Object.freeze({
  calendar,
  club:(clubId)=>projectProtectedClubSchedule(view,cursor,clubId),
  source:calendar.source,
  cursor:Object.freeze({...cursor}),
  acceptance:"UNSEALED_NOT_FOR_RUNTIME"
 });
}
