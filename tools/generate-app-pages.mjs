// Generates checked-in static app pages from the shared shell (Node.js 22, no npm).
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {validateProvisionalAllocations} from "./validate-provisional-allocations.mjs";
import {validateDivisionAssets,renderDivisionLogo} from "./validate-division-assets.mjs";

// Normalize the source template too: Windows clones may retain CRLF from an earlier checkout.
const template = readFileSync(new URL("../templates/app-page.html", import.meta.url), "utf8").replace(/\r\n/g,"\n");
const pages = {
  "dashboard": {
    "@@FA_LINE_008@@": "  <title>Dashboard — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-dashboard\" href=\"./\" data-app-view=\"dashboard\" aria-current=\"page\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"../calendar/\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"../settings/\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\">",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"./\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "calendar": {
    "@@FA_LINE_008@@": "  <title>Calendar — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"../dashboard/\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-calendar\" href=\"./\" data-app-view=\"calendar\" aria-current=\"page\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"../settings/\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\">",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"../dashboard/\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "settings": {
    "@@FA_LINE_008@@": "  <title>Settings — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"../dashboard/\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"../calendar/\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-settings\" href=\"./\" data-app-view=\"settings\" aria-current=\"page\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_LINE_104@@": "            <a class=\"app-link app-link-secondary\" href=\"../dashboard/\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>",
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\">"
  }
};

const finalLogos=validateDivisionAssets().divisions;
const divisionData = JSON.parse(readFileSync(new URL("../data/divisions.json", import.meta.url), "utf8"));
const clubData = JSON.parse(readFileSync(new URL("../data/clubs.json", import.meta.url), "utf8"));
if (!Array.isArray(clubData) || clubData.length !== 320) throw new Error("Expected 320 canonical club identities");
const provisionalAssignments = JSON.parse(readFileSync(new URL("../data/division-allocations.provisional.json", import.meta.url), "utf8"));
const {byDivision:provisionalClubs} = validateProvisionalAllocations(provisionalAssignments,divisionData,clubData);
const encode = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const flagForCountry = id => "assets/flags/" + (id === "ENG" ? "gb-eng" : id.toLowerCase()) + ".svg";
const countryById = Object.fromEntries(new Map(divisionData.map(d=>[d.countryId,{id:d.countryId,name:{en:d.countryName},flagAsset:flagForCountry(d.countryId)}])));
const primaryName=club=>club.primaryName;

