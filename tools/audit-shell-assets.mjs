// CLEAN-UI-03: inventory only. Do not infer that assets are unused from this list.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

export function shellAssetInventory(template){
  const head=template.split("</head>")[0];
  const matches=[...head.matchAll(/<(?:script|link)\\b[^>]*?(?:src|href)="([^"]+)"[^>]*>/g)];
  return matches.map(match=>({url:match[1],kind:match[0].startsWith("<script")?"script":"link"}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2]||"templates/app-page.html";
  console.log(JSON.stringify({file:path,assets:shellAssetInventory(readFileSync(path,"utf8"))},null,2));
}
