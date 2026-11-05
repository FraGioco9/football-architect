import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {hashText} from './auth.ts';

/** The legacy Admin throttle has separate semantics and is not mixed with Player. */
const policies={
 login:{prefix:'',windowSeconds:900,sourceLimit:30,accountLimit:5,error:'login_throttled'},
 registration:{prefix:'registration-',windowSeconds:3600,sourceLimit:10,accountLimit:3,error:'registration_throttled'},
 reset:{prefix:'reset-',windowSeconds:3600,sourceLimit:10,accountLimit:3,error:'reset_throttled'}
} as const;
export type PlayerThrottlePurpose=keyof typeof policies;

const sql=`INSERT INTO player_auth_throttles(throttle_key,window_start,attempts,expires_at) VALUES(?,?,1,?)
 ON CONFLICT(throttle_key) DO UPDATE SET
 attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
 window_start=CASE WHEN expires_at<=? THEN ? ELSE window_start END,
 expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts`;

/** Reserve source first; on rejection an account throttle must not be created. */
export async function reservePlayerAuthThrottle(db:Database,purpose:PlayerThrottlePurpose,email:string,source:string,now:number):Promise<void>{
 const policy=policies[purpose],expires=now+policy.windowSeconds;
 const reserve=(key:string)=>db.prepare(sql).bind(key,now,expires,now,now,now,now,expires).first<{attempts:number}>();
 const sourceRow=await reserve(policy.prefix+'source:'+await hashText(source));
 if(!sourceRow||sourceRow.attempts>policy.sourceLimit)throw new ApiError(429,policy.error);
 const accountRow=await reserve(policy.prefix+'account:'+await hashText(email));
 if(!accountRow||accountRow.attempts>policy.accountLimit)throw new ApiError(429,policy.error);
}
