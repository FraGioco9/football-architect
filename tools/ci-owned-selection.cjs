// Only modified, previously inventoried standalone test files qualify.
const {execFileSync,spawnSync}=require('node:child_process');
const inventory=require('./ci-test-ownership.json').tests;
const owners=new Set(['site-node','backend-runtime','backend-contract','migration']);
function ownedTests(from,to){
 const raw=execFileSync('git',['diff','--raw','--no-renames','-z',from,to],{encoding:'utf8'}).split('\0');
 const tests=[];
 for(let i=0;i<raw.length-1;i+=2){
  const path=raw[i+1],owner=inventory[path];
  if(!/^:100644 100644 [a-f0-9]+ [a-f0-9]+ M$/.test(raw[i])||!owners.has(owner)||
     !/^(?:backend\/)?tests\/[a-z0-9_.-]+$/.test(path)||path.startsWith('tests/ci-'))return null;
  const stem=path.split('/').pop().replace(/\.(?:mjs|mts|ts|py)$/,'');
  for(const ref of [from,to]){
   const result=spawnSync('git',['grep','-F','-l',stem,ref,'--','*.js','*.mjs','*.cjs','*.ts','*.mts','*.py','*.sh','*.yml',
    ':(exclude)'+path],{encoding:'utf8'});
   if(result.status!==1)return null;
  }
  tests.push({path,owner});
 }
 return tests.length?tests:null;
}
function runBackend(paths){
 const groups=new Map();
 for(const path of paths){
  const owner=inventory[path];
  if(!owners.has(owner)||owner==='site-node')throw Error('Unknown selected backend test: '+path);
  if(!groups.has(owner))groups.set(owner,[]);
  groups.get(owner).push(path);
 }
 for(const [owner,files] of groups){
  if(owner==='backend-runtime')execFileSync('npm',['--prefix','backend','test','--',...files.map(p=>p.slice(8))],{stdio:'inherit'});
  else if(owner==='migration')for(const file of files)execFileSync('python3',['-m','unittest','discover','-s','backend/tests','-p',file.split('/').pop(),'-v'],{stdio:'inherit'});
  else execFileSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
 }
}
if(require.main===module)runBackend((process.env.SELECTED_BACKEND_TESTS||'').split(' ').filter(Boolean));
module.exports={ownedTests};
