// Owner-only local Admin permissions helper. Never serves HTTP or targets remote D1.
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const backend=resolve(root,'backend');
const persist=resolve(backend,'.wrangler','state');
const [action,email,...extra]=process.argv.slice(2);
if(!['init','status','grant','revoke'].includes(action)||extra.length||action!=='init'&&(!email||!/^\S+@\S+\.\S+$/.test(email))||action==='init'&&email){
 process.stderr.write('Usage: node tools/dev-auth-admin.mjs init | status EMAIL | grant EMAIL | revoke EMAIL\n');
 process.exitCode=2;
}else{
 const args=['--experimental-strip-types','tools/admin-permissions.mts',action,'--environment','dev','--persist-to',persist];
 if(action!=='init')args.push('--email',email);
 if(action!=='status')args.push('--apply');
 process.stdout.write('LOCAL ONLY. Uses backend/.wrangler/state; NEVER remote D1. Stop the local Worker before granting/revoking.\n');
 const result=spawnSync(process.execPath,args,{cwd:backend,stdio:'inherit',shell:false});
 process.exitCode=result.status??1;
}
