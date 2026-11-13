import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CLUB-ROSTER-01 reserves full table geometry at synchronous first paint',()=>{
 const html=read('clubs/_shared/index.html');
 const generator=read('tools/generate-club-pages.mjs');
 assert.match(html,/class="club-roster club-first-paint-roster" aria-busy="true" hidden/);
 assert.match(html,/app-players-table club-roster-table/);
 assert.match(html,/data-club-roster-label="5"/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.match(html,/roster\.hidden=view!=='roster'/);
 assert.match(generator,/roster\.hidden=view!=='roster'/);
 assert.match(html,/data-club-roster-title/);
 assert.doesNotMatch(html,/data-club-roster-pagination|class="club-roster-pagination"/);
});
test('CLUB-ROSTER-01 renders complete current members and name-only links for all five locales',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const players=Array.from({length:65},(_,i)=>({
  id:i+1,display_name:i===0?'<Private & Name>':'Player '+(i+1),
  nationality:'ITA',age:17,primary_position:'CM',secondary_positions:['DM'],
  height_cm:180,preferred_foot:'left'
 }));
 const snapshot={source:'ready',clubKey:'IT-1',count:65,players};
 const locales=['en','de','es','fr','it'];
 for(const language of locales){
  const html=model.render(manifest,selected,language,'',null,1,null,snapshot);
  assert.equal((html.match(/class="club-roster-player-link"/g)||[]).length,65,language);
  assert.equal((html.match(/<tr><td>/g)||[]).length,65,language);
  assert.match(html,/href="\/players\/1"/);
  assert.match(html,/href="\/players\/65"/);
  assert.match(html,/&lt;Private &amp; Name&gt;/);
  assert.match(html,/CM, DM/);
  assert.doesNotMatch(html,/club-empty|pagination|pageSize|development_aptitude|initial_age/);
  assert.ok(html.includes('65 '),language);
 }
 const empty=model.render(manifest,selected,'en','',null,1,null,{source:'ready',clubKey:'IT-1',count:0,players:[]});
 assert.match(empty,/No players are currently assigned/);
 const pending=model.render(manifest,selected,'en','',null,1,null,{source:'loading'});
 assert.equal((pending.match(/app-players-loading-row/g)||[]).length,5);
 assert.doesNotMatch(pending,/No players are currently assigned/);
 const failed=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable'});
 assert.match(failed,/temporarily unavailable/);
});
