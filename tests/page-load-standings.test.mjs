import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ids=['it','eng','es','de','fr','pt','nl','br'].flatMap(c=>[c+'-1',c+'-2']).concat(['int-1','int-2']);
test('each competition ships blank capacity-sized desktop and mobile standings before scripts',()=>{
 for(const id of ids){
  const html=read('competitions/'+id+'/index.html'),capacity=id.startsWith('int-')?24:16;
  assert.match(html,/class="app-world-standings" data-standings-state="pending" aria-busy="true"/);
  assert.match(html,/id="app-standings-full"/);
  const body=html.match(/<tbody id="app-standings-body">([\s\S]*?)<\/tbody>/)?.[1];
  assert.equal((body.match(/<tr /g)||[]).length,capacity,id);
  assert.doesNotMatch(body,/—|No standings|data-club-crest=|<a /,id);
  const mobile=html.match(/<ol class="app-world-mobile-list" id="app-standings-compact-list">([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(mobile,id);assert.equal((mobile.match(/<li /g)||[]).length,capacity,id);
  assert.doesNotMatch(mobile,/—|No standings|data-club-crest=|<a /,id);
 }
});
test('standings have responsive pending geometry without waiting for runtime',()=>{
 const css=read('assets/app.css');
 assert.match(css,/data-standings-state="pending"/);
 assert.match(css,/@media\(max-width:620px\)[^]*data-standings-state="pending"/);
});
test('DEV first-paint guards do not hide the standings structure',()=>{
 for(const p of ['tools/dev-preview-artifact.mjs','tools/dev-standings-preview.mjs']){
  const source=read(p);
  assert.doesNotMatch(source,/<style>[^\n]*(?:\.app-world-standings|\.app-world-standing-table|#app-standings-compact-list)[^\n]*visibility:hidden/,p);
 }
});

test('failed setup ends the busy state and publishes an explicit status without inventing participants',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=read('assets/competition-page.js'),start=source.indexOf('  function setStandingsLoadState('),end=source.indexOf('  function reuseCrestHosts(',start);
 const messages=[],host={dataset:{standingsState:'pending'},setAttribute(k,v){this[k]=v}},panel={prepend:n=>messages.push(n)};
 const document={querySelector:()=>host,getElementById:()=>panel,createElement:()=>({dataset:{},setAttribute(){}})};
 runInNewContext(source.slice(start,end)+';showStandingsLoadFailure();',{document,window:{}});
 assert.equal(host['aria-busy'],'false');assert.equal(host.dataset.standingsState,'unavailable');
 assert.equal(messages.length,1);assert.equal(messages[0].dataset.appI18n,'competitionSeasonUnavailable');
});

test('a confirmed empty active season does not substitute catalogue membership',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=read('assets/competition-page.js'),start=source.indexOf('    const empty=()=>{'),end=source.indexOf('    const resetBracket=',start);
 for(const seasonNumber of [0,1]){
  let rendered=[];
  const sandbox={cleanupForm(){},definition:{category:'domestic'},activeDebugSeason:null,authoritativeWorld:{seasonNumber},window:{faCompetitionContext:{selectedSeason:1}},
   division:{clubs:Array.from({length:16},(_,i)=>({clubId:i+1}))},tbody:{replaceChildren:(...rows)=>rendered=rows},mobile:{prepare:()=>()=>{}},reuseCrestHosts(){},createStandingsRow:club=>({club}),suppliedOwned:false,
   document:{createElement:()=>({dataset:{},appendChild(){}}),getElementById:()=>({replaceChildren(){}})}};
  runInNewContext(source.slice(start,end)+';empty();',sandbox);
  assert.equal(rendered.length,seasonNumber===0?16:1);
  if(seasonNumber>0)assert.ok(rendered.every(row=>!row.club));
 }
});

test('loopback HTML serves the visible pending structure before either data source is available',async()=>{
 const {createPreviewServer}=await import('../tools/dev-standings-preview.mjs');
 const {request}=await import('node:http'),{once}=await import('node:events');
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  for(const path of ['/competitions/it-1/standings','/competitions/int-1/standings']){
   const response=await new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,headers:{Host:'127.0.0.1:2000'}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}))});req.on('error',reject);req.end()});
   assert.equal(response.status,200);assert.match(response.body,/data-standings-state="pending"/);
   assert.match(response.body,/id="app-standings-compact-list"/);
   assert.doesNotMatch(response.body,/<style>[^\n]*(?:\.app-world-standings|\.app-world-standing-table|#app-standings-compact-list)[^\n]*visibility:hidden/);
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});

test('pending crest slots reserve size without a visible badge or dashed box',()=>{
 const css=read('assets/app.css');
 assert.match(css,/\[data-standings-slot\] \.app-world-club-crest-placeholder\{border-color:transparent;background:transparent\}/);
 assert.match(css,/\[data-standings-slot\] \.app-world-club-crest-placeholder::before\{display:none\}/);
});
