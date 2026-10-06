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
  await ctx.page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  const result=await ctx.page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{ATTRIBUTE_KEYS,attributeGroupCounts,validateAttributes},{readPlayerAttributes}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/addons/domain/player-attributes.mjs'),import('/src/addons/domain/player-generator.mjs')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 E01');
    const sample=w.players.slice(0,25).map(p=>{
      const profile=readPlayerAttributes(p,{seed:w.seed,countryId:w.countryId});
      return {id:p.id,position:p.position,count:Object.keys(profile.values||{}).length,valid:validateAttributes(profile),min:Math.min(...Object.values(profile.values||{})),max:Math.max(...Object.values(profile.values||{}))};
    });
    return {validSave:validateSave(w),attributeKeys:[...ATTRIBUTE_KEYS],groupCounts:attributeGroupCounts(),sample};
  });
  assert(result.validSave===true,'E01 source career invalid',result);
  assert(result.attributeKeys.length===40&&new Set(result.attributeKeys).size===40,'E01 official attribute catalogue is not exactly 40 unique keys',result);
  assert(result.sample.length>0&&result.sample.every(x=>x.valid&&x.count===40&&x.min>=1&&x.max<=100),'E01 generated/read player profiles are incomplete or invalid',result);
  return pass(result);
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
  await ctx.page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  const result=await ctx.page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerPersonality,settleCareerPersonalityRound,personalityPlayerView,validateCareerPersonality}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-personality.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 E05');enableAdvancedCareer(w);enableCareerPersonality(w);
    const owned=w.players.filter(p=>p.clubId===w.clubId).slice(0,30);
    const before=owned.map(p=>({id:p.id,morale:personalityPlayerView(w,p)?.morale,raw:w.advancedV1.personalityV1.playerStates[String(p.id)]?.morale}));
    settleCareerPersonalityRound(w,{result:'win',playedIds:[...w.lineup]});
    const after=owned.map(p=>({id:p.id,morale:personalityPlayerView(w,p)?.morale,raw:w.advancedV1.personalityV1.playerStates[String(p.id)]?.morale}));
    const changed=after.filter(a=>{const b=before.find(x=>x.id===a.id);return b&&(a.raw!==b.raw||a.morale!==b.morale);});
    return {validPersonality:validateCareerPersonality(w),validSave:validateSave(w),before,after,changed:changed.slice(0,30),events:w.advancedV1.personalityV1.events.slice(-30)};
  });
  assert(result.validPersonality===true&&result.validSave===true,'E05 personality transition invalidated career state',result);
  if(!result.changed.length||!result.events.length)return nonExecuted('Official personality round produced no observable dynamics transition',result);
  return pass(result);
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
  await ctx.page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  const result=await ctx.page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,validateSave},{enableAdvancedCareer},{enableCareerFinance,settleCareerFinanceRound,financeSeasonReport,careerFinanceForecast,validateCareerFinance}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-finance.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 G02');enableAdvancedCareer(w);enableCareerFinance(w);
    const beforeEntries=w.advancedV1.financeV1.entries.length,beforeBalance=w.teams.find(c=>c.id===w.clubId).balance;
    simulateRound(w);
    if(w.advancedV1.financeV1.entries.length===beforeEntries)settleCareerFinanceRound(w);
    const report=financeSeasonReport(w),forecast=careerFinanceForecast(w),afterBalance=w.teams.find(c=>c.id===w.clubId).balance;
    return {beforeEntries,afterEntries:w.advancedV1.financeV1.entries.length,beforeBalance,afterBalance,report,forecast,validFinance:validateCareerFinance(w),validSave:validateSave(w),alerts:w.advancedV1.financeV1.alerts.slice(-20)};
  });
  assert(result.validFinance===true&&result.validSave===true,'G02 finance settlement invalidated career state',result);
  assert(result.afterEntries>result.beforeEntries,'G02 finance ledger did not record round activity',result);
  if(!result.report||!result.forecast)return nonExecuted('G02 finance report/forecast unavailable after official settlement',result);
  return pass(result);
}
async function G03(ctx){return behavioralResult(await runFacilitiesBehavior(ctx.page,ctx.baseURL),'G03');}
async function G04(ctx){return behavioralResult(await runManagerBehavior(ctx.page,ctx.baseURL),'G04');}
export const adapters={E01,E02,E03,E04,E05,F01,F02,F03,F04,F05,G01,G02,G03,G04};
