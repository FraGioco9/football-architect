// Source-size inventory only; not a browser network-transfer or performance measurement.
import {readFileSync,statSync} from "node:fs";
import {pathToFileURL} from "node:url";
export function measureRouteDeclaredAssets(paths,read=readFileSync,sizeOf=path=>statSync(path).size){
 return paths.map(route=>{
  const html=read(route,"utf8");
  const assetPaths=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\/assets\/[^"]+)"[^>]*>/g)].map(x=>x[1].slice(1));
  const unique=[...new Set(assetPaths)];
  const unresolved=[],details=[];
  for(const path of unique){
   try{
    const bytes=sizeOf(path);
    if(!Number.isSafeInteger(bytes)||bytes<0)throw new RangeError("Invalid file size");
    details.push({path,bytes});
   }catch{unresolved.push(path)}
  }
  return {route,declaredReferences:assetPaths.length,uniqueResources:unique.length,rawBytes:details.reduce((n,x)=>n+x.bytes,0),unresolved,assets:details};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const routes=process.argv.slice(2);
 if(!routes.length){console.error("Usage: node tools/measure-declared-assets.mjs <html>...");process.exitCode=2}
 else console.log(JSON.stringify(measureRouteDeclaredAssets(routes),null,2));
}
