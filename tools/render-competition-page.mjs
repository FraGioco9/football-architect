// One detail renderer for all competition routes and the neutral shell.
import model from "../assets/competition-model.js";
import rulesView from "../assets/competition-rules-view.js";

export function createCompetitionRenderer({countryById,encode,inlineCountryFlag,renderLogo}){
const detailAppend = function detailAppend(d,neutral){
 const cols=[["standingsPosition","Pos"],["standingsClub","Club"],["standingsPlayed","P"],["standingsWon","W"],["standingsDrawn","D"],["standingsLost","L"],["standingsFor","GF"],["standingsAgainst","GA"],["standingsDifference","GD"],["standingsPoints","Pts"],["standingsForm","Form"]]
 .map(([key,label],i)=>'                  <th scope="col"'+(i===1?' class="app-world-standing-name-head"':'')+' data-app-i18n="'+key+'">'+label+'</th>').join("\n");
 const bands=neutral?[]:d.tier===1
  ?[["1","champion","rulesTier1Champion","National champion"],["13–14","playout","rulesTier1Playout","Relegation play-out"],["15–16","relegated","rulesTier1Relegated","Direct relegation"]]
  :[["1–2","promoted","rulesTier2Promoted","Direct promotion"],["3–6","playoff","rulesTier2Playoffs","Promotion play-offs"]];
 const legend=bands.length?`
          <div class="app-standings-legend">
            <p id="standings-outcome-legend-title" data-app-i18n="standingsOutcomeLegend">Legend</p>
            <ul aria-labelledby="standings-outcome-legend-title">
${bands.map(([range,outcome,key,label])=>`              <li data-standing-outcome="${outcome}"><span class="app-standings-legend-swatch" aria-hidden="true"></span><span id="standings-outcome-${outcome}"><strong>${range}</strong> · <span data-app-i18n="${key}">${label}</span></span></li>`).join("\n")}
            </ul>
          </div>`:"";
 return `
          <div class="app-world-standings">
            <div class="app-world-standing-scroll" role="region" aria-label="Standings statistics" data-app-aria="standingsTable">
              <table class="app-world-standing-table">
                <caption class="sr-only" id="app-standings-caption" data-app-i18n="standingsCaption">Provisional club list; no active league standings yet.</caption>
                <thead>
                  <tr>
${cols}
                  </tr>
                </thead>
                <tbody id="app-standings-body">
${d.category==="international"?'<tr><td colspan="11" class="app-competition-empty-row" data-app-i18n="competitionStandingsEmpty">No standings available yet.</td></tr>':""}
                </tbody>
              </table>
            </div>
          </div>${legend}`;
};
const menuChevron='<svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fixturesContent = ()=>`
            <div class="app-fixtures-toolbar" id="app-fixtures-toolbar" hidden>
              <div class="app-fixtures-navigation">
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-previous" aria-label="Previous matchday" data-app-aria="fixturesPrevious" disabled><svg class="site-chevron site-chevron-left" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <div class="language-control app-fixtures-select">
                <button type="button" id="app-fixtures-round" class="language-trigger app-fixtures-trigger" role="combobox" aria-haspopup="listbox" aria-labelledby="app-fixtures-round-label app-fixtures-round-number" aria-controls="app-fixtures-picker" aria-expanded="false" disabled><span id="app-fixtures-round-label" data-app-i18n="fixturesMatchday">Matchday</span> <span id="app-fixtures-round-number">1</span>${menuChevron}</button>
                <div id="app-fixtures-picker" class="language-menu app-fixtures-picker" role="listbox" aria-labelledby="app-fixtures-round" hidden>
${Array.from({length:model.schedule.rounds},(_,i)=>'                  <div class="language-option" role="option" id="app-fixtures-round-option-'+(i+1)+'" data-menu-value="'+(i+1)+'" data-fixture-round-choice="'+(i+1)+'" aria-selected="'+(i===0)+'"><span data-app-i18n="fixturesMatchday">Matchday</span>&nbsp;'+(i+1)+'</div>').join("\n")}
                </div>
                </div>
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-next" aria-label="Next matchday" data-app-aria="fixturesNext" disabled><svg class="site-chevron site-chevron-right" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              </div>
              <button type="button" class="language-trigger app-fixtures-current" id="app-fixtures-current" data-app-aria="fixturesCurrent" aria-label="Current matchday" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span data-app-i18n="fixturesCurrent">Current matchday</span></button>
              <p id="app-fixtures-summary" class="sr-only" role="status" aria-live="polite" aria-atomic="true" hidden></p>
            </div>
            <p id="app-fixtures-empty" class="app-competition-status" data-app-i18n="competitionFixturesEmpty">No scheduled matches or results are available.</p>
            <ol id="app-fixtures-list" class="app-fixtures-list" aria-label="Competition matches" data-app-aria="fixturesMatches" hidden></ol>`;
const historyEmptyContent = ()=>`
            <div class="app-history-empty" data-history-empty>
              <section class="app-history-dev-section">
                <h3 data-app-i18n="historySeasonArchive">Season archive</h3>
                <div class="app-world-standings"><p class="app-competition-empty-row" data-app-i18n="competitionHistoryEmpty">No completed seasons available yet.</p></div>
              </section>
              <section class="app-history-dev-section">
                <h3 data-app-i18n="historyHistoricalRecords">Historical records</h3>
                <div class="app-history-record-controls" data-history-record-controls role="group" data-app-aria="historyRecordScope" aria-label="Record scope">
                  <button type="button" data-history-record-scope="season" aria-pressed="true" data-app-i18n="historySeasonRecords">Season records</button>
                  <button type="button" data-history-record-scope="all-time" aria-pressed="false" data-app-i18n="historyAllTimeRecords">All-time records</button>
                </div>
                <section class="app-history-record-group" data-history-team-records>
                  <h4 data-app-i18n="historyTeamRecords">Team records</h4>
                <div class="app-competition-stat-grid">
${[["historyBestAttack","Best attack in a season","season"],["historyBestDefence","Best defence in a season","season"],["historyMostSeasonWins","Most wins in a season","season"],["historyMostSeasonPoints","Most points in a season","season"],["historyBestGoalDifference","Best goal difference in a season","season"],["historyLargestTitleMargin","Largest title-winning points margin","season"],["historyMostTitles","Most league titles","all-time"],["historyMostPodiums","Most podium finishes","all-time"],["historyLongestTitleStreak","Most consecutive league titles","all-time"],["historyMostTotalWins","Most wins overall","all-time"],["historyMostTotalGoals","Most goals scored overall","all-time"],["historyMostTotalPoints","Most points overall","all-time"]].map(([key,label,scope])=>`                  <article class="app-competition-stat-card" data-history-scope="${scope}"${scope==="all-time"?" hidden":""}><h5 class="app-competition-stat-label" data-app-i18n="${key}">${label}</h5><span class="app-competition-empty" data-app-i18n="historyNoData">No historical data available yet.</span></article>`).join("\n")}
                </div>
                </section>
                <section class="app-history-record-group" data-history-player-records>
                  <h4 data-app-i18n="historyPlayerRecords">Player records</h4>
                  <div class="app-competition-stat-grid">
${[["seasonGoals","historyPlayerSeasonGoals","Most goals in a season","season"],["seasonAssists","historyPlayerSeasonAssists","Most assists in a season","season"],["seasonCleanSheets","historyPlayerSeasonCleanSheets","Most clean sheets in a season","season"],["totalGoals","historyPlayerTotalGoals","Most goals overall","all-time"],["totalAssists","historyPlayerTotalAssists","Most assists overall","all-time"],["totalAppearances","historyPlayerTotalAppearances","Most appearances overall","all-time"],["totalCleanSheets","historyPlayerTotalCleanSheets","Most clean sheets overall","all-time"]].map(([metric,key,label,scope])=>`                    <article class="app-competition-stat-card" data-history-player-record="${metric}" data-history-scope="${scope}"${scope==="all-time"?" hidden":""}><h5 class="app-competition-stat-label" data-app-i18n="${key}">${label}</h5><span class="app-competition-empty" data-app-i18n="historyPlayerNoData">No historical player data available yet.</span></article>`).join("\n")}
                  </div>
                </section>
              </section>
            </div>
            <p class="app-competition-status" data-history-error data-app-i18n="historyUnavailable" hidden>Season history is temporarily unavailable. Switch tabs to retry.</p>`;
function renderRules(d,neutral,attrs){
 if(neutral&&d.category!=="international")return `<section ${attrs}><div class="app-rules-content"><p data-app-i18n="rulesNeutralOutcomes">Select a division to view its promotion and relegation rules.</p><dl class="app-rules-metrics"><div class="app-rules-metric"><dt data-app-i18n="rulesClubs">Clubs</dt><dd id="app-competition-capacity">—</dd></div></dl><strong id="app-competition-level" hidden>—</strong></div></section>`;
 return `<section ${attrs}>${rulesView.renderRules(d,"en")}</section>`;
}
const postseasonContent = (d,neutral) => {
 const word=(key,text)=>`<span data-app-i18n="${key}">${text}</span>`;
 const seed=position=>`<span class="app-postseason-team" data-postseason-position="${position}">${word("postseasonPosition","League position")} <strong>${position}</strong></span>`;
 const score=(key,label,id,side,metric)=>`<span class="app-knockout-score" role="cell"><span class="sr-only" data-app-i18n="${key}">${label}</span><strong data-postseason-score="${id}:${side}:${metric}">—</strong></span>`;
 const head=(single,id)=>`<div class="app-knockout-score-head${single?" app-knockout-single":""}" role="row"><span role="columnheader" class="sr-only" data-app-i18n="standingsClub">Club</span>${(single?[["postseasonSingleMatch","Single match","—"]]:[["postseasonFirstLeg","First leg","1"],["postseasonSecondLeg","Second leg","2"],["postseasonAggregate","Aggregate","Σ"]]).map(([key,label,symbol],index)=>`<span role="columnheader" class="app-knockout-column"><button type="button" class="app-knockout-help" data-postseason-help="${id}-tip-${index}" aria-describedby="${id}-tip-${index}" data-app-aria="${key}"><span aria-hidden="true">${symbol}</span></button><span id="${id}-tip-${index}" role="tooltip" class="app-knockout-tooltip" data-app-i18n="${key}" hidden>${label}</span></span>`).join("")}</div>`;
 const row=(team,homeKey,homeLabel,id,side,single=false)=>`<div class="app-knockout-team-row${single?" app-knockout-single":""}" role="row" data-postseason-row="${id}:${side}"><div class="app-knockout-identity" role="rowheader">${team}${homeKey?`<span class="app-knockout-home" data-app-i18n="${homeKey}">${homeLabel}</span>`:""}</div>${single?score("postseasonSingleMatch","Single match",id,side,"final"):score("postseasonFirstLeg","First leg",id,side,"first")+score("postseasonSecondLeg","Second leg",id,side,"second")+score("postseasonAggregate","Aggregate",id,side,"aggregate")}</div>`;
 const tie=(id,key,label,better,lower)=>`<section class="app-postseason-group" aria-labelledby="${id}" data-standing-outcome="${d.tier===1?"playout":"playoff"}"><h3 id="${id}" data-app-i18n="${key}">${label}</h3><div role="table" aria-labelledby="${id}">${head(false,id)}${row(seed(better),"postseasonHomeReturn","Home in return leg",id,better)}${row(seed(lower),"postseasonHomeFirst","Home in first leg",id,lower)}</div><p class="app-knockout-resolution" data-postseason-resolution="${id}" hidden></p></section>`;
 if(d.category==="international")return `<p class="app-competition-status" data-app-i18n="cupKnockoutsEmpty">No knockout results available yet.</p>`;
 if(neutral)return `<p class="app-competition-status" data-app-i18n="postseasonNeutral">Select a division to view its play-offs or play-out.</p>`;
 const winner=`<div class="app-knockout-round app-knockout-result"><section class="app-postseason-group app-postseason-winner" aria-labelledby="postseason-winner" data-standing-outcome="${d.tier===1?"playout":"playoff"}"><h3 id="postseason-winner" data-app-i18n="postseasonWinner">Winner</h3><strong id="app-postseason-winner" class="app-knockout-winner-name">—</strong></section></div>`;
 const final=`<div class="app-knockout-round app-knockout-final"><section class="app-postseason-group app-postseason-final" aria-labelledby="postseason-final" data-standing-outcome="playoff"><h3 id="postseason-final" data-app-i18n="postseasonFinal">Final</h3><div role="table" aria-labelledby="postseason-final">${head(true,"final")}${row(`<span class="app-postseason-team" data-postseason-finalist="home">${word("postseasonFinalHome","Better-ranked finalist")}</span>`,null,null,"final","home",true)}${row(`<span class="app-postseason-team" data-postseason-finalist="away">${word("postseasonFinalAway","Other finalist")}</span>`,null,null,"final","away",true)}</div><p class="app-knockout-resolution" data-postseason-resolution="final" hidden></p></section></div>`;
 const bracket=d.tier===1
  ?`<div class="app-knockout-round app-knockout-left">${tie("postseason-playout","rulesPlayoutTitle","Relegation play-out",13,14)}</div>${winner}`
  :`<div class="app-knockout-round app-knockout-left">${tie("postseason-semi-one","postseasonSemiOne","Semi-final 1",3,6)}</div><div class="app-knockout-round app-knockout-right">${tie("postseason-semi-two","postseasonSemiTwo","Semi-final 2",4,5)}</div>${final}${winner}`;
 return `<div id="app-postseason-bracket" class="app-postseason-grid${d.tier===1?" app-postseason-playout":""}">${bracket}</div>`;
};
const competitionTabs = function competitionTabs(d,standings,neutral) {
 const views=model.views.map(view=>view.id==="postseason"&&d.category==="international"
  ?{...view,key:"competitionTabKnockouts",label:"Knockouts"}:view.id==="postseason"&&!neutral
  ?{...view,key:d.tier===1?"competitionTabPlayout":"competitionTabPlayoffs",label:d.tier===1?"Playout":"Playoffs"}:view);
 const nav=views.map(({id,key,label},i)=>
  `            <button type="button" role="tab" class="app-competition-tab${i===0?" is-active":""}" id="competition-tab-${id}" aria-controls="competition-panel-${id}" aria-selected="${i===0?"true":"false"}" tabindex="${i===0?"0":"-1"}" data-app-i18n="${key}">${label}</button>`
 ).join("\n");
 const emptyKeys={fixtures:"competitionFixturesEmpty",stats:"competitionStatsEmpty"};
 const messages={
  fixtures:"No scheduled matches or results are available.",
  stats:"Competition statistics are not available before matches are played."
 };
 const panels=views.map(({id,key,label},i)=>{
  const attrs=`id="competition-panel-${id}" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-${id}" tabindex="0"${i===0?"":" hidden"}`;
  if(id==="standings")return `          <div ${attrs}>${standings}\n          </div>`;
  if(id==="postseason")return `          <section ${attrs}>${postseasonContent(d,neutral)}\n          </section>`;
  if(id==="history")return `          <section ${attrs}>${historyEmptyContent()}\n          </section>`;
  if(id==="fixtures")return `          <section ${attrs}>${fixturesContent()}\n          </section>`;
  if(id==="rules")return renderRules(d,neutral,attrs,key,label);
  if(id==="awards")return `          <section ${attrs}>\n          </section>`;
  return `          <section ${attrs}>\n            <h2 data-app-i18n="${key}">${label}</h2>\n            <p class="app-competition-status" data-app-i18n="${emptyKeys[id]}">${messages[id]}</p>\n          </section>`;
 }).join("\n");
 return `          <div class="app-competition-tabs" role="tablist" aria-label="Competition views" data-app-aria="competitionViews">\n${nav}\n          </div>\n          <script>(()=>{const view=document.documentElement.dataset.competitionView||"standings";for(const tab of document.querySelectorAll(".app-competition-tab")){const active=tab.id==="competition-tab-"+view;tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.classList.toggle("is-active",active)}})();</script>\n${panels}\n          <script src="/assets/competition-tabs.js" defer></script>\n          <script src="/assets/competition-history.js" defer></script>`;
};
const detailContent = function detailContent(d,neutral=false){
 const c=countryById[d.countryId];
 if(!c&&d.category!=="international")throw Error("unknown detail "+d.id);
 const level=d.tier===1?"divisionTier1":"divisionTier2";
 return '          <header class="app-competition-header">\n'+
 '            '+(neutral?'<div class="app-competition-logo-placeholder app-competition-logo-placeholder-large" id="app-competition-badge" aria-hidden="true">—</div>':renderLogo(d))+'\n'+
 '            <div class="app-competition-identity">\n'+
 '              <h1 class="app-page-title" id="divisions-title"><span id="division-detail-name">'+(d.category==="international"?encode(d.name):neutral?"Competition":encode(d.name))+'</span></h1>\n'+
 (d.category==="international"?'              <div class="app-world-detail-meta"><span data-cup-copy="category">International Cups</span><span aria-hidden="true">·</span><span data-cup-copy="summary">24 clubs · 8 countries</span></div>\n':
 '              <div class="app-world-detail-meta">'+inlineCountryFlag(c,"app-competition-flag")+' <span id="app-competition-country" data-world-country="'+(neutral?"":d.countryId)+'">'+(neutral?"Country":encode(c.name.en))+'</span><span aria-hidden="true">·</span> <span id="app-competition-tier" data-app-i18n="'+level+'">'+(d.tier===1?'First division':'Second division')+'</span></div>\n')+
 '            </div>\n'+
 '            <div class="app-competition-season"><span id="app-competition-season-label" data-app-i18n="competitionSeason">Season</span><div class="language-control" id="app-competition-season-control"><button type="button" id="app-competition-season" class="language-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="app-competition-season-menu" aria-labelledby="app-competition-season-label app-competition-season-value"><span id="app-competition-season-value">1</span>'+menuChevron+'</button><div id="app-competition-season-menu" class="language-menu" role="listbox" aria-labelledby="app-competition-season-label" hidden><div id="app-competition-season-option-1" class="language-option" role="option" data-menu-value="1" aria-selected="true">1</div></div></div></div>\n'+
 '            <a class="app-competition-return app-link app-link-secondary" href="/competitions" data-app-i18n="allDivisions">All competitions</a>\n'+
 '          </header>\n'+
 '          <p id="app-competition-season-unavailable" class="app-competition-status" role="status" data-app-i18n="competitionSeasonUnavailable" hidden>Season unavailable</p>\n'+competitionTabs(d,detailAppend(d,neutral),neutral);
};
return detailContent;
}
