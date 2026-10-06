export async function runMarketNegotiationBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerMarket,managedClubKey,marketClubs,marketPlayers,marketValuation,marketExistingWageEUR,createCareerQuote,startMarketDeal,marketClubDecision,answerMarketClub,proposeMarketTerms,answerMarketPlayer,completeMarketDeal,validateCareerMarket}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js')
    ]);
    const setup=()=>{const w=makeWorld();startCareer(w,1,'RST01 F01');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);return w;};
    const negotiate=(w,playerId,buyerKey,{feeEUR=null,type='permanent',releaseClauseEUR=null}={})=>{
      const v=marketValuation(w,playerId,buyerKey),fee=feeEUR??v.askingEUR;
      const q=createCareerQuote(w,{type,feeEUR:fee,days:90,loanEndSeason:type==='loan'?w.season:null,salarySharePct:type==='loan'?50:null,releaseClauseEUR});
      const id=startMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId,buyerKey,quote:q});
      const d=w.advancedV1.marketV1.deals[id],clubDecision=marketClubDecision(w,d);
      answerMarketClub(w,{revision:w.advancedV1.marketV1.revision,dealId:id,side:'seller',decision:clubDecision.decision==='accept'?'accept':clubDecision.decision,counterQuote:clubDecision.decision==='counter'?createCareerQuote(w,{type,feeEUR:clubDecision.askEUR,days:90,loanEndSeason:type==='loan'?w.season:null,salarySharePct:type==='loan'?50:null,releaseClauseEUR}):null});
      if(w.advancedV1.marketV1.deals[id].status!=='club_agreed')return {id,valuation:v,clubDecision,status:w.advancedV1.marketV1.deals[id].status};
      const source=marketPlayers(w,{limit:2000}).find(x=>x.id===playerId);
      const annual=type==='loan'?marketExistingWageEUR(w,playerId):Math.max(marketExistingWageEUR(w,playerId),Math.ceil(v.weeklyWageEUR*1.2/100)*100*52);
      proposeMarketTerms(w,{revision:w.advancedV1.marketV1.revision,dealId:id,annualWageEUR:annual,years:3,role:'starter',signingBonusEUR:0});
      answerMarketPlayer(w,{revision:w.advancedV1.marketV1.revision,dealId:id,decision:'accept'});
      const complete=completeMarketDeal(w,{revision:w.advancedV1.marketV1.revision,dealId:id});
      return {id,valuation:v,clubDecision,status:w.advancedV1.marketV1.deals[id].status,complete,source,annual};
    };

    const buy=setup(),managed=managedClubKey(buy),managedClub=buy.teams.find(c=>c.id===buy.clubId);
    const foreign=marketPlayers(buy,{limit:2000}).filter(x=>x.clubKey!==managed).map(x=>({x,v:marketValuation(buy,x.id,managed)})).filter(({v})=>v.askingEUR<=10_000_000&&v.askingEUR<managedClub.transferBudget*.65&&v.askingEUR<managedClub.balance*.65).sort((a,b)=>a.v.askingEUR-b.v.askingEUR)[0];
    if(!foreign)return {ok:false,reason:'no affordable foreign buy target'};
    const buyResult=negotiate(buy,foreign.x.id,managed);
    const bought=marketPlayers(buy,{limit:3000}).find(x=>x.id===foreign.x.id);
    const buyMovement=buy.advancedV1.marketV1.movements.find(x=>x.dealId===buyResult.id);

    const sell=setup(),sellManaged=managedClubKey(sell);
    const sellerPlayers=sell.players.filter(p=>p.clubId===sell.clubId&&p.position!=='POR'&&!sell.lineup.includes(p.id));
    const clubs=marketClubs(sell).filter(c=>c.key!==sellManaged);
    let sellChoice=null;
    for(const p of sellerPlayers){
      const pid=`${sell.countryId}:${p.id}`;
      for(const c of clubs){
        const v=marketValuation(sell,pid,c.key),fund=sell.advancedV1.marketV1.foreignFinances[c.key];
        if(fund&&v.askingEUR<=10_000_000&&v.askingEUR<fund.budget*.7&&v.askingEUR<fund.balance*.7){sellChoice={p,pid,c,v};break;}
      }
      if(sellChoice)break;
    }
    if(!sellChoice)return {ok:false,reason:'no affordable foreign buyer for managed sale',buyResult};
    const sellResult=negotiate(sell,sellChoice.pid,sellChoice.c.key);
    const soldLocal=sell.players.find(p=>p.id===sellChoice.p.id),sellMovement=sell.advancedV1.marketV1.movements.find(x=>x.dealId===sellResult.id);

    const reject=setup(),rejectManaged=managedClubKey(reject);
    const rejectTarget=marketPlayers(reject,{limit:2000}).filter(x=>x.clubKey!==rejectManaged)[0];
    const rejectQuote=createCareerQuote(reject,{type:'permanent',feeEUR:0,days:90});
    const rejectId=startMarketDeal(reject,{revision:reject.advancedV1.marketV1.revision,playerId:rejectTarget.id,buyerKey:rejectManaged,quote:rejectQuote});
    const rejectDecision=marketClubDecision(reject,reject.advancedV1.marketV1.deals[rejectId]);
    answerMarketClub(reject,{revision:reject.advancedV1.marketV1.revision,dealId:rejectId,side:'seller',decision:'reject'});

    return {
      ok:Boolean(
        buyResult.status==='completed'&&bought?.clubKey===managed&&buyMovement?.type==='permanent'&&
        sellResult.status==='completed'&&soldLocal?.clubId===0&&sellMovement?.type==='permanent'&&
        rejectDecision.decision==='reject'&&reject.advancedV1.marketV1.deals[rejectId].status==='rejected'&&
        validateCareerMarket(buy)&&validateCareerMarket(sell)&&validateCareerMarket(reject)&&validateSave(buy)&&validateSave(sell)&&validateSave(reject)
      ),
      buy:{target:foreign.x,deal:buyResult,movement:buyMovement,owner:bought?.clubKey},
      sell:{playerId:sellChoice.pid,buyer:sellChoice.c.key,deal:sellResult,movement:sellMovement,localClubId:soldLocal?.clubId},
      reject:{playerId:rejectTarget.id,decision:rejectDecision,status:reject.advancedV1.marketV1.deals[rejectId].status},
      valid:{buy:validateCareerMarket(buy),sell:validateCareerMarket(sell),reject:validateCareerMarket(reject)}
    };
  });
}

