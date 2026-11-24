import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {competitionRewards,rewardTotals,REWARD_IDS,largestRemainder,placementReference,participationReference,pointsReference,CREDIT_MILESTONES,plannedRewardInstallments,formatRewardAmount,rewardEvidenceState,seasonRewardReference,rewardSeasonFinished} from '../assets/competition-rewards.mjs';
test('all canonical competitions, no fabricated competition',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
 const definitions=[...read('divisions.json'),...read('international-competitions.json')];
 assert.equal(definitions.length,18);
 assert.deepEqual([...REWARD_IDS].sort(),definitions.map(d=>d.id).sort());
 for(const d of definitions){
  const reward=competitionRewards(d.id);
  assert.equal(reward.capacity,d.capacity);
  assert.equal(reward.pool,reward.participation+reward.points+reward.placement);
  assert.equal(reward.status,'draft-reference');
  assert.equal(reward.version,'draft-5');
  assert.equal(reward.shares.reduce((a,b)=>a+b),100);
  assert.equal(competitionRewards(d.id.toLowerCase()).id,d.id);
  for(const key of ['earned','paid','credited','payable'])assert.equal(Object.hasOwn(reward,key),false);
 }
 assert.equal(competitionRewards('IT-3'),null);
 assert.equal(competitionRewards(null),null);
});
test('approved totals and participation references',()=>{
 assert.deepEqual(rewardTotals(),{pool:2400000,participation:1353600,points:374400,placement:672000});
 for(const [id,pool,reference] of [['IT-1',160000,6000],['IT-2',80000,3000],['int-1',320000,5600],['int-2',160000,2800]]){
  const row=competitionRewards(id);
  assert.equal(row.pool,pool);
  assert.equal(row.participationReference,reference);
  assert.equal(row.participationIsAverage,false);
 }
});

test('Hamilton exact arithmetic, no default equal remainder ordering',()=>{
 const rows=Array.from({length:24},(_,i)=>({id:'club-'+i,weight:1})),order=rows.map(x=>x.id);
 for(const [pool,high,count] of [[3200000,133334,8],[1600000,66667,16]]){
  assert.equal(largestRemainder(pool,rows).status,'pending-tiebreak');
  const result=largestRemainder(pool,rows,order);
  assert.equal(result.allocations.reduce((s,x)=>s+x.amount,0),pool);
  assert.equal(result.allocations.filter(x=>x.amount===high).length,count);
  assert.deepEqual(Object.fromEntries(result.allocations.map(x=>[x.id,x.amount])),Object.fromEntries(largestRemainder(pool,[...rows].reverse(),order).allocations.map(x=>[x.id,x.amount])));
 }
 assert.equal(largestRemainder(100,[{id:'a',weight:0}]).status,'pending-zero-denominator');
 assert.throws(()=>largestRemainder(100,[{id:'a',weight:1},{id:'a',weight:2}]));
 assert.throws(()=>largestRemainder(100,rows,['club-0']));
 assert.deepEqual(largestRemainder(3,[{id:'a',weight:1},{id:'b',weight:2}]).allocations,[{id:'a',amount:1},{id:'b',amount:2}]);
});
test('reference tables and timing conserve each component',()=>{
 for(const id of REWARD_IDS){
  const r=competitionRewards(id),p=participationReference(r),schedule=placementReference(r);
  assert.equal(p.floor*p.lowerCount+p.higher*p.higherCount,r.participation);
  assert.equal(schedule.reduce((s,x)=>s+x.amount*(x.count??1),0),r.placement);
  assert.equal(pointsReference(r,[]).status,'pending-incomplete');
  assert.equal(p.installment*2,p.floor);
  assert.equal(p.higherCount,0);
  assert.equal(p.installment%100,0);
  assert.ok(schedule.every(x=>x.amount%100===0));
  if(!r.international)assert.ok(schedule.every((x,i)=>i===0||x.amount<schedule[i-1].amount));
 }
 assert.deepEqual(CREDIT_MILESTONES.participation,[28,56]);
 assert.equal(placementReference(competitionRewards('int-1'))[0].amount,36000);
 assert.equal(placementReference(competitionRewards('int-2'))[1].amount,10000);
});

