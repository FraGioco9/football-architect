// Synthetic server-only approval. Never imported by production modules or public assets.
export function syntheticCatalogue(){
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const clubIds=countries.flatMap(c=>Array.from({length:40},(_,i)=>`${c}-${i+1}`));
 const competitions=[...countries.flatMap(c=>[1,2].map(tier=>({id:`${c}-${tier}`,rulesVersion:tier===1?'domestic-top-v1':'domestic-second-v1',rules:{synthetic:true,points:3,calendarDays:56}}))),
 ...['int-1','int-2'].map(id=>({id,rulesVersion:'international-int24-v1',rules:{synthetic:true,leagueMatches:6,neutralFinal:true}}))];
 return {clubIds,competitions};
}
export async function syntheticManifest(api:any){
 const catalogue=syntheticCatalogue();
 const bindings=catalogue.competitions.map(c=>({competitionId:c.id,rulesVersion:c.rulesVersion,clubIds:c.id.startsWith('int-')
 ? ['IT','ENG','ES','DE','FR','PT','NL','BR'].flatMap(country=>[1,2,3].map(i=>`${country}-${i+(c.id==='int-1'?0:4)}`))
 : Array.from({length:16},(_,i)=>`${c.id.split('-')[0]}-${i+1+(c.id.endsWith('-1')?0:16)}`)}));
 // Independently calculated with Python hashlib over sorted-key compact JSON.
 const hashes={participantsHash:'b80cf4f05815403fc3800787b883709812672b77e9878fee6b0420c6a2897d0e',rulesHash:'379722e543f753b294bb01728f17c4f6929e6b2dd0e743554ac04bca3f75b213'};
 return {manifestVersion:1,approvalReference:'synthetic:test-only:2026-10-28',...hashes,bindings};
}
export async function syntheticApproval(api:any){return api.validateApprovedSnapshot(await syntheticManifest(api),syntheticCatalogue())}
