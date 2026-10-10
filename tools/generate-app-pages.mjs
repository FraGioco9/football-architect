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
const worldNav = (href, active) => '            <a class="fa-shell-link' + (active ? ' is-active' : '') +
  '" id="app-nav-divisions" href="' + href + '" data-app-view="divisions"' +
  (active ? ' aria-current="page"' : '') + ' aria-label="Competitions" data-app-aria="navCompetitions">';
const worldSection = (content, active) => '        <section id="app-divisions" class="app-view app-world-view" aria-labelledby="divisions-title"' +
  (active ? '' : ' hidden') + '>\n' +
  '          <h1 class="app-page-title" id="divisions-title" data-app-i18n="divisions">Divisions</h1>\n' +
  (content ? content + '\n' : '') + '        </section>';
const indexContent = root => {
  const countries = divisionData.countries.map(country => {
    const divisions = divisionData.divisions.filter(division => division.countryId === country.id);
    const cards = divisions.map(division =>
      '                <a class="app-division-card" href="./' + division.id.toLowerCase() + '/">\n' +
      '                  <span class="app-division-mark" aria-hidden="true">' + encode(division.id) + '</span>\n' +
      '                  <span class="app-division-card-copy"><strong>' + encode(division.name) +
      '</strong><small data-app-i18n="' + (division.tier === 1 ? 'divisionTier1' : 'divisionTier2') + '">' +
      (division.tier === 1 ? 'First division' : 'Second division') + '</small></span>\n' +
      '                  <svg class="fa-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg>\n' +
      '                </a>').join("\n");
    return '            <section class="app-world-country" aria-labelledby="world-country-' + country.id.toLowerCase() + '">\n' +
      '              <h2 id="world-country-' + country.id.toLowerCase() + '"><img class="app-world-flag" alt="" src="' +
      root + encode(country.flagAsset) + '" width="28" height="20"> <span data-world-country="' + country.id + '">' +
      encode(country.name.en) + '</span></h2>\n              <div class="app-world-grid">\n' + cards +
      '\n              </div>\n            </section>';
  }).join("\n");
  return '          <div class="app-world-countries">\n' + countries + '\n          </div>';
};
const detailAppend = function newAppend(d) {
 const other=divisionData.divisions.find(x=>x.countryId===d.countryId&&x.id!==d.id);
 if(!other)throw new Error("Missing counterpart "+d.id);
 const otherTier=other.tier===1?"divisionTier1":"divisionTier2";
 const clubs=provisionalClubs.get(d.id);
 if(!clubs)throw new Error("Missing provisional allocation "+d.id);
 if(clubs.length!==d.capacity||new Set(clubs.map(c=>c.clubId)).size!==d.capacity)throw new Error("Incomplete initial allocation "+d.id);
 const headers=[["standingsPosition","Pos"],["standingsClub","Club"],["standingsPlayed","P"],["standingsWon","W"],["standingsDrawn","D"],["standingsLost","L"],["standingsFor","GF"],["standingsAgainst","GA"],["standingsDifference","GD"],["standingsPoints","Pts"]].map(([key,value],index)=>'                  <th scope="col"'+(index===1?' class="app-world-standing-name-head"':'')+' data-app-i18n="'+key+'">'+value+'</th>').join("\n");
 const rows=clubs.map(c=>`                <tr data-world-club="${encode(c.countryId)}-${c.clubId}">
                  <td class="app-world-stat-unknown">—</td>
                  <th scope="row" class="app-world-standing-club"><span class="app-world-club-code" aria-hidden="true">${encode(c.abbr)}</span><span class="app-world-club-name">${encode(c.fullName)}</span></th>${Array(8).fill('\n                  <td class="app-world-stat-unknown">—</td>').join("")}
                </tr>`).join("\n");
 return `
          <nav class="app-world-related" aria-label="Other division in this country" data-app-aria="relatedDivisions">
            <span data-app-i18n="otherDivision">Other division in this country</span>
            <a href="../${other.id.toLowerCase()}/"><strong>${encode(other.name)}</strong><span data-app-i18n="${otherTier}">${other.tier===1?"First division":"Second division"}</span></a>
          </nav>
          <div class="app-world-sections">
            <section class="app-panel app-world-section app-world-standings" aria-labelledby="division-standings-heading">
              <div class="app-world-standings-heading">
                <h2 id="division-standings-heading" data-app-i18n="standingsHeading">Standings</h2>
                <span class="app-world-standings-count">${clubs.length} / ${d.capacity}</span>
              </div>
              <p class="app-world-standings-note" data-app-i18n="standingsEmpty">Provisional initial allocation, shown in registry order. Positions and match statistics are not available before the season begins.</p>
              <table class="app-world-standing-table">
                <caption class="sr-only" data-app-i18n="standingsCaption">Provisional club list; no active league standings yet.</caption>
                <thead>
                  <tr>
${headers}
                  </tr>
                </thead>
                <tbody>
${rows}
                </tbody>
              </table>
            </section>
            <section class="app-panel app-world-section" aria-labelledby="division-fixtures-heading">
              <h2 id="division-fixtures-heading" data-app-i18n="fixturesHeading">Fixtures and results</h2>
              <p class="app-world-section-empty" data-app-i18n="fixturesEmpty">No scheduled matches or results are available.</p>
            </section>
            <section class="app-panel app-world-section" aria-labelledby="division-clubs-heading">
              <h2 id="division-clubs-heading" data-app-i18n="clubsHeading">Participating clubs</h2>
              <p class="app-world-section-empty" data-app-i18n="clubsEmpty">The 20 clubs listed above represent a provisional allocation, not confirmed season participation.</p>
            </section>
          </div>`;
};
const detailContent = (division, root) => {
  const country = countryById[division.countryId];
  if (!country) throw new Error("Unknown division country: " + division.countryId);
  const level = division.tier === 1 ? "divisionTier1" : "divisionTier2";
  return '          <p class="app-world-back"><a href="../" data-app-i18n="allDivisions">All divisions</a></p>\n' +
    '          <div class="app-panel app-world-hero">\n' +
    '            <span class="app-division-mark app-division-mark-large" role="img" aria-label="Temporary division placeholder" data-app-aria="crestPlaceholder">' + encode(division.id) + '</span>\n' +
    '            <div class="app-world-hero-copy">\n' +
    '              <p class="app-world-meta"><img class="app-world-flag" alt="" src="' + root + encode(country.flagAsset) +
    '" width="28" height="20"> <span data-world-country="' + division.countryId + '">' + encode(country.name.en) +
    '</span> · <span data-app-i18n="' + level + '">' +
    (division.tier === 1 ? "First division" : "Second division") + '</span></p>\n' +
    '              <h2 id="division-detail-name">' + encode(division.name) + '</h2>\n' +
    '            </div>\n          </div>\n' +
    '          <dl class="app-world-facts">\n' +
    '            <div><dt data-app-i18n="countryLabel">Country</dt><dd data-world-country="' + division.countryId + '">' + encode(country.name.en) + '</dd></div>\n' +
    '            <div><dt data-app-i18n="tierLabel">Tier</dt><dd>' + division.tier + '</dd></div>\n' +
    '            <div><dt data-app-i18n="capacityLabel">Planned club places</dt><dd>' + division.capacity + '</dd></div>\n' +
    '          </dl>\n' +
    '          <section class="app-panel app-world-empty">\n' +
    '            <h2 data-app-i18n="competitionUnavailable">Competition not active</h2>\n' +
    '            <p data-app-i18n="competitionNotice">No active season: league positions, fixtures and results are not available.</p>\n' +
    '          </section>' + detailAppend(division);
};
const worldPageReplacements = (depth, division = null) => {
  const upToApp = "../".repeat(depth - 1);
  const root = "../".repeat(depth);
  const title = division ? division.name : "Divisions";
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
    "@@FA_WORLD_SECTION@@": worldSection(division ? detailContent(division,root) : indexContent(root), true)
  };
};
const outputPages = [
  ...Object.entries(pages).map(([name,replacements]) => ({
    name, path: "app/" + name + "/index.html", depth:2,
    replacements:{...replacements,
      "@@FA_WORLD_LINK@@":worldNav("../world/divisions/",false),
      "@@FA_WORLD_SECTION@@":worldSection("",false)}
  })),
  {name:"divisions",path:"app/world/divisions/index.html",depth:3,replacements:worldPageReplacements(3)},
  ...divisionData.divisions.map(division => ({
    name:division.id, path:"app/world/divisions/" + division.id.toLowerCase() + "/index.html",
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