test('public rewards exposes only pool and season club table; admin retains schedule',async()=>{
 const {renderCompetitionRewards,renderAdminRewards,renderRewardCard}=await import('../tools/render-competition-rewards.mjs');
 for(const id of REWARD_IDS){
  const html=renderCompetitionRewards(id);
  assert.match(html,/rewardPool/);
  assert.doesNotMatch(html,/rewardSeasonEstimateNote/);
  assert.match(html,/rewardSeasonEstimate/);
  assert.match(html,/aria-busy="true"/);
  assert.match(html,/fa-reward-name-slot/);
  assert.match(html,/app-view-skeleton-crest-slot/);
  assert.doesNotMatch(html,/rewardLegendTiming/);
  assert.match(html,/rewardCalculatedNote/);
  assert.match(html,/rewardPerClub/);
  assert.match(html,/data-season-reward-heading/);
  assert.match(html,/fa-reward-milestone-row/);
  assert.match(html,/rewardPaymentAtDay">Payment at day<\/span> 28/);
  assert.match(html,/rewardPaymentAtDay">Payment at day<\/span> 56/);
  const legend=html.slice(html.indexOf('data-season-reward-legend'),html.indexOf('data-season-reward-table'));
  assert.equal((legend.match(/<table /g)||[]).length,1,'one distribution table');
  assert.equal((legend.match(/data-reward-disclosure=/g)||[]).length,2);
  for(const group of ['points','placement']){
   const button=legend.match(new RegExp('data-reward-disclosure="'+group+'" aria-expanded="false" aria-controls="([^"]+)"'));
   assert.ok(button);
   const ids=button[1].split(' ');
   assert.equal(ids.length,group==='points'?1:placementReference(competitionRewards(id)).length+2);
   for(const detailId of ids)assert.ok(legend.includes('id="'+detailId+'" class="fa-reward-detail-row" data-reward-detail="'+group+'" hidden'));
   assert.ok(legend.indexOf('data-reward-disclosure="'+group+'"')<legend.indexOf('id="'+ids[0]+'"'));
  }
  assert.match(html,/class="language-chevron"/);
  assert.match(html,id.startsWith('int-')?/rewardCupPointsExplanation/:/rewardDomesticPointsExplanation/);
  assert.match(html,id.startsWith('int-')?/rewardAdvancementExplanation/:/rewardPlacementExplanation/);
  assert.match(html,id.startsWith('int-')?/rewardOutcome/:/rewardRank/);
  assert.ok(html.indexOf('data-season-reward-legend')<html.indexOf('data-season-reward-table'));
  assert.match(html,/rewardParticipation/);
  assert.match(html,/rewardPoints/);
  assert.match(html,/fa-reward-value-cell/);
  assert.match(html,/data-season-reward-rows/);
  assert.equal((html.match(/data-reward-placeholder/g)||[]).length,competitionRewards(id).capacity);
  assert.doesNotMatch(html,/rewardCreditSchedule|rewardHamilton|rewardPointsFormula|data-reward-(?:earned|paid|credited|payable)=/);
  assert.match(renderRewardCard(id),/fa-reward-card-pool/);
 }
 const admin=renderAdminRewards([],String);
 assert.match(admin,/data-admin-rewards-content hidden/);
 assert.match(admin,/class="app-panel admin-rewards-summary"/);
 assert.match(admin,/class="language-trigger" data-admin-rewards-trigger role="combobox"/);
 assert.match(admin,/aria-controls="admin-reward-season-options"/);
 assert.match(admin,/class="fa-reward-table admin-rewards-distribution"/);
 assert.equal((admin.match(/role="region" tabindex="0"/g)||[]).length,2);
 assert.match(admin,/<tfoot><tr>/);
 assert.match(admin,/<h2 class="sr-only" id="admin-rewards-payments-heading"/);
 assert.match(admin,/<h2 class="sr-only" id="admin-rewards-distribution-heading"/);
 assert.match(admin,/<th scope="col"><span data-app-i18n="rewardCreditSchedule">Planned payments<\/span><\/th>/);
 assert.equal((admin.match(/data-reward-state=/g)||[]).length,3);
 assert.doesNotMatch(admin,/rewardDraftNote|rewardCertifiedBeforePayment|fa-reward-footnote|fa-reward-note/);
 assert.match(admin,/rewardEvidenceConfigOnly" hidden>Planned amounts, not confirmed payments\./);
 assert.doesNotMatch(admin,/class="fa-rewards"/);
 assert.match(admin,/rewardDay">Day<\/span> 28/);
 assert.match(admin,/rewardDay">Day<\/span> 56/);
});
test('current and historical season reward estimates use season-specific clubs and results',()=>{
 const participants=Array.from({length:16},(_,i)=>({countryId:'IT',clubId:i+1,primaryName:'Club '+(i+1)}));
 const context={selectedSeason:1,definition:{id:'IT-1'},seasonData:{season:1,seasonState:{phase:'closed',day:56},provenance:{kind:'authoritative'},participants,statistics:{standings:participants.map((club,i)=>({club,played:30,pts:60-i}))}}};
 const model=seasonRewardReference('IT-1',context);
 assert.equal(model.rows.length,16);assert.equal(model.pending,false);
 assert.equal(model.rows.reduce((n,r)=>n+r.amount,0),160000);
 assert.ok(model.rows.every(r=>Number.isSafeInteger(r.amount)));
 assert.equal(model.rows[0].id,'IT-1');
 context.seasonData.seasonState={phase:'active',day:28};
 assert.ok(seasonRewardReference('IT-1',context).rows.every(r=>r.amount===3000));
 context.seasonData.seasonState.day=27;
 assert.ok(seasonRewardReference('IT-1',context).rows.every(r=>r.amount===0));
 context.seasonData.seasonState.day=56;context.seasonData.statistics.standings[0].played=29;
 assert.ok(seasonRewardReference('IT-1',context).rows.every(r=>r.amount===null));
 context.selectedSeason=2;assert.equal(seasonRewardReference('IT-1',context),null);
});
test('Rewards routes and public static assets are explicitly allowed',async()=>{
 const {parseRoute}=await import('../assets/routes-registry.mjs');
 const {publicRequestFile,isAllowlistedPublicPath}=await import('../tools/publication-guard.mjs');
 for(const id of REWARD_IDS){
  const route='/competitions/'+id.toLowerCase()+'/rewards';
  assert.equal(parseRoute(route)?.view,'rewards');
  assert.equal(publicRequestFile(route),'competitions/'+id.toLowerCase()+'/index.html');
 }
 assert.equal(parseRoute('/admin/rewards')?.canonical,'/admin/rewards');
 assert.equal(publicRequestFile('/admin/rewards'),'admin/rewards/index.html');
 for(const path of ['admin/rewards/index.html','assets/rewards-ui.mjs','assets/competition-rewards.mjs','assets/competition-rewards.css'])assert.equal(isAllowlistedPublicPath(path),true,path);
});

test('literal $ARC display and no rounding of exact allocations',()=>{
 assert.equal(formatRewardAmount(864000,'en'),'864,000 $ARC');
 assert.equal(formatRewardAmount(864000,'it'),'864.000 $ARC');
 assert.equal(formatRewardAmount(0),'0 $ARC');
 assert.equal(formatRewardAmount(1.5),'—');
 assert.equal(formatRewardAmount(133333.333,'en',{average:true}),'≈ 133,333 $ARC');
});
test('sporting evidence is never confused with historical rewards or completed cup',()=>{
 const snapshot={source:'authoritative',world:{seasonNumber:2}},id='int-1';
 const context={selectedSeason:2,definition:{id},seasonData:{season:2,world:{seasonNumber:2},provenance:{kind:'authoritative'},participants:Array(24).fill('club'),statistics:{standings:Array.from({length:24},()=>({played:6}))}}};
 const state=(overrides={})=>rewardEvidenceState({id,context,worldSnapshot:snapshot,...overrides});
 assert.equal(state(),'rewardEvidenceLeagueComplete');
 assert.equal(state({debug:true}),'rewardEvidenceDebug');
 assert.equal(state({worldSnapshot:{source:'preview',world:{seasonNumber:2}}}),'rewardEvidencePending');
 assert.equal(state({context:{...context,selectedSeason:1}}),'rewardEvidenceHistory');
 assert.equal(state({context:{...context,selectedSeason:3}}),'rewardEvidencePending');
 assert.equal(state({worldSnapshot:{source:'authoritative',world:{seasonNumber:0}}}),'rewardEvidenceZero');
 assert.equal(state({context:{...context,seasonData:{...context.seasonData,entrantsOnly:true}}}),'rewardEvidenceEntrants');
 assert.equal(state({context:{...context,seasonData:{...context.seasonData,season:1}}}),'rewardEvidencePending');
 assert.equal(state({context:{...context,seasonData:{...context.seasonData,statistics:{standings:[]}}}}),'rewardEvidencePartial');
});

test('two configured payment dates conserve all pools without settlement claims',()=>{
 assert.equal(CREDIT_MILESTONES.performanceDay,56);
 for(const id of REWARD_IDS){
  const r=competitionRewards(id),[first,second]=plannedRewardInstallments(r);
  assert.equal(first.day,28);assert.equal(second.day,56);
  assert.equal(first.total,r.participation/2);
  assert.equal(first.points+first.placement,0);
  assert.equal(second.participation,r.participation/2);
  assert.equal(second.points,r.points);assert.equal(second.placement,r.placement);
  assert.equal(first.total+second.total,r.pool);
 }
 assert.deepEqual(plannedRewardInstallments(rewardTotals()).map(x=>x.total),[676800,1723200]);
});

test('season read lifecycle is shared with Rewards and independent of world readiness',()=>{
 const page=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../assets/rewards-ui.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../assets/competition-rewards.css',import.meta.url),'utf8');
 assert.match(page,/const applySeasonReadState=state=>\{publishSeasonReadState\(state\)/);
 assert.match(page,/onState:applySeasonReadState/);
 assert.match(page,/applySeasonReadState\(cached.status\)/);
 assert.match(ui,/fa:competition-season-read-state/);
 assert.match(ui,/read\?\.season===context\?\.selectedSeason/);
 assert.doesNotMatch(ui,/worldStatus!==/);
 assert.match(ui,/table.setAttribute\('aria-busy',String\(loading\)\)/);
 assert.match(css,/\.fa-reward-name-slot>\.app-skeleton-bar\{[^}]*margin:0/);
 assert.match(css,/\.fa-reward-value>\.app-skeleton-bar\{[^}]*margin:0/);
});

test('Rewards orders legend and table by the selected season, including archives and DEV',()=>{
 const context={selectedSeason:2,seasonData:null},world={source:'authoritative',world:{seasonNumber:3,phase:'active'}};
 assert.equal(rewardSeasonFinished(context,world),true);
 assert.equal(rewardSeasonFinished({...context,selectedSeason:3},world),false);
 assert.equal(rewardSeasonFinished({...context,selectedSeason:3}, {...world,world:{seasonNumber:3,phase:'closed'}}),true);
 const current={selectedSeason:3,seasonData:{season:3,provenance:{kind:'authoritative'},seasonState:{phase:'active',day:56}}};
 assert.equal(rewardSeasonFinished(current,world,{pending:true}),false);
 assert.equal(rewardSeasonFinished(current,world,{pending:false}),true);
 assert.equal(rewardSeasonFinished(context,{source:'dev',current:{season:3,day:1}},null,true),true);
 assert.equal(rewardSeasonFinished(context,{source:'dev',current:{season:2,day:1}},null,true),false);
});

test('international participation reference is integer, deterministic and conserves installment pool',()=>{
 const participants=Array.from({length:24},(_,i)=>({countryId:'IT',clubId:i+1,primaryName:'Club '+(i+1)}));
 const context={selectedSeason:2,definition:{id:'int-1'},seasonData:{season:2,seasonState:{phase:'active',day:28},provenance:{kind:'authoritative'},participants}};
 const a=seasonRewardReference('int-1',context);
 assert.equal(a.rows.reduce((sum,r)=>sum+r.amount,0),67200);
 assert.ok(a.rows.every(r=>r.amount===2800));
 context.seasonData.participants=[...participants].reverse();
 assert.deepEqual(seasonRewardReference('int-1',context),a);
});

// Club license calibration is research only; the canonical reward schedule is shared.
test('club license DRAFT reference covers all clubs and preserves genesis separation',async()=>{
 const {buildCalibration}=await import('../tools/run-club-license-calibration.mjs');
 const {makeCalibration}=await import('../tools/club-license-calibration.mjs');
 const rewards=await import('../assets/competition-rewards.mjs');
 const {MARKET_VALUE_CONFIG}=await import('../backend/src/player-market-value.mjs');
 const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
 const c=read('tools/club-license-calibration-v1.json'),clubs=read('data/clubs.json'),selection=read('backend/catalogues/season-1.participants.json');
 const result=buildCalibration();
 assert.deepEqual(result,read('docs/club-license-calibration-v1-results.json'));
 assert.equal(result.rows.length,320);assert.equal(new Set(result.rows.map(r=>r.clubKey)).size,320);
 assert.ok(Math.abs(result.totals.expectedRewardsArc-rewardTotals().pool)<4);
 assert.ok(result.rows.every(r=>r.genesisArc>0&&r.baseLicenseCents>=c.minimumCents&&r.initialDay28GapArc===0));
 assert.deepEqual(makeCalibration([...clubs].reverse(),selection,c,rewards,MARKET_VALUE_CONFIG),result);
 const key='IT-1',old=result.rows.find(r=>r.clubKey===key),changed=makeCalibration(clubs,selection,{...c,clubOverrides:{[key]:{genesisArc:9999}}},rewards,MARKET_VALUE_CONFIG).rows.find(r=>r.clubKey===key);
 assert.equal(changed.genesisArc,9999);assert.equal(changed.baseLicenseCents,old.baseLicenseCents);
 assert.throws(()=>makeCalibration(clubs,selection,{...c,clubOverrides:{'XX-1':{genesisArc:1}}},rewards,MARKET_VALUE_CONFIG));
 assert.throws(()=>makeCalibration(clubs,selection,{...c,clubOverrides:{[key]:{genesisArc:0}}},rewards,MARKET_VALUE_CONFIG));
 assert.ok(result.rows.filter(r=>r.initialTier===0).every(r=>r.baseLicenseCents===c.minimumCents&&r.expectedSurplusArc===0));
});

test('offline finance stress deterministic shortfall and conservation',async()=>{
 const {runStress}=await import('../tools/club-finance-stress.mjs');
 const {buildCalibration}=await import('../tools/run-club-license-calibration.mjs');
 const rewards=await import('../assets/competition-rewards.mjs');
 const {MARKET_VALUE_CONFIG}=await import('../backend/src/player-market-value.mjs');
 const config=JSON.parse(readFileSync(new URL('../tools/club-finance-stress-v1.json',import.meta.url),'utf8'));
 const ref=buildCalibration(),scenario=config.scenarios[0];
 const short={...config,seasons:2};const a=runStress(ref,rewards,MARKET_VALUE_CONFIG,short,scenario,769);
 assert.equal(a.completed,2);assert.deepEqual(a,runStress(ref,rewards,MARKET_VALUE_CONFIG,short,scenario,769));
 for(const s of a.series)assert.equal(s.wagePaid,s.humanPaid+s.aiPaid);
 assert.equal(a.closingClubArc+a.closingReserveArc+a.closingWalletArc,a.openingArc+a.totalIssuedArc+a.capitalIssuedArc);
 const blocked=runStress(ref,rewards,MARKET_VALUE_CONFIG,{...short,initialReserveArc:0},{...scenario,annualCapArc:0},769);
 assert.equal(blocked.completed,0);assert.equal(blocked.stopped.season,1);assert.equal(blocked.totalIssuedArc,0);
 const historical=JSON.parse(readFileSync(new URL('../docs/club-finance-stress-v1-results.json',import.meta.url),'utf8'));
 assert.deepEqual(historical.runs.find(r=>r.scenario===scenario.name&&r.seed===769).series.slice(0,2),a.series);
});

test('retirement-aware club license references and supply sensitivity',async()=>{
 const {buildRenewal}=await import('../tools/run-club-license-renewal.mjs');
 const result=buildRenewal();
 assert.deepEqual(result,JSON.parse(readFileSync(new URL('../docs/club-license-renewal-v2-results.json',import.meta.url),'utf8')));
 assert.equal(result.selected.rows.length,320);assert.equal(result.retirement.annualCandidates,768);
 assert.equal(result.selected.topReference.baseLicenseCents,29500);assert.equal(result.selected.lowReference.baseLicenseCents,10000);
 assert.ok(result.retirement.annualWorld>300&&result.retirement.annualWorld<350);
 assert.ok(result.retirement.scenarios.find(s=>s.activations===206).endingShortfallAgainstSlots>0);
 assert.ok(result.retirement.scenarios.find(s=>s.activations===497).endingShortfallAgainstSlots===0);
 assert.ok(result.feeSensitivity[0].topBaseCents>result.selected.topReference.baseLicenseCents);
});

test('academy dual quote is independently rounded and preserves same denomination',async()=>{
 const {quoteYouth,unitEconomics}=await import('../tools/academy-dual-pricing.mjs');
 const c=JSON.parse(readFileSync(new URL('../tools/academy-dual-pricing-v1.json',import.meta.url),'utf8'));
 assert.deepEqual(quoteYouth(1000,100,85),{arc:1000,eurCents:850});assert.deepEqual(quoteYouth(101,100,85),{arc:101,eurCents:86});
 assert.throws(()=>quoteYouth(-1,100,85));assert.throws(()=>quoteYouth(1000,101,85));
 const unit=unitEconomics(c,quoteYouth),snapshot=JSON.parse(readFileSync(new URL('../docs/academy-dual-pricing-v1-results.json',import.meta.url),'utf8'));
 assert.deepEqual(unit,snapshot.unitEconomics);assert.ok(unit.every(x=>x.mix.every(m=>m.arcOrders+m.eurOrders===m.activations)));
});

test('retirement-matched academy recycling counts each currency once',async()=>{
 const {buildRenewalRecycling}=await import('../tools/run-academy-renewal-recycling.mjs');
 const x=buildRenewalRecycling();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/academy-renewal-recycling-v2-results.json',import.meta.url),'utf8')));
 assert.ok(x.mix.every(m=>m.arcOrders+m.eurOrders===x.annualRetirements));
 const mix=x.mix.find(m=>m.eurOrders===83);assert.equal(mix.arcReceipts,387195);assert.equal(mix.requiredAverageArcPriceForAcademyOnly,9639);
 assert.equal(mix.reserveScenarios[0].uncoveredRewardsArc,2012805);
 assert.ok(mix.contributionBeforeFixedCostsCents[0].contributionCents>mix.contributionBeforeFixedCostsCents[3].contributionCents);
});

test('joint economy grid reconciles reserve and aggregate stocks',async()=>{
 const {buildJointCalibration}=await import('../tools/run-economy-joint-calibration.mjs');
 const x=buildJointCalibration();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v1-results.json',import.meta.url),'utf8')));
 assert.equal(x.grid.length,48);assert.equal(x.baseline.topLicenseEur,295);assert.equal(x.baseline.lowLicenseEur,100);
 assert.ok(x.baseline.unfundedYouthArcDemand>0);assert.ok(x.baseline.requiredAdditionalReserveReceiptsArc>0);
 assert.ok(x.aggregateCashFlow[0].totalIssuedArc>0);assert.equal(x.aggregateCashFlow[1].totalIssuedArc,0);
});

test('optional staff remains within club surplus and is not a reserve receipt',async()=>{
 const {buildJointCalibration}=await import('../tools/run-economy-joint-calibration-v2.mjs');
 const x=buildJointCalibration(),prior=JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v1-results.json',import.meta.url),'utf8')).baseline;
 assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v2-results.json',import.meta.url),'utf8')));
 assert.ok(Math.abs(x.baseline.clubSurplusBeforeDiscretionaryArc-prior.clubSurplusBeforeDiscretionaryArc-prior.staffBudgetArc)<=1);
 assert.ok(Math.abs(x.baseline.estimatedPayrollArc-prior.estimatedPayrollArc)<=1);
 assert.ok(Math.abs(x.baseline.baseReserveReceiptsArc-prior.baseReserveReceiptsArc+prior.assumedStaffReserveArc)<=1);
 assert.ok(x.grid.every(y=>y.staffBudgetArc===0&&y.assumedStaffReserveArc===0));
});

test('higher wage human-only candidate funds renewal in aggregate and reconciles conditional closure',async()=>{
 const {buildJointCalibration}=await import('../tools/run-economy-joint-calibration-v3.mjs');
 const x=buildJointCalibration();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v3-results.json',import.meta.url),'utf8')));
 assert.equal(x.grid.grid.length,49);assert.equal(x.grid.baseline.aiSalaryReserveArc,0);assert.equal(x.grid.baseline.unfundedYouthArcDemand,0);
 assert.equal(x.closure.at(-1).gap,0);assert.equal(x.closure.at(-1).totalIssuedArc,0);assert.ok(x.closure[0].gap>0);
 assert.ok(x.humanShareSensitivity.find(y=>y.humanShare===0.5).unfundedYouthArcDemand>0);
});

test('10 percent EUR renewal reference preserves club internal transfer distinction',async()=>{
 const {buildJointCalibration}=await import('../tools/run-economy-joint-calibration-v4.mjs');
 const x=buildJointCalibration();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v4-results.json',import.meta.url),'utf8')));
 const b=x.grid.baseline;assert.equal(b.fundedYouthArcReceipts,1340836);assert.equal(b.unfundedYouthArcDemand,0);
 assert.equal(b.worldClubCashGrowthBeforeDiscretionaryArc,b.clubSurplusBeforeDiscretionaryArc+b.internalRecruitmentBudgetArc);
 assert.equal(b.requiredAdditionalReserveReceiptsArc,1779164);assert.equal(x.closure.at(-1).gap,0);assert.ok(x.closure[0].gap>0);
});

test('full club reinvestment alone does not close the agent ARC balance',async()=>{
 const {reinvestmentTarget}=await import('../tools/economy-club-reinvestment.mjs');
 const b=JSON.parse(readFileSync(new URL('../docs/economy-joint-calibration-v4-results.json',import.meta.url),'utf8')).grid.baseline;
 const x=reinvestmentTarget(b,332,33);
 assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-club-reinvestment-results.json',import.meta.url),'utf8')));
 assert.equal(x.current.additionalAgentReceiptsRequiredArc,166135);assert.equal(x.current.reserveIfOnlyClubAndYouthSpendArc,2953865);
 assert.ok(x.payrollShareSensitivities.every(y=>y.additionalAgentReceiptsRequiredArc>0));
});

test('stationary career model reconciles payroll and shows EUR buyer effect on ARC recycling',async()=>{
 const {buildCareerRecycling}=await import('../tools/run-economy-career-recycling.mjs');
 const x=buildCareerRecycling();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-career-recycling-v1-results.json',import.meta.url),'utf8')));
 assert.equal(x.pool,6600000);assert.equal(x.payroll,4950000);assert.equal(x.arcOrders+x.eurOrders,x.retirements);
 assert.ok(Math.abs(x.meanRaw*x.retirements-x.payroll)<1e-5);
 assert.equal(x.pricing[0].agentResidual,406396);assert.ok(x.pricing.find(y=>y.bps===11000).unfundedArcDemand>0);
 assert.equal(x.flows.at(-1).totalIllustrativeIssuance,0);assert.ok(x.flows[0].gap>0);
 assert.equal(x.license.top.baseLicenseCents,29500);assert.equal(x.license.low.baseLicenseCents,10000);assert.equal(x.license.rows.length,320);
 assert.ok(x.clubLiquidityStress.every(y=>y.day28Negative===0&&y.adverseYearEndNegative===0));
});

test('no staff or undefined services can replenish the reserve',async()=>{
 const {buildNoStaff}=await import('../tools/run-economy-no-staff.mjs');
 const x=buildNoStaff();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-no-staff-v1-results.json',import.meta.url),'utf8')));
 const old=x.cases[0],clean=x.cases[1],all=x.cases[3];assert.equal(old.scenarios[0].gap,2056396);assert.equal(clean.scenarios[0].gap,1660855);
 assert.ok(x.cases.every(c=>c.scenarios.every(s=>s.actualClubReserveReceipts===0&&s.gap===s.clubGrowth+s.walletGrowth&&s.fundedArcCeiling<=c.payroll)));
 assert.equal(all.maxGap,0);assert.equal(all.license.top.baseLicenseCents,1000);assert.equal(all.license.low.baseLicenseCents,1000);
});

test('full payroll candidate raises raw value once and prices licenses independently of zero surplus',async()=>{
 const {buildFullPayrollResearch}=await import('../tools/run-economy-full-payroll.mjs');
 const x=buildFullPayrollResearch();assert.deepEqual(x,JSON.parse(readFileSync(new URL('../docs/economy-full-payroll-v1-results.json',import.meta.url),'utf8')));
 assert.equal(x.pool,x.payroll);assert.equal(x.clubCash,0);assert.ok(Math.abs(x.newRawMean/x.oldRawMean-1.1)<1e-8);
 assert.equal(x.license.topBaseEur,300);assert.equal(x.license.lowBaseEur,100);assert.equal(x.license.rows.length,320);
 assert.equal(x.reference.desiredArcReceipts,6685790);assert.equal(x.reference.unfundedArcDemand,85790);
 assert.equal(x.reference.fundedArcCeiling,6600000);assert.ok(x.scenarios.find(s=>s.eurOrders===50).reserveGapArc>0);
});
