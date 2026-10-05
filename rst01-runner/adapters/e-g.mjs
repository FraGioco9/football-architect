import {
  assert,exportProbe,navigateCore,pass,nonExecuted,readPrimary,uiProbe
} from '../lib/runtime.mjs';
import {careerShape,playerAttributeAudit,referenceAudit} from '../lib/audit.mjs';

async function pageFeature(ctx,pageId,regex){
  await navigateCore(ctx.page,pageId);
  const probe=await uiProbe(ctx.page);
  const re=new RegExp(regex,'i');
  return {
    title:probe.title,
    actions:probe.actions.filter(x=>re.test(x)),
    buttons:probe.buttons.filter(x=>re.test((x.action||'')+' '+(x.text||''))).slice(0,40),
    textMatch:re.test(probe.text)
  };
}

async function E01(ctx){
  const audit=await playerAttributeAudit(ctx.page);
  assert(audit.players>0,'E01 no players found',audit);
  assert(audit.uniqueIds===audit.players,'E01 duplicate player ids',audit);
  if(audit.maxNumeric<40)return nonExecuted('Player sample exposes fewer than 40 numeric attribute/stat fields',{audit});
  return pass({players:audit.players,uniqueIds:audit.uniqueIds,minNumeric:audit.minNumeric,maxNumeric:audit.maxNumeric,sample:audit.sample.slice(0,5)});
}

async function E02(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for E02');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,newSeason,validateSave}=await import('/src/engine.js');
    const metrics=player=>Object.fromEntries(Object.entries(player||{}).filter(([k,v])=>/contract|wage|salary|expiry|expire|years/i.test(k)&&(['number','string','boolean'].includes(typeof v))));
    const before=(career.players||[]).slice(0,100).map(p=>({id:p.id,m:metrics(p)}));
    const target=career.fixtures?.length||0;
    while(career.round<target)simulateRound(career);
    newSeason(career);
    const after=(career.players||[]).slice(0,100).map(p=>({id:p.id,m:metrics(p)}));
    let changed=0,fields=0;
    for(const a of after){
      fields+=Object.keys(a.m).length;
      const b=before.find(x=>x.id===a.id);
      if(b&&JSON.stringify(a.m)!==JSON.stringify(b.m))changed++;
    }
    return {valid:validateSave(career),changed,fields,before:before.slice(0,8),after:after.slice(0,8)};
  },p.career);
  assert(result.valid===true,'E02 season rollover invalidated save',result);
  const ui=await pageFeature(ctx,'squad','contract|renew|wage|salary');
  const exports=await exportProbe(ctx.page,['contract','renew','wage','salary','release']);
  if(result.fields===0||(!ui.actions.length&&!ui.buttons.length&&!exports.length))return nonExecuted('Contract state or contract controls/API not discoverable',{result,ui,exports});
  if(result.changed===0)return nonExecuted('Contract fields did not change across completed-season rollover',{result,ui,exports});
  return pass({result,ui,exports:exports.slice(0,30)});
}

async function E03(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for E03');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,newSeason,validateSave}=await import('/src/engine.js');
    const beforeIds=new Set((career.players||[]).map(p=>p.id));
    const beforeYoung=(career.players||[]).filter(p=>Number(p.age)<=20).length;
    const target=career.fixtures?.length||0;
    while(career.round<target)simulateRound(career);
    newSeason(career);
    const after=career.players||[];
    const newPlayers=after.filter(p=>!beforeIds.has(p.id));
    return {
      valid:validateSave(career),
      beforeYoung,
      afterYoung:after.filter(p=>Number(p.age)<=20).length,
      newPlayers:newPlayers.slice(0,30).map(p=>({id:p.id,age:p.age,clubId:p.clubId})),
      newYoung:newPlayers.filter(p=>Number(p.age)<=21).length
    };
  },p.career);
  assert(result.valid===true,'E03 rollover invalidated save',result);
  const ui=await pageFeature(ctx,'youth','youth|academy|promot|develop');
  const exports=await exportProbe(ctx.page,['youth','academy','promot','develop']);
  if(result.newYoung===0&&(!ui.actions.length&&!ui.buttons.length&&!exports.length))return nonExecuted('No generated/promoted youth evidence found',{result,ui,exports});
  return pass({result,ui,exports:exports.slice(0,30)});
}

