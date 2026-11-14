// C3.2b — executable real-Rapier CLI evidence is opt-in and read-only.
// This is a bounded 3-tick smoke contract, not proof of a second shoe START.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const fixture={id:'season:1:IT-1:N01:IT-1:IT-2',
 competitionId:'IT-1',marker:'N01',day:1,round:1,
 homeClubId:'IT-1',awayClubId:'IT-2'};
const scenario={preset:'roll',seed:'c3-2b-cli-evidence',
 x:-4.96,y:0,z:0,vx:0.3,vy:0,vz:0};
const run=extra=>spawnSync(process.execPath,
 ['tools/physical-fixture-runner.mjs'],{
  cwd,encoding:'utf8',timeout:30000,
  input:JSON.stringify({fixture,scenario,ticks:3,...extra})
 });
const parse=proc=>{
 assert.equal(proc.status,0,proc.stderr||proc.stdout);
 return JSON.parse(proc.stdout);
};

test('C3.2b CLI real Rapier opt-in reports read-only carry evidence deterministically',()=>{
 const arg={autonomousActions:true,autonomousCarry:true};
 const a=parse(run(arg)),b=parse(run(arg));
 assert.deepEqual(a,b,'identical Rapier runs must produce the same evidence');
 assert.equal(a.autonomousCarryMode,true);
 assert.equal(a.physicalRapierStep,true);
 assert.equal(a.ticks,3);
 assert.equal(a.localAutonomousActionTypes.carry>=0,true);
 assert.equal(a.physicalCarryDiagnostics.schemaVersion,1);
 assert.equal(a.physicalCarryDiagnostics.readOnly,true);
 assert.equal(a.physicalCarryDiagnostics.dribbleConfirmed,null);
 assert.equal(a.physicalCarryDiagnostics.officialMatchResult,null);
 assert.equal(a.officialMatchResult,null);
 assert.equal(a.productionScoringConnected,false);
 assert.ok(Number.isSafeInteger(
  a.physicalCarryDiagnostics.verifiedGroundCarryRecontacts));
});

test('C3.2b CLI ordinary mode cannot accidentally enable carry evidence',()=>{
 const normal=parse(run({autonomousActions:true}));
 assert.equal(Object.hasOwn(normal,'autonomousCarryMode'),false);
 assert.equal(Object.hasOwn(normal,'physicalCarryDiagnostics'),false);
 assert.equal(Object.hasOwn(normal.localAutonomousActionTypes,'carry'),false);
});

test('C3.2b CLI rejects implicit, disabled and malformed physical-carry flags',()=>{
 for(const extra of [
  {autonomousCarry:true},
  {autonomousActions:true,autonomousCarry:false},
  {autonomousActions:true,autonomousCarry:'true'},
  {autonomousActions:true,autonomousCarry:true,invalid:true}
 ]){
  const process=run(extra);
  assert.notEqual(process.status,0);
  assert.match(process.stderr,/requires explicit|Only fixture/);
 }
});