export async function runLoanClauseBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,newSeason,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerContracts,proposeCareerRenewal,respondCareerRenewal,validateCareerContracts},{enableCareerMarket,managedClubKey,marketClubs,marketPlayers,marketValuation,marketExistingWageEUR,createCareerQuote,startMarketDeal,marketClubDecision,answerMarketClub,proposeMarketTerms,answerMarketPlayer,completeMarketDeal,returnMarketLoansAfterArchive,validateCareerMarket}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-contracts.js'),import('/src/domain/career-market.js')
    ]);
    const setup=(contracts=false)=>{const w=makeWorld();startCareer(w,1,'RST01 F02');enableAdvancedCareer(w);enableCareerWorld(w);if(contracts)enableCareerContracts(w);enableCareerMarket(w);return w;};

    const loan=setup(),managed=managedClubKey(loan),managedClub=loan.teams.find(c=>c.id===loan.clubId);
    const target=marketPlayers(loan,{limit:2000}).filter(x=>x.clubKey!==managed).map(x=>({x,v:marketValuation(loan,x.id,managed)})).filter(({v})=>v.askingEUR*.05<managedClub.transferBudget*.5).sort((a,b)=>a.v.askingEUR-b.v.askingEUR)[0];
    if(!target)return {ok:false,reason:'no loan target'};
    const fee=Math.max(1000,Math.round(target.v.askingEUR*.05/1000)*1000);
    const q=createCareerQuote(loan,{type:'loan',feeEUR:fee,days:90,loanEndSeason:loan.season,salarySharePct:50});
    const loanId=startMarketDeal(loan,{revision:loan.advancedV1.marketV1.revision,playerId:target.x.id,buyerKey:managed,quote:q});
    const ld=marketClubDecision(loan,loan.advancedV1.marketV1.deals[loanId]);
    answerMarketClub(loan,{revision:loan.advancedV1.marketV1.revision,dealId:loanId,side:'seller',decision:'accept'});
    const annual=marketExistingWageEUR(loan,target.x.id);
    proposeMarketTerms(loan,{revision:loan.advancedV1.marketV1.revision,dealId:loanId,annualWageEUR:annual,years:1,role:'starter'});
    answerMarketPlayer(loan,{revision:loan.advancedV1.marketV1.revision,dealId:loanId,decision:'accept'});
    completeMarketDeal(loan,{revision:loan.advancedV1.marketV1.revision,dealId:loanId});
    const loanRecord=structuredClone(loan.advancedV1.marketV1.loans[target.x.id]);
    const loanOwner=marketPlayers(loan,{limit:3000}).find(x=>x.id===target.x.id)?.clubKey;
    const loanSeason=loan.season;
    while(loan.round<loan.fixtures.length)simulateRound(loan);
    newSeason(loan);
    const countryPool=marketPlayers(loan,{countryId:target.x.countryId,limit:10000});
    const allPool=marketPlayers(loan,{limit:10000});
    const returnedLocal=loan.players.find(p=>p.globalId===target.x.id||(loan.countryId+':'+p.id)===target.x.id);
    const returnedOwner=countryPool.find(x=>x.id===target.x.id)?.clubKey
      ?? allPool.find(x=>x.id===target.x.id)?.clubKey
      ?? returnedLocal?.departedTo;
    const loanRollover={fromSeason:loanSeason,toSeason:loan.season,round:loan.round};
    const findTargetRefs=(root,targetId)=>{
      const seen=new WeakSet(),hits=[];
      const visit=(value,path,depth)=>{
        if(hits.length>=100||depth>9||!value||typeof value!=='object')return;
        if(seen.has(value))return;seen.add(value);
        if(!Array.isArray(value)){
          const values=Object.values(value);
          if(values.some(v=>v===targetId)){
            hits.push({path,keys:Object.keys(value).slice(0,30),id:value.id,globalId:value.globalId,clubId:value.clubId,clubKey:value.clubKey,countryId:value.countryId,originKey:value.originKey,destinationKey:value.destinationKey,endSeason:value.endSeason});
          }
        }
        if(Array.isArray(value)){for(let i=0;i<value.length;i++)visit(value[i],path+'['+i+']',depth+1);}
        else {for(const [k,v] of Object.entries(value))visit(v,path+'.'+k,depth+1);}
      };
      visit(root,'loan',0);return hits;
    };
    const postRolloverRefs=findTargetRefs(loan,target.x.id);
    const diagnostics={
      countryMatches:countryPool.filter(x=>x.id===target.x.id).slice(0,10),
      allMatches:allPool.filter(x=>x.id===target.x.id).slice(0,10),
      localMatches:loan.players.filter(p=>p.globalId===target.x.id||`${loan.countryId}:${p.id}`===target.x.id).slice(0,10),
      worldKeys:Object.keys(loan.advancedV1?.worldV1||{}),
      marketKeys:Object.keys(loan.advancedV1?.marketV1||{}),
      postRolloverRefs,
      sources:{
        newSeason:String(newSeason).slice(0,6000),
        returnMarketLoansAfterArchive:String(returnMarketLoansAfterArchive).slice(0,6000),
        marketPlayers:String(marketPlayers).slice(0,6000)
      }
    };

    const clause=setup(true),clauseManaged=managedClubKey(clause),p=clause.players.find(x=>x.clubId===clause.clubId&&x.position!=='POR'&&!clause.lineup.includes(x.id));
    if(!p)return {ok:false,reason:'no clause sale player'};
    const releaseFee=1_000_000;
    const offer=proposeCareerRenewal(clause,{playerId:p.id,expectedRevision:clause.advancedV1.contractsV1.revision,years:2,annualWage:p.wage*52,releaseFee});
    respondCareerRenewal(clause,{offerId:offer,expectedRevision:clause.advancedV1.contractsV1.revision,decision:'accept'});
    const pid=`${clause.countryId}:${p.id}`;
    const buyer=marketClubs(clause).filter(c=>c.key!==clauseManaged).find(c=>{
      const f=clause.advancedV1.marketV1.foreignFinances[c.key];return f&&f.balance>releaseFee*2&&f.budget>releaseFee*2;
    });
    if(!buyer)return {ok:false,reason:'no clause buyer'};
    const cq=createCareerQuote(clause,{type:'permanent',feeEUR:releaseFee,days:90,releaseClauseEUR:releaseFee});
    const clauseId=startMarketDeal(clause,{revision:clause.advancedV1.marketV1.revision,playerId:pid,buyerKey:buyer.key,quote:cq});
    const decision=marketClubDecision(clause,clause.advancedV1.marketV1.deals[clauseId]);
    answerMarketClub(clause,{revision:clause.advancedV1.marketV1.revision,dealId:clauseId,side:'seller',decision:'accept'});
    const v=marketValuation(clause,pid,buyer.key),newAnnual=Math.max(p.wage*52,Math.ceil(v.weeklyWageEUR*1.2/100)*100*52);
    proposeMarketTerms(clause,{revision:clause.advancedV1.marketV1.revision,dealId:clauseId,annualWageEUR:newAnnual,years:3,role:'starter'});
    answerMarketPlayer(clause,{revision:clause.advancedV1.marketV1.revision,dealId:clauseId,decision:'accept'});
    completeMarketDeal(clause,{revision:clause.advancedV1.marketV1.revision,dealId:clauseId});
    const movement=clause.advancedV1.marketV1.movements.find(x=>x.dealId===clauseId),sold=clause.players.find(x=>x.id===p.id);

    return {
      ok:Boolean(
        ld.decision==='accept'&&loanRecord&&loanOwner===managed&&loan.season===loanSeason+1&&loan.round===0&&!loan.advancedV1.marketV1.loans[target.x.id]&&returnedOwner===target.x.clubKey&&
        decision.decision==='accept'&&movement?.feeEUR===releaseFee&&sold?.clubId===0&&
        validateCareerMarket(loan)&&validateCareerMarket(clause)&&validateCareerContracts(clause)&&validateSave(loan)&&validateSave(clause)
      ),
      loan:{playerId:target.x.id,decision:ld,record:loanRecord,loanOwner,returnedOwner,origin:target.x.clubKey,rollover:loanRollover,diagnostics},
      clause:{playerId:pid,releaseFee,decision,movement,localClubId:sold?.clubId},
      valid:{loan:validateCareerMarket(loan),clause:validateCareerMarket(clause),contracts:validateCareerContracts(clause)}
    };
  });
}

