// Protected Debug is a separate, immutable artifact contract. It is never public.
import {createHash} from "node:crypto";
import {existsSync,lstatSync,realpathSync,readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {join,resolve,dirname,sep} from "node:path";
import {repositoryRoot,planPublicFiles,listFiles} from "./publication-guard.mjs";

export const ARTIFACT_CONTRACTS=Object.freeze(["public","protected_debug"]);
export const DEBUG_SEASONS=Object.freeze([1,2,3,4]); // Fictional Preview only, never official competition history.
export const DEBUG_SEASON_BOOTSTRAP='<script>document.documentElement.dataset.faDevDefaultSeason="1";document.documentElement.dataset.faDevSeasons="'+DEBUG_SEASONS.join(",")+'";(()=>{let season=1;try{const value=Number(sessionStorage.getItem("football-architect:standings-dev-season"));if(Number.isInteger(value)&&value>=1&&value<=4)season=value}catch{}document.documentElement.dataset.faDevCurrentSeason=String(season)})()</script>';
const MANIFEST="__fa_dev__/artifact-manifest.json";
// Injected only into DEV responses/artifacts, before the body can paint.
export const DEBUG_FIRST_PAINT="<style>html[data-fa-debug-pending=\"true\"] .app-world-standings,html[data-fa-debug-pending=\"true\"] #competition-panel-fixtures,html[data-fa-debug-pending=\"true\"] #competition-panel-history{visibility:hidden}</style><script>(()=>{let timer;const release=()=>{delete document.documentElement.dataset.faDebugPending;clearTimeout(timer)};window.faDebugFirstPaintRelease=release;try{if(/^\\/competitions\\/(?:it|eng|es|de|fr|pt|nl|br)-[12](?:\\/(?:index\\.html)?)?$/.test(location.pathname)){document.documentElement.dataset.faDebugPending=\"true\";timer=setTimeout(release,10000)}}catch{release()}})();</script>";
export const CLUB_SUMMARY_INJECTION='<script type="module" src="/__fa_dev__/debug-settings.mjs"></script><script type="module" data-fa-dev-club-summary src="/__fa_dev__/stats-client.mjs"></script>';
const INJECTION='<script type="module" src="/__fa_dev__/debug-settings.mjs"></script><script type="module" src="/__fa_dev__/stats-client.mjs"></script>';
const DEBUG_ASSETS=Object.freeze([
 ["__fa_dev__/debug-settings.mjs","tools/dev-debug-settings.mjs"],
 ["__fa_dev__/standings-client.mjs","tools/dev-standings-preview-client.mjs"],
 ["__fa_dev__/debug-widget.mjs","tools/dev-debug-widget.mjs"],
  ["__fa_dev__/dev-world-clock.mjs","tools/dev-world-clock.mjs"],
 ["__fa_dev__/standings-data.mjs","tools/dev-standings-preview-data.mjs"],
 ["__fa_dev__/dev-standings-preview-data.mjs","tools/dev-standings-preview-data.mjs"],
 ["__fa_dev__/stats-client.mjs","tools/dev-competition-stats-client.mjs"],
 ["__fa_dev__/stats-data.mjs","tools/dev-competition-stats-data.mjs"]
]);

export function assertArtifactContract(contract) {
 if(!ARTIFACT_CONTRACTS.includes(contract))throw Error("Unrecognized artifact contract");
 return contract;
}

function safeDebugBytes(root,path) {
 const base=realpathSync(root);
 let file=base;
 try {
  for(const segment of path.split("/")){
   if(!segment||segment==="."||segment==="..")throw Error("Unsafe debug path");
   file=join(file,segment);
   if(lstatSync(file).isSymbolicLink())throw Error("Debug symlink forbidden: "+path);
  }
  if(!lstatSync(file).isFile()||!realpathSync(file).startsWith(base+sep))
   throw Error("Unsafe debug source: "+path);
  return readFileSync(file);
 }catch(error){
  throw Error("Missing or unsafe protected Debug source: "+path,{cause:error});
 }
}

function debugHtml(bytes,path) {
 if(path==='clubs/_shared/index.html'){
  const html=bytes.toString('utf8');
  if(html.split('</head>').length!==2||html.includes('/__fa_dev__/'))throw Error('Unsafe protected club HTML');
  return Buffer.from(html.replace('</head>',CLUB_SUMMARY_INJECTION+'\n</head>'),'utf8');
 }
 if(!/^(?:dashboard|calendar|settings|competitions)\//.test(path)||!path.endsWith("/index.html"))return bytes;
 let html=bytes.toString("utf8");
 if(html.split("</head>").length!==2||html.includes("/__fa_dev__/"))
  throw Error("Unsafe protected Debug HTML: "+path);
 const detail=/^competitions\/(?:it|eng|es|de|fr|pt|nl|br)-[12]\/index\.html$/.test(path);
 const calendarClock=path==="calendar/index.html"?'<script>window.faDevCalendarClockSnapshot={source:{kind:"dev",reference:"fictional protected Debug calendar"},current:{season:1,day:1}};</script>':"";
 if(calendarClock)html=html.replace('<script data-calendar-bootstrap>',calendarClock+'<script data-calendar-bootstrap>');
 return Buffer.from(html.replace("</head>",
  DEBUG_FIRST_PAINT+(detail||path==="competitions/index.html"||path==="calendar/index.html"?DEBUG_SEASON_BOOTSTRAP:"")+INJECTION+"\n</head>"),"utf8");
}

function expectedBytes(sourceRoot,debugRoot) {
 const publicFiles=planPublicFiles(sourceRoot);
 const result=new Map();
 let injected=0;
 for(const path of publicFiles){
  const original=readFileSync(join(sourceRoot,path));
  const bytes=debugHtml(original,path);
  if(bytes!==original)injected++;
  result.set(path,bytes);
 }
 if(injected<1)throw Error("No app pages available for protected Debug injection");
 for(const [destination,source] of DEBUG_ASSETS){
  if(result.has(destination))throw Error("Debug path collides with public artifact");
  result.set(destination,safeDebugBytes(debugRoot,source));
 }
 const files=[...result.keys()].sort().map(path=>({
  path,sha256:createHash("sha256").update(result.get(path)).digest("hex")
 }));
 result.set(MANIFEST,Buffer.from(JSON.stringify({
  schemaVersion:1,contract:"protected_debug",files
 })+"\n","utf8"));
 return result;
}

export function planProtectedDebugFiles(sourceRoot=repositoryRoot,{debugRoot=sourceRoot}={}) {
 return [...expectedBytes(sourceRoot,debugRoot).keys()].sort();
}

export function assertProtectedDebugArtifact(destination,{sourceRoot=repositoryRoot,debugRoot=sourceRoot}={}) {
 if(resolve(destination)===resolve(sourceRoot)||resolve(destination)===resolve(debugRoot))
  throw Error("Repository or Debug root cannot be a protected artifact");
 if(!existsSync(destination))throw Error("Protected Debug artifact missing");
 const expected=expectedBytes(sourceRoot,debugRoot);
 const actual=listFiles(destination);
 const planned=[...expected.keys()].sort();
 for(const path of actual)
  if(!expected.has(path))throw Error("Not allowlisted in protected Debug artifact: "+path);
 if(actual.length!==planned.length||actual.some((path,index)=>path!==planned[index]))
  throw Error("Protected Debug artifact does not match exact manifest");
 for(const path of planned)
  if(!readFileSync(join(destination,path)).equals(expected.get(path)))
   throw Error("Protected Debug artifact source mismatch: "+path);
 return actual;
}

export function stageProtectedDebugArtifact(sourceRoot,destination,{debugRoot=sourceRoot}={}) {
 if(resolve(destination)===resolve(sourceRoot)||resolve(destination)===resolve(debugRoot))
  throw Error("Repository or Debug root cannot be a protected artifact");
 if(existsSync(destination))throw Error("Refusing to overwrite protected Debug artifact");
 // Resolve all inputs and generate the manifest before writing any output.
 const expected=expectedBytes(sourceRoot,debugRoot);
 for(const [path,bytes] of expected){
  const target=join(destination,path);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,bytes);
 }
 return assertProtectedDebugArtifact(destination,{sourceRoot,debugRoot});
}