const worldNav = function worldNav(href,active){
 return '            <a class="fa-shell-link'+(active?' is-active':'')+'" id="app-nav-divisions" href="'+href+'" data-app-view="divisions"'+(active?' aria-current="page"':'')+' aria-label="Competitions" data-app-aria="navCompetitions">';
};
const worldSection = function worldSection(content,active,division=null){
 const h=division ? '' : '          <h1 class="app-page-title" id="divisions-title" data-app-i18n="navCompetitions">Competitions</h1>\n';
 return '        <section id="app-divisions" class="app-view app-world-view" aria-labelledby="divisions-title"'+(active?'':' hidden')+'>\n'+h+(content?content+'\n':'')+'        </section>';
};
const inlineCountryFlag = (country, id = null) => {
 const code=country.id==="ENG"?"gb-eng":country.id.toLowerCase();
 const svg=readFileSync(new URL("../"+country.flagAsset,import.meta.url),"utf8").trim();
 if(!svg.startsWith("<svg ") || !svg.endsWith("</svg>"))throw Error("Invalid inline flag "+code);
 return '<span class="app-world-flag-frame" aria-hidden="true">'+svg.replace("<svg ",'<svg class="app-world-flag" '+(id?'id="'+id+'" ':"")+'aria-hidden="true" focusable="false" width="24" height="16" ')+"</span>";
};
const indexContent = function indexContent(root){
 const displayCountryOrder=["IT","ENG","ES","DE","FR","PT","NL","BR"];
 const cards=displayCountryOrder.map(id=>countryById[id]).map(c=>{
  const links=divisionData.filter(d=>d.countryId===c.id).map(d=>
 '                <a class="app-division-card" href="./'+d.id.toLowerCase()+'?season=1&amp;view=standings">'+renderDivisionLogo(d.id,"compact",finalLogos)+'<span class="app-division-card-copy"><strong>'+encode(d.name)+'</strong><small data-app-i18n="'+(d.tier===1?'divisionTier1':'divisionTier2')+'">'+(d.tier===1?'First division':'Second division')+'</small></span></a>'
 ).join("\n");
 return '            <section class="app-world-country" aria-labelledby="world-country-'+c.id.toLowerCase()+'">\n'+
 '              <h2 id="world-country-'+c.id.toLowerCase()+'">'+inlineCountryFlag(c)+' <span data-world-country="'+c.id+'">'+encode(c.name.en)+'</span></h2>\n'+
 '              <div class="app-world-grid">\n'+links+'\n              </div>\n            </section>';
 }).join("\n");
 return '          <div class="app-world-countries">\n'+cards+'\n          </div>';
};
const detailAppend = function detailAppend(d){
 const cs=provisionalClubs.get(d.id);
 if(!cs||cs.length!==d.capacity)throw Error("missing clubs "+d.id);
 const cols=[["standingsPosition","Pos"],["standingsClub","Club"],["standingsPlayed","P"],["standingsWon","W"],["standingsDrawn","D"],["standingsLost","L"],["standingsFor","GF"],["standingsAgainst","GA"],["standingsDifference","GD"],["standingsPoints","Pts"],["standingsForm","Form"]]
 .map(([key,label],i)=>'                  <th scope="col"'+(i===1?' class="app-world-standing-name-head"':'')+' data-app-i18n="'+key+'">'+label+'</th>').join("\n");
 const rows=cs.map(c=>`                <tr data-world-club="${encode(c.countryId)}-${c.clubId}">
                  <td class="app-world-stat-unknown">—</td>
                  <th scope="row" class="app-world-standing-club"><span class="app-world-club-identity"><span class="app-world-club-crest-placeholder" data-club-crest="${encode(c.countryId)}-${c.clubId}" aria-hidden="true"></span><span class="app-world-club-name">${encode(primaryName(c)||c.abbr)}</span></span></th>
${Array.from({length:9},()=> '                  <td class="app-world-stat-unknown">—</td>').join("\n")}
                </tr>`).join("\n");
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
                <tbody>
${rows}
                </tbody>
              </table>
            </div>
          </div>`;
};
const menuChevron='<svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fixturesContent = ()=>`
            <div class="app-fixtures-toolbar" id="app-fixtures-toolbar" hidden>
              <div class="app-fixtures-navigation">
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-previous" aria-label="Previous matchday" data-app-aria="fixturesPrevious" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
                <div class="language-control app-fixtures-select">
                <button type="button" id="app-fixtures-round" class="language-trigger app-fixtures-trigger" role="combobox" aria-haspopup="listbox" aria-labelledby="app-fixtures-round-label app-fixtures-round-number" aria-controls="app-fixtures-picker" aria-expanded="false" disabled><span id="app-fixtures-round-label" data-app-i18n="fixturesMatchday">Matchday</span> <span id="app-fixtures-round-number">1</span>${menuChevron}</button>
                <div id="app-fixtures-picker" class="language-menu app-fixtures-picker" role="listbox" aria-labelledby="app-fixtures-round" hidden>
${Array.from({length:30},(_,i)=>'                  <div class="language-option" role="option" id="app-fixtures-round-option-'+(i+1)+'" data-menu-value="'+(i+1)+'" data-fixture-round-choice="'+(i+1)+'" aria-selected="'+(i===0)+'"><span data-app-i18n="fixturesMatchday">Matchday</span>&nbsp;'+(i+1)+'</div>').join("\n")}
                </div>
                </div>
                <button type="button" class="language-trigger app-fixtures-arrow" id="app-fixtures-next" aria-label="Next matchday" data-app-aria="fixturesNext" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
              </div>
              <button type="button" class="language-trigger app-fixtures-current" id="app-fixtures-current" data-app-aria="fixturesCurrent" aria-label="Current matchday" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg><span data-app-i18n="fixturesCurrent">Current matchday</span></button>
              <p id="app-fixtures-summary" class="sr-only" role="status" aria-live="polite" aria-atomic="true" hidden></p>
            </div>
            <p id="app-fixtures-empty" class="app-competition-status" data-app-i18n="competitionFixturesEmpty">No scheduled matches or results are available.</p>
            <ol id="app-fixtures-list" class="app-fixtures-list" aria-label="Competition matches" data-app-aria="fixturesMatches" hidden></ol>`;
const competitionTabs = function competitionTabs(d,standings) {
 const views=[
  ["standings","competitionTabStandings","Standings"],
  ["fixtures","competitionTabFixtures","Fixtures"],
  ["stats","competitionTabStats","Stats"],
  ["history","competitionTabHistory","History"],
  ["rules","competitionTabRules","Rules"],
  ["awards","competitionTabAwards","Awards"]
 ];
 const nav=views.map(([id,key,label],i)=>
  `            <button type="button" role="tab" class="app-competition-tab${i===0?" is-active":""}" id="competition-tab-${id}" aria-controls="competition-panel-${id}" aria-selected="${i===0?"true":"false"}" tabindex="${i===0?"0":"-1"}" data-app-i18n="${key}">${label}</button>`
 ).join("\n");
 const emptyKeys={fixtures:"competitionFixturesEmpty",stats:"competitionStatsEmpty",history:"competitionHistoryEmpty",awards:"competitionAwardsEmpty"};
 const messages={
  fixtures:"No scheduled matches or results are available.",
  stats:"Competition statistics are not available before matches are played.",
  history:"No completed seasons or past winners are available.",
  awards:"No season awards are available."
 };
 const panels=views.map(([id,key,label],i)=>{
  const attrs=`id="competition-panel-${id}" class="app-competition-panel" role="tabpanel" aria-labelledby="competition-tab-${id}" tabindex="0"${i===0?"":" hidden"}`;
  if(id==="standings")return `          <div ${attrs}>${standings}\n          </div>`;
  if(id==="fixtures")return `          <section ${attrs}>${fixturesContent()}\n          </section>`;
  if(id==="rules")return `          <section ${attrs}>\n            <h2 data-app-i18n="${key}">${label}</h2>\n            <p class="app-competition-status" data-app-i18n="competitionRulesEmpty">Promotion, relegation and tie-break rules are not yet defined.</p>\n            <dl class="app-competition-facts"><div><dt data-app-i18n="capacityLabel">Planned club places</dt><dd>${d.capacity}</dd></div><div><dt data-app-i18n="tierLabel">Tier</dt><dd>${d.tier}</dd></div></dl>\n          </section>`;
  return `          <section ${attrs}>\n            <h2 data-app-i18n="${key}">${label}</h2>\n            <p class="app-competition-status" data-app-i18n="${emptyKeys[id]}">${messages[id]}</p>\n          </section>`;
 }).join("\n");
 return `          <div class="app-competition-tabs" role="tablist" aria-label="Competition views" data-app-aria="competitionViews">\n${nav}\n          </div>\n          <script>(()=>{const view=document.documentElement.dataset.competitionView||"standings";for(const tab of document.querySelectorAll(".app-competition-tab")){const active=tab.id==="competition-tab-"+view;tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.classList.toggle("is-active",active)}})();</script>\n${panels}\n          <script src="../../../assets/competition-tabs.js" defer></script>`;
};
const detailContent = function detailContent(d,root){
 const c=countryById[d.countryId];
 if(!c)throw Error("unknown detail "+d.id);
 const level=d.tier===1?"divisionTier1":"divisionTier2";
 return '          <header class="app-competition-header">\n'+
 '            '+renderDivisionLogo(d.id,"compact",finalLogos,{large:true}).replace('<div ','<div id="app-competition-badge" ')+'\n'+
 '            <div class="app-competition-identity">\n'+
 '              <h1 class="app-page-title" id="divisions-title"><span id="division-detail-name">'+encode(d.name)+'</span></h1>\n'+
 '              <div class="app-world-detail-meta">'+inlineCountryFlag(c,"app-competition-flag")+' <span data-world-country="'+d.countryId+'">'+encode(c.name.en)+'</span><span aria-hidden="true">·</span> <span data-app-i18n="'+level+'">'+(d.tier===1?'First division':'Second division')+'</span></div>\n'+
 '            </div>\n'+
 '            <div class="app-competition-season"><span id="app-competition-season-label" data-app-i18n="competitionSeason">Season</span><div class="language-control" id="app-competition-season-control"><button type="button" id="app-competition-season" class="language-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="app-competition-season-menu" aria-labelledby="app-competition-season-label app-competition-season-value"><span id="app-competition-season-value">1</span>'+menuChevron+'</button><div id="app-competition-season-menu" class="language-menu" role="listbox" aria-labelledby="app-competition-season-label" hidden><div id="app-competition-season-option-1" class="language-option" role="option" data-menu-value="1" aria-selected="true">1</div></div></div></div>\n'+
 '            <a class="app-competition-return app-link app-link-secondary" href="../" data-app-i18n="allDivisions">All competitions</a>\n'+
 '          </header>\n'+
 '          <p id="app-competition-season-unavailable" class="app-competition-status" role="status" data-app-i18n="competitionSeasonUnavailable" hidden>Season unavailable</p>\n'+competitionTabs(d,detailAppend(d));
};
const worldPageReplacements = (depth, division = null) => {
  const upToApp = "../".repeat(depth - 1);
  const root = "../".repeat(depth);
  const title = division ? division.name : "Competitions";
  return {
    "@@FA_LINE_008@@": "  <title>" + encode(title) + " — Football Architect</title>",
    "@@FA_LINE_032@@": '            <a class="fa-shell-link" id="app-nav-dashboard" href="' + upToApp + 'dashboard/" data-app-view="dashboard" aria-label="Dashboard" data-app-aria="dashboard">',
    "@@FA_LINE_036@@": '            <a class="fa-shell-link" id="app-nav-calendar" href="' + upToApp + 'calendar/" data-app-view="calendar" aria-label="Calendar" data-app-aria="calendar">',
    "@@FA_LINE_044@@": '            <a class="fa-shell-link" id="app-nav-settings" href="' + upToApp + 'settings/" data-app-view="settings" aria-label="Settings" data-app-aria="settings">',
    "@@FA_LINE_077@@": '        <section id="app-dashboard" class="app-view" aria-labelledby="dashboard-title" hidden>',
    "@@FA_LINE_099@@": '        <section id="app-calendar" class="app-view" aria-labelledby="calendar-title" hidden>',
    "@@FA_LINE_104@@": '            <a class="app-link app-link-secondary" href="' + upToApp + 'dashboard/" data-app-i18n="backDashboard">Back to Dashboard</a>',
    "@@FA_LINE_107@@": '        <section id="app-settings" class="app-view app-settings-view" aria-labelledby="settings-title" hidden>',
    "@@FA_WORLD_LINK@@": worldNav(division ? "../" : "./", true),
    "@@FA_WORLD_SECTION@@": worldSection(division ? detailContent(division,root) : indexContent(root), true,division)
  };
};
// Shared competition shell: one markup source and one validated data manifest.
// Full generated route documents preserve deep links and SVG first paint.
const replaceExactlyOnce = (source,before,after,label) => {
 if(source.split(before).length!==2)throw Error("Shared template contract changed: "+label);
 return source.replace(before,after);
};
// Shared competition shell: one markup source and one validated data manifest.
// Full generated route documents preserve deep links and SVG first paint.
const sharedTemplate = function sharedTemplate(html,first=divisionData.find(d=>d.id==="IT-1"),neutral=true) {
 const country=countryById[first.countryId];
 if(neutral)html=replaceExactlyOnce(html,"<title>"+encode(first.name)+" — Football Architect</title>","<title>Competition — Football Architect</title>","title");
 if(neutral)html=replaceExactlyOnce(html,'id="division-detail-name">'+encode(first.name)+'</span>','id="division-detail-name">Competition</span>',"heading");
 if(neutral){
  const logo=renderDivisionLogo(first.id,"compact",finalLogos,{large:true}).replace('<div ','<div id="app-competition-badge" ');
  html=replaceExactlyOnce(html,logo,'<div class="app-competition-logo-placeholder app-competition-logo-placeholder-large" id="app-competition-badge" aria-hidden="true">—</div>',"badge");
 }
 if(!html.includes('<svg class="app-world-flag" id="app-competition-flag"'))throw Error("Missing competition flag contract");
 html=replaceExactlyOnce(html,'data-world-country="'+first.countryId+'">'+encode(country.name.en)+'</span>','id="app-competition-country" data-world-country="'+(neutral?'':first.countryId)+'">'+(neutral?'Country':encode(country.name.en))+'</span>',"country");
 const tier=first.tier===1?'divisionTier1':'divisionTier2',label=first.tier===1?'First division':'Second division';
 html=replaceExactlyOnce(html,'data-app-i18n="'+tier+'">'+label+'</span>','id="app-competition-tier" data-app-i18n="'+tier+'">'+label+'</span>',"tier");
 html=replaceExactlyOnce(html,'data-app-i18n="capacityLabel">Planned club places</dt><dd>'+first.capacity+'</dd>','data-app-i18n="capacityLabel">Planned club places</dt><dd id="app-competition-capacity">'+(neutral?'—':first.capacity)+'</dd>',"capacity");
 html=replaceExactlyOnce(html,'data-app-i18n="tierLabel">Tier</dt><dd>'+first.tier+'</dd>','data-app-i18n="tierLabel">Tier</dt><dd id="app-competition-level">'+(neutral?'—':first.tier)+'</dd>',"level");
 const match=html.match(/(<tbody>\n)([\s\S]*?)(\n\s*<\/tbody>)/);
 if(!match||!match[2].includes('data-world-club="'))throw Error("Cannot isolate shared standings rows");
 html=html.replace(match[0],match[1].replace("<tbody>","<tbody id=\"app-standings-body\">")+match[3]);
 return html;
};
// Full generated routes keep the approved Compact SVG in the initial response.
const competitionRoute = d=>{
 let html=template.replaceAll("../../","../../../");
 for(const [token,value] of Object.entries(worldPageReplacements(3,d)))html=html.replace(token,value);
 html=sharedTemplate(html,d,false);
 html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <base href="/app/competitions/'+d.id.toLowerCase()+'/">\n  <meta name="fa-division" content="'+encode(d.id)+'">');
 html=html.replace(/\s*<script src="\.\.\/\.\.\/\.\.\/assets\/(?:landing|app|app-search|competition-tabs|competition-fixtures)\.js" defer><\/script>/g,"");
 const firstPaint="(()=>{const p=new URLSearchParams(location.search),v=p.get(\"view\"),s=p.get(\"season\");document.documentElement.dataset.competitionView=[\"standings\",\"fixtures\",\"stats\",\"history\",\"rules\",\"awards\"].includes(v)?v:\"standings\";document.documentElement.dataset.competitionSeasonUnavailable=String(/^[1-9]\\d{0,8}$/.test(s||\"\")&&s!==\"1\")})();";
 return html.replace('</head>','  <script>'+firstPaint+'</script>\n  <script src="../../../assets/competition-page.js" defer></script>\n</head>');
};
const competitionManifest = {
 schemaVersion:1,approved:provisionalAssignments.approved,
 divisions:[...divisionData].sort((a,b)=>["IT","ENG","ES","DE","FR","PT","NL","BR"].indexOf(a.countryId)-["IT","ENG","ES","DE","FR","PT","NL","BR"].indexOf(b.countryId)||a.tier-b.tier).map(d=>{
  const country=countryById[d.countryId],members=provisionalClubs.get(d.id);
  if(!country||!members||members.length!==d.capacity)throw Error("Invalid competition source "+d.id);
  return {id:d.id,name:d.name,countryId:d.countryId,countryName:country.name.en,
   flagAsset:country.flagAsset,tier:d.tier,capacity:d.capacity,
   clubs:members.map(c=>({countryId:c.countryId,clubId:c.clubId,abbr:c.abbr,fullName:c.fullName,primaryName:primaryName(c)}))};
 })
};
if(competitionManifest.approved!==false)throw Error("Do not publish an approved competition allocation");
const outputPages = [
 ...Object.entries(pages).map(([name,replacements])=>({
  name,path:"app/"+name+"/index.html",depth:2,
  replacements:{...replacements,
   "@@FA_WORLD_LINK@@":worldNav("../competitions/",false),
   "@@FA_WORLD_SECTION@@":worldSection("",false)}
 })),
 {name:"competitions",path:"app/competitions/index.html",depth:2,replacements:worldPageReplacements(2)},
 {name:"competition-shared",path:"app/competitions/_shared/index.html",depth:3,
  replacements:worldPageReplacements(3,divisionData.find(d=>d.id==="IT-1")),transform:sharedTemplate},
 ...divisionData.map(division=>({
  name:division.id,path:"app/competitions/"+division.id.toLowerCase()+"/index.html",
  directContent:competitionRoute(division)
 }))
];
if(Object.keys(countryById).length!==8||divisionData.length!==16||outputPages.length!==21)
 throw Error("Division catalogue cardinality changed; review the source data");
const check = process.argv.length === 3 && process.argv[2] === "--check";
if(process.argv.length > (check ? 3 : 2))throw Error("Usage: node tools/generate-app-pages.mjs [--check]");
const writeOutput=(path,content)=>{
 const file=new URL("../"+path,import.meta.url);
 if(check){
  const current=readFileSync(file,"utf8");
  // Existing Windows checkouts may still use CRLF from before LF attributes were added.
  // Compare exact generated content except for CRLF-to-LF conversion.
  if(content!==current.replace(/\r\n/g,"\n"))
   throw Error("Generated output differs from checked-in file: "+path);
 }else{
  mkdirSync(new URL("./",file),{recursive:true});
  writeFileSync(file,content,"utf8");
 }
};
for(const page of outputPages){
 let html=page.directContent;
 if(!html){
  html=page.depth===2?template:template.replaceAll("../../","../".repeat(page.depth));
  for(const [token,value] of Object.entries(page.replacements)){
   if(!html.includes(token))throw Error("Missing template token: "+token);
   html=html.replaceAll(token,value);
  }
  if(/@@FA_(?:LINE_|WORLD_)/.test(html))throw Error("Unresolved template token in "+page.path);
  if(page.transform)html=page.transform(html);
 }
 writeOutput(page.path,html);
}
writeOutput("app/competitions/_shared/manifest.json",JSON.stringify(competitionManifest,null,2)+"\n");
if(check)console.log("Static HTML matches checked-in pages: "+outputPages.length+"/"+outputPages.length+" (3 existing + 18 Competitions), 1 competition manifest");
