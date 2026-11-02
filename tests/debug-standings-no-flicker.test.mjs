import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Debug update keeps current table while replacement data is prepared',()=>{
 const dev=source('../tools/dev-standings-preview-client.mjs');
 const start=dev.indexOf('function syncSeason(){');
 const end=dev.indexOf('if(validPath)refreshSeason=syncSeason',start);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(dev.slice(start,end),/faCompetitionContextApi\?\.clearSeasonData\(\)/);
 assert.doesNotMatch(source('../tools/dev-debug-widget.mjs'),/location\.reload\(/);
});
test('global standings fetch waits for DEV teardown signal',()=>{
 const competition=source('../assets/competition-page.js');
 assert.match(competition,/fa:fictional-standings-change',event=>\{/);
 assert.match(competition,/event\.detail\?\.enabled!==false\|\|activeDebugSeason!==null/);
 assert.match(competition,/selection='';select\(\)/);
});
