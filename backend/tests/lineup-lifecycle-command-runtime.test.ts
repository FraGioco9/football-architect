import {describe,it,expect} from 'vitest';
import type {Database,Statement} from '../src/database.ts';
import type {WorldV1} from '../src/types.ts';
import {buildLineupLifecycleBatchV1} from '../src/lineup-lifecycle-command.ts';

const generation='11111111-1111-4111-8111-111111111111';
const world:WorldV1={schemaVersion:1,generation,revision:17,seasonNumber:1,day:12,phase:'active'};
function fake(){
 const prepared:{sql:string;args:unknown[]}[]=[];
 const database={
  prepare(sql:string){
   const q={sql,args:[] as unknown[],bind(...args:unknown[]){this.args=args;return this}};
   prepared.push(q);return q;
  },
  batch(){throw Error('assembly must not execute transactions')}
 };
 return {db:database as unknown as Database,prepared};
}
const session={
 actor:{id:'admin-operator',email:'operator@example.invalid'},digest:'d',credentialVersion:1,
 csrfDigest:'c',unified:{playerId:'user-1',sessionDigest:'signed-session',csrfDigest:'signed-csrf'}
};
function create(db:Database){
 const statement=(sql:string):Statement=>db.prepare(sql);
 const proposal={command:'advance',before:world,after:{...world,day:13,revision:18}};
 const evidence={authorityGuards:[statement('AUTHORITY_GUARD')],
  schedule:{season:1},
  season:{generation,participants_hash:'a'.repeat(64),rules_hash:'b'.repeat(64),
   snapshot_json:'{}'},
  snapshot:{participantsHash:'a'.repeat(64),rulesHash:'b'.repeat(64)},
  calendar:{calendar_version:'season-v1',calendar_hash:'c'.repeat(64),calendar_json:'{}'},
  draws:[{competition_id:'int-1',stage_id:'league',algorithm_version:'season-v1',
   seed:'x',outcome_hash:'d'.repeat(64),outcome_json:'{}'},
   {competition_id:'int-2',stage_id:'league',algorithm_version:'season-v1',
    seed:'x',outcome_hash:'e'.repeat(64),outcome_json:'{}'}]
 } as any;
 const planned={
  day:13,matchCount:1,
  nextProgression:{lastDay:13},
  dayEvidence:{payload:{simulationVersion:'temporary-lineup-v1',results:[{}]}},
  guards:[statement('MATCH_SOURCE_GUARD')],
  writes:[statement('INSERT INTO season_knockout_ties TEST'),
   statement('INSERT INTO match_lineup_result_receipts TEST'),
   statement('INSERT INTO season_lineup_day_outcomes TEST')],
 } as any;
 return {proposal,evidence,planned};
}
describe('#613 protected single-engine lifecycle atomic batch',()=>{
 it('stages all guards, newly resolved ties, match receipts, V2 day, world and audit in strict order',()=>{
  const {db,prepared}=fake(),{proposal,evidence,planned}=create(db);
  const prefix=[db.prepare('PRIOR_DAY_AND_MATCH_GUARD')];
  const statements=buildLineupLifecycleBatchV1(db,session as any,123456,world,
   proposal as any,evidence,prefix,planned,'op-1','key-1','req-1');
  const sql=statements.map(q=>prepared.find(p=>p===q)?.sql??'');
  const order=[
   'PRIOR_DAY_AND_MATCH_GUARD','MATCH_SOURCE_GUARD',
   'INSERT INTO season_knockout_ties TEST',
   'INSERT INTO match_lineup_result_receipts TEST',
   'INSERT INTO season_lineup_day_outcomes TEST',
   'UPDATE world_state SET revision=revision+1',
   'INSERT INTO admin_operations('
  ];
  let previous=-1;
  for(const token of order){
   const index=sql.findIndex(s=>s.includes(token));
   expect(index).toBeGreaterThan(previous);previous=index;
  }
  expect(sql[0]).toContain('INSERT INTO world_state');
  expect(sql.some(s=>s.includes('season_admin_events'))).toBe(true);
  expect(sql.some(s=>s.includes('season_calendars'))).toBe(true);
  const audit=prepared.find(q=>q.sql.includes('INSERT INTO admin_operations('))!;
  expect(audit.args.at(-2)).toBe(JSON.stringify({
   world:proposal.after,operationId:'op-1'
  }));
  expect(audit.args.at(-1)).toBe(123456);
 },10000);

 it('rejects tampered destination day, switched algorithm and failed readiness before a batch',()=>{
  const {db}=fake(),{proposal,evidence,planned}=create(db);
  const assemble=(p=planned,prop=proposal)=>buildLineupLifecycleBatchV1(
   db,session as any,123456,world,prop as any,evidence,[],p,
   'op-1','key-1','req-1');
  expect(()=>assemble({...planned,day:14})).toThrow();
  expect(()=>assemble({...planned,dayEvidence:{
   payload:{simulationVersion:'temporary-score-v1',results:[{}]}
  }})).toThrow();
  expect(()=>assemble({...planned,matchCount:2})).toThrow();
  expect(()=>assemble(planned,{...proposal,after:{...world,day:15,revision:18}}))
   .toThrow();
 },10000);
});
