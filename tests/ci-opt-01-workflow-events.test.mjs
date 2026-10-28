// Execute the checked-in workflow shell, not a reimplementation of its conditions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

const workflows=['landing-checks.yml','int24-browser-qa.yml'];
const read=name=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
function stepScript(source,name){
 const lines=source.split('\n');
 const start=lines.indexOf('      - name: '+name);
 assert.ok(start>=0,'Missing workflow step: '+name);
 const next=lines.findIndex((line,i)=>i>start&&/^      - (?:name:|uses:)/.test(line));
 const end=next<0?lines.length:next;
 const run=lines.findIndex((line,i)=>i>start&&i<end&&line==='        run: |');
 assert.ok(run>start,'Missing multiline shell: '+name);
 const body=[];
 for(const line of lines.slice(run+1)){
  if(!line.startsWith('          '))break;
  body.push(line.slice(10));
 }
 assert.ok(body.length,'Empty workflow shell');
 return body.join('\n');
}
test('workflow extraction cannot execute a later step when the named step loses its multiline run',()=>{
 const fixture='      - name: Expected\n        run: echo inline\n      - name: Later\n        run: |\n          echo unrelated';
 assert.throws(()=>stepScript(fixture,'Expected'),/Missing multiline shell/);
});
function render(script,values){
 return script.replace(/\$\{\{\s*([^}]*?)\s*\}\}/g,(_,key)=>{
  key=key.trim();assert.ok(Object.hasOwn(values,key),'Unmapped expression: '+key);
  return values[key];
 });
}
function temporary(run){
 const root=mkdtempSync(join(tmpdir(),'fa-workflow-events-'));
 try{return run(root)}finally{rmSync(root,{recursive:true,force:true})}
}
function git(root,...args){
 return execFileSync('git',['-c','user.name=CI fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

for(const workflow of workflows){
 test(workflow+': real Draft diff selects FAST/TARGETED/FULL; review/main require FULL',()=>temporary(root=>{
  git(root,'init','-q');writeFileSync(join(root,'baseline'),'fixture');git(root,'add','.');git(root,'commit','-qm','base');
  const base=git(root,'rev-parse','HEAD');
  mkdirSync(join(root,'guide'));writeFileSync(join(root,'guide/index.html'),'fixture');git(root,'add','.');git(root,'commit','-qm','guide');
  mkdirSync(join(root,'tools'));
  writeFileSync(join(root,'tools/ci-opt-01-impact.mjs'),readFileSync(new URL('../tools/ci-opt-01-impact.mjs',import.meta.url)));
  const script=stepScript(read(workflow),'Classify fast-safe changes');
  const output=join(root,'output');
  for(const [event,draft,baseSha,expected] of [
   ['pull_request','true',base,'targeted'],
   ['pull_request','false',base,'full'],
   ['push','', '', 'full'],
   ['pull_request','true','invalid','full']
  ]){
   writeFileSync(output,'');
   const result=spawnSync('bash',['-e','-o','pipefail','-c',render(script,{
    'github.event_name':event,'github.event.pull_request.draft':draft
   })],{cwd:root,env:{...process.env,GITHUB_EVENT_NAME:event,PR_BASE_SHA:baseSha,GITHUB_OUTPUT:output},encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   const fields=Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(x=>x.split('=')));
   assert.equal(fields.mode,expected,event+'/'+draft+'/'+baseSha);
   if(expected==='targeted'){assert.equal(fields.area,'guide');assert.equal(fields.tests,'tests/guide.test.mjs')}
  }
  // A docs-only real diff remains FAST even when earlier area commits exist.
  const docsBase=git(root,'rev-parse','HEAD');
  mkdirSync(join(root,'docs'));writeFileSync(join(root,'docs/check.md'),'fixture');git(root,'add','docs');git(root,'commit','-qm','docs');
  writeFileSync(output,'');
  execFileSync('bash',['-e','-o','pipefail','-c',render(script,{'github.event_name':'pull_request','github.event.pull_request.draft':'true'})],{
   cwd:root,env:{...process.env,GITHUB_EVENT_NAME:'pull_request',PR_BASE_SHA:docsBase,GITHUB_OUTPUT:output}
  });
  assert.match(readFileSync(output,'utf8'),/^mode=fast$/m);
 }));
}

function browserCommands({event='pull_request',mode='full',area='',css=false,base='a'.repeat(40),failFull=false}={}){
 return temporary(root=>{
  const bin=join(root,'bin'),record=join(root,'calls');mkdirSync(bin);writeFileSync(record,'');
  const executable=(name,source)=>writeFileSync(join(bin,name),'#!/bin/sh\n'+source,{mode:0o755});
  executable('node',`[ "$1" != tools/dev-standings-preview.mjs ] || exit 0
printf '%s|%s|%s|%s\\n' "$*" "\${FA_BROWSER_ENGINE:-chromium}" "\${FA_TARGET_AREA:-}" "\${PR_BASE_SHA:-}" >> "$FA_RECORD"
if [ "$1" = tests/clean-ui-03-css-parity.mjs ]; then
  [ "\${PR_BASE_SHA:-}" = "$FA_EXPECTED_BASE" ] || exit 77
fi
if [ "$1" = tests/int24-browser-qa.mjs ] && [ "$FA_FAIL_FULL" = 1 ]; then exit 42; fi
`);
  executable('curl','exit 0\n');
  executable('git',`for arg do
 if [ "$arg" = '*.css' ] && [ "$FA_CSS_CHANGED" = 1 ]; then printf 'assets/app.css\\n'; fi
done
exit 0
`);
  const script=render(stepScript(read('int24-browser-qa.yml'),'Run loopback preview and browser checks'),{
   'github.event_name':event,'github.event.pull_request.base.sha':base,
   'needs.scope.outputs.mode':mode,'needs.scope.outputs.area':area
  }).replaceAll('/tmp/int24-preview.log',join(root,'preview.log'));
  const result=spawnSync('bash',['-e','-o','pipefail','-c',script],{cwd:root,encoding:'utf8',env:{
   ...process.env,PATH:bin+':'+process.env.PATH,PR_BASE_SHA:'',FA_RECORD:record,
   FA_EXPECTED_BASE:base,FA_CSS_CHANGED:css?'1':'0',FA_FAIL_FULL:failFull?'1':'0'
  }});
  return {result,calls:readFileSync(record,'utf8').trim().split('\n').filter(Boolean).map(line=>{
   const [command,engine,area,base]=line.split('|');return {command,engine,area,base};
  })};
 });
}

test('push/main runs ordinary Chromium and WebKit without requiring a PR base or CSS parity',()=>{
 const {result,calls}=browserCommands({event:'push',base:'',css:true});
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(calls.map(x=>x.command),['tests/int24-browser-qa.mjs','tests/clean-ui-03-webkit-iphone.mjs']);
});
test('PR CSS parity receives exactly the trusted base SHA',()=>{
 const base='b'.repeat(40);const {result,calls}=browserCommands({css:true,base});
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(calls.map(x=>x.command),['tests/int24-browser-qa.mjs','tests/clean-ui-03-css-parity.mjs','tests/clean-ui-03-webkit-iphone.mjs']);
 assert.equal(calls[1].base,base);
});
test('PR without CSS retains full browsers and omits screenshot parity',()=>{
 const {result,calls}=browserCommands();assert.equal(result.status,0,result.stderr);
 assert.deepEqual(calls.map(x=>x.command),['tests/int24-browser-qa.mjs','tests/clean-ui-03-webkit-iphone.mjs']);
});
test('PR with missing base fails closed instead of reporting successful FULL',()=>{
 assert.notEqual(browserCommands({base:'',css:true}).result.status,0);
});
for(const area of ['calendar','clubs','competitions','guide']){
 test('TARGETED '+area+' runs only its two engine smoke suites',()=>{
  const {result,calls}=browserCommands({mode:'targeted',area});assert.equal(result.status,0,result.stderr);
  assert.deepEqual(calls.map(x=>[x.command,x.engine,x.area]),[
   ['tests/ci-opt-01-browser-smoke.mjs','chromium',area],
   ['tests/ci-opt-01-browser-smoke.mjs','webkit',area]
  ]);
 });
}
test('a failing Chromium suite fails the shell gate and cannot be masked by a later command',()=>{
 const {result,calls}=browserCommands({failFull:true});
 assert.equal(result.status,42);
 assert.deepEqual(calls.map(x=>x.command),['tests/int24-browser-qa.mjs']);
});
