import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('competition view buttons are never hidden pending a nonexistent tabs-restored flag',()=>{
 const server=read('../tools/dev-standings-preview.mjs');
 assert.doesNotMatch(server,/html:not\(\[data-fa-tabs-restored/);
 assert.match(server,/standings-client\.mjs/);
});
test('Debug OFF uses global world clock and active Debug preserves local clock',()=>{
 const calendar=read('../assets/world-calendar.js');
 assert.match(calendar,/devClockEnabled\?/);
 assert.match(calendar,/publicWorld\?\.seasonNumber>0/);
 assert.match(calendar,/fa:debug-mode-change/);
 const competition=read('../assets/competition-page.js');
 assert.match(competition,/activeDebugSeason===null/);
 assert.match(competition,/createAuthoritativeLoader/);
 const debug=read('../tools/dev-preview-artifact.mjs');
 assert.match(debug,/football-architect:local-debug-visible/);
});
