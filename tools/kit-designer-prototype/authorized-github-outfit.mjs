import {createHash} from 'node:crypto';

// KM-34: Authorized owner-only download of the optional proprietary GLB.
// Never include third-party binaries or GitHub credentials in public Git.
// The DEV server calls this ONLY after its loopback + app.localhost guard.
const MAX_BYTES=100*1024*1024;
const REDIRECT_HOSTS=new Set([
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-production-release-asset-2e65be.s3.amazonaws.com'
]);
function configuration(env){
  const repo=env.FA_KIT_MAKER_GITHUB_REPO,
    id=env.FA_KIT_MAKER_GITHUB_ASSET_ID,
    sha=env.FA_KIT_MAKER_GITHUB_SHA256,
    token=env.FA_KIT_MAKER_GITHUB_TOKEN;
  if(!repo&&!id&&!sha&&!token)return {status:'not-configured'};
  // This flag must only be set when the owner has confirmed the rights.
  if(env.FA_KIT_MAKER_ASSET_RIGHTS_CONFIRMED!=='1')
    return {status:'rights-unverified'};
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo||'')||
     !/^[1-9]\d*$/.test(id||'')||
     !/^[0-9a-fA-F]{64}$/.test(sha||'')||
     typeof token!=='string'||token.length<8)
    return {status:'invalid-configuration'};
  return {status:'ready',repo,id,sha:sha.toLowerCase(),token};
}
function isTrustedRedirect(value){
  try{
    const parsed=new URL(value);
    return parsed.protocol==='https:'&&
      REDIRECT_HOSTS.has(parsed.hostname)&&
      !parsed.username&&!parsed.password&&!parsed.port;
  }catch{return false;}
}
async function readLimitedResponse(response){
  const length=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(length)&&length>MAX_BYTES)
    throw Error('asset-too-large');
  let total=0;
  const parts=[];
  if(response.body?.getReader){
    const reader=response.body.getReader();
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        total+=value.byteLength;
        if(total>MAX_BYTES)throw Error('asset-too-large');
        parts.push(value);
      }
    }finally{reader.releaseLock();}
  }else{
    const bytes=new Uint8Array(await response.arrayBuffer());
    total=bytes.byteLength;
    if(total>MAX_BYTES)throw Error('asset-too-large');
    parts.push(bytes);
  }
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.byteLength;}
  return output;
}
function verifyBinary(bytes,expectedSha){
  if(bytes.length<20||bytes.length>MAX_BYTES||
     bytes[0]!==0x67||bytes[1]!==0x6c||
     bytes[2]!==0x54||bytes[3]!==0x46)return false;
  const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(header.getUint32(4,true)!==2||
     header.getUint32(8,true)!==bytes.length)return false;
  return createHash('sha256').update(bytes).digest('hex')===expectedSha;
}
export function createAuthorizedGitHubOutfitLoader({
  env=process.env,fetcher=fetch
}={}){
  const config=configuration(env);
  let inFlight;
  return async function loadAuthorizedOutfit(){
    if(config.status!=='ready')return {status:config.status};
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const api='https://api.github.com/repos/'+config.repo+
        '/releases/assets/'+config.id;
      const response=await fetcher(api,{
        redirect:'manual',
        headers:{
          Accept:'application/octet-stream',
          Authorization:'Bearer '+config.token,
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':'Football-Architect-DEV-Kit-Maker'
        }
      });
      let asset=response;
      if(response.status===302){
        const location=response.headers?.get?.('location');
        if(!isTrustedRedirect(location))
          return {status:'untrusted-asset-redirect'};
        // A GitHub release's signed binary URL needs no GitHub token.
        // Never forward credentials to another origin.
        asset=await fetcher(location,{
          redirect:'manual',headers:{'User-Agent':'Football-Architect-DEV-Kit-Maker'}
        });
      }
      if(asset.status!==200)return {status:'remote-unavailable'};
      const bytes=await readLimitedResponse(asset);
      if(!verifyBinary(bytes,config.sha))
        return {status:'asset-verification-failed'};
      return {status:'available',bytes:Buffer.from(bytes)};
    })().catch(()=>({status:'remote-unavailable'}));
    const result=await inFlight;
    if(result.status!=='available')inFlight=null; // retries allowed
    return result;
  };
}
