/** #733 — predictable public image URLs from canonical IDs, never API links.
 * An ID is not approval: use published club membership and release-scoped
 * portrait allowlists before constructing an image request.
 */
const club=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const competition=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
export function clubCrestUrl(id,published){
 const match=typeof id==='string'?club.exec(id):null;
 return match&&published instanceof Set&&published.has(id)
  ?'/assets/clubs/'+match[1]+'/'+match[2]+'/crest.svg':null;
}
export function competitionLogoUrl(id,variant='compact'){
 return typeof id==='string'&&competition.test(id)&&['primary','compact'].includes(variant)
  ?'/assets/competitions/'+id+'/'+variant+'.svg':null;
}
export function playerPortraitUrl(id,approved){
 // Never infer V4.2 publication from a numeric ID or file existence.
 return Number.isSafeInteger(id)&&id>0&&approved instanceof Set&&approved.has(id)
  ?'/assets/players/portraits/'+id+'.webp':null;
}
