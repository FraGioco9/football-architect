// Fixed-upstream DEV API bridge: LAN opt-in allows anonymous public GETs only.
// Operator and Player endpoints always require loopback; never published.
import {proxySharedNonproduction,protectedResponseLimit,upstreamTimeoutMs} from './shared-nonproduction-proxy.mjs';
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
export async function proxyAdminApi(req,res,{target=process.env.FA_ADMIN_API_TARGET,pool=process.env.FA_ADMIN_API_POOL,send,lanEnabled=process.env.FA_DEV_LAN==='1',lanHosts=null,operatorSource=process.env.FA_DEV_OPERATOR_SOURCE}={}){
 const raw=req.url||'';
 if(!/^\/api\/(?:world(?:$|[?/#])|admin(?:\/|$)|player(?:\/|$)|competitions(?:\/|$)|calendar(?:\/|$)|local-dev(?:\/|$)|clubs(?:\/|$)|players(?:[/?]|$)|matches(?:[/?]|$))/.test(raw))return false;
 if(!target)return false;
 // Validate original text too: URL normalizes alternative numeric IP spellings.
 const shared=pool==='dev-preview';
 if(!shared&&!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[1-9][0-9]{0,4}\/?$/.test(target))return reply(res,503,'admin_unavailable');
 let url;try{url=new URL(target)}catch{return reply(res,503,'admin_unavailable')}
 const clubOverview=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/seasons\/[1-9][0-9]{0,8}\/overview$/.test(raw);
 const clubHistory=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/history$/.test(raw);
 // #553: match only the canonical anonymous club-season fixtures GET.
 const clubFixtures=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/seasons\/([1-9][0-9]*)\/fixtures$/.exec(raw);
 const clubFixturesRead=!!clubFixtures&&Number.isSafeInteger(Number(clubFixtures[2]));
 const clubRoster=/^\/api\/clubs\/((?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40))\/roster(?:\/stats(?:\?season=(?:0|[1-9][0-9]{0,8}))?)?$/.test(raw);
 const singlePlayer=/^\/api\/players\/[1-9][0-9]*$/.test(raw)&&Number.isSafeInteger(Number(raw.slice('/api/players/'.length)));
 // #578: allow exact numeric Player Detail Stats reads through both local
 // and shared DEV bridges. No query, suffix or encoded path is authorized.
 const playerStatsMatch=/^\/api\/players\/([1-9][0-9]*)\/stats$/.exec(raw);
 const singlePlayerStats=!!playerStatsMatch&&Number.isSafeInteger(Number(playerStatsMatch[1]));
 const matchesPlayer=/^\/api\/players\/([1-9][0-9]*)\/matches(?:\?(.*))?$/.exec(raw);
 const playerMatchesRead=!!matchesPlayer&&Number.isSafeInteger(Number(matchesPlayer[1]))&&(()=>{
  if(matchesPlayer[2]===undefined)return true;
  const query=new URLSearchParams(matchesPlayer[2]);
  return [...query.keys()].every(key=>['season','competition','limit','cursor'].includes(key))&&
   new Set(query.keys()).size===[...query.keys()].length;
 })();
 const playersRead=isAllowedPublicPlayersPath(raw)||singlePlayer||singlePlayerStats||playerMatchesRead;
 // #612: official published match lists and numeric match details are public GETs.
 // Keep the proxy as strict as the Worker; reject unsafe, encoded and query paths.
 const matchList=/^\/api\/matches\/seasons\/([1-9][0-9]*)\/competitions\/((?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12]))$/.exec(raw);
 const matchDetail=/^\/api\/matches\/([1-9][0-9]*)(?:\/stats)?$/.exec(raw);
 const directoryRead=/^\/api\/matches\?(?:season=[1-9][0-9]{0,8}&day=(?:[1-9]|[1-4][0-9]|5[0-6])|day=(?:[1-9]|[1-4][0-9]|5[0-6])&season=[1-9][0-9]{0,8})$/.test(raw);
 const matchesRead=directoryRead||(!!matchList&&Number.isSafeInteger(Number(matchList[1])))||
  (!!matchDetail&&Number.isSafeInteger(Number(matchDetail[1])));
 // Contracts is a protected Admin route. Forward only the exact, bounded GET
 // filters the Worker understands; never turn it into an anonymous LAN read.
 const contractsListQuery=req.method==='GET'&&
  /^\/api\/admin\/contracts\?(?:page=[1-9][0-9]{0,3}|playerId=[1-9][0-9]{0,15})$/.test(raw);
 const contractsPath=contractsListQuery?'/api/admin/contracts':raw;
 // Protected licensee lookup: only a canonical, single encoded q value may pass.
 // This does not widen anonymous or LAN access, and prevents query/path ambiguity.
 const licenseAccountPrefix='/api/admin/club-licenses/accounts?q=';
 const licenseAccountQuery=req.method==='GET'&&raw.startsWith(licenseAccountPrefix)&&(()=>{
  const encoded=raw.slice(licenseAccountPrefix.length);
  if(!encoded||encoded.length>1440)return false;
  try{
   const decoded=decodeURIComponent(encoded);
   return decoded.length>=2&&decoded.length<=120&&decoded===decoded.trim()&&
    !/[\x00-\x1f]/.test(decoded)&&encodeURIComponent(decoded)===encoded;
  }catch{return false}
 })();
 const economyQuery=req.method==='GET'&&/^\/api\/admin\/economy\/(?:clubs\?page=[1-7]&checkpoint=[0-9a-f]{64}|ledger\?(?:cursor=[1-9][0-9]{0,14}(?:%3A|:)[0-9a-f-]{36}&)?checkpoint=[0-9a-f]{64})$/i.test(raw);
 const adminPath=economyQuery?raw.split('?')[0]:licenseAccountQuery?'/api/admin/club-licenses/accounts':contractsPath;
 const publicRead=raw==='/api/world/history'||playersRead||matchesRead||clubRoster||clubOverview||clubHistory||clubFixturesRead||/^\/api\/competitions\/(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])\/seasons\/[1-9][0-9]{0,8}$/.test(raw)||/^\/api\/calendar\/seasons\/[1-9][0-9]{0,8}\/days\/(?:[1-9]|[1-4][0-9]|5[0-6])$/.test(raw);
 // #581: exact anonymous World History archive GET (no query, suffix or cookie).
 const anonymousRead=publicRead||raw==='/api/world'||raw==='/api/world/history';
 const localClient=loopback(req.socket.remoteAddress)&&hostPattern.test(req.headers.host||'');
 const lanPublic=lanEnabled&&anonymousRead&&req.method==='GET'&&privateIPv4(req.socket.remoteAddress)&&lanHostAllowed(req.headers.host,lanHosts);
 if(!(localClient||lanPublic)||(raw.includes('%')&&!playersRead&&!licenseAccountQuery&&!economyQuery)||raw.includes('\\')||(raw.includes('?')&&!directoryRead&&!playersRead&&!clubRoster&&!contractsListQuery&&!licenseAccountQuery&&!economyQuery)||raw.includes('#')||/\/\.{1,2}(?:\/|$)/.test(raw))return reply(res,403,'forbidden');
 const adminRoutes={"/api/admin/inspection/access":"GET","/api/admin/economy/clubs":"GET","/api/admin/economy/ledger":"GET","/api/admin/reset/options":"GET","/api/admin/reset/preview":"POST","/api/admin/economy/summary":"GET","/api/admin/economy/reconciliation":"GET","/api/admin/club-licenses":"GET|POST","/api/admin/club-licenses/accounts":"GET","/api/admin/contracts":"GET","/api/admin/contracts/preview":"POST","/api/admin/contracts/sign":"POST","/api/admin/players":"GET","/api/admin/players/preview":"POST","/api/admin/players/draft":"POST","/api/admin/players/commit":"POST","/api/admin/session":"GET","/api/admin/login":"POST","/api/admin/logout":"POST","/api/admin/world":"GET","/api/admin/seasons/events":"GET","/api/admin/seasons/archives":"GET","/api/admin/seasons/next-candidate":"GET","/api/admin/seasons/next-approve":"POST","/api/admin/seasons/next-prepare":"POST","/api/admin/seasons/prepare":"POST","/api/admin/seasons/calendar":"POST","/api/admin/seasons/start":"POST","/api/admin/seasons/advance":"POST","/api/admin/seasons/archive":"POST","/api/admin/seasons/close":"POST","/api/admin/world/reset":"POST","/api/admin/seasons/events/initialize":"POST","/api/admin/seasons/events/start":"POST","/api/admin/seasons/events/advance":"POST","/api/admin/seasons/events/confirm":"POST","/api/admin/seasons/events/reschedule":"POST","/api/admin/seasons/events/domestic-calendar":"POST","/api/admin/seasons/events/international-draw":"POST","/api/admin/seasons/events/international-calendar":"POST"};
 // Only the explicit shared-D1 loopback launcher may proxy the operator.
 const devOperator=raw==='/api/admin/dev-operator'&&localClient&&!shared&&!lanEnabled&&
  req.headers.host==='app.localhost:2000'&&target.replace(/\/$/,'')==='http://127.0.0.1:8787'&&
  typeof operatorSource==='string'&&/^[a-f0-9]{40}$/.test(operatorSource);
 if(devOperator)adminRoutes[raw]='GET|POST';
 const playerRoutes={'/api/player/login':'POST','/api/player/logout':'POST','/api/player/session':'GET','/api/player/sessions':'GET','/api/player/permissions':'GET','/api/player/register':'POST','/api/player/verify-email':'POST','/api/player/password-reset/request':'POST','/api/player/password-reset/complete':'POST','/api/player/account/change-password':'POST','/api/player/account/change-email':'POST','/api/player/account/profile':'POST','/api/player/account/revoke-other-sessions':'POST','/api/player/account/delete':'POST','/api/player/admin/world':'GET'};
 const inbox=raw==='/api/local-dev/inbox';
 const player=raw.startsWith('/api/player/');
 if(player&&!/^app\.localhost(?::\d{1,5})?$/.test(req.headers.host||''))return reply(res,403,'forbidden');
 const method=anonymousRead||inbox?'GET':Object.hasOwn(adminRoutes,adminPath)?adminRoutes[adminPath]:Object.hasOwn(playerRoutes,raw)?playerRoutes[raw]:null;
 if(!method)return reply(res,404,'not_found');
 if(method==='GET|POST'?!['GET','POST'].includes(req.method):req.method!==method)return reply(res,405,'method_not_allowed');
 const chunks=[];let length=0;
 try{for await(const chunk of req){length+=chunk.length;if(length>(devOperator?8*1024*1024:4096))return reply(res,413,'request_too_large');chunks.push(chunk)}}catch{return reply(res,400,'invalid_request')}
 const headers={};for(const key of anonymousRead?[]:['origin','content-type','cookie','x-csrf-token','idempotency-key','accept'])if(req.headers[key]!==undefined)headers[key]=req.headers[key];
 // Preserve the validated external loopback host for the Worker's exact-origin check.
 if(!publicRead)headers.host=req.headers.host;
 const body=Buffer.concat(chunks);if(anonymousRead&&body.length)return reply(res,400,'invalid_request');
 if(shared)return proxySharedNonproduction(req,res,{target,path:raw,body,publicRead:anonymousRead,send});
 const maxResponseBytes=devOperator?8*1024*1024:protectedResponseLimit(raw,anonymousRead);
 if(body.length)headers['content-length']=body.length;
 return new Promise(resolve=>{
  const upstream=httpRequest({hostname:url.hostname.replace(/^\[|\]$/g,''),port:url.port,path:raw,method:req.method,headers,timeout:devOperator?300000:upstreamTimeoutMs(raw,req.method)},response=>{
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
