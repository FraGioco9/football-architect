import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTrial} from '../tools/players-generation-trial.mjs';

test('#518 baseline: exact manual secondaries and explicit count remain supported',()=>{
 const base={count:2,seed:'players-518-manual',primaryNationality:'ITA',primaryPosition:'ST'};
 const empty=generateTrial({...base,secondaryPositions:[]});
 assert.ok(empty.candidates.every(p=>p.secondary_positions.length===0));
 const exact=generateTrial({...base,secondaryPositions:['AM','RW']});
 assert.ok(exact.candidates.every(p=>p.secondary_positions.join(',')==='AM,RW'));
 const number=generateTrial({...base,secondaryCount:5});
 assert.ok(number.candidates.every(p=>p.secondary_positions.length===5));
 const restricted=generateTrial({...base,secondaryCount:1,allowedSecondaries:['AM']});
 assert.ok(restricted.candidates.every(p=>p.secondary_positions.join(',')==='AM'));
 assert.deepEqual(exact,generateTrial({...base,secondaryPositions:['AM','RW']}));
});
test('#518 baseline: goalkeeper always has zero secondary positions',()=>{
 const sample=generateTrial({count:8,seed:'players-518-goalkeeper',primaryPosition:'GK',primaryNationality:'ITA'});
 assert.ok(sample.candidates.every(p=>p.secondary_positions.length===0));
 assert.throws(()=>generateTrial({count:1,primaryPosition:'GK',secondaryCount:1}),/Secondary-position count impossible/);
});
