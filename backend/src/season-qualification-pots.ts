/** Season-independent INT24 pot construction from approved qualified club IDs.
 * Three actual qualifiers per nation per cup. Never infer ranking from club ID.
 */
import {ApiError} from './errors.ts';
export const internationalCountries=['IT','ENG','ES','DE','FR','PT','NL','BR'] as const;
const fail=():never=>{throw new ApiError(422,'schedule_invalid')};
export function qualificationPots(clubs:readonly string[],countryOrder:readonly string[]){
 if(clubs.length!==24||new Set(clubs).size!==24||countryOrder.length!==8||
  new Set(countryOrder).size!==8||internationalCountries.some(c=>!countryOrder.includes(c)))return fail();
 const byCountry=new Map(internationalCountries.map(c=>[c,clubs.filter(id=>id.startsWith(c+'-'))]));
 if([...byCountry.values()].some(ids=>ids.length!==3))return fail();
 return Object.freeze(Array.from({length:3},(_,p)=>Object.freeze(countryOrder.map(c=>byCountry.get(c)![p]))));
}
