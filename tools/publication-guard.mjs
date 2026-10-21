// Fail-closed allowlist for future static publication artifacts.
// Do not use the repository root as a public document root.
import {isDeepStrictEqual} from "node:util";
import {readdirSync,lstatSync,readFileSync,existsSync,mkdirSync,copyFileSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {validateDivisionAssets} from "./validate-division-assets.mjs";
import {clubCrestAssets} from "./club-crest-assets.mjs";

export const repositoryRoot=fileURLToPath(new URL("../",import.meta.url));
const required=[
 "vercel.json","index.html","guide/index.html","dashboard/index.html",
 "calendar/index.html","settings/index.html","competitions/index.html",
 "competitions/_shared/index.html","competitions/_shared/manifest.json",
 "assets/club-crests.js","assets/competition-model.js","assets/competition-history.js","assets/competition-page.js","assets/competition-tabs.js","assets/competition-fixtures.js","assets/theme.js",
 "data/divisions.json"
];
const divisions=["it","eng","es","de","fr","pt","nl","br"]
 .flatMap(country=>[1,2].map(tier=>"competitions/"+country+"-"+tier+"/index.html"));
const rootFiles=new Set(["vercel.json","index.html","favicon.ico","favicon.svg","guide/index.html",
 "dashboard/index.html","calendar/index.html",
 "settings/index.html","competitions/index.html",
 "competitions/_shared/index.html","competitions/_shared/manifest.json",
 "data/divisions.json"]);
const runtimeAssets=new Set(["landing.js","landing.css","guide.css","app.js","app.css",
 "app-search.js","club-crests.js","competition-model.js","competition-history.js","competition-page.js","competition-tabs.js","competition-fixtures.js","competition-awards.js","competition-awards.css","theme.js",
]);

// Only explicit canonical routes are allowed; no hosting, auth or build overrides.
const competitionRouting={"redirects":[{"source":"/:page(dashboard|calendar|settings|competitions)/","destination":"/:page","permanent":true},{"source":"/:page(dashboard|calendar|settings|competitions)/index.html","destination":"/:page","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/index.html","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/overview","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)/","destination":"/competitions/:division/:view","permanent":true}],"rewrites":[{"source":"/:page(dashboard|calendar|settings|competitions)","destination":"/:page/index.html"},{"source":"/competitions/_shared/:file(index.html|manifest.json)","destination":"/competitions/_shared/:file"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/index.html"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)","destination":"/competitions/:division/index.html"}]};

export function isAllowlistedPublicPath(path,sourceRoot=repositoryRoot) {
 if(path.startsWith("assets/clubs/"))return clubCrestAssets(sourceRoot).paths.has(path);
 if(path.startsWith("assets/divisions/"))return validateDivisionAssets().paths.has(path);
 if(rootFiles.has(path)||divisions.includes(path))return true;
 if(path.startsWith("assets/brand/"))
  return /^assets\/brand\/[a-z0-9-]+\.(?:svg|png)$/.test(path);
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
 const files=listFiles(sourceRoot).filter(path=>isAllowlistedPublicPath(path,sourceRoot));
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
  const detail=pathname.match(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12])\/(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)\/?$/);
  if(detail)return "competitions/"+detail[1]+"/index.html";
  return (pathname.endsWith("/") ? pathname + "index.html"
    : /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + "/index.html").slice(1);
}
