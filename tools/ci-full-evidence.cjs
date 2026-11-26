// Read-only evidence observer. Never dispatches, cancels or mutates checks.
const requirements={
 'landing-checks.yml':[['landing','FULL coverage completed','Site contracts (full)']],
 'int24-browser-qa.yml':[['chromium','FULL coverage completed','Run loopback preview and browser checks']],
 'admin-world-checks.yml':[['Admin foundation contracts (Node 22)','FULL coverage completed','Execute smoke tests in actual local Worker runtime'],['Final local operator persistence, restart and browser lifecycle','Verify unified Admin two-season lifecycle with real local Worker and D1'],['Account UI (chromium)','FULL account coverage completed','Verify account matrix'],['Account UI (webkit)','FULL account coverage completed','Verify account matrix']]
};
function evaluateRun(run,jobs,sha,workflow,{prNumber,baseSha}={}){
 if(run.head_sha!==sha)return {state:'STALE'};
 if(run.event!=='pull_request')return {state:'IGNORED'};
 if(baseSha&&!run.pull_requests?.some(pr=>pr.number===prNumber&&pr.base.sha===baseSha&&pr.head.sha===sha))return {state:'STALE'};
 // A completed narrowed run is not FULL evidence, even if its workflow is green.
 const required=requirements[workflow];
 const find=name=>jobs.find(j=>j.name===name||j.name.endsWith(' / '+name));
 const markers=required.map(([name,step])=>find(name)?.steps?.find(s=>s.name===step));
 if(run.status!=='completed')return {state:'PENDING',url:run.html_url};
 if(run.conclusion!=='success')return {state:run.conclusion==='cancelled'?'CANCELLED':'FAIL',url:run.html_url};
 if(markers.some(s=>s?.conclusion==='skipped'))return {state:'NARROW',url:run.html_url};
 const source=required.map(([name,step,execution])=>find(name)?.steps?.find(s=>s.name===(execution||step)));
 if(markers.every(s=>s?.conclusion==='success')&&source.some(s=>s?.conclusion==='skipped'))return {state:'REUSED',url:run.html_url};
 if(source.some(s=>s?.conclusion!=='success'))return {state:'MISSING',url:run.html_url};
 if(!required.every(([name],i)=>find(name)?.conclusion==='success'&&markers[i]?.conclusion==='success'))return {state:'MISSING',url:run.html_url};
 // CI-OPT-07: the stable aggregate identity is not sufficient by itself.
 // Legacy monolithic runs remain valid for exact-head PRs using that workflow.
 const isolatedBrowser=workflow==='int24-browser-qa.yml'&&(
  find('chromium')?.steps?.some(s=>s.name==='Verify browser lane results')||
  find('scope')?.steps?.some(s=>s.name==='Select browser lanes')||
  jobs.some(j=>/(?:^| \/ )Browser lane \(/.test(j.name)));
 if(isolatedBrowser){
  const ok=(job,step)=>job?.conclusion==='success'&&job.steps?.some(s=>s.name===step&&s.conclusion==='success');
  if(!ok(find('chromium'),'Verify browser lane results')||!ok(find('scope'),'Select browser lanes'))return {state:'MISSING',url:run.html_url};
  const lanes=['core','responsive','webkit'];
  for(const [marker,lane] of [['CSS parity required','css'],['Visual parity required','visual']]){
   const state=find('scope')?.steps?.find(s=>s.name===marker)?.conclusion;
   if(state==='success')lanes.push(lane);
   else if(state!=='skipped'||find('Browser lane ('+lane+')'))return {state:'MISSING',url:run.html_url};
  }
  if(lanes.some(lane=>!ok(find('Browser lane ('+lane+')'),'Run loopback preview and browser checks')))return {state:'MISSING',url:run.html_url};
 }
 return {state:'PASS',url:run.html_url};
}
const inheritedMarker='Verified unchanged economic scope against executed FULL source';
const engineSteps=['Verify exact PR HEAD','Install pinned physics candidate','Focused core and route security tests',
 'Existing routing/preview regressions','Browser viewport fit (Chrome, Advanced settings open and closed)',
 'Five Action LABs clean-stack Chrome interaction','Measured local CPU / memory sample'];

function inheritedAdmin(run,jobs,sha,prNumber,baseSha){
 if(!baseSha||run.event!=='pull_request'||run.head_sha!==sha||run.conclusion!=='success'||run.status!=='completed')return false;
 if(!run.pull_requests?.some(p=>p.number===prNumber&&p.base.sha===baseSha&&p.head.sha===sha))return false;
 const scope=jobs.find(j=>j.name==='scope');
 const contracts=jobs.find(j=>j.name==='Admin foundation contracts (Node 22)');
 return scope?.conclusion==='success'&&contracts?.conclusion==='success'&&
  scope.steps?.some(s=>s.name===inheritedMarker&&s.conclusion==='success')&&
  contracts.steps?.some(s=>s.name==='FULL coverage completed'&&s.conclusion==='skipped');
}
async function engineEvidence({github,owner,repo,sha,prNumber,baseSha}){
 const workflow='match-engine-01.yml';
 const args={owner,repo,workflow_id:workflow,head_sha:sha,event:'pull_request',per_page:100};
 const runs=await github.paginate(github.rest.actions.listWorkflowRuns,args);
 const run=runs.filter(r=>r.head_sha===sha&&r.event==='pull_request'&&
  r.pull_requests?.some(p=>p.number===prNumber&&p.base.sha===baseSha&&p.head.sha===sha)).sort((a,b)=>b.id-a.id)[0];
 if(!run||run.status!=='completed')return {workflow,state:run?'PENDING':'MISSING'};
 if(run.conclusion!=='success')return {workflow,run:run.id,state:'FAIL'};
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
 const job=jobs.find(j=>j.name==='match-engine');
 const executed=job?.conclusion==='success'&&engineSteps.every(name=>job.steps.some(s=>s.name===name&&s.conclusion==='success'));
 return {workflow,run:run.id,state:executed?'PASS':'MISSING'};
}
async function observe({github,owner,repo,sha,prNumber,baseSha,files=[]}){
 const rows=[];
 for(const workflow_id of Object.keys(requirements)){
  const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{owner,repo,workflow_id,head_sha:sha,per_page:100});
  let row={workflow:workflow_id,state:'MISSING'};
  for(const run of runs.filter(r=>r.head_sha===sha&&r.event==='pull_request').sort((a,b)=>b.id-a.id)){
   const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
   if(workflow_id==='admin-world-checks.yml'&&inheritedAdmin(run,jobs,sha,prNumber,baseSha)){
    row={workflow:workflow_id,run:run.id,state:'INHERITED',url:run.html_url};break;
   }
   const value=evaluateRun(run,jobs,sha,workflow_id,{prNumber,baseSha});
   if(['NARROW','IGNORED','STALE','REUSED'].includes(value.state))continue;
   row={workflow:workflow_id,run:run.id,attempt:run.run_attempt,...value};break;
  }
  rows.push(row);
 }
 if(rows.some(r=>r.state==='INHERITED')){
  // The Admin proof is authoritative only if its workflow and verifier came
  // from main. GitHub caps the file-list API at 3000 entries.
  if(!files.length||files.length>=3000||!files.every(f=>['added','modified'].includes(f.status)&&
   (f.filename.startsWith('match-engine/')||f.filename==='tools/dev-standings-preview.mjs')))
   throw Error('BLOCKED: candidate changes files outside the trusted Match Engine policy');
 }
 if(files.some(f=>f.filename.startsWith('match-engine/')||f.filename==='.github/workflows/match-engine-01.yml'))
  rows.push(await engineEvidence({github,owner,repo,sha,prNumber,baseSha}));
 return rows;
}
async function verify({github,core,context,prNumber,expected,maxWaitMs=45*60*1000,intervalMs=30000,now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const {owner,repo}=context.repo;
 if(!Number.isSafeInteger(prNumber)||prNumber<1||!/^[0-9a-f]{40}$/.test(expected))throw Error('Invalid PR number or expected SHA');
 const start=now();let last='',fileBase;let files=[];
 async function current(){
  const {data:pr}=await github.rest.pulls.get({owner,repo,pull_number:prNumber});
  if(pr.state!=='open'||pr.head.repo?.full_name!==owner+'/'+repo||pr.head.sha!==expected||pr.base.ref!=='main')throw Error('BLOCKED: closed/foreign PR, stale HEAD or unexpected base');
  return pr;
 }
 while(true){
  const live=await current();
  if(live.base.sha!==fileBase){
   files=await github.paginate(github.rest.pulls.listFiles,{owner,repo,pull_number:prNumber,per_page:100});
   if(files.length!==live.changed_files)throw Error('BLOCKED: incomplete candidate diff');
   fileBase=live.base.sha;
  }
  const rows=await observe({github,owner,repo,sha:expected,prNumber,baseSha:live.base.sha,files});
  const summary=JSON.stringify({head:expected,rows});
  if(summary!==last){core.info(summary);last=summary;await core.summary.addHeading('Exact-head workflow evidence').addCodeBlock(summary,'json').write();}
  if(rows.every(r=>r.state==='PASS'||r.state==='INHERITED')){const fresh=await current();if(fresh.base.sha!==live.base.sha)throw Error('BLOCKED: PR base changed during verification');if(rows.some(r=>r.state==='INHERITED')&&fresh.mergeable!==true)throw Error('BLOCKED: main compatibility unconfirmed');return rows;}
  if(rows.some(r=>['FAIL','CANCELLED'].includes(r.state)))throw Error('CI evidence FAIL/CANCELLED (not an inferred product regression): '+summary);
  if(now()-start>=maxWaitMs)throw Error('BLOCKED: missing or PENDING CI evidence after observation deadline; rerun only this gate when FULL evidence is available. '+summary);
  // Missing and PENDING evidence keep this required job in progress, never PASS.
  await wait(intervalMs);
 }
}
async function findReusable({github,owner,repo,sha,workflow,currentRun,prNumber,baseSha}){
 const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{owner,repo,workflow_id:workflow,head_sha:sha,per_page:100});
 for(const run of runs.filter(r=>r.id<Number(currentRun)&&r.head_sha===sha&&r.event==='pull_request').sort((a,b)=>b.id-a.id)){
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
  const state=evaluateRun(run,jobs,sha,workflow,{prNumber,baseSha}).state;
  if(state==='PASS')return run.id;
  if(!['NARROW','IGNORED','STALE','REUSED'].includes(state))return null;
 }
 return null;
}
module.exports={inheritedAdmin,engineEvidence,requirements,evaluateRun,observe,verify,findReusable};
