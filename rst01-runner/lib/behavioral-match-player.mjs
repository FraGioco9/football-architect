export async function runSubstitutionBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,autoLineup,validateSave},{enableAdvancedCareer},{enableCareerMatchday,careerMatchdayBench,planCareerSubstitution,setCareerMatchdayRules,validateCareerMatchday}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-matchday.js')
    ]);
    const setup=()=>{
      const w=makeWorld();startCareer(w,1,'RST01 D03');enableAdvancedCareer(w);enableCareerMatchday(w);autoLineup(w);return w;
    };
    const choosePairs=w=>{
      const bench=careerMatchdayBench(w,w.clubId,w.lineup),players=new Map(w.players.map(p=>[p.id,p])),pairs=[];
      for(const outgoing of w.lineup){
        const from=players.get(outgoing);if(!from)continue;
        for(const to of bench){
          if((from.position==='POR')!==(to.position==='POR'))continue;
          pairs.push({outgoing,incoming:to.id});
        }
      }
      const unique=[];const used=new Set();
      for(const p of pairs){if(used.has(p.outgoing)||used.has(p.incoming))continue;used.add(p.outgoing);used.add(p.incoming);unique.push(p);}
      return unique;
    };
    const w=setup(),pairs=choosePairs(w);
    if(pairs.length<3)return {ok:false,reason:'insufficient eligible substitution pairs',pairs:pairs.length};
    const before=Object.fromEntries([pairs[0].outgoing,pairs[0].incoming].map(id=>{const p=w.players.find(x=>x.id===id);return [id,{fitness:p.fitness,medical:structuredClone(p.medicalV1)}];}));
    planCareerSubstitution(w,{minute:60,...pairs[0]});
    const planned=structuredClone(w.advancedV1.matchdayV1.plans);

    const subLimit=setup(),sp=choosePairs(subLimit);setCareerMatchdayRules(subLimit,{kind:'league',maxSubstitutions:1,maxWindows:3});
    planCareerSubstitution(subLimit,{minute:60,...sp[0]});let subLimitError=null;
    try{planCareerSubstitution(subLimit,{minute:75,...sp[1]});}catch(e){subLimitError=String(e?.message||e);}

    const winLimit=setup(),wp=choosePairs(winLimit);setCareerMatchdayRules(winLimit,{kind:'league',maxSubstitutions:5,maxWindows:1});
    planCareerSubstitution(winLimit,{minute:60,...wp[0]});let windowLimitError=null;
    try{planCareerSubstitution(winLimit,{minute:75,...wp[1]});}catch(e){windowLimitError=String(e?.message||e);}

    const match=simulateRound(w),md=match.result?.advancedV1?.matchday,changes=md?.changes??[];
    const manual=changes.find(x=>x.teamId===w.clubId&&x.reason==='manual'&&x.out===pairs[0].outgoing&&x.in===pairs[0].incoming);
    let ai=changes.find(x=>x.reason==='ai')??null;
    const aiRounds=[];
    for(let i=0;i<6&&!ai&&w.round<w.fixtures.length;i++){
      const m=simulateRound(w),day=m.result?.advancedV1?.matchday;
      const found=day?.changes?.find(x=>x.reason==='ai')??null;
      aiRounds.push({round:w.round,changes:day?.changes??[]});
      if(found)ai=found;
    }
    const ledger=md?.minutes?.find(x=>x.teamId===w.clubId)?.players??[];
    const outRow=ledger.find(x=>x.playerId===pairs[0].outgoing),inRow=ledger.find(x=>x.playerId===pairs[0].incoming);
    const after=Object.fromEntries([pairs[0].outgoing,pairs[0].incoming].map(id=>{const p=w.players.find(x=>x.id===id);return [id,{fitness:p.fitness,medical:structuredClone(p.medicalV1)}];}));
    const total=ledger.reduce((n,x)=>n+x.seconds,0);
    return {
      ok:Boolean(manual&&ai&&validateCareerMatchday(w)&&validateSave(w)),
      planned,manual,ai,aiRounds,ledger:{total,count:ledger.length,outRow,inRow},
      before,after,subLimitError,windowLimitError,
      validMatchday:validateCareerMatchday(w),validSave:validateSave(w)
    };
  });
}

