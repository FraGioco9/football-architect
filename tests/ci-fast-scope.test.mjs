import test from 'node:test';
import assert from 'node:assert/strict';
import {classify} from '../tools/ci-fast-scope.mjs';
test('CI-FAST-01: only unpublished provider-only changes qualify',()=>{
 assert.equal(classify(['assets/provider-selectors.mjs','tests/provider-selectors.test.mjs','docs/architecture/provider-contract.md']),'fast');
 assert.equal(classify(['tools/dev-fictional-provider.mjs','tests/dev-fictional-provider.test.mjs']),'fast');
 for(const paths of [[],['docs/architecture/provider-contract.md'],['assets/competition-page.js'],
  ['assets/provider-selectors.mjs','assets/competition-page.js'],
  ['assets/provider-selectors.mjs','.github/workflows/landing-checks.yml'],
  ['assets/provider-selectors.mjs','tools/publication-guard.mjs'],
  ['assets/provider-selectors.mjs','tests/new-browser.test.mjs']])
  assert.equal(classify(paths),'full');
});
