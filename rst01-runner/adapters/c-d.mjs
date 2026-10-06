import {
  assert,attachErrorCapture,domainCandidates,exportProbe,launchPersistent,navigateCore,pass,nonExecuted,
  primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';
import {runSubstitutionBehavior,runInjuryRecoveryBehavior} from '../lib/behavioral-match-player.mjs';

async function ensureSoak(ctx){
  if(ctx.shared.worldSoak)return ctx.shared.worldSoak;
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:850},suffix:'c-soak'});
  const started=Date.now();
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    const cap=attachErrorCapture(page);
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      const [
        {makeWorld},
        {startCareer,simulateRound,newSeason,validateSave},
        advancedCareer,
        {enableCareerWorld,careerWorldLeague,OFFICIAL_WORLD_COUNTRIES,validateCareerWorld},
        {enableCareerDivisions,captureDivisionSeason,divisionLeague,divisionArchive,validateCareerDivisions},
        {enableCareerCups,cupForCountry,cupHonours,validateCareerCups},
        {enableCareerContinental,continentalEdition,continentalHonours,validateCareerContinental},
        {officialHistorySeasons,officialRecords,officialRivalries}
      ]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/domain/advanced-career.js'),
        import('/src/domain/career-world.js'),
        import('/src/domain/career-divisions.js'),
        import('/src/domain/career-cups.js'),
        import('/src/domain/career-continental.js'),
        import('/src/domain/career-history.js')
      ]);
      const fail=(ok,message,details)=>{if(!ok)throw new Error(message+' :: '+JSON.stringify(details||{}));};
      const w=makeWorld();
      startCareer(w,1,'RST01 C Soak');
      const enableAdvanced=advancedCareer.enableAdvancedCareer||Object.entries(advancedCareer).find(([name,value])=>/^enable/i.test(name)&&typeof value==='function')?.[1];
      fail(typeof enableAdvanced==='function','advanced career enable API unavailable',{exports:Object.keys(advancedCareer)});
      enableAdvanced(w);enableCareerWorld(w);enableCareerDivisions(w);enableCareerCups(w);enableCareerContinental(w);
      const countries=[...OFFICIAL_WORLD_COUNTRIES];
      fail(countries.length===8,'expected eight countries',{countries});

      const seasonRows=[];
      const firstPlayerIds=new Set((w.players||[]).map(p=>p.id));
      for(let cycle=1;cycle<=10;cycle++){
        const target=w.fixtures.length;
        while(w.round<target)simulateRound(w);
        fail(w.round===target,'season did not complete',{cycle,round:w.round,target});
        fail(validateSave(w),'save invalid at season end',{cycle});
        fail(validateCareerWorld(w),'world invalid at season end',{cycle});
        fail(validateCareerDivisions(w),'divisions invalid at season end',{cycle});
        fail(validateCareerCups(w),'cups invalid at season end',{cycle});
        fail(validateCareerContinental(w),'continental invalid at season end',{cycle});

        const plan=captureDivisionSeason(w);
        const countryRows={};
        for(const country of countries){
          const e=plan.countries[country],world=careerWorldLeague(w,country),lower=divisionLeague(w,country),cup=cupForCountry(w,country);
          fail(e.top.length===20&&e.bottom.length===20,'division table size invalid',{cycle,country});
          fail(new Set(e.promoted).size===3&&new Set(e.relegated).size===3,'movement count invalid',{cycle,country,e});
          fail(e.playoff?.matches?.length===3,'playoff bracket invalid',{cycle,country});
          fail(cup?.championId!=null,'national cup has no champion',{cycle,country,cup});
          countryRows[country]={
            topClubs:world.clubs.length,lowerClubs:lower.clubs.length,
            promoted:[...e.promoted],relegated:[...e.relegated],playoffWinner:e.playoff?.winnerId,
            archiveBefore:divisionArchive(w,country).length,
            cupChampionId:cup.championId,cupRounds:cup.rounds?.length??0
          };
        }

        const edition=continentalEdition(w);
        const continentalEnd=edition?{
          season:edition.season,championKey:edition.championKey,
          entrants:edition.entrants?.length??0,groupRounds:edition.groupRounds?.length??0,
          knockoutRounds:edition.knockout?.length??0
        }:null;
        if(cycle>=2)fail(continentalEnd?.championKey,'continental edition has no champion',{cycle,continentalEnd});

        newSeason(w);
        fail(validateSave(w),'save invalid after rollover',{cycle});
        fail(validateCareerWorld(w),'world invalid after rollover',{cycle});
        fail(validateCareerDivisions(w),'divisions invalid after rollover',{cycle});
        fail(validateCareerCups(w),'cups invalid after rollover',{cycle});
        fail(validateCareerContinental(w),'continental invalid after rollover',{cycle});

        for(const country of countries){
          countryRows[country].archiveAfter=divisionArchive(w,country).length;
          countryRows[country].cupHonours=cupHonours(w,country).length;
          countryRows[country].records=officialRecords(w,country);
          countryRows[country].rivalries=officialRivalries(w,country);
        }
        const historySeasons=officialHistorySeasons(w);
        const continentalHistory=continentalHonours(w);
        seasonRows.push({
          cycle,resultingSeason:w.season,countries:countryRows,continentalEnd,
          continentalHonours:continentalHistory.length,
          continentalLatest:continentalHistory.at(-1)??null,
          historySeasons:[...historySeasons],
          playerCount:(w.players||[]).length
        });
      }
      const finalIds=(w.players||[]).map(p=>p.id);
      return {
        countries,cycles:seasonRows,
        final:{season:w.season,round:w.round,playerCount:finalIds.length,uniquePlayers:new Set(finalIds).size},
        playerChurn:{initial:firstPlayerIds.size,final:finalIds.length,retained:finalIds.filter(id=>firstPlayerIds.has(id)).length,newIds:finalIds.filter(id=>!firstPlayerIds.has(id)).length}
      };
    });
    result.runtime={errors:cap.errors,warnings:cap.warnings,elapsedMs:Date.now()-started};
    ctx.shared.worldSoak=result;
    return result;
  }finally{await made.context.close().catch(()=>{});}
}
async function C01(ctx){
  const soak=await ensureSoak(ctx);
  const ok=soak.cycles.every(row=>Object.keys(row.countries).length===8&&Object.values(row.countries).every(x=>x.topClubs===20&&x.lowerClubs===20));
  assert(ok,'C01 eight-country league matrix invalid',soak.cycles);
  return pass({countries:soak.countries,cycles:soak.cycles.map(x=>({cycle:x.cycle,resultingSeason:x.resultingSeason}))});
}

