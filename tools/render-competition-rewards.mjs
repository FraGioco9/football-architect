import {competitionRewards,REWARD_IDS,rewardTotals,placementReference,participationReference,CREDIT_MILESTONES,formatRewardAmount,plannedRewardInstallments} from '../assets/competition-rewards.mjs';
const label=(key,en)=>'<span data-app-i18n="'+key+'">'+en+'</span>';
const amount=(v,avg=false)=>'<span data-reward-amount="'+v+'"'+(avg?' data-reward-average':'')+'>'+formatRewardAmount(v,'en-GB',{average:avg})+'</span>';
export function renderRewardCard(id){const r=competitionRewards(id);return r?'<small class="fa-reward-card-pool">'+amount(r.pool)+'</small>':'';}
const row=(key,en,value)=>'<div class="fa-reward-row"><dt>'+label(key,en)+'</dt><dd>'+value+'</dd></div>';
const states=()=>'<div class="fa-reward-evidence" aria-live="polite">'+[
 ['rewardEvidenceHistory','Historical rewards unavailable.'],
 ['rewardEvidenceZero','Season not started; planned amounts only.'],
 ['rewardEvidenceConfigOnly','Planned amounts, not confirmed payments.']
].map(([key,copy])=>'<p data-reward-state="'+key+'" data-app-i18n="'+key+'" hidden>'+copy+'</p>').join('')+'</div>';
const names={champion:['rewardChampion','Champion'],runnerUp:['rewardRunnerUp','Runner-up'],semifinalLoser:['rewardSemi','Semifinal loser'],quarterfinalLoser:['rewardQuarter','Quarterfinal loser'],playoffLoser:['rewardPlayoff','Playoff loser'],leagueEliminated:['rewardEliminated','League-phase eliminated']};
const th=(k,n)=>'<th scope="col">'+label(k,n)+'</th>';
const table=(heads,rows)=>'<div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr>'+heads.map(([k,n])=>th(k,n)).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
function creditSchedule(r){
 const [first,second]=plannedRewardInstallments(r);
 const participation=label('rewardParticipation','Participation'),performance=label('rewardPerformance','Performance rewards'),share=CREDIT_MILESTONES.participationShare+'%';
 const paymentRow=(entry,description)=>'<tr><th scope="row">'+label('rewardDay','Day')+' '+entry.day+'</th><td class="fa-reward-payment-description">'+description+'</td><td>'+amount(entry.total)+'</td></tr>';
 return '<section class="admin-rewards-list admin-rewards-payments" aria-labelledby="admin-rewards-payments-heading"><h2 class="sr-only" id="admin-rewards-payments-heading" data-app-i18n="rewardCreditSchedule">Planned payments</h2>'+table([['rewardCreditSchedule','Planned payments'],['rewardDistribution','Reward distribution'],['rewardAmount','Amount']],[paymentRow(first,share+' '+participation),paymentRow(second,share+' '+participation+' + '+performance)].join('')).replace('<div class="fa-reward-table-wrap">','<div class="fa-reward-table-wrap admin-rewards-table-wrap" role="region" tabindex="0" aria-labelledby="admin-rewards-payments-heading">')+'</section>';
}
function breakdown(r,key,name){
 const rows=[['rewardParticipation','Participation',r.participation],['rewardPoints','Points',r.points],[key,name,r.placement]];
 const body=rows.map(([k,n,v],i)=>'<tr><th scope="row">'+label(k,n)+'</th><td>'+r.shares[i]+'%</td><td>'+amount(v)+'</td></tr>').join('');
 return table([['rewardDistribution','Reward distribution'],['rewardShare','Share'],['rewardAmount','Amount']],body);
}
const chevron='<svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function expandableReward(key,en,share,value,group,details){
 const ids=details.map((_,i)=>'reward-'+group+'-detail-'+i);
 const button='<button type="button" class="fa-reward-disclosure-toggle" data-reward-disclosure="'+group+'" aria-expanded="false" aria-controls="'+ids.join(' ')+'">'+label(key,en)+chevron+'</button>';
 return '<tr><th scope="row">'+button+'</th><td>'+share+'</td><td>'+value+'</td></tr>'+details.map((cells,i)=>'<tr id="'+ids[i]+'" class="fa-reward-detail-row" data-reward-detail="'+group+'" hidden>'+cells+'</tr>').join('');
}
function pointsDetails(r){
 return ['<td colspan="3" class="fa-reward-detail-note"><p>'+label(r.international?'rewardCupPointsExplanation':'rewardDomesticPointsExplanation',r.international?'The points pool is shared in proportion to points earned in the six league-phase matches.':'The points pool is shared in proportion to points earned in the 30 regular-season matches.')+'</p></td>'];
}
function placementDetails(r){
 const explanation='<td colspan="3" class="fa-reward-detail-note"><p>'+label(r.international?'rewardAdvancementExplanation':'rewardPlacementExplanation',r.international?'Each club receives one advancement reward, based on its final outcome.':'Each final league position has a fixed reward, shown in the table.')+'</p></td>';
 const schedule=placementReference(r);
 if(!schedule)return [explanation,'<td colspan="3" class="fa-reward-detail-note">'+label('rewardPending','Pending rules')+'</td>'];
 const heading='<td colspan="2" class="fa-reward-detail-label">'+(r.international?label('rewardOutcome','Outcome'):label('rewardRank','Rank'))+'</td><td class="fa-reward-detail-column">'+label('rewardPerClubAmount','$ARC per club')+'</td>';
 return [explanation,heading,...schedule.map(x=>'<th scope="row" colspan="2" class="fa-reward-detail-label">'+(r.international?label(...names[x.id]):x.rank)+'</th><td>'+amount(x.amount)+'</td>')];
}
function publicMarkup(r){
 const placeholders=Array.from({length:r.capacity},()=>'<tr aria-hidden="true" data-reward-placeholder><th scope="row"><span class="app-world-club-identity"><span class="app-view-skeleton-crest-slot"></span><span class="app-world-club-name fa-reward-name-slot"><span class="app-skeleton-bar"></span></span></span></th><td class="fa-reward-value-cell"><span class="fa-reward-value"><span class="app-skeleton-bar"></span></span></td></tr>').join('');
 const p=participationReference(r);
 const perClub=p.higherCount?amount(p.floor)+' – '+amount(p.higher):amount(p.floor);
 const [first,second]=plannedRewardInstallments(r);
 const item=(key,en,share,value)=>'<tr><th scope="row">'+label(key,en)+'</th><td>'+share+'</td><td>'+value+'</td></tr>';
 const legend='<section class="app-panel fa-reward-legend" data-season-reward-legend>'+table([['rewardDistribution','Reward distribution'],['rewardShare','Share'],['rewardAmount','Amount']],[
  item('rewardParticipation','Participation',r.shares[0]+'%',amount(r.participation)),
  expandableReward('rewardPoints','Points',r.shares[1]+'%',amount(r.points),'points',pointsDetails(r)),
  expandableReward(r.international?'rewardAdvancement':'rewardPlacement',r.international?'Advancement':'Placement',r.shares[2]+'%',amount(r.placement),'placement',placementDetails(r)),
  '<tr class="fa-reward-per-club-row"><th scope="row" colspan="2">'+label('rewardPerClub','Participation per club')+'</th><td>'+perClub+'</td></tr>',
  '<tr class="fa-reward-milestone-row"><th scope="row" colspan="2">'+label('rewardPaymentAtDay','Payment at day')+' '+first.day+'</th><td>'+amount(first.total)+'</td></tr>',
  '<tr><th scope="row" colspan="2">'+label('rewardPaymentAtDay','Payment at day')+' '+second.day+'</th><td>'+amount(second.total)+'</td></tr>'
 ].join(''))+'</section>';
 return '<div class="fa-rewards" data-competition-rewards="'+r.id+'"><section class="app-panel"><div class="fa-reward-heading"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(r.pool)+'</strong></div></section>'+legend+'<section class="app-panel" data-season-reward-table><div class="fa-reward-table-wrap fa-season-reward-table"><table class="fa-reward-table" aria-busy="true"><thead><tr><th scope="col" data-app-i18n="standingsClub">Club</th><th scope="col" data-season-reward-heading data-app-i18n="rewardSeasonEstimate" aria-describedby="reward-calculation-note">Estimated rewards</th></tr></thead><tbody data-season-reward-rows>'+placeholders+'</tbody></table><span class="fa-reward-sr-only" id="reward-calculation-note" data-app-i18n="rewardCalculatedNote">Calculated under current draft rules, not confirmed payments. Equal remainders use club ID for this reference only.</span><p class="fa-reward-reference-note" role="status" data-season-reward-status data-app-i18n="rewardUnavailable" hidden>Rewards unavailable</p></div></section></div>';
}
export function renderCompetitionRewards(id){
 const r=competitionRewards(id);
 return r?publicMarkup(r):'<section class="app-panel"><p data-app-i18n="rewardUnavailable">Rewards unavailable</p></section>';
}
export function renderAdminRewards(definitions,encode){
 const names=new Map(definitions.map(d=>[d.id,d.name])),t=rewardTotals();
 const cells=r=>[r.pool,r.participation,r.points,r.placement].map(v=>'<td>'+amount(v)+'</td>').join('');
 const season='<div class="admin-rewards-season"><span id="admin-reward-season-label" data-app-i18n="competitionSeason">Season</span><div class="language-control admin-rewards-dropdown"><select id="admin-reward-season" data-admin-rewards-season aria-labelledby="admin-reward-season-label" hidden tabindex="-1" disabled></select><button type="button" class="language-trigger" data-admin-rewards-trigger role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="admin-reward-season-options" aria-labelledby="admin-reward-season-label admin-reward-season-value" disabled><span id="admin-reward-season-value" data-admin-rewards-value>—</span>'+chevron+'</button><div id="admin-reward-season-options" class="language-menu" role="listbox" aria-labelledby="admin-reward-season-label" hidden></div></div></div>';
 const summary='<section class="app-panel admin-rewards-summary" aria-labelledby="admin-rewards-pool-heading"><div class="admin-rewards-summary-top">'+season+'<div class="admin-rewards-pool"><h2 id="admin-rewards-pool-heading" data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(t.pool)+'</strong></div></div>'+states()+'</section>';
 const schedule=creditSchedule(t);
 const distribution='<section class="admin-rewards-list" aria-labelledby="admin-rewards-distribution-heading"><h2 class="sr-only" id="admin-rewards-distribution-heading" data-app-i18n="rewardDistribution">Reward distribution</h2><div class="fa-reward-table-wrap admin-rewards-table-wrap" role="region" tabindex="0" aria-labelledby="admin-rewards-distribution-heading"><table class="fa-reward-table admin-rewards-distribution"><thead><tr><th scope="col" data-app-i18n="rewardCompetition">Competition</th><th scope="col" data-app-i18n="rewardPool">Total prize pool</th><th scope="col" data-app-i18n="rewardParticipation">Participation</th><th scope="col" data-app-i18n="rewardPoints">Points</th><th scope="col" data-app-i18n="rewardPlacementAdvancement">Placement / advancement</th></tr></thead><tbody>'+REWARD_IDS.map(id=>'<tr><th scope="row">'+encode(names.get(id)||id)+'</th>'+cells(competitionRewards(id))+'</tr>').join('')+'</tbody><tfoot><tr><th scope="row" data-app-i18n="rewardTotal">Total</th>'+cells(t)+'</tr></tfoot></table></div></section>';
 return '<section class="admin-rewards" data-admin-rewards aria-labelledby="admin-title"><p class="admin-rewards-message" role="status" aria-live="polite" data-admin-rewards-status data-app-i18n="rewardChecking">Checking access…</p><div data-admin-rewards-content hidden class="admin-rewards-content">'+summary+schedule+distribution+'</div></section>';
}
