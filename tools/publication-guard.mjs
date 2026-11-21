// Fail-closed allowlist for future static publication artifacts.
// Do not use the repository root as a public document root.
import {resolveSubpage} from "../assets/subpage-routes.mjs";
import {isDeepStrictEqual} from "node:util";
import {readdirSync,lstatSync,readFileSync,existsSync,mkdirSync,copyFileSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {validateDivisionAssets} from "./validate-division-assets.mjs";
import {clubCrestAssets} from "./club-crest-assets.mjs";
import competitionModel from "../assets/competition-model.js";

export const repositoryRoot=fileURLToPath(new URL("../",import.meta.url));
const required=["404.html","assets/admin-permissions-cache.js","assets/profile-navigation.js","assets/account-ui.js","assets/account.css","data/country-codes.json","account/index.html","account/login/index.html","account/recover/index.html","account/register/index.html","account/verify-email/index.html","assets/account-login.js","assets/local-dev-inbox-link.js","assets/account-onboarding.js","assets/account-recovery.js","assets/account-settings.js","assets/account-verification.js",
 "assets/competition-stats.js","assets/matches-directory.mjs","assets/matches-directory.css","assets/players-directory.js","assets/player-detail.js","assets/player-detail.css","assets/player-stats.mjs","assets/player-matches.mjs","assets/match-detail.js","assets/match-detail.css","assets/match-scoreboard-themes.mjs","assets/public-image-urls.mjs","assets/match-references.mjs","assets/match-public-context.mjs","assets/players-nationality-tooltip.js","assets/players-mobile.js","assets/admin-players-preview.js","assets/admin-contracts.js",
 "clubs/_shared/index.html","clubs/_shared/manifest.json","clubs/_shared/identity.json","assets/club-page.js","assets/club-model.js","assets/club-records.js","assets/club-page.css","assets/club-season-source.mjs","assets/club-history-source.mjs","assets/club-public-read-cache.mjs","assets/club-fixtures.js","assets/club-fixtures-source.mjs","assets/published-match-links.mjs","assets/club-fixtures-controller.mjs","assets/club-competition-catalogue.mjs",
 "vercel.json","index.html","guide/index.html","dashboard/index.html","players/index.html","players/_shared/index.html","matches/_shared/index.html","matches/index.html",
 "calendar/index.html","admin/index.html","admin/calendar/index.html","admin/players/index.html","admin/contracts/index.html","admin/players/preview/index.html","admin/players/preview/player/index.html","settings/index.html","competitions/index.html",
 "competitions/_shared/index.html","competitions/_shared/manifest.json","competitions/_shared/compact.json",
 "assets/competition-rules.js","assets/competition-rules-view.js","assets/international-cups.js","assets/club-crests.js","assets/competition-model.js","assets/competition-history.js","assets/competition-page.js","assets/standings-subviews.mjs","assets/standings-loading.js","assets/competition-tabs.js","assets/competition-fixtures.js","assets/theme.js",
 "data/divisions.json","assets/world-calendar-model.js","assets/world-clock-adapter.js","assets/world-calendar.js"
];
const divisions=["it","eng","es","de","fr","pt","nl","br"]
 .flatMap(country=>[1,2].map(tier=>"competitions/"+country+"-"+tier+"/index.html"));
const rootFiles=new Set(["404.html","data/country-codes.json","account/index.html","account/login/index.html","account/recover/index.html","account/register/index.html","account/verify-email/index.html","competitions/int-1/index.html","competitions/int-2/index.html","clubs/index.html","clubs/_shared/index.html","clubs/_shared/manifest.json","clubs/_shared/identity.json","vercel.json","index.html","favicon.ico","favicon.svg","guide/index.html",
 "dashboard/index.html","players/index.html","players/_shared/index.html","matches/_shared/index.html","matches/index.html","admin/index.html","admin/calendar/index.html","admin/players/index.html","admin/contracts/index.html","admin/players/preview/index.html","admin/players/preview/player/index.html","calendar/index.html",
 "settings/index.html","competitions/index.html",
 "competitions/_shared/index.html","competitions/_shared/manifest.json","competitions/_shared/compact.json",
 "data/divisions.json"]);
const runtimeAssets=new Set(["profile-navigation.js","account-ui.js","account.css","account-login.js","local-dev-inbox-link.js","account-onboarding.js","account-recovery.js","account-settings.js","account-verification.js","authoritative-calendar.mjs","authoritative-history.mjs","authoritative-season.mjs","admin-settings.js","admin-settings.css","admin-permissions-cache.js","admin-players.js","admin-contracts.js","admin-players-preview.js","player-detail.js","player-detail.css","player-stats.mjs","player-matches.mjs","match-detail.js","match-detail.css","match-scoreboard-themes.mjs","public-image-urls.mjs","match-references.mjs","match-public-context.mjs","players-nationality-tooltip.js","provider-selectors.mjs","provider-selectors-bootstrap.mjs","routes-registry.js","world-calendar-model.js","world-clock-adapter.js","world-calendar.js","calendar-simplified.js","club-page.js","club-model.js","club-records.js","club-page.css","club-season-source.mjs","club-history-source.mjs","club-public-read-cache.mjs","club-fixtures.js","club-fixtures-source.mjs","published-match-links.mjs","club-fixtures-controller.mjs","club-competition-catalogue.mjs","landing.js","landing.css","guide.css","app.js","app.css",
 "app-search.js","matches-directory.mjs","matches-directory.css","players-directory.js","players-mobile.js","competition-stats.js","competition-rules.js","competition-rules-view.js","international-cups.js","sidebar-evolution.js","sidebar-evolution.css","clubs-directory.js","clubs-directory.css","club-crests.js","competition-model.js","competition-history.js","competition-page.js","standings-subviews.mjs","standings-loading.js","competition-tabs.js","competition-fixtures.js","competition-awards.js","competition-awards.css","theme.js",
]);

// Only explicit canonical routes are allowed; no hosting, auth or build overrides.
const competitionRouting={"redirects":[{"source":"/matches/:id([1-9][0-9]*)/","destination":"/matches/:id","permanent":true},{"source":"/players/:id([1-9][0-9]*)/","destination":"/players/:id","permanent":true},{"source":"/admin/players/preview/player/","destination":"/admin/players/preview/player","permanent":true},{"source":"/admin/players/preview/player/index.html","destination":"/admin/players/preview/player","permanent":true},{"source":"/clubs/","destination":"/clubs","permanent":true},{"source":"/clubs/index.html","destination":"/clubs","permanent":true},{"source":"/:page(dashboard|calendar|settings|admin|competitions|players|matches)/","destination":"/:page","permanent":true},{"source":"/:page(dashboard|calendar|settings|admin|competitions|players|matches)/index.html","destination":"/:page","permanent":true},{"source":"/admin/:section(calendar|players|contracts)/","destination":"/admin/:section","permanent":true},{"source":"/admin/:section(calendar|players|contracts)/index.html","destination":"/admin/:section","permanent":true},{"source":"/admin/players/preview/","destination":"/admin/players/preview","permanent":true},{"source":"/admin/players/preview/index.html","destination":"/admin/players/preview","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/index.html","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/overview","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)/","destination":"/competitions/:division/:view","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"records"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"records"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"records"}],"destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|records|history)/","destination":"/clubs/:country/:club/:view","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|records|history)/index.html","destination":"/clubs/:country/:club/:view","permanent":true},{"source":"/competitions/:cup(int-1|int-2)/:view(standings|postseason|fixtures|stats|history|rules|awards)/","destination":"/competitions/:cup/:view","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/stats/index.html","destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/stats/","destination":"/clubs/:country/:club/records","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/stats","destination":"/clubs/:country/:club/records","permanent":true}],"rewrites":[{"source":"/matches/:id([1-9][0-9]*)","destination":"/matches/_shared/index.html"},{"source":"/players/:id([1-9][0-9]*)","destination":"/players/_shared/index.html"},{"source":"/admin/players/preview/player","destination":"/admin/players/preview/player/index.html"},{"source":"/clubs","destination":"/clubs/index.html"},{"source":"/:page(dashboard|calendar|settings|admin|competitions|players|matches)","destination":"/:page/index.html"},{"source":"/admin/:section(calendar|players|contracts)","destination":"/admin/:section/index.html"},{"source":"/competitions/_shared/:file(index.html|manifest.json|compact.json)","destination":"/competitions/_shared/:file"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/index.html"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)","destination":"/competitions/:division/index.html"},{"source":"/competitions/:cup(int-1|int-2)/:view(standings|postseason|fixtures|stats|history|rules|awards)","destination":"/competitions/:cup/index.html"},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|records|history)","destination":"/clubs/_shared/index.html"}],"headers":[{"source":"/account/:path*","headers":[{"key":"Cache-Control","value":"private, no-store, max-age=0"},{"key":"Referrer-Policy","value":"no-referrer"},{"key":"X-Robots-Tag","value":"noindex, nofollow"},{"key":"X-Content-Type-Options","value":"nosniff"}]},{"source":"/admin/players/preview/:path*","headers":[{"key":"Cache-Control","value":"private, no-store, max-age=0"},{"key":"Referrer-Policy","value":"no-referrer"},{"key":"X-Robots-Tag","value":"noindex, nofollow"}]}]};