export async function runCalendarBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerMarket,managedClubKey,marketPlayers,marketValuation,marketExistingWageEUR,createCareerQuote,startMarketDeal,answerMarketClub,proposeMarketTerms,answerMarketPlayer},{enableCareerCalendar,windowStatus,windowsForCountry,releaseCareerFreeAgent,signCareerFreeAgent,bookCareerTransfer,validateCareerCalendar}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js'),import('/src/domain/career-calendar.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 F03');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);enableCareerCalendar(w);
    const managed=managedClubKey(w),status=windowStatus(w,w.countryId);
    const release=w.players.find(p=>p.clubId===w.clubId&&p.position!=='POR'&&!w.lineup.includes(p.id));
    if(!release)return {ok:false,reason:'no releasable player'};
    const releaseId=`${w.countryId}:${release.id}`,releaseWage=release.wage*52;
    releaseCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:releaseId,consent:true});
    const freeStored=Boolean(w.advancedV1.calendarV1.freeAgents[releaseId]);
    signCareerFreeAgent(w,{revision:w.advancedV1.calendarV1.revision,playerId:releaseId,buyerKey:managed,annualWageEUR:releaseWage,years:2});
    const signed=Boolean(w.players.find(p=>(p.globalId??`${w.countryId}:${p.id}`)===releaseId&&p.clubId===w.clubId));

    const target=marketPlayers(w,{limit:2000}).filter(x=>x.clubKey!==managed).map(x=>({x,v:marketValuation(w,x.id,managed)})).filter(({v})=>v.askingEUR<w.teams.find(c=>c.id===w.clubId).transferBudget*.6).sort((a,b)=>a.v.askingEUR-b.v.askingEUR)[0];
    if(!target)return {ok:false,reason:'no registration target',status,freeStored,signed};
    const q=createCareerQuote(w,{type:'permanent',feeEUR:target.v.askingEUR,days:200});
    const id=startMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId:target.x.id,buyerKey:managed,quote:q});
    answerMarketClub(w,{revision:w.advancedV1.marketV1.revision,dealId:id,side:'seller',decision:'accept'});
    const annual=Math.max(marketExistingWageEUR(w,target.x.id),Math.ceil(target.v.weeklyWageEUR*1.2/100)*100*52);
    proposeMarketTerms(w,{revision:w.advancedV1.marketV1.revision,dealId:id,annualWageEUR:annual,years:3,role:'starter'});
    answerMarketPlayer(w,{revision:w.advancedV1.marketV1.revision,dealId:id,decision:'accept'});
    bookCareerTransfer(w,{revision:w.advancedV1.calendarV1.revision,dealId:id,effectiveDay:w.advancedV1.clockDay});
    const registration=w.advancedV1.calendarV1.registrations.find(r=>r.dealId===id);

    const closedTarget=marketPlayers(w,{limit:2000}).find(x=>x.clubKey!==managed&&x.id!==target.x.id);
    const cv=marketValuation(w,closedTarget.id,managed),cq=createCareerQuote(w,{type:'permanent',feeEUR:cv.askingEUR,days:200});
    const cid=startMarketDeal(w,{revision:w.advancedV1.marketV1.revision,playerId:closedTarget.id,buyerKey:managed,quote:cq});
    answerMarketClub(w,{revision:w.advancedV1.marketV1.revision,dealId:cid,side:'seller',decision:'accept'});
    proposeMarketTerms(w,{revision:w.advancedV1.marketV1.revision,dealId:cid,annualWageEUR:Math.max(marketExistingWageEUR(w,closedTarget.id),Math.ceil(cv.weeklyWageEUR*1.2/100)*100*52),years:3,role:'starter'});
    answerMarketPlayer(w,{revision:w.advancedV1.marketV1.revision,dealId:cid,decision:'accept'});
    const windows=windowsForCountry(w,w.countryId),gapDay=windows[0].close+1;let closedError=null;
    try{bookCareerTransfer(w,{revision:w.advancedV1.calendarV1.revision,dealId:cid,effectiveDay:gapDay});}catch(e){closedError=String(e?.message||e);}

    return {
      ok:Boolean(status.open&&freeStored&&signed&&registration&&/REGISTRATION_WINDOW_CLOSED/.test(closedError||'')&&validateCareerCalendar(w)&&validateSave(w)),
      status,freeAgent:{id:releaseId,freeStored,signed},registration,closedWindow:{gapDay,error:closedError},validCalendar:validateCareerCalendar(w),validSave:validateSave(w)
    };
  });
}

