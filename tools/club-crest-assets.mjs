// Discover only canonical club identities and the supported passive SVG image path.
import {existsSync,lstatSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const identities=new Set(JSON.parse(readFileSync(join(ROOT,'data/clubs.json'),'utf8'))
 .map(club=>club.countryId+'-'+club.clubId));
export function clubCrestAssets(root=ROOT){
 const catalog={},paths=new Set(),directory=join(root,'assets/clubs');
 if(!existsSync(directory))return {catalog,paths};
 const walk=relative=>{
  const full=join(root,relative),stat=lstatSync(full);
  if(stat.isSymbolicLink())throw Error('Club crest symlinks are not supported: '+relative);
  if(stat.isDirectory()){
   for(const entry of readdirSync(full).sort())walk(relative+'/'+entry);
   return;
  }
  const match=relative.match(/^assets\/clubs\/([A-Z]{2,3})\/([1-9]\d*)\/crest\.svg$/);
  if(!stat.isFile()||!match||!identities.has(match[1]+'-'+match[2]))
   throw Error('Unexpected club crest asset: '+relative);
  if(!/<svg\b/.test(readFileSync(full,'utf8')))throw Error('Invalid club crest SVG: '+relative);
  catalog[match[1]+'-'+match[2]]=relative;paths.add(relative);
 };
 walk('assets/clubs');
 return {catalog,paths};
}
