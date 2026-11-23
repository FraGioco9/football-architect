import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPlayerDetailPage} from '../tools/render-player-detail.mjs';
import {historyWords,projectPlayerSignedContracts,createPlayerHistoryView} from '../assets/player-history.mjs';
import {isAllowlistedPublicPath,planPublicFiles,publicRequestFile} from '../tools/publication-guard.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('#579 History is contracts-only in generated public page; preview disabled',()=>{
 const html=renderPlayerDetailPage(read('players/index.html'),'public');
 assert.equal(html,read('players/_shared/index.html'));
 assert.match(html,/data-detail-view="history"[^>]*aria-controls="player-detail-history-panel"/);
 assert.match(html,/get\("view"\)==="history"/);
 assert.match(html,/data-detail-panel="history" data-detail-history/);
 assert.equal((html.match(/class="app-player-history-row app-player-history-loading"/g)||[]).length,2);
 assert.match(html,/data-player-contract-rows/);
 assert.match(html,/data-player-contract-heading="3">Signed on/);
 assert.doesNotMatch(html,/data-player-history-(?:rows|title|heading|description|current)/);
 assert.doesNotMatch(html,/data-detail-view="history"[^>]*disabled/);
 const preview=renderPlayerDetailPage(read('admin/players/preview/index.html'),'preview');
 assert.equal(preview,read('admin/players/preview/player/index.html'));
 assert.match(preview,/data-detail-view="history"[^>]*disabled/);
 assert.doesNotMatch(preview,/data-detail-history/);
});

test('#579 History controller receives contract source, not Stats; failures clear contract skeleton',()=>{
 const js=read('assets/player-detail.js');
 const stats=js.slice(js.indexOf(' function ensurePlayerStats(){'),js.indexOf(' function ensurePlayerMatches(){'));
 const history=js.slice(js.indexOf(' function ensurePlayerHistory(){'),js.indexOf(' function render(){',js.indexOf(' function ensurePlayerHistory(){')));
 assert.match(stats,/fetchStats:readPlayerStatistics/);
 assert.doesNotMatch(stats,/fetchContracts/);
 assert.match(history,/fetchContracts:async number/);
 assert.match(history,/status:'not_supported'/);
 assert.doesNotMatch(history,/fetchStats|readPlayerStatistics|History unavailable/);
 assert.match(history,/\[data-player-contract-note\]/);
 assert.match(history,/\[data-player-contract-rows\]/);
 assert.match(js,/import\('\/assets\/player-history\.mjs'\)/);
 for(const locale of ['en','de','es','fr','it'])assert.equal(historyWords[locale].contractHead.length,4);
});

test('#579 History module ships in the published artifact',()=>{
 assert.equal(publicRequestFile('/assets/player-history.mjs'),'assets/player-history.mjs');
 assert.equal(isAllowlistedPublicPath('assets/player-history.mjs'),true);
 assert.ok(planPublicFiles().includes('assets/player-history.mjs'));
});

test('#579 signed events reject fabricated date, invalid duration and invalid club',()=>{
 const payload={schemaVersion:1,playerId:12,status:'available',contracts:[
  {id:2,clubKey:'IT-2',durationSeasons:3,signedAt:'2026-11-23T19:24:00.000Z'},
  {id:1,clubKey:'IT-1',durationSeasons:1,signedAt:'2026-11-22T16:00:00.000Z'}
 ]};
 assert.deepEqual(projectPlayerSignedContracts(payload).contracts.map(x=>x.id),[2,1]);
 assert.deepEqual(projectPlayerSignedContracts({...payload,status:'empty',contracts:[]}),
  {status:'empty',contracts:[]});
 assert.deepEqual(projectPlayerSignedContracts({...payload,status:'not_supported',contracts:[]}),
  {status:'not_supported',contracts:[]});
 assert.throws(()=>projectPlayerSignedContracts({...payload,contracts:[{...payload.contracts[0],signedAt:'Season 1'}]}));
 assert.throws(()=>projectPlayerSignedContracts({...payload,contracts:[{...payload.contracts[0],signedAt:'2026-02-30T10:00:00.000Z'}]}));
 assert.throws(()=>projectPlayerSignedContracts({...payload,contracts:[{...payload.contracts[0],durationSeasons:0}]}));
 assert.throws(()=>projectPlayerSignedContracts({...payload,contracts:[{...payload.contracts[0],clubKey:'XX-1'}]}));
 assert.throws(()=>projectPlayerSignedContracts({...payload,contracts:[payload.contracts[0],payload.contracts[0]]}));
 assert.throws(()=>projectPlayerSignedContracts({...payload,status:'empty'}));
});

test('#579 contract-only History controller renders the unsupported state without Stats API',async()=>{
 const node=()=>({textContent:'',hidden:true,children:[],replaceChildren(...children){this.children=children;},setAttribute(){}});
 const title=node(),headings=Array.from({length:4},node),rows=node(),note=node(),attrs={};
 const host={
  querySelector(selector){return {'[data-player-contracts-title]':title,
   '[data-player-contract-rows]':rows,'[data-player-contract-note]':note}[selector]??null;},
  querySelectorAll(selector){return selector==='[data-player-contract-heading]'?headings:[];},
  setAttribute(key,value){attrs[key]=value;}
 };
 const view=createPlayerHistoryView({host,id:12,locale:()=> 'it',
  fetchContracts:()=>({schemaVersion:1,playerId:12,status:'not_supported',contracts:[]})});
 view.render();assert.equal(attrs['aria-busy'],'true');
 await view.load();
 assert.equal(attrs['aria-busy'],'false');
 assert.equal(title.textContent,'Contratti firmati');
 assert.match(note.textContent,/firma dei contratti non è ancora disponibile/);
 assert.equal(note.hidden,false);
 assert.deepEqual(rows.children,[]);
 assert.equal(headings[3].textContent,'Data della firma');
});
