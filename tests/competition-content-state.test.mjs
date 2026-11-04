import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const module={exports:{}};
runInNewContext(read('assets/standings-loading.js'),{module});
const {confirmedEmpty}=module.exports;
const context={selectedSeason:2,revision:6};
const panel={dataset:{faContentState:'empty',faContentSeason:'2',faContentRevision:'6'}};
test('skip skeleton only for known empty current season/revision',()=>{
 assert.equal(confirmedEmpty(panel,context,{season:'2'}),true);
 assert.equal(confirmedEmpty(panel,context,{season:'3'}),false);
 assert.equal(confirmedEmpty(panel,{...context,revision:7},{season:'2'}),false);
 assert.equal(confirmedEmpty(panel,{...context,selectedSeason:3},{season:'3'}),false);
 assert.equal(confirmedEmpty({...panel,dataset:{...panel.dataset,faContentState:'unknown'}},context,{season:'2'}),false);
 assert.equal(confirmedEmpty(null,context,{season:'2'}),false);
});
test('presenters require concrete absence instead of missing responses',()=>{
 assert.match(read('assets/competition-fixtures.js'),/data\.fixtures===null/);
 assert.match(read('assets/competition-fixtures.js'),/available&&\(\(international/);
 assert.match(read('assets/competition-stats.js'),/matchesPlayed===0/);
 assert.match(read('assets/competition-awards.js'),/sameSeason&&allPending/);
 assert.match(read('assets/app.css'),/data-fa-content-state="empty"/);
});
