import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(join(root,path),'utf8');
const catalog=JSON.parse(read('clubs/_shared/manifest.json'));
const names=[...new Set(catalog.clubs.map(c=>c.fullName).filter(Boolean))];
const routes=['index.html','dashboard/index.html','calendar/index.html','settings/index.html','guide/index.html',
 'account/index.html','clubs/index.html','clubs/_shared/index.html','competitions/index.html','competitions/_shared/index.html',
 ...readdirSync(join(root,'competitions'),{withFileTypes:true}).filter(d=>d.isDirectory()&&/^(?:it|eng|es|de|fr|pt|nl|br)-[12]$|^int-[12]$/.test(d.name)).map(d=>'competitions/'+d.name+'/index.html')];

test('PAGE-LOAD-04: no full club identity embedded in any static application HTML, hidden nodes or scripts',()=>{
 assert.equal(catalog.clubs.length,320);
 assert.equal(routes.length,28,'all 18 competition pages and global shells are covered');
 for(const route of routes){
  const html=read(route);
  for(const name of names)assert.ok(!html.includes(name),route+' embeds club name '+name);
  assert.doesNotMatch(html,/\bdata-search="[^"]*"/,route+' must not embed a static club search index');
  assert.doesNotMatch(html,/\bdata-world-club="[^"]*"/,route+' must not embed known club rows');
  assert.doesNotMatch(html,/\bdata-club-crest="(?:IT|ENG|ES|DE|FR|PT|NL|BR)-\d+"/,route+' must not preload a club crest');
 }
});
test('PAGE-LOAD-04: directory error clears anonymous loading placeholders, retry can restore them',()=>{
 const client=read('assets/clubs-directory.js');
 assert.match(client,/firstSkeletons=\[\.\.\.grid\.querySelectorAll/);
 assert.match(client,/if\(next==='error'\)\{grid\.querySelectorAll\('\.nav01-skeleton-card'\)/);
 assert.match(client,/if\(next==='loading'&&!grid\.querySelector\('\.nav01-card'\)&&firstSkeletons\.length\)/);
});
