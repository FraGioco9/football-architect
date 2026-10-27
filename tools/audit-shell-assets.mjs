// CLEAN-UI-03: inventory only. Do not infer that assets are unused from this list.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";


// Only report literal references; dynamic imports, template strings and DOM injection are unknown.
export function inspectStaticScriptReferences(source){
  const references=[];
  const patterns=[
    {kind:"static-import",regex:/\bimport\s+(?:[^"'\n]*?\s+from\s*)?["']([^"'\n]+)["']/g},
    {kind:"dynamic-import-literal",regex:/\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g},
    {kind:"require-literal",regex:/\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g}
  ];
  for(const {kind,regex} of patterns){
    for(const match of source.matchAll(regex))references.push({kind,specifier:match[1]});
  }
  return references;
}


export function traceLiteralPageImports(report,sourceByUrl){
  return report.pages.map(page=>{
    const roots=page.assets.filter(asset=>asset.kind==="script").map(asset=>asset.url);
    const visited=new Set(),pending=[...roots],unresolved=[];
    while(pending.length){
      const url=pending.shift();
      if(visited.has(url))continue;
      visited.add(url);
      const source=sourceByUrl[url];
      if(typeof source!=="string"){unresolved.push({url,reason:"source-unavailable"});continue;}
      for(const ref of inspectStaticScriptReferences(source)){
        if(!ref.specifier.startsWith(".")){
          unresolved.push({url,specifier:ref.specifier,reason:"non-relative-import"});
          continue;
        }
        const resolved=new URL(ref.specifier,"https://local.invalid"+url).pathname;
        if(!visited.has(resolved)&&!pending.includes(resolved))pending.push(resolved);
      }
    }
    return {route:page.route,roots,visited:[...visited],unresolved};
  });
}

export function classifyAssetReferences(assetUrls,knownPaths){
  const known=new Set(knownPaths);
  return assetUrls.map(url=>{
    const rawPath=url.split(/[?#]/,1)[0];
    const path=rawPath.startsWith("/")?rawPath.slice(1):rawPath;
    if(!path.startsWith("assets/"))return {url,path,classification:"non-asset"};
    return {url,path,classification:known.has(path)?"present":"unresolved"};
  });
}

export function comparePageAssetInventory(pages){
  const inventories=pages.map(({route,html})=>({route,assets:shellAssetInventory(html)}));
  const occurrences=new Map();
  for(const page of inventories){
    for(const asset of page.assets){
      const key=asset.kind+":"+asset.url;
      const hit=occurrences.get(key)||{...asset,routes:[]};
      if(!hit.routes.includes(page.route))hit.routes.push(page.route);
      occurrences.set(key,hit);
    }
  }
  const shared=[...occurrences.values()].filter(x=>x.routes.length===pages.length);
  const routeSpecific=[...occurrences.values()].filter(x=>x.routes.length!==pages.length);
  return {pages:inventories,shared,routeSpecific};
}


// A static advisory: this cannot resolve dynamic script injection or JS imports.
export function summarizeRouteAssets(report){
  return report.pages.map(page=>({
    route:page.route,
    scriptCount:page.assets.filter(asset=>asset.kind==="script").length,
    linkCount:page.assets.filter(asset=>asset.kind==="link").length,
    sharedCount:page.assets.filter(asset=>report.shared.some(shared=>shared.kind===asset.kind&&shared.url===asset.url)).length,
    routeSpecificAssets:page.assets.filter(asset=>report.routeSpecific.some(other=>other.kind===asset.kind&&other.url===asset.url)).map(asset=>asset.url)
  }));
}

export function auditGeneratedPages(paths,read=readFileSync){
  const pages=paths.map(path=>({route:path,html:read(path,"utf8")}));
  return comparePageAssetInventory(pages);
}

export function shellAssetInventory(template){
  const head=template.split("</head>")[0];
  const matches=[...head.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"[^>]*>/g)];
  return matches.map(match=>({url:match[1],kind:match[0].startsWith("<script")?"script":"link"}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const paths=process.argv.slice(2);
  if(paths.length>1){
    const report=auditGeneratedPages(paths);
    console.log(JSON.stringify({routes:report.pages.map(x=>x.route),shared:report.shared,routeSpecific:report.routeSpecific,summary:summarizeRouteAssets(report)},null,2));
  }else{
    const path=paths[0]||"templates/app-page.html";
    console.log(JSON.stringify({file:path,assets:shellAssetInventory(readFileSync(path,"utf8"))},null,2));
  }
}
