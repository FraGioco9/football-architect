// P17/P18 C1 acceptance contract. Deliberately verifies pre-JavaScript HTML,
// not the DOM after the async Clubs manifest has already hydrated it.
// A failure here documents a real pending first-paint requirement in #359.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../clubs/_shared/index.html',import.meta.url),'utf8');
const panel=html.match(/<div id="club-page"[^>]*>([\s\S]*?)<\/div>/)?.[1];
test('PAGE-LOAD-02 P17/P18 C1: Club identity and five view tabs exist in static HTML before manifest fetch',()=>{
 assert.ok(panel!==undefined,'canonical club-page mount exists');
 assert.match(panel,/<header[^>]+class="club-header"/,'club header must be static at first paint');
 assert.match(panel,/<h1[^>]+id="club-title"/,'club title must be static at first paint');
 const tabs=[...panel.matchAll(/<a\b[^>]*href="[^"]*\/clubs\/[^"]*\/(overview|roster|fixtures|stats|history)[^"]*"/g)];
 assert.equal(new Set(tabs.map(m=>m[1])).size,5,'all five club views must be visible before hydration');
});
