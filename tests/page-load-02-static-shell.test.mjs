import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const views=['standings','postseason','fixtures','stats','history','rules','awards'];
const competitions=['it','eng','es','de','fr','pt','nl','br'].flatMap(country=>[country+'-1',country+'-2']).concat(['int-1','int-2']);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PAGE-LOAD-02: all competition tablists are present before API-dependent panels in initial HTML',()=>{
 for(const id of competitions){
  const html=read('competitions/'+id+'/index.html');
  const start=html.indexOf('<section id="app-divisions"');
  const header=html.indexOf('<header class="app-competition-header"',start);
  const rail=html.indexOf('<div class="app-competition-tabs"',start);
  const seasonStatus=html.indexOf('id="app-competition-season-unavailable"',start);
  const firstPanel=html.indexOf('id="competition-panel-standings"',start);
  assert.ok(start>=0&&rail>start&&header>rail&&seasonStatus>header&&firstPanel>seasonStatus,id+': static shell order');
  for(const view of views){
   assert.equal(html.split('id="competition-tab-'+view+'"').length-1,1,id+': unique '+view+' tab');
   assert.equal(html.split('id="competition-panel-'+view+'"').length-1,1,id+': unique '+view+' panel');
  }
  assert.ok(html.indexOf('data-competition-view',0)<rail,id+': view selected before body parse');
 }
});

test('PAGE-LOAD-02: Clubs has permanent cards before manifest hydration',()=>{
 const html=read('clubs/index.html');
 const cards=[...html.matchAll(/<a class="nav01-card"/g)];
 assert.equal(cards.length,320);
 assert.ok(html.indexOf('class="nav01-grid"')<cards[0].index);
 assert.ok(!html.includes('Loading clubs…</p></div>'));
});
