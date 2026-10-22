import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../assets/calendar-simplified.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
test('CAL-MOBILE-HOVER-01 marker pointer tooltip only on fine hover mouse',()=>{
 assert.match(script,/pointerenter',event=>\{if\(event\.pointerType!=='mouse'\|\|!window\.matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)\.matches\)return/);
});
test('CAL-MOBILE-HOVER-02 touch focus cannot trigger marker tooltip',()=>{
 assert.match(script,/focusin',\(\)=>\{if\(!window\.matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)\.matches\)return/);
});
test('CAL-MOBILE-HOVER-03 touch hover styles and tooltip hidden',()=>{
 assert.match(css,/@media\(hover:none\),\(pointer:coarse\)\{\.calendar-event:hover\{filter:none;outline:none\}\.calendar-marker-tooltip\{display:none!important\}\}/);
});
test('CAL-MOBILE-HOVER-04 popup click interaction and keyboard labels preserved',()=>{
 assert.match(script,/window\.faCalendarShowDay=day=>showDay\(day,day\)/);
 assert.match(script,/marker\.setAttribute\('aria-label',description\)/);
 assert.match(script,/marker\.addEventListener\('click',\(\)=>\{tooltip\.hidden=true\}\)/);
});
