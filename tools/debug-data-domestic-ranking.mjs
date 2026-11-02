// DEBUG-DATA-01: deterministic domestic standings from completed fixtures.
// Head-to-head is reapplied within unresolved groups; canonical rules are read from catalog.
import {hash} from "./debug-data-schema.mjs";
const sortFallback=(a,b,seed)=>b.gd-a.gd||b.gf-a.gf||b.wins-a.wins||hash(seed+":"+a.clubId).localeCompare(hash(seed+":"+b.clubId));
export function rankDomesticLeague(fragment,rules,seed){
 if(rules?.phases?.[0]?.type!=="roundRobin")throw Error("domestic rules missing");
 const matches=fragment.events.filter(e=>e.phaseId==="league"&&e.result);
 const rows=new Map(fragment.participants.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0,wins:0}]));
 for(const e of matches){const h=rows.get(e.homeId),a=rows.get(e.awayId);if(!h||!a)throw Error("foreign club");h.played++;a.played++;h.gf+=e.result.homeGoals;h.ga+=e.result.awayGoals;a.gf+=e.result.awayGoals;a.ga+=e.result.homeGoals;
 if(e.result.homeGoals>e.result.awayGoals){h.won++;h.wins++;a.lost++;h.pts+=3;}else if(e.result.homeGoals<e.result.awayGoals){a.won++;a.wins++;h.lost++;a.pts+=3;}else{h.drawn++;a.drawn++;h.pts++;a.pts++;}}
 for(const r of rows.values())r.gd=r.gf-r.ga;
 const groups=new Map();for(const row of rows.values()){if(!groups.has(row.pts))groups.set(row.pts,[]);groups.get(row.pts).push(row);}
 function resolve(group){
  if(group.length<2)return group;
  const ids=new Set(group.map(r=>r.clubId)),mini=new Map(group.map(r=>[r.clubId,{pts:0,gd:0,gf:0}]));
  for(const e of matches){if(!ids.has(e.homeId)||!ids.has(e.awayId))continue;const h=mini.get(e.homeId),a=mini.get(e.awayId);h.gf+=e.result.homeGoals;a.gf+=e.result.awayGoals;h.gd+=e.result.homeGoals-e.result.awayGoals;a.gd+=e.result.awayGoals-e.result.homeGoals;if(e.result.homeGoals>e.result.awayGoals)h.pts+=3;else if(e.result.homeGoals<e.result.awayGoals)a.pts+=3;else{h.pts++;a.pts++;}}
 const sorted=[...group].sort((a,b)=>{const x=mini.get(a.clubId),y=mini.get(b.clubId);return y.pts-x.pts||y.gd-x.gd||y.gf-x.gf;});
 const key=id=>{const x=mini.get(id);return x.pts+":"+x.gd+":"+x.gf;};
 let result=[];
 for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&key(sorted[j].clubId)===key(sorted[i].clubId))j++;const tied=sorted.slice(i,j);
  if(tied.length===group.length){result.push(...tied.sort((a,b)=>sortFallback(a,b,seed)));}
  else if(tied.length>1){result.push(...resolve(tied));}
  else result.push(tied[0]);i=j;
 }
 return result;
 }
 return [...groups.keys()].sort((a,b)=>b-a).flatMap(pts=>resolve(groups.get(pts)));
}
