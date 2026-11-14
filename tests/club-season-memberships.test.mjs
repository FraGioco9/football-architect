import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {competitionIdsForClub,projectClubMemberships,readClubMemberships} from '../assets/club-season-source.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const world=Object.freeze({schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:20,seasonNumber:2,day:20,phase:'active'});
const entry=(competitionId,category='domestic',withNext=true)=>({
 competitionId,category,season:2,position:4,points:12,cupStatus:null,nextMatch:withNext?
  {day:21,round:7,phaseId:'league',homeId:'IT-17',awayId:'IT-2'}:null
});
function payload(memberships=[entry('IT-1'),entry('int-1','international')]){
 return {schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-17',selectedSeason:2,
  world,status:'partial',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',
   sourceRef:'club:'+world.generation+':season:2:verified'},
  data:{season:2,memberships}};
}
test('QA-16: all canonical clubs only accept their national divisions and international cups',()=>{
 const clubs=JSON.parse(read('clubs/_shared/manifest.json')).clubs;
 assert.equal(clubs.length,320);
 const nations=new Set();
 for(const club of clubs){
  const key=club.countryId+'-'+club.clubId;
  nations.add(club.countryId);
  const result=competitionIdsForClub(key);
  assert.deepEqual(result,[club.countryId+'-1',club.countryId+'-2','int-1','int-2'],key);
  assert.ok(Object.isFrozen(result),key+' candidates are immutable');
 }
 assert.equal(nations.size,8);
 for(const invalid of ['IT-0','IT-41','IT-01','XX-1','int-1','it-1','IT-1/','',null])
  assert.throws(()=>competitionIdsForClub(invalid),/Invalid club/,String(invalid));
});
test('QA-16: promoted club has current domestic and international competition in compact rows',async()=>{
 const projection=projectClubMemberships(payload(),'IT-17',2,world);
 const memberships=projection.memberships;
 assert.deepEqual(memberships.map(m=>m.competitionId),['IT-1','int-1']);
 assert.ok(memberships.every(m=>m.nextMatch?.day===21&&m.position===4));
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/17/overview');
 const html=model.render(manifest,selected,'en','',projection,2);
 assert.equal((html.match(/class="club-competition-layout club-competition-entry"/g)||[]).length,2);
 assert.match(html,/class="club-competition-list"/);
 assert.match(html,/data-club-competition-id="IT-1"/);
 assert.match(html,/data-club-competition-id="int-1"/);
 assert.match(html,/\/competitions\/it-1\/standings"/);
 assert.match(html,/\/competitions\/int-1\/fixtures\?matchday=7/);
 assert.doesNotMatch(html,/\/competitions\/it-2\/standings/,'no stale Season 1 division');
 const header=html.match(/<header class="club-header">[\s\S]*?<\/header>/)?.[0];
 assert.ok(header.includes('class="club-location"'));
 assert.ok(!header.includes('club-header-division'),'Header must not render the domestic league');
 assert.ok(!header.includes('/competitions/it-1/standings'),'Current league belongs only to Competitions');
});
test('QA-16: Sovereign and Federation Cup use International, never Competitions, as category',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/17/overview');
 const expected={en:'International',de:'International',es:'Internacional',fr:'International',it:'Internazionale'};
 for(const [lang,label] of Object.entries(expected)){
  for(const [id,name] of [['int-1','Sovereign Cup'],['int-2','Federation Cup']]){
   const projection=projectClubMemberships(payload([entry('IT-1'),entry(id,'international',false)]),'IT-17',2,world);
   const html=model.render(manifest,selected,lang,'',projection,2);
   const row=html.match(new RegExp('<div class="club-competition-layout club-competition-entry" data-club-competition-id="'+id+'"[^]*?(?=<div class="club-competition-layout club-competition-entry"|<\\/section>)'))?.[0];
   assert.ok(row,lang+' '+id+' row exists');
   assert.ok(row.includes(name),lang+' '+id+' shows the correct cup');
   assert.ok(row.includes('<span class="club-competition-tier">'+label+'</span>'),lang+' '+id+' has correct international category');
   assert.ok(!row.includes('<span class="club-competition-tier">'+model.copies[lang].competition+'</span>'),lang+' '+id+' does not reuse the section title');
  }
 }
});

