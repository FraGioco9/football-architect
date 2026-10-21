import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../assets/world-calendar.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../tools/render-world-calendar.mjs',import.meta.url),'utf8');
const model=readFileSync(new URL('../assets/world-calendar-model.js',import.meta.url),'utf8');
test('CAL-IMP-03 inline panel uses native closed disclosures, without fabricated fixtures',()=>{
 assert.match(runtime,/document\.createElement\('details'\)/);
 assert.match(runtime,/document\.createElement\('summary'\)/);
 assert.match(runtime,/replaceChildren\(\)/);
 assert.match(runtime,/Fixtures unavailable/);
 assert.match(renderer,/id="calendar-details"/);
 assert.doesNotMatch(runtime,/fetch\(|XMLHttpRequest|\.pushState\(/);
});
test('CAL-IMP-03 respects frozen model, international-first order and transition',()=>{
 assert.match(model,/internationalDays\.forEach/);
 assert.match(model,/add\(53,"FEDERATION-FINAL"/);
 assert.match(model,/add\(54,"SOVEREIGN-FINAL"/);
 assert.match(runtime,/d\.events/);
 assert.match(runtime,/transitionText/);
});
