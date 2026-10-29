/** Stable versioned sporting evidence payload. A single canonical envelope is
 * shared across simulation, publication, replay, and archival verification.
 * A season number alone does not confer readiness for a new season engine.
 */
import {ApiError} from './errors.ts';
import type {TemporaryResult} from './temporary-simulation.ts';
export function sportingDayPayload(season:number,generation:string,day:number,calendarHash:string,results:readonly TemporaryResult[]){
 if(!Number.isSafeInteger(season)||season<1||!Number.isSafeInteger(day)||day<1||day>56||
  typeof generation!=='string'||generation.length!==36||!/^[a-f0-9]{64}$/.test(calendarHash)||!Array.isArray(results))
  throw new ApiError(422,'daily_evidence_invalid');
 return {schemaVersion:1 as const,season,generation,day,calendarHash,
  simulationVersion:'temporary-score-v1' as const,results};
}
