import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiError} from '../src/errors.ts';
import {proposeLifecycleTransition,type PrerequisiteEvidence} from '../src/lifecycle-policy.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const evidence:PrerequisiteEvidence={
 calendarComplete:true,drawsComplete:true,dueActivitiesComplete:true,
 resultsComplete:true,archiveComplete:true,nextSeasonSnapshotApproved:true,
};
const world=(phase:'preparing'|'active'|'closed',day:number,revision=1,seasonNumber=1)=>({
 schemaVersion:1 as const,generation,revision,seasonNumber,day,phase,
});
const rejects=(state:unknown,command:'start'|'advance'|'close'|'prepare-next',e:unknown,code='prerequisites_incomplete')=>
 assert.throws(()=>proposeLifecycleTransition(state,command,e),(err:unknown)=>
   err instanceof ApiError&&err.code===code);

test('start requires prepared season and persisted calendar/draw readiness evidence',()=>{
 const initial=world('preparing',0);
 const result=proposeLifecycleTransition(initial,'start',evidence);
 assert.deepEqual(result.after,world('active',1,2));
 assert.deepEqual(result.before,initial);
 assert.equal(initial.phase,'preparing');
 rejects(initial,'start',{...evidence,calendarComplete:false});
 rejects(initial,'start',{...evidence,drawsComplete:false});
 rejects(world('active',1),'start',evidence);
});
test('advance only one day from active 1..55 and only after due activities complete',()=>{
 for(const day of [1,15,30,55]){
  assert.deepEqual(proposeLifecycleTransition(world('active',day),'advance',evidence).after,world('active',day+1,2));
 }
 rejects(world('active',56),'advance',evidence);
 rejects(world('preparing',0),'advance',evidence);
 rejects(world('active',20),'advance',{...evidence,dueActivitiesComplete:false});
});
test('close at day 56 requires settlement of due activities, results and archives',()=>{
 assert.deepEqual(proposeLifecycleTransition(world('active',56),'close',evidence).after,world('closed',56,2));
 for(const key of ['dueActivitiesComplete','resultsComplete','archiveComplete'] as const)
  rejects(world('active',56),'close',{...evidence,[key]:false});
 rejects(world('active',55),'close',evidence);
 rejects(world('closed',56),'close',evidence);
});
test('prepare next season preserves generation, increments season and revision, and refuses absent snapshot',()=>{
 assert.deepEqual(proposeLifecycleTransition(world('closed',56,7,3),'prepare-next',evidence).after,
  world('preparing',0,8,4));
 rejects(world('closed',56),'prepare-next',{...evidence,nextSeasonSnapshotApproved:false});
 rejects(world('preparing',0),'prepare-next',evidence);
 rejects(world('closed',56,7,Number.MAX_SAFE_INTEGER),'prepare-next',evidence);
});
test('fail closed on incomplete/forged evidence, malformed world and exhausted revision',()=>{
 for(const value of [null,{},[],{...evidence,clientApproval:true},{...evidence,calendarComplete:'yes'}])
  rejects(world('preparing',0),'start',value,'invalid_prerequisites');
 rejects({...world('preparing',0),day:2},'start',evidence,'invalid_world');
 rejects(world('preparing',0,Number.MAX_SAFE_INTEGER),'start',evidence,'revision_exhausted');
 rejects(world('preparing',0),'reset' as 'start',evidence,'invalid_lifecycle_command');
});