async function E04(ctx){
  const soak=ctx.shared.worldSoak;
  if(!soak)return nonExecuted('Ten-season soak evidence not available before E04');
  const churn=soak.playerChurn||{};
  if(!(churn.newIds>0)||!(churn.retained<churn.initial))return nonExecuted('Ten-season soak did not demonstrate both incoming and retired/removed player IDs',{churn});
  return pass({churn,final:soak.final});
}

async function E05(ctx){
  const shape=await careerShape(ctx.page);
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for E05');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const pick=player=>Object.fromEntries(Object.entries(player||{}).filter(([k,v])=>/morale|personality|dynamic|happiness|chemistry/i.test(k)&&(['number','string','boolean'].includes(typeof v))));
    const before=(career.players||[]).slice(0,80).map(p=>({id:p.id,m:pick(p)}));
    for(let i=0;i<Math.min(8,Math.max(1,(career.fixtures?.length||1)-career.round));i++)simulateRound(career);
    const after=(career.players||[]).slice(0,80).map(p=>({id:p.id,m:pick(p)}));
    let changed=0,fields=0;
    for(const a of after){fields+=Object.keys(a.m).length;const b=before.find(x=>x.id===a.id);if(b&&JSON.stringify(a.m)!==JSON.stringify(b.m))changed++;}
    return {valid:validateSave(career),fields,changed};
  },p.career);
  assert(result.valid===true,'E05 simulated dynamics invalidated save',result);
  const exports=await exportProbe(ctx.page,['morale','personality','dynamic','happiness','chemistry']);
  if(shape.dynamics.length===0&&result.fields===0&&exports.length===0)return nonExecuted('No personality/dynamics state or API discovered',{shape:shape.dynamics,result,exports});
  return pass({statePaths:shape.dynamics.slice(0,40),result,exports:exports.slice(0,30)});
}

async function F01(ctx){
  const ui=await pageFeature(ctx,'market','transfer|offer|bid|buy|sell');
  const exports=await exportProbe(ctx.page,['transfer','offer','bid','negot']);
  const shape=await careerShape(ctx.page);
  if((!ui.actions.length&&!ui.buttons.length)&&!exports.length)return nonExecuted('No transfer negotiation UI/API discovered',{ui,exports});
  if(shape.market.length===0)return nonExecuted('Transfer UI/API exists but no persistent market state footprint found',{ui,exports});
  return pass({ui,exports:exports.slice(0,40),statePaths:shape.market.slice(0,50)});
}

async function F02(ctx){
  const ui=await pageFeature(ctx,'market','loan|clause');
  const exports=await exportProbe(ctx.page,['loan','clause']);
  const shape=await careerShape(ctx.page);
  const relevant=shape.market.filter(x=>/loan|clause/i.test(x.path));
  if((!ui.actions.length&&!ui.buttons.length)&&!exports.length&&relevant.length===0)return nonExecuted('No loan/clause controls, API or state discovered',{ui,exports});
  return pass({ui,exports:exports.slice(0,30),statePaths:relevant.slice(0,40)});
}

async function F03(ctx){
  const ui=await pageFeature(ctx,'market','window|free|register|registration');
  const exports=await exportProbe(ctx.page,['window','free.*agent','register','registration']);
  if((!ui.actions.length&&!ui.buttons.length)&&!exports.length)return nonExecuted('No transfer-window/free-agent/registration evidence found',{ui,exports});
  return pass({ui,exports:exports.slice(0,40)});
}

async function F04(ctx){
  const ui=await pageFeature(ctx,'market','scout|shortlist|uncertain|knowledge');
  const exports=await exportProbe(ctx.page,['scout','shortlist','uncertain','knowledge']);
  const shape=await careerShape(ctx.page);
  const relevant=shape.market.filter(x=>/scout|shortlist/i.test(x.path));
  if((!ui.actions.length&&!ui.buttons.length)&&!exports.length&&relevant.length===0)return nonExecuted('No scouting/shortlist evidence found',{ui,exports});
  return pass({ui,exports:exports.slice(0,40),statePaths:relevant.slice(0,50)});
}

