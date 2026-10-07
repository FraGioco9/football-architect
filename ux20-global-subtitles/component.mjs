import assert from 'node:assert/strict';
import {sectionHead} from '../src/ui-components.js';

const html=sectionHead('EYEBROW','Titolo','Questo sottotitolo non deve essere renderizzato.','<button>Aziona</button>');
assert.match(html,/<h1>Titolo<\/h1>/,'page title must remain');
assert.doesNotMatch(html,/<p\b/i,'shared page header must not render a subtitle paragraph');
assert.match(html,/Aziona/,'page actions must remain');
console.log('UX20 GLOBAL SUBTITLE COMPONENT PASS');
