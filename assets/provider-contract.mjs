// A04 contract primitives. Source access is injected; no built-in I/O or publication.
const providers=['static','dev-fictional','verified-historical'];
const echo=['competitionId','selectedSeason','scope','requestId','contextRevision'];
const text=x=>typeof x==='string'&&x.trim().length>0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function json(value,seen=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||seen.has(value)||!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)return false;
 seen.add(value);
 const valid=Object.entries(value).every(([key,item])=>!['__proto__','prototype','constructor'].includes(key)&&json(item,seen));
 seen.delete(value);return valid;
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value;}
const snapshot=value=>freeze(structuredClone(value));
function requestShape(r){return object(r)&&text(r.competitionId)&&positive(r.selectedSeason)&&positive(r.contextRevision)&&['season','history'].includes(r.scope)&&text(r.requestId);}
export function validateRequest(request,getCompetition){
 if(!requestShape(request)||!json(request)||typeof getCompetition!=='function'||getCompetition(request.competitionId)?.id!==request.competitionId)throw TypeError('Invalid provider request');
 return snapshot(request);
}
export function validateResponse(response,request,options){
 if(!requestShape(request)||!object(options)||!providers.includes(options.providerId)||!object(response)||!json(response)||response.schemaVersion!==1||response.providerId!==options.providerId||echo.some(key=>response[key]!==request[key]))return null;
 const {status,data,reason,provenance:p}=response;
 if(!object(p)||!['none','fictional','verified'].includes(p.kind)||typeof p.approved!=='boolean'||!['none','partial','complete'].includes(p.coverage)||!(p.sourceRef===null||text(p.sourceRef)))return null;
 const usable=['partial','available'].includes(status);
 if(!usable){
  const reasons=status==='empty'?['no-results','disabled']:status==='unavailable'?['unsupported','source-unavailable','invalid-data','unapproved-source']:[];
  if(data!==null||!reasons.includes(reason)||p.coverage!=='none'||p.approved||p.kind==='verified')return null;
 }else{
  if(reason!==null||!object(data)||p.coverage==='none'||!text(p.sourceRef)||options.providerId==='static')return null;
  if(options.providerId==='dev-fictional'&&(p.kind!=='fictional'||p.approved||request.competitionId.startsWith('int-')))return null;
  if(options.providerId==='verified-historical'&&(p.kind!=='verified'||!p.approved||options.approved!==true||!text(options.sourceRef)||p.sourceRef!==options.sourceRef||request.scope==='history'&&p.coverage!=='complete'))return null;
  if(request.scope==='season'&&(data.season!==request.selectedSeason||data.status!==status))return null;
  // Source-specific domain validation is mandatory. Unexpected validator errors
  // propagate; callers must not disguise programming errors as empty sports data.
  if(typeof options.validateData!=='function'||options.validateData(data,request)!==true)return null;
 }
 if(options.providerId==='static'&&(p.kind!=='none'||p.approved)||options.providerId==='dev-fictional'&&(p.kind!=='fictional'||p.approved))return null;
 return snapshot(response);
}
const leaseKeys=[...echo,'providerId','owner','slot','generation'];
export function captureLease(state){
 if(!requestShape(state)||!providers.includes(state.providerId)||!text(state.owner)||!text(state.slot)||!positive(state.generation)||state.disposed)throw TypeError('Invalid provider lease');
 if(state.providerId==='dev-fictional'&&(typeof state.enabled!=='boolean'||!Number.isSafeInteger(state.progressGeneration)||state.progressGeneration<0||!Number.isInteger(state.debugSeason)||state.debugSeason<0||state.debugSeason>4||!Number.isInteger(state.matchdays)||state.matchdays<0))throw TypeError('Invalid DEV lease');
 if(!json(state))throw TypeError('Invalid lease snapshot');
 return snapshot(state);
}
export function isCurrentLease(lease,current){
 try{captureLease(lease);captureLease(current)}catch{return false;}
 if(!object(lease)||!object(current)||current.disposed||leaseKeys.some(key=>lease[key]!==current[key]))return false;
 if(lease.providerId==='dev-fictional'&&(!current.enabled||current.debugSeason===0||['enabled','progressGeneration','debugSeason','matchdays'].some(key=>lease[key]!==current[key])))return false;
 return lease.view===current.view&&lease.routeBinding===current.routeBinding;
}

// Adapters explicitly classify expected transport/source failures. Validator or
// programming errors are never silently converted into empty sports data.
export class ProviderSourceError extends Error {}

export function createProvider({id,getCompetition,load,validateData,sourceRef=null,approved=false}){
 if(!providers.includes(id)||typeof getCompetition!=='function'||typeof load!=='function')throw TypeError('Invalid provider configuration');
 const options=Object.freeze({providerId:id,sourceRef,approved,validateData});
 const unavailable=(request,reason)=>snapshot({
  ...Object.fromEntries(echo.map(key=>[key,request[key]])),schemaVersion:1,providerId:id,
  status:'unavailable',data:null,reason,
  provenance:{kind:id==='dev-fictional'?'fictional':'none',sourceRef:null,approved:false,coverage:'none'}
 });
 return Object.freeze({id,async read(input){
  const request=validateRequest(input,getCompetition);
  if(id==='verified-historical'&&(!text(sourceRef)||approved!==true))return unavailable(request,'source-unavailable');
  let response;
  try{response=await load(request)}catch(error){
   if(error instanceof ProviderSourceError)return unavailable(request,'source-unavailable');
   throw error;
  }
  // Keep domain validation outside the source-error catch: a validator throwing
  // even ProviderSourceError is still an unexpected validator failure.
  const accepted=validateResponse(response,request,options);
  if(accepted)return accepted;
  const unapproved=id==='verified-historical'&&response?.data!=null&&
   (response.provenance?.kind!=='verified'||response.provenance?.approved!==true||response.provenance?.sourceRef!==sourceRef);
  return unavailable(request,unapproved?'unapproved-source':'invalid-data');
 }});
}
