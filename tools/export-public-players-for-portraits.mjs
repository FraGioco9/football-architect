/** Public-only, read-only player export for the portrait pilot (#608).
 * Never uses Admin APIs, cookies, credentials, or direct D1 operations.
 */
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {classifyAthleticBody} from './players-portrait-body.mjs';

const METRICS=Object.freeze(['strength','speed','stamina','agility']);
export function validatePublicSource(source){
 let url;
 try{url=new URL(source)}catch{throw new TypeError('invalid_public_source')}
 const hosted=url.protocol==='https:'&&url.hostname==='preview.football-architect.workers.dev'&&!url.port;
 const local=url.protocol==='http:'&&['localhost','app.localhost','127.0.0.1'].includes(url.hostname)&&url.port==='2000';
 if(!(hosted||local)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw new TypeError('unsupported_public_source');
 return url.origin;
}
function projectPublicPlayer(player){
 if(!player||typeof player!=='object'||Array.isArray(player)||!Number.isSafeInteger(player.id)||player.id<1)
  throw new TypeError('invalid_public_player_id');
 if(typeof player.display_name!=='string'||!player.display_name.trim()||player.display_name.length>160)
  throw new TypeError('invalid_public_player_name');
 if(!/^[A-Z]{3}$/.test(player.nationality)||
    (player.secondary_nationality!=null&&!/^[A-Z]{3}$/.test(player.secondary_nationality)))
  throw new TypeError('invalid_public_player_nationality');
 const metrics={};
 for(const key of METRICS)metrics[key]=player.attributes?.[key];
 classifyAthleticBody(metrics);
 return {id:player.id,display_name:player.display_name,
  nationality:player.nationality,secondary_nationality:player.secondary_nationality??null,
  attributes:metrics};
}
async function readPage(base,page,fetcher){
 const fetchPage=async path=>{
  const response=await fetcher(new URL(path,base),{
   method:'GET',credentials:'omit',redirect:'error',headers:{Accept:'application/json'}
  });
  if(!response||typeof response.status!=='number')throw new Error('public_fetch_unavailable');
  return response;
 };
 let response=await fetchPage(`/api/players?page=${page}`);
 // Compatibility with the previous hosted Preview path API.
 if([404,405,422].includes(response.status))response=await fetchPage(`/api/players/page/${page}`);
 if(response.status!==200)throw new Error('public_players_http_'+response.status);
 const json=await response.json();
 if(!json||!Array.isArray(json.players)||!Number.isSafeInteger(json.count)||json.count<0||json.count>10000||
    !Number.isSafeInteger(json.page)||json.page!==page||!Number.isSafeInteger(json.totalPages)||
    json.totalPages<1||json.totalPages>200||!Number.isSafeInteger(json.pageSize)||
    json.pageSize<1||json.pageSize>100||json.players.length>json.pageSize)
  throw new TypeError('invalid_public_page');
 return json;
}
export function chooseThreePlayerIds(players){
 const selected=[],classes=new Set(),nationalities=new Set();
 const candidates=players.map(p=>({id:p.id,nationality:p.nationality,
  body:classifyAthleticBody(p.attributes).body_profile})).sort((a,b)=>a.id-b.id);
 while(selected.length<Math.min(3,candidates.length)){
  const remaining=candidates.filter(c=>!selected.some(p=>p.id===c.id));
  remaining.sort((a,b)=>{
   const sa=Number(!classes.has(a.body))*2+Number(!nationalities.has(a.nationality));
   const sb=Number(!classes.has(b.body))*2+Number(!nationalities.has(b.nationality));
   return sb-sa||a.id-b.id;
  });
  const next=remaining[0];
  selected.push(next);classes.add(next.body);nationalities.add(next.nationality);
 }
 return selected.map(p=>p.id);
}
export async function exportPublicPlayersForPortraits(source,{fetcher=fetch}={}){
 const base=validatePublicSource(source);
 const first=await readPage(base,1,fetcher);
 const all=first.players.map(projectPublicPlayer);
 for(let page=2;page<=first.totalPages;page++){
  const next=await readPage(base,page,fetcher);
  if(next.count!==first.count||next.totalPages!==first.totalPages||next.pageSize!==first.pageSize)
   throw new Error('public_players_pagination_changed');
  all.push(...next.players.map(projectPublicPlayer));
 }
 if(all.length!==first.count||new Set(all.map(p=>p.id)).size!==all.length)
  throw new Error('public_players_incomplete_or_duplicate');
 all.sort((a,b)=>a.id-b.id);
 return {count:all.length,players:all,pilot_ids:chooseThreePlayerIds(all)};
}
function parseArgs(args){
 if(args.length!==4||args[0]!=='--source'||args[2]!=='--output'||!args[1]||!args[3])
  throw new Error('usage: node tools/export-public-players-for-portraits.mjs --source https://preview.football-architect.workers.dev/ --output ./players-public.json');
 return {source:args[1],output:args[3]};
}
async function main(){
 const {source,output}=parseArgs(process.argv.slice(2));
 const data=await exportPublicPlayersForPortraits(source);
 if(data.count<3)throw new Error('fewer_than_three_public_players');
 await writeFile(output,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 process.stdout.write(`Read ${data.count} public players; selected pilot IDs: ${data.pilot_ids.join(', ')}. Saved ${output}\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
