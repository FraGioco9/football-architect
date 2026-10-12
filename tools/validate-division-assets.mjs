// DIV-ASSET-UI: only explicitly approved PNG/WebP assets can be rendered or published.
import {readFileSync,lstatSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=fileURLToPath(new URL("../",import.meta.url));
const EXPECTED=new Map([["IT-1","it-1-lega-federale"],["ENG-1","eng-1-crown-league"],["ES-1","es-1-liga-de-la-union"]]);
const VARIANTS=["primary","primary-dark","compact","compact-dark"];
const FORMATS=["png","webp"];
const fail=message=>{throw Error("Division assets invalid: "+message);};
export function validateDivisionAssets(root=ROOT){
 const registryPath=join(root,"data/division-assets.final.json");
 if(lstatSync(registryPath).isSymbolicLink())fail("registry symlink");
 const registry=JSON.parse(readFileSync(registryPath,"utf8"));
 if(registry.schemaVersion!==1||registry.scope!=="approved-division-logos-only"||!Array.isArray(registry.divisions)||registry.divisions.length!==3)fail("schema or count");
 const results=new Map(),paths=new Set();
 for(let index=0;index<3;index++){
  const item=registry.divisions[index],pair=[...EXPECTED][index],base=pair[1];
  if(item.id!==pair[0]||item.enabled!==true||!item.source||Object.keys(item.variants??{}).sort().join("|")!==[...VARIANTS].sort().join("|"))fail("division/variants "+index);
  if(item.id==="IT-1"&&(item.source.kind!=="git"||item.source.commit!=="855c5b0341b5aa17ea2d35f2601badc68d33163e"))fail("IT-1 source");
  const projection={};
  for(const variant of VARIANTS){
   const x=item.variants[variant];
   if(Object.keys(x??{}).sort().join("|")!=="png|webp")fail("formats "+variant);
   projection[variant]={};
   for(const ext of FORMATS){
    const record=x[ext],path=`assets/divisions/${base}/${base}-${variant}.${ext}`;
    if(record.path!==path||paths.has(path)||!/^[0-9a-f]{64}$/.test(record.sha256)||!Number.isInteger(record.bytes)||record.bytes<100)fail("record "+path);
    paths.add(path);
    const pathOnDisk=join(root,...path.split("/"));
    if(lstatSync(pathOnDisk).isSymbolicLink()||!lstatSync(pathOnDisk).isFile())fail("not ordinary file "+path);
    const raw=readFileSync(pathOnDisk),sha=createHash("sha256").update(raw).digest("hex");
    if(raw.length!==record.bytes||sha!==record.sha256)fail("integrity "+path);
    if(ext==="png"&&!raw.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))fail("png signature "+path);
    if(ext==="webp"&&(raw.toString("ascii",0,4)!=="RIFF"||raw.toString("ascii",8,12)!=="WEBP"||!raw.includes(Buffer.from("VP8L"))))fail("webp signature "+path);
    projection[variant][ext]=path;
   }
  }
  results.set(item.id,projection);
 }
 return {divisions:results,paths};
}
