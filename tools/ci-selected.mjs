import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {auditDiscovery} from './ci-discovery.mjs';
export const essential=['tests/ci-fast-scope.test.mjs', 'tests/ci-opt-01-impact.test.mjs', 'tests/ci-opt-01-node-inventory.test.mjs', 'tests/ci-opt-01-node-runner.test.mjs', 'tests/provider-contract.test.mjs', 'tests/static-provider.test.mjs', 'tests/dev-fictional-provider.test.mjs', 'tests/verified-history-provider.test.mjs', 'tests/provider-selectors.test.mjs', 'tests/publication-gate.test.mjs', 'tests/arch-clean-02-security.test.mjs', 'tests/admin-settings.test.mjs', 'tests/season-two-controls.test.mjs', 'tests/authoritative-season.test.mjs', 'tests/authoritative-calendar.test.mjs', 'tests/authoritative-history.test.mjs', 'tests/dev-admin-api-proxy.test.mjs', 'tests/backend-test-discovery.test.mjs', 'tests/admin-public-preview.test.mjs'];
export function selectTests(extra=[],inventory=auditDiscovery()){
 const known=new Set(inventory.owners['site-node']);
 const files=[...new Set([...essential,...extra])];
 for(const file of files)if(!known.has(file))throw Error('Unknown selected Site test: '+file);
 return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const extra=(process.env.TARGETED_TESTS||'').split(/\s+/).filter(Boolean);
 const files=selectTests(extra);console.log('Unique selected Site files: '+JSON.stringify(files));
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...files],{stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}
