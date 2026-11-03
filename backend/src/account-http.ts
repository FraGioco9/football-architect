import {ApiError} from './errors.ts';

/** Restricted, cookie-private JSON responses for authenticated account routes. */
const privateHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
export function accountJson(status:number,body:unknown,extra:Record<string,string>={}):Response {
 return new Response(JSON.stringify(body),{status,headers:{...privateHeaders,...extra}});
}

/** Reject ambiguous duplicate cookie names before authentication. */
export function accountCookie(request:Request,name:string):string {
 const values=(request.headers.get('Cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));
 if(values.length>1)throw new ApiError(401,'unauthorized');
 return values[0]?.slice(name.length+1)??'';
}

/** Bounded strict UTF-8 JSON reader shared by Player and Admin mutations. */
export async function accountInput(request:Request):Promise<unknown> {
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ApiError(415,'json_required');
 const reader=request.body?.getReader();
 if(!reader)throw new ApiError(400,'invalid_json');
 const chunks:Uint8Array[]=[];let total=0;
 try {
  for(;;){
   const {value,done}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>4096){await reader.cancel();throw new ApiError(413,'request_too_large')}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 const data=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown}
 catch{throw new ApiError(400,'invalid_json')}
}
