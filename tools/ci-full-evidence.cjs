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
 const operator=find('Final local operator persistence, restart and browser lifecycle');
 const rehearsal=operator?.steps?.find(s=>s.name==='Execute isolated economic rehearsal');
 if(workflow==='admin-world-checks.yml'&&rehearsal){
  const steps=['Verify DEV operator runtime and PowerShell regressions before full rehearsal',
   'Verify operator bootstrap, recovery and local persistence across restart'];
  if(!steps.every(name=>operator.steps.some(s=>s.name===name&&s.conclusion==='success')))return {state:'MISSING',url:run.html_url};
  if(rehearsal.conclusion!=='success'){
   const recorded=find('scope')?.steps?.some(s=>s.name==='Verified isolated economic inputs'&&s.conclusion==='success');
   return {state:recorded&&rehearsal.conclusion==='skipped'?'ECONOMY_INHERITED':'MISSING',url:run.html_url};
  }
 }
 return {state:'PASS',url:run.html_url};
}

// Recover only executed historical Admin evidence, corroborated by the original FULL gate.
const economicRepairAnchor='2e4596492665401200b16ef45615a4c0e1434d34';
const economicRepairBranch='ci/785-historical-economic-source';
const economicRepairPaths=new Set(['tools/ci-match-engine.cjs','tools/ci-full-evidence.cjs',
 'tests/ci-opt-04-05.test.mjs','.github/workflows/ci-opt-03-full-gate.yml','.github/workflows/admin-world-checks.yml']);
