import {loadSeasonOnePreview} from './load-season-one-preview.mjs';
import {renderAdminSettings,renderAdminPlayers} from './render-admin-settings.mjs';
// Generates checked-in static app pages from the shared shell (Node.js 22, no npm).
import {renderWorldCalendar,calendarBootstrap} from "./render-world-calendar.mjs";
import {buildRoute} from "../assets/routes-registry.mjs";
import {renderSidebar} from "./render-sidebar.mjs";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {clubOutputs} from "./generate-club-pages.mjs";
import {loadWorldCatalog} from "./load-world-catalog.mjs";
import model from "../assets/competition-model.js";
import {loadCompetitionCatalogue} from "./competition-catalogue.mjs";
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
const worldCatalog = loadWorldCatalog();
const divisionData = worldCatalog.divisions;
const clubData = worldCatalog.clubs;
if (!Array.isArray(clubData) || clubData.length !== 320) throw new Error("Expected 320 canonical club identities");
const provisionalAssignments = loadSeasonOnePreview();
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
 const match=svg.match(/viewBox="([^"]+)"/);
 if(!match)throw Error("Missing flag viewBox "+code);
 const originalViewBox=match[1];
 // Nested viewport scales the native paths to a real 5:4 silhouette.
 // Keep original SVG defs and masks inside their own coordinate system.
 const inner=svg.slice(svg.indexOf(">")+1,svg.lastIndexOf("</svg>")).replace(/(<mask\b[^>]*>\s*<rect\b[^>]*?)\s+rx="[^"]+"\s+ry="[^"]+"/,'$1 rx="0" ry="0"')
  .replace(/(?:ns1|xlink):href=/g,'href=')
  .replace(/id="([^"]+)"/g,(_,id)=>'id="fa-'+code+'-'+id+'"')
  .replace(/url\(#([^)]+)\)/g,(_,id)=>'url(#fa-'+code+'-'+id+')')
  .replace(/href="#([^"]+)"/g,(_,id)=>'href="#fa-'+code+'-'+id+'"');
 const identity=(id?'id="'+id+'" ':"");
 return '<span class="app-world-flag-frame" aria-hidden="true">'+
  '<svg class="app-world-flag" '+identity+'aria-hidden="true" focusable="false" width="25" height="20" viewBox="0 0 5 4" xmlns="http://www.w3.org/2000/svg">'+
  '<defs><clipPath id="fa-competition-flag-'+code+'"><rect width="5" height="4" rx="0.625" ry="0.625"/></clipPath></defs>'+
  '<g clip-path="url(#fa-competition-flag-'+code+')"><svg x="0" y="0" width="5" height="4" viewBox="'+originalViewBox+'" preserveAspectRatio="none">'+inner+'</svg></g></svg></span>';
};
const indexContent = function indexContent(){
 const displayCountryOrder=["IT","ENG","ES","DE","FR","PT","NL","BR"];
 const cards=displayCountryOrder.map(id=>countryById[id]).map(c=>{
  const links=divisionData.filter(d=>d.countryId===c.id).map(d=>
 '                <a class="app-division-card" href="'+buildRoute({kind:"competition",id:d.id.toLowerCase(),view:"standings"})+'?season=1">'+renderDivisionLogo(d.id,"compact",finalLogos)+'<span class="app-division-card-copy"><strong>'+encode(d.name)+'</strong><small data-app-i18n="'+(d.tier===1?'divisionTier1':'divisionTier2')+'">'+(d.tier===1?'First division':'Second division')+'</small></span></a>'
 ).join("\n");
 return '            <section class="app-world-country" aria-labelledby="world-country-'+c.id.toLowerCase()+'">\n'+
 '              <h2 id="world-country-'+c.id.toLowerCase()+'">'+inlineCountryFlag(c)+' <span data-world-country="'+c.id+'">'+encode(c.name.en)+'</span></h2>\n'+
 '              <div class="app-world-grid">\n'+links+'\n              </div>\n            </section>';
 }).join("\n");
 return '          <section id="domestic" class="nav01-competition-section" aria-labelledby="domestic-heading"><h2 id="domestic-heading" data-nav01-section="1">Domestic</h2>\n          <div class="app-world-countries">\n'+cards+'\n          </div></section>\n          <section id="international" class="nav01-competition-section" aria-labelledby="international-heading"><h2 id="international-heading" data-nav01-section="2">International</h2>'+internationalIndexCards+'</section>';
};
const detailContent=createCompetitionRenderer({countryById,encode,inlineCountryFlag,clubsByDivision:provisionalClubs,crestCatalog:clubCrestAssets().catalog,
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
// Keep static competition tabs in the initial parse path, before hidden pages and
// inline division crests. Flex order retains header -> tabs -> panels visually.
const frontloadCompetitionShell=(source,id)=>{
 const sectionMarker='        <section id="app-divisions" class="app-view app-world-view" aria-labelledby="divisions-title">';
 const mainMarker='<main class="app-main" id="main-content" tabindex="-1">';
 const sectionStart=source.indexOf(sectionMarker);
 const tabsStart=source.indexOf('          <div class="app-competition-tabs" role="tablist"',sectionStart);
 const scriptStart=source.indexOf('          <script>(()=>{const view=document.documentElement.dataset.competitionView',tabsStart);
 // SAF-02: move both parser-time scripts with their static tab strip.
 const initialScrollStart=source.indexOf('          <script data-fa-competition-tabs-scroll-first-paint>',scriptStart);
 const scriptEnd=source.indexOf('</script>',initialScrollStart);
 if([sectionStart,tabsStart,scriptStart,initialScrollStart,scriptEnd].some(n=>n<0))throw Error('Missing static competition controls: '+id);
 const tabShell=source.slice(tabsStart,scriptEnd+'</script>'.length);
 let html=source.slice(0,tabsStart)+source.slice(scriptEnd+'</script>'.length);
 const sectionBody=html.indexOf(sectionMarker)+sectionMarker.length;
 html=html.slice(0,sectionBody)+'\n'+tabShell+'\n'+html.slice(sectionBody);
 const sectionBegin=html.indexOf(sectionMarker);
 const sectionEnd=html.indexOf('        </section>\n      </main>',sectionBegin);
 if(sectionEnd<0)throw Error('Missing competition section boundary: '+id);
 const sectionClose='        </section>';
 const section=html.slice(sectionBegin,sectionEnd+sectionClose.length);
 html=html.slice(0,sectionBegin)+html.slice(sectionEnd+sectionClose.length);
 const mainStart=html.indexOf(mainMarker);
 if(mainStart<0)throw Error('Missing main element: '+id);
 const insertion=mainStart+mainMarker.length;
 let result=html.slice(0,insertion)+'\n'+section+'\n'+html.slice(insertion);
 const headerStart=result.indexOf('          <header class="app-competition-header">',insertion);
 const headerEnd=result.indexOf('          </header>',headerStart);
 if(headerStart<0||headerEnd<0)throw Error('Missing static competition header: '+id);
 const readyAt=headerEnd+'          </header>'.length;
 return result.slice(0,readyAt)+'\n          <script data-fa-competition-first-paint-ready>if(!["standings","postseason","fixtures","stats","history","awards"].includes(document.documentElement.dataset.competitionView))document.documentElement.removeAttribute("data-fa-competition-prepaint");</script>'+result.slice(readyAt);
};
const competitionShellCss='<style data-fa-competition-shell>html[data-fa-competition-prepaint]:not([data-competition-view=\"history\"]) body{visibility:hidden}#app-divisions{display:flex;flex-direction:column}#app-divisions>.app-competition-header{order:0}#app-divisions>#app-competition-season-unavailable{order:0}#app-divisions>.app-competition-tabs{order:1;display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;margin-top:var(--app-page-section-gap,28px);padding:0 0 7px;border-bottom:1px solid var(--line)}#app-divisions>.app-competition-panel{order:2}</style>';
const competitionRoute = d=>{
 let html=template;
 for(const [token,value] of Object.entries(worldPageReplacements(d,d.category==="international")))html=html.replace(token,value);
 html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <base href="/competitions/'+d.id.toLowerCase()+'/">\n  <meta name="fa-competition" content="'+encode(d.id)+'">'+(d.category==="domestic"?'\n  <meta name="fa-division" content="'+encode(d.id)+'">':''));
 html=html.replace(/\s*<script src="\/assets\/(?:landing|app|app-search|competition-tabs|competition-history|competition-fixtures)\.js" defer><\/script>/g,"");
 html=html.replace(/<title>[^<]+<\/title>/,"<title>"+encode(d.name)+" — Football Architect</title>");
 html=frontloadCompetitionShell(html,d.id);
 // Reveal Standings after its static skeleton is parsed, without waiting for runtime/data.
 html=html.replace('<!-- standings-skeleton-end -->','<!-- standings-skeleton-end --><script data-fa-standings-first-paint-ready>if(document.documentElement.dataset.competitionView==="standings")document.documentElement.removeAttribute("data-fa-competition-prepaint");</script>');
 html=html.replace('id="competition-panel-standings" class=', 'id="competition-panel-standings" aria-busy="true" class=');
 html=html.replace('id="competition-panel-fixtures" class=', 'id="competition-panel-fixtures" aria-busy="true" class=');
 for(const view of ['postseason','stats','history','awards'])html=html.replace('id="competition-panel-'+view+'" class=', 'id="competition-panel-'+view+'" aria-busy="true" class=');
 const canonicalCupInit = d.category==="international" ? "(()=>{const u=new URL(location.href),view=u.searchParams.get(\"view\"),parts=u.pathname.match(/^\\/competitions\\/(int-[12])(?:\\/(?:index\\.html)?)?$/);if(parts){const choices=[\"standings\",\"postseason\",\"fixtures\",\"stats\",\"history\",\"rules\",\"awards\"];u.pathname=\"/competitions/\"+parts[1]+\"/\"+(choices.includes(view)?view:\"standings\");u.searchParams.delete(\"view\");if(!u.searchParams.has(\"season\")&&view!==\"history\"&&view!==\"rules\")u.searchParams.set(\"season\",\"1\");history.replaceState(null,\"\",u.pathname+u.search+u.hash)}})();" : "";
 const firstPaint="(()=>{const p=new URLSearchParams(location.search),v=location.pathname.split(\"/\").filter(Boolean).at(-1),s=p.get(\"season\");document.documentElement.dataset.competitionView="+JSON.stringify(model.views.map(view=>view.id))+".includes(v)?v:"+JSON.stringify(model.views.map(view=>view.id))+".includes(p.get(\"view\"))?p.get(\"view\"):\"standings\";document.documentElement.dataset.competitionSeasonUnavailable=\"false\";document.documentElement.dataset.faStandingsLoading=\"true\"})();";
 return html.replace('</head>',(canonicalCupInit?'  <script>'+canonicalCupInit+'</script>\n  ':'  ')+'<script>'+firstPaint+'</script>\n    <script data-fa-competition-first-paint-init>document.documentElement.setAttribute("data-fa-competition-prepaint","");document.addEventListener("DOMContentLoaded",()=>document.documentElement.removeAttribute("data-fa-competition-prepaint"),{once:true});</script>\n  '+competitionShellCss+'\n  <link rel="stylesheet" href="/assets/competition-awards.css">\n  <script src="/assets/competition-model.js" defer></script>\n  <script src="/assets/standings-loading.js" defer></script>\n  <script src="/assets/competition-page.js" defer></script>\n</head>');
};
const competitionManifest = {
 schemaVersion:2,approved:provisionalAssignments.approved,profile:model.profile,clubCrests:clubCrestAssets().catalog,
 competitions:loadCompetitionCatalogue(),
 divisions:[...divisionData].sort((a,b)=>model.countries.indexOf(a.countryId)-model.countries.indexOf(b.countryId)||a.tier-b.tier).map(d=>{
  const country=countryById[d.countryId],members=provisionalClubs.get(d.id);
  if(!country||!members||members.length!==d.capacity)throw Error("Invalid competition source "+d.id);
  return {id:d.id,name:d.name,countryId:d.countryId,countryName:country.name.en,
   flagAsset:country.flagAsset,tier:d.tier,capacity:d.capacity,
   clubs:members.map(c=>({countryId:c.countryId,clubId:c.clubId,abbr:c.abbr,fullName:c.fullName,primaryName:primaryName(c),stadiumName:c.stadiumName}))};
 })
};
if(!model.validManifest(competitionManifest))throw Error("Invalid shared competition manifest");
const internationalIndexCards="          <section class=\"app-world-country\" aria-labelledby=\"international-cups-heading\">\n            <h2 id=\"international-cups-heading\">International Cups</h2>\n            <div class=\"app-world-grid\">\n              <a class=\"app-division-card\" href=\""+buildRoute({kind:"cup",id:"int-1",view:"standings"})+"\"><span aria-hidden=\"true\">🏆</span><span class=\"app-division-card-copy\"><strong>Sovereign Cup</strong><small>24 clubs · 8 countries</small></span></a>\n              <a class=\"app-division-card\" href=\""+buildRoute({kind:"cup",id:"int-2",view:"standings"})+"\"><span aria-hidden=\"true\">🏆</span><span class=\"app-division-card-copy\"><strong>Federation Cup</strong><small>24 clubs · 8 countries</small></span></a>\n            </div>\n          </section>\n";
const outputPages = [
 ...Object.entries(pages).map(([name,replacements])=>({
  name,path:name+"/index.html",
  replacements:{...replacements,
   "@@FA_WORLD_LINK@@":worldNav("/competitions",false),
   "@@FA_WORLD_SECTION@@":worldSection("",false)}
 })),
 {name:"competitions",path:"competitions/index.html",replacements:worldPageReplacements()},
 ...competitionManifest.competitions.map(definition=>({
  name:definition.id,path:"competitions/"+definition.slug+"/index.html",
  directContent:competitionRoute(definition)
 }))
];
if(Object.keys(countryById).length!==8||divisionData.length!==model.divisionCount||outputPages.length!==22)
 throw Error("Division catalogue cardinality changed; review the source data");
// The neutral _shared fallback is a separately maintained compatibility
// snapshot, not a division route. Its first-paint structure is under contract;
// regenerating canonical division routes must never overwrite this snapshot.
const neutralShell=readFileSync(new URL("../competitions/_shared/index.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
for(const marker of ['id="app-divisions"','app-competition-tabs',
 'id="competition-panel-standings"','id="competition-panel-fixtures"',
 'id="competition-panel-stats"','id="competition-panel-history"',
 'id="competition-panel-awards"','data-history-empty',
 'data-skeleton-archive-row','id="app-competition-badge"']){
 if(!neutralShell.includes(marker))throw Error("Neutral competition shell missing: "+marker);
}
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
 const routeTag='  <script src="/assets/routes-registry.js" defer></script>\n';
 if(path.endsWith('.html')&&/^(calendar|clubs|competitions)\//.test(path)&&!content.includes(routeTag)){
  if(!content.includes('<head>\n'))throw Error('Route bootstrap head missing: '+path);
  content=content.replace('<head>\n','<head>\n'+routeTag);
 }
 if(path.endsWith(".html")&&!content.includes("/assets/sidebar-evolution.js"))content=content.replace("</head>","  <link rel=\"stylesheet\" href=\"/assets/sidebar-evolution.css\">\n  <script src=\"/assets/sidebar-evolution.js\" defer></script>\n"+"</head>");
 // One normalization after the sidebar is inserted also covers generated sidebar links.
 if(path.endsWith('.html'))content=normalizeRouteLinks(renderSidebar(content),path);
  // Admin routes have a neutral first paint: never select Dashboard.
  // The sidebar bootstrap is injected only by renderSidebar; patch it afterwards.
  if(path.startsWith('admin/')&&path.endsWith('.html'))content=content.replace("path==='/admin'?'admin'","path.startsWith('/admin')?'admin'");
 const file=new URL("../"+path,import.meta.url);
 if(check){
  const current=readFileSync(file,"utf8");
  // Existing Windows checkouts may still use CRLF from before LF attributes were added.
  // Compare exact generated content except for CRLF-to-LF conversion.
  const actual=current.replace(/\r\n/g,"\n");
  if(content!==actual){
   let offset=0;while(offset<content.length&&offset<actual.length&&content[offset]===actual[offset])offset++;
   throw Error("Generated output differs from checked-in file: "+path+
     " at offset "+offset+" generated="+JSON.stringify(content.slice(offset,offset+180))+
     " checked-in="+JSON.stringify(actual.slice(offset,offset+180)));
  }
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
  if(page.name==="competition-shared")html=html.replace('<script src="/assets/landing.js"','<link rel="stylesheet" href="/assets/competition-awards.css">\n  <script src="/assets/competition-model.js" defer></script>\n  <script src="/assets/landing.js"');
 }
 if(page.name==="competitions")html=html.replace("</head>","  <script src=\"/assets/international-cups.js\" defer></script>\n</head>");
 if(page.name==="calendar")html=html.replace('<h1 class="app-page-title" id="calendar-title" data-app-i18n="calendar">Calendar</h1>','<h1 class="app-page-title" id="calendar-title" data-app-i18n="calendar">Calendar</h1>\n          '+"<div class=\"calendar-season-picker app-competition-season\"><span id=\"calendar-season-label\">Season</span><div class=\"language-control\" id=\"calendar-season-control\"><button type=\"button\" id=\"calendar-season-picker\" class=\"language-trigger\" role=\"combobox\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-controls=\"calendar-season-menu\" aria-labelledby=\"calendar-season-label calendar-season-value\"><span id=\"calendar-season-value\"></span><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></button><div id=\"calendar-season-menu\" class=\"language-menu\" role=\"listbox\" aria-labelledby=\"calendar-season-label\" hidden></div></div></div>"+"\n          "+"<script data-calendar-season-first-paint>(()=>{const n=document.documentElement.dataset.calendarSeason||'';const value=document.getElementById('calendar-season-value');if(value)value.textContent=n})();</script>") ;
 if(page.name==="calendar")html=html.replace('  <script src="/assets/theme.js">','  <script data-calendar-bootstrap>'+calendarBootstrap+'</script>\n  <script src="/assets/theme.js">').replace('</head>','  <script src="/assets/world-calendar-model.js" defer></script>\n  <script src="/assets/world-clock-adapter.js" defer></script>\n  <script src="/assets/world-calendar.js" defer></script>\n  <script src="/assets/calendar-simplified.js" defer></script>\n  <style data-calendar-critical>html:has(#world-calendar) #world-calendar>.calendar-heading,html:has(#world-calendar) #world-calendar>.calendar-clock,html:has(#world-calendar) #world-calendar>.calendar-details,html:has(#world-calendar) #world-calendar>.calendar-selected,html:has(#world-calendar) #world-calendar>.calendar-note,html:has(#world-calendar) #world-calendar>.calendar-key{display:none!important}</style>\n</head>');
 writeOutput(page.path,html);
}
// Admin directory and two dedicated subpages share the existing app shell.
for(const [route,title,content,scripts] of [
 ['admin','Admin','<div class="admin-directory" data-admin-directory><section class="app-panel admin-directory-card" data-admin-panel="calendar" aria-labelledby="admin-card-calendar-title"><h2 id="admin-card-calendar-title" data-admin-directory-copy="calendar">Calendar</h2><p data-admin-directory-copy="calendarDescription">Manage the world calendar and sporting progression</p><a class="app-link app-link-primary" href="/admin/calendar" data-admin-card="calendar" data-admin-directory-copy="calendar">Calendar</a></section><section class="app-panel admin-directory-card" data-admin-panel="players" aria-labelledby="admin-card-players-title"><h2 id="admin-card-players-title" data-admin-directory-copy="players">Players</h2><p data-admin-directory-copy="playersDescription">Configure player generation</p><a class="app-link app-link-primary" href="/admin/players" data-admin-card="players" data-admin-directory-copy="players">Players</a></section></div>',['/assets/admin-players.js']],
 ['admin/calendar','Admin — Calendar',renderAdminSettings(),['/assets/world-calendar-model.js','/assets/admin-settings.js']],
 ['admin/players','Admin — Players',renderAdminPlayers(),['/assets/admin-players.js']]
]){
 const section='<section id="app-admin" class="app-view app-admin-view" aria-labelledby="admin-title" hidden>\n          '+(route==='admin'?'<h1 id="admin-title" class="app-page-title">Admin</h1>':'<div class="admin-page-heading"><h1 id="admin-title" class="app-page-title">'+(route.endsWith('calendar')?'Calendar':'Players')+'</h1>\n          <a class="app-link app-link-secondary admin-back" href="/admin" data-admin-back aria-label="Back to Admin"><svg class="fa-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Admin</span></a></div>')+'\n          '+content+'\n        </section>\n';
 let html=template.replace(/(id="main-content" tabindex="-1">\n)[\s\S]*?(      <\/main>)/,(_,first,last)=>first+section+last);
 for(const [token,value] of Object.entries(worldPageReplacements()))html=html.replaceAll(token,value);
 // At first paint, Admin must not highlight a different sidebar destination.
 html=html.replace('class="fa-shell-link is-active" id="app-nav-divisions"','class="fa-shell-link" id="app-nav-divisions"')
  .replace('id="app-nav-divisions" href="/competitions" data-app-view="divisions" aria-current="page"','id="app-nav-divisions" href="/competitions" data-app-view="divisions"');
 html=html.replace('<title>Competitions','<title>'+title);
 html=html.replace('</head>',
  '  <meta name="robots" content="noindex,nofollow">\n  <script src="/assets/routes-registry.js" defer></script>\n  <link rel="stylesheet" href="/assets/admin-settings.css">\n'+scripts.map(src=>'  <script src="'+src+'" defer></script>\n').join('')+'</head>');
 writeOutput(route+'/index.html',html);
}
// Account and authentication routes use the same career shell.
function renderAccountPage(content,title,scripts){
 const replacements=worldPageReplacements();
 let html=template.replace(/(id="main-content" tabindex="-1">\n)[\s\S]*?(      <\/main>)/,(_,start,end)=>start+content+end);
 for(const [token,value] of Object.entries(replacements))html=html.replaceAll(token,value);
 const scriptTags=scripts.map(script=>'  <script src="/assets/'+script+'" defer></script>\n').join('');
 return html.replace("<title>Competitions", "<title>"+title)
  .replace('  <script src="/assets/theme.js">','  <script src="/assets/account-ui.js"></script>\n  <script src="/assets/theme.js">')
  .replace("</head>",'  <meta name="referrer" content="no-referrer">\n  <meta name="robots" content="noindex,nofollow">\n  <link rel="stylesheet" href="/assets/account.css">\n  <script src="/assets/competition-tabs.js" defer></script>\n'+scriptTags+'</head>');
}
function accountTemplate(name){
 return readFileSync(new URL("../templates/"+name+".html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
}
writeOutput("account/index.html",renderAccountPage(accountTemplate("account-profile"),"Profile",["account-settings.js"]));
for(const [route,title,...scripts] of [
 ["login","Sign in","account-login.js"],
 ["register","Create an account","local-dev-inbox-link.js","account-onboarding.js"],
 ["recover","Recover your password","local-dev-inbox-link.js","account-recovery.js"],
 ["verify-email","Verify your email","account-verification.js"]
]){
 const content=accountTemplate("account-auth-"+route);
 const html=renderAccountPage(content,title,scripts);
 const withRoutes=route==="login"||route==="register"
  ?html.replace('  <script src="/assets/theme.js">','  <script src="/assets/routes-registry.js"></script>\n  <script src="/assets/theme.js">')
  :html;
 writeOutput("account/"+route+"/index.html",withRoutes);
}
for(const output of clubOutputs({template,replacements:worldPageReplacements(),clubs:clubData,divisions:divisionData,allocations:provisionalAssignments,countryFlags:Object.fromEntries(Object.values(countryById).map(country=>[country.id,inlineCountryFlag(country)]))}))
 writeOutput(output.path,output.content);
// NAV-01B: produce directory from the same canonical generated competitions shell.
{
 const file=new URL("../competitions/index.html",import.meta.url);
 const source=readFileSync(file,"utf8").replace(/\\r\\n/g,"\\n");
 const begin=source.indexOf('<section id="app-divisions"');
 const finish=source.indexOf("\n      </main>",begin);
 if(begin<0||finish<0)throw Error("Clubs source shell missing");
 const content="<section id=\"app-divisions\" class=\"app-view nav01-directory\" aria-labelledby=\"nav01-title\"><div id=\"nav01-clubs\"><h1 id=\"nav01-title\" class=\"app-page-title\">Clubs</h1><div class=\"nav01-filters\"><input type=\"search\" aria-label=\"Search clubs\" placeholder=\"Search clubs or cities\"><script data-nav01-search-first-paint>(()=>{const input=document.currentScript.previousElementSibling;const placeholders={en:\"Search clubs or cities\",de:\"Vereine oder Städte suchen\",es:\"Buscar clubes o ciudades\",fr:\"Rechercher clubs ou villes\",it:\"Cerca club o città\"};const value=placeholders[document.documentElement.lang]||placeholders.en;input.placeholder=value;input.setAttribute(\"aria-label\",value)})();</script><div class=\"language-control nav01-filter\"><select hidden aria-label=\"Country\"><option value=\"\">All countries</option></select><button type=\"button\" id=\"nav01-country-trigger\" class=\"language-trigger\" role=\"combobox\" aria-label=\"Country\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-controls=\"nav01-country-menu\" disabled><span class=\"nav01-filter-value\">All countries</span><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></button><div id=\"nav01-country-menu\" class=\"language-menu\" role=\"listbox\" aria-labelledby=\"nav01-country-trigger\" hidden></div></div><div class=\"language-control nav01-filter\"><select hidden aria-label=\"Division\"><option value=\"\">All divisions</option></select><button type=\"button\" id=\"nav01-division-trigger\" class=\"language-trigger\" role=\"combobox\" aria-label=\"Division\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-controls=\"nav01-division-menu\" disabled><span class=\"nav01-filter-value\">All divisions</span><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></button><div id=\"nav01-division-menu\" class=\"language-menu\" role=\"listbox\" aria-labelledby=\"nav01-division-trigger\" hidden></div></div></div><p class=\"nav01-count\" aria-live=\"polite\"></p><div class=\"nav01-grid\" aria-busy=\"true\"><p class=\"nav01-load-status\" role=\"status\">Loading clubs…</p></div><script data-nav01-loading-first-paint>(()=>{const grid=document.currentScript.previousElementSibling;const labels={en:\"Loading clubs…\",de:\"Vereine werden geladen…\",es:\"Cargando clubes…\",fr:\"Chargement des clubs…\",it:\"Caricamento club…\"};grid.querySelector(\"p\").textContent=labels[document.documentElement.lang]||labels.en})();</script></div></section>";
// PAGE-LOAD-04 B01: the directory shell has labels and shape-only cards, no embedded club identities.
 // Stable country-flag artwork is a reusable sprite; club identities arrive with the manifest.
 const directoryFlagSprite='<svg class="nav01-flag-sprite" aria-hidden="true" focusable="false" width="0" height="0" xmlns="http://www.w3.org/2000/svg" style="position:absolute;overflow:hidden"><defs>'+
  ["IT","ENG","ES","DE","FR","PT","NL","BR"].map(countryId=>{
   const code=countryId==='ENG'?'gb-eng':countryId.toLowerCase();
   const svg=inlineCountryFlag(countryById[countryId]);
   const content=svg.slice(svg.indexOf(">",svg.indexOf("<svg"))+1,svg.lastIndexOf("</svg>"));
   return '<symbol id="fa-directory-flag-'+code+'" viewBox="0 0 5 4">'+content+'</symbol>';
  }).join('')+'</defs></svg>';
 const firstPaintCards="<div class=\"nav01-card nav01-skeleton-card\" aria-hidden=\"true\"><span class=\"nav01-crest nav01-skeleton-crest\"><span class=\"nav01-skeleton-crest-disc\"></span></span><span class=\"nav01-skeleton-copy\"><strong class=\"nav01-skeleton-name\"><span class=\"nav01-skeleton-bar nav01-skeleton-name-bar\"></span></strong><small class=\"nav01-club-location nav01-skeleton-location\"><span class=\"nav01-skeleton-bar nav01-skeleton-flag\"></span><span class=\"nav01-skeleton-bar nav01-skeleton-city\"></span></small></span></div>".repeat(16);
 const filteredFirstPaint=content.replace('<div class="nav01-grid" aria-busy="true">',directoryFlagSprite+'<div class="nav01-grid" aria-busy="true">')
  .replace('<p class="nav01-count" aria-live="polite"></p>','<p class="nav01-count" aria-live="polite"><span class="nav01-skeleton-bar nav01-skeleton-count" aria-hidden="true"></span></p>')
  .replace('<p class="nav01-load-status" role="status">Loading clubs…</p>',firstPaintCards)
  .replace(/<script data-nav01-loading-first-paint>[\s\S]*?<\/script>/,'');
 let html=source.slice(0,begin)+filteredFirstPaint+source.slice(finish);
 html=html.replace("<title>Competitions — Football Architect</title>","<title>Clubs — Football Architect</title>");

 html=html.replace('  <link rel="stylesheet" href="/assets/sidebar-evolution.css">', "  <link rel=\"stylesheet\" href=\"/assets/clubs-directory.css\">\n  <script src=\"/assets/competition-tabs.js\" defer></script>\n  <script src=\"/assets/clubs-directory.js\" defer></script>\n  <link rel=\"stylesheet\" href=\"/assets/sidebar-evolution.css\">");
 writeOutput("clubs/index.html",html);
}
writeOutput("competitions/_shared/manifest.json",JSON.stringify(competitionManifest,null,2)+"\n");
if(check)console.log("Static HTML matches checked-in pages: "+outputPages.length+"/"+outputPages.length+" (3 existing + 19 Competitions), 1 neutral snapshot structurally audited, 1 competition manifest, 1 club template and 1 club manifest");

// Explore: public Players directory has its own canonical page, separate from Admin's generator.
{
 const file=new URL("../competitions/index.html",import.meta.url);
 const source=readFileSync(file,"utf8").replace(/\r\n/g,"\n");
 const begin=source.indexOf('<section id="app-divisions"');
 const finish=source.indexOf("\n      </main>",begin);
 if(begin<0||finish<0)throw Error("Players source shell missing");
 const content="<section id=\"app-divisions\" class=\"app-view nav01-directory\" aria-labelledby=\"players-title\">\n          <header class=\"app-players-header\">\n            <h1 id=\"players-title\" class=\"app-page-title\" data-app-i18n=\"statsDevPlayers\">Players</h1>\n            <p class=\"app-players-count\" data-players-count aria-live=\"polite\"><span class=\"app-players-count-skeleton\" aria-hidden=\"true\"></span></p>\n          </header>\n          <nav class=\"app-competition-tabs app-players-tabs\" role=\"tablist\" aria-label=\"Player views\">\n            <a class=\"app-competition-tab is-active\" role=\"tab\" data-players-view=\"overview\" aria-selected=\"true\" href=\"/players?view=overview\">Overview</a>\n            <a class=\"app-competition-tab\" role=\"tab\" data-players-view=\"attributes\" aria-selected=\"false\" href=\"/players?view=attributes\">Attributes</a>\n          </nav>\n          <div class=\"app-players-filters\" role=\"group\" aria-label=\"Player filters\">\n            <label class=\"app-players-filter-label\"><span data-players-filter-copy=\"nationality\">Nationality</span>\n              <span class=\"app-players-filter-control\"><select data-players-filter=\"nationality\" aria-label=\"Nationality\"><option value=\"\">All nationalities</option></select><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span>\n            </label>\n            <label class=\"app-players-filter-label\"><span data-players-filter-copy=\"position\">Primary position</span>\n              <span class=\"app-players-filter-control\"><select data-players-filter=\"position\" aria-label=\"Primary position\"><option value=\"\">All primary positions</option></select><svg class=\"language-chevron\" viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path d=\"m5 7 5 5 5-5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span>\n            </label>\n          </div>\n          <nav class=\"app-players-groups\" role=\"tablist\" aria-label=\"Attribute groups\">\n            <button type=\"button\" class=\"app-players-group is-active\" role=\"tab\" aria-selected=\"true\" data-players-group=\"physical\">Physical</button>\n            <button type=\"button\" class=\"app-players-group\" role=\"tab\" aria-selected=\"false\" data-players-group=\"technical\">Technical</button>\n            <button type=\"button\" class=\"app-players-group\" role=\"tab\" aria-selected=\"false\" data-players-group=\"mental\">Mental</button>\n            <button type=\"button\" class=\"app-players-group\" role=\"tab\" aria-selected=\"false\" data-players-group=\"goalkeeping\">Goalkeeping</button>\n          </nav>\n          <div class=\"app-players-table-scroll\" role=\"region\" aria-label=\"Players directory\" tabindex=\"0\">\n            <table class=\"app-players-table\">\n              <thead>\n                <tr>\n                  <th scope=\"col\" class=\"app-players-flag-col\"><span class=\"sr-only\" data-app-i18n=\"playersNationality\">Nationality</span></th>\n                  <th scope=\"col\" data-app-i18n=\"playersColumnPlayer\">Player</th>\n                  <th scope=\"col\" data-app-i18n=\"playersColumnAge\">Age</th>\n                  <th scope=\"col\" data-app-i18n=\"playersColumnPositions\">Positions</th>\n                  <th scope=\"col\" data-app-i18n=\"playersColumnHeight\">Height</th>\n                  <th scope=\"col\" data-app-i18n=\"playersColumnFoot\">Foot</th>\n                </tr>\n              </thead>\n              <tbody>\n                <tr class=\"app-players-empty-row\">\n                  <td colspan=\"6\">\n                    <strong data-players-status role=\"status\" aria-live=\"polite\">Loading players…</strong>\n                  </td>\n                </tr>\n              </tbody>\n            </table>\n          </div>\n          <script data-players-first-paint>(()=>{'use strict';\n           const params=new URLSearchParams(location.search),view=params.get('view')==='attributes'?'attributes':'overview';\n           const groups={physical:['speed','strength','stamina','agility'],technical:['passing','technique','dribbling','shooting','crossing','tackling','marking','heading'],mental:['vision','positioning','decisions','composure'],goalkeeping:['gk_reflexes','gk_handling','gk_positioning','gk_aerial']};\n           const group=Object.hasOwn(groups,params.get('group'))?params.get('group'):'physical';\n           document.documentElement.dataset.playersView=view;document.documentElement.dataset.playersGroup=group;\n           const locale=document.documentElement.lang.toLowerCase().slice(0,2);\n           const names={en:['Overview','Attributes','Physical','Technical','Mental','Goalkeeping','Nationality','Primary position','All nationalities','All primary positions'],it:['Panoramica','Attributi','Fisici','Tecnici','Mentali','Portiere','Nazionalità','Posizione primaria','Tutte le nazionalità','Tutte le posizioni primarie'],de:['Übersicht','Attribute','Physisch','Technisch','Mental','Torwart','Nationalität','Hauptposition','Alle Nationalitäten','Alle Hauptpositionen'],es:['Resumen','Atributos','Físicos','Técnicos','Mentales','Portero','Nacionalidad','Posición principal','Todas las nacionalidades','Todas las posiciones principales'],fr:['Vue d’ensemble','Attributs','Physiques','Techniques','Mentaux','Gardien','Nationalité','Poste principal','Toutes les nationalités','Tous les postes principaux']}[locale]||['Overview','Attributes','Physical','Technical','Mental','Goalkeeping','Nationality','Primary position','All nationalities','All primary positions'];\n           for(const [i,tab] of [...document.querySelectorAll('[data-players-view]')].entries()){const active=tab.dataset.playersView===view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.textContent=names[i];}\n           for(const [i,tab] of [...document.querySelectorAll('[data-players-group]')].entries()){const active=tab.dataset.playersGroup===group;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.textContent=names[i+2];}\n           for(const [i,label] of [...document.querySelectorAll('[data-players-filter-copy]')].entries())label.textContent=names[i+6];\n           for(const [i,select] of [...document.querySelectorAll('[data-players-filter]')].entries()){select.options[0].textContent=names[i+8];select.setAttribute('aria-label',names[i+6]);}\n           if(view==='attributes'){\n            const table=document.querySelector('.app-players-table'),row=table.tHead.rows[0],keys=groups[group];\n            const attributeNames={en:'Speed|Strength|Stamina|Agility|Passing|Technique|Dribbling|Shooting|Crossing|Tackling|Marking|Heading|Vision|Positioning|Decisions|Composure|Reflexes|Handling|GK positioning|Aerial',it:'Velocità|Forza|Resistenza|Agilità|Passaggio|Tecnica|Dribbling|Tiro|Cross|Contrasto|Marcatura|Colpo di testa|Visione|Posizionamento|Decisioni|Freddezza|Riflessi|Presa|Posizionamento portiere|Uscite alte',de:'Tempo|Stärke|Ausdauer|Beweglichkeit|Passen|Technik|Dribbling|Schuss|Flanken|Zweikampf|Deckung|Kopfball|Übersicht|Stellungsspiel|Entscheidungen|Ruhe|Reflexe|Fangen|Torwartstellung|Luftraum',es:'Velocidad|Fuerza|Resistencia|Agilidad|Pases|Técnica|Regate|Tiro|Centros|Entradas|Marcaje|Cabeceo|Visión|Colocación|Decisiones|Serenidad|Reflejos|Blocaje|Posición de portero|Juego aéreo',fr:'Vitesse|Force|Endurance|Agilité|Passes|Technique|Dribble|Tir|Centres|Tacles|Marquage|Jeu de tête|Vision|Placement|Décisions|Sang-froid|Réflexes|Prise de balle|Placement gardien|Jeu aérien'};\n            const keysAll=Object.values(groups).flat(),labels=(attributeNames[locale]||attributeNames.en).split('|');\n            while(row.cells.length>2)row.deleteCell(2);\n            for(const key of keys){const th=document.createElement('th');th.scope='col';th.textContent=labels[keysAll.indexOf(key)];row.append(th);}\n            table.dataset.playersTableMode='attributes';\n            table.tBodies[0].rows[0].cells[0].colSpan=keys.length+2;\n           }\n          })();</script>\n        </section>";
 let html=source.slice(0,begin)+content+source.slice(finish);
 html=html.replace("<title>Competitions — Football Architect</title>","<title>Players — Football Architect</title>");
 html=html.replace('  <script src="/assets/international-cups.js" defer></script>\n','');
 html=html.replace('</head>','  <script src="/assets/players-directory.js" defer></script>\n</head>');
 writeOutput("players/index.html",html);
}
