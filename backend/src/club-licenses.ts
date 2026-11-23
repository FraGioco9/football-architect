/** Manual Admin license custody; economy and gameplay authority are separate DRAFT work. */
import clubs from '../../data/clubs.json' with {type:'json'};
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {abortUnless,sessionGuard} from './command-guards.ts';

const canonical=new Map(clubs.map(c=>[c.countryId+'-'+c.clubId,c.primaryName] as const));
if(canonical.size!==320)throw Error('Invalid canonical club catalogue');
const catalogue=Object.freeze([...canonical].map(([clubKey,name])=>({clubKey,name}))
 .sort((a,b)=>a.clubKey.localeCompare(b.clubKey)));
const invalid=()=>new ApiError(422,'invalid_club_license');
const validAccount=(x:unknown):x is string=>typeof x==='string' && x.length>0 && x.length<=128 && !/[\s\x00-\x1f]/.test(x);
const validClub=(x:unknown):x is string=>typeof x==='string' && canonical.has(x);
type State={club_key:string;account_id:string|null;version:number;updated_at:number;email_normalized:string|null;status:string|null};
type Event={id:string;club_key:string;action:string;previous_account_id:string|null;account_id:string|null;operator_account_id:string;previous_version:number;version:number;occurred_at:number;previous_email:string|null;account_email:string|null};
const schema=async <T>(work:()=>Promise<T>):Promise<T>=>{
 try{return await work()}
 catch(error){
  if(/\bno such table:\s*(?:main\.)?club_license_(?:state|events)\b/i.test(String(error instanceof Error?error.message:error)))
   throw new ApiError(503,'club_licenses_schema_unavailable');
  throw error;
 }
};
export async function readClubLicenses(db:Database){
 return schema(async()=>{
  const states=(await db.prepare(
   'SELECT s.club_key,s.account_id,s.version,s.updated_at,a.email_normalized,a.status '+
   'FROM club_license_state s LEFT JOIN player_accounts a ON a.id=s.account_id'
  ).all<State>()).results;
  const events=(await db.prepare(
   'SELECT e.id,e.club_key,e.action,e.previous_account_id,e.account_id,e.operator_account_id,'+
   'e.previous_version,e.version,e.occurred_at,p.email_normalized AS previous_email,'+
   'a.email_normalized AS account_email FROM club_license_events e '+
   'LEFT JOIN player_accounts p ON p.id=e.previous_account_id '+
   'LEFT JOIN player_accounts a ON a.id=e.account_id '+
   'ORDER BY e.occurred_at DESC,e.id DESC LIMIT 50'
  ).all<Event>()).results;
  const map=new Map(states.map(s=>[s.club_key,s]));
  return {
   clubs:catalogue.map(c=>{
    const s=map.get(c.clubKey);
    return {...c,accountId:s?.account_id??null,
     accountEmail:s?.email_normalized??null,accountStatus:s?.status??null,
     version:s?.version??0,updatedAt:s?.updated_at??null};
   }),
   history:events.map(e=>({id:e.id,clubKey:e.club_key,action:e.action,
    previousAccountId:e.previous_account_id,accountId:e.account_id,
    previousEmail:e.previous_email,accountEmail:e.account_email,
    operatorAccountId:e.operator_account_id,previousVersion:e.previous_version,
    version:e.version,occurredAt:e.occurred_at}))
  };
 });
}
/** Limited, exact-query-shape lookup; never return credentials or unverified users. */
export async function findLicenseAccounts(db:Database,search:string){
 const params=new URLSearchParams(search);
 if(params.size!==1||params.getAll('q').length!==1)throw invalid();
 const q=params.get('q')?.trim().toLowerCase();
 if(!q||q.length<2||q.length>120||/[\x00-\x1f]/.test(q))throw invalid();
 const escaped=q.replace(/[\\%_]/g,x=>'\\'+x);
 const matches=(await db.prepare(
  "SELECT id,email_normalized FROM player_accounts WHERE status='active' "+
  "AND email_verified_at IS NOT NULL AND email_normalized LIKE ? ESCAPE '\\' "+
  "ORDER BY email_normalized LIMIT 15"
 ).bind('%'+escaped+'%').all<{id:string;email_normalized:string}>()).results;
 return {accounts:matches.map(a=>({id:a.id,email:a.email_normalized}))};
}
interface Change {clubKey:string;accountId:string|null;expectedAccountId:string|null;expectedVersion:number}
function parseChange(input:unknown):Change{
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const o=input as Record<string,unknown>;
 if(Object.keys(o).sort().join(',')!=='accountId,clubKey,expectedAccountId,expectedVersion'||
  !validClub(o.clubKey) || !(o.accountId===null||validAccount(o.accountId)) ||
  !(o.expectedAccountId===null||validAccount(o.expectedAccountId)) ||
  !Number.isSafeInteger(o.expectedVersion)||Number(o.expectedVersion)<0||Number(o.expectedVersion)>2147483646)
  throw invalid();
 return o as unknown as Change;
}
async function current(db:Database,key:string){
 return schema(()=>db.prepare('SELECT account_id,version FROM club_license_state WHERE club_key=?')
  .bind(key).first<{account_id:string|null;version:number}>());
}
async function eligible(db:Database,id:string){
 return db.prepare("SELECT id FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL")
  .bind(id).first<{id:string}>();
}
/** All guards, state change and immutable receipt commit in the same D1 batch. */
export async function changeClubLicense(db:Database,session:AdminSession,input:unknown,now:number){
 const c=parseChange(input);
 const was=await current(db,c.clubKey),old=was?.account_id??null,version=was?.version??0;
 if(old!==c.expectedAccountId||version!==c.expectedVersion)throw new ApiError(409,'stale_club_license');
 if(c.accountId===old)throw invalid();
 if(c.accountId!==null&&!await eligible(db,c.accountId))throw new ApiError(422,'license_account_ineligible');
 const action=c.accountId===null?'revoke':old===null?'assign':'replace';
 const expected=c.expectedVersion===0
  ?'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM club_license_state WHERE club_key=?)'
  :c.expectedAccountId===null
   ?'SELECT 1 FROM club_license_state WHERE club_key=? AND version=? AND account_id IS NULL'
   :'SELECT 1 FROM club_license_state WHERE club_key=? AND version=? AND account_id=?';
 const expectedArgs=c.expectedVersion===0?[c.clubKey]:
  c.expectedAccountId===null?[c.clubKey,c.expectedVersion]:[c.clubKey,c.expectedVersion,c.expectedAccountId];
 const mutation=db.prepare(
  'INSERT INTO club_license_state(club_key,account_id,version,updated_at,updated_by) VALUES(?,?,?,?,?) '+
  'ON CONFLICT(club_key) DO UPDATE SET account_id=excluded.account_id,'+
  'version=club_license_state.version+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by'
 ).bind(c.clubKey,c.accountId,c.expectedVersion+1,now,session.unified!.playerId);
 const receipt=db.prepare(
  'INSERT INTO club_license_events(id,club_key,action,previous_account_id,account_id,operator_account_id,'+
  'previous_version,version,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)'
 ).bind(crypto.randomUUID(),c.clubKey,action,old,c.accountId,session.unified!.playerId,
  c.expectedVersion,c.expectedVersion+1,now);
 try{
  await schema(()=>db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,expected,expectedArgs),
   ...(c.accountId===null?[]:[abortUnless(db,
    "SELECT 1 FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL",[c.accountId])]),
   mutation,receipt
  ]));
 }catch{
  const fresh=await current(db,c.clubKey);
  if((fresh?.account_id??null)!==c.expectedAccountId||(fresh?.version??0)!==c.expectedVersion)
   throw new ApiError(409,'stale_club_license');
  if(c.accountId!==null&&!await eligible(db,c.accountId))
   throw new ApiError(422,'license_account_ineligible');
  throw new ApiError(503,'club_license_unavailable');
 }
 return {clubKey:c.clubKey,accountId:c.accountId,version:c.expectedVersion+1,action,occurredAt:now};
}
