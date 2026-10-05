export async function runBoardBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerBoard,negotiateBoardGoals,recordBoardRound,settleBoardSeason,validateCareerBoard}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-board.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 G01');enableAdvancedCareer(w);enableCareerBoard(w);
    const before=structuredClone(w.advancedV1.boardV1);
    negotiateBoardGoals(w,{revision:w.advancedV1.boardV1.revision,plan:'ambitious'});
    const negotiated=structuredClone(w.advancedV1.boardV1);

    const review=structuredClone(w);
    review.round=review.fixtures.length;
    const summary=settleBoardSeason(review);

    const dismissal=structuredClone(w);
    dismissal.round=12;
    dismissal.advancedV1.boardV1.trust=10;
    dismissal.advancedV1.boardV1.warnings=2;
    const dismissalEvent=recordBoardRound(dismissal,{result:{},ours:0,theirs:3});
    return {
      ok:Boolean(
        before.plan==='balanced'&&negotiated.plan==='ambitious'&&negotiated.negotiated===true&&
        summary?.checks&&Array.isArray(review.advancedV1.boardV1.history)&&review.advancedV1.boardV1.history.length===1&&
        dismissal.advancedV1.boardV1.status==='dismissed'&&dismissal.advancedV1.boardV1.warnings>=2&&
        validateCareerBoard(w)&&validateCareerBoard(review)&&validateCareerBoard(dismissal)&&validateSave(w)
      ),
      before:{plan:before.plan,trust:before.trust,targets:before.targets},
      negotiated:{plan:negotiated.plan,trust:negotiated.trust,targets:negotiated.targets},
      review:summary,
      dismissal:{event:dismissalEvent,status:dismissal.advancedV1.boardV1.status,trust:dismissal.advancedV1.boardV1.trust,warnings:dismissal.advancedV1.boardV1.warnings},
      valid:{base:validateCareerBoard(w),review:validateCareerBoard(review),dismissal:validateCareerBoard(dismissal),save:validateSave(w)}
    };
  });
}

export async function runFacilitiesBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer,prepareAdvancedRound},{enableCareerTraining,validateCareerTraining},{enableCareerYouth,validateCareerYouth},{enableCareerFinance,validateCareerFinance},{enableCareerFacilities,hireCareerStaff,planFacilityProject,decideFacilityProject,advanceCareerFacilitiesRound,facilityImpact,validateCareerFacilities}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-training.js'),import('/src/domain/career-youth.js'),import('/src/domain/career-finance.js'),import('/src/domain/career-facilities.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 G03');enableAdvancedCareer(w);enableCareerTraining(w);enableCareerYouth(w);enableCareerFinance(w);enableCareerFacilities(w);
    const club=()=>w.teams.find(c=>c.id===w.clubId),beforeBalance=club().balance,beforeImpact=facilityImpact(w);
    const staff=hireCareerStaff(w,{revision:w.advancedV1.facilitiesV1.revision,role:'fitness',quality:3,years:3});
    const projectId=planFacilityProject(w,{revision:w.advancedV1.facilitiesV1.revision,type:'training'});
    decideFacilityProject(w,{revision:w.advancedV1.facilitiesV1.revision,id:projectId,decision:'approve'});
    const project=()=>w.advancedV1.facilitiesV1.projects.find(p=>p.id===projectId);
    const timeline=[];
    for(let i=0;i<8&&project().status==='building';i++){
      prepareAdvancedRound(w);
      advanceCareerFacilitiesRound(w);
      timeline.push({day:w.advancedV1.clockDay,status:project().status,level:w.advancedV1.facilitiesV1.buildings.training.level,balance:club().balance});
    }
    const afterImpact=facilityImpact(w),events=w.advancedV1.facilitiesV1.events.filter(e=>['staff_hired','project_planned','project_approve','project_completed'].includes(e.type));
    return {
      ok:Boolean(
        staff.quality===3&&project().status==='completed'&&w.advancedV1.facilitiesV1.buildings.training.level===2&&
        afterImpact.trainingBonus>beforeImpact.trainingBonus&&club().balance<beforeBalance&&
        validateCareerFacilities(w)&&validateCareerFinance(w)&&validateCareerTraining(w)&&validateCareerYouth(w)&&validateSave(w)
      ),
      before:{balance:beforeBalance,impact:beforeImpact},staff,project:structuredClone(project()),timeline,after:{balance:club().balance,impact:afterImpact},events,
      valid:{facilities:validateCareerFacilities(w),finance:validateCareerFinance(w),training:validateCareerTraining(w),youth:validateCareerYouth(w),save:validateSave(w)}
    };
  });
}

