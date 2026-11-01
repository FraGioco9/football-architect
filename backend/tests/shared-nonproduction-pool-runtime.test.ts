import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import type {Database} from '../src/database.ts';
const binding=env as any,db=binding.DB as Database;
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS)});
const call=(mode:string,path='/api/player/session')=>{
 const origin=mode==='local'?'http://app.localhost:2000':'https://preview.example.invalid';
 return worker.fetch(new Request(origin+path,{headers:{'CF-Connecting-IP':'192.0.2.10'}}),{...binding,PLAYER_MODE:mode,PLAYER_ORIGIN:origin,PLAYER_TRUSTED_SOURCE:'cloudflare'});
};
it('unbound Preview fails closed while legacy unbound local and Production retain compatibility',async()=>{
 expect((await call('preview','/api/environment')).status).toBe(503);
 expect((await call('preview')).status).toBe(503);
 expect((await call('local')).status).toBe(401);
 expect((await call('production')).status).toBe(401);
});
it('Production-stamped data cannot be opened by local or Preview modes, including anonymous world',async()=>{
 await db.prepare("INSERT INTO account_environment_pool VALUES(1,'production',1)").run();
 expect((await call('production')).status).toBe(401);
 for(const mode of ['local','preview'])for(const path of ['/api/player/session','/api/admin/world','/api/world','/api/competitions/IT-1/seasons/1','/api/calendar/seasons/1/days/1'])expect((await call(mode,path)).status).toBe(503);
});
