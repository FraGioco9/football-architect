import {ApiError} from './errors.ts';

/**
 * HTTP wire contracts only. Authentication, authorization, CSRF, origin and
 * route-level validation remain owned by their individual handlers.
 * Each response profile deliberately preserves its existing cache/privacy policy.
 */
export type HttpProfile='public'|'account'|'local-inbox';
const profiles:Record<HttpProfile,Readonly<Record<string,string>>>={
 public:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
 account:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'},
 'local-inbox':{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
};
export function httpHeaders(profile:HttpProfile):Record<string,string>{return {...profiles[profile]}}
export function httpJson(profile:HttpProfile,status:number,payload:unknown,extra:Record<string,string>={}):Response{
 return new Response(JSON.stringify(payload),{status,headers:{...httpHeaders(profile),...extra}});
}
export function httpError(profile:HttpProfile,error:unknown,fallback:string):Response{
 if(error instanceof ApiError)
  return httpJson(profile,error.status,{error:{code:error.code}},error.status===429?{'Retry-After':'900'}:{});
 return httpJson(profile,503,{error:{code:fallback}});
}
export function routeMethod(request:Request,expected:string,profile:HttpProfile,includeAllow=true):Response|null{
 return request.method===expected?null:httpJson(profile,405,{error:{code:'method_not_allowed'}},includeAllow?{Allow:expected}:{});
}
/** Reject duplicate session cookie names; never fall back to a later cookie. */
export function readSessionCookie(request:Request,name:string):string{
 const values=(request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 if(values.length>1)throw new ApiError(401,'unauthorized');
 return values[0]?.slice(name.length+1)??'';
}
/** Stream-bounded, strict UTF-8 JSON; the 4096-byte wire limit is unchanged. */
export async function readJsonBody(request:Request,limit=4096):Promise<unknown>{
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ApiError(415,'json_required');
 const reader=request.body?.getReader();
 if(!reader)throw new ApiError(400,'invalid_json');
 const chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){
   const {value,done}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>limit){await reader.cancel();throw new ApiError(413,'request_too_large')}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 const data=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown}
 catch{throw new ApiError(400,'invalid_json')}
}
