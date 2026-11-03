// Explicit ownership manifest. Changes require an intentional inventory review.
import {readdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const manifestUrl=new URL('./ci-test-ownership.json',import.meta.url);
function scan(root,prefix){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(new URL(e.name+'/',root),prefix+e.name+'/'):[prefix+e.name]);}
export function auditDiscovery({extra=[],manifest=JSON.parse(readFileSync(manifestUrl,'utf8'))}={}){
 const files=[...scan(new URL('../tests/',import.meta.url),'tests/'),...scan(new URL('../backend/tests/',import.meta.url),'backend/tests/'),...extra].filter(p=>!p.includes('/__pycache__/')).sort();
 const actual=new Set(files),known=new Set(Object.keys(manifest.tests));
 for(const file of actual)if(!known.has(file))throw Error('Unclassified test: '+file+'. Assign a canonical owner in tools/ci-test-ownership.json; reproduce: node tools/ci-discovery.mjs');
 for(const file of known)if(!actual.has(file))throw Error('Stale test ownership: '+file);
 const owners={};
 const scripts=JSON.parse(readFileSync(new URL('../backend/package.json',import.meta.url),'utf8')).scripts;
 const contracts=contractRunnerSource();
 function contractRunnerSource(){return readFileSync(new URL('../backend/tools/run-contracts.mjs',import.meta.url),'utf8')}

 for(const file of actual){
  const owner=manifest.tests[file];
  if(!Object.hasOwn(manifest.owners,owner))throw Error('Unknown owner '+owner+' for '+file);
  if(owner==='backend-operator'&&!scripts['test:operator'].includes(file.replace(/^backend\//,'')))throw Error('Unexecuted operator test: '+file);
  if(owner==='backend-import'&&file!=='backend/tests/import-graph.test.mjs')throw Error('Unexecuted backend import test: '+file);
  if(owner==='browser'){
   const workflows=['landing-checks.yml','int24-browser-qa.yml','admin-world-checks.yml'].map(f=>readFileSync(new URL('../.github/workflows/'+f,import.meta.url),'utf8')).join('\n');
   if(!workflows.includes(file))throw Error('Unexecuted browser test: '+file);
  }
  if(owner==='migration'&&!/^backend\/tests\/test_.*migration\.py$/.test(file))throw Error('Migration runner cannot discover: '+file);
  if(owner==='site-node'&&!/^tests\/[^/]+\.test\.mjs$/.test(file))throw Error('Site runner cannot discover: '+file);
  if(['support','manual','browser'].includes(owner)&&/\.test\.[a-z]+$/.test(file))throw Error('Executable test cannot be support: '+file);
  if(owner==='backend-runtime'&&!/(?:runtime\.test\.ts|d1-integration\.test\.ts)$/.test(file))throw Error('Vitest cannot discover: '+file);
  if(owner==='backend-contract'&&!file.endsWith('.test.ts')&&!contracts.includes(file.split('/').at(-1)))throw Error('Contract runner cannot discover: '+file);
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  if(owner==='backend-runtime'&&!/from\s*['"](?:vitest|cloudflare:)/.test(source))throw Error('Invalid runtime ownership: '+file);
  if(owner==='backend-contract'&&(!/from\s*['"]node:test['"]/.test(source)||/from\s*['"](?:vitest|cloudflare:)/.test(source)))throw Error('Invalid Node ownership: '+file);
  (owners[owner]??=[]).push(file);
 }
 return {total:actual.size,owners};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=auditDiscovery();console.log(JSON.stringify(result,null,process.argv.includes('--json')?2:0));
}
