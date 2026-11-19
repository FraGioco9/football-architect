/**
 * Fictional name-bank provenance resolver (not an ancestry classifier).
 * A name present in both country catalogues, or in neither, is ambiguous.
 */
import {loadRuntimePlayerCatalog} from './players-catalog.mjs';
let catalogue;
const norm=value=>typeof value==='string'?value.normalize('NFC').toLocaleLowerCase('und'):null;
function provenance(value,primary,secondary,banks,given){
 if(!secondary||!value)return 'unknown';
 const a=banks.get(primary),b=banks.get(secondary);
 const values=x=>given?x?.values:x;
 const matches=x=>Array.isArray(values(x))&&values(x).some(v=>norm(v)===norm(value));
 const first=matches(a),second=matches(b);
 return first===second?'unknown':first?'primary':'secondary';
}
export function resolveCatalogueNameOrigins(player){
 const primary=player?.nationality,secondary=player?.secondary_nationality;
 const banks=catalogue??(catalogue=loadRuntimePlayerCatalog());
 if(!banks.given.has(primary)||(secondary&&!banks.given.has(secondary)))
  throw new TypeError('invalid_name_catalogue_nationality');
 const parts=typeof player?.name==='string'?player.name.trim().split(/\s+/u):[];
 const first=player?.first_name??(parts.length===2?parts[0]:null);
 const last=player?.last_name??(parts.length===2?parts[1]:null);
 return Object.freeze({
  first:provenance(first,primary,secondary,banks.given,true),
  last:provenance(last,primary,secondary,banks.surnames,false)
 });
}
