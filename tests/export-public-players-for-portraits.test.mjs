import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicSource,exportPublicPlayersForPortraits,chooseThreePlayerIds} from '../tools/export-public-players-for-portraits.mjs';
const fake=(id,stats,nat='ITA')=>({id,display_name:'Player '+id,nationality:nat,secondary_nationality:id%2?'BRA':null,age:20,height_cm:180,attributes:{...stats,development_aptitude:99},secret:'never export'});
const builds=[{strength:35,speed:90,agility:90,stamina:30},{strength:58,speed:85,agility:83,stamina:55},{strength:88,speed:50,agility:50,stamina:90},{strength:55,speed:55,agility:55,stamina:60}];
const responses=[Array.from({length:2},(_,i)=>fake(i+1,builds[i],i===0?'ITA':'BRA')),[fake(3,builds[2],'GER'),fake(4,builds[3],'FRA')]];
const mock=async (url,options)=>{
 assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
 assert.equal(url.origin,'https://preview.football-architect.workers.dev');
 const page=url.searchParams.get('page');
 return {status:200,json:async()=>({count:4,totalPages:2,page:+page,pageSize:2,players:responses[+page-1]})};
};
test('source is explicit and origin allowlisted',()=>{
 assert.equal(validatePublicSource('https://preview.football-architect.workers.dev/'),'https://preview.football-architect.workers.dev');
 assert.equal(validatePublicSource('http://app.localhost:2000/'),'http://app.localhost:2000');
 for(const src of ['https://other.dev/','http://preview.football-architect.workers.dev/','https://preview.football-architect.workers.dev/evil','http://localhost:8787/','https://user:pass@preview.football-architect.workers.dev/'])assert.throws(()=>validatePublicSource(src));
});
test('paginated GET exports only identity and athletic public allowlist; picks three distinct builds',async()=>{
 const result=await exportPublicPlayersForPortraits('https://preview.football-architect.workers.dev/',{fetcher:mock});
 assert.equal(result.count,4);assert.equal(result.players.length,4);assert.deepEqual(result.pilot_ids,[1,2,3]);
 for(const p of result.players){assert.deepEqual(Object.keys(p),['id','display_name','nationality','secondary_nationality','attributes']);assert.deepEqual(Object.keys(p.attributes),['strength','speed','stamina','agility']);}
});
test('legacy public path fallback only on known route errors',async()=>{
 const paths=[];
 const fetcher=async url=>{paths.push(url.pathname);return url.pathname==='/api/players'?{status:404}:{status:200,json:async()=>({count:1,totalPages:1,page:1,pageSize:50,players:[fake(9,builds[2])]})};};
 const out=await exportPublicPlayersForPortraits('http://app.localhost:2000/',{fetcher});
 assert.deepEqual(paths,['/api/players','/api/players/page/1']);assert.deepEqual(out.pilot_ids,[9]);
});
test('rejects duplicate, partial and invalid metric content',async()=>{
 const bad=async url=>({status:200,json:async()=>({count:2,totalPages:1,page:1,pageSize:50,players:[fake(1,builds[0]),fake(1,builds[1])]})});
 await assert.rejects(exportPublicPlayersForPortraits('https://preview.football-architect.workers.dev/',{fetcher:bad}),/duplicate/);
 const invalid=async()=>({status:200,json:async()=>({count:1,totalPages:1,page:1,pageSize:50,players:[fake(1,{strength:100,speed:60,stamina:60,agility:60})]})});
 await assert.rejects(exportPublicPlayersForPortraits('https://preview.football-architect.workers.dev/',{fetcher:invalid}),/invalid_athletic/);
});
test('selects three deterministically with no player count assumptions',()=>{
 const players=Array.from({length:150},(_,i)=>fake(i+1,builds[i%4],['ITA','BRA','GER'][i%3]));
 assert.deepEqual(chooseThreePlayerIds(players),[1,2,3]);
});
