// Opt-in fixed loopback API bridge; never published, no arbitrary URL forwarding.
import {request as httpRequest} from 'node:http';
const loopback=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
const hostPattern=/^(?:localhost|app\.localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;
const reply=(res,status,code)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code}}));return true};
export async function proxyAdminApi(req,res,{target=process.env.FA_ADMIN_API_TARGET}={}){
 const raw=req.url||'';
 if(!/^\/api\/(?:world(?:$|[?/#])|admin(?:\/|$)|competitions(?:\/|$))/.test(raw))return false;
 if(!target)return false;
 // Validate original text too: URL normalizes alternative numeric IP spellings.
 if(!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/?$/.test(target))return reply(res,503,'admin_unavailable');
 let url;try{url=new URL(target)}catch{return reply(res,503,'admin_unavailable')}
 if(!loopback(req.socket.remoteAddress)||!hostPattern.test(req.headers.host||'')||raw.includes('%')||raw.includes('\\')||raw.includes('?')||raw.includes('#')||/\/\.{1,2}(?:\/|$)/.test(raw))return reply(res,403,'forbidden');
 const publicRead=/^\/api\/competitions\/(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])\/seasons\/[1-9][0-9]{0,8}$/.test(raw);
 if(!publicRead&&raw!=='/api/world'&&!['/api/admin/session','/api/admin/login','/api/admin/logout','/api/admin/world','/api/admin/seasons/prepare'].includes(raw))return reply(res,404,'not_found');
 if(!['GET','POST'].includes(req.method)||publicRead&&req.method!=='GET')return reply(res,405,'method_not_allowed');
 const chunks=[];let length=0;
 try{for await(const chunk of req){length+=chunk.length;if(length>4096)return reply(res,413,'request_too_large');chunks.push(chunk)}}catch{return reply(res,400,'invalid_request')}
 const headers={};for(const key of publicRead?[]:['origin','content-type','cookie','x-csrf-token','idempotency-key'])if(req.headers[key]!==undefined)headers[key]=req.headers[key];
 const body=Buffer.concat(chunks);if(publicRead&&body.length)return reply(res,400,'invalid_request');if(body.length)headers['content-length']=body.length;
 return new Promise(resolve=>{
  const upstream=httpRequest({hostname:url.hostname.replace(/^\[|\]$/g,''),port:url.port,path:raw,method:req.method,headers,timeout:15000},response=>{
   const parts=[];let bytes=0;
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes>(publicRead?524288:65536))upstream.destroy();else parts.push(chunk)});
   response.on('end',()=>{
    if(res.writableEnded)return;
    if(response.statusCode>=300&&response.statusCode<400){resolve(reply(res,503,'admin_unavailable'));return}
    const out={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    for(const key of publicRead?[]:['set-cookie','retry-after','allow'])if(response.headers[key]!==undefined)out[key]=response.headers[key];
    res.writeHead(response.statusCode||503,out);res.end(Buffer.concat(parts));resolve(true);
   });
   response.on('error',()=>{if(!res.writableEnded)reply(res,503,'admin_unavailable');resolve(true)});
  });
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.writableEnded)reply(res,503,'admin_unavailable');resolve(true)});
  upstream.end(body);
 });
}
