import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/admin-calendar-clock.ts',import.meta.url),'utf8');
test('due confirmations are committed inside the same world-advance batch',()=>{
 assert.match(source,/const outstanding=events\.filter/);
 assert.match(source,/confirmations=outstanding\.sort/);
 assert.match(source,/confirmationUpdates=await Promise\.all/);
 assert.match(source,/\.\.\.confirmationGuards,/);
 assert.match(source,/\.\.\.confirmationUpdates,/);
 assert.match(source,/UPDATE world_state SET phase=/);
});
test('artifact-generating events cannot be silently consumed by the administrative clock',()=>{
 assert.match(source,/!e\.kind\.startsWith\('confirm-'\)/);
 assert.match(source,/await loadApprovedSnapshot\(\)/);
 assert.match(source,/SELECT 1 FROM seasons WHERE season_number=/);
});
