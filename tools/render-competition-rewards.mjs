import {competitionRewards,REWARD_IDS,rewardTotals,placementReference,participationReference,CREDIT_MILESTONES} from '../assets/competition-rewards.mjs';
const label=(key,en)=>'<span data-app-i18n="'+key+'">'+en+'</span>';
const amount=(v,avg=false)=>'<span data-reward-amount="'+v+'"'+(avg?' data-reward-average':'')+'>'+(avg?'≈ ':'')+Math.round(v).toLocaleString('en-GB')+' ARC</span>';
export function renderRewardCard(id){const r=competitionRewards(id);return r?'<small class="fa-reward-card-pool">'+amount(r.pool)+'</small>':'';}
const note=()=>'<p class="fa-reward-note" data-app-i18n="rewardDraftNote">Current draft schedule only. No historical allocation or payment is established.</p>';
const row=(key,en,value)=>'<div class="fa-reward-row"><dt>'+label(key,en)+'</dt><dd>'+value+'</dd></div>';
const states=()=>'<div class="fa-reward-evidence" aria-live="polite">'+['rewardEvidencePending','rewardEvidenceDebug','rewardEvidenceEntrants','rewardEvidencePartial','rewardEvidenceComplete','rewardEvidenceHistory','rewardEvidenceZero'].map((key,i)=>'<p data-reward-state="'+key+'" data-app-i18n="'+key+'"'+(i?' hidden':'')+'>'+['Sporting evidence unavailable or loading.','Debug results are not financial evidence.','Official entrants confirmed; no payment established.','Official sporting results are incomplete; no payment established.','Official sporting results complete; financial certification pending.','No season-specific reward version or financial history established.','Season not started; planned rewards only.'][i]+'</p>').join('')+'</div>';
const names={champion:['rewardChampion','Champion'],runnerUp:['rewardRunnerUp','Runner-up'],semifinalLoser:['rewardSemi','Semifinal loser'],quarterfinalLoser:['rewardQuarter','Quarterfinal loser'],playoffLoser:['rewardPlayoff','Playoff loser'],leagueEliminated:['rewardEliminated','League-phase eliminated']};
const th=(k,n)=>'<th scope="col">'+label(k,n)+'</th>';
const table=(heads,rows)=>'<div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr>'+heads.map(([k,n])=>th(k,n)).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
function placementTable(r){
 const schedule=placementReference(r);
 if(!schedule)return label('rewardPending','Pending rules');
 const heads=r.international?[['rewardOutcome','Outcome'],['rewardClubs','Clubs'],['rewardWeight','Weight'],['rewardPerClubAmount','ARC per club']]:[['rewardRank','Rank'],['rewardWeight','Weight'],['rewardPerClubAmount','ARC per club']];
 const body=schedule.map(x=>'<tr><th scope="row">'+(r.international?label(...names[x.id]):x.rank)+'</th>'+(r.international?'<td>'+x.count+'</td>':'')+'<td>'+x.weight+(r.international?'%':'')+'</td><td>'+amount(x.amount)+'</td></tr>').join('');
 return table(heads,body);
}
function creditSchedule(r){
 const [first,second]=CREDIT_MILESTONES.participation,share=CREDIT_MILESTONES.participationShare;
 return '<section class="app-panel"><h2 data-app-i18n="rewardCreditSchedule">Planned credit schedule</h2><dl class="fa-reward-list">'+row('rewardParticipation','Participation',label('rewardDay','Day')+' '+first+' · '+share+'% · '+label('rewardConfirmed','Confirmed entrants'))+row('rewardParticipation','Participation',label('rewardDay','Day')+' '+second+' · '+share+'%')+row('rewardPoints','Points',r.international?label('rewardPhaseCertified','League phase certified'):label('rewardLeagueCertified','Regular season certified'))+row(r.international?'rewardAdvancement':'rewardPlacement',r.international?'Advancement':'Placement',r.international?label('rewardCupCertified','Competition certified'):label('rewardLeagueCertified','Regular season certified'))+'</dl></section>';
}
export function renderCompetitionRewards(id){
 const r=competitionRewards(id);
 if(!r)return '<section class="app-panel"><p data-app-i18n="rewardUnavailable">Rewards unavailable</p></section>';
 const key=r.international?'rewardAdvancement':'rewardPlacement',name=r.international?'Advancement':'Placement',p=participationReference(r);
 const participation=r.international?amount(p.floor)+' × '+p.lowerCount+'<span class="fa-reward-split"> / </span>'+amount(p.higher)+' × '+p.higherCount:amount(p.floor);
 return '<div class="fa-rewards" data-competition-rewards="'+r.id+'"><section class="app-panel"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(r.pool)+'</strong>'+note()+states()+'</section>'+
 '<div class="fa-reward-components">'+[['rewardParticipation','Participation',r.participation],['rewardPoints','Points',r.points],[key,name,r.placement]].map(([k,n,v],i)=>'<section class="app-panel"><h2>'+label(k,n)+'</h2><strong>'+amount(v)+'</strong><p>'+r.shares[i]+'%</p></section>').join('')+'</div>'+
 '<section class="app-panel"><h2 data-app-i18n="rewardDistribution">Reward distribution</h2><dl class="fa-reward-list">'+row('rewardParticipants','Participants',r.capacity)+row(r.international?'rewardParticipationSplit':'rewardPerClub',r.international?'Participation allocation (club counts)':'Participation per club',participation)+(!r.international?row('rewardInstallment','Each participation installment',amount(p.installment)):'')+row('rewardPoints','Points',label('rewardPointsFormula','Points pool × club points / total points'))+row('rewardRounding','Rounding',label('rewardHamilton','Largest remainder; equal-remainder order pending'))+'</dl></section>'+
 '<section class="app-panel"><h2>'+label(key,name)+'</h2>'+placementTable(r)+'</section>'+creditSchedule(r)+'</div>';
}
export function renderAdminRewards(definitions,encode){
 const names=new Map(definitions.map(d=>[d.id,d.name])),t=rewardTotals();
 const cells=r=>[r.pool,r.participation,r.points,r.placement].map(v=>'<td>'+amount(v)+'</td>').join('');
 return '<div data-admin-rewards><p role="status" data-admin-rewards-status data-app-i18n="rewardChecking">Checking access…</p><div data-admin-rewards-content hidden class="fa-rewards"><div class="fa-reward-season"><label for="admin-reward-season" data-app-i18n="competitionSeason">Season</label><select id="admin-reward-season" data-admin-rewards-season disabled></select></div><section class="app-panel"><h2 data-app-i18n="rewardPool">Total prize pool</h2><strong class="fa-reward-total">'+amount(t.pool)+'</strong>'+note()+states()+'</section><section class="app-panel"><h2 data-app-i18n="rewardDistribution">Reward distribution</h2><div class="fa-reward-table-wrap"><table class="fa-reward-table"><thead><tr><th scope="col" data-app-i18n="rewardCompetition">Competition</th><th scope="col" data-app-i18n="rewardPool">Total prize pool</th><th scope="col" data-app-i18n="rewardParticipation">Participation</th><th scope="col" data-app-i18n="rewardPoints">Points</th><th scope="col" data-app-i18n="rewardPlacementAdvancement">Placement / advancement</th></tr></thead><tbody>'+REWARD_IDS.map(id=>'<tr><th scope="row">'+encode(names.get(id)||id)+'</th>'+cells(competitionRewards(id))+'</tr>').join('')+'<tr><th scope="row" data-app-i18n="rewardTotal">Total</th>'+cells(t)+'</tr></tbody></table></div></section></div></div>';
}
