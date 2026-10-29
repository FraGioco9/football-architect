/** Server-only trusted loader. No browser, environment, DEV or candidate supplies approval. */
import clubs from '../../data/clubs.json' with {type:'json'};
import divisions from '../../data/divisions.json' with {type:'json'};
import cups from '../../data/international-competitions.json' with {type:'json'};
import calendarModel from '../../assets/world-calendar-model.js';
import approval from '../catalogues/season-1.approval.json' with {type:'json'};
import {ApiError} from './errors.ts';
import {legacySeasonOneRules,assertCalendarMappings} from './calendar-rules-compat.ts';
import {canonicalHash,validateApprovedSeasonOneSnapshot,type ApprovedSnapshot,type CanonicalCatalogue} from './catalogue-snapshot.ts';

// Independently Python-reconciled immutable owner decision on the complete 8126da1 review package.
const approvedRecordHash='590b4f816eb8c98ec2d82944975ebab7b83570e8dd067086d0e633c79308c99b';

/** Validate approval against independent server-owned full catalogues and canonical calendar projection. */
export async function validateProductionSeasonOneApproval(input:unknown,catalogue:CanonicalCatalogue,calendar:unknown):Promise<ApprovedSnapshot>{
 try{
  if(await canonicalHash(input)!==approvedRecordHash)throw new ApiError(422,'catalogue_not_approved');
  const record=input as typeof approval;
  if(await canonicalHash(calendar)!==record.calendarHash)throw new ApiError(422,'catalogue_not_approved');
  return await validateApprovedSeasonOneSnapshot(record.manifest,catalogue);
 }catch{throw new ApiError(422,'catalogue_not_approved')}
}

/** Canonical identities and full sporting rules, independent of seasonal membership. */
export function serverCanonicalCatalogue():CanonicalCatalogue{
 assertCalendarMappings(divisions);
 const compatibilityDivisions=legacySeasonOneRules(divisions);
 return {
  clubIds:clubs.map(c=>`${c.countryId}-${c.clubId}`),
  competitions:[...compatibilityDivisions,...cups].map(c=>({id:c.id,rulesVersion:c.rules.version,rules:JSON.parse(JSON.stringify(c.rules))})),
 };
}
export async function loadApprovedSnapshot():Promise<ApprovedSnapshot>{
 const catalogue=serverCanonicalCatalogue();
 // Copy design event markers only; this creates no fixtures, results, season state or database writes.
 const calendar=JSON.parse(JSON.stringify(calendarModel.createSeason(1)));
 return validateProductionSeasonOneApproval(approval,catalogue,calendar);
}
