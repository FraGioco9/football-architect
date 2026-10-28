import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {openLocalDatabase,manageAccount} from './operator-local.mts';

async function main(){
 const [operation,...flags]=process.argv.slice(2);
 if(!['create','replace-password'].includes(operation)||flags.length!==4||flags[0]!=='--email'||flags[2]!=='--persist-to'||!process.stdin.isTTY||!process.stderr.isTTY)throw Error('operator_usage');
 // Swallow readline terminal echo; no password argv/env/file/log channel.
 const silent=new Writable({write(_chunk,_encoding,done){done()}});
 const input=createInterface({input:process.stdin,output:silent,terminal:true,historySize:0});
 let password:string;
 try{
  process.stderr.write('Password (hidden): ');password=await input.question('');process.stderr.write('\nConfirm (hidden): ');
  if(await input.question('')!==password)throw Error('password_mismatch');
  process.stderr.write('\n');
 }finally{input.close();silent.end()}
 const handle=await openLocalDatabase(flags[3]);
 try{await manageAccount(handle.db,operation,flags[1],password!)}finally{await handle.close()}
 process.stdout.write('Local operator action completed. Remote database targets are unsupported.\n');
}
main().catch(()=>{
 process.stderr.write('Local operator action failed. Use create|replace-password --email IDENTIFIER --persist-to ABSOLUTE_LOCAL_DIRECTORY from a TTY; check password policy and local account state. No remote target is supported.\n');
 process.exitCode=1;
});
