import {competitionRewards,REWARD_IDS,rewardTotals} from '../assets/competition-rewards.mjs';
const label=(key,en)=>'<span data-app-i18n="'+key+'">'+en+'</span>';
const amount=(v,avg=false)=>'<span data-reward-amount="'+v+'"'+(avg?' data-reward-average':'')+'>'+(avg?'≈ ':'')+Math.round(v).toLocaleString('en-GB')+' ARC</span>';
export function renderRewardCard(id){const r=competitionRewards(id);return r?'<small class="fa-reward-card-pool">'+amount(r.pool)+'</small>':'';}
const note=()=>'<p class="fa-reward-note" data-app-i18n="rewardDraftNote">Current draft schedule only. No historical allocation or payment is established.</p>';
const row=(key,en,value)=>'<div class="fa-reward-row"><dt>'+label(key,en)+'</dt><dd>'+value+'</dd></div>';
export function renderCompetitionRewards(id){
 const r=competitionRewards(id);
 if(!r)return '<section class="app-panel"><p data-app-i18n="rewardUnavailable">Rewards unavailable</p></section>';
 const key=r.international?'rewardAdvancement':'rewardPlacement',name=r.international?'Advancement':'Placement';
 return '<div class="fa-rewards"><section class="app-panel"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(r.pool)+'</strong>'+note()+'</section>'+
 '<div class="fa-reward-components">'+[['rewardParticipation','Participation',r.participation],['rewardPoints','Points',r.points],[key,name,r.placement]].map(([k,n,v],i)=>'<section class="app-panel"><h2>'+label(k,n)+'</h2><strong>'+amount(v)+'</strong><p>'+r.shares[i]+'%</p></section>').join('')+'</div>'+
 '<section class="app-panel"><h2 data-app-i18n="rewardDistribution">Reward distribution</h2><dl class="fa-reward-list">'+row('rewardParticipants','Participants',r.capacity)+row(r.participationIsAverage?'rewardAverage':'rewardPerClub',r.participationIsAverage?'Average participation per club':'Participation per club',amount(r.participationReference,r.participationIsAverage))+row('rewardPoints','Points',label('rewardPending','Pending rules'))+row(key,name,label('rewardPending','Pending rules'))+'</dl></section></div>';
}
export function renderAdminRewards(definitions,encode){
 const names=new Map(definitions.map(d=>[d.id,d.name])),t=rewardTotals();
 const cells=r=>[r.pool,r.participation,r.points,r.placement].map(v=>'<td>'+amount(v)+'</td>').join('');
 return '<div data-admin-rewards><p role="status" data-admin-rewards-status data-app-i18n="rewardChecking">Checking access…</p><div data-admin-rewards-content hidden class="fa-rewards"><section class="app-panel"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(t.pool)+'</strong>'+note()+'</section><section class="app-panel"><h2 data-app-i18n="rewardDistribution">Reward distribution</h2><div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr><th scope="col" data-app-i18n="rewardCompetition">Competition</th><th scope="col" data-app-i18n="rewardPool">Total prize pool</th><th scope="col" data-app-i18n="rewardParticipation">Participation</th><th scope="col" data-app-i18n="rewardPoints">Points</th><th scope="col" data-app-i18n="rewardPlacementAdvancement">Placement / advancement</th></tr></thead><tbody>'+REWARD_IDS.map(id=>'<tr><th scope="row">'+encode(names.get(id)||id)+'</th>'+cells(competitionRewards(id))+'</tr>').join('')+'<tr><th scope="row" data-app-i18n="rewardTotal">Total</th>'+cells(t)+'</tr></tbody></table></div></section></div></div>';
}
