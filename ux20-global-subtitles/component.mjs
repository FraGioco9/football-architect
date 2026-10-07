import assert from 'node:assert/strict';
import {sectionHead} from '../src/ui-components.js';

const html=sectionHead('EYEBROW','Titolo','Questo sottotitolo non deve essere renderizzato.','<button>Aziona</button>');
assert.match(html,/<h1>Titolo<\/h1>/,'page title must remain');
assert.doesNotMatch(html,/<p\b/i,'shared page header must not render a subtitle paragraph');
assert.match(html,/Aziona/,'page actions must remain');
console.log('UX20 GLOBAL SUBTITLE COMPONENT PASS');


import {makeWorld} from '../src/data.js';
import {startCareer} from '../src/domain/career.js';
import {matchPreviewPage} from '../src/match-preview-ui.js';

const world=makeWorld(202,'IT');
startCareer(world,1,'Subtitle Contract');
const fixture=world.fixtures[0].matches[0];
const playback={record:{matchId:fixture.id,homeTeamId:fixture.home,awayTeamId:fixture.away,matchSeed:1,events:[]},cursor:0,paused:true,speed:1};
const preview=matchPreviewPage(world,playback,'it');
assert.match(preview,/class="match-preview-schedule"/,'Match Preview schedule metadata must remain');
assert.doesNotMatch(preview,/Solo dimostrazione:/,'Match Preview descriptive subtitle must be removed');
console.log('UX20 GLOBAL MATCH PREVIEW SUBTITLE PASS');
