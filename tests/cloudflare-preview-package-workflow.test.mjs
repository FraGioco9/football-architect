import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

// The one-off PR integrations have already been merged (#496 and #263).
// Keep the verified builder and benchmark executable, but no dead PR workflow.
test('obsolete PR-specific workflows do not launch for unrelated changes',()=>{
 for(const name of ['cloudflare-preview-package.yml','render-01-perf.yml'])
   assert.equal(existsSync(new URL('../.github/workflows/'+name,import.meta.url)),false,name);
 assert.equal(existsSync(new URL('../tools/benchmark-standings-first-paint.mjs',import.meta.url)),true);
 assert.equal(existsSync(new URL('../backend/tools/prepare-preview.mts',import.meta.url)),true);
});

test('Cloudflare DEV Preview package remains behind an owner-only manual exact-head release',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/manual-cloudflare-dev-preview.yml',import.meta.url),'utf8');
 assert.match(workflow,/^  workflow_dispatch:$/m);
 assert.doesNotMatch(workflow,/^  (?:pull_request|push|schedule|workflow_run|repository_dispatch):/m);
 assert.match(workflow,/GITHUB_ACTOR.*FraGioco9/);
 assert.match(workflow,/GITHUB_TRIGGERING_ACTOR.*FraGioco9/);
 assert.match(workflow,/GITHUB_REF.*refs\/heads\/main/);
 assert.match(workflow,/EXPECTED_SHA.*GITHUB_SHA/);
 assert.match(workflow,/Verify main CI and build immutable public Worker package/);
 assert.match(workflow,/for wf in landing-checks\.yml int24-browser-qa\.yml/);
 assert.match(workflow,/ref: \$\{\{ inputs\.expected_sha \}\}/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/prepare-preview\.mts/);
 assert.match(workflow,/verifyPreviewPackage/);
 assert.match(workflow,/publicationAuthorized!==false/);
 assert.match(workflow,/preview\.football-architect\.workers\.dev/);
 assert.match(workflow,/actions\/upload-artifact@v4/);
 assert.match(workflow,/Independently verify artifact hashes/);
 assert.match(workflow,/no Cloudflare credentials/);
 assert.match(workflow,/Deploy only to existing DEV\/Preview Worker/);
 assert.doesNotMatch(workflow,/--remote|d1 execute|wrangler d1|run migrations/i);
});
