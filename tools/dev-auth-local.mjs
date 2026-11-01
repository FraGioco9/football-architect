// Local-only combined launcher. Does not invoke Cloudflare remote operations.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==2)throw Error('No arguments accepted by local auth launcher');
const localEnv={...process.env,FA_ADMIN_API_TARGET:'http://127.0.0.1:8787',FA_ADMIN_API_POOL:''};
const backend=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','--prefix','backend'],{cwd:root,env:localEnv,stdio:'inherit',shell:process.platform==='win32'});
const frontend=spawn(process.execPath,['tools/dev-app-preview.mjs'],{cwd:root,env:localEnv,stdio:'inherit'});
let stopping=false;
function stop(){
 if(stopping)return;stopping=true;
 for(const child of [frontend,backend])if(child.pid)child.kill();
}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,stop);
for(const child of [frontend,backend])child.on('exit',code=>{if(!stopping){stop();process.exitCode=code||1;}});
process.stdout.write('Local account pages: http://app.localhost:2000/account/register\nDEV inbox: http://app.localhost:2000/api/local-dev/inbox\nStop with Ctrl+C. No remote D1, email or deploy.\n');
