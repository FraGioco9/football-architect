import {competitionRewards,REWARD_IDS,rewardTotals,placementReference,participationReference,CREDIT_MILESTONES,formatRewardAmount,plannedRewardInstallments} from '../assets/competition-rewards.mjs';
const label=(key,en)=>'<span data-app-i18n="'+key+'">'+en+'</span>';
const amount=(v,avg=false)=>'<span data-reward-amount="'+v+'"'+(avg?' data-reward-average':'')+'>'+formatRewardAmount(v,'en-GB',{average:avg})+'</span>';
export function renderRewardCard(id){const r=competitionRewards(id);return r?'<small class="fa-reward-card-pool">'+amount(r.pool)+'</small>':'';}
const note=()=>'<p class="fa-reward-note" data-app-i18n="rewardDraftNote">Planned amounts, not payments.</p>';
const row=(key,en,value)=>'<div class="fa-reward-row"><dt>'+label(key,en)+'</dt><dd>'+value+'</dd></div>';
const states=()=>'<div class="fa-reward-evidence" aria-live="polite">'+['rewardEvidencePending','rewardEvidenceDebug','rewardEvidenceEntrants','rewardEvidencePartial','rewardEvidenceComplete','rewardEvidenceHistory','rewardEvidenceZero','rewardEvidenceLeagueComplete','rewardEvidenceConfigOnly'].map((key,i)=>'<p data-reward-state="'+key+'" data-app-i18n="'+key+'"'+(i?' hidden':'')+'>'+['Sporting evidence unavailable or loading.','Debug results are not financial evidence.','Official entrants confirmed; no payment established.','Official sporting results are incomplete; no payment established.','Official sporting results complete; financial certification pending.','No season-specific reward version or financial history established.','Season not started; planned rewards only.','Official league phase complete; competition outcome and financial certification are not established here.','Configured pools only; per-competition financial evidence unavailable.'][i]+'</p>').join('')+'</div>';
const names={champion:['rewardChampion','Champion'],runnerUp:['rewardRunnerUp','Runner-up'],semifinalLoser:['rewardSemi','Semifinal loser'],quarterfinalLoser:['rewardQuarter','Quarterfinal loser'],playoffLoser:['rewardPlayoff','Playoff loser'],leagueEliminated:['rewardEliminated','League-phase eliminated']};
const th=(k,n)=>'<th scope="col">'+label(k,n)+'</th>';
const table=(heads,rows)=>'<div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr>'+heads.map(([k,n])=>th(k,n)).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
function placementTable(r){
 const schedule=placementReference(r);
 if(!schedule)return label('rewardPending','Pending rules');
 const heads=r.international?[['rewardOutcome','Outcome'],['rewardPerClubAmount','$ARC per club']]:[['rewardRank','Rank'],['rewardPerClubAmount','$ARC per club']];
 const body=schedule.map(x=>'<tr><th scope="row">'+(r.international?label(...names[x.id]):x.rank)+'</th><td>'+amount(x.amount)+'</td></tr>').join('');
 return table(heads,body);
}
function creditSchedule(r){
 const [first,second]=plannedRewardInstallments(r);
 const participation=label('rewardParticipation','Participation'),performance=label('rewardPerformance','Performance rewards'),share=CREDIT_MILESTONES.participationShare+'%';
 const paymentRow=(entry,description)=>'<tr><th scope="row">'+label('rewardDay','Day')+' '+entry.day+'</th><td class="fa-reward-payment-description">'+description+'</td><td>'+amount(entry.total)+'</td></tr>';
 return '<div class="fa-reward-schedule"><h3 data-app-i18n="rewardCreditSchedule">Planned payments</h3>'+table([['rewardPaymentDay','Payment'],['rewardDistribution','Reward distribution'],['rewardAmount','Amount']],[paymentRow(first,share+' '+participation),paymentRow(second,share+' '+participation+' + '+performance)].join(''))+'<p class="fa-reward-footnote" data-app-i18n="rewardCertifiedBeforePayment">Confirmed entrants and certified results required.</p></div>';
}
function breakdown(r,key,name){
 const rows=[['rewardParticipation','Participation',r.participation],['rewardPoints','Points',r.points],[key,name,r.placement]];
 const body=rows.map(([k,n,v],i)=>'<tr><th scope="row">'+label(k,n)+'</th><td>'+r.shares[i]+'%</td><td>'+amount(v)+'</td></tr>').join('');
 return table([['rewardDistribution','Reward distribution'],['rewardShare','Share'],['rewardAmount','Amount']],body);
}
export function renderCompetitionRewards(id){
 const r=competitionRewards(id);
 if(!r)return '<section class="app-panel"><p data-app-i18n="rewardUnavailable">Rewards unavailable</p></section>';
 const key=r.international?'rewardAdvancement':'rewardPlacement',name=r.international?'Advancement':'Placement',p=participationReference(r);
 const perClub=r.international?amount(r.participationReference,true):amount(p.floor);
 const exactSplit=r.international?row('rewardParticipationSplit','Participation allocation (club counts)',amount(p.floor)+' × '+p.lowerCount+' / '+amount(p.higher)+' × '+p.higherCount):row('rewardInstallment','Each participation installment',amount(p.installment));
 return '<div class="fa-rewards" data-competition-rewards="'+r.id+'"><section class="app-panel"><div class="fa-reward-heading"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(r.pool)+'</strong></div>'+breakdown(r,key,name)+'<p class="fa-reward-per-club">'+label(r.international?'rewardAverageParticipation':'rewardPerClub',r.international?'Average participation per club':'Participation per club')+' <strong>'+perClub+'</strong></p>'+creditSchedule(r)+note()+states()+'<details class="fa-reward-calculation"><summary data-app-i18n="rewardCalculation">Calculation rules</summary><dl class="fa-reward-list">'+exactSplit+row('rewardPoints','Points',label('rewardPointsFormula','Points pool × club points / total points'))+row('rewardRounding','Rounding',label('rewardHamilton','Largest remainder; equal-remainder order pending'))+'</dl></details></section>'+
 '<section class="app-panel"><h2>'+label(key,name)+'</h2>'+placementTable(r)+'</section></div>';
}
export function renderAdminRewards(definitions,encode){
 const names=new Map(definitions.map(d=>[d.id,d.name])),t=rewardTotals();
 const cells=r=>[r.pool,r.participation,r.points,r.placement].map(v=>'<td>'+amount(v)+'</td>').join('');
 return '<div data-admin-rewards><p role="status" data-admin-rewards-status data-app-i18n="rewardChecking">Checking access…</p><div data-admin-rewards-content hidden class="fa-rewards"><div class="fa-reward-season"><label for="admin-reward-season" data-app-i18n="competitionSeason">Season</label><select id="admin-reward-season" data-admin-rewards-season disabled></select></div><section class="app-panel"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(t.pool)+'</strong>'+creditSchedule(t)+note()+states()+'</section><section class="app-panel"><h2 data-app-i18n="rewardDistribution">Reward distribution</h2><div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr><th scope="col" data-app-i18n="rewardCompetition">Competition</th><th scope="col" data-app-i18n="rewardPool">Total prize pool</th><th scope="col" data-app-i18n="rewardParticipation">Participation</th><th scope="col" data-app-i18n="rewardPoints">Points</th><th scope="col" data-app-i18n="rewardPlacementAdvancement">Placement / advancement</th></tr></thead><tbody>'+REWARD_IDS.map(id=>'<tr><th scope="row">'+encode(names.get(id)||id)+'</th>'+cells(competitionRewards(id))+'</tr>').join('')+'<tr><th scope="row" data-app-i18n="rewardTotal">Total</th>'+cells(t)+'</tr></tbody></table></div></section></div></div>';
}
