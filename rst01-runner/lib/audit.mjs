import {readPrimary} from './runtime.mjs';

export async function validateCareer(page,career){
  return page.evaluate(async c=>{
    const {validateSave}=await import('/src/engine.js');
    return Boolean(validateSave(c));
  },career);
}

export async function careerShape(page){
  const p=await readPrimary(page);
  const c=p.career||{};
  return page.evaluate(career=>{
    const seen=new WeakSet();
    const matches={};
    const rx={
      contract:/contract|wage|salary|expiry|expire|years/i,
      injury:/injur|fitness|fatigue|condition|medical/i,
      youth:/youth|academy|prospect/i,
      dynamics:/morale|personality|dynamic|happiness|chemistry/i,
      finance:/finance|budget|balance|cash|revenue|expense|wage/i,
      board:/board|objective|confidence|sack/i,
      staff:/staff|coach|scout|facility/i,
      market:/transfer|market|loan|clause|shortlist|scout/i,
      cup:/cup|continental|domestic|tournament|knockout/i,
      history:/history|record|rival/i
    };
    for(const k of Object.keys(rx))matches[k]=[];
    const walk=(value,path='',depth=0)=>{
      if(value===null||value===undefined||depth>7||typeof value!=='object')return;
      if(seen.has(value))return;
      seen.add(value);
      for(const [key,v] of Object.entries(value)){
        const p=path?path+'.'+key:key;
        for(const [kind,re] of Object.entries(rx)){
          if(re.test(key)&&matches[kind].length<80){
            matches[kind].push({
              path:p,
              type:Array.isArray(v)?'array':typeof v,
              value:typeof v==='number'||typeof v==='string'||typeof v==='boolean'?v:undefined
            });
          }
        }
        if(v&&typeof v==='object')walk(v,p,depth+1);
      }
    };
    walk(career);
    return matches;
  },c);
}

export async function playerAttributeAudit(page){
  const p=await readPrimary(page);
  const c=p.career||{};
  return page.evaluate(career=>{
    const players=Array.isArray(career.players)?career.players:[];
    const exclude=/^(id|age|clubId|teamId|number|shirt|height|weight|value|price|wage|salary|contract|matches|appearances|minutes|goals|assists|yellow|red|season|year|birth|retire)/i;
    const collect=(obj,path='',depth=0)=>{
      if(!obj||typeof obj!=='object'||depth>3)return [];
      const out=[];
      for(const [k,v] of Object.entries(obj)){
        const q=path?path+'.'+k:k;
        if(typeof v==='number'&&Number.isFinite(v)&&!exclude.test(k))out.push(q);
        else if(v&&typeof v==='object'&&!Array.isArray(v))out.push(...collect(v,q,depth+1));
      }
      return out;
    };
    const sample=players.slice(0,25).map(p=>({id:p.id,keys:[...new Set(collect(p))].sort()}));
    const common=sample.length?sample.map(x=>new Set(x.keys)).reduce((acc,set)=>new Set([...acc].filter(k=>set.has(k)))):new Set();
    const union=new Set(sample.flatMap(x=>x.keys));
    const ids=players.map(p=>p.id);
    return {
      players:players.length,
      uniqueIds:new Set(ids).size,
      minCandidateAttributes:sample.length?Math.min(...sample.map(x=>x.keys.length)):0,
      maxCandidateAttributes:sample.length?Math.max(...sample.map(x=>x.keys.length)):0,
      commonCandidateAttributes:[...common],
      unionCandidateAttributes:[...union],
      sample:sample.slice(0,8)
    };
  },c);
}

export async function referenceAudit(page){
  const p=await readPrimary(page);
  const c=p.career||{};
  return page.evaluate(career=>{
    const clubs=Array.isArray(career.teams)?career.teams:[];
    const players=Array.isArray(career.players)?career.players:[];
    const clubIds=new Set(clubs.map(x=>x.id));
    const playerIds=new Set(players.map(x=>x.id));
    const orphanClubPlayers=players.filter(p=>p.clubId!=null&&!clubIds.has(p.clubId)).map(p=>p.id);
    const duplicateClubIds=clubs.length-clubIds.size;
    const duplicatePlayerIds=players.length-playerIds.size;
    return {clubs:clubs.length,players:players.length,orphanClubPlayers,duplicateClubIds,duplicatePlayerIds};
  },c);
}
