// This policy is intentionally narrower than the Match Engine workflow path filter.
const { execFileSync, spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const { evaluateRun, certifiedHistoricalAdmin, economicRepairAnchor, economicRepairBranch, economicRepairShape } = require('./ci-full-evidence.cjs');
const preview = 'tools/dev-standings-preview.mjs';
const manifest = 'match-engine/package.json';
const sourceNames = new Set([
  'action-labs', 'core', 'lab', 'lab-shot-calibration', 'movement-labs',
  'isolated-dribble-native-audit','isolated-dribble-touches','basic-match-referee-b05','goalkeeper-save-foundation-b02','individual-kinematics','player-ball-uniform-autonomous-action','small-sided-native-body-guard',
  'physical-receiving-cushion-m25', 'pitch-markings', 'player-movement',
  'private-physical-action-executor', 'rapier-foot-contact-bridge', 'small-sided-lab-scenarios'
]);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const read = (ref, path) => git('show', ref + ':' + path);

function newTestCommands(before, after) {
  const a = JSON.parse(before), b = JSON.parse(after);
  const original = a.scripts.test, next = b.scripts.test;
  if (!next.startsWith(original + ' ')) return false;
  const added = next.slice(original.length + 1).split(' ');
  b.scripts.test = original;
  return added.every(p => /^tests\/[a-z0-9-]+\.test\.mjs$/.test(p)) && isDeepStrictEqual(a, b);
}

function staticRoutes(before, after, exists) {
  const start = 'const MATCH_ENGINE_LAB = Object.freeze({\n';
  const split = text => {
    const parts = text.split(start);
    if (parts.length !== 2) return [];
    const end = parts[1].indexOf('\n});');
    return end < 0 ? [] : [parts[0], parts[1].slice(0, end).split('\n'), parts[1].slice(end)];
  };
  const [prefix, old, suffix] = split(before), [other, rows, tail] = split(after);
  if (!old || !rows || prefix !== other || suffix !== tail) return false;
  let cursor = 0;
  const urls = new Set(old.map(line => line.split("'")[1]));
  for (const line of rows) {
    if (line === old[cursor]) { cursor++; continue; }
    const match = /^  '(\/__fa_match_engine__\/([a-z0-9-]+)\.mjs)': 'match-engine\/src\/\2\.mjs',$/.exec(line);
    if (!match || !sourceNames.has(match[2]) || urls.has(match[1]) || !exists('match-engine/src/' + match[2] + '.mjs')) return false;
    urls.add(match[1]);
  }
  return cursor === old.length && rows.length > old.length;
}

function isolatedDiff(from, to) {
  const entries = git('diff', '--raw', '--no-renames', '-z', from, to).split('\0');
  let engine = false;
  for (let i = 0; i < entries.length - 1; i += 2) {
    const meta = entries[i], path = entries[i + 1];
    if (!/^:(?:000000|100644) 100644 [a-f0-9]+ [a-f0-9]+ [AM]$/.test(meta)) return false;
    if (path === preview) {
      if (!staticRoutes(read(from, path), read(to, path), p => git('ls-tree', to, '--', p).startsWith('100644 blob '))) return false;
      continue;
    }
    engine = true;
    if (path === manifest && newTestCommands(read(from, path), read(to, path))) continue;
    if (/^match-engine\/(lab\/(index\.html|lab\.css)|tests\/[a-z0-9-]+\.test\.mjs)$/.test(path)) continue;
    const module = /^match-engine\/src\/([a-z0-9-]+)\.mjs$/.exec(path);
    if (!module || !sourceNames.has(module[1])) return false;
  }
  if (!engine) return false;
  // Refuse new or changed references across the LAB boundary, including
  // multiline imports, assets, API calls and non-module fixture paths.
  const patch = git('diff', '--no-ext-diff', '--no-textconv', '-U0', from, to, '--', 'match-engine');
  return !patch.split('\n').some(line => line.startsWith('+') && !line.startsWith('+++') &&
    /\.\.\/\.\.\/|(?:backend|tools|assets)\/|\/api\//.test(line));
}

// The preview imports sidebar-shell outside the LAB route. Treat any new
// external runtime import of an engine module as shared, including indirect
// consumers of sidebar-shell. The route table itself serves static assets.
function isolatedConsumers(ref) {
  const args = ['grep', '-I', '-nE', '(import|from|require|importScripts).*match-engine/', ref, '--',
    '*.js', '*.mjs', '*.cjs', '*.ts', '*.mts', ':(exclude)match-engine/**', ':(exclude)tests/**',
    ':(exclude)tools/ci-match-engine.cjs'];
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0 && result.status !== 1) return false;
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  if (!lines.every(line => line.startsWith(ref + ':' + preview + ':') &&
    /:\d+:import \{[\w, ]+\} from '\.\.\/match-engine\/src\/sidebar-shell\.mjs';$/.test(line))) return false;
  if (/^\s*(?:import\s|export\s.*\sfrom\s)|\b(?:import|require)\s*\(/m.test(read(ref, 'match-engine/src/sidebar-shell.mjs'))) return false;
  // Backend code, fixtures and toolchain must have no link to the LAB, even
  // via a non-module asset or command rather than a JavaScript import.
  const backend = spawnSync('git', ['grep', '-IlE', 'match-engine/|__fa_match_engine__', ref, '--',
    'backend', ':(exclude)**/*.md'], { encoding: 'utf8' });
  if (backend.status !== 1) return false;
  const scripts = spawnSync('git', ['grep', '-IlE', 'match-engine/|__fa_match_engine__', ref, '--',
    'assets', 'tools', '*.ps1', '*.sh', ':(exclude)match-engine/**', ':(exclude)**/*.md'], { encoding: 'utf8' });
  if (scripts.status !== 0 && scripts.status !== 1) return false;
  const audited = new Set([preview, 'tools/ci-full-evidence.cjs', 'tools/ci-match-engine.cjs', 'tools/ci-opt-01-impact.mjs', 'tools/test-suite-508-inventory.mjs']);
  return scripts.stdout.trim().split('\n').filter(Boolean).every(path => audited.has(path.slice(ref.length + 1)));
}

const {inputs}=require('./ci-economic-inputs.cjs');
async function economicSource({ github, owner, repo, pr,workflow='admin-world-checks.yml' }) {
  const base = pr.base.sha, head = pr.head.sha;
  if (pr.base.ref !== 'main' || pr.head.repo?.full_name !== owner + '/' + repo ||
      git('rev-parse', 'HEAD').trim() !== head || git('merge-base', base, head).trim() !== base ||
      git('rev-parse',base).trim()!==base) return null;
  let selected=[];
  function repairShape(from,to){
    const raw=git('diff','--raw','--no-renames','-z',from,to).split('\0');
    const files=[];
    for(let i=0;i<raw.length-1;i+=2){
      if(!/^:100644 100644 [a-f0-9]+ [a-f0-9]+ M$/.test(raw[i]))return false;
      files.push({filename:raw[i+1],status:'modified'});
    }
    return economicRepairShape(from,files);
  }
  async function scope(from){
    if(workflow==='admin-world-checks.yml'&&from===economicRepairAnchor){
      if(base===from&&pr.head.ref===economicRepairBranch&&repairShape(from,head))return 'economic-only';
      if(base!==from){
        const history=git('log','--first-parent','--reverse','--format=%H',from+'..'+base).trim().split('\n');
        const repair=history[0];
        if(/^[a-f0-9]{40}$/.test(repair)&&git('rev-parse',repair+'^1').trim()===from&&repairShape(from,repair))
          return scope(repair);
      }
    }
    const owned=require('./ci-owned-selection.cjs').ownedTests(from,head);
    if(owned){
      selected=owned.filter(t=>workflow==='admin-world-checks.yml'?t.owner!=='site-node':t.owner==='site-node').map(t=>t.path);
      return 'owned-tests';
    }
    if(workflow==='admin-world-checks.yml'){
      if(isolatedDiff(from,head)&&isolatedConsumers(head))return 'match-engine';
      return git('diff','--name-only',from,head,'--',...inputs,'.github','tools/ci-*','.npmrc','backend/.npmrc','.node-version','.nvmrc','package*.json').trim()?null:'economic-only';
    }
    const paths=git('diff','--no-renames','--name-only','-z',from,head).split('\0').filter(Boolean);
    if(!paths.length||paths.some(p=>p.startsWith('.github/')||p.startsWith('match-engine/')||(p.startsWith('docs/')&&!p.endsWith('.md'))))return null;
    if(git('diff','--no-renames','--diff-filter=DTUXB','--name-only',from,head).trim())return null;
    const {classifyImpact}=await import('./ci-opt-01-impact.mjs');
    const plan=classifyImpact(paths);
    return plan.mode==='full'?null:plan.mode;
  }
  if(!await scope(base))return null;
  // Look only along main. The merged source must have exactly the certified
  // tree (including workflow definitions), also for squash merges.
  for (const line of git('log', '-32', '--first-parent', '--format=%H %s', base).trim().split('\n')) {
    const merge = line.slice(0, 40);
    const mode=await scope(merge);
    if(!mode)break;
    const number = /\(#(\d+)\)$/.exec(line)?.[1];
    if (!number) continue;
    const { data: source } = await github.rest.pulls.get({ owner, repo, pull_number: Number(number) });
    if (!source.merged || source.merge_commit_sha !== merge || source.base.ref !== 'main' ||
        source.head.repo?.full_name !== owner + '/' + repo) continue;
    const { data: commit } = await github.rest.git.getCommit({ owner, repo, commit_sha: source.head.sha });
    if (commit.tree.sha !== git('rev-parse', merge + '^{tree}').trim()) continue;

    const runs = await github.paginate(github.rest.actions.listWorkflowRuns,
      { owner, repo, workflow_id: workflow, head_sha: source.head.sha, event: 'pull_request', per_page: 100 });
    for (const run of runs.sort((a, b) => b.id - a.id)) {
      const expectedBase = git('rev-parse', merge + '^1').trim();
      const sourceBase = run.pull_requests?.find(p => p.number === source.number && p.base.ref === 'main' && p.head.sha===source.head.sha)?.base.sha;
      const historical = workflow==='admin-world-checks.yml'&&Array.isArray(run.pull_requests)&&run.pull_requests.length===0;
      if(sourceBase!==expectedBase&&!historical)continue;
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun,
        { owner, repo, run_id: run.id, filter: 'latest', per_page: 100 });
      const verdict = evaluateRun(run, jobs, source.head.sha, workflow, historical?{}:{ prNumber: source.number, baseSha: sourceBase });
      if(historical&&verdict.state==='PASS'&&!await certifiedHistoricalAdmin({github,owner,repo,source,tree:commit.tree.sha,baseSha:expectedBase,run,jobs}))continue;
      const operator = jobs.find(job => job.name === 'Final local operator persistence, restart and browser lifecycle');
      const executed = ['Verify DEV operator runtime and PowerShell regressions before full rehearsal',
        'Verify operator bootstrap, recovery and local persistence across restart'].every(name =>
        operator?.steps?.some(step => step.name === name && step.conclusion === 'success'));
      const rehearsal=operator?.steps?.some(s=>s.name==='Execute isolated economic rehearsal'&&s.conclusion==='success');
      if (verdict.state === 'PASS' && (workflow!=='admin-world-checks.yml'||(executed&&rehearsal))) return { mode, selected, merge, head, base, source: source.head.sha, tree: commit.tree.sha, run: run.html_url, attempt: run.run_attempt };
      if (['FAIL', 'CANCELLED', 'PENDING'].includes(verdict.state)) break;
    }
  }
  return null;
}
module.exports = { economicSource, isolatedDiff, isolatedConsumers, newTestCommands, staticRoutes };
