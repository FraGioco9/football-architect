import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/admin-world-checks.yml',import.meta.url),'utf8');
const count=(needle)=>workflow.split(needle).length-1;

test('CI-OPT-02 keeps exact-head, secure checkout and conservative production boundaries',()=>{
 assert.ok(count('ref: ${{ github.event.pull_request.head.sha }}')>=2);
 assert.ok(count('persist-credentials: false')>=2);
 assert.ok(count('EXPECTED_SHA: ${{ github.event.pull_request.head.sha }}')>=2);
 assert.match(workflow,/cancel-in-progress:.*github\.event\.action == 'synchronize'/);
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
test('pinned Playwright browser jobs use the supported Ubuntu 24.04 image instead of a moving latest alias',()=>{
 const browser=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 for(const [source,name] of [[workflow,'password-policy'],[workflow,'operator-final'],[browser,'chromium']]){
  const block=source.split('\n  '+name+':')[1]?.split(/\n  [a-z][a-z-]*:/)[0];assert.ok(block,name);
  assert.match(block,/runs-on: ubuntu-24\.04\b/,name);
 }
});

test('browser FULL runner provisions both Playwright engines once and tolerates slow Ubuntu mirrors',()=>{
 const browser=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 const block=browser.split('\n  chromium:')[1]?.split(/\n  [a-z][a-z-]*:/)[0];
 assert.ok(block);
 assert.match(block,/timeout-minutes: 45/);
 assert.equal((block.match(/npx playwright install --with-deps chromium webkit/g)||[]).length,1);
 assert.doesNotMatch(block,/npx playwright install chromium\s*\n/);
 assert.doesNotMatch(block,/npx playwright install --with-deps webkit\b/);
});

test('explicit final verification on a Draft PR opts Site and Browser into full coverage without changing ordinary Draft impact mode',()=>{
 for(const path of ['landing-checks.yml','int24-browser-qa.yml']){
  const source=readFileSync(new URL('../.github/workflows/'+path,import.meta.url),'utf8');
  const classifier=source.split('      - name: Classify fast-safe changes')[1]?.split('      - name:')[0];
  assert.ok(classifier,'missing classifier '+path);
  assert.match(classifier,/github\.event_name.*pull_request/);
  assert.match(classifier,/github\.event\.pull_request\.draft/);
  assert.ok(classifier.includes("contains(github.event.pull_request.body, '<!-- admin-world-final-verification -->')"),path);
  assert.match(classifier,/node tools\/ci-opt-01-impact\.mjs/);
  assert.match(classifier,/mode=full/);
 }
});

test('CI browser provisioning limits OS mirror stalls but still runs real pinned engines',()=>{
 const admin=workflow;
 const browser=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 assert.match(admin,/timeout 120s "\$RUNNER_TEMP\/fa-player-browser\/node_modules\/\.bin\/playwright" install --with-deps "\$ENGINE"/);
 assert.match(admin,/timeout 120s "\$RUNNER_TEMP\/fa-lifecycle-browser\/node_modules\/\.bin\/playwright" install --with-deps chromium/);
 assert.match(browser,/timeout 120s npx playwright install --with-deps chromium webkit/);
 assert.match(browser,/npx playwright install chromium webkit/);
 assert.match(admin,/"\$RUNNER_TEMP\/fa-player-browser\/node_modules\/\.bin\/playwright" install "\$ENGINE"/);
 assert.match(admin,/"\$RUNNER_TEMP\/fa-lifecycle-browser\/node_modules\/\.bin\/playwright" install chromium/);
 assert.doesNotMatch(admin+browser,/PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD|continue-on-error:\s*true/);
});

test('FULL WebKit and Chromium jobs use the pinned official browser image with native dependencies',()=>{
 const browser=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 const account=workflow.split('\n  account-browser:')[1]?.split('\n  operator-final:')[0];
 const full=browser.split('\n  chromium:')[1]?.split('\n  [a-z][a-z-]*:')[0];
 for(const block of [account,full]){
  assert.ok(block);
  assert.match(block,/runs-on: ubuntu-24\.04/);
  assert.match(block,/image: mcr\.microsoft\.com\/playwright:v1\.58\.2-noble/);
  assert.match(block,/options: --add-host=app\.localhost:127\.0\.0\.1/);
  assert.match(block,/PLAYWRIGHT_BROWSERS_PATH: \/ms-playwright/);
  assert.match(block,/npx playwright install chromium webkit|playwright" install "\$ENGINE"/);
 }
 assert.doesNotMatch(account+full,/PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD/);
});

test('pinned Playwright containers trust only exact checkout workspace for git ownership',()=>{
 const browser=readFileSync(new URL('../.github/workflows/int24-browser-qa.yml',import.meta.url),'utf8');
 const browserStep=browser.split('      - name: Assert exact PR checkout')[1]?.split('      - name:')[0];
 const adminStep=workflow.split('  account-browser:')[1]?.split('      - name: Verify exact head')[1]?.split('      - name:')[0];
 for(const block of [browserStep,adminStep]){
  assert.ok(block);
  assert.match(block,/git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/);
  assert.match(block,/git rev-parse HEAD/);
 }
 assert.doesNotMatch(browserStep+adminStep,/safe\.directory '\*'/);
});