export async function runScoutingBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{enableAdvancedCareer,prepareAdvancedRound},{enableCareerWorld,syncCareerWorldClock},{enableCareerMarket},{enableCareerScouting,scoutingPlayers,scoutingEstimate,assignScoutingMission,shortlistScoutedPlayer,refreshScoutingReport,advanceCareerScouting,validateCareerScouting}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js'),import('/src/domain/career-scouting.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 F04');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);enableCareerScouting(w);
    const foreign=scoutingPlayers(w).find(x=>x.countryId!==w.countryId);
    if(!foreign)return {ok:false,reason:'no foreign scouting country'};
    const mission=assignScoutingMission(w,{revision:w.advancedV1.scoutingV1.revision,countryId:foreign.countryId,position:'ALL',ageMin:15,ageMax:45,contractMax:20,weeks:2});
    for(let i=0;i<2;i++){prepareAdvancedRound(w);syncCareerWorldClock(w);advanceCareerScouting(w);}
    const completed=w.advancedV1.scoutingV1.missions.find(m=>m.id===mission);
    const reportEntry=Object.entries(w.advancedV1.scoutingV1.reports).find(([,r])=>r.countryId===foreign.countryId);
    if(!reportEntry)return {ok:false,reason:'mission produced no scouting report',mission:completed};
    const [playerId,reportBefore]=reportEntry;
    shortlistScoutedPlayer(w,{revision:w.advancedV1.scoutingV1.revision,playerId,add:true});
    const shortlisted=w.advancedV1.scoutingV1.shortlist.includes(playerId);
    for(let i=0;i<5;i++){prepareAdvancedRound(w);syncCareerWorldClock(w);}
    const before=scoutingEstimate(w,playerId);
    const refresh=refreshScoutingReport(w,{revision:w.advancedV1.scoutingV1.revision,playerId});
    const reportAfter=w.advancedV1.scoutingV1.reports[playerId],after=scoutingEstimate(w,playerId);
    return {
      ok:Boolean(
        completed?.status==='completed'&&reportAfter.confidence>=reportBefore.confidence&&reportAfter.confidence>0&&
        before.confidence<after.confidence&&JSON.stringify(before)!==JSON.stringify(after)&&shortlisted&&validateCareerScouting(w)&&validateSave(w)
      ),
      target:{id:playerId,countryId:foreign.countryId},mission:completed,before,reportBefore,refresh,reportAfter,after,shortlisted,
      validScouting:validateCareerScouting(w),validSave:validateSave(w)
    };
  });
}

