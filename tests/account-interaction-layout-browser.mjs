// TEST-SUITE-02 (#738): account interaction and layout checks reuse ONE
// pinned Playwright browser process. The two local preview servers and all
// test contexts are still cleaned between suites, in the original order.
import {runAccountBrowserBatch} from '../tools/ci-opt-07-account-browser-batch.mjs';
import {runAccountInteractionMatrix} from './account-interaction-browser.mjs';
import {runAccountLayoutMatrix} from './account-layout-browser.mjs';

await runAccountBrowserBatch([
 {name:'account-interaction-browser.mjs',expected:100,run:runAccountInteractionMatrix},
 {name:'account-layout-browser.mjs',expected:80,run:runAccountLayoutMatrix}
]);
