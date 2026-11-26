// The rehearsal runs from an archive of the same paths compared for inheritance.
const {execFileSync,spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const {once}=require('node:events');
const {mkdtempSync,mkdirSync,symlinkSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const inputs=['backend/src','backend/migrations','backend/catalogues','backend/tools','backend/package.json',
 'backend/package-lock.json','backend/tsconfig.json','backend/wrangler.toml','backend/tests/prepare-persistence.test.mts',
 'backend/tests/fixtures','data','tools/world-bootstrap-791','assets/competition-rewards.mjs','assets/routes-registry.mjs',
 'assets/sporting-contract.js','assets/world-calendar-model.js','tools/match-first-paint.mjs','assets/match-references.mjs',
 'assets/match-public-context.mjs','assets/match-scoreboard-themes.mjs','assets/public-image-urls.mjs','docs/architecture',
 'tools/ci-economic-inputs.cjs','.gitattributes'];
async function run(){
 const temp=mkdtempSync(join(tmpdir(),'economic-rehearsal-'));
 try{
  const tree=join(temp,'source'),archive=join(temp,'inputs.tar');mkdirSync(tree);
  execFileSync('git',['archive','-o',archive,'HEAD','--',...inputs]);
  execFileSync('tar',['-xf',archive,'-C',tree]);
  symlinkSync(resolve('backend/node_modules'),join(tree,'backend/node_modules'),'dir');
  const child=spawn(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap',
   '--test-name-pattern=^opening world end-to-end:', 'tests/prepare-persistence.test.mts'],
   {cwd:join(tree,'backend'),stdio:['ignore','pipe','inherit']});
  const closed=once(child,'close');let executed=false;
  for await(const line of createInterface({input:child.stdout})){
   console.log(line);
   if(/^ok \d+ - opening world end-to-end:/.test(line)&&!/# (SKIP|TODO)/i.test(line))executed=true;
  }
  if((await closed)[0]!==0||!executed)throw Error('Missing successful isolated two-season execution');
 }finally{rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module)run();
module.exports={inputs};
