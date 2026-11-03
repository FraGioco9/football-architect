import {readFileSync,readdirSync,existsSync} from 'node:fs';
// CI-OPT-01: deterministic impact routing. Unknown/shared changes are FULL.
const groups=Object.freeze({
 calendar:{patterns:[/^calendar\//,/^assets\/.*calendar[^/]*\.(?:js|mjs|css)$/,/^tests\/(?:cal-|calendar-|world-calendar-)/],tests:["tests/cal-world-56a.test.mjs","tests/cal-week-init-01.test.mjs","tests/calendar-season-link.test.mjs","tests/world-calendar-navigation.test.mjs","tests/world-calendar-ui.test.mjs"]},
 clubs:{patterns:[/^clubs\//,/^assets\/club-[^/]*\.(?:js|mjs|css)$/,/^tests\/club-/],tests:["tests/club-pages.test.mjs","tests/club-competition-summary.test.mjs","tests/club-crests.test.mjs"]},
 competitions:{patterns:[/^competitions\//,/^assets\/competition-[^/]*\.(?:js|mjs|css)$/,/^tests\/competition-/],tests:["tests/competition-model.test.mjs","tests/competition-fixtures.test.mjs","tests/competition-navigation.test.mjs","tests/competition-history.test.mjs"]},
 admin:{patterns:[/^settings\/index\.html$/,/^assets\/admin-settings\.(?:js|css)$/,/^tests\/admin-settings\.test\.mjs$/],tests:["tests/admin-settings.test.mjs","tests/season-two-controls.test.mjs","tests/dev-admin-api-proxy.test.mjs"]},
 guide:{patterns:[/^guide\//,/^assets\/guide-[^/]*\.(?:js|mjs|css)$/,/^tests\/guide\.test\.mjs$/],tests:["tests/guide.test.mjs"]}
});
const reviewedTargetPaths=new Set([
 "assets/admin-settings.css",
 "assets/admin-settings.js",
 "assets/authoritative-calendar.mjs",
 "assets/calendar-simplified.js",
 "assets/club-crests.js",
 "assets/club-model.js",
 "assets/club-page.css",
 "assets/club-page.js",
 "assets/competition-awards.css",
 "assets/competition-awards.js",
 "assets/competition-fixtures.js",
 "assets/competition-history.js",
 "assets/competition-model.js",
 "assets/competition-overview-teams.mjs",
 "assets/competition-page.js",
 "assets/competition-rules-view.js",
 "assets/competition-rules.js",
 "assets/competition-stats.js",
 "assets/competition-tabs.js",
 "assets/world-calendar-model.js",
 "assets/world-calendar.js",
 "tests/admin-settings.test.mjs",
 "tests/cal-mobile-hover-01.test.mjs",
 "tests/cal-week-init-01.test.mjs",
 "tests/cal-world-56a.test.mjs",
 "tests/calendar-rule-boundary.test.mjs",
 "tests/calendar-season-link.test.mjs",
 "tests/club-competition-summary.test.mjs",
 "tests/club-crests.test.mjs",
 "tests/club-pages-browser.test.mjs",
 "tests/club-pages.test.mjs",
 "tests/competition-fixtures.test.mjs",
 "tests/competition-history.test.mjs",
 "tests/competition-manifest-v2.test.mjs",
 "tests/competition-model.test.mjs",
 "tests/competition-navigation.test.mjs",
 "tests/competition-overview-teams.test.mjs",
 "tests/competition-rules-model.test.mjs",
 "tests/competition-rules-view.test.mjs",
 "tests/competition-rules.test.mjs",
 "tests/competition-season-history-view.test.mjs",
 "tests/competition-season-rules.test.mjs",
 "tests/competition-season-zero-club-links-browser.mjs",
 "tests/competition-stats-provider.test.mjs",
 "tests/competition-stats-view.test.mjs",
 "tests/guide.test.mjs",
 "tests/world-calendar-browser.test.mjs",
 "tests/world-calendar-details.test.mjs",
 "tests/world-calendar-history-browser.test.mjs",
 "tests/world-calendar-model.test.mjs",
 "tests/world-calendar-navigation.test.mjs",
 "tests/world-calendar-ui.test.mjs"
]);
const safeDocs=/^(?:docs\/|README\.md$|\.github\/ISSUE_TEMPLATE\/)/;
const infra=/^(?:tests\/ci-opt-01-browser-smoke\.mjs$|(?:tools\/ci-opt-01-node-inventory\.mjs|tests\/ci-opt-01-node-inventory\.test\.mjs)$|\.github\/workflows\/|tools\/ci-(?:fast-scope|opt-01-impact)\.mjs$|tests\/ci-(?:fast-scope|opt-01-impact)\.test\.mjs$)/;
export function classifyImpact(changed){
 if(!Array.isArray(changed)||!changed.length||changed.some(p=>typeof p!=="string"||!p||p.startsWith("/")||p.includes("..")))return {mode:"full",area:null,tests:[]};
 const relevant=changed.filter(p=>!safeDocs.test(p));
 if(!relevant.length)return {mode:"fast",area:null,tests:[]};
 if(relevant.some(p=>infra.test(p)))return {mode:"full",area:null,tests:[]}; // Never validate CI orchestration by skipping its execution.
 if(relevant.some(p=>/^assets\/.*(?:model|provider|registry|runtime|context)[^/]*\.(?:js|mjs)$/.test(p)))return {mode:"full",area:null,tests:[]};
 if(relevant.some(p=>p.endsWith(".css")))return {mode:"full",area:null,tests:[]}; // Preserve exact-base CSS screenshot parity.
 if(relevant.some(p=>["assets/club-crests.js","assets/competition-tabs.js","assets/competition-rules.js"].includes(p)))return {mode:"full",area:null,tests:[]}; // Cross-area consumers confirmed in generator/runtime sources.
 if(relevant.some(p=>/^assets\/authoritative-[^/]+\.mjs$/.test(p)))return {mode:'full',area:null,tests:[]};
 const areas=new Set();
 for(const path of relevant){
  const canonical=/^(?:calendar\/index\.html|settings\/index\.html|guide\/index\.html|clubs\/(?:index\.html|(?:it|eng|es|de|fr|pt|nl|br)\/[1-9]\d?\/(?:overview|roster|fixtures|stats|history)\/index\.html)|competitions\/(?:index\.html|(?:it|eng|es|de|fr|pt|nl|br)-[12]\/(?:overview|standings|fixtures|stats|history|rules|awards|postseason)\/index\.html|int-[12]\/(?:overview|standings|fixtures|stats|history|rules|awards|postseason)\/index\.html))$/;
  if(!reviewedTargetPaths.has(path)&&!canonical.test(path))return {mode:'full',area:null,tests:[]};
  const matches=Object.entries(groups).filter(([,group])=>group.patterns.some(pattern=>pattern.test(path)));
  if(matches.length!==1)return {mode:"full",area:null,tests:[]};
  areas.add(matches[0][0]);
 }
 if(areas.size!==1)return {mode:"full",area:null,tests:[]};
 const area=[...areas][0];
 // Include all direct source consumers, including contracts outside a filename prefix.
 const testRoot=new URL('../tests/',import.meta.url);
 const consumers=existsSync(testRoot)?readdirSync(testRoot).filter(f=>f.endsWith('.test.mjs')).filter(f=>{
  const source=readFileSync(new URL(f,testRoot),'utf8');
  return relevant.some(path=>!path.startsWith('tests/')&&source.includes(path));
 }).map(f=>'tests/'+f):[];
 return {mode:"targeted",area,tests:[...new Set([...groups[area].tests,...consumers,...changed.filter(p=>p.startsWith("tests/")&&p.endsWith(".test.mjs"))])].sort()};
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 let selection={mode:"full",area:null,tests:[]};
 try{
  const base=process.env.PR_BASE_SHA;
  if(process.env.GITHUB_EVENT_NAME!=="pull_request"||!/^[0-9a-f]{40}$/.test(base||""))throw Error("Invalid PR base");
  const {execFileSync}=await import("node:child_process");
  const changed=execFileSync("git",["diff","--no-renames","--name-only","--diff-filter=ACDMRT",base+"...HEAD"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  selection=classifyImpact(changed);
 }catch{selection={mode:"full",area:null,tests:[]}}
 process.stdout.write("mode="+selection.mode+"\narea="+(selection.area||"")+"\ntests="+selection.tests.join(" ")+"\n");
}