export async function runManagerBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerWorld,validateCareerWorld},{enableCareerBoard,validateCareerBoard},{enableManagerCareer,managerVacancies,applyManagerJob,negotiateManagerOffer,decideManagerOffer,validateManagerCareer}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-board.js'),import('/src/domain/career-manager.js')
    ]);
    const setup=()=>{const w=makeWorld();startCareer(w,1,'RST01 G04');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerBoard(w);enableManagerCareer(w,{origin:'RST01',style:'balanced'});return w;};
    const executeOffer=(w,v)=>{
      const offer=applyManagerJob(w,{revision:w.advancedV1.managerV1.revision,clubKey:v.clubKey});
      const negotiated=negotiateManagerOffer(w,{revision:w.advancedV1.managerV1.revision,offerId:offer.id,salaryEUR:offer.salaryEUR,contractYears:2});
      const accepted=decideManagerOffer(w,{revision:w.advancedV1.managerV1.revision,offerId:offer.id,accept:true});
      return {vacancy:v,offer,negotiated,accepted};
    };

    const domestic=setup(),dVac=managerVacancies(domestic).find(v=>v.countryId===domestic.countryId&&v.clubId!==domestic.clubId&&v.supported);
    if(!dVac)return {ok:false,reason:'no domestic vacancy'};
    const dOld={countryId:domestic.countryId,clubId:domestic.clubId},dFlow=executeOffer(domestic,dVac);
    const dState=domestic.advancedV1.managerV1;

    const international=setup(),iVac=managerVacancies(international).find(v=>v.countryId!==international.countryId&&v.supported);
    if(!iVac)return {ok:false,reason:'no supported international vacancy',domestic:dFlow};
    const iOld={countryId:international.countryId,clubId:international.clubId},iFlow=executeOffer(international,iVac);
    const iState=international.advancedV1.managerV1;

    return {
      ok:Boolean(
        domestic.clubId===dVac.clubId&&domestic.countryId===dOld.countryId&&dState.jobs.length===2&&dState.interviews.length===1&&
        international.countryId===iVac.countryId&&international.clubId===iVac.clubId&&iState.jobs.length===2&&iState.interviews.length===1&&
        validateManagerCareer(domestic)&&validateManagerCareer(international)&&validateCareerWorld(international)&&validateCareerBoard(international)&&validateSave(domestic)&&validateSave(international)
      ),
      domestic:{old:dOld,new:{countryId:domestic.countryId,clubId:domestic.clubId},flow:dFlow,jobs:dState.jobs,interviews:dState.interviews},
      international:{old:iOld,new:{countryId:international.countryId,clubId:international.clubId},flow:iFlow,jobs:iState.jobs,interviews:iState.interviews},
      valid:{domestic:validateManagerCareer(domestic),international:validateManagerCareer(international),world:validateCareerWorld(international),board:validateCareerBoard(international)}
    };
  });
}

