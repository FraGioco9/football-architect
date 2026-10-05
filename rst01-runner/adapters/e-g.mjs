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
    textMatch:re.test(probe.text),
    rowCount:await ctx.page.locator('table tbody tr, [role="row"]').count()
  };
}

async function E01(ctx){
  const audit=await playerAttributeAudit(ctx.page);
  assert(audit.players>0,'E01 no players found',audit);
  assert(audit.uniqueIds===audit.players,'E01 duplicate player ids',audit);
  if(audit.commonCandidateAttributes.length<40){
    return nonExecuted('Could not prove a common set of at least 40 non-meta numeric player attributes',{audit});
  }
  return pass({
    players:audit.players,
    uniqueIds:audit.uniqueIds,
    commonAttributeCount:audit.commonCandidateAttributes.length,
    commonAttributes:audit.commonCandidateAttributes.slice(0,60),
    sample:audit.sample
  });
}
async function E02(ctx){
  const shape=await careerShape(ctx.page);
  const ui=await pageFeature(ctx,'squad','contract|renew|wage|salary|release|clause');
  const exports=await exportProbe(ctx.page,['contract','renew','wage','salary','release','clause']);
  ctx.shared.contractEvidence={executed:false,statePaths:shape.contract.slice(0,60),ui,exports:exports.slice(0,40)};
  return nonExecuted('Contract lifecycle requires behavioral renew/expiry/clause/release actions; presence or rollover alone is not accepted as PASS',ctx.shared.contractEvidence);
}
async function E03(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for E03');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,newSeason,validateSave}=await import('/src/engine.js');
    const before=new Map((career.players||[]).map(p=>[p.id,{age:p.age,ovr:p.overall??p.ovr??null}]));
    const target=career.fixtures?.length||0;
    while(career.round<target)simulateRound(career);
    newSeason(career);
    const after=career.players||[];
    const generated=after.filter(p=>!before.has(p.id));
    const retained=after.filter(p=>before.has(p.id));
    const progressed=retained.filter(p=>{
      const b=before.get(p.id),now=p.overall??p.ovr??null;
      return b.ovr!=null&&now!=null&&now!==b.ovr;
    });
    return {
      valid:validateSave(career),
      generated:generated.slice(0,40).map(p=>({id:p.id,age:p.age,clubId:p.clubId})),
      generatedYoung:generated.filter(p=>Number(p.age)<=21).length,
      progressed:progressed.length
    };
  },p.career);
  assert(result.valid===true,'E03 rollover invalidated save',result);
  const ui=await pageFeature(ctx,'youth','youth|academy|promot|develop');
  const exports=await exportProbe(ctx.page,['youth','academy','promot','develop']);
  if(result.generatedYoung===0||result.progressed===0)return nonExecuted('Youth rollover did not prove both new young generation and measurable player development',{result,ui,exports});
  ctx.shared.youthEvidence={executed:false,result,ui,exports:exports.slice(0,30)};
  return nonExecuted('Youth generation/development observed, but an explicit academy promotion action is still required for full E03 certification',ctx.shared.youthEvidence);
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
  if(shape.dynamics.length===0||result.fields===0||result.changed===0)return nonExecuted('Personality/dynamics state did not demonstrate an actual state transition',{shape:shape.dynamics,result});
  return pass({statePaths:shape.dynamics.slice(0,40),result});
}
async function F01(ctx){
  const ui=await pageFeature(ctx,'market','transfer|offer|bid|buy|sell');
  const exports=await exportProbe(ctx.page,['transfer','offer','bid','negot']);
  const shape=await careerShape(ctx.page);
  ctx.shared.marketEvidence={executed:false,ui,exports:exports.slice(0,40),statePaths:shape.market.slice(0,50)};
  return nonExecuted('F01 requires completed buy/sell/reject negotiation transitions; UI/API presence alone is not accepted',ctx.shared.marketEvidence);
}
async function F02(ctx){
  const ui=await pageFeature(ctx,'market','loan|clause');
  const exports=await exportProbe(ctx.page,['loan','clause']);
  const shape=await careerShape(ctx.page);
  return nonExecuted('F02 requires a completed loan and clause behavior check; discovery evidence is insufficient',{ui,exports:exports.slice(0,30),statePaths:shape.market.filter(x=>/loan|clause/i.test(x.path)).slice(0,40)});
}
async function F03(ctx){
  const ui=await pageFeature(ctx,'market','window|free|register|registration');
  const exports=await exportProbe(ctx.page,['window','free.*agent','register','registration']);
  return nonExecuted('F03 requires behavioral window/free-agent/registration transitions; UI/API presence alone is insufficient',{ui,exports:exports.slice(0,40)});
}
async function F04(ctx){
  const ui=await pageFeature(ctx,'market','scout|shortlist|uncertain|knowledge');
  const exports=await exportProbe(ctx.page,['scout','shortlist','uncertain','knowledge']);
  const shape=await careerShape(ctx.page);
  return nonExecuted('F04 requires shortlist persistence plus scouting uncertainty change; discovery evidence alone is insufficient',{ui,exports:exports.slice(0,40),statePaths:shape.market.filter(x=>/scout|shortlist/i.test(x.path)).slice(0,50)});
}
async function F05(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for F05');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    const scan=root=>{
      const out={};const seen=new WeakSet();
      const walk=(v,p='',d=0)=>{if(!v||typeof v!=='object'||d>6||seen.has(v))return;seen.add(v);for(const [k,x] of Object.entries(v)){const q=p?p+'.'+k:k;if(/budget|balance|market|transfer/i.test(k)&&(['number','string','boolean'].includes(typeof x)))out[q]=x;if(x&&typeof x==='object')walk(x,q,d+1);}};
      walk(root);return out;
    };
    const before=scan(career);
    for(let i=0;i<Math.min(12,Math.max(1,(career.fixtures?.length||1)-career.round));i++)simulateRound(career);
    const after=scan(career);
    return {valid:validateSave(career),before,after,changed:Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k])).slice(0,80)};
  },p.career);
  assert(result.valid===true,'F05 AI simulation invalidated save',result);
  return nonExecuted('F05 requires explicit evidence that AI transfer decisions respect budgets across seasons; generic budget-field changes are not enough',{result});
}
async function G01(ctx){
  const ui=await pageFeature(ctx,'board','objective|board|confidence|sack');
  const shape=await careerShape(ctx.page);
  const exports=await exportProbe(ctx.page,['board','objective','confidence','sack']);
  return nonExecuted('G01 requires behavioral objective evaluation and sack-risk transitions; discovery evidence alone is insufficient',{ui,statePaths:shape.board.slice(0,50),exports:exports.slice(0,30)});
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
  if(result.fields===0||result.changed.length===0||!ui.textMatch||ui.rowCount<1)return nonExecuted('Finance state/report evidence incomplete or no transaction movement observed',{ui,shape:shape.finance,result});
  ctx.shared.financeEvidence={executed:true,ui,result,statePaths:shape.finance.slice(0,60)};
  return pass(ctx.shared.financeEvidence);
}
async function G03(ctx){
  const shape=await careerShape(ctx.page);
  const exports=await exportProbe(ctx.page,['staff','coach','scout','facility','facilities']);
  const uiAdvanced=await pageFeature(ctx,'advanced','staff|coach|facility|upgrade');
  return nonExecuted('G03 requires completed staff hire/facility upgrade plus persisted impact; discovery evidence alone is insufficient',{statePaths:shape.staff.slice(0,60),ui:uiAdvanced,exports:exports.slice(0,40)});
}
async function G04(ctx){
  const ui=await pageFeature(ctx,'manager','offer|interview|contract|club|manager');
  const exports=await exportProbe(ctx.page,['manager','offer','interview','mobility','club.*change']);
  const probe=await referenceAudit(ctx.page);
  assert(probe.duplicateClubIds===0&&probe.duplicatePlayerIds===0,'G04 base references invalid',probe);
  return nonExecuted('G04 requires completed offer/interview/club-switch behavior and persistence; discovery evidence alone is insufficient',{ui,exports:exports.slice(0,40),referenceAudit:probe});
}
export const adapters={E01,E02,E03,E04,E05,F01,F02,F03,F04,F05,G01,G02,G03,G04};