export async function runInjuryRecoveryBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,autoLineup,validateSave},{enableAdvancedCareer,prepareAdvancedRound},{enableCareerMatchday,validateCareerMatchday},{medicalAvailability}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-matchday.js'),import('/src/addons/domain/player-medical.mjs')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 D05');enableAdvancedCareer(w);enableCareerMatchday(w);autoLineup(w);
    let found=null;
    for(let i=0;i<Math.min(18,w.fixtures.length)&&!found;i++){
      const m=simulateRound(w),adv=m.result?.advancedV1,changes=adv?.matchday?.changes??[];
      const injuryChange=changes.find(x=>x.teamId===w.clubId&&x.reason==='injury');
      if(injuryChange){
        const injury=(adv.injuries??[]).find(x=>x.playerId===injuryChange.out)??null;
        const minutes=adv.matchday.minutes.find(x=>x.teamId===w.clubId)?.players.find(x=>x.playerId===injuryChange.out)??null;
        const p=w.players.find(x=>x.id===injuryChange.out);
        found={round:w.round,change:injuryChange,injury,minutes,playerId:p.id,beforeRecovery:{fitness:p.fitness,medical:structuredClone(p.medicalV1),injuryLegacy:p.injury}};
      }
    }
    if(!found)return {ok:false,reason:'no managed injury substitution observed within 18 rounds'};
    const p=w.players.find(x=>x.id===found.playerId),recovery=[];
    for(let week=1;week<=30;week++){
      prepareAdvancedRound(w);
      const availability=medicalAvailability(p.medicalV1);
      recovery.push({week,day:w.advancedV1.clockDay,fitness:p.fitness,injury:structuredClone(p.medicalV1.injury),availability});
      if(!p.medicalV1.injury&&availability.eligible){found.recoveredWeek=week;break;}
    }
    const finalAvailability=medicalAvailability(p.medicalV1);
    return {ok:Boolean(found.injury&&found.minutes&&found.recoveredWeek&&finalAvailability.eligible&&validateCareerMatchday(w)&&validateSave(w)),found,recovery,finalAvailability,validMatchday:validateCareerMatchday(w),validSave:validateSave(w)};
  });
}