export async function runCrossRolloverBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,newSeason,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerMarket,managedClubKey,marketPlayers,marketValuation,marketExistingWageEUR,createCareerQuote,startMarketDeal,answerMarketClub,proposeMarketTerms,answerMarketPlayer,completeMarketDeal,validateCareerMarket},{enableCareerContracts,proposeCareerRenewal,respondCareerRenewal,syncCareerContracts,validateCareerContracts},{enableCareerFinance,validateCareerFinance}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js'),import('/src/domain/career-contracts.js'),import('/src/domain/career-finance.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 I01');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);enableCareerContracts(w);enableCareerFinance(w);
    const managed=managedClubKey(w),p=w.players.find(x=>x.clubId===w.clubId&&x.position!=='POR');
    const offer=proposeCareerRenewal(w,{playerId:p.id,expectedRevision:w.advancedV1.contractsV1.revision,years:3,annualWage:p.wage*52,releaseFee:3_000_000});
    respondCareerRenewal(w,{offerId:offer,expectedRevision:w.advancedV1.contractsV1.revision,decision:'accept'});

    const target=marketPlayers(w,{limit:2000}).filter(x=>x.clubKey!==managed).map(x=>({x,v:marketValuation(w,x.id,managed)})).filter(({v})=>v.askingEUR<w.teams.find(c=>c.id===w.clubId).transferBudget*.5).sort((a,b)=>a.v.askingEUR-b.v.askingEUR)[0];
    if(!target)return {ok:false,reason:'no cross-rollover market target'};
    const q=createCareerQuote(w,{type:'permanent',feeEUR:target.v.askingEUR,days:120});
    const id=startMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId:target.x.id,buyerKey:managed,quote:q});
    answerMarketClub(w,{revision:w.advancedV1.marketV1.revision,dealId:id,side:'seller',decision:'accept'});
    const annual=Math.max(marketExistingWageEUR(w,target.x.id),Math.ceil(target.v.weeklyWageEUR*1.2/100)*100*52);
    proposeMarketTerms(w,{revision:w.advancedV1.marketV1.revision,dealId:id,annualWageEUR:annual,years:3,role:'starter'});
    answerMarketPlayer(w,{revision:w.advancedV1.marketV1.revision,dealId:id,decision:'accept'});
    completeMarketDeal(w,{revision:w.advancedV1.marketV1.revision,dealId:id});
    syncCareerContracts(w);

    const rows=[];
    for(let cycle=1;cycle<=2;cycle++){
      while(w.round<w.fixtures.length)simulateRound(w);
      const before={season:w.season,balance:w.teams.find(c=>c.id===w.clubId).balance,marketMovements:w.advancedV1.marketV1.movements.length,contractArchive:w.advancedV1.contractsV1.archive.length};
      newSeason(w);
      rows.push({cycle,before,after:{season:w.season,round:w.round,balance:w.teams.find(c=>c.id===w.clubId).balance,marketSeason:w.advancedV1.marketV1.season,contractSeason:w.advancedV1.contractsV1.season,financeSeason:w.advancedV1.financeV1.season},valid:{market:validateCareerMarket(w),contracts:validateCareerContracts(w),finance:validateCareerFinance(w),save:validateSave(w)}});
    }
    return {
      ok:Boolean(rows.every(r=>r.valid.market&&r.valid.contracts&&r.valid.finance&&r.valid.save&&r.after.season===r.before.season+1&&r.after.round===0)&&w.advancedV1.marketV1.movements.some(m=>m.dealId===id)),
      dealId:id,renewalOffer:offer,rows,final:{season:w.season,round:w.round,movements:w.advancedV1.marketV1.movements.length,contracts:Object.keys(w.advancedV1.contractsV1.contracts).length}
    };
  });
}

