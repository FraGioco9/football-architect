import assert from 'node:assert/strict';
import test from 'node:test';
import type {Database} from '../src/database.ts';
import {ApiError} from '../src/errors.ts';
import {hashText} from '../src/auth.ts';
import {reservePlayerAuthThrottle,type PlayerThrottlePurpose} from '../src/auth-throttle-policy.ts';

type Call={sql:string;binds:unknown[]};
function fakeDb(attempts:(number|null)[]){
 const calls:Call[]=[];
 const database={
  prepare(sql:string){return {bind(...binds:unknown[]){
   return {first:async<T>()=>{
    calls.push({sql,binds});
    const current=attempts.shift();
    return (current===null||current===undefined?null:{attempts:current}) as T|null;
   }};
  }};}
 } as unknown as Database;
 return {database,calls};
}
const email='person@example.invalid',source='192.0.2.15',now=1_800_000_000;
const configs:{purpose:PlayerThrottlePurpose;prefix:string;window:number;sourceMax:number;accountMax:number;code:string}[]=[
 {purpose:'login',prefix:'',window:900,sourceMax:30,accountMax:5,code:'login_throttled'},
 {purpose:'registration',prefix:'registration-',window:3600,sourceMax:10,accountMax:3,code:'registration_throttled'},
 {purpose:'reset',prefix:'reset-',window:3600,sourceMax:10,accountMax:3,code:'reset_throttled'},
];
const denied=(code:string)=>(e:unknown)=>e instanceof ApiError&&e.status===429&&e.code===code;

test('Player throttle namespaces, atomic SQL reservations and time windows are preserved',async()=>{
 for(const c of configs){
  const {database,calls}=fakeDb([c.sourceMax,c.accountMax]);
  await reservePlayerAuthThrottle(database,c.purpose,email,source,now);
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.sql.includes('player_auth_throttles')&&x.sql.includes('ON CONFLICT')&&x.sql.includes('RETURNING attempts')));
  assert.deepEqual(calls.map(x=>x.binds),[
   [c.prefix+'source:'+await hashText(source),now,now+c.window,now,now,now,now,now+c.window],
   [c.prefix+'account:'+await hashText(email),now,now+c.window,now,now,now,now,now+c.window]
  ]);
  assert.doesNotMatch(JSON.stringify(calls),/person@example.invalid|192\.0\.2\.15/);
 }
});
test('a rejected source does not create an account throttle',async()=>{
 for(const c of configs){
  const {database,calls}=fakeDb([c.sourceMax+1]);
  await assert.rejects(()=>reservePlayerAuthThrottle(database,c.purpose,email,source,now),denied(c.code));
  assert.equal(calls.length,1);
  const missing=fakeDb([null]);
  await assert.rejects(()=>reservePlayerAuthThrottle(missing.database,c.purpose,email,source,now),denied(c.code));
  assert.equal(missing.calls.length,1);
 }
});
test('a rejected account retains its specific 429 and does not change source ordering',async()=>{
 for(const c of configs){
  const {database,calls}=fakeDb([1,c.accountMax+1]);
  await assert.rejects(()=>reservePlayerAuthThrottle(database,c.purpose,email,source,now),denied(c.code));
  assert.equal(calls.length,2);
  const missing=fakeDb([1,null]);
  await assert.rejects(()=>reservePlayerAuthThrottle(missing.database,c.purpose,email,source,now),denied(c.code));
  assert.equal(missing.calls.length,2);
 }
});