function economicRepairShape(baseSha,files){
 return baseSha===economicRepairAnchor&&files.length===economicRepairPaths.size&&
  new Set(files.map(f=>f.filename)).size===economicRepairPaths.size&&
  files.every(f=>economicRepairPaths.has(f.filename)&&f.status==='modified'&&!f.previous_filename);
}
// A second narrowly bounded transition, only from this reviewed main tree.
const stackedRepairAnchor='1a00b26cd83953eac14853e12a4c1f2b150c000a';
const stackedRepairBranch='ci/stacked-economic-evidence';
const stackedRepairPaths=new Set([...economicRepairPaths,'tests/ci-opt-02-workflow-contract.test.mjs']);
function stackedRepairShape(baseSha,files){
 return baseSha===stackedRepairAnchor&&files.length===stackedRepairPaths.size&&
  new Set(files.map(f=>f.filename)).size===stackedRepairPaths.size&&
  files.every(f=>stackedRepairPaths.has(f.filename)&&f.status==='modified'&&!f.previous_filename);
}
function historicIdentity(run,source,tree,workflow,owner,repo){
 const end=Date.parse(source.merged_at),start=Date.parse(run.created_at),updated=Date.parse(run.updated_at);
 return run.event==='pull_request'&&run.head_sha===source.head.sha&&run.head_commit?.tree_id===tree&&
  run.head_branch===source.head.ref&&run.repository?.full_name===owner+'/'+repo&&
  run.head_repository?.full_name===owner+'/'+repo&&run.path==='.github/workflows/'+workflow&&
  Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0&&start<end&&start<=updated&&updated<=end;
}
function historicalAssociation(run,source,baseSha){
 return Array.isArray(run.pull_requests)&&(run.pull_requests.length===0||
  run.pull_requests.some(p=>p.number===source.number&&p.head.sha===source.head.sha&&
   p.base.ref==='main'&&p.base.sha===baseSha));
}
async function historicJobLog(github,owner,repo,job){
 try{
  const {data}=await github.rest.actions.downloadJobLogsForWorkflowRun({owner,repo,job_id:job.id});
  if(typeof data==='string')return data;
  if(data instanceof ArrayBuffer||ArrayBuffer.isView(data))return Buffer.from(data instanceof ArrayBuffer?data:new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).toString('utf8');
 }catch{}
 return '';
}
function loggedEnv(log,key,value){
 const matches=[...log.matchAll(new RegExp('^\\S+Z   '+key+': (.*)\\r?$','gm'))];
 return matches.length===1&&matches[0][1].trim()===String(value);
}
function gateRecordedRun(log,source,run){
 if(!loggedEnv(log,'PR_NUMBER',source.number)||!loggedEnv(log,'EXPECTED_HEAD',source.head.sha))return false;
 const reports=[];
 for(const line of log.split(/\r?\n/)){
  const match=/^\S+Z (\{"head":.*\})$/.exec(line);
  if(match){try{reports.push(JSON.parse(match[1]));}catch{return false;}}
 }
 const last=reports.at(-1);
 return last?.head===source.head.sha&&Array.isArray(last.rows)&&last.rows.length>=3&&
  last.rows.every(row=>row.state==='PASS')&&last.rows.some(row=>row.workflow==='admin-world-checks.yml'&&
   row.run===run.id&&row.attempt===run.run_attempt);
}
async function certifiedHistoricalAdmin({github,owner,repo,source,tree,baseSha,run,jobs}){
 const workflow='admin-world-checks.yml';
 if(!source.merged||source.base.ref!=='main'||source.base.sha!==baseSha||
    source.head.repo?.full_name!==owner+'/'+repo||!historicIdentity(run,source,tree,workflow,owner,repo)||
    !historicalAssociation(run,source,baseSha)||evaluateRun(run,jobs,source.head.sha,workflow).state!=='PASS')return false;
 const operator=jobs.find(j=>j.name==='Final local operator persistence, restart and browser lifecycle');
 if(!['Verify DEV operator runtime and PowerShell regressions before full rehearsal',
  'Verify operator bootstrap, recovery and local persistence across restart',
  'Execute isolated economic rehearsal'].every(name=>operator?.steps?.some(s=>s.name===name&&s.conclusion==='success')))return false;
 const scope=jobs.find(j=>j.name==='scope'&&j.run_id===run.id&&j.conclusion==='success'&&
  j.steps?.some(s=>s.name==='Classify Admin impact on exact HEAD'&&s.conclusion==='success'));
 if(!scope)return false;
 const log=await historicJobLog(github,owner,repo,scope);
 if(!loggedEnv(log,'PR_BASE_SHA',baseSha)||!log.includes('test "$(git rev-parse HEAD)" = "'+source.head.sha+'"'))return false;
 const gateWorkflow='ci-opt-03-full-gate.yml';
 const gates=await github.paginate(github.rest.actions.listWorkflowRuns,{owner,repo,workflow_id:gateWorkflow,
  head_sha:source.head.sha,event:'pull_request',per_page:100});
 for(const gate of gates){
  if(!historicIdentity(gate,source,tree,gateWorkflow,owner,repo)||!historicalAssociation(gate,source,baseSha)||
     gate.status!=='completed'||gate.conclusion!=='success')continue;
  const gateJobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:gate.id,filter:'latest',per_page:100});
  const job=gateJobs.find(j=>j.name==='CI FULL exact-head evidence'&&j.run_id===gate.id&&j.conclusion==='success'&&
   j.steps?.some(s=>s.name==='Verify exact PR head and complete FULL workflow evidence'&&s.conclusion==='success'));
  if(job&&gateRecordedRun(await historicJobLog(github,owner,repo,job),source,run))return true;
 }
 return false;
}
// One bounded policy transition, independently checking the executed source.
async function certifyEconomicRepair({github,owner,repo,baseSha,headRef,files}){
 if(headRef!==economicRepairBranch||!economicRepairShape(baseSha,files))return false;
 return validateEconomicRepairPatch(files)&&await originalEconomicReceipt({github,owner,repo});
}
async function originalEconomicReceipt({github,owner,repo}){
 const {data:source}=await github.rest.pulls.get({owner,repo,pull_number:814});
 if(!source.merged||source.merge_commit_sha!==economicRepairAnchor||
    source.head.sha!=='52b9cf8b9b7f1467c9a22bc5c1277106273c16df')return false;
 const {data:merge}=await github.rest.git.getCommit({owner,repo,commit_sha:economicRepairAnchor});
 const {data:commit}=await github.rest.git.getCommit({owner,repo,commit_sha:source.head.sha});
 if(merge.tree.sha!==commit.tree.sha||merge.parents[0]?.sha!==source.base.sha||
    merge.tree.sha!=='fceabfb6437d8daf662fca7aa577c239db1b784c')return false;
 const {data:run}=await github.rest.actions.getWorkflowRun({owner,repo,run_id:45777171064});
 if(run.id!==45777171064||run.run_attempt!==1)return false;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
 return certifiedHistoricalAdmin({github,owner,repo,source,tree:commit.tree.sha,baseSha:source.base.sha,run,jobs});
}