test('QA-16: Debug ON and OFF use identical competition row markup with one or two memberships',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/17/overview');
 const dev={source:'dev',divisionId:'IT-2',clubId:17,season:2,position:4,points:12,
  nextMatch:{round:7,homeId:17,awayId:2}};
 const publicOne=projectClubMemberships(payload([entry('IT-2')]),'IT-17',2,world);
 const publicTwo=projectClubMemberships(payload([entry('IT-2'),entry('int-1','international')]),'IT-17',2,world);
 const cases=[['debug-on',model.render(manifest,selected,'en','',dev,2),1],
  ['debug-off-one',model.render(manifest,selected,'en','',publicOne,2),1],
  ['debug-off-two',model.render(manifest,selected,'en','',publicTwo,2),2]];
 const panel=html=>{
  const begin=html.indexOf('<section class="app-panel club-competition"');
  const end=html.indexOf('</section>',begin);
  assert.ok(begin>=0&&end>begin,'Competitions panel exists');
  return html.slice(begin,end);
 };
 const rowIds=html=>[...panel(html).matchAll(/class="club-competition-layout club-competition-entry" data-club-competition-id="([^"]+)"/g)].map(x=>x[1]);
 for(const [source,html,count] of cases){
  const htmlPanel=panel(html);
  assert.equal((htmlPanel.match(/class="club-competition-list"/g)||[]).length,1,source+' must use canonical list');
  assert.equal(rowIds(html).length,count,source+' has correct membership count');
  for(const className of ['club-competition-identity','club-competition-name','club-competition-summary',
   'club-competition-metrics','club-competition-next','club-competition-next-content'])
   assert.equal((htmlPanel.match(new RegExp('class="'+className+'"','g'))||[]).length,count,
    source+' uses the identical '+className+' markup');
  assert.doesNotMatch(htmlPanel,/class="club-competition-layout"/,'legacy unstyled singleton forbidden');
 }
 assert.deepEqual(rowIds(cases[0][1]),['IT-2']);
 assert.deepEqual(rowIds(cases[1][1]),['IT-2']);
 assert.deepEqual(rowIds(cases[2][1]),['IT-2','int-1']);
 assert.match(panel(cases[0][1]),/data-club-position>4th<\/dd>/,'DEV position retained');
 assert.match(panel(cases[2][1]),/data-club-competition-id="int-1"/,'authoritative international membership retained');
});

