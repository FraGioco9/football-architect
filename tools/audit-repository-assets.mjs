// Conservative repository asset reference inventory. No writes or deletion recommendations.
import {readdirSync,readFileSync} from "node:fs";
import {join,relative,extname} from "node:path";
import {pathToFileURL} from "node:url";
const textExt=new Set([".html",".js",".mjs",".css",".json",".md",".csv",".yml",".yaml",".svg"]);
export function inventoryAssetReferences(root=".",io={readdirSync,readFileSync}){
  const paths=[];
  function walk(dir){
    for(const e of io.readdirSync(join(root,dir),{withFileTypes:true})){
      const p=join(dir,e.name).replaceAll("\\","/");
      if(e.isDirectory()){if(![".git","node_modules",".next","dist"].includes(e.name))walk(p)}
      else if(e.isFile())paths.push(p);
    }
  }
  walk(".");
  const assets=paths.filter(p=>p.startsWith("assets/"));
  const sources=paths.filter(p=>textExt.has(extname(p).toLowerCase()));
  const mentions=new Map(assets.map(p=>[p,[]]));
  const sourceText=new Map();
  for(const source of sources){
    let text;
    try{text=io.readFileSync(join(root,source),"utf8")}catch{continue}
    sourceText.set(source,text);
  }
  for(const asset of assets){
    const basename=asset.split("/").pop();
    const pathsToFind=[asset,"/"+asset];
    for(const [source,text] of sourceText){
      if(source===asset)continue;
      if(pathsToFind.some(p=>text.includes(p)))mentions.get(asset).push(source);
    }
  }
  return {
    totalFiles:paths.length,totalAssets:assets.length,sourceFilesScanned:sourceText.size,
    explicitlyReferenced:assets.filter(p=>mentions.get(p).length).length,
    unresolved:assets.filter(p=>!mentions.get(p).length).map(path=>({
      path,reason:path.startsWith("assets/flags/")?"flag-code-resolved-dynamically":path.startsWith("assets/clubs/")?"crest-path-resolved-dynamically":path.startsWith("assets/divisions/")?"division-artwork-catalogue-or-generator":"requires-dynamic-and-publication-review"
    })),
    sampleReferences:assets.filter(p=>mentions.get(p).length).slice(0,30).map(path=>({path,referencedBy:mentions.get(path).slice(0,4)}))
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(inventoryAssetReferences(process.argv[2]||"."),null,2));
}
