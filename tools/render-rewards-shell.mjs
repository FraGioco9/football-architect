// Canonical Rewards extension for generated app shells. The same pure renderer
// supports regeneration from a verified existing shell without a second template.
import {renderRewardCard,renderCompetitionRewards,renderAdminRewards} from './render-competition-rewards.mjs';
const assets='  <link rel="stylesheet" href="/assets/competition-rewards.css">\n  <script type="module" src="/assets/rewards-ui.mjs"></script>\n';
export const stripRewardsAssets=html=>html.replace(assets,'');
const adminCard='<section class="app-panel admin-directory-card" data-admin-panel="rewards" aria-labelledby="admin-card-rewards-title"><h2 id="admin-card-rewards-title" data-app-i18n="competitionTabRewards">Rewards</h2><p data-app-i18n="rewardAdminDescription">Review configured competition rewards</p><a class="app-link app-link-primary" href="/admin/rewards" data-admin-card="rewards" data-app-i18n="competitionTabRewards">Rewards</a></section>';
function replaceOnce(html,anchor,replacement){
 if(!html.includes(anchor)||html.indexOf(anchor)!==html.lastIndexOf(anchor))throw Error('Rewards shell anchor missing or ambiguous: '+anchor.slice(0,120));
 return html.replace(anchor,()=>replacement);
}
export function augmentRewardsShell(path,html,definitions,encode){
 html=html.replace(/\r\n/g,'\n');
 if(path==='admin/index.html'){
  if(html.includes('data-admin-panel="rewards"'))return html;
  return replaceOnce(html,'Club Licenses</a></section></div>','Club Licenses</a></section>'+adminCard+'</div>');
 }
 if(path==='admin/rewards/index.html'){
  if(html.includes('data-admin-rewards-content'))return html;
  html=replaceOnce(html,'<title>Admin Contracts — Football Architect</title>','<title>Admin Rewards — Football Architect</title>');
  html=replaceOnce(html,'<h1 id="admin-title" class="app-page-title">Contracts</h1>','<h1 id="admin-title" class="app-page-title" data-app-i18n="competitionTabRewards">Rewards</h1>');
  for(const src of ['admin-permissions-cache.js','players-nationality-tooltip.js','admin-contracts.js'])html=replaceOnce(html,'  <script src="/assets/'+src+'" defer></script>\n','');
  const begin=html.indexOf('<section class="admin-contracts" data-admin-contracts'),end=html.indexOf('\n        </section>\n      </main>',begin);
  if(begin<0||end<=begin)throw Error('Missing canonical Admin child shell');
  html=html.slice(0,begin)+renderAdminRewards(definitions,encode)+html.slice(end);
  return replaceOnce(html,'</head>',assets+'</head>');
 }
 if(path==='competitions/index.html'){
  if(html.includes('fa-reward-card-pool'))return html;
  let count=0;
  html=html.replace(/<a class="app-division-card" href="\/competitions\/((?:it|eng|es|de|fr|pt|nl|br|int)-[12])\/standings(?:\?season=1)?">[\s\S]*?<\/a>/g,(card,id)=>{
   count++;return replaceOnce(card,'</span></a>',renderRewardCard(id)+'</span></a>');
  });
  if(count!==18)throw Error('Expected 18 competition cards; found '+count);
  return replaceOnce(html,'</head>',assets+'</head>');
 }
 const detail=/^competitions\/((?:it|eng|es|de|fr|pt|nl|br|int)-[12]|_shared)\/index\.html$/.exec(path);
 if(!detail)return html;
 if(html.includes('id="competition-tab-rewards"'))return html;
 const id=detail[1],neutral=id==='_shared';
 html=html.replaceAll('["standings","postseason","fixtures","stats","history","rules","awards"]','["standings","postseason","fixtures","stats","history","rules","awards","rewards"]')
  .replaceAll("'rules', 'awards'];","'rules', 'awards', 'rewards'];")
  .replaceAll('rules|awards|index','rules|awards|rewards|index')
  .replaceAll('rules|awards|overview|teams','rules|awards|rewards|overview|teams');
 const tab='            <button type="button" role="tab" class="app-competition-tab" id="competition-tab-awards" aria-controls="competition-panel-awards" aria-selected="false" tabindex="-1" data-app-i18n="competitionTabAwards">Awards</button>';
 html=replaceOnce(html,tab,tab+'\n'+tab.replaceAll('awards','rewards').replaceAll('Awards','Rewards'));
 const end='})("awards");</script>\n          </section>';
 const content=neutral?'<section class="app-panel"><p data-app-i18n="rewardUnavailable">Rewards unavailable</p></section>':renderCompetitionRewards(id);
 html=replaceOnce(html,end,end+'\n          <section id="competition-panel-rewards" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-rewards" tabindex="0" hidden>'+content+'</section>');
 return replaceOnce(html,'</head>',assets+'</head>');
}
