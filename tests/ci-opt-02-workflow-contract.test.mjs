import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/admin-world-checks.yml',import.meta.url),'utf8');
const count=(needle)=>workflow.split(needle).length-1;

test('CI-OPT-02 keeps exact-head, secure checkout and conservative production boundaries',()=>{
 assert.ok(count('ref: ${{ github.event.pull_request.head.sha }}')>=2);
 assert.ok(count('persist-credentials: false')>=2);
 assert.ok(count('EXPECTED_SHA: ${{ github.event.pull_request.head.sha }}')>=2);
 assert.match(workflow,/cancel-in-progress: true/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/wrangler deploy|--remote|remote = true/);
});
test('CI-OPT-02 keeps full Worker, operator, migration and browser final gates',()=>{
 assert.match(workflow,/npm --prefix backend test\b/);
 assert.match(workflow,/npm --prefix backend run test:operator/);
 assert.match(workflow,/python3 -m unittest discover/);
 assert.match(workflow,/npm --prefix backend run typecheck/);
 assert.match(workflow,/tests\/admin-settings-browser\.mjs/);
 assert.match(workflow,/run: .*node --experimental-strip-types tests\/admin-world-lifecycle-runner\.mts/);
 assert.match(workflow,/operator-final:/);
 assert.match(workflow,/admin-world-final-verification/);
});
test('CI-OPT-02 avoids duplicate historical Vitest and protects cached installs',()=>{
 assert.equal(count('npx vitest run tests/admin-end-season-transition-runtime.test.ts'),0);
 assert.equal(count('npm --prefix backend test\n'),1);
 assert.ok(count('cache-dependency-path: backend/package-lock.json')>=2);
 assert.ok(count('npm --prefix backend ci --prefer-offline --no-audit --no-fund')>=2);
 assert.match(workflow,/playwright-chromium-1\.58\.2/);
 assert.match(workflow,/playwright\" install --with-deps chromium/);
});