export async function runCrossInjuryTransferBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,autoLineup,validateSave},{enableAdvancedCareer},{enableCareerMatchday,careerMatchdayBench,planCareerSubstitution,validateCareerMatchday},{enableCareerContracts,proposeCareerRenewal,respondCareerRenewal,syncCareerContracts,validateCareerContracts},{enableCareerWorld},{enableCareerMarket,managedClubKey,marketPlayers,marketValuation,marketExistingWageEUR,createCareerQuote,startMarketDeal,answerMarketClub,proposeMarketTerms,answerMarketPlayer,completeMarketDeal,validateCareerMarket}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-matchday.js'),import('/src/domain/career-contracts.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 I03');enableAdvancedCareer(w);enableCareerMatchday(w);enableCareerContracts(w);enableCareerWorld(w);enableCareerMarket(w);autoLineup(w);
    const bench=careerMatchdayBench(w,w.clubId,w.lineup),players=new Map(w.players.map(p=>[p.id,p]));
    let pair=null;
    for(const out of w.lineup){for(const inc of bench){if((players.get(out)?.position==='POR')===(inc.position==='POR')){pair={outgoing:out,incoming:inc.id};break;}}if(pair)break;}
    if(!pair)return {ok:false,reason:'no manual substitution pair'};
    planCareerSubstitution(w,{minute:60,...pair});
    const first=simulateRound(w),manual=first.result?.advancedV1?.matchday?.changes?.find(x=>x.teamId===w.clubId&&x.reason==='manual')??null;

    let injury=null;
    for(let i=0;w.round<w.fixtures.length&&!injury;i++){
      const m=simulateRound(w),adv=m.result?.advancedV1;
      const ch=adv?.matchday?.changes?.find(x=>x.teamId===w.clubId&&x.reason==='injury');
      if(ch)injury={change:ch,injury:(adv.injuries??[]).find(x=>x.playerId===ch.out)??null,round:w.round};
    }
    if(!injury)return {ok:false,reason:'no injury substitution observed',manual};

    const contractPlayer=w.players.find(p=>p.clubId===w.clubId&&p.id!==injury.change.out&&p.position!=='POR');
    const offer=proposeCareerRenewal(w,{playerId:contractPlayer.id,expectedRevision:w.advancedV1.contractsV1.revision,years:2,annualWage:contractPlayer.wage*52,releaseFee:2_000_000});
    respondCareerRenewal(w,{offerId:offer,expectedRevision:w.advancedV1.contractsV1.revision,decision:'accept'});

    const managed=managedClubKey(w),target=marketPlayers(w,{limit:2000}).filter(x=>x.clubKey!==managed).map(x=>({x,v:marketValuation(w,x.id,managed)})).filter(({v})=>v.askingEUR<w.teams.find(c=>c.id===w.clubId).transferBudget*.5).sort((a,b)=>a.v.askingEUR-b.v.askingEUR)[0];
    if(!target)return {ok:false,reason:'no transfer target',manual,injury};
    const q=createCareerQuote(w,{type:'permanent',feeEUR:target.v.askingEUR,days:120});
    const deal=startMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId:target.x.id,buyerKey:managed,quote:q});
    answerMarketClub(w,{revision:w.advancedV1.marketV1.revision,dealId:deal,side:'seller',decision:'accept'});
    proposeMarketTerms(w,{revision:w.advancedV1.marketV1.revision,dealId:deal,annualWageEUR:Math.max(marketExistingWageEUR(w,target.x.id),Math.ceil(target.v.weeklyWageEUR*1.2/100)*100*52),years:3,role:'starter'});
    answerMarketPlayer(w,{revision:w.advancedV1.marketV1.revision,dealId:deal,decision:'accept'});
    completeMarketDeal(w,{revision:w.advancedV1.marketV1.revision,dealId:deal});
    syncCareerContracts(w);

    const ids=w.players.map(p=>p.id),managedPlayers=w.players.filter(p=>p.clubId===w.clubId),orphans=managedPlayers.filter(p=>!w.advancedV1.contractsV1.contracts[String(p.id)]).map(p=>p.id);
    return {
      ok:Boolean(manual&&injury.injury&&w.advancedV1.contractsV1.offers[offer]?.status==='accepted'&&w.advancedV1.marketV1.deals[deal]?.status==='completed'&&new Set(ids).size===ids.length&&orphans.length===0&&validateCareerMatchday(w)&&validateCareerContracts(w)&&validateCareerMarket(w)&&validateSave(w)),
      manual,injury,renewal:{offer,status:w.advancedV1.contractsV1.offers[offer]?.status},transfer:{deal,status:w.advancedV1.marketV1.deals[deal]?.status},integrity:{players:ids.length,unique:new Set(ids).size,orphans},
      valid:{matchday:validateCareerMatchday(w),contracts:validateCareerContracts(w),market:validateCareerMarket(w),save:validateSave(w)}
    };
  });
}
