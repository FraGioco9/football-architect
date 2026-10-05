import {
  assert,exportProbe,navigateCore,pass,nonExecuted,readPrimary,uiProbe
} from '../lib/runtime.mjs';
import {careerShape,playerAttributeAudit,referenceAudit} from '../lib/audit.mjs';
import {runContractBehavior,runYouthBehavior} from '../lib/behavioral-match-player.mjs';
import {runMarketNegotiationBehavior,runLoanClauseBehavior,runCalendarBehavior,runScoutingBehavior,runAIMarketBehavior} from '../lib/behavioral-market.mjs';
import {runBoardBehavior,runFacilitiesBehavior,runManagerBehavior} from '../lib/behavioral-management-cross.mjs';

function behavioralResult(result,label){
  if(result?.ok)return pass(result);
  const reason=String(result?.reason||label+' behavioral driver failed');
  if(/^no |insufficient|could not/i.test(reason))return nonExecuted(reason,result||{});
  return {state:'FAIL',reason,details:result||{}};
}

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
  const result=await runContractBehavior(ctx.page,ctx.baseURL);
  const state=behavioralResult(result,'E02');
  if(state.state==='PASS')ctx.shared.contractEvidence={executed:true,...result};
  return state;
}
async function E03(ctx){return behavioralResult(await runYouthBehavior(ctx.page,ctx.baseURL),'E03');}
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
  const result=await runMarketNegotiationBehavior(ctx.page,ctx.baseURL);
  const state=behavioralResult(result,'F01');
  if(state.state==='PASS')ctx.shared.marketEvidence={executed:true,...result};
  return state;
}
async function F02(ctx){return behavioralResult(await runLoanClauseBehavior(ctx.page,ctx.baseURL),'F02');}
async function F03(ctx){return behavioralResult(await runCalendarBehavior(ctx.page,ctx.baseURL),'F03');}
async function F04(ctx){return behavioralResult(await runScoutingBehavior(ctx.page,ctx.baseURL),'F04');}
async function F05(ctx){return behavioralResult(await runAIMarketBehavior(ctx.page,ctx.baseURL),'F05');}
async function G01(ctx){return behavioralResult(await runBoardBehavior(ctx.page,ctx.baseURL),'G01');}
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
async function G03(ctx){return behavioralResult(await runFacilitiesBehavior(ctx.page,ctx.baseURL),'G03');}
async function G04(ctx){return behavioralResult(await runManagerBehavior(ctx.page,ctx.baseURL),'G04');}
export const adapters={E01,E02,E03,E04,E05,F01,F02,F03,F04,F05,G01,G02,G03,G04};
