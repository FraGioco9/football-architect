// Sealed authoritative History. No verified-source relabel, fictional records or players.
export function historyViewModel(context){
 const data=context?.seasonData,history=data?.history;
 if(data?.provenance?.kind!=='authoritative'||(data.seasonState?.phase??data.world?.phase)!=='closed'||data.season!==context.selectedSeason||history?.season!==context.selectedSeason||
    !/^[a-f0-9]{64}$/.test(history?.archiveHash||'')||!Number.isSafeInteger(history.closedAt)||history.closedAt<=0)return null;
 const table=data.statistics?.standings,clubs=new Map((data.participants||[]).map(c=>[c.countryId+'-'+c.clubId,c]));
 const champion=clubs.get(history.championClubId);
 if(!champion||!Array.isArray(table)||!table.length)return null;
 const record=(field,minimum=false)=>{const value=Math[minimum?'min':'max'](...table.map(r=>r[field]));return {value,clubs:table.filter(r=>r[field]===value).map(r=>r.club)}};
 const records={historyBestAttack:record('gf'),historyBestDefence:record('ga',true),historyMostSeasonWins:record('won'),historyMostSeasonPoints:record('pts'),historyBestGoalDifference:record('gd')};
 if(context.definition.category==='domestic'&&table.length>1)records.historyLargestTitleMargin={value:table[0].pts-table[1].pts,clubs:[champion]};
 return {season:history.season,champion,records,players:null,allTime:null};
}
const copy={en:['Hall of Champions','Season'],it:['Albo dei campioni','Stagione'],de:['Meisterliste','Saison'],es:['Palmarés de campeones','Temporada'],fr:['Palmarès des champions','Saison']};
export function mountAuthoritativeHistory(panel,{getContext,document=globalThis.document,refreshRecords=()=>{}}){
 const placeholder=panel.querySelector('[data-history-empty] > section'),section=document.createElement('section');
 section.className='app-history-dev-section';section.dataset.authoritativeHistory='';section.hidden=true;placeholder?.before(section);
 const cards=[...panel.querySelectorAll('[data-history-team-records] [data-history-scope="season"]')].map(node=>({node,html:node.innerHTML}));
 const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node};
 function render(){
  const context=getContext(),data=historyViewModel(context),t=copy[document.documentElement.lang]||copy.en;
  section.replaceChildren();section.hidden=!data;if(placeholder)placeholder.hidden=!!data;
  for(const {node,html} of cards)node.innerHTML=html;
  if(data){
   section.append(make('h3',t[0]),make('p',t[1]+' '+data.season+' · '+data.champion.primaryName));
   for(const {node} of cards){const heading=node.querySelector('h5'),record=data.records[heading?.dataset.appI18n];if(!record)continue;node.replaceChildren(heading);const value=make('span',record.value);value.className='app-competition-stat-value';node.append(value,make('p',record.clubs.map(c=>c.primaryName).join(' · ')))}
  }
  refreshRecords();
 }
 render();return Object.freeze({render});
}
