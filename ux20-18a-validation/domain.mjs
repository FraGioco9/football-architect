import assert from 'node:assert/strict';
import {makeWorld} from '../src/data.js';
import {startCareer} from '../src/domain/career.js';

const world=makeWorld(1801,'IT');
assert.throws(
  ()=>startCareer(world,1,'   '),
  /nome|name|allenatore|manager/i,
  'startCareer must reject an empty/whitespace manager name instead of falling back'
);
console.log('UX20 18A DOMAIN PASS');