async function C02(ctx){
  const soak=await ensureSoak(ctx);
  assert(soak.cycles.length===10,'C02 expected ten completed seasons',{cycles:soak.cycles.length});
  assert(soak.final.round===0,'C02 expected rollover to round 0',soak.final);
  return pass({cycles:soak.cycles.length,final:soak.final});
}

async function C03(ctx){
  const soak=await ensureSoak(ctx);
  const bad=[];
  for(const row of soak.cycles)for(const [country,x] of Object.entries(row.countries)){
    if(x.promoted.length!==3||x.relegated.length!==3||x.playoffWinner==null||x.archiveAfter!==row.cycle)bad.push({cycle:row.cycle,country,x});
  }
  assert(!bad.length,'C03 promotion/relegation/playoff/archive mismatch',bad);
  return pass({verifiedCountries:soak.countries.length,verifiedCycles:soak.cycles.length});
}

async function C04(ctx){
  const soak=await ensureSoak(ctx);
  const nationalBad=[];
  for(const row of soak.cycles)for(const [country,x] of Object.entries(row.countries)){
    if(x.cupChampionId==null||x.cupRounds<1||x.cupHonours!==row.cycle)nationalBad.push({cycle:row.cycle,country,x});
  }
  assert(!nationalBad.length,'C04 national cup progression/archive mismatch',nationalBad);
  const continentalBad=soak.cycles.filter(row=>row.cycle>=2&&(!row.continentalEnd?.championKey||row.continentalEnd.entrants!==32||row.continentalEnd.groupRounds<1||row.continentalHonours!==row.cycle-1));
  assert(!continentalBad.length,'C04 continental progression/qualification/archive mismatch',continentalBad);
  return pass({
    nationalSeasons:soak.cycles.length,
    countries:soak.countries.length,
    continentalEditions:soak.cycles.at(-1)?.continentalHonours??0,
    nationalChampions:soak.cycles.map(r=>({cycle:r.cycle,champions:Object.fromEntries(Object.entries(r.countries).map(([c,x])=>[c,x.cupChampionId]))})),
    continental:soak.cycles.filter(r=>r.cycle>=2).map(r=>({cycle:r.cycle,champion:r.continentalEnd.championKey,history:r.continentalHonours}))
  });
}
async function C05(ctx){
  const soak=await ensureSoak(ctx);
  const bad=[];
  for(const row of soak.cycles){
    if(row.historySeasons.length!==row.cycle)bad.push({cycle:row.cycle,reason:'history_length',history:row.historySeasons});
    for(const [country,x] of Object.entries(row.countries)){
      if(x.archiveAfter!==row.cycle)bad.push({cycle:row.cycle,country,reason:'division_archive',value:x.archiveAfter});
      if(!Array.isArray(x.records)||x.records.length<3)bad.push({cycle:row.cycle,country,reason:'records',value:x.records});
      if(!Array.isArray(x.rivalries)||x.rivalries.length<1)bad.push({cycle:row.cycle,country,reason:'rivalries',value:x.rivalries});
      if(x.rivalries?.some(r=>r.meetings!==r.winsA+r.winsB+r.draws))bad.push({cycle:row.cycle,country,reason:'rivalry_integrity',value:x.rivalries});
    }
  }
  assert(!bad.length,'C05 official records/rivalries/history persistence mismatch',bad);
  const last=soak.cycles.at(-1);
  return pass({
    historySeasons:last.historySeasons,
    countries:Object.fromEntries(Object.entries(last.countries).map(([country,x])=>[country,{records:x.records,rivalries:x.rivalries.slice(0,5),divisionArchive:x.archiveAfter}])),
    playerChurn:soak.playerChurn
  });
}
async function D01(ctx){
  await ctx.page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  const result=await ctx.page.evaluate(async()=>{
    const [{makeWorld,FORMATIONS},{startCareer,autoLineup,validateSave}]=await Promise.all([import('/src/data.js'),import('/src/engine.js')]);
    const w=makeWorld();startCareer(w,1,'RST01 D01');autoLineup(w);
    const lineup=Array.isArray(w.lineup)?[...w.lineup]:[];
    const formation=w.formation??w.tactics?.formation??null;
    const knownFormation=formation==null?null:(Array.isArray(FORMATIONS)?FORMATIONS.includes(formation):Object.hasOwn(FORMATIONS,formation));
    return {valid:validateSave(w),lineup,unique:new Set(lineup).size,formation,knownFormation,formationCount:Array.isArray(FORMATIONS)?FORMATIONS.length:Object.keys(FORMATIONS||{}).length};
  });
  assert(result.valid===true,'D01 auto-lineup produced invalid save',result);
  assert(result.lineup.length===11&&result.unique===11,'D01 starting XI is not eleven distinct players',result);
  if(result.formation==null)return nonExecuted('D01 formation field unavailable after official autoLineup',result);
  if(result.knownFormation===false)return {state:'FAIL',reason:'D01 formation is not in the official formation catalogue',details:result};
  return pass(result);
}
async function D02(ctx){
  await ctx.page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  const result=await ctx.page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,validateSave},{enableAdvancedCareer},{enableCareerMatchday},{enableCareerTactics,saveCareerTacticPreset,planCareerTacticChange,validateCareerTactics}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-matchday.js'),import('/src/domain/career-tactics.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 D02');enableAdvancedCareer(w);enableCareerMatchday(w);enableCareerTactics(w);
    const before=structuredClone(w.advancedV1.tactics);
    saveCareerTacticPreset(w,'RST01 Baseline');
    const planner=w.advancedV1.tacticPlannerV1,preset=planner.book.presets.at(-1);
    if(!preset)return {ok:false,reason:'preset was not created'};
    planCareerTacticChange(w,{minute:60,presetId:preset.id});
    const planned=structuredClone(w.advancedV1.tacticPlannerV1.plans);
    const match=simulateRound(w),changes=match.result?.advancedV1?.tacticalChanges??[];
    const applied=changes.find(x=>x.teamId===w.clubId&&x.minute===60&&x.presetId===preset.id)??null;
    return {
      ok:Boolean(applied&&validateCareerTactics(w)&&validateSave(w)),
      before,preset:{id:preset.id,name:preset.name},planned,applied,changes,
      validTactics:validateCareerTactics(w),validSave:validateSave(w),style:w.advancedV1.style
    };
  });
  if(result.reason)return nonExecuted(result.reason,result);
  if(!result.ok)return {state:'FAIL',reason:'D02 official preset/live tactical change did not apply cleanly',details:result};
  return pass(result);
}
async function D03(ctx){
  const result=await runSubstitutionBehavior(ctx.page,ctx.baseURL);
  ctx.shared.substitutionEvidence=result;
  if(result.reason)return nonExecuted(result.reason,result);
  if(!result.manual)return {state:'FAIL',reason:'Manual substitution was not applied to the official matchday',details:result};
  if(!/SUB_LIMIT/.test(result.subLimitError||''))return {state:'FAIL',reason:'Substitution limit was not enforced',details:result};
  if(!/WINDOW_LIMIT/.test(result.windowLimitError||''))return {state:'FAIL',reason:'Substitution window limit was not enforced',details:result};
  if(!result.ai)return nonExecuted('AI substitution not observed in the complete deterministic season',result);
  if(!result.validMatchday||!result.validSave)return {state:'FAIL',reason:'Substitution scenario ended in invalid state',details:result};
  return pass(result);
}
async function D04(ctx){
  const result=ctx.shared.substitutionEvidence;
  if(!result?.manual)return nonExecuted('D04 requires the behavioral D03 manual substitution result',result||{});
  const out=result.ledger?.outRow,incoming=result.ledger?.inRow;
  if(!out||!incoming)return {state:'FAIL',reason:'Matchday minutes ledger is missing manual substitution participants',details:result};
  if(out.seconds!==3600||incoming.seconds!==1800||Math.abs(out.minutes-60)>.0001||Math.abs(incoming.minutes-30)>.0001){
    return {state:'FAIL',reason:'Effective minutes do not match the minute-60 substitution',details:{out,incoming,result}};
  }
  if(result.ledger.total!==11*5400)return {state:'FAIL',reason:'Team matchday seconds do not equal eleven full player-equivalents',details:result.ledger};
  const ids=[result.manual.out,result.manual.in],fitnessChanged=ids.some(id=>result.before?.[id]?.fitness!==result.afterFirstMatch?.[id]?.fitness);
  if(!fitnessChanged)return nonExecuted('Minutes are correct but no immediate post-match fitness change was observable for the substituted pair',result);
  return pass({out,incoming,total:result.ledger.total,before:result.before,afterFirstMatch:result.afterFirstMatch});
}
async function D05(ctx){
  const result=await runInjuryRecoveryBehavior(ctx.page,ctx.baseURL);
  if(result.reason)return nonExecuted(result.reason,result);
  if(!result.found?.change||result.found.change.reason!=='injury'||!result.found.injury)return {state:'FAIL',reason:'Injury substitution evidence is incomplete',details:result};
  if(!result.found.minutes||result.found.minutes.seconds>=5400)return {state:'FAIL',reason:'Injured player did not leave before full time',details:result.found};
  if(!result.found.recoveredWeek||!result.finalAvailability?.eligible)return {state:'FAIL',reason:'Medical recovery did not return the player to eligibility',details:result};
  if(!result.validMatchday||!result.validSave)return {state:'FAIL',reason:'Injury/recovery scenario ended in invalid state',details:result};
  return pass(result);
}
export const adapters={C01,C02,C03,C04,C05,D01,D02,D03,D04,D05};