export async function runContractBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerMarket},{enableCareerCalendar,releaseCareerFreeAgent,validateCareerCalendar},{enableCareerContracts,proposeCareerRenewal,respondCareerRenewal,decideCareerCounter,syncCareerContracts,careerContractView,validateCareerContracts}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js'),import('/src/domain/career-calendar.js'),import('/src/domain/career-contracts.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 E02');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);enableCareerCalendar(w);enableCareerContracts(w);
    const owned=w.players.filter(p=>p.clubId===w.clubId&&p.position!=='POR');
    if(owned.length<5)return {ok:false,reason:'insufficient owned players'};
    const state=()=>w.advancedV1.contractsV1;
    const renewal=(player,decision,years=2,releaseFee=null)=>{
      const offerId=proposeCareerRenewal(w,{playerId:player.id,expectedRevision:state().revision,years,annualWage:Math.max(5200,player.wage*52),releaseFee});
      const result=respondCareerRenewal(w,{offerId,expectedRevision:state().revision,decision});
      return {offerId,result,offer:structuredClone(state().offers[offerId])};
    };
    const accepted=renewal(owned[0],'accept',2,5_000_000);
    const rejected=renewal(owned[1],'reject',2,null);
    const counter=renewal(owned[2],'counter',2,null);
    const counterFinal=decideCareerCounter(w,{offerId:counter.offerId,expectedRevision:state().revision,decision:'reject'});
    const expiry=renewal(owned[3],'accept',1,null);
    const expiryEnd=state().contracts[String(owned[3].id)].terms.endSeason;
    const expiryClone=structuredClone(w);expiryClone.season=expiryEnd+1;syncCareerContracts(expiryClone);
    const expiryArchive=expiryClone.advancedV1.contractsV1.archive.filter(x=>String(x.playerId)===String(owned[3].id)).at(-1)??null;

    const released=owned[4],releasedKey=`${w.countryId}:${released.id}`;
    releaseCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:releasedKey,consent:true});
    syncCareerContracts(w);
    const releaseArchive=state().archive.filter(x=>String(x.playerId)===String(released.id)).at(-1)??null;
    const view=careerContractView(w);
    return {
      ok:Boolean(
        accepted.offer.status==='accepted'&&
        w.players.find(p=>p.id===owned[0].id)?.releaseClauseEUR===5_000_000&&
        rejected.offer.status==='rejected'&&counterFinal==='rejected'&&
        expiryArchive?.reason==='expired_legacy_extension'&&
        releaseArchive?.reason==='transferred_or_released'&&
        validateCareerContracts(w)&&validateCareerContracts(expiryClone)&&validateCareerCalendar(w)&&validateSave(w)
      ),
      accepted,rejected,counter:{initial:counter.offer,final:counterFinal},expiry:{endSeason:expiryEnd,archive:expiryArchive},
      release:{playerId:released.id,archive:releaseArchive,freeAgent:Boolean(w.advancedV1.calendarV1.freeAgents[releasedKey])},
      view,validContracts:validateCareerContracts(w),validExpiry:validateCareerContracts(expiryClone),validCalendar:validateCareerCalendar(w),validSave:validateSave(w)
    };
  });
}

export async function runYouthBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,newSeason,validateSave},{enableAdvancedCareer},{enableCareerTraining,validateCareerTraining},{enableCareerYouth,careerYouthSummary,promoteCareerProspect,validateCareerYouth}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-training.js'),import('/src/domain/career-youth.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 E03');enableAdvancedCareer(w);enableCareerTraining(w);enableCareerYouth(w);
    const before=careerYouthSummary(w),candidate=before.academy.find(p=>p.age>=16);
    if(!candidate)return {ok:false,reason:'no promotable academy prospect',before};
    const academyBefore=new Map(before.academy.map(p=>[p.id,p.ovr]));
    const promotedId=promoteCareerProspect(w,candidate.id);
    const promoted=w.players.find(p=>p.id===promotedId),promotedBeforeOvr=promoted?.ovr;
    const afterPromotion=careerYouthSummary(w);
    if(!promoted||afterPromotion.academy.some(p=>p.id===promotedId))return {ok:false,reason:'promotion state mismatch',promotedId};

    while(w.round<w.fixtures.length)simulateRound(w);
    const seasonBefore=w.season;newSeason(w);
    const after=careerYouthSummary(w);
    const commonGrowth=after.academy.filter(p=>academyBefore.has(p.id)&&p.ovr!==academyBefore.get(p.id)).map(p=>({id:p.id,before:academyBefore.get(p.id),after:p.ovr}));
    const intake=after.academy.filter(p=>!academyBefore.has(p.id)).map(p=>({id:p.id,age:p.age,ovr:p.ovr}));
    const promotedAfter=w.players.find(p=>p.id===promotedId);
    const growthEvidence=commonGrowth.length>0||(promotedAfter&&promotedAfter.ovr!==promotedBeforeOvr);
    return {
      ok:Boolean(growthEvidence&&w.season===seasonBefore+1&&validateCareerYouth(w)&&validateCareerTraining(w)&&validateSave(w)),
      promoted:{id:promotedId,beforeOvr:promotedBeforeOvr,afterOvr:promotedAfter?.ovr,stillFirstTeam:Boolean(promotedAfter)},
      commonGrowth,intake:intake.slice(0,20),beforeAcademy:before.academy.length,afterAcademy:after.academy.length,
      validYouth:validateCareerYouth(w),validTraining:validateCareerTraining(w),validSave:validateSave(w),season:w.season
    };
  });
}
