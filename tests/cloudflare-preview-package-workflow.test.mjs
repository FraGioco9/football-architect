import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../.github/workflows/cloudflare-preview-package.yml',import.meta.url);
const workflow=readFileSync(path,'utf8');
test('Cloudflare package workflow is read-only, exact-head, and nonproduction-only',()=>{
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/github\.event\.pull_request\.head\.sha/);
 assert.match(workflow,/prepare-preview\.mts/);
 assert.match(workflow,/verifyPreviewPackage/);
 assert.match(workflow,/football-architect-preview\.giocolifrancesco\.workers\.dev/);
 assert.match(workflow,/6a6c7803-56d3-4e7f-bd01-752d06a32341/);
 assert.match(workflow,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(workflow,/secrets\.|CLOUDFLARE_API_TOKEN|wrangler deploy --remote|wrangler deploy --config|cloudflare.*deploy --/i);
 assert.doesNotMatch(workflow,/workflow_dispatch|push:/);
});
