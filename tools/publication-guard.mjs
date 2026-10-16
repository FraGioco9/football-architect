// Fail-closed allowlist for future static publication artifacts.
// Do not use the repository root as a public document root.
import {readdirSync,lstatSync,readFileSync,existsSync,mkdirSync,copyFileSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {validateDivisionAssets} from "./validate-division-assets.mjs";

export const repositoryRoot=fileURLToPath(new URL("../",import.meta.url));
const required=[
 "index.html","guide/index.html","app/index.html","app/dashboard/index.html",
 "app/calendar/index.html","app/settings/index.html","app/competitions/index.html",
 "app/competitions/_shared/index.html","app/competitions/_shared/manifest.json",
 "assets/competition-page.js","assets/competition-tabs.js","assets/theme.js",
 "data/divisions.json"
];
const divisions=["it","eng","es","de","fr","pt","nl","br"]
 .flatMap(country=>[1,2].map(tier=>"app/competitions/"+country+"-"+tier+"/index.html"));
const rootFiles=new Set(["index.html","favicon.ico","favicon.svg","guide/index.html",
 "app/index.html","app/dashboard/index.html","app/calendar/index.html",
 "app/settings/index.html","app/competitions/index.html",
 "app/competitions/_shared/index.html","app/competitions/_shared/manifest.json",
 "data/divisions.json"]);
const runtimeAssets=new Set(["landing.js","landing.css","app.js","app.css",
 "app-search.js","competition-page.js","competition-tabs.js","theme.js",
]);

export function isAllowlistedPublicPath(path) {
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
 const files=listFiles(sourceRoot).filter(isAllowlistedPublicPath);
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
  if(!isAllowlistedPublicPath(path))throw Error("Not allowlisted for publication: "+path);
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
