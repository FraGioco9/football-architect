// #748: bounded, privacy-safe evidence for SH-03's intermittent WebKit requests.
// This observes real Playwright events; it never changes routing or error policy.
const monitored=path=>path==='/api/world'||
 /^\/api\/competitions\/[A-Za-z0-9-]+\/seasons\/[0-9]+$/.test(path)||
 /^\/api\/matches\/seasons\/[0-9]+\/competitions\/[A-Za-z0-9-]+$/.test(path);

const category=value=>{
 const text=String(value||'').toLowerCase();
 if(/abort|cancel/.test(text))return 'aborted';
 if(/access control|cors/.test(text))return 'access-control';
 if(/network|net::|failed/.test(text))return 'network';
 return 'other';
};

export function createSh03NetworkEvidence({publicOrigin,debugOrigin,now=Date.now,limit=96}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>256)throw TypeError('Invalid SH-03 evidence limit');
 const origins=new Map([[new URL(publicOrigin).origin,'public'],
  [new URL(debugOrigin).origin,'debug']]);
 const start=now(),ids=new WeakMap(),events=[];
 let stage='bootstrap',nextId=0;
 const remember=(event,detail)=>{
  events.push({ms:now()-start,stage,event,...detail});
  if(events.length>limit)events.shift();
 };
 const locate=url=>{
  try{
   const address=new URL(url),role=origins.get(address.origin);
   return role?{role,path:address.pathname}:null;
  }catch{return null}
 };
 return Object.freeze({
  setStage(name){stage=name},
  request(event,request,{status,failure}={}){
   const loc=locate(request.url());
   if(!loc||!monitored(loc.path))return;
   if(!ids.has(request))ids.set(request,++nextId);
   const detail={id:ids.get(request),origin:loc.role,method:request.method(),path:loc.path};
   if(Number.isInteger(status))detail.status=status;
   if(failure!==undefined)detail.failureCategory=category(failure);
   remember(event,detail);
  },
  navigation(url){
   const loc=locate(url);
   if(loc)remember('navigation',loc);
  },
  pageError(message){
   const text=String(message||''),path=text.match(/\/api\/[A-Za-z0-9/_-]+/)?.[0]||null;
   remember('pageerror',{errorCategory:category(text),path:monitored(path)?path:null});
  },
  snapshot(){return events.map(event=>({...event}))}
 });
}
