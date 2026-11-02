import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('pending source context does not clear visible panels before a committed replacement',()=>{
 const source=read('../assets/competition-page.js');
 const code=source.slice(source.indexOf('  function publishCompetitionContext('),source.indexOf('  function nextContext('));
 const events=[],window={dispatchEvent:e=>events.push(e.type)},document={documentElement:{dataset:{faSourceTransition:'true'}}};
 const sandbox={window,document,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}};
 runInNewContext(code+';globalThis.publish=publishCompetitionContext;',sandbox);
 sandbox.publish({selectedSeason:1,seasonData:null});
 assert.deepEqual(events,['fa:competition-context-pending']);
 sandbox.publish({selectedSeason:1,seasonData:{provenance:{kind:'authoritative'}}},true);
 assert.deepEqual(events,['fa:competition-context-pending','fa:competition-context-change']);
 assert.equal(document.documentElement.dataset.faSourceTransition,undefined);
});
test('DEV teardown can release listeners while retaining the last visible rows and fixtures',()=>{
 const source=read('../tools/dev-standings-preview-client.mjs');
 // Locate by name even after the cleanup accepts options.
 const start=source.indexOf('    function restore(');
 const body=source.slice(start,source.indexOf('    try {\n    committed=true;',start));
 const calls=[];const sandbox={AggregateError,restored:false,committed:true,captionI18n:null,captionText:'old',canonicalRows:[],canonicalMobile:[],
  listeners:{abort:()=>calls.push('listeners')},languageObserver:{disconnect:()=>calls.push('observer')},tooltip:{remove:()=>calls.push('tooltip')},
  restoreFixtures:()=>calls.push('fixtures'),restorePostseason:()=>calls.push('postseason'),tbody:{replaceChildren:()=>calls.push('rows')},mobileList:{replaceChildren:()=>calls.push('mobile')},
  caption:{removeAttribute(){},setAttribute(){}},window:{faAppRenderLanguage(){}}};
 runInNewContext(body+';restore({preservePresentation:true});',sandbox);
 assert.deepEqual(calls,['listeners','observer','tooltip']);
});
test('live source switching never hides competition or calendar panels',()=>{
 const server=read('../tools/dev-standings-preview.mjs');
 assert.doesNotMatch(server,/<style>html\[data-fa-dev-(?:switching|season-transition|source-pending)[^\n]+visibility:hidden/);
});

test('statistics retain their previous cards until the replacement provider has finished aggregating',()=>{
 const source=read('../assets/competition-page.js'),start=source.indexOf('const updateStats=context=>');
 const code=source.slice(start,source.indexOf("      window.addEventListener('fa:competition-context-change',event=>updateStats",start));
 const updates=[],document={documentElement:{dataset:{faSourceTransition:'true'}}};
 const sandbox={document,stats:{update:value=>updates.push(value)}};
 runInNewContext(code+';globalThis.update=updateStats;',sandbox);
 sandbox.update({seasonData:null});sandbox.update({seasonData:{statistics:null}});
 assert.deepEqual(updates,[]);
 const ready={seasonData:{statistics:{overview:{matchesPlayed:8}}}};
 sandbox.update(ready);assert.equal(updates[0],ready);
 const emptyGlobal={seasonData:null};delete document.documentElement.dataset.faSourceTransition;
 sandbox.update(emptyGlobal);assert.equal(updates[1],emptyGlobal);
});

test('a completed Season 0 transition publishes its intentional empty state',()=>{
 const source=read('../assets/competition-page.js');
 const start=source.indexOf('  function clearSeasonData('),end=source.indexOf('  function setDebugSeason(',start);
 const events=[],window={faCompetitionContext:{selectedSeason:1,seasonData:null}};
 runInNewContext(source.slice(start,end)+';clearSeasonData({committed:true});',{window,nextContext:(...args)=>events.push(args)});
 assert.deepEqual(events,[[1,null,true]]);
});
