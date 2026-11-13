import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CLUB-ROSTER-01 first paint exposes Overview/Attributes without a redundant Roster heading',()=>{
 const html=read('clubs/_shared/index.html'),generator=read('tools/generate-club-pages.mjs');
 assert.match(html,/class="club-roster club-first-paint-roster" aria-busy="true" data-roster-mode="overview" hidden/);
 assert.match(html,/app-players-table club-roster-table/);
 assert.match(html,/data-club-roster-view="overview"/);
 assert.match(html,/data-club-roster-view="attributes"/);
 for(const group of ['technical','mental','physical','goalkeeping']){
  assert.match(html,new RegExp('data-club-roster-group="'+group+'"'));
  assert.match(generator,/club-roster-groups/);
 }
 assert.match(html,/data-club-roster-label="5"/);
 assert.equal((html.match(/class="app-players-loading-row"/g)||[]).length,5);
 assert.match(html,/roster\.hidden=view!=='roster'/);
 assert.match(generator,/roster\.hidden=view!=='roster'/);
 assert.doesNotMatch(html,/<h2 data-club-roster-title>|<h2>Roster<\/h2>/);
 assert.doesNotMatch(html,/data-club-roster-pagination|class="club-roster-pagination"/);
});
test('CLUB-ROSTER-01 keeps all current players, across five locales and both subviews',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected={countryId:'IT',clubId:1,view:'roster',base:'/clubs/it/1'};
 const attrs=Object.fromEntries('speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ').map((key,i)=>[key,i+21]));
 const players=Array.from({length:65},(_,i)=>({
  id:i+1,display_name:i===0?'<Private & Name>':'Player '+(i+1),
  nationality:'ITA',age:17,primary_position:'CM',secondary_positions:['DM'],
  height_cm:180,preferred_foot:'left',attributes:attrs
 }));
 const snapshot={source:'ready',clubKey:'IT-1',count:65,players};
 const locales=['en','de','es','fr','it'];
 const expectedOverview={en:'Overview',de:'Übersicht',es:'Resumen',fr:'Vue d’ensemble',it:'Panoramica'};
 const expectedAttributes={en:'Attributes',de:'Attribute',es:'Atributos',fr:'Attributs',it:'Attributi'};
 for(const language of locales){
  const html=model.render(manifest,selected,language,'',null,1,null,snapshot);
  assert.equal((html.match(/class="club-roster-player-link"/g)||[]).length,65,language);
  assert.equal((html.match(/<tr><td>/g)||[]).length,65,language);
  assert.match(html,/href="\/players\/1"/);
  assert.match(html,/href="\/players\/65"/);
  assert.match(html,/&lt;Private &amp; Name&gt;/);
  assert.match(html,/CM, DM/);
  assert.match(html,new RegExp('>'+expectedOverview[language]+'<'));
  assert.match(html,new RegExp('>'+expectedAttributes[language]+'<'));
  assert.doesNotMatch(html,/club-empty|pagination|pageSize|development_aptitude|initial_age|<h2>Roster/);
  assert.ok(html.includes('65 '),language);
  for(const [group,length] of [['technical',11],['mental',7],['physical',7],['goalkeeping',7]]){
   const rendered=model.render(manifest,selected,language,'?view=attributes&group='+group,null,1,null,snapshot);
   assert.match(rendered,/data-roster-mode="attributes"/);
   assert.match(rendered,new RegExp('data-roster-group="'+group+'"'));
   assert.match(rendered,/CM, DM/);
   assert.equal((rendered.match(/class="club-roster-player-link"/g)||[]).length,65,language+'/'+group);
   assert.equal((rendered.match(/<th scope="col"/g)||[]).length,length,language+'/'+group);
   assert.ok(rendered.includes('>'+({technical:25,mental:33,physical:21,goalkeeping:37}[group])+'</td>'),language+'/'+group);
  }
 }
 const empty=model.render(manifest,selected,'en','',null,1,null,{source:'ready',clubKey:'IT-1',count:0,players:[]});
 assert.match(empty,/No players are currently assigned/);
 const pending=model.render(manifest,selected,'en','?view=attributes&group=technical',null,1,null,{source:'loading'});
 assert.equal((pending.match(/app-players-loading-row/g)||[]).length,5);
 assert.match(pending,/colspan="11"/);
 assert.doesNotMatch(pending,/No players are currently assigned/);
 const failed=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable'});
 assert.match(failed,/temporarily unavailable/);
 const missing=model.render(manifest,selected,'en','',null,1,null,{source:'unavailable',status:404});
 assert.match(missing,/Restart the local development server/);
});
test('CLUB-ROSTER-01 keeps subview switching local and explains Worker route mismatch',()=>{
 const js=read('assets/club-page.js');
 assert.match(js,/data-club-roster-view/);
 assert.match(js,/data-club-roster-group/);
 assert.match(js,/const queryOnly=selected\.view==='roster'&&next\.view==='roster'/);
 assert.match(js,/if\(!queryOnly\)refreshClubRoster/);
 assert.match(js,/status:Number\.isSafeInteger\(error\?\.status\)/);
});