test('QA-16: single-request protocol validates authoritative data, future matches and ownership',async()=>{
 const calls=[];
 const readJson=async url=>{
  calls.push(url);
  const previous={...payload([]),selectedSeason:1,status:'available',
   provenance:{...payload().provenance,sourceRef:'club:'+world.generation+':season:1:verified'},
   data:{season:1,memberships:[]}};
  return {schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-17',world,
   status:'available',reason:null,provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',
    sourceRef:'club-history:'+world.generation+':revision:'+world.revision},
   data:{overviews:[previous,payload()]}};
 };
 const loaded=await readClubMemberships({clubKey:'IT-17',world,fetchJson:readJson});
 assert.deepEqual(calls,['/api/clubs/IT-17/history']);
 assert.deepEqual(loaded.memberships.map(m=>m.competitionId),['IT-1','int-1']);
 assert.throws(()=>projectClubMemberships({...payload(),world:{...world,revision:18}},'IT-17',2,world),/Invalid authoritative/);
 assert.throws(()=>projectClubMemberships(payload([entry('IT-1'),entry('IT-2')]),'IT-17',2,world),/Incomplete or duplicate/);
 assert.throws(()=>projectClubMemberships(payload([entry('IT-1'),entry('IT-1')]),'IT-17',2,world),/Unverified membership/);
 assert.throws(()=>projectClubMemberships(payload([entry('IT-1','domestic',false),
  {...entry('int-1','international'),nextMatch:{...entry('int-1','international').nextMatch,day:20}}]),'IT-17',2,world),/Unverified upcoming fixture/);
 assert.throws(()=>projectClubMemberships({...payload(),provenance:{kind:'none',resultAuthority:null,sourceRef:null}},'IT-17',2,world),/Invalid authoritative/);
 const inactive=projectClubMemberships(payload([]),'IT-17',2,world);
 assert.deepEqual(inactive.memberships,[],'inactive clubs have verified no memberships, not an error');
});
test('QA-16: international status shows verified bracket phases, not stale league ranks',async()=>{
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/17/overview');
 const statuses={
  groupStage:'Group Stage',playoffs:'Playoffs',quarterfinals:'Quarter-finals',
  semifinals:'Semi-finals',final:'Final',winner:'Winner',runnerUp:'Runner-up'
 };
 for(const [status,label] of Object.entries(statuses)){
  const projected=projectClubMemberships(payload([entry('IT-1'),
   {...entry('int-1','international',false),cupStatus:status}]),'IT-17',2,world);
  const html=model.render(manifest,selected,'en','',projected,2);
  assert.ok(html.includes('data-club-position>'+label+'</dd>'),status);
 }
 assert.throws(()=>projectClubMemberships(payload([entry('IT-1'),
  {...entry('int-1','international'),cupStatus:'winner-before-final'}]),'IT-17',2,world),/Unverified membership/);
 assert.throws(()=>projectClubMemberships(payload([{...entry('IT-1'),cupStatus:'winner'}]),'IT-17',2,world),/Unverified membership/);
 const italian=projectClubMemberships(payload([entry('IT-1'),
  {...entry('int-1','international',false),cupStatus:'quarterfinals'}]),'IT-17',2,world);
 assert.ok(model.render(manifest,selected,'it','',italian,2).includes('data-club-position>Quarti di finale</dd>'));
});
test('QA-16: unpublished season is not a broken club or an inactive club',async()=>{
 const unpublished={...payload(),status:'empty',reason:'calendar-unpublished',provenance:{
  kind:'none',resultAuthority:null,sourceRef:null},data:null};
 const projected=projectClubMemberships(unpublished,'IT-17',2,world);
 assert.equal(projected.coverage,'unpublished');
 assert.deepEqual(projected.memberships,[]);
 const {default:model}=await import('../assets/club-model.js');
 const manifest=JSON.parse(read('clubs/_shared/manifest.json'));
 const selected=model.route('/clubs/it/17/overview');
 for(const lang of ['en','de','es','fr','it']){
  const html=model.render(manifest,selected,lang,'',projected,2);
  assert.ok(html.includes(model.copies[lang].competitionUnpublished),'Unpublished state is localized');
  assert.doesNotMatch(html,/data-club-competition-id=|data-club-position>|club-competition-logo/);
  const failure=model.render(manifest,selected,lang,'',{source:'unavailable'},2);
  assert.ok(failure.includes(model.copies[lang].competitionUnavailable),'Only competitions are unavailable');
  assert.ok(!failure.includes(model.copies[lang].error),'Do not report the whole club as unavailable');
 }
 assert.throws(()=>projectClubMemberships({...unpublished,provenance:payload().provenance},'IT-17',2,world),/Invalid unpublished/);
 assert.throws(()=>projectClubMemberships({...unpublished,reason:'unverified'},'IT-17',2,world),/Invalid unpublished/);
 assert.throws(()=>projectClubMemberships({...unpublished,world:{...world,revision:21}},'IT-17',2,world),/Invalid authoritative/);
});
test('QA-16: Season 0 requires no API request or invented membership',async()=>{
 const unstarted={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',
  revision:0,seasonNumber:0,day:0,phase:'unstarted'};
 const result=await readClubMemberships({clubKey:'IT-17',world:unstarted,
  fetchJson:()=>{throw Error('Unexpected request')}});
 assert.equal(result.coverage,'unstarted');
 assert.deepEqual(result.memberships,[]);
});
test('QA-16: first paint panels, flags and short anonymous skeletons are preserved',()=>{
 const html=read('clubs/_shared/index.html'),generator=read('tools/generate-club-pages.mjs'),css=read('assets/club-page.css');
 const first=html.indexOf('<div class="club-overview-layout club-first-paint-overview"');
 assert.ok(first>0);
 const end=html.indexOf('<section class="club-history club-first-paint-panel club-first-paint-other"',first);
 assert.ok(end>first,'History first paint follows the overview identity and competitions');
 const part=html.slice(first,end);
 assert.equal((part.match(/class="app-panel /g)||[]).length,3);
 assert.ok(part.includes('class="club-fp-bar"'));
 const facts=part.slice(part.indexOf('<dl class="club-facts">'),part.indexOf('</dl>',part.indexOf('<dl class="club-facts">'))+5);
 const labels=[...facts.matchAll(/<dt data-club-first-paint-label="([^"]+)">([^<]+)<\/dt><dd(?: data-club-first-paint-value="[^"]+")?>/g)];
 assert.equal(labels.length,9,'All nine identity labels are static before manifest');
 assert.deepEqual(labels.map(x=>x[1]),['nameLabel','country','city','abbr','colorsLabel','nickname','stadium','rivalriesLabel','descriptionLabel']);
 assert.doesNotMatch(part,/<dt[^>]*><span class="club-fp-bar"/,'Never skeleton a label');
 assert.equal((part.match(/class="club-fp-bar(?: |")/g)||[]).length,15,'Anonymous identity and competition values reserve the final row geometry');
 assert.match(part,/<dt data-club-first-paint-label="abbr">Abbreviation<\/dt><dd><span class="club-fp-bar club-fp-abbr" aria-hidden="true"><\/span>/);
 const colors=part.match(/<dd><span class="club-colors club-fp-colors" aria-hidden="true">([\s\S]*?)<\/span><\/dd>/)?.[1];
 assert.ok(colors,'Colors reserve the final two-swatch layout');
 assert.equal((colors.match(/class="club-color club-fp-color-swatch"/g)||[]).length,2);
 assert.equal((colors.match(/class="club-fp-bar club-fp-hex"/g)||[]).length,2);
 assert.match(css,/\.club-first-paint-panel \.club-fp-abbr\{inline-size:3ch;/);
 assert.match(css,/\.club-first-paint-panel \.club-fp-hex\{inline-size:7ch;/);
 assert.match(css,/\.club-first-paint-panel \.club-fp-color-swatch\{/);
 for(const key of ['nameLabel','country','city'])assert.ok(part.includes('data-club-first-paint-value="'+key+'"'));
 const kits=part.match(/<aside class="app-panel club-kits club-first-paint-panel"[\s\S]*?<\/aside>/)?.[0];
 assert.ok(kits?.includes('data-club-first-paint-label="kitsPending"'));
 assert.doesNotMatch(kits,/club-fp-bar|aria-busy/,'Kits message is static, never loading');
 assert.ok(part.includes('data-club-first-paint-label="statusLabel"'));
 assert.ok(part.includes('data-club-first-paint-label="nextMatchLabel"'));

 assert.ok(part.includes('data-club-first-paint-title="competitions"'));
 assert.ok(html.includes("dataset.clubShellReady='true'"),'route shell ready before catalog');
 assert.ok(!html.includes("header.querySelector('.club-first-paint-flag').outerHTML=flagSvg"),'no preloaded identity artwork');
 assert.ok(!html.includes('class="club-header-division"'),'First paint must not reserve a league row');
 assert.doesNotMatch(generator,/class="club-header-division"/);
 assert.doesNotMatch(generator,/safeJSON\(manifest\.countryFlags\)/,'identity flags are fetched with manifest');
 assert.match(css,/\.club-first-paint-panel\{min-height:160px;visibility:visible\}/);
 assert.match(css,/\.club-first-paint-panel \.club-fp-bar\{max-inline-size:124px\}/);
 assert.match(css,/\.club-competition-list \.club-competition-entry\{/);
 assert.match(css,/\.club-first-paint-header h1\{min-height:1\.15em\}/);
 assert.doesNotMatch(css,/\.club-header-division/);
});
test('QA-16: no parallel competition or redundant world requests; publication gate remains',()=>{
 const client=read('assets/club-page.js'),source=read('assets/club-season-source.mjs'),guard=read('tools/publication-guard.mjs');
 const backend=read('backend/src/public-sporting-read.ts'),route=read('backend/src/index.ts');
 assert.match(source,/\/api\/clubs\/.*\/history/);
 assert.doesNotMatch(source,/\/api\/competitions\//);
 assert.doesNotMatch(client,/publicManifest\(\)/);
 assert.doesNotMatch(client,/publicJson\('\/api\/world'/);
 assert.match(client,/now\.sourceRevision!==current\.sourceRevision/);
 assert.match(client,/applyCompetitionSnapshot\(verified\)/);
 assert.match(client,/await import\('\/assets\/world-clock-adapter\.js'\)/);
 assert.match(backend,/readPublicClubHistory/);
 assert.match(route,/readPublicClubHistory\(requireDatabase\(env\.DB\)/);
 assert.ok(guard.includes('"club-season-source.mjs"'));
});
