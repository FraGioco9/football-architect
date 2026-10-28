import {ApiError} from './errors.ts';
export interface SqlResult<T=Record<string,unknown>> {results:T[];meta:{changes:number}}
export interface Statement {
 bind(...values:unknown[]):Statement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run<T=Record<string,unknown>>():Promise<SqlResult<T>>;
 all<T=Record<string,unknown>>():Promise<SqlResult<T>>;
}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<SqlResult[]>}
export function requireDatabase(value:unknown):Database {
 const db=value as Database|undefined;
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')throw new ApiError(503,'admin_unavailable');
 return db;
}
