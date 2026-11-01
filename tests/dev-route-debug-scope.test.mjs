import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
test('DEV public route survives Debug popup injection outside path-resolution branch',()=>{
 assert.match(server,/let body, type, file;/);
 assert.match(server,/file = publicRequestFile\(/);
 assert.doesNotMatch(server,/const file = publicRequestFile\(/);
 assert.match(server,/file==="competitions\/index\.html"/);
 assert.match(server,/debug-global\.mjs/);
});
