import {renderViewSkeleton,renderViewTemplates,viewSkeletonScript} from './competition-view-skeletons.mjs';
import {renderFixturesSkeleton} from './fixtures-static-shell.mjs';
// One detail renderer for all competition routes and the neutral shell.
import model from "../assets/competition-model.js";
import rulesView from "../assets/competition-rules-view.js";
import rules from "../assets/competition-rules.js";
import statsView from "../assets/competition-stats.js";

export function createCompetitionRenderer({countryById,encode,inlineCountryFlag,renderLogo,clubsByDivision,crestCatalog}){
// Decorative skeleton mirrors the real table and compact rows; no fake identities or crests.
// Keep known Season 1 identities in the initial loading shell, not sporting values.
const standingsSkeleton=(d,cols,neutral=false)=>{
 const known=!neutral&&d.category==='domestic'?clubsByDivision.get(d.id):null;
 const knownCrest=(club,size)=>{
  const id=club.countryId+'-'+club.clubId;
  const asset=Object.hasOwn(crestCatalog,id)?crestCatalog[id]:null;
  const host='<span class="app-world-club-crest-placeholder"'+(asset?' data-club-crest="'+encode(id)+'" data-club-crest-pending="true"':'')+' aria-hidden="true">';
  return host+(asset?'<img class="app-club-crest-image" src="/'+encode(asset)+'" alt="" width="'+size+'" height="'+size+'" loading="eager" decoding="async" draggable="false">':'')+'</span>';
 };
 const cell=(i,club)=>{
  if(i!==1||!club)return '<'+(i===1?'th':'td')+'><span class="app-skeleton-bar"></span></'+(i===1?'th':'td')+'>';
  return '<th scope="row" class="app-world-standing-club"><span class="app-world-club-identity" data-skeleton-identity>'+
   knownCrest(club,48)+'<span class="app-world-club-name">'+encode(club.primaryName||club.abbr)+'</span></span>'+
   '<span class="app-skeleton-bar" data-skeleton-identity-placeholder></span></th>';
 };
 const rows=Array.from({length:d.capacity},(_,i)=>'<tr data-skeleton-row>'+Array.from({length:11},(_,j)=>cell(j,known?.[i])).join('')+'</tr>').join('');
 const mobile=Array.from({length:d.capacity},(_,i)=>{
  const club=known?.[i];
  const identity=club?'<span class="app-world-mobile-name" data-skeleton-identity>'+knownCrest(club,40)+
   '<span class="app-world-mobile-club-name">'+encode(club.primaryName||club.abbr)+'</span></span>':'';
  const placeholder='<span class="app-world-mobile-name app-skeleton-bar"'+(club?' data-skeleton-identity-placeholder':'')+'></span>';
  return '<li class="app-world-mobile-item" data-skeleton-mobile><div class="app-world-mobile-summary">'+
   '<span class="app-world-mobile-position app-skeleton-bar"></span>'+identity+placeholder+
   '<span class="app-world-mobile-points app-skeleton-bar"></span><span class="app-world-mobile-form app-skeleton-bar"></span></div></li>';
 }).join('');
 // For an unspecified season the world clock is not yet known: reserve blank
 // slots until the authoritative coordinator identifies the viewed season.
 const gate=known?'<script data-fa-standings-identity-first-paint>(function(){const season=new URLSearchParams(location.search).get("season");document.documentElement.dataset.faStandingsKnownIdentity=season==="1"?"true":"false";})();</script>':'';
 return '<div class="app-standings-skeleton" aria-hidden="true"><div class="app-world-standing-scroll"><table class="app-world-standing-table"><thead><tr>'+cols+'</tr></thead><tbody>'+rows+'</tbody></table></div><ol class="app-world-mobile-list app-skeleton-mobile">'+mobile+'</ol></div>'+gate+'<!-- standings-skeleton-end -->';
};
const detailAppend = function detailAppend(d,neutral){
 const cols=[["standingsPosition","Pos"],["standingsClub","Club"],["standingsPlayed","P"],["standingsWon","W"],["standingsDrawn","D"],["standingsLost","L"],["standingsFor","GF"],["standingsAgainst","GA"],["standingsDifference","GD"],["standingsPoints","Pts"],["standingsForm","Form"]]
 .map(([key,label],i)=>'                  <th scope="col"'+(i===1?' class="app-world-standing-name-head"':'')+' data-app-i18n="'+key+'">'+label+'</th>').join("\n");
 const preRenderedRows=neutral||d.category==="international"?"":clubsByDivision.get(d.id).map(club=>`                  <tr data-world-club="${encode(club.countryId)}-${club.clubId}"><td class="app-world-stat-unknown">—</td><th scope="row" class="app-world-standing-club"><span class="app-world-club-identity"><span class="app-world-club-crest-placeholder" data-club-crest="${encode(club.countryId)}-${club.clubId}"${Object.hasOwn(crestCatalog,club.countryId+"-"+club.clubId)?' data-club-crest-pending="true"':""} aria-hidden="true"></span><span class="app-world-club-name">${encode(club.primaryName||club.abbr)}</span></span></th>${Array(9).fill('<td class="app-world-stat-unknown">—</td>').join("")}</tr>`).join("\n");
 const legend=neutral&&d.category!=='international'?'':rulesView.renderStandingsLegend(d);
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
${d.category==="international"?'<tr><td colspan="11" class="app-competition-empty-row" data-app-i18n="competitionStandingsEmpty">No standings available yet.</td></tr>':preRenderedRows}
                </tbody>
              </table>
            </div>
          </div>${standingsSkeleton(d,cols,neutral)}${legend}`;
};
const menuChevron='<svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fixtureOption=(d,c)=>'                  <div class="language-option" role="option" id="app-fixtures-round-option-'+c.value+'" data-menu-value="'+c.value+'" data-fixture-round-choice="'+c.value+'" aria-selected="'+(c.value===1)+'"><span data-competition-fixture-choice="'+c.value+'">'+rulesView.fixturesChoiceLabel(d,c)+'</span></div>';
const fixturesContent = (d)=>`
            <div class="app-fixtures-toolbar" id="app-fixtures-toolbar">
              <div class="app-fixtures-navigation">
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-previous" aria-label="Previous matchday" data-app-aria="fixturesPrevious" disabled><svg class="site-chevron site-chevron-left" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <div class="language-control app-fixtures-select">
                <button type="button" id="app-fixtures-round" class="language-trigger app-fixtures-trigger" role="combobox" aria-haspopup="listbox" aria-labelledby="app-fixtures-round-label app-fixtures-round-number" aria-controls="app-fixtures-picker" aria-expanded="false" disabled><span class="app-fixtures-trigger-label"><span id="app-fixtures-round-label" data-app-i18n="fixturesMatchday">Matchday</span> <span id="app-fixtures-round-number">1</span></span>${menuChevron}</button>
                <div id="app-fixtures-picker" class="language-menu app-fixtures-picker" role="listbox" aria-labelledby="app-fixtures-round" hidden>
${rulesView.fixturesDisplayChoices(d).map(c=>fixtureOption(d,c)).join("\n")}
                </div>
                </div>
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-next" aria-label="Next matchday" data-app-aria="fixturesNext" disabled><svg class="site-chevron site-chevron-right" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              </div>
              <button type="button" class="language-trigger app-fixtures-current" id="app-fixtures-current" data-app-aria="fixturesCurrent" aria-label="Current matchday" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span data-app-i18n="fixturesCurrent">Current matchday</span></button>
              <p id="app-fixtures-summary" class="sr-only" role="status" aria-live="polite" aria-atomic="true" hidden></p>
            </div>
            <p id="app-fixtures-empty" class="app-competition-status" data-app-i18n="competitionFixturesEmpty">No scheduled matches or results are available.</p>
            <ol id="app-fixtures-list" class="app-fixtures-list" aria-label="Competition matches" data-app-aria="fixturesMatches" hidden></ol>${renderFixturesSkeleton(d)}`;
const historyEmptyContent = ()=>`
            <div class="app-history-empty" data-history-empty>
              <section class="app-history-dev-section">
                <h3 data-app-i18n="historyHistoricalRecords">Historical records</h3>
                <div class="app-history-record-controls" data-history-record-controls role="group" data-app-aria="historyRecordScope" aria-label="Record scope">
                  <button type="button" data-history-record-scope="season" aria-pressed="true" data-app-i18n="historySeasonRecords">Season</button>
                  <button type="button" data-history-record-scope="all-time" aria-pressed="false" data-app-i18n="historyAllTimeRecords">All-time</button>
                </div>
                <section class="app-history-record-group" data-history-team-records>
                  <h4 data-app-i18n="historyTeamRecords">Team records</h4>
                <div class="app-competition-stat-grid">
${[["historyBestAttack","Best attack in a season","season"],["historyBestDefence","Best defence in a season","season"],["historyMostSeasonWins","Most wins in a season","season"],["historyMostSeasonPoints","Most points in a season","season"],["historyBestGoalDifference","Best goal difference in a season","season"],["historyLargestTitleMargin","Largest title-winning points margin","season"],["historyMostTitles","Most league titles","all-time"],["historyMostPodiums","Most podium finishes","all-time"],["historyLongestTitleStreak","Most consecutive league titles","all-time"],["historyMostTotalWins","Most wins overall","all-time"],["historyMostTotalGoals","Most goals scored overall","all-time"],["historyMostTotalPoints","Most points overall","all-time"]].map(([key,label,scope])=>`                  <article class="app-competition-stat-card" data-history-scope="${scope}"${scope==="all-time"?" hidden":""}><h5 class="app-competition-stat-label" data-app-i18n="${key}">${label}</h5><span class="app-competition-empty" data-app-i18n="historyNoData">No historical data available yet.</span></article>`).join("\n")}
                </div>
                <p class="app-competition-status app-history-record-empty-state" data-history-team-empty data-app-i18n="historyNoData">No historical data available yet.</p>
                </section>
                <section class="app-history-record-group" data-history-player-records>
                  <h4 data-app-i18n="historyPlayerRecords">Player records</h4>
                  <div class="app-competition-stat-grid">
${[["seasonGoals","historyPlayerSeasonGoals","Most goals in a season","season"],["seasonAssists","historyPlayerSeasonAssists","Most assists in a season","season"],["seasonCleanSheets","historyPlayerSeasonCleanSheets","Most clean sheets in a season","season"],["totalGoals","historyPlayerTotalGoals","Most goals overall","all-time"],["totalAssists","historyPlayerTotalAssists","Most assists overall","all-time"],["totalAppearances","historyPlayerTotalAppearances","Most appearances overall","all-time"],["totalCleanSheets","historyPlayerTotalCleanSheets","Most clean sheets overall","all-time"]].map(([metric,key,label,scope])=>`                    <article class="app-competition-stat-card" data-history-player-record="${metric}" data-history-scope="${scope}"${scope==="all-time"?" hidden":""}><h5 class="app-competition-stat-label" data-app-i18n="${key}">${label}</h5><span class="app-competition-empty" data-app-i18n="historyPlayerNoData">No historical player data available yet.</span></article>`).join("\n")}
                  </div>
                  <p class="app-competition-status app-history-record-empty-state" data-history-player-empty data-app-i18n="historyPlayerNoData">No historical player data available yet.</p>
                </section>
              </section>
              <section class="app-history-dev-section">
                <h3 data-app-i18n="historySeasonArchive">Season archive</h3>
                <div class="app-world-standings app-view-skeleton-history-archive"><p class="app-competition-empty-row" data-app-i18n="competitionHistoryEmpty">No completed seasons available yet.</p></div>
              </section>
            </div>
            <p class="app-competition-status" data-history-error data-app-i18n="historyUnavailable" hidden>Season history is temporarily unavailable. Switch tabs to retry.</p>`;
function renderRules(d,neutral,attrs){
 if(neutral&&d.category!=="international")return `<section ${attrs}><div class="app-rules-content"><p data-app-i18n="rulesNeutralOutcomes">Select a division to view its promotion and relegation rules.</p><dl class="app-rules-metrics"><div class="app-rules-metric"><dt data-app-i18n="rulesClubs">Clubs</dt><dd id="app-competition-capacity">—</dd></div></dl><strong id="app-competition-level" hidden>—</strong></div></section>`;
 return `<section ${attrs}>${rulesView.renderRules(d,"en")}</section>`;
}
const postseasonContent = (d,neutral) => rulesView.renderPostseason(d,neutral);
// SAF-02: restore tabs while HTML parses, before any visible paint.
const firstPaintTabScrollScript = "          <script data-fa-competition-tabs-scroll-first-paint>(function(){const tabs=document.querySelector(\".app-competition-tabs\");if(!tabs)return;const key=\"football-architect:competition-tabs-scroll:\"+location.pathname.replace(/\\/(standings|postseason|fixtures|stats|history|rules|awards|overview|teams)\\/?$/,\"\");try{const saved=sessionStorage.getItem(key);if(saved!==null){const offset=Number(saved);if(Number.isFinite(offset)&&offset>=0)tabs.scrollLeft=Math.min(offset,Math.max(0,tabs.scrollWidth-tabs.clientWidth))}}catch{}const maximum=Math.max(0,tabs.scrollWidth-tabs.clientWidth);tabs.dataset.canScrollLeft=String(maximum>1&&tabs.scrollLeft>1);tabs.dataset.canScrollRight=String(maximum>1&&tabs.scrollLeft<maximum-1)})();</script>";
const competitionTabs = function competitionTabs(d,standings,neutral) {
 const views=model.views.map(view=>view.id==="postseason"&&d.category==="international"
  ?{...view,key:"competitionTabKnockouts",label:"Knockouts"}:view.id==="postseason"&&!neutral
  ?{...view,key:d.rules.phases.some(p=>p.labelKey==='playout')?"competitionTabPlayout":"competitionTabPlayoffs",label:d.rules.phases.some(p=>p.labelKey==='playout')?"Playout":"Playoffs"}:view);
 const nav=views.map(({id,key,label},i)=>
  `            <button type="button" role="tab" class="app-competition-tab${i===0?" is-active":""}" id="competition-tab-${id}" aria-controls="competition-panel-${id}" aria-selected="${i===0?"true":"false"}" tabindex="${i===0?"0":"-1"}" data-app-i18n="${key}">${label}</button>`
 ).join("\n");
 const emptyKeys={fixtures:"competitionFixturesEmpty",stats:"competitionStatsEmpty"};
 const messages={
  fixtures:"No scheduled matches or results are available.",
  stats:"Competition statistics are not available before matches are played."
 };
 const panelMarkup=views.map(({id,key,label},i)=>{
  const attrs=`id="competition-panel-${id}" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-${id}" tabindex="0"${i===0?"":" hidden"}`;
  if(id==="standings")return `          <div ${attrs}>${standings}\n          </div>`;
  if(id==="postseason")return `          <section ${attrs}>${postseasonContent(d,neutral)}\n          </section>`;
  if(id==="history")return `          <section ${attrs}>${renderViewSkeleton(d,id)}\n            <script data-fa-history-first-paint-ready>if(document.documentElement.dataset.competitionView==="history"){document.getElementById("competition-panel-history").hidden=false;document.documentElement.removeAttribute("data-fa-competition-prepaint");}</script>${renderViewTemplates(d,id)}${historyEmptyContent()}${viewSkeletonScript(id)}\n          </section>`;
  if(id==="fixtures")return `          <section ${attrs}>${fixturesContent(d)}\n          </section>`;
  if(id==="rules")return renderRules(d,neutral,attrs,key,label);
  if(id==="stats")return `${renderViewTemplates(d,id)}          <section ${attrs}>${renderViewSkeleton(d,id)}${statsView.renderEmpty()}${viewSkeletonScript(id)}\n          </section>`;
  if(id==="awards")return `${renderViewTemplates(d,id)}          <section ${attrs}>${renderViewSkeleton(d,id)}${viewSkeletonScript(id)}\n          </section>`;
  return `          <section ${attrs}>\n            <h2 data-app-i18n="${key}">${label}</h2>\n            <p class="app-competition-status" data-app-i18n="${emptyKeys[id]}">${messages[id]}</p>\n          </section>`;
 });
 const panels=[panelMarkup[views.findIndex(view=>view.id==="history")],...panelMarkup.filter((_,index)=>views[index].id!=="history")].join("\n");
 return `          <div class="app-competition-tabs" role="tablist" aria-label="Competition views" data-app-aria="competitionViews">\n${nav}\n          </div>\n          <script>(()=>{const view=document.documentElement.dataset.competitionView||"standings";for(const tab of document.querySelectorAll(".app-competition-tab")){const active=tab.id==="competition-tab-"+view;tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.classList.toggle("is-active",active)}})();</script>\n${firstPaintTabScrollScript}\n${panels}\n          <script data-fa-competition-selected-panel-first-paint>(function(){const view=document.documentElement.dataset.competitionView||"standings";for(const panel of document.querySelectorAll("#app-divisions > .app-competition-panel"))panel.hidden=panel.id!=="competition-panel-"+view;})();</script>\n          <script src="/assets/competition-tabs.js" defer></script>\n          <script src="/assets/competition-history.js" defer></script>`;
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
