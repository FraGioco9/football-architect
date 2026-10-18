import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {repositoryRoot,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";
import {ARTIFACT_CONTRACTS} from "../tools/dev-preview-artifact.mjs";

const workflow=readFileSync(join(repositoryRoot,".github/workflows/manual-vercel-preview.yml"),"utf8");
const contract=readFileSync(join(repositoryRoot,"docs/g10-access-01-collaborator-gate.md"),"utf8");
const cases=[
  {role:"owner",authenticated:true,approved:true,expect:"allow"},
  {role:"approved collaborator",authenticated:true,approved:true,expect:"allow"},
  {role:"authenticated but unapproved user",authenticated:true,approved:false,expect:"deny"},
  {role:"anonymous user",authenticated:false,approved:false,expect:"deny"}
];
const protectedPaths=[
  "/app/competitions/it-1/",
  "/__fa_dev__/debug-settings.mjs",
  "/__fa_dev__/standings-client.mjs",
  "/__fa_dev__/stats-data.mjs",
  "/__fa_dev__/artifact-manifest.json"
];

test("G10-ACCESS-03: protected Debug publication stays unconditionally disabled",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);
  assert.match(workflow,/if: \$\{\{ inputs\.artifact_contract == 'protected_debug' \}\}/);
  assert.match(workflow,/Protected Debug publication remains disabled until G10 is PASS and separately authorized/);
  const guarded=workflow.match(/stage-protected-debug:[\s\S]*?(?=\n  stage-public:)/)?.[0];
  assert.ok(guarded,"Protected Debug guard job must exist");
  assert.match(guarded,/exit 1/);
  assert.doesNotMatch(guarded,/vercel deploy|vercel alias|actions\/upload-artifact/);
});

test("G10-ACCESS-03: the source policy requires individual approval and anonymous denial",()=>{
  assert.deepEqual(ARTIFACT_CONTRACTS,["public","protected_debug"]);
  assert.match(contract,/explicitly authorized collaborators/);
  assert.match(contract,/Anonymous denial/);
  assert.match(contract,/logged-in but non-approved collaborator/i);
  assert.match(contract,/direct requests/i);
  assert.match(contract,/G10 remains BLOCKED|BLOCKED \/ NOT AUTHORIZED/);
  assert.deepEqual(cases.map(c=>c.expect),["allow","allow","deny","deny"]);
  assert.equal(new Set(protectedPaths).size,protectedPaths.length);
  for(const path of protectedPaths){
    assert.ok(path.startsWith("/"));
    assert.equal(isAllowlistedPublicPath(path.slice(1)),false,
      "No protected resource may be explicitly public: "+path);
  }
});

test("G10-ACCESS-03: no offline fixture is misrepresented as provider authorization",()=>{
  for(const c of cases){
    assert.equal(typeof c.authenticated,"boolean");
    assert.equal(typeof c.approved,"boolean");
    assert.equal(c.expect==="allow",c.authenticated&&c.approved);
  }
  // These are test-case definitions, NOT evidence of authenticated Vercel responses.
  // G10 remains blocked until owner-approved, independently observed live results.
  assert.match(workflow,/exit 1/);
});
