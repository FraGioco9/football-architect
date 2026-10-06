/** UX2-01: view-only navigation registry.
 * Stable page IDs are part of the existing action contract, not the save schema.
 * This module never accesses career storage or the browser.
 */
export const NAV_GROUPS = Object.freeze([
  {id:'start',it:'Inizio',en:'Home',items:[
    {id:'dashboard',icon:'grid',it:'Scrivania',en:'Dashboard'},
    {id:'calendar',icon:'calendar',it:'Calendario',en:'Calendar'},
    {id:'inbox',icon:'mail',it:'Posta',en:'Inbox'}]},
  {id:'team',it:'Squadra',en:'Team',items:[
    {id:'club',icon:'shield',it:'Club',en:'Club'},
    {id:'squad',icon:'users',it:'Rosa',en:'Squad'},
    {id:'tactics',icon:'tactics',it:'Tattiche',en:'Tactics'},
    {id:'training',icon:'activity',it:'Allenamento',en:'Training'},
    {id:'youth',icon:'users',it:'Vivaio',en:'Academy'}]},
  {id:'competitions',it:'Competizioni',en:'Competitions',items:[
    {id:'league',icon:'trophy',it:'Campionato',en:'League'},
    {id:'world',icon:'globe',it:'Mondo',en:'World'},
    {id:'advanced',icon:'chart',it:'Analisi avanzata',en:'Advanced analysis'}]},
  {id:'management',it:'Gestione',en:'Management',items:[
    {id:'market',icon:'transfer',it:'Mercato',en:'Transfer market'},
    {id:'finance',icon:'wallet',it:'Finanze',en:'Finances'},
    {id:'board',icon:'shield',it:'Dirigenza',en:'Board'},
    {id:'manager',icon:'users',it:'Allenatore',en:'Manager'}]},
  {id:'system',it:'Sistema',en:'System',items:[
    {id:'settings',icon:'settings',it:'Impostazioni',en:'Settings'},
    {id:'careers',icon:'save',it:'Carriere',en:'Careers'}]}
]);
export const NAV_PAGE_IDS = Object.freeze(NAV_GROUPS.flatMap(group=>group.items.map(item=>item.id)));
export const QUICK_NAV_IDS = Object.freeze(['dashboard','calendar','squad','tactics','market']);
export function navItem(page){return NAV_GROUPS.flatMap(group=>group.items).find(item=>item.id===page)||null;}
export function navGroup(page){return NAV_GROUPS.find(group=>group.items.some(item=>item.id===page))||null;}
export function isNavigationPage(page){return NAV_PAGE_IDS.includes(page);}
export function navigationLabels(page,lang='it'){
  const item=navItem(page),group=navGroup(page),locale=lang==='en'?'en':'it';
  return item?{page:item[locale],group:group[locale]}:null;
}
/** When the route changes, its group must be expanded to expose aria-current. */
export function isGroupExpanded(groupId,activePage,opened={}){
  return navGroup(activePage)?.id===groupId ||
    (Object.hasOwn(opened,groupId)?opened[groupId]:groupId==='start');
}
