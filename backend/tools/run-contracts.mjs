// Keep pure Node contracts separate from real Worker/D1 and operator suites.
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const testRoot=new URL('../tests/',import.meta.url);
export function discoverContracts(root=testRoot){
 const files=readdirSync(root).filter(name=>name.endsWith('.test.ts')&&!name.endsWith('runtime.test.ts')&&name!=='d1-integration.test.ts').sort();
 if(!files.length)throw Error('No backend Node contracts found');
 for(const file of files){
  const source=readFileSync(new URL(file,root),'utf8');
  if(!/from ['"]node:test['"]/.test(source)||/from ['"](?:vitest|cloudflare:)/.test(source))throw Error('Unclassified backend test: '+file);
 }
 return files.map(file=>fileURLToPath(new URL(file,root)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const files=discoverContracts();
 console.log(`Backend Node contract inventory: ${files.length} files`);
 const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}
