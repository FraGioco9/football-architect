// Generates checked-in static app pages from the shared shell (Node.js 22, no npm).
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {validateProvisionalAllocations} from "./validate-provisional-allocations.mjs";

const template = readFileSync(new URL("../templates/app-page.html", import.meta.url), "utf8");
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

const divisionData = JSON.parse(readFileSync(new URL("../data/divisions.json", import.meta.url), "utf8"));
const clubData = JSON.parse(readFileSync(new URL("../data/clubs.json", import.meta.url), "utf8"));
if (!Array.isArray(clubData.clubs) || clubData.clubs.length !== 320) throw new Error("Expected 320 canonical club identities");
const provisionalAssignments = JSON.parse(readFileSync(new URL("../data/division-allocations.provisional.json", import.meta.url), "utf8"));
const {byDivision:provisionalClubs} = validateProvisionalAllocations(provisionalAssignments,divisionData,clubData);
const encode = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const countryById = Object.fromEntries(divisionData.countries.map(country => [country.id,country]));
const worldNav = function worldNav(href,active){
 return '            <a class="fa-shell-link'+(active?' is-active':'')+'" id="app-nav-divisions" href="'+href+'" data-app-view="divisions"'+(active?' aria-current="page"':'')+' aria-label="Competitions" data-app-aria="navCompetitions">';
};
const worldSection = function worldSection(content,active,division=null){
 const h=division ? '' : '          <h1 class="app-page-title" id="divisions-title" data-app-i18n="navCompetitions">Competitions</h1>\n';
 return '        <section id="app-divisions" class="app-view app-world-view" aria-labelledby="divisions-title"'+(active?'':' hidden')+'>\n'+h+(content?content+'\n':'')+'        </section>';
};
const indexContent = function indexContent(root){
 const cards=divisionData.countries.map(c=>{
  const links=divisionData.divisions.filter(d=>d.countryId===c.id).map(d=>
 '                <a class="app-division-card" href="./'+d.id.toLowerCase()+'/"><span class="app-competition-logo-placeholder" aria-hidden="true">'+encode(d.id)+'</span><span class="app-division-card-copy"><strong>'+encode(d.name)+'</strong><small data-app-i18n="'+(d.tier===1?'divisionTier1':'divisionTier2')+'">'+(d.tier===1?'First division':'Second division')+'</small></span></a>'
 ).join("\n");
 return '            <section class="app-world-country" aria-labelledby="world-country-'+c.id.toLowerCase()+'">\n'+
 '              <h2 id="world-country-'+c.id.toLowerCase()+'"><img class="app-world-flag" alt="" src="'+root+encode(c.flagAsset)+'" width="28" height="20"> <span data-world-country="'+c.id+'">'+encode(c.name.en)+'</span></h2>\n'+
 '              <div class="app-world-grid">\n'+links+'\n              </div>\n            </section>';
 }).join("\n");
 return '          <div class="app-world-countries">\n'+cards+'\n          </div>';
};
const detailAppend = function detailAppend(d){
 const cs=provisionalClubs.get(d.id);
 if(!cs||cs.length!==d.capacity)throw Error("missing clubs "+d.id);
 const cols=[["standingsPosition","Pos"],["standingsClub","Club"],["standingsPlayed","P"],["standingsPoints","Pts"]]
 .map(([key,label],i)=>'                  <th scope="col"'+(i===1?' class="app-world-standing-name-head"':'')+' data-app-i18n="'+key+'">'+label+'</th>').join("\n");
 const rows=cs.map(c=>`                <tr data-world-club="${encode(c.countryId)}-${c.clubId}">
                  <td class="app-world-stat-unknown">—</td>
                  <th scope="row" class="app-world-standing-club"><span class="app-world-club-code" aria-hidden="true">${encode(c.abbr)}</span><span class="app-world-club-name">${encode(c.fullName)}</span></th>
                  <td class="app-world-stat-unknown">—</td>
                  <td class="app-world-stat-unknown">—</td>
                </tr>`).join("\n");
 return `
          <section class="app-world-standings" aria-labelledby="division-standings-heading">
            <div class="app-world-standings-heading">
              <h2 id="division-standings-heading" data-app-i18n="standingsHeading">Standings</h2>
              <span class="app-world-standings-count">${cs.length} / ${d.capacity}</span>
            </div>
            <p class="app-world-standings-note" data-app-i18n="standingsEmpty">Provisional clubs. No standings until a season begins.</p>
            <table class="app-world-standing-table">
              <caption class="sr-only" data-app-i18n="standingsCaption">Provisional club list; no active league standings yet.</caption>
              <thead>
                <tr>
${cols}
                </tr>
              </thead>
              <tbody>
${rows}
              </tbody>
            </table>
          </section>`;
};
const detailContent = function detailContent(d,root){
 const c=countryById[d.countryId];
 if(!c)throw Error("unknown detail "+d.id);
 const level=d.tier===1?"divisionTier1":"divisionTier2";
 return '          <header class="app-competition-header">\n'+
 '            <span class="app-competition-logo-placeholder app-competition-logo-placeholder-large" role="img" aria-label="Temporary division badge" data-app-aria="crestPlaceholder">'+encode(d.id)+'</span>\n'+
 '            <div class="app-competition-identity">\n'+
 '              <h1 class="app-page-title" id="divisions-title"><span id="division-detail-name">'+encode(d.name)+'</span></h1>\n'+
 '              <div class="app-world-detail-meta"><img class="app-world-flag" alt="" src="'+root+encode(c.flagAsset)+'" width="28" height="20"> <span data-world-country="'+d.countryId+'">'+encode(c.name.en)+'</span><span aria-hidden="true">·</span> <span data-app-i18n="'+level+'">'+(d.tier===1?'First division':'Second division')+'</span></div>\n'+
 '            </div>\n'+
 '            <a class="app-competition-return app-link app-link-secondary" href="../" data-app-i18n="allDivisions">All competitions</a>\n'+
 '          </header>\n'+detailAppend(d);
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
const outputPages = [
  ...Object.entries(pages).map(([name,replacements]) => ({
    name, path: "app/" + name + "/index.html", depth:2,
    replacements:{...replacements,
      "@@FA_WORLD_LINK@@":worldNav("../world/competitions/",false),
      "@@FA_WORLD_SECTION@@":worldSection("",false)}
  })),
  {name:"competitions",path:"app/world/competitions/index.html",depth:3,replacements:worldPageReplacements(3)},
  ...divisionData.divisions.map(division => ({
    name:division.id, path:"app/world/competitions/" + division.id.toLowerCase() + "/index.html",
    depth:4, replacements:worldPageReplacements(4,division)
  }))
];
if (divisionData.countries.length !== 8 || divisionData.divisions.length !== 16 || outputPages.length !== 20)
  throw new Error("Division catalogue cardinality changed; review the source data");
const check = process.argv.length === 3 && process.argv[2] === "--check";
if (process.argv.length > (check ? 3 : 2)) throw new Error("Usage: node tools/generate-app-pages.mjs [--check]");
for (const page of outputPages) {
  // The base template refers to root files using ../../ (two levels from app/*/).
  // Adjust those references before injecting the page-specific app routes and content.
  let html = page.depth === 2 ? template : template.replaceAll("../../", "../".repeat(page.depth));
  for (const [token, value] of Object.entries(page.replacements)) {
    if (!html.includes(token)) throw new Error("Missing template token: " + token);
    html = html.replaceAll(token,value);
  }
  if (/@@FA_(?:LINE_|WORLD_)/.test(html)) throw new Error("Unresolved template token in " + page.path);
  const file = new URL("../" + page.path, import.meta.url);
  if (check) {
    const current = readFileSync(file,"utf8");
    if (Buffer.compare(Buffer.from(html,"utf8"),Buffer.from(current,"utf8")) !== 0)
      throw new Error("Generated HTML differs from checked-in file: " + page.path);
  } else {
    mkdirSync(new URL("./", file),{recursive:true});
    writeFileSync(file,html,"utf8");
  }
}
if (check) console.log("Static HTML matches checked-in pages: " + outputPages.length + "/" + outputPages.length + " (3 existing + 17 World)");
