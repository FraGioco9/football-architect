// Repository-local declared asset footprint; never a browser transfer metric.
import {readFileSync,statSync} from "node:fs";
import {posix} from "node:path";
import {pathToFileURL} from "node:url";

export function resolveLocalAsset(route,ref){
 if(typeof ref!=="string"||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref))return null;
 const clean=ref.split(/[?#]/,1)[0];
 if(!clean||clean.includes("\\"))return null;
 let url;
 try{url=new URL(ref,"https://example.invalid/"+route.replace(/^\/+/, ""));}
 catch{return null}
 if(url.origin!=="https://example.invalid"||!url.pathname.startsWith("/assets/"))return null;
 const segments=clean.split("/");
 if(segments.includes("..")&& !clean.startsWith("../"))return null;
 const path=decodeURIComponent(url.pathname).slice(1);
 if(!/^assets\/[a-zA-Z\d_./-]+$/.test(path)||path.split("/").includes(".."))return null;
 return path;
}

export function measureRouteDeclaredAssets(paths,read=readFileSync,sizeOf=path=>statSync(path).size){
 return paths.map(route=>{
  const html=read(route,"utf8");
  const refs=[...html.matchAll(/<(script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)].map(m=>m[2]);
  const candidates=refs.filter(ref=>/(?:^\/assets\/|^\.\.?\/assets\/|^\.\.\/assets\/)/.test(ref));
  const assetPaths=candidates.map(ref=>resolveLocalAsset(route,ref));
  const unique=[...new Set(assetPaths.filter(Boolean))];
  const unresolved=candidates.filter((ref,i)=>assetPaths[i]===null);
  const details=[];
  for(const path of unique){
   try{
    const bytes=sizeOf(path);
    if(!Number.isSafeInteger(bytes)||bytes<0)throw new RangeError("Invalid file size");
    details.push({path,bytes});
   }catch{unresolved.push(path)}
  }
  return {route,declaredReferences:candidates.length,uniqueResources:unique.length,rawBytes:details.reduce((n,x)=>n+x.bytes,0),unresolved,assets:details};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const routes=process.argv.slice(2);
 if(!routes.length){console.error("Usage: node tools/measure-declared-assets.mjs <html>...");process.exitCode=2}
 else console.log(JSON.stringify(measureRouteDeclaredAssets(routes),null,2));
}
