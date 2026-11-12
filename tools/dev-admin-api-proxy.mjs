// Fixed-upstream DEV API bridge: LAN opt-in allows anonymous public GETs only.
// Operator and Player endpoints always require loopback; never published.
import {proxySharedNonproduction,protectedResponseLimit} from './shared-nonproduction-proxy.mjs';
import {isAllowedPublicPlayersPath} from '../backend/src/public-players-filters.mjs';
import {request as httpRequest} from 'node:http';
import {networkInterfaces} from 'node:os';
const loopback=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
const hostPattern=/^(?:localhost|app\.localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;
const ipv4=value=>{
 const v=String(value||'').replace(/^::ffff:/,'');
 const parts=v.split('.');
 return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255)?parts.map(Number).join('.'):null;
};
const privateIPv4=value=>{
 const ip=ipv4(value);if(!ip)return false;
 const [a,b]=ip.split('.').map(Number);
 return a===10||a===172&&b>=16&&b<=31||a===192&&b===168;
};
// Host must be an actual local interface, not an arbitrary private Host header.
const lanHostAllowed=(host,lanHosts)=>{
 const address=/^((?:\d{1,3}\.){3}\d{1,3}):2000$/.exec(host||'')?.[1];
 if(!address||!privateIPv4(address))return false;
 const known=lanHosts??Object.values(networkInterfaces()).flatMap(items=>(items||[]).filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address));
 return known.some(ip=>ipv4(ip)===ipv4(address));
};
const reply=(res,status,code)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code}}));return true};
export async function proxyAdminApi(req,res,{target=process.env.FA_ADMIN_API_TARGET,pool=process.env.FA_ADMIN_API_POOL,send,lanEnabled=process.env.FA_DEV_LAN==='1',lanHosts=null}={}){
 const raw=req.url||'';
 if(!/^\/api\/(?:world(?:$|[?/#])|admin(?:\/|$)|player(?:\/|$)|competitions(?:\/|$)|calendar(?:\/|$)|local-dev(?:\/|$)|clubs(?:\/|$)|players(?:[/?]|$))/.test(raw))return false;
 if(!target)return false;
 // Validate original text too: URL normalizes alternative numeric IP spellings.
 const shared=pool==='dev-preview';
 if(!shared&&!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/?$/.test(target))return reply(res,503,'admin_unavailable');
 let url;try{url=new URL(target)}catch{return reply(res,503,'admin_unavailable')}
 const clubOverview=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/seasons\/[1-9][0-9]{0,8}\/overview$/.test(raw);
 const clubHistory=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/history$/.test(raw);
 const singlePlayer=/^\/api\/players\/[1-9][0-9]*$/.test(raw)&&Number.isSafeInteger(Number(raw.slice('/api/players/'.length)));
 const playersRead=isAllowedPublicPlayersPath(raw)||singlePlayer;
 const publicRead=playersRead||clubOverview||clubHistory||/^\/api\/competitions\/(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])\/seasons\/[1-9][0-9]{0,8}$/.test(raw)||/^\/api\/calendar\/seasons\/[1-9][0-9]{0,8}\/days\/(?:[1-9]|[1-4][0-9]|5[0-6])$/.test(raw);
 const anonymousRead=publicRead||raw==='/api/world';
 const localClient=loopback(req.socket.remoteAddress)&&hostPattern.test(req.headers.host||'');
 const lanPublic=lanEnabled&&anonymousRead&&req.method==='GET'&&privateIPv4(req.socket.remoteAddress)&&lanHostAllowed(req.headers.host,lanHosts);
 if(!(localClient||lanPublic)||(raw.includes('%')&&!playersRead)||raw.includes('\\')||(raw.includes('?')&&!playersRead)||raw.includes('#')||/\/\.{1,2}(?:\/|$)/.test(raw))return reply(res,403,'forbidden');
 const adminRoutes={"/api/admin/players":"GET","/api/admin/players/preview":"POST","/api/admin/players/draft":"POST","/api/admin/players/commit":"POST","/api/admin/session":"GET","/api/admin/login":"POST","/api/admin/logout":"POST","/api/admin/world":"GET","/api/admin/seasons/events":"GET","/api/admin/seasons/archives":"GET","/api/admin/seasons/next-candidate":"GET","/api/admin/seasons/next-approve":"POST","/api/admin/seasons/next-prepare":"POST","/api/admin/seasons/prepare":"POST","/api/admin/seasons/calendar":"POST","/api/admin/seasons/start":"POST","/api/admin/seasons/advance":"POST","/api/admin/seasons/archive":"POST","/api/admin/seasons/close":"POST","/api/admin/world/reset":"POST","/api/admin/seasons/events/initialize":"POST","/api/admin/seasons/events/start":"POST","/api/admin/seasons/events/advance":"POST","/api/admin/seasons/events/confirm":"POST","/api/admin/seasons/events/reschedule":"POST","/api/admin/seasons/events/domestic-calendar":"POST","/api/admin/seasons/events/international-draw":"POST","/api/admin/seasons/events/international-calendar":"POST"};
 const playerRoutes={'/api/player/login':'POST','/api/player/logout':'POST','/api/player/session':'GET','/api/player/sessions':'GET','/api/player/permissions':'GET','/api/player/register':'POST','/api/player/verify-email':'POST','/api/player/password-reset/request':'POST','/api/player/password-reset/complete':'POST','/api/player/account/change-password':'POST','/api/player/account/change-email':'POST','/api/player/account/profile':'POST','/api/player/account/revoke-other-sessions':'POST','/api/player/account/delete':'POST','/api/player/admin/world':'GET'};
 const inbox=raw==='/api/local-dev/inbox';
 const player=raw.startsWith('/api/player/');
 if(player&&!/^app\.localhost(?::\d{1,5})?$/.test(req.headers.host||''))return reply(res,403,'forbidden');
 const method=publicRead||raw==='/api/world'||inbox?'GET':Object.hasOwn(adminRoutes,raw)?adminRoutes[raw]:Object.hasOwn(playerRoutes,raw)?playerRoutes[raw]:null;
 if(!method)return reply(res,404,'not_found');
 if(req.method!==method)return reply(res,405,'method_not_allowed');
 const chunks=[];let length=0;
 try{for await(const chunk of req){length+=chunk.length;if(length>4096)return reply(res,413,'request_too_large');chunks.push(chunk)}}catch{return reply(res,400,'invalid_request')}
 const headers={};for(const key of anonymousRead?[]:['origin','content-type','cookie','x-csrf-token','idempotency-key','accept'])if(req.headers[key]!==undefined)headers[key]=req.headers[key];
 // Preserve the validated external loopback host for the Worker's exact-origin check.
 if(!publicRead)headers.host=req.headers.host;
 const body=Buffer.concat(chunks);if(anonymousRead&&body.length)return reply(res,400,'invalid_request');
 if(shared)return proxySharedNonproduction(req,res,{target,path:raw,body,publicRead:anonymousRead,send});
 const maxResponseBytes=protectedResponseLimit(raw,anonymousRead);
 if(body.length)headers['content-length']=body.length;
 return new Promise(resolve=>{
  const upstream=httpRequest({hostname:url.hostname.replace(/^\[|\]$/g,''),port:url.port,path:raw,method:req.method,headers,timeout:15000},response=>{
   const parts=[];let bytes=0;
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxResponseBytes)upstream.destroy();else parts.push(chunk)});
   response.on('end',()=>{
    if(res.writableEnded)return;
    if(response.statusCode>=300&&response.statusCode<400){resolve(reply(res,503,'admin_unavailable'));return}
    const out={'Content-Type':inbox&&response.headers['content-type']?.startsWith('text/html')?'text/html; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(inbox&&response.headers['content-security-policy'])out['Content-Security-Policy']=response.headers['content-security-policy'];
    for(const key of anonymousRead?[]:['set-cookie','retry-after','allow'])if(response.headers[key]!==undefined)out[key]=response.headers[key];
    res.writeHead(response.statusCode||503,out);res.end(Buffer.concat(parts));resolve(true);
   });
   response.on('error',()=>{if(!res.writableEnded)reply(res,503,'admin_unavailable');resolve(true)});
  });
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.writableEnded)reply(res,503,'admin_unavailable');resolve(true)});
  upstream.end(body);
 });
}
