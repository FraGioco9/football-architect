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
  assert.equal(reward.shares.reduce((a,b)=>a+b),100);
  assert.equal(competitionRewards(d.id.toLowerCase()).id,d.id);
  for(const key of ['earned','paid','credited','payable'])assert.equal(Object.hasOwn(reward,key),false);
 }
 assert.equal(competitionRewards('IT-3'),null);
 assert.equal(competitionRewards(null),null);
});
test('approved totals and participation references',()=>{
 assert.deepEqual(rewardTotals(),{pool:60000000,participation:33840000,points:9360000,placement:16800000});
 for(const [id,pool,reference] of [['IT-1',4000000,150000],['IT-2',2000000,75000],['int-1',8000000,140000],['int-2',4000000,70000]]){
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
  assert.equal(p.installment%2500,0);
  assert.ok(schedule.every(x=>x.amount%2500===0));
  if(!r.international)assert.ok(schedule.every((x,i)=>i===0||x.amount<schedule[i-1].amount));
 }
 assert.deepEqual(CREDIT_MILESTONES.participation,[28,56]);
 assert.equal(placementReference(competitionRewards('int-1'))[0].amount,900000);
 assert.equal(placementReference(competitionRewards('int-2'))[1].amount,250000);
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
 assert.doesNotMatch(admin,/class="fa-rewards"/);
 assert.match(admin,/rewardDay">Day<\/span> 28/);
 assert.match(admin,/rewardDay">Day<\/span> 56/);
});
test('current and historical season reward estimates use season-specific clubs and results',()=>{
 const participants=Array.from({length:16},(_,i)=>({countryId:'IT',clubId:i+1,primaryName:'Club '+(i+1)}));
 const context={selectedSeason:1,definition:{id:'IT-1'},seasonData:{season:1,seasonState:{phase:'closed',day:56},provenance:{kind:'authoritative'},participants,statistics:{standings:participants.map((club,i)=>({club,played:30,pts:60-i}))}}};
 const model=seasonRewardReference('IT-1',context);
 assert.equal(model.rows.length,16);assert.equal(model.pending,false);
 assert.equal(model.rows.reduce((n,r)=>n+r.amount,0),4000000);
 assert.ok(model.rows.every(r=>Number.isSafeInteger(r.amount)));
 assert.equal(model.rows[0].id,'IT-1');
 context.seasonData.seasonState={phase:'active',day:28};
 assert.ok(seasonRewardReference('IT-1',context).rows.every(r=>r.amount===75000));
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
 assert.deepEqual(plannedRewardInstallments(rewardTotals()).map(x=>x.total),[16920000,43080000]);
});

test('season read lifecycle is shared with Rewards and independent of world readiness',()=>{
 const page=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../assets/rewards-ui.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../assets/competition-rewards.css',import.meta.url),'utf8');
 assert.match(page,/onState:state=>\{publishSeasonReadState\(state\)/);
 assert.match(page,/publishSeasonReadState\(cached.data.status\)/);
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
 assert.equal(a.rows.reduce((sum,r)=>sum+r.amount,0),1680000);
 assert.ok(a.rows.every(r=>r.amount===70000));
 context.seasonData.participants=[...participants].reverse();
 assert.deepEqual(seasonRewardReference('int-1',context),a);
});