async function F05(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for F05');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const scan=root=>{
      const out={};const seen=new WeakSet();
      const walk=(v,p='',d=0)=>{
        if(!v||typeof v!=='object'||d>6||seen.has(v))return;seen.add(v);
        for(const [k,x] of Object.entries(v)){
          const q=p?p+'.'+k:k;
          if(/budget|balance|market|transfer/i.test(k)&&(['number','string','boolean'].includes(typeof x)))out[q]=x;
          if(x&&typeof x==='object')walk(x,q,d+1);
        }
      };walk(root);return out;
    };
    const before=scan(career);
    for(let i=0;i<Math.min(12,Math.max(1,(career.fixtures?.length||1)-career.round));i++)simulateRound(career);
    const after=scan(career);
    const changed=Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k]));
    return {valid:validateSave(career),beforeCount:Object.keys(before).length,afterCount:Object.keys(after).length,changed:changed.slice(0,80)};
  },p.career);
  assert(result.valid===true,'F05 AI simulation invalidated save',result);
  const exports=await exportProbe(ctx.page,['market.*ai','strategy','budget','transfer']);
  if(result.beforeCount===0&&!exports.length)return nonExecuted('No AI market/budget state or API discovered',{result,exports});
  return pass({result,exports:exports.slice(0,40)});
}

async function G01(ctx){
  const ui=await pageFeature(ctx,'board','objective|board|confidence|sack');
  const shape=await careerShape(ctx.page);
  const exports=await exportProbe(ctx.page,['board','objective','confidence','sack']);
  if(shape.board.length===0&&(!ui.actions.length&&!ui.buttons.length)&&!exports.length)return nonExecuted('No board/objective state, UI or API found',{ui,exports});
  return pass({ui,statePaths:shape.board.slice(0,50),exports:exports.slice(0,30)});
}

async function G02(ctx){
  const ui=await pageFeature(ctx,'finance','budget|balance|cash|revenue|expense|wage');
  const shape=await careerShape(ctx.page);
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for G02');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const collect=root=>{
      const out={};const seen=new WeakSet();
      const walk=(v,p='',d=0)=>{if(!v||typeof v!=='object'||d>6||seen.has(v))return;seen.add(v);for(const [k,x] of Object.entries(v)){const q=p?p+'.'+k:k;if(/budget|balance|cash|revenue|expense|wage/i.test(k)&&typeof x==='number')out[q]=x;if(x&&typeof x==='object')walk(x,q,d+1);}};
      walk(root);return out;
    };
    const before=collect(career);simulateRound(career);const after=collect(career);
    return {valid:validateSave(career),fields:Object.keys(before).length,changed:Object.keys(after).filter(k=>after[k]!==before[k]).slice(0,60)};
  },p.career);
  assert(result.valid===true,'G02 round simulation invalidated save',result);
  if(result.fields===0&&shape.finance.length===0)return nonExecuted('No finance ledger/budget state found',{ui,shape:shape.finance,result});
  return pass({ui,statePaths:shape.finance.slice(0,60),result});
}

async function G03(ctx){
  const shape=await careerShape(ctx.page);
  const exports=await exportProbe(ctx.page,['staff','coach','scout','facility','facilities']);
  const uiAdvanced=await pageFeature(ctx,'advanced','staff|coach|facility|upgrade');
  if(shape.staff.length===0&&!exports.length&&(!uiAdvanced.actions.length&&!uiAdvanced.buttons.length))return nonExecuted('No staff/facility state, UI or API discovered',{uiAdvanced,exports});
  return pass({statePaths:shape.staff.slice(0,60),ui:uiAdvanced,exports:exports.slice(0,40)});
}

async function G04(ctx){
  const ui=await pageFeature(ctx,'manager','offer|interview|contract|club|manager');
  const exports=await exportProbe(ctx.page,['manager','offer','interview','mobility','club.*change']);
  const probe=await referenceAudit(ctx.page);
  if((!ui.actions.length&&!ui.buttons.length)&&!exports.length)return nonExecuted('No manager mobility/offers/interviews controls or API found',{ui,exports});
  assert(probe.duplicateClubIds===0&&probe.duplicatePlayerIds===0,'G04 base references invalid',probe);
  return pass({ui,exports:exports.slice(0,40),referenceAudit:probe});
}

export const adapters={E01,E02,E03,E04,E05,F01,F02,F03,F04,F05,G01,G02,G03,G04};
