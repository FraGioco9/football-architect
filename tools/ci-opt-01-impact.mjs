// CI-OPT-01: deterministic impact routing. Unknown/shared changes are FULL.
const groups=Object.freeze({
 calendar:{patterns:[/^calendar\//,/^assets\/.*calendar[^/]*\.(?:js|mjs|css)$/,/^tests\/(?:cal-|calendar-|world-calendar-)/],tests:["tests/cal-world-56a.test.mjs","tests/cal-week-init-01.test.mjs","tests/calendar-season-link.test.mjs","tests/world-calendar-navigation.test.mjs","tests/world-calendar-ui.test.mjs"]},
 clubs:{patterns:[/^clubs\//,/^assets\/club-[^/]*\.(?:js|mjs|css)$/,/^tests\/club-/],tests:["tests/club-pages.test.mjs","tests/club-competition-summary.test.mjs","tests/club-crests.test.mjs"]},
 competitions:{patterns:[/^competitions\//,/^assets\/competition-[^/]*\.(?:js|mjs|css)$/,/^tests\/competition-/],tests:["tests/competition-model.test.mjs","tests/competition-fixtures.test.mjs","tests/competition-navigation.test.mjs","tests/competition-history.test.mjs"]},
 guide:{patterns:[/^guide\//,/^assets\/guide-[^/]*\.(?:js|mjs|css)$/,/^tests\/guide\.test\.mjs$/],tests:["tests/guide.test.mjs"]}
});
const safeDocs=/^(?:docs\/|README\.md$|\.github\/ISSUE_TEMPLATE\/)/;
const infra=/^(?:tests\/ci-opt-01-browser-smoke\.mjs$|(?:tools\/ci-opt-01-node-inventory\.mjs|tests\/ci-opt-01-node-inventory\.test\.mjs)$|\.github\/workflows\/|tools\/ci-(?:fast-scope|opt-01-impact)\.mjs$|tests\/ci-(?:fast-scope|opt-01-impact)\.test\.mjs$)/;
export function classifyImpact(changed){
 if(!Array.isArray(changed)||!changed.length||changed.some(p=>typeof p!=="string"||!p||p.startsWith("/")||p.includes("..")))return {mode:"full",area:null,tests:[]};
 const relevant=changed.filter(p=>!safeDocs.test(p));
 if(!relevant.length)return {mode:"fast",area:null,tests:[]};
 if(relevant.some(p=>infra.test(p)))return {mode:"full",area:null,tests:[]}; // Never validate CI orchestration by skipping its execution.
 if(relevant.some(p=>/^assets\/.*(?:model|provider|registry|runtime|context)[^/]*\.(?:js|mjs)$/.test(p)))return {mode:"full",area:null,tests:[]};
 const areas=new Set();
 for(const path of relevant){
  const matches=Object.entries(groups).filter(([,group])=>group.patterns.some(pattern=>pattern.test(path)));
  if(matches.length!==1)return {mode:"full",area:null,tests:[]};
  areas.add(matches[0][0]);
 }
 if(areas.size!==1)return {mode:"full",area:null,tests:[]};
 const area=[...areas][0];
 return {mode:"targeted",area,tests:[...new Set([...groups[area].tests,...changed.filter(p=>p.startsWith("tests/")&&p.endsWith(".test.mjs"))])].sort()};
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 let selection={mode:"full",area:null,tests:[]};
 try{
  const base=process.env.PR_BASE_SHA;
  if(process.env.GITHUB_EVENT_NAME!=="pull_request"||!/^[0-9a-f]{40}$/.test(base||""))throw Error("Invalid PR base");
  const {execFileSync}=await import("node:child_process");
  const changed=execFileSync("git",["diff","--name-only","--diff-filter=ACDMRT",base+"...HEAD"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  selection=classifyImpact(changed);
 }catch{selection={mode:"full",area:null,tests:[]}}
 process.stdout.write("mode="+selection.mode+"\narea="+(selection.area||"")+"\ntests="+selection.tests.join(" ")+"\n");
}
