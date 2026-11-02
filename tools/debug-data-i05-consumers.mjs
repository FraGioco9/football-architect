// I05 candidate-only bridge for protected views. Not imported by public UI.
import {validateProtectedView,projectProtectedCalendar,projectProtectedClubSchedule,projectProtectedStats,projectProtectedCompetitionHistory,projectProtectedInternational} from "./debug-data-i05-view-adapters.mjs";
export function prepareProtectedConsumers(view,cursor){
 validateProtectedView(view,cursor);
 const calendar=projectProtectedCalendar(view,cursor);
 return Object.freeze({
  calendar,
  stats:projectProtectedStats(view,cursor),
  history:projectProtectedCompetitionHistory(view,cursor),
  international:cursor.competitionId.startsWith("int-")?projectProtectedInternational(view,cursor):null,
  club:(clubId)=>projectProtectedClubSchedule(view,cursor,clubId),
  source:calendar.source,
  cursor:Object.freeze({...cursor}),
  acceptance:"UNSEALED_NOT_FOR_RUNTIME"
 });
}