function validateEconomicRepairPatch(files){
 // The actual Admin workflow can only gain the fail-closed preflight lines.
 const patch=files.find(f=>f.filename==='.github/workflows/admin-world-checks.yml')?.patch;
 if(typeof patch!=='string')return false;
 const additions=patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1));
 const deletions=patch.split('\n').filter(l=>l.startsWith('-')&&!l.startsWith('---'));
 return !deletions.length&&JSON.stringify(additions)===JSON.stringify(economicRepairGuardLines);
}
function stackedRepairPatch(files){
 const patch=files.find(f=>f.filename==='.github/workflows/admin-world-checks.yml')?.patch;
 if(typeof patch!=='string')return false;
 const added=patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1));
 const removed=patch.split('\n').filter(l=>l.startsWith('-')&&!l.startsWith('---')).map(l=>l.slice(1));
 const old="        if: $"+ "{{ github.event.pull_request.base.ref == 'main' }}";
 const next="        if: $"+ "{{ github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.base.repo.full_name == github.repository }}";
 const guard=["          if [ \"$PR_HEAD_REF\" = ci/stacked-economic-evidence ] && [ \"$"+"{{ steps.economic.outputs.mode }}\" != economic-only ]; then",
  "            echo 'BLOCKED: stacked policy transition lacks certified economic evidence.' >&2","            exit 1","          fi"];
 return JSON.stringify(removed)===JSON.stringify([old])&&JSON.stringify(added)===JSON.stringify([next,...guard]);
}
async function certifyStackedRepair({github,owner,repo,baseSha,headRef,files}){
 if(headRef!==stackedRepairBranch||!stackedRepairShape(baseSha,files)||!stackedRepairPatch(files))return false;
 // The economic inputs changed in #818, so use its newly executed
 // full receipt, not the older #814 execution or an inherited rerun.
 const {data:source}=await github.rest.pulls.get({owner,repo,pull_number:818});
 if(!source.merged||source.merge_commit_sha!==stackedRepairAnchor||
    source.head.sha!=='50cb5cac49eaf969d909e22debdecf32b0aff191')return false;
 const {data:anchor}=await github.rest.git.getCommit({owner,repo,commit_sha:stackedRepairAnchor});
 const {data:commit}=await github.rest.git.getCommit({owner,repo,commit_sha:source.head.sha});
 if(anchor.tree.sha!=='b5a75b36106296a4129a9e747ee809cd8adbb20c'||anchor.tree.sha!==commit.tree.sha||
    anchor.parents[0]?.sha!==source.base.sha)return false;
 const {data:run}=await github.rest.actions.getWorkflowRun({owner,repo,run_id:46087723530});
 if(run.id!==46087723530||run.run_attempt!==1)return false;
 const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
 return certifiedHistoricalAdmin({github,owner,repo,source,tree:commit.tree.sha,baseSha:source.base.sha,run,jobs});
}
const economicRepairGuardLines=["          PR_HEAD_REF: $"+"{{ github.event.pull_request.head.ref }}","          if [ \"$PR_HEAD_REF\" = ci/785-historical-economic-source ] && [ \"$"+"{{ steps.economic.outputs.mode }}\" != economic-only ]; then","            echo 'BLOCKED: certified historical economic source unavailable; do not start the rehearsal.' >&2","            exit 1","          fi"];
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
function selectedPublicEvidence(workflow,run,jobs,sha,prNumber,baseSha){
 if(!baseSha||run.head_sha!==sha||run.event!=='pull_request'||run.status!=='completed'||run.conclusion!=='success'||
    !run.pull_requests?.some(p=>p.number===prNumber&&p.head.sha===sha&&p.base.sha===baseSha))return false;
 const job=name=>jobs.find(j=>j.name===name&&j.conclusion==='success');
 const step=(j,name)=>j?.steps?.find(s=>s.name===name)?.conclusion;
 const site=workflow==='landing-checks.yml';
 if(!site&&workflow!=='int24-browser-qa.yml')return false;
 if(step(job(site?'head-exact':'scope'),'Certified impacted suites')!=='success')return false;
 if(site)return step(job('landing'),'Site essential contracts (FAST and TARGETED)')==='success'&&step(job('landing'),'FULL coverage completed')==='skipped';
 const aggregate=job('chromium');
 if(step(aggregate,'Verify browser lane results')!=='success'||step(aggregate,'FULL coverage completed')!=='skipped')return false;
 const lanes=jobs.filter(j=>j.name.startsWith('Browser lane ('));
 if(step(aggregate,'Run loopback preview and browser checks')==='skipped')return lanes.every(j=>j.conclusion==='skipped');
 return lanes.length===1&&step(job('Browser lane (core)'),'Run loopback preview and browser checks')==='success'&&
  step(aggregate,'Run loopback preview and browser checks')==='success';
}
async function observe({github,owner,repo,sha,prNumber,baseSha,headRef,files=[]}){
 const rows=[];
 for(const workflow_id of Object.keys(requirements)){
  const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{owner,repo,workflow_id,head_sha:sha,per_page:100});
  let row={workflow:workflow_id,state:'MISSING'};
  for(const run of runs.filter(r=>r.head_sha===sha&&r.event==='pull_request').sort((a,b)=>b.id-a.id)){
   const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
   if(workflow_id==='admin-world-checks.yml'&&inheritedAdmin(run,jobs,sha,prNumber,baseSha)){
    row={workflow:workflow_id,run:run.id,state:'INHERITED',url:run.html_url};break;
   }
   if(selectedPublicEvidence(workflow_id,run,jobs,sha,prNumber,baseSha)){
    row={workflow:workflow_id,run:run.id,state:'SELECTED',url:run.html_url};break;
   }
   const value=evaluateRun(run,jobs,sha,workflow_id,{prNumber,baseSha});
   if(workflow_id==='admin-world-checks.yml'&&value.state==='NARROW'&&baseSha){
    const ok=(job,step)=>jobs.some(j=>j.name===job&&j.conclusion==='success'&&j.steps.some(s=>s.name===step&&s.conclusion==='success'));
    if(ok('scope','Verified standalone test selection')&&ok('Admin foundation contracts (Node 22)','Run selected backend tests')){
     row={workflow:workflow_id,run:run.id,state:'SELECTED',url:run.html_url};break;
    }
   }
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
 if(rows.some(r=>['SELECTED','ECONOMY_INHERITED'].includes(r.state))){
  const policy=p=>p.startsWith('.github/')||p.startsWith('tools/ci-')||p==='backend/tests/prepare-persistence.test.mts';
  if(!files.length||files.some(f=>policy(f.filename)||(f.previous_filename&&policy(f.previous_filename)))){
   const transition=rows.some(r=>r.workflow==='admin-world-checks.yml'&&r.state==='ECONOMY_INHERITED')&&
    !rows.some(r=>['SELECTED','INHERITED'].includes(r.state))&&(await certifyEconomicRepair({github,owner,repo,baseSha,headRef,files})||await certifyStackedRepair({github,owner,repo,baseSha,headRef,files}));
   if(!transition)throw Error('BLOCKED: verification policy changed');
  }
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
  const rows=await observe({github,owner,repo,sha:expected,prNumber,baseSha:live.base.sha,headRef:live.head.ref,files});
  const summary=JSON.stringify({head:expected,rows});
  if(summary!==last){core.info(summary);last=summary;await core.summary.addHeading('Exact-head workflow evidence').addCodeBlock(summary,'json').write();}
  if(rows.every(r=>['PASS','INHERITED','SELECTED','ECONOMY_INHERITED'].includes(r.state))){const fresh=await current();if(fresh.base.sha!==live.base.sha)throw Error('BLOCKED: PR base changed during verification');if(rows.some(r=>r.state!=='PASS')&&fresh.mergeable!==true)throw Error('BLOCKED: main compatibility unconfirmed');return rows;}
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
async function mergedPublicSource({github,owner,repo,workflow,sha,before}){
 const {data:merge}=await github.rest.git.getCommit({owner,repo,commit_sha:sha});
 if(merge.parents[0]?.sha!==before)return null;
 const prs=await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit,{owner,repo,commit_sha:sha,per_page:100});
 const pr=prs.find(p=>p.merged_at&&p.merge_commit_sha===sha&&p.base.ref==='main'&&p.head.repo?.full_name===owner+'/'+repo);
 if(!pr)return null;
 const {data:source}=await github.rest.git.getCommit({owner,repo,commit_sha:pr.head.sha});
 if(source.tree.sha!==merge.tree.sha)return null;
 const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{owner,repo,workflow_id:workflow,event:'pull_request',head_sha:pr.head.sha,per_page:100});
 for(const run of runs.sort((a,b)=>b.id-a.id)){
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{owner,repo,run_id:run.id,filter:'latest',per_page:100});
  const value=evaluateRun(run,jobs,pr.head.sha,workflow,{prNumber:pr.number,baseSha:before});
  if(value.state==='PASS'||selectedPublicEvidence(workflow,run,jobs,pr.head.sha,pr.number,before))return run.id;
  if(['FAIL','CANCELLED','PENDING'].includes(value.state))return null;
 }
 return null;
}
module.exports={certifiedHistoricalAdmin,certifyEconomicRepair,certifyStackedRepair,stackedRepairShape,stackedRepairPatch,stackedRepairAnchor,stackedRepairBranch,economicRepairAnchor,economicRepairBranch,economicRepairShape,mergedPublicSource,selectedPublicEvidence,inheritedAdmin,engineEvidence,requirements,evaluateRun,observe,verify,findReusable};
