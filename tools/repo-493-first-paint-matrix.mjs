// REPO-IMPROVEMENT-01 #493 / step 05 — read-only QA inventory.
// No website, Worker, D1, fixture mutation, or browser test is launched here.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {countries,clubViews,buildRoute,parseRoute} from '../assets/routes-registry.mjs';
import {loadCompetitionCatalogue} from './competition-catalogue.mjs';

export const competitionTabs=Object.freeze(['standings','postseason','fixtures','stats','history','rules','awards']);
export const auditStates=Object.freeze([
 {id:'season-0-public',season:0,debug:'OFF'},
 {id:'season-0-debug',season:0,debug:'ON (local only)'},
 {id:'season-1-public',season:1,debug:'OFF'},
 {id:'season-1-debug',season:1,debug:'ON (local only)'}
]);
export const auditActions=Object.freeze([
 'direct-navigation','hard-refresh','in-app-view-change','season-change',
 'rapid-view-switch','back-forward','slow-or-failed-source','retry-or-reset'
]);
const sitePaths=Object.freeze([
 '/','/dashboard','/competitions','/clubs','/players','/calendar?view=season',
 '/calendar?view=week','/settings','/guide','/account','/account/login',
 '/account/register','/account/recover','/account/verify-email',
 '/admin','/admin/calendar','/admin/players'
]);
const clubs=JSON.parse(readFileSync(new URL('../data/clubs.json',import.meta.url),'utf8'));

export function createAuditInventory(){
 const definitions=loadCompetitionCatalogue();
 const competitions=definitions.map(definition=>({
  id:definition.slug,
  category:definition.category,
  routes:competitionTabs.map(view=>buildRoute({
   kind:definition.category==='international'?'cup':'competition',
   id:definition.slug,view
  }))
 }));
 const clubRoutes=clubs.flatMap(club=>clubViews.map(view=>buildRoute({
  kind:'club',country:club.countryId.toLowerCase(),id:club.clubId,view
 })));
 // 1 and 40 are samples, not an assertion about active/inactive membership.
 const sampledClubs=countries.flatMap(country=>[1,40].map(id=>{
  const club=clubs.find(c=>c.countryId.toLowerCase()===country&&c.clubId===id);
  if(!club)throw Error('Missing representative club '+country+'-'+id);
  return club;
 }));
 const sampledClubRoutes=sampledClubs.flatMap(club=>clubViews.map(view=>buildRoute({
  kind:'club',country:club.countryId.toLowerCase(),id:club.clubId,view
 })));
 if(competitions.length!==18||competitions.filter(c=>c.category==='domestic').length!==16||
    competitions.filter(c=>c.category==='international').length!==2||clubs.length!==320||
    clubRoutes.length!==1600||sampledClubs.length!==16)
  throw Error('Unexpected current football-world inventory');
 const applicationRoutes=[...new Set([...competitions.flatMap(c=>c.routes),...sampledClubRoutes,...sitePaths])];
 if(![...competitions.flatMap(c=>c.routes),...clubRoutes].every(path=>parseRoute(path)?.canonical===path))
  throw Error('Noncanonical competition/club route in QA inventory');
 return Object.freeze({
  mainCategories:{domestic:16,international:2,clubs:320},
  competitions,allClubRoutes:clubRoutes,sampledClubRoutes,sitePaths:[...sitePaths],
  applicationRoutes
 });
}

export function createAuditMatrix(){
 const inventory=createAuditInventory(),rows=[];
 for(const route of inventory.applicationRoutes){
  const category=route.startsWith('/competitions/')?'competition':
   /^\/clubs\/[^/]+\/\d+\//.test(route)?'club':'primary';
  for(const state of auditStates)for(const action of auditActions){
   rows.push({
    route,category,state:state.id,action,
    status:'UNKNOWN',evidence:'Not browser-verified for this HEAD',
    note:category==='primary'&&route.startsWith('/admin')?
      'Authentication/permission-specific checks required; Debug may be N/A':''
   });
  }
 }
 return Object.freeze({inventory,rows});
}
const cli=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(cli){
 const {inventory,rows}=createAuditMatrix();
 if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));
 else if(process.argv.includes('--csv')){
  const fields=['route','category','state','action','status','evidence','note'];
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  console.log(fields.join(','));
  for(const row of rows)console.log(fields.map(k=>quote(row[k])).join(','));
 }else console.log(JSON.stringify({
  baseline:'Read from current checkout; do not assume it matches main without exact HEAD verification',
  competitions:inventory.competitions.length,
  competitionViewRoutes:inventory.competitions.flatMap(c=>c.routes).length,
  allClubViewRoutes:inventory.allClubRoutes.length,
  sampledClubViewRoutes:inventory.sampledClubRoutes.length,
  primaryRoutes:inventory.sitePaths.length,
  representativeRoutes:inventory.applicationRoutes.length,
  states:auditStates.map(x=>x.id),actions:[...auditActions],
  unknownBrowserCases:rows.length,
  policy:'UNKNOWN is not PASS: run and record browser evidence separately'
 },null,2));
}