export async function runAIMarketBehavior(page,baseURL){
  await page.goto(`${baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
  return page.evaluate(async()=>{
    const [{makeWorld},{startCareer,simulateRound,newSeason,validateSave},{enableAdvancedCareer},{enableCareerWorld},{enableCareerMarket,validateCareerMarket},{enableCareerCalendar,previewCalendarAdvance,validateCareerCalendar},{enableCareerScouting,validateCareerScouting},{enableCareerAIMarket,validateCareerAIMarket}]=await Promise.all([
      import('/src/data.js'),import('/src/engine.js'),import('/src/domain/advanced-career.js'),import('/src/domain/career-world.js'),import('/src/domain/career-market.js'),import('/src/domain/career-calendar.js'),import('/src/domain/career-scouting.js'),import('/src/domain/career-ai-market.js')
    ]);
    const w=makeWorld();startCareer(w,1,'RST01 F05');enableAdvancedCareer(w);enableCareerWorld(w);enableCareerMarket(w);enableCareerCalendar(w);enableCareerScouting(w);enableCareerAIMarket(w);
    const playRound=()=>{
      const preview=previewCalendarAdvance(w,{toDay:w.advancedV1.clockDay+7});
      return simulateRound(w,{calendarConfirmationToken:preview.confirmationToken});
    };
    const seasons=[];
    for(let seasonIndex=0;seasonIndex<2;seasonIndex++){
      while(w.round<w.fixtures.length)playRound();
      seasons.push({season:w.season,metrics:structuredClone(w.advancedV1.aiMarketV1.metrics),history:w.advancedV1.aiMarketV1.history.length,offers:w.advancedV1.aiMarketV1.offers.length});
      if(seasonIndex===0)newSeason(w);
    }
    const finances=Object.entries(w.advancedV1.marketV1.foreignFinances).map(([key,v])=>({key,balance:v.balance,budget:v.budget}));
    const strategies=Object.entries(w.advancedV1.aiMarketV1.clubs).map(([key,v])=>({key,...v}));
    const nonNegative=finances.every(x=>x.balance>=0&&x.budget>=0),movesBounded=strategies.every(x=>x.movesThisSeason>=0&&x.movesThisSeason<=3);
    const activity=seasons.some(x=>x.metrics.offers>0)&&seasons.some(x=>x.history>0||x.metrics.completed>0||x.metrics.refused>0||x.metrics.expired>0);
    return {
      ok:Boolean(activity&&nonNegative&&movesBounded&&validateCareerAIMarket(w)&&validateCareerMarket(w)&&validateCareerCalendar(w)&&validateCareerScouting(w)&&validateSave(w)),
      seasons,finances:finances.slice(0,60),strategies:strategies.slice(0,60),activity,nonNegative,movesBounded,
      valid:{ai:validateCareerAIMarket(w),market:validateCareerMarket(w),calendar:validateCareerCalendar(w),scouting:validateCareerScouting(w),save:validateSave(w)}
    };
  });
}
