import type {Database,Statement} from './database.ts';
/** Aborts the entire D1 batch when a security precondition is not satisfied. */
export function abortUnless(db:Database,condition:string,values:unknown[]):Statement{
 return db.prepare(`INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS(${condition})`)
  .bind('00000000-0000-4000-8000-000000000000',...values);
}
