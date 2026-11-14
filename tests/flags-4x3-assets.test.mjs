import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const flagsDir=join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'flags');
const files=readdirSync(flagsDir).filter(file=>file.endsWith('.svg')).sort();

test('vendored flag-icons retains all 255 country codes and subdivisions', ()=>{
 assert.equal(files.length,255);
 for(const code of ['ng','it','de','ch','np','qa','gb-eng','gb-nir','gb-sct','gb-wls','xk']){
  assert.ok(files.includes(code+'.svg'),code+' missing');
 }
});

test('every flag is 4:3 with its own native rounded mask', ()=>{
 for(const filename of files){
  const code=filename.slice(0,-4);
  const svg=readFileSync(join(flagsDir,filename),'utf8');
  const viewBox=svg.match(/viewBox=["']([^"']+)["']/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  assert.ok(viewBox&&viewBox.length===4,filename+' missing viewBox');
  assert.ok(viewBox.every(Number.isFinite),filename+' invalid viewBox');
  assert.ok(viewBox[2]>0&&viewBox[3]>0,filename+' invalid size');
  assert.ok(Math.abs(viewBox[2]/viewBox[3]-4/3)<0.0001,filename+' not 4:3');
  assert.ok(svg.includes('id="fa-flag-rounded-'+code+'"'),filename+' missing mask');
  assert.ok(svg.includes('mask="url(#fa-flag-rounded-'+code+')"'),filename+' mask not used');
  assert.match(svg,/<\/g><\/svg>\s*$/,filename+' group not closed');
  assert.doesNotMatch(svg,/<(?:script|foreignObject)\b/i,filename+' unsafe SVG element');
 }
});
