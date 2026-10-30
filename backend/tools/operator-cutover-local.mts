// Operator-only READ-ONLY readiness report for an explicitly chosen local D1 state.
// Never link accounts, grant permissions, contact remote databases or print PII.
import {openLocalDatabase} from './operator-local.mts';
import {auditOperatorCutover} from './operator-cutover-audit.mts';

export async function inspectLocalOperatorCutover(localStateDirectory:string,normalizedEmail:string){
 const handle=await openLocalDatabase(localStateDirectory);
 try{return await auditOperatorCutover(handle.db,normalizedEmail)}
 finally{await handle.close()}
}

// Intentionally no CLI entry point: invoking openLocalDatabase applies missing
// migrations. A true non-mutating audit requires an existing, schema-complete
// local persistence snapshot, which must be verified separately before enabling
// operator-facing execution.
