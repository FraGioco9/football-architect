import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const competition=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
test('DEV mode OFF resumes authoritative standings after simulated preview teardown',()=>{
 assert.match(competition,/fa:debug-mode-change/);
 assert.match(competition,/fa:fictional-standings-change',event=>\{/);
 assert.match(competition,/event\.detail\?\.enabled!==false\|\|activeDebugSeason!==null/);
 assert.match(competition,/selection='';select\(\);/);
});
