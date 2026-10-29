import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
export const ACCOUNT_PERMISSIONS=['admin.access','admin.world.read','admin.world.write'] as const;
export type AccountPermission=typeof ACCOUNT_PERMISSIONS[number];
export async function requireAccountPermission(db:Database,accountId:string,permission:AccountPermission):Promise<void>{
 if(!accountId||!ACCOUNT_PERMISSIONS.includes(permission))throw new ApiError(403,'permission_denied');
 const row=await db.prepare(`SELECT 1 AS granted FROM account_permissions p
 JOIN player_accounts a ON a.id=p.account_id
 WHERE p.account_id=? AND p.permission=? AND a.status='active' AND a.email_verified_at IS NOT NULL`)
 .bind(accountId,permission).first<{granted:number}>();
 if(row?.granted!==1)throw new ApiError(403,'permission_denied');
}
export async function readAccountPermissions(db:Database,accountId:string):Promise<AccountPermission[]>{
 const result=await db.prepare(`SELECT p.permission FROM account_permissions p
 JOIN player_accounts a ON a.id=p.account_id WHERE p.account_id=? AND a.status='active'
 AND a.email_verified_at IS NOT NULL ORDER BY p.permission`).bind(accountId).all<{permission:AccountPermission}>();
 return result.results.map(x=>x.permission).filter(x=>ACCOUNT_PERMISSIONS.includes(x));
}
