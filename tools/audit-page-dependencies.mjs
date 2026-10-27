// Read-only generated-route dependency report. Conservative: unresolved != unused.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {auditGeneratedPages,inspectStaticScriptReferences} from "./audit-shell-assets.mjs";

export function scanRouteDependencyFiles(routes,read=readFileSync){
  const report=auditGeneratedPages(routes,read);
  const results=[];
  for(const page of report.pages){
    const roots=page.assets.filter(x=>x.kind==="script").map(x=>x.url);
    const visited=new Set(),unresolved=[],queue=[...roots];
    while(queue.length){
      const url=queue.shift();
      if(visited.has(url))continue;
      visited.add(url);
      if(!/^\/assets\/[a-zA-Z0-9_./-]+\.(?:js|mjs)$/.test(url)||url.split("/").includes("..")){
        unresolved.push({url,reason:"nonlocal-or-unsafe"});continue;
      }
      let source;
      try{source=read(url.slice(1),"utf8");}
      catch{unresolved.push({url,reason:"missing-source"});continue;}
      for(const ref of inspectStaticScriptReferences(source)){
        if(!ref.specifier.startsWith(".")){
          unresolved.push({url,specifier:ref.specifier,reason:"nonrelative-import"});continue;
        }
        const resolved=new URL(ref.specifier,"https://audit.invalid"+url).pathname;
        if(!visited.has(resolved))queue.push(resolved);
      }
    }
    results.push({route:page.route,roots,visited:[...visited],unresolved,confidence:"literal-imports-only"});
  }
  return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const routes=process.argv.slice(2);
  if(!routes.length){console.error("Usage: node tools/audit-page-dependencies.mjs <generated-html>...");process.exitCode=2;}
  else console.log(JSON.stringify(scanRouteDependencyFiles(routes),null,2));
}
