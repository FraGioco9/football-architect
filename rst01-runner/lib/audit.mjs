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
    const flattenNumeric=(obj,depth=0)=>{
      if(!obj||typeof obj!=='object'||depth>3)return [];
      const out=[];
      for(const [k,v] of Object.entries(obj)){
        if(typeof v==='number'&&Number.isFinite(v))out.push(k);
        else if(v&&typeof v==='object'&&!Array.isArray(v)){
          out.push(...flattenNumeric(v,depth+1).map(x=>k+'.'+x));
        }
      }
      return out;
    };
    const sample=players.slice(0,25).map(p=>({id:p.id,numeric:flattenNumeric(p),age:p.age}));
    const ids=players.map(p=>p.id);
    return {
      players:players.length,
      uniqueIds:new Set(ids).size,
      minNumeric:sample.length?Math.min(...sample.map(x=>x.numeric.length)):0,
      maxNumeric:sample.length?Math.max(...sample.map(x=>x.numeric.length)):0,
      sample
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