export function isAllowlistedPublicPath(path,sourceRoot=repositoryRoot) {
 if(path.startsWith("clubs/_profiles/"))
  return /^clubs\/_profiles\/(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)\.json$/.test(path);
 if(path.startsWith("assets/clubs/"))return clubCrestAssets(sourceRoot).paths.has(path);
 if(path.startsWith("assets/competitions/"))return validateDivisionAssets(sourceRoot).paths.has(path);
 if(rootFiles.has(path)||divisions.includes(path))return true;
 if(path.startsWith("assets/brand/"))
  return /^assets\/brand\/[a-z0-9-]+\.(?:svg|png)$/.test(path);
 if(path.startsWith("assets/players/portraits/")){
  // A canonical numeric WebP committed here is the explicit publication boundary.
  if(!/^assets\/players\/portraits\/[1-9][0-9]*\.webp$/.test(path))return false;
  const file=join(sourceRoot,path);
  return existsSync(file)&&lstatSync(file).isFile()&&!lstatSync(file).isSymbolicLink();
 }
 if(path.startsWith("assets/flags/"))
  return path==="assets/flags/LICENSE"||/^assets\/flags\/[a-z0-9-]+\.svg$/.test(path);
 if(path.startsWith("assets/"))
  return runtimeAssets.has(path.slice("assets/".length));
 return false;
}
export function listFiles(root,relative="") {
 const files=[];
 for(const entry of readdirSync(join(root,relative),{withFileTypes:true})){
  const path=relative?relative+"/"+entry.name:entry.name;
  if(entry.isSymbolicLink()||lstatSync(join(root,path)).isSymbolicLink())
   throw Error("Public artifact cannot contain symlinks: "+path);
  if(entry.isDirectory())files.push(...listFiles(root,path));
  else if(entry.isFile())files.push(path);
  else throw Error("Unsupported artifact item: "+path);
 }
 return files.sort();
}
export function planPublicFiles(sourceRoot=repositoryRoot) {
 const routing=JSON.parse(readFileSync(join(sourceRoot,"vercel.json"),"utf8"));
 if(!isDeepStrictEqual(routing,competitionRouting))throw Error("Unexpected competition routing configuration");
 const crests=clubCrestAssets(sourceRoot);
 const manifest=JSON.parse(readFileSync(join(sourceRoot,"competitions/_shared/manifest.json"),"utf8"));
 if(!isDeepStrictEqual(manifest.clubCrests,crests.catalog))throw Error("Club crest manifest differs from source assets; regenerate app pages");
 const compact=JSON.parse(readFileSync(join(sourceRoot,"competitions/_shared/compact.json"),"utf8"));
 if(!isDeepStrictEqual(compact,competitionModel.packCompactManifest(manifest))||
    !isDeepStrictEqual(competitionModel.expandCompactManifest(compact),manifest))
  throw Error("Compact competition catalogue does not match canonical manifest");
 const files=listFiles(sourceRoot).filter(path=>isAllowlistedPublicPath(path,sourceRoot));
 const clubIdentity=JSON.parse(readFileSync(join(sourceRoot,'clubs/_shared/identity.json'),'utf8'));
 if(clubIdentity?.projection!=='club-identity-v1'||!Array.isArray(clubIdentity.clubs)||clubIdentity.clubs.length!==320)
  throw Error('Club identity catalogue missing or invalid');
 for(const club of clubIdentity.clubs){
  const expected='clubs/_profiles/'+club.countryId+'-'+club.clubId+'.json';
  if(!files.includes(expected))throw Error('Required Club Overview profile missing: '+expected);
 }
 for(const path of crests.paths)if(!files.includes(path))throw Error("Required club crest missing: "+path);
 for(const path of [...required,...divisions])
  if(!files.includes(path))throw Error("Required public asset missing: "+path);
 const images=validateDivisionAssets(sourceRoot);
 for(const path of images.paths)
  if(!files.includes(path))throw Error("Required approved division asset missing: "+path);
 return files;
}
export function assertPublicArtifact(publicRoot,{sourceRoot=repositoryRoot}={}) {
 if(resolve(publicRoot)===resolve(sourceRoot))
  throw Error("Repository root is not a safe public artifact");
 if(!existsSync(publicRoot))throw Error("Public artifact missing");
 const actual=listFiles(publicRoot);
 const expected=planPublicFiles(sourceRoot);
 for(const path of actual)
  if(!isAllowlistedPublicPath(path,sourceRoot))throw Error("Not allowlisted for publication: "+path);
 if(actual.length!==expected.length||actual.some((path,i)=>path!==expected[i]))
  throw Error("Public artifact does not match exact approved manifest");
 for(const path of expected){
  const bytes=readFileSync(join(publicRoot,path));
  if(!bytes.equals(readFileSync(join(sourceRoot,path))))
   throw Error("Public artifact source mismatch: "+path);
  if(/\.(?:js|html|css|json)$/.test(path)&&
     /\bit1Demo\b|__faFixtureHooks|tests\/fixtures\/it-1-demo|__fa_dev__\/|dev-debug-settings/.test(bytes.toString("utf8")))
   throw Error("Private development fixture referenced by public asset: "+path);
 }
 return actual;
}
export function stagePublicArtifact(sourceRoot,destination) {
 if(existsSync(destination))throw Error("Refusing to overwrite an artifact");
 if(resolve(destination)===resolve(sourceRoot))
  throw Error("Repository root cannot be published");
 const files=planPublicFiles(sourceRoot);
 for(const path of files){
  const target=join(destination,path);
  mkdirSync(dirname(target),{recursive:true});
  copyFileSync(join(sourceRoot,path),target);
 }
 assertPublicArtifact(destination,{sourceRoot});
 return files;
}

// Canonical request paths resolve directly to allowlisted physical files.
export function publicRequestFile(pathname) {
  if(/^\/matches\/[1-9][0-9]*\/?$/.test(pathname))return "matches/_shared/index.html";
  if(/^\/players\/[1-9][0-9]*\/?$/.test(pathname))return "players/_shared/index.html";
  if(pathname==="/clubs"||pathname==="/clubs/")return "clubs/index.html";
  const club=resolveSubpage(pathname);
  if(club?.kind==="club"&&!club.redirect)return "clubs/_shared/index.html";
  const detail=pathname.match(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12]|int-1|int-2)\/(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)\/?$/);
  if(detail)return "competitions/"+detail[1]+"/index.html";
  return (pathname.endsWith("/") ? pathname + "index.html"
    : /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + "/index.html").slice(1);
}
