import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/authoritative-season.mjs',import.meta.url),'utf8');
test('authoritative loader preserves committed tables until new global snapshot validates',()=>{
 const start=source.indexOf('export function createAuthoritativeLoader(');
 const block=source.slice(start);
 assert.ok(start>=0);
 assert.doesNotMatch(block,/clear\(\);onState\('loading'\)/);
 assert.match(block,/commit\(adaptAuthoritativeSeason\(/);
 assert.match(block,/sameWorld\(before\.world,source\.world\)/);
});
