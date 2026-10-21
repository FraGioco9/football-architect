// Generates checked-in static app pages from the shared shell (Node.js 22, no npm).
import {renderWorldCalendar,calendarBootstrap} from "./render-world-calendar.mjs";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {clubOutputs} from "./generate-club-pages.mjs";
import model from "../assets/competition-model.js";
import {createCompetitionRenderer} from "./render-competition-page.mjs";
import {clubCrestAssets} from "./club-crest-assets.mjs";
import {validateProvisionalAllocations} from "./validate-provisional-allocations.mjs";
import {validateDivisionAssets,renderDivisionLogo} from "./validate-division-assets.mjs";

// Normalize the source template too: Windows clones may retain CRLF from an earlier checkout.
const template = readFileSync(new URL("../templates/app-page.html", import.meta.url), "utf8").replace(/\r\n/g,"\n");
const calendarFallback = "          <div class=\"app-panel app-calendar-empty\">\n            <h2 data-app-i18n=\"calendarStatus\">Schedule not available</h2>\n            <p data-app-i18n=\"calendarStatusText\">Match scheduling has not been implemented in this app foundation. No fixtures or results are being simulated.</p>\n            <a class=\"app-link app-link-secondary\" href=\"/dashboard\" data-app-i18n=\"backDashboard\">Back to Dashboard</a>\n          </div>";
const pages = {
  "dashboard": {
    "@@FA_LINE_008@@": "  <title>Dashboard — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-dashboard\" href=\"/dashboard\" data-app-view=\"dashboard\" aria-current=\"page\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"/calendar\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"/settings\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\">",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_CALENDAR_BODY@@": calendarFallback,
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "calendar": {
    "@@FA_LINE_008@@": "  <title>Calendar — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"/dashboard\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-calendar\" href=\"/calendar\" data-app-view=\"calendar\" aria-current=\"page\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link\" id=\"app-nav-settings\" href=\"/settings\" data-app-view=\"settings\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\">",
    "@@FA_CALENDAR_BODY@@": renderWorldCalendar(),
    "@@FA_LINE_107@@": "        <section id=\"app-settings\" class=\"app-view app-settings-view\" aria-labelledby=\"settings-title\" hidden>"
  },
  "settings": {
    "@@FA_LINE_008@@": "  <title>Settings — Football Architect</title>",
    "@@FA_LINE_032@@": "            <a class=\"fa-shell-link\" id=\"app-nav-dashboard\" href=\"/dashboard\" data-app-view=\"dashboard\" aria-label=\"Dashboard\" data-app-aria=\"dashboard\">",
    "@@FA_LINE_036@@": "            <a class=\"fa-shell-link\" id=\"app-nav-calendar\" href=\"/calendar\" data-app-view=\"calendar\" aria-label=\"Calendar\" data-app-aria=\"calendar\">",
    "@@FA_LINE_044@@": "            <a class=\"fa-shell-link is-active\" id=\"app-nav-settings\" href=\"/settings\" data-app-view=\"settings\" aria-current=\"page\" aria-label=\"Settings\" data-app-aria=\"settings\">",
    "@@FA_LINE_077@@": "        <section id=\"app-dashboard\" class=\"app-view\" aria-labelledby=\"dashboard-title\" hidden>",
    "@@FA_LINE_099@@": "        <section id=\"app-calendar\" class=\"app-view\" aria-labelledby=\"calendar-title\" hidden>",
    "@@FA_CALENDAR_BODY@@": calendarFallback,
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
 const svg=readFileSync(new URL("../"+country.flagAsset,import.meta.url),"utf8").replace(/\r\n/g,"\n").trim();
 if(!svg.startsWith("<svg ") || !svg.endsWith("</svg>"))throw Error("Invalid inline flag "+code);
 return '<span class="app-world-flag-frame" aria-hidden="true">'+svg.replace("<svg ",'<svg class="app-world-flag" '+(id?'id="'+id+'" ':"")+'aria-hidden="true" focusable="false" width="24" height="16" ')+"</span>";
};
const indexContent = function indexContent(){
 const displayCountryOrder=["IT","ENG","ES","DE","FR","PT","NL","BR"];
 const cards=displayCountryOrder.map(id=>countryById[id]).map(c=>{
  const links=divisionData.filter(d=>d.countryId===c.id).map(d=>
 '                <a class="app-division-card" href="/competitions/'+d.id.toLowerCase()+'/standings?season=1">'+renderDivisionLogo(d.id,"compact",finalLogos)+'<span class="app-division-card-copy"><strong>'+encode(d.name)+'</strong><small data-app-i18n="'+(d.tier===1?'divisionTier1':'divisionTier2')+'">'+(d.tier===1?'First division':'Second division')+'</small></span></a>'
 ).join("\n");
 return '            <section class="app-world-country" aria-labelledby="world-country-'+c.id.toLowerCase()+'">\n'+
 '              <h2 id="world-country-'+c.id.toLowerCase()+'">'+inlineCountryFlag(c)+' <span data-world-country="'+c.id+'">'+encode(c.name.en)+'</span></h2>\n'+
 '              <div class="app-world-grid">\n'+links+'\n              </div>\n            </section>';
 }).join("\n");
 return '          <div class="app-world-countries" id="domestic">\n'+cards+'\n          </div>\n          <section id="international" class="app-panel" aria-label="International competitions"><h2>International competitions</h2><p>International competition pages are being prepared.</p></section>';
};
const detailContent=createCompetitionRenderer({countryById,encode,inlineCountryFlag,
 renderLogo:d=>renderDivisionLogo(d.id,"compact",finalLogos,{large:true}).replace('<div ','<div id="app-competition-badge" ')});
const worldPageReplacements = (division = null, neutral = false) => {
  const title = division ? (neutral?"Competition":division.name) : "Competitions";
  return {
    "@@FA_LINE_008@@": "  <title>" + encode(title) + " — Football Architect</title>",
    "@@FA_LINE_032@@": '            <a class="fa-shell-link" id="app-nav-dashboard" href="/dashboard" data-app-view="dashboard" aria-label="Dashboard" data-app-aria="dashboard">',
    "@@FA_LINE_036@@": '            <a class="fa-shell-link" id="app-nav-calendar" href="/calendar" data-app-view="calendar" aria-label="Calendar" data-app-aria="calendar">',
    "@@FA_LINE_044@@": '            <a class="fa-shell-link" id="app-nav-settings" href="/settings" data-app-view="settings" aria-label="Settings" data-app-aria="settings">',
    "@@FA_LINE_077@@": '        <section id="app-dashboard" class="app-view" aria-labelledby="dashboard-title" hidden>',
    "@@FA_LINE_099@@": '        <section id="app-calendar" class="app-view" aria-labelledby="calendar-title" hidden>',
    "@@FA_CALENDAR_BODY@@": calendarFallback,
    "@@FA_LINE_107@@": '        <section id="app-settings" class="app-view app-settings-view" aria-labelledby="settings-title" hidden>',
    "@@FA_WORLD_LINK@@": worldNav("/competitions", true),
    "@@FA_WORLD_SECTION@@": worldSection(division ? detailContent(division,neutral) : indexContent(), true,division)
  };
};
// Full generated routes keep the approved Compact SVG in the initial response.
const competitionRoute = d=>{
 let html=template;
 for(const [token,value] of Object.entries(worldPageReplacements(d)))html=html.replace(token,value);
 html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <base href="/competitions/'+d.id.toLowerCase()+'/">\n  <meta name="fa-division" content="'+encode(d.id)+'">');
 html=html.replace(/\s*<script src="\/assets\/(?:landing|app|app-search|competition-tabs|competition-history|competition-fixtures)\.js" defer><\/script>/g,"");
 const firstPaint="(()=>{const p=new URLSearchParams(location.search),v=location.pathname.split(\"/\").filter(Boolean).at(-1),s=p.get(\"season\");document.documentElement.dataset.competitionView="+JSON.stringify(model.views.map(view=>view.id))+".includes(v)?v:\"standings\";document.documentElement.dataset.competitionSeasonUnavailable=String(/^[1-9]\\d{0,8}$/.test(s||\"\")&&s!==\"1\")})();";
 return html.replace('</head>','  <script>'+firstPaint+'</script>\n  <script src="/assets/competition-model.js" defer></script>\n  <script src="/assets/competition-page.js" defer></script>\n</head>');
};
const competitionManifest = {
 schemaVersion:1,approved:provisionalAssignments.approved,profile:model.profile,clubCrests:clubCrestAssets().catalog,
 divisions:[...divisionData].sort((a,b)=>model.countries.indexOf(a.countryId)-model.countries.indexOf(b.countryId)||a.tier-b.tier).map(d=>{
  const country=countryById[d.countryId],members=provisionalClubs.get(d.id);
  if(!country||!members||members.length!==d.capacity)throw Error("Invalid competition source "+d.id);
  return {id:d.id,name:d.name,countryId:d.countryId,countryName:country.name.en,
   flagAsset:country.flagAsset,tier:d.tier,capacity:d.capacity,
   clubs:members.map(c=>({countryId:c.countryId,clubId:c.clubId,abbr:c.abbr,fullName:c.fullName,primaryName:primaryName(c),stadiumName:c.stadiumName}))};
 })
};
if(!model.validManifest(competitionManifest))throw Error("Invalid shared competition manifest");
const outputPages = [
 ...Object.entries(pages).map(([name,replacements])=>({
  name,path:name+"/index.html",
  replacements:{...replacements,
   "@@FA_WORLD_LINK@@":worldNav("/competitions",false),
   "@@FA_WORLD_SECTION@@":worldSection("",false)}
 })),
 {name:"competitions",path:"competitions/index.html",replacements:worldPageReplacements()},
 {name:"competition-shared",path:"competitions/_shared/index.html",
  replacements:worldPageReplacements(divisionData.find(d=>d.id==="IT-1"),true)},
 ...divisionData.map(division=>({
  name:division.id,path:"competitions/"+division.id.toLowerCase()+"/index.html",
  directContent:competitionRoute(division)
 }))
];
if(Object.keys(countryById).length!==8||divisionData.length!==model.divisionCount||outputPages.length!==21)
 throw Error("Division catalogue cardinality changed; review the source data");
const check = process.argv.length === 3 && process.argv[2] === "--check";
if(process.argv.length > (check ? 3 : 2))throw Error("Usage: node tools/generate-app-pages.mjs [--check]");
const normalizeRouteLinks=(html,path)=>{
 const directory=path==="index.html"?"/":"/"+path.slice(0,-"index.html".length);
 const base="https://fa.invalid"+directory;
 return html.replace(/(<(?:a|link|script|img)\b[^>]*\b(?:href|src)=)(["'])([^"']+)\2/g,(all,prefix,q,href)=>{
  if(href.startsWith("//")||/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith("#"))return all;
  const url=new URL(href,base);let pathname=url.pathname;
  if(pathname!=="/"&&!/\.[a-z0-9]+$/i.test(pathname))pathname=pathname.replace(/\/+$/,"");
  return prefix+q+pathname+url.search+url.hash+q;
 });
};
const writeOutput=(path,content)=>{
 if(path.endsWith(".html")&&!content.includes("/assets/sidebar-evolution.js"))content=content.replace("</head>","  <link rel=\"stylesheet\" href=\"/assets/sidebar-evolution.css\">\n  <script src=\"/assets/sidebar-evolution.js\" defer></script>\n"+"</head>");
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
  html=template;
  for(const [token,value] of Object.entries(page.replacements)){
   if(!html.includes(token))throw Error("Missing template token: "+token);
   html=html.replaceAll(token,value);
  }
  if(/@@FA_(?:LINE_|WORLD_|CALENDAR_)/.test(html))throw Error("Unresolved template token in "+page.path);
  if(page.name==="competition-shared")html=html.replace('<script src="/assets/landing.js"','<script src="/assets/competition-model.js" defer></script>\n  <script src="/assets/landing.js"');
 }
 if(page.name==="calendar")html=html.replace('<h1 class="app-page-title" id="calendar-title" data-app-i18n="calendar">Calendar</h1>','<h1 class="app-page-title" id="calendar-title" data-app-i18n="calendar">Calendar</h1>\n          '+"<div class=\"calendar-season-picker app-competition-season\"><span id=\"calendar-season-label\">Season</span><div class=\"language-control\" id=\"calendar-season-control\"><button type=\"button\" id=\"calendar-season-picker\" class=\"language-trigger\" role=\"combobox\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-controls=\"calendar-season-menu\" aria-labelledby=\"calendar-season-label calendar-season-value\"><span id=\"calendar-season-value\">1</span><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></button><div id=\"calendar-season-menu\" class=\"language-menu\" role=\"listbox\" aria-labelledby=\"calendar-season-label\" hidden></div></div></div>"+"\n          "+"<script data-calendar-season-first-paint>(()=>{const n=document.documentElement.dataset.calendarSeason||'1';const value=document.getElementById('calendar-season-value');if(value)value.textContent=n})();</script>") ;
 if(page.name==="calendar")html=html.replace('  <script src="/assets/theme.js">','  <script data-calendar-bootstrap>'+calendarBootstrap+'</script>\n  <script src="/assets/theme.js">').replace('</head>','  <script src="/assets/world-calendar-model.js" defer></script>\n  <script src="/assets/world-clock-adapter.js" defer></script>\n  <script src="/assets/world-calendar.js" defer></script>\n  <script src="/assets/calendar-simplified.js" defer></script>\n  <style data-calendar-critical>html:has(#world-calendar) #world-calendar>.calendar-heading,html:has(#world-calendar) #world-calendar>.calendar-clock,html:has(#world-calendar) #world-calendar>.calendar-filterbar,html:has(#world-calendar) #world-calendar>.calendar-details,html:has(#world-calendar) #world-calendar>.calendar-selected,html:has(#world-calendar) #world-calendar>.calendar-note,html:has(#world-calendar) #world-calendar>.calendar-key{display:none!important}</style>\n</head>');
 writeOutput(page.path,normalizeRouteLinks(html,page.path));
}
for(const output of clubOutputs({template,replacements:worldPageReplacements(),clubs:clubData,divisions:divisionData,allocations:provisionalAssignments}))
 writeOutput(output.path,output.path.endsWith(".html")?normalizeRouteLinks(output.content,output.path):output.content);
// NAV-01B: produce directory from the same canonical generated competitions shell.
{
 const file=new URL("../competitions/index.html",import.meta.url);
 const source=readFileSync(file,"utf8").replace(/\\r\\n/g,"\\n");
 const begin=source.indexOf('<section id="app-divisions"');
 const finish=source.indexOf("\n      </main>",begin);
 if(begin<0||finish<0)throw Error("Clubs source shell missing");
 const content="<section id=\"app-divisions\" class=\"app-view nav01-directory\" aria-labelledby=\"nav01-title\"><div id=\"nav01-clubs\"><h1 id=\"nav01-title\" class=\"app-page-title\">Clubs</h1><div class=\"nav01-filters\"><input type=\"search\" aria-label=\"Search clubs\"><select aria-label=\"Country\"><option value=\"\">All countries</option></select><select aria-label=\"Division\"><option value=\"\">All divisions</option></select><select aria-label=\"Status\"><option value=\"\">All clubs</option><option value=\"active\">Active</option><option value=\"inactive\">Inactive</option></select></div><p class=\"nav01-count\" aria-live=\"polite\"></p><div class=\"nav01-grid\"></div></div></section>";
 let html=source.slice(0,begin)+content+source.slice(finish);
 html=html.replace("<title>Competitions — Football Architect</title>","<title>Clubs — Football Architect</title>");
 html=html.replace('  <link rel="stylesheet" href="/assets/sidebar-evolution.css">', "  <link rel=\"stylesheet\" href=\"/assets/clubs-directory.css\">\n  <script src=\"/assets/clubs-directory.js\" defer></script>\n  <link rel=\"stylesheet\" href=\"/assets/sidebar-evolution.css\">");
 writeOutput("clubs/index.html",html);
}
writeOutput("competitions/_shared/manifest.json",JSON.stringify(competitionManifest,null,2)+"\n");
if(check)console.log("Static HTML matches checked-in pages: "+outputPages.length+"/"+outputPages.length+" (3 existing + 18 Competitions), 1 competition manifest, 1 club template and 1 club manifest");
