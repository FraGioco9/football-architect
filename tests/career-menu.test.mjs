import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LEAGUES,getLeagueClubs} from '../src/leagues.js';
import {createSession,advanceSession,advanceMinutes,sessionTime,validSession,SAVE_KEY} from '../src/simulation.js';
import {nextScheduledClubFixture,createFixtureCalendarCache} from '../src/fixture-calendar.js';
import {searchCareer} from '../src/global-search.js';
import {CAREER_DB,EXPORT_FORMAT,openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport} from '../src/career-store.js';
import {layout,homePage,managerPage,countryPage,championshipPage,teamsPage,careersPage,settingsPage,simulationPage,calendarPage,countryFlag} from '../src/ui-pages.js';
import {languagePicker} from '../src/language-picker.js';
import {icon} from '../src/icons.js';
import {feedback,fromError,feedbackText,renderFeedback,renderBlockingError} from '../src/feedback.js';
import {MANAGER_PROFILE_FIELDS,blankManagerProfile,normalizeManagerProfile,managerFullName,managerProfileIssues,validManagerProfile,managerAge} from '../src/manager-profile.js';
import * as typeaheadFns from '../src/site-pickers.js';
import {NATIONALITY_CODES,nationalityOptions,isNationalityCode,initialCalendarMonth,shiftCalendarMonth,calendarDays,calendarGridDays,birthDateLabel} from '../src/site-pickers.js';
import {renderDateControl,renderNationalityControl} from '../src/site-picker-ui.js';

class FakeDB{
 constructor(){this.data=new Map();this.objectStoreNames={contains:key=>this.data.has(key)};}
 createObjectStore(name){this.data.set(name,new Map());}
 close(){}
 transaction(names,mode){
  const writable=mode==='readwrite',stages=new Map(names.map(n=>[n,new Map(this.data.get(n))]));
  let pending=0,completed=false,aborted=false;
  const tx={oncomplete:null,onerror:null,onabort:null,error:null,abort(){
   if(aborted||completed)return;aborted=true;queueMicrotask(()=>tx.onabort?.());
  }};
  const complete=()=>{if(pending!==0||completed||aborted)return;
    queueMicrotask(()=>{if(pending!==0||completed||aborted)return;completed=true;
     if(writable)for(const [name,data] of stages)this.data.set(name,data);
     tx.oncomplete?.();
    });
  };
  tx.objectStore=name=>{
   if(!stages.has(name))throw Error('UNKNOWN_STORE');
   const data=stages.get(name);
   const request=fn=>{
    const req={onsuccess:null,onerror:null,error:null,result:undefined};pending++;
    queueMicrotask(()=>{
     if(aborted)return;
     try{req.result=fn();req.onsuccess?.({target:req});}
     catch(e){req.error=e;req.onerror?.({target:req});tx.error=e;tx.abort();}
     finally{pending--;complete();}
    });
    return req;
   };
   return {
    get:key=>request(()=>structuredClone(data.get(key))),
    getAll:()=>request(()=>Array.from(data.values()).map(x=>structuredClone(x))),
    put:item=>request(()=>{if(!writable)throw Error('READONLY');data.set(item.id??item.key,structuredClone(item));return item.id??item.key;}),
    delete:key=>request(()=>{if(!writable)throw Error('READONLY');data.delete(key);})
   };
  };
  return tx;
 }
}
const createFactory=()=>{
 let database=null;
 return {open(name,version){
  assert.equal(name,CAREER_DB);assert.equal(version,1);
  const req={result:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
  queueMicrotask(()=>{
   if(!database){database=new FakeDB();req.result=database;req.onupgradeneeded?.();}
   else req.result=database;
   req.onsuccess?.();
  });
  return req;
 }};
};
let counter=0;
const mkId=()=>('fixture-career-'+String(++counter).padStart(7,'0'));
const setup=async()=>openCareerDatabase(createFactory());
const form=(managerName='Mario Rossi',countryId='IT',clubId=1,date='2026-10-08')=>({
 managerName,countryId,clubId,legacyImport:true,session:createSession(countryId,clubId,date),id:mkId(),now:'2026-10-08T10:00:00.000Z'
});
test('IndexedDB schema has three isolated stores',async()=>{
 const db=await setup();assert.ok(db.objectStoreNames.contains('careers'));
 assert.ok(db.objectStoreNames.contains('snapshots'));assert.ok(db.objectStoreNames.contains('preferences'));
 assert.equal((await readCatalog(db)).rows.length,0);
});
test('manager/team setup creates no save until explicit createCareer',async()=>{
 const db=await setup(),draft={managerName:'Ada Manager',countryId:'IT',clubId:2,query:''};
 assert.match(managerPage(draft,'it'),/Cognome/);
 assert.match(teamsPage(draft,'it'),/Inizia carriera/);
 assert.equal((await readCatalog(db)).rows.length,0);
 await createCareer(db,form('Ada Manager','IT',2));
 assert.equal((await readCatalog(db)).rows.length,1);
});
test('three careers are independent and active selection points to the latest',async()=>{
 const db=await setup();
 const a=await createCareer(db,form('Ada','IT',2));
 const b=await createCareer(db,form('Bo','DE',1));
 const c=await createCareer(db,form('Cami','FR',3));
 let catalog=await readCatalog(db);
 assert.equal(catalog.rows.length,3);
 assert.equal(bestCareer(catalog).id,c.meta.id);
 await selectCareer(db,a.meta.id);
 catalog=await readCatalog(db);assert.equal(catalog.activeId,a.meta.id);
 assert.equal(bestCareer(catalog).id,a.meta.id);
 assert.equal((await selectCareer(db,b.meta.id)).state.countryId,'DE');
 assert.equal((await selectCareer(db,a.meta.id)).state.daysElapsed,0);
});
test('atomic save changes only the selected career, preserves other snapshots',async()=>{
 const db=await setup();
 const a=await createCareer(db,form('A','IT',1));
 const b=await createCareer(db,form('B','NL',2));
 const next=advanceSession(a.state,30);
 await saveCareer(db,a.meta.id,next,{expectedDays:0,now:'2026-11-07T10:00:00Z'});
 assert.equal((await selectCareer(db,a.meta.id)).state.daysElapsed,30);
 assert.equal((await selectCareer(db,b.meta.id)).state.daysElapsed,0);
 await assert.rejects(saveCareer(db,a.meta.id,advanceSession(next,1),{expectedDays:0}));
 assert.equal((await selectCareer(db,a.meta.id)).state.daysElapsed,30);
});
test('reload from a second IndexedDB connection preserves all careers',async()=>{
 const factory=createFactory(),first=await openCareerDatabase(factory);
 const save=await createCareer(first,form('Test','ENG',7));
 const second=await openCareerDatabase(factory);
 assert.deepEqual((await selectCareer(second,save.meta.id)).state,save.state);
});
test('rename updates only the career label and never modifies the manager or snapshot',async()=>{
 const db=await setup(),a=await createCareer(db,form('Old','IT',2));
 const changed=await renameCareer(db,a.meta.id,'New Manager','2026-10-09T10:00:00Z');
 assert.equal(changed.careerName,'New Manager');
 assert.equal(changed.managerName,'Old');
 const loaded=await selectCareer(db,a.meta.id);
 assert.equal(loaded.meta.careerName,'New Manager');
 assert.equal(loaded.meta.managerName,'Old');
 assert.deepEqual(loaded.state,a.state);
});
test('delete is permanent for the selected career and clears active preference only when needed',async()=>{
 const db=await setup(),a=await createCareer(db,form('A','IT',1)),b=await createCareer(db,form('B','FR',3));
 await deleteCareer(db,a.meta.id);
 let catalog=await readCatalog(db);
 assert.equal(catalog.rows.length,1);assert.equal(catalog.activeId,b.meta.id);
 await deleteCareer(db,b.meta.id);
 catalog=await readCatalog(db);
 assert.equal(catalog.rows.length,0);assert.equal(catalog.activeId,null);
});
test('corrupt saves remain in catalog, cannot load and can be exported and deleted',async()=>{
 const db=await setup(),a=await createCareer(db,form('Good','ES',1)),b=await createCareer(db,form('Broken','ES',2));
 db.data.get('snapshots').set(b.meta.id,{id:b.meta.id,raw:'{"broken":'});
 const catalog=await readCatalog(db);
 assert.equal(catalog.rows.filter(x=>x.status==='ok').length,1);
 assert.equal(catalog.rows.find(x=>x.id===b.meta.id).status,'corrupt');
 assert.equal(bestCareer(catalog).id,a.meta.id);
 await assert.rejects(selectCareer(db,b.meta.id));
 const exported=await exportCareer(db,b.meta.id);
 assert.equal(exported.snapshotRaw,'{"broken":');
 assert.equal(exported.format,EXPORT_FORMAT);
 await deleteCareer(db,b.meta.id);
 assert.equal((await readCatalog(db)).rows.length,1);
});
test('orphan snapshots remain exportable and deletable',async()=>{
 const db=await setup(),id=mkId();
 db.data.get('snapshots').set(id,{id,raw:'not-json'});
 assert.equal((await readCatalog(db)).rows[0].status,'corrupt');
 assert.equal((await exportCareer(db,id)).snapshotRaw,'not-json');
 await deleteCareer(db,id);
 assert.equal((await readCatalog(db)).rows.length,0);
});
test('JSON export/import roundtrip validates and creates independent identity',async()=>{
 const db=await setup(),a=await createCareer(db,form('Exporter','BR',9));
 const envelope=await exportCareer(db,a.meta.id);
 const parsed=parseCareerImport(JSON.stringify(envelope));
 const copied=await createCareer(db,{...parsed,id:mkId(),now:'2026-10-09T10:00:00Z'});
 assert.notEqual(copied.meta.id,a.meta.id);
 assert.deepEqual(copied.state,a.state);
 assert.equal(copied.meta.careerName,a.meta.careerName);
 assert.equal((await readCatalog(db)).rows.length,2);
});
test('import rejects corrupt payload and private extra state',async()=>{
 const db=await setup(),a=await createCareer(db,form());
 const e=await exportCareer(db,a.meta.id);
 for(const payload of [
  '{invalid',
  JSON.stringify({...e,version:99}),
  JSON.stringify({...e,snapshotRaw:'{bad'}),
  JSON.stringify({...e,snapshotRaw:JSON.stringify({...a.state,fixtures:[]})})
 ])assert.throws(()=>parseCareerImport(payload),/IMPORT_INVALID/);
});
test('previous session stays untouched and is not offered for recovery',async()=>{
 const db=await setup(),legacy=createSession('IT',3,'2026-10-08');
 const storage=new Map([[SAVE_KEY,JSON.stringify(legacy)]]);
 await createCareer(db,form('Current','IT',3));
 assert.equal(storage.get(SAVE_KEY),JSON.stringify(legacy));
 assert.equal((await readCatalog(db)).rows.length,1);
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(controller,/readLegacyMinimal|hasImportedLegacy|case 'legacy'/);
 assert.doesNotMatch(careersPage(await readCatalog(db),'it'),/Recupera simulazione precedente|data-action="legacy"/);
});
test('menu card shows only an existing valid career; corrupt active falls back',async()=>{
 const db=await setup();let c=await readCatalog(db);
 assert.doesNotMatch(homePage(c,'it'),/Continua carriera/);
 const a=await createCareer(db,form('Mario','IT',2));
 c=await readCatalog(db);
 assert.match(homePage(c,'it'),/AC Rinascenti Bologna/);
 assert.match(homePage(c,'it'),/Continua carriera/);
 db.data.get('snapshots').set(a.meta.id,{id:a.meta.id,raw:'broken'});
 c=await readCatalog(db);
 assert.doesNotMatch(homePage(c,'it'),/Continua carriera/);
 assert.match(careersPage(c,'it',false),/Salvataggio danneggiato/);
});
test('IT/EN menu and dedicated routes are available and accessible',()=>{
 const empty={rows:[],activeId:null};
 const html=layout(homePage(empty,'en'),'en');
 assert.match(html,/New career/);assert.match(html,/My careers/);assert.match(html,/Settings/);
 assert.match(html,/Skip to content/);
 const draft={managerName:'Mario',countryId:'DE',clubId:1,query:''};
 assert.match(managerPage(draft,'en'),/First name/);
 assert.match(teamsPage(draft,'en'),/Choose your club/);
 assert.match(settingsPage('en'),/Language/);
 assert.match(careersPage(empty,'en'),/Import/);
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 for(const route of ['/new-career','/new-career/country','/new-career/league','/new-career/team','/careers','/settings','/simulation','/dashboard','/calendar'])assert.ok(server.includes("'"+route+"'"));
});
test('simulation maintains match-free semantics, responsive UI and keyboard focus',()=>{
 const state=createSession('PT',4,'2026-10-08'),meta={managerName:'M',countryId:'PT',clubId:4};
 const markup=simulationPage(meta,state,'it',false);
 assert.match(markup,/Avanza nel tempo/);
 assert.match(markup,/Non viene giocata alcuna partita/);
 assert.doesNotMatch(markup,/\bscore\b|risultati|classifica/i);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:580px\)/);
 assert.match(css,/@media\(max-width:420px\)/);
});
test('all eight countries and 160 teams remain available without game fixtures',()=>{
 assert.equal(LEAGUES.length,8);
 assert.equal(LEAGUES.reduce((n,l)=>n+getLeagueClubs(l.id).length,0),160);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/simulateMatch|fixtureIsDue|playMatch|matchEngine/);
 assert.match(main,/async function begin\(\)\{\r?\n if\(busy\|\|/);
 assert.match(main.replace(/\r?\n/g,'\r\n'),/async function begin\(\)\{\r?\n if\(busy\|\|/); // Windows CRLF regression
});

test('pre-reset language combobox and SVG icon set are consistent in IT and EN',()=>{
 const it=layout(homePage({rows:[],activeId:null},'it'),'it','',true);
 const en=layout(homePage({rows:[],activeId:null},'en'),'en','',false);
 assert.match(it,/class="language-picker language-picker-home"/);
 assert.match(it,/class="language-combobox"/);
 assert.match(it,/role="combobox"/);
 assert.match(it,/aria-haspopup="listbox"/);
 assert.match(it,/aria-expanded="true"/);
 assert.match(it,/role="listbox"/);
 assert.match(it,/Italiano/);
 assert.match(it,/English/);
 assert.match(en,/aria-expanded="false"/);
 assert.doesNotMatch(en,/<select/);
 assert.match(it,/data-action="new"[^>]*>[\s\S]*?<svg/);
 assert.match(it,/data-action="settings"[^>]*>[\s\S]*?<svg/);
 assert.match(it,/class="menu-chevron"><svg/);
 assert.doesNotMatch(it,/<span class="option-icon"[^>]*>[+▤⚙]/);
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(sheet,/\.language-listbox/);
 assert.match(sheet,/\.language-combobox:focus-visible/);
 assert.match(sheet,/\.language-option\[aria-selected="true"\]/);
 assert.match(sheet,/\.fa-icon/);
});
test('language picker remains independent of career save state',()=>{
 const first=languagePicker('it',true),second=languagePicker('en',true),closed=languagePicker('en',false);
 assert.match(first,/data-value="en"/);
 assert.match(second,/data-value="it"/);
 assert.match(closed,/aria-expanded="false"/);
 assert.doesNotMatch(closed,/role="option"/);
 assert.match(first,/aria-selected="true"/);
 assert.match(icon('shield',18),/<svg/);
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(controller,/case 'language-toggle'/);
 assert.match(controller,/case 'language-option'/);
 assert.match(controller,/event\.key==='Escape'/);
 assert.match(controller,/event\.key==='ArrowDown'/);
 assert.doesNotMatch(controller,/case 'legacy'/);
});
test('only live route modules are published by the offline server',()=>{
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.ok(server.includes("'/src/icons.js'"));
 assert.ok(server.includes("'/src/language-picker.js'"));
 assert.ok(!server.includes("'/src/legacy.js'"));
});



test('four separate new career pages require manager, country, championship and club before saving',async()=>{
 const db=await setup(),blank={managerName:'',countryId:null,clubId:null,query:''};
 const manager=managerPage(blank,'it');
 assert.match(manager,/class="onboard-header fa-page-heading"/);
 assert.match(manager,/PASSAGGIO 1\/4/);
 assert.match(manager,/Scegli il tuo allenatore/);
 assert.match(manager,/id="manager-form"/);
 assert.match(manager,/id="manager-first-name"/);
 assert.match(manager,/id="manager-last-name"/);
 assert.match(manager,/id="manager-birth-date"/);
 assert.match(manager,/id="manager-nationality"/);
 assert.match(manager,/id="manager-birth-place"/);
 assert.match(manager,/Avanti: Nazione/);
 assert.doesNotMatch(manager,/class="league-pick-options"|<table class="club-table"/);
 assert.match(manager,/<h1 class="fa-page-title">[\s\S]*?<div class="wizard-topline">[\s\S]*?data-action="cancel-setup"/);
 const chosen={managerName:'Ada Coach',countryId:'IT',championshipId:'IT',clubId:2,query:''};
 const country=countryPage(blank,'it');
 assert.match(country,/PASSAGGIO 2\/4/);
 assert.equal((country.match(/data-action="country"/g)||[]).length,8);
 assert.match(country,/data-action="country-next" disabled/);
 assert.doesNotMatch(country,/<table class="club-table"|id="manager-form"/);
 const selectedCountry=countryPage({...chosen,clubId:null},'it');
 assert.match(selectedCountry,/aria-pressed="true"/);
 assert.doesNotMatch(selectedCountry,/data-action="country-next" disabled/);
 const league=championshipPage({...chosen,championshipId:null,clubId:null},'it');
 assert.match(league,/PASSAGGIO 3\/4/);
 assert.equal((league.match(/data-action="championship" /g)||[]).length,1);
 assert.match(league,/data-action="championship-next" disabled/);
 assert.doesNotMatch(league,/<table class="club-table"|id="manager-form"/);
 const selectedLeague=championshipPage({...chosen,championshipId:'IT',clubId:null},'it');
 assert.match(selectedLeague,/aria-pressed="true"/);
 assert.doesNotMatch(selectedLeague,/data-action="championship-next" disabled/);
 const team=teamsPage({...chosen,championshipId:'IT',clubId:null},'it');
 assert.match(team,/PASSAGGIO 4\/4/);
 assert.match(team,/class="wizard-no-club"/);
 assert.match(team,/data-action="start-career" disabled/);
 assert.match(team,/<table class="club-table"/);
 assert.equal((team.match(/class="club-table-select"/g)||[]).length,20);
 assert.equal((team.match(/class="club-table-row /g)||[]).length,20);
 assert.match(team,/class="onboard-aside wizard-club-summary"/);
 assert.doesNotMatch(team,/id="manager-form"/);
 assert.match(team,/data-action="setup-back"/);
 const selected=teamsPage(chosen,'it');
 assert.match(selected,/class="selected-stats"/);
 assert.match(selected,/data-action="start-career"/);
 assert.doesNotMatch(selected,/data-action="start-career" disabled/);
 assert.equal((selected.match(/<h1\b/g)||[]).length,1);
 assert.equal((await readCatalog(db)).rows.length,0);
 await createCareer(db,form('Ada Coach','IT',2));
 assert.equal((await readCatalog(db)).rows.length,1);
});
test('My Careers adopts the four-step wizard visual shell and preserves all save actions',async()=>{
 const db=await setup();await createCareer(db,form('Ada','IT',2));
 const html=careersPage(await readCatalog(db),'it');
 assert.match(html,/class="onboarding restored-onboarding wizard-page restored-careers wizard-careers"/);
 assert.match(html,/class="onboard-wrap"/);
 assert.match(html,/class="onboard-header fa-page-heading"/);
 assert.match(html,/class="wizard-topline"/);
 assert.match(html,/class="wizard-careers-panel panel"/);
 assert.match(html,/class="onboard-heading wizard-careers-heading"/);
 assert.match(html,/class="wizard-careers-list"/);
 assert.doesNotMatch(html,/class="wizard-career-row is-current /);
 assert.match(html,/class="wizard-career-facts"/);
 assert.match(html,/class="wizard-career-actions"/);
 assert.match(html,/Le mie carriere/);
 assert.match(html,/data-action="cancel-setup"/);
 for(const action of ['load','rename','export','delete','new','import'])
  assert.ok(html.includes('data-action="'+action+'"'),action);
 assert.equal((html.match(/id="import-file"/g)||[]).length,1);
 assert.doesNotMatch(html,/Recupera simulazione precedente|Checkpoint|Duplicazione/);
 assert.doesNotMatch(html,/class="career-grid"|class="career-card|class="career-more"/);
 const empty=careersPage({rows:[],activeId:null},'en');
 assert.match(empty,/No saved careers/);
 assert.match(empty,/class="wizard-careers-empty"/);
 assert.match(empty,/data-action="new"/);
 assert.match(empty,/data-action="import"/);
 assert.match(empty,/class="fa-page-title">My careers/);
 assert.doesNotMatch(empty,/data-action="load"|data-action="delete"/);
});
test('historic settings restores the two-column panels and keeps live features only',()=>{
 const html=settingsPage('it');
 assert.match(html,/class="restored-settings"/);
 assert.match(html,/Impostazioni e salvataggi/);
 assert.match(html,/class="settings-grid"/);
 assert.match(html,/class="setting-fact"/);
 assert.match(html,/class="settings-actions"/);
 assert.match(html,/class="settings-action"/);
 assert.match(html,/class="about-grid"/);
 assert.match(html,/data-action="language-focus"/);
 assert.match(html,/data-action="careers"/);
 assert.match(html,/data-action="import"/);
 assert.match(settingsPage('en'),/Settings and saves/);
 assert.doesNotMatch(html,/Partite giocate|Personalità e spogliatoio|Risultati/);
});
test('historic page styling survives the three-step wizard without restoring match systems',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const name of ['onboard-wrap','onboard-grid','club-table','wizard-careers-panel','wizard-career-row','settings-grid','settings-action'])
  assert.ok(sheet.includes('.'+name),name);
 assert.match(sheet,/@media\(max-width:760px\)/);
 assert.match(sheet,/@media\(max-width:430px\)/);
 assert.match(controller,/if\(!validateManagerForm\(event\.target\)\)return;/);
 assert.match(controller,/draft\.managerName=managerFullName\(draft\.managerProfile\)/);
 assert.match(controller,/case 'country':if\(LEAGUES\.some\(l=>l\.id===element\.dataset\.country\)\)/);
 assert.match(controller,/navigate\('\/new-career\/team'\)/);
 assert.doesNotMatch(controller,/simulateMatch|playMatch|matchEngine/);
});

test('every scrollbar uses the original site palette and a completely transparent track',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/--scrollbar-width:7px;/);
 assert.match(css,/--scrollbar-track:transparent;/);
 assert.match(css,/--scrollbar-thumb:#42565f;/);
 assert.match(css,/--scrollbar-thumb-hover:#607980;/);
 assert.match(css,/--scrollbar-thumb-active:#738d93;/);
 assert.match(css,/:where\(html,body,body \*\)\{\s*scrollbar-width:thin;\s*scrollbar-color:var\(--scrollbar-thumb\) var\(--scrollbar-track\);/);
 assert.match(css,/:where\(html,body,body \*\):hover\{\s*scrollbar-color:var\(--scrollbar-thumb-hover\) var\(--scrollbar-track\);/);
 for(const part of ['::-webkit-scrollbar-track','::-webkit-scrollbar-track-piece','::-webkit-scrollbar-corner'])
  assert.ok(css.includes(':where(html,body,body *)'+part),part);
 assert.match(css, /::-webkit-scrollbar-corner\{\s*background:transparent;\s*border:0;\s*box-shadow:none;/);
 assert.match(css, /::-webkit-scrollbar-thumb\{\s*background:var\(--scrollbar-thumb\);/);
 assert.match(css, /::-webkit-scrollbar-thumb:active\{\s*background:var\(--scrollbar-thumb-active\);/);
 assert.match(css, /::-webkit-scrollbar-button\{\s*display:none;\s*width:0;\s*height:0;/);
});
test('the transparent-track contract covers page, club grid and future nested scroll regions',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.match(css,/\.restored-onboarding \.club-table\{/);
 assert.match(css,/:where\(html,body,body \*\)::-webkit-scrollbar\{\s*width:var\(--scrollbar-width\);\s*height:var\(--scrollbar-width\);\s*background:transparent;/);
 assert.match(ui,/<table class="club-table"/);
 assert.match(ui,/class="wizard-careers-list"/);
 // The shared selectors target every descendant, without requiring classes
 // or making new containers scrollable.
 const scrollbarContract=css.slice(css.indexOf('/* QOL05.08'),css.indexOf('/* New Career: all 20 clubs'));
 assert.doesNotMatch(scrollbarContract,/\boverflow-[xy]\s*:/);
});

test('new career club table keeps every club on the document without an internal scrollbar',()=>{
 const draft={managerName:'QA',countryId:'IT',clubId:1,query:''};
 const html=teamsPage(draft,'it');
 assert.match(html,/<table class="club-table" id="clubs"/);
 assert.match(html,/<thead>[\s\S]*?<th scope="col">Squadra<\/th>/);
 assert.match(html,/<tbody>/);
 assert.equal((html.match(/<tr class="club-table-row /g)||[]).length,20);
 assert.equal((html.match(/<button type="button" class="club-table-select"/g)||[]).length,20);
 assert.equal((html.match(/aria-pressed="true" aria-label="Seleziona /g)||[]).length,1);
 assert.match(html,/data-id="1" aria-pressed="true"/);
 const en=teamsPage({managerName:'QA',countryId:'ENG',clubId:3,query:''},'en');
 assert.match(en,/<th scope="col">Club<\/th>/);
 assert.equal((en.match(/<tr class="club-table-row /g)||[]).length,20);
 assert.match(en,/aria-label="Select /);
});
test('club table hover is contained and the document provides the only scrollbar',()=>{
 const style=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const tableRules=style.slice(style.indexOf('/* New Career: all 20 clubs'),style.indexOf('/* Shared site foundations'));
 assert.match(tableRules,/\.club-table\{\s*width:100%;\s*min-width:0;\s*table-layout:fixed;/);
 assert.match(tableRules,/\.club-table-row:hover td/);
 assert.match(tableRules,/\.club-table-row:focus-within td/);
 assert.match(tableRules,/box-shadow:inset/);
 assert.match(tableRules,/@media\(max-width:530px\)/);
 assert.doesNotMatch(tableRules,/\b(?:max-height|overflow-y|overflow-x|scrollbar-width|transform):/);
 assert.doesNotMatch(style,/\.restored-onboarding \.club-pick-grid\{max-height:/);
 assert.match(style,/\.restored-onboarding \.onboard-clubs\{min-width:0;overflow:visible\}/);
 assert.match(style,/--scrollbar-track:transparent;/);
});


test('all five routes share the same page heading and h1 hierarchy',()=>{
 const draft={managerName:'QA',countryId:'IT',clubId:2,query:''};
 const snapshots=[
  homePage({rows:[],activeId:null},'it'),
  managerPage(draft,'it'),
  countryPage(draft,'it'),
  teamsPage(draft,'it'),
  careersPage({rows:[],activeId:null},'it'),
  settingsPage('it'),
  simulationPage({managerName:'QA',countryId:'IT',clubId:2},createSession('IT',2,'2026-10-08'),'it',false)
 ];
 for(const page of snapshots){
  assert.equal((page.match(/class="[^"]*fa-page-heading[^"]*"/g)||[]).length,1);
  assert.equal((page.match(/<h1 class="fa-page-title">/g)||[]).length,1);
  assert.equal((page.match(/<h1\b/g)||[]).length,1);
 }
 assert.match(layout(snapshots[0],'it'),/id="content" class="fa-page-main"/);
});
test('one shared CSS contract governs width, padding, title scale and type on all pages',()=>{
 const stylesheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const [token,value] of Object.entries({
  '--fa-page-width':'1200px',
  '--fa-page-gutter':'clamp(16px,3.4vw,34px)',
  '--fa-page-top':'clamp(24px,4vw,46px)',
  '--fa-title-size':'clamp(30px,4.6vw,50px)',
  '--fa-body-size':'14px',
  '--fa-heading-gap':'clamp(22px,3vw,34px)',
  '--fa-panel-padding':'clamp(16px,2.4vw,24px)'
 }))assert.ok(stylesheet.includes(token+':'+value),token);
 assert.match(stylesheet,/\.shell>\.top,\.shell>\.fa-page-main,\.shell>footer/);
 assert.match(stylesheet,/\.fa-page-main \.fa-page-heading h1/);
 assert.match(stylesheet,/\.fa-page-main \.restored-onboarding \.onboard-wrap\{padding:0\}/);
 assert.match(stylesheet,/@media\(max-width:550px\)/);
 assert.match(stylesheet,/#manager-name-error:not\(\[hidden\]\)/);
});
test('feedback messages are localized, severity-aware, dismissible and never expose raw errors',()=>{
 const it=renderFeedback(feedback('error','IMPORT_INVALID'),'it');
 const en=renderFeedback(feedback('success','IMPORT_OK'),'en');
 assert.match(it,/role="alert"/);
 assert.match(it,/File carriera non valido/);
 assert.match(it,/data-action="feedback-dismiss"/);
 assert.match(it,/aria-label="Chiudi messaggio"/);
 assert.match(en,/role="status"/);
 assert.match(en,/Career imported/);
 assert.match(en,/data-feedback-kind="success"/);
 assert.equal(renderFeedback(null,'it'),'');
 const raw='<script>alert(1)</script> PRIVATE_JSON';
 const generic=renderFeedback(fromError(new Error(raw)),'it');
 assert.doesNotMatch(generic,/PRIVATE_JSON|<script>/);
 assert.match(generic,/Operazione non riuscita/);
});
test('IndexedDB and import failures have safe and actionable guidance',()=>{
 assert.equal(fromError(new Error('INDEXEDDB_UNAVAILABLE')).code,'INDEXEDDB_UNAVAILABLE');
 assert.equal(fromError(Object.assign(new Error('problem'),{name:'QuotaExceededError'})).code,'STORAGE_QUOTA');
 assert.equal(fromError(Object.assign(new Error('problem'),{name:'SecurityError'})).code,'STORAGE_PERMISSION');
 assert.equal(fromError(new Error('internal'), 'read').code,'READ_FAILED');
 assert.match(feedbackText(feedback('error','IDB_ABORT'),'en').description,/previous save remains/);
 const blocking=renderBlockingError(new Error('INDEXEDDB_BLOCKED'),'it');
 assert.match(blocking,/role="alert"/);
 assert.match(blocking,/Archivio occupato/);
 assert.match(blocking,/data-action="retry-storage"/);
 assert.doesNotMatch(blocking,/INDEXEDDB_BLOCKED|stack|Error:/);
});
test('all five required controls use shared styling and action-level error feedback in IT/EN',()=>{
 const markup=managerPage({managerProfile:blankManagerProfile()},'it');
 const en=managerPage({managerProfile:blankManagerProfile()},'en');
 assert.match(markup,/<form id="manager-form" class="onboard-manager-form wizard-manager-form" novalidate>/);
 assert.equal((markup.match(/class="text-field fa-interactive-box wizard-profile-input"/g)||[]).length,3);
 assert.equal((markup.match(/class="fa-interactive-box fa-picker-trigger wizard-profile-input"/g)||[]).length,2);
 for(const key of MANAGER_PROFILE_FIELDS)assert.match(markup,new RegExp('name="'+key+'"'));
 assert.match(markup,/id="manager-birth-date"/);
 assert.match(markup,/id="manager-nationality"/);
 assert.match(markup,/type="hidden" name="birthDate"/);
 assert.match(markup,/type="hidden" name="nationality"/);
 assert.doesNotMatch(markup,/name="birthDate" type="date"/);
 assert.match(markup,/class="fa-action-row wizard-manager-actions"/);
 assert.match(markup,/id="manager-form-error" class="fa-action-error" role="alert" hidden/);
 for(const label of ['Nome','Cognome','Data di nascita','Nazionalità','Luogo di nascita'])assert.ok(markup.includes(label),label);
 for(const label of ['First name','Last name','Date of birth','Nationality','Place of birth'])assert.ok(en.includes(label),label);
 assert.doesNotMatch(markup,/Seconda nazionalità|Esperienza|Patentino|Filosofia tattica|Lingue conosciute/);
});
test('controllers use structured feedback and protect save data in recovery paths',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(controller,/function fail\(error\)\{stop\(\);feedbackState=fromError\(error\);/);
 assert.match(controller,/case 'feedback-dismiss'/);
 assert.match(controller,/case 'retry-storage'/);
 assert.match(controller,/function validateManagerForm\(form,focus=true\)/);
 assert.match(controller,/if\(!validateManagerForm\(event\.target\)\)return;/);
 assert.match(controller,/feedback\('success','IMPORT_OK'\)/);
 assert.match(controller,/feedback\('success','RENAME_OK'\)/);
 assert.match(controller,/feedback\('success','DELETE_OK'\)/);
 assert.doesNotMatch(controller,/notice=|esc\(e\.message\)|notice:e\.message/);
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.ok(server.includes("'/src/feedback.js'"));
});


test('the document reserves one stable root scrollbar gutter across all routes',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const rule=sheet.slice(sheet.lastIndexOf('/* The document keeps the same available content width'));
 assert.match(rule,/html\{\s*scrollbar-gutter:stable;\s*\}/);
 assert.match(rule,/@supports not \(scrollbar-gutter:stable\)\{\s*html\{overflow-y:scroll;\}\s*\}/);
 assert.doesNotMatch(rule,/body\{[^}]*scrollbar-gutter|\.shell\{[^}]*scrollbar-gutter|\.fa-page-main\{[^}]*scrollbar-gutter/);
 assert.doesNotMatch(rule,/scrollbar-gutter:stable both-edges/);
});
test('page scrollbar track is fully transparent and nested scrollbars keep shared style',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const rule=sheet.slice(sheet.lastIndexOf('/* The document keeps the same available content width'));
 for(const part of ['::-webkit-scrollbar-track','::-webkit-scrollbar-track-piece','::-webkit-scrollbar-corner']){
  assert.ok(rule.includes('html'+part),part);
 }
 assert.match(rule,/html::-webkit-scrollbar-corner\{\s*background:transparent;\s*box-shadow:none;\s*\}/);
 assert.match(sheet,/--scrollbar-track:transparent;/);
 assert.match(sheet,/--scrollbar-thumb:#42565f;/);
 assert.match(sheet,/:where\(html,body,body \*\)\{\s*scrollbar-width:thin;/);
 const code=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 for(const name of ['hero fa-page-heading','onboarding restored-onboarding','restored-careers','restored-settings','heading fa-page-heading'])
  assert.ok(code.includes(name),name);
});

test('settings icon uses a centered geometric cog with eight uniform teeth',()=>{
 const settings=icon('settings',21);
 assert.match(settings,/viewBox="0 0 24 24"/);
 assert.match(settings,/width="21" height="21"/);
 assert.match(settings,/aria-hidden="true" focusable="false"/);
 assert.match(settings,/<circle cx="12" cy="12" r="3\.2"\/>/);
 const path=settings.match(/<path d="([^"]+)"\/>/)?.[1];
 assert.ok(path?.startsWith('M')&&path.endsWith('Z'));
 const vertices=[...path.matchAll(/[ML](\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g)]
  .map(([,x,y])=>({x:Number(x),y:Number(y)}));
 assert.equal(vertices.length,32);
 for(const point of vertices){
  const radius=Math.hypot(point.x-12,point.y-12);
  assert.ok(radius>7.8&&radius<10.1,'cog fits within 24px viewBox');
 }
 assert.equal((settings.match(/<circle/g)||[]).length,1);
 const small=icon('settings',16);
 assert.match(small,/width="16" height="16"/);
 assert.equal(small.match(/<path d="([^"]+)"/)?.[1],path);
 assert.equal((homePage({rows:[],activeId:null},'it').match(/data-action="settings"/g)||[]).length,1);
 assert.match(homePage({rows:[],activeId:null},'it'),/data-action="settings"[\s\S]*?<svg/);
});

test('wizard routes keep the input draft in memory and do not create a premature career',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(controller,/['"]\/new-career\/country['"]/);
 assert.match(controller,/['"]\/new-career\/team['"]/);
 assert.match(controller,/['"]\/new-career\/league['"]/);
 assert.match(server,/'\/new-career\/country'/);
 assert.match(server,/'\/new-career\/league'/);
 assert.match(controller,/draft\.managerName=managerFullName\(draft\.managerProfile\);[\s\S]*?navigate\('\/new-career\/country'\);/);
 assert.match(controller,/case 'country-next':if\(LEAGUES\.some\(l=>l\.id===draft\.countryId\)\)navigate\('\/new-career\/league'\)/);
 assert.match(controller,/case 'championship-next':if\(LEAGUES\.some\(l=>l\.id===draft\.championshipId&&l\.id===draft\.countryId\)\)navigate\('\/new-career\/team'\)/);
 assert.match(controller,/case 'start-career':await begin\(\)/);
 assert.match(controller,/if\(page==='\/new-career\/team'&&!LEAGUES\.some/);
 assert.match(controller,/case 'setup-back':navigate\(path\(\)==='\/new-career\/team'\?'\/new-career\/league':path\(\)==='\/new-career\/league'\?'\/new-career\/country':'\/new-career'\)/);
 assert.doesNotMatch(controller,/case 'country':draft\.countryId=element\.dataset\.country;draft\.clubId=1/);
 const submit=controller.slice(controller.indexOf("document.addEventListener('submit'"),controller.indexOf("document.addEventListener('input'"));
 assert.doesNotMatch(submit,/begin\(|createCareer\(/);
 const start=controller.slice(controller.indexOf('async function begin()'),controller.indexOf('async function load('));
 assert.match(start,/createCareer\(db,/);
 assert.match(start,/getLeagueClubs\(draft\.countryId\)\.some/);
});
test('all four setup screens have a high cancel button and consistent heading geometry',()=>{
 const draft={managerName:'Ada Manager',countryId:'IT',clubId:4};
 for(const [step,page] of [[1,managerPage(draft,'it')],[2,countryPage(draft,'it')],[3,championshipPage({...draft,championshipId:'IT'},'it')],[4,teamsPage(draft,'it')]]){
  assert.match(page,new RegExp('PASSAGGIO '+step+'/4'));
  assert.match(page,/<div class="wizard-topline">/);
  const cancel=page.indexOf('data-action="cancel-setup"');
  const heading=page.indexOf('<h1 class="fa-page-title">');
  assert.ok(cancel>heading,'Controls follow the title in DOM');
  assert.doesNotMatch(page.match(/<header class="onboard-header fa-page-heading">([\s\S]*?)<\/header>/)?.[1]??'',/<p\b/,'No wizard header subtitle');
  assert.match(page,/<span class="pretitle wizard-step-label">/);
  assert.equal((page.match(/<h1\b/g)||[]).length,1);
  if(step>1)assert.match(page,/data-action="setup-back"/);
  else assert.doesNotMatch(page,/data-action="setup-back"/);
 }
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.wizard-page \.wizard-topline\{/);
 assert.match(css,/\.wizard-page \.wizard-cancel/);
 assert.match(css,/\.wizard-page \.onboard-header\{position:relative\}/);
 assert.match(css,/position:absolute;top:0;right:0;/);
 assert.match(css,/@media\(max-width:680px\)/);
});
test('step-specific translations and keyboard access are maintained at 320/390 widths',()=>{
 const blank={managerName:'',countryId:null,clubId:null};
 assert.match(managerPage(blank,'en'),/Next: Country/);
 assert.match(countryPage(blank,'en'),/Choose your country/);
 assert.match(countryPage(blank,'en'),/Next: League/);
 assert.match(championshipPage({countryId:'IT',championshipId:null},'en'),/Next: Club/);
 assert.match(teamsPage({managerName:'Ada',countryId:'IT',clubId:null},'en'),/Select a club/);
 const team=teamsPage({managerName:'Ada',countryId:'IT',clubId:2},'en');
 assert.equal((team.match(/class="club-table-select"/g)||[]).length,20);
 assert.match(team,/aria-pressed="true"/);
 assert.match(team,/data-action="start-career"/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.wizard-page \.wizard-back:focus-visible/);
 assert.match(css,/\.wizard-manager-form \.text-field/);
 assert.match(css,/@media\(max-width:340px\)/);
 assert.doesNotMatch(css,/\.wizard-team-grid\{[^}]*overflow-y:auto/);
 assert.match(css,/scrollbar-gutter:stable/);
});

test('wizard H1 has shared spacing and no header subtitles',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(sheet,/\.fa-page-main \.fa-page-heading h1,[\s\S]*?font-size:var\(--fa-title-size\)/);
 assert.match(sheet,/\.fa-page-main \.fa-page-heading p\{[\s\S]*?font-size:var\(--fa-body-size\)/);
 assert.match(sheet,/\.wizard-page \.onboard-header \.fa-page-title\{margin:10px 0 13px\}/);
 assert.match(sheet,/\.wizard-page \.onboard-header \.fa-page-title\{margin:10px 0 13px\}/);
 const wizardStyles=sheet.slice(sheet.indexOf('/* Three-page New Career wizard'));
 assert.match(wizardStyles,/\.wizard-page \.wizard-topline\{\s*position:absolute;top:0;right:0;/);
 assert.doesNotMatch(wizardStyles,/\.wizard-page \.wizard-topline\{[^}]*margin-bottom:/);
 assert.match(wizardStyles,/@media\(max-width:680px\)\{[\s\S]*?position:static;justify-content:flex-end/);
 for(const page of [
  managerPage({managerName:'',countryId:null,clubId:null},'it'),
  countryPage({managerName:'Ada',countryId:'IT',clubId:null},'it'),
  championshipPage({managerName:'Ada',countryId:'IT',championshipId:'IT',clubId:null},'it'),
  teamsPage({managerName:'Ada',countryId:'IT',championshipId:'IT',clubId:2},'it')
 ]){
  const kicker=page.indexOf('class="pretitle wizard-step-label"');
  const title=page.indexOf('<h1 class="fa-page-title">');
  const buttons=page.indexOf('class="wizard-topline"',title);
  assert.ok(kicker>=0&&title>kicker&&buttons>title);
  const header=page.match(/<header class="onboard-header fa-page-heading">([\s\S]*?)<\/header>/)?.[1]??'';
  assert.doesNotMatch(header,/<p\b/);
 }
});

test('manager page omits the obsolete confirmation-save disclaimer in both languages',()=>{
 const draft={managerProfile:blankManagerProfile(),countryId:null,clubId:null};
 for(const lang of ['it','en']){
  const html=managerPage(draft,lang);
  assert.doesNotMatch(html,/Non verrà creato alcun salvataggio prima della conferma finale/);
  assert.doesNotMatch(html,/No save is created before final confirmation/);
  assert.match(html,/id="manager-form"/);
  assert.match(html,/data-action="cancel-setup"/);
  assert.match(html,/class="fa-page-title"/);
 }
});


const modernProfile=Object.freeze({firstName:'Ada',lastName:'Rossi',birthDate:'1988-04-19',nationality:'Italiana',birthPlace:'Bologna'});
test('manager profile normalizes exactly five values and validates each field',()=>{
 assert.deepEqual(MANAGER_PROFILE_FIELDS,['firstName','lastName','birthDate','nationality','birthPlace']);
 assert.deepEqual(blankManagerProfile(),{firstName:'',lastName:'',birthDate:'',nationality:'',birthPlace:''});
 assert.equal(managerFullName({...modernProfile,firstName:' Ada  '}),'Ada Rossi');
 assert.equal(validManagerProfile(modernProfile,'2026-10-09'),true);
 assert.deepEqual(managerProfileIssues(modernProfile,'2026-10-09'),{});
 for(const field of MANAGER_PROFILE_FIELDS){
  const missing={...modernProfile,[field]:'   '};
  const issues=managerProfileIssues(missing,'2026-10-09');
  assert.ok(issues[field],field+' missing must be rejected');
  assert.equal(validManagerProfile(missing,'2026-10-09'),false);
  assert.match(feedbackText({code:issues[field]},'it').description,/\S/);
  assert.match(feedbackText({code:issues[field]},'en').description,/\S/);
 }
 for(const birthDate of ['2027-01-01','2026-02-30','1987-02-29','nonsense']){
  assert.equal(validManagerProfile({...modernProfile,birthDate},'2026-10-09'),false,birthDate);
 }
 assert.equal(validManagerProfile({...modernProfile,birthDate:'2000-02-29'},'2026-10-09'),true);
 for(const key of ['firstName','lastName']){
  assert.equal(validManagerProfile({...modernProfile,[key]:'X'.repeat(41)},'2026-10-09'),false,key);
 }
 for(const key of ['nationality','birthPlace']){
  assert.equal(validManagerProfile({...modernProfile,[key]:'X'.repeat(81)},'2026-10-09'),false,key);
 }
 assert.deepEqual(Object.keys(normalizeManagerProfile({...modernProfile,experience:'ex player'})),MANAGER_PROFILE_FIELDS);
});
test('new careers require complete profile and persist it throughout IndexedDB and JSON roundtrip',async()=>{
 const db=await setup(),now='2026-10-09T10:00:00.000Z';
 const data={countryId:'IT',clubId:2,id:mkId(),now};
 assert.throws(()=>createCareer(db,{...data,managerName:'Ada Rossi'}),/CAREER_DATA_INVALID/);
 for(const field of MANAGER_PROFILE_FIELDS){
  assert.throws(()=>createCareer(db,{...data,managerProfile:{...modernProfile,[field]:''}}),/CAREER_DATA_INVALID/);
 }
 assert.equal((await readCatalog(db)).rows.length,0);
 const original=await createCareer(db,{...data,managerProfile:modernProfile});
 assert.equal(original.meta.managerName,'Ada Rossi');
 assert.deepEqual(original.meta.managerProfile,modernProfile);
 assert.equal(original.meta.schemaVersion,1);
 const catalog=await readCatalog(db);
 assert.deepEqual(catalog.rows[0].meta.managerProfile,modernProfile);
 const backup=await exportCareer(db,original.meta.id);
 assert.deepEqual(backup.meta.managerProfile,modernProfile);
 const parsed=parseCareerImport(JSON.stringify(backup));
 assert.deepEqual(parsed.managerProfile,modernProfile);
 assert.equal(parsed.legacyImport,false);
 const copy=await createCareer(db,{...parsed,id:mkId(),now});
 assert.equal(copy.meta.managerName,'Ada Rossi');
 assert.deepEqual(copy.meta.managerProfile,modernProfile);
 assert.equal((await readCatalog(db)).rows.length,2);
 const update=advanceSession(copy.state,1);
 const saved=await saveCareer(db,copy.meta.id,update,{expectedDays:0,now:'2026-10-10T10:00:00Z'});
 assert.deepEqual(saved.meta.managerProfile,modernProfile);
 assert.throws(()=>createCareer(db,{...data,managerProfile:{...modernProfile,birthDate:'2030-01-01'}}),/CAREER_DATA_INVALID/);
});
test('older PR48 careers remain readable and importable without fabricated biographical data',async()=>{
 const db=await setup(),old=await createCareer(db,form('Old Manager','IT',1));
 assert.equal(old.meta.managerProfile,undefined);
 const backup=await exportCareer(db,old.meta.id);
 const parsed=parseCareerImport(JSON.stringify(backup));
 assert.equal(parsed.legacyImport,true);
 assert.equal(parsed.managerProfile,null);
 const copy=await createCareer(db,{...parsed,id:mkId()});
 assert.equal(copy.meta.managerName,'Old Manager');
 assert.equal(copy.meta.managerProfile,undefined);
 assert.equal((await readCatalog(db)).rows.filter(x=>x.status==='ok').length,2);
});
test('tampered biography exports are rejected before any save is changed',async()=>{
 const db=await setup();
 const career=await createCareer(db,{managerProfile:modernProfile,countryId:'IT',clubId:1,id:mkId(),now:'2026-10-09T10:00:00Z'});
 const backup=await exportCareer(db,career.meta.id);
 for(const meta of [
  {...backup.meta,managerProfile:{...modernProfile,birthDate:'2026-02-30'}},
  {...backup.meta,managerProfile:{...modernProfile,nationality:''}},
  {...backup.meta,managerName:'Impostore'},
  {...backup.meta,managerProfile:{...modernProfile,birthPlace:null}}
 ]){
  assert.throws(()=>parseCareerImport(JSON.stringify({...backup,meta})),/IMPORT_INVALID/);
 }
 const after=await readCatalog(db);
 assert.equal(after.rows.length,1);
 assert.equal(after.rows[0].status,'ok');
});
test('wizard controller validates five fields before navigating and creates only on final step',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(controller,/const issues=managerProfileIssues\(profile\)/);
 assert.match(controller,/for\(const key of MANAGER_PROFILE_FIELDS\)/);
 assert.match(controller,/if\(!validateManagerForm\(event\.target\)\)return;/);
 assert.match(controller,/if\(managerSubmitted\)validateManagerForm\(form,false\)/);
 assert.match(controller,/if\(busy\|\|!validManagerProfile\(draft\.managerProfile\)/);
 assert.match(controller,/createCareer\(db,\{managerName:managerFullName\(draft\.managerProfile\),managerProfile:draft\.managerProfile/);
 assert.match(server,/'\/src\/manager-profile\.js'/);
 assert.match(css,/\.wizard-manager-form \.wizard-profile-grid\{/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.wizard-profile-field \.field-error:not\(\[hidden\]\)/);
});

test('manager age is derived from birth date, not stored as a sixth field',()=>{
 assert.equal(managerAge(modernProfile,'2026-04-18'),37);
 assert.equal(managerAge(modernProfile,'2026-04-19'),38);
 assert.equal(managerAge(modernProfile,'2027-04-18'),38);
 assert.equal(managerAge(modernProfile,'2027-04-19'),39);
 assert.equal(managerAge({...modernProfile,birthDate:'2035-01-01'},'2026-10-09'),null);
 assert.deepEqual(MANAGER_PROFILE_FIELDS,['firstName','lastName','birthDate','nationality','birthPlace']);
 const page=teamsPage({managerName:'Ada Rossi',managerProfile:modernProfile,countryId:'IT',clubId:2},'it');
 assert.match(page,/ALLENATORE/);
 assert.match(page,/anni/);
});


test('nationality dropdown localizes broad ISO choices and supports selected state',()=>{
 assert.ok(NATIONALITY_CODES.length>=240);
 assert.equal(new Set(NATIONALITY_CODES).size,NATIONALITY_CODES.length);
 for(const key of ['IT','FR','DE','US','JP','BR','ZA','AU'])assert.equal(isNationalityCode(key),true);
 assert.equal(isNationalityCode('ZZ'),false);
 const italian=nationalityOptions('it'),english=nationalityOptions('en');
 assert.equal(italian.length,english.length);
 assert.equal(italian.find(x=>x.code==='IT').label,'Italia');
 assert.equal(english.find(x=>x.code==='IT').label,'Italy');
 assert.match(renderNationalityControl('IT','it',true),/data-action="nationality-select" data-value="IT" aria-selected="true"/);
 assert.match(renderNationalityControl('','en',false),/Choose nationality/);
 assert.match(renderNationalityControl('IT','en',true),/role="listbox"/);
 assert.match(renderNationalityControl('IT','it',false),/aria-expanded="false"/);
});
test('site calendar has month and year selectors, Monday-first grid, leap dates, limits and bilingual UI',()=>{
 assert.equal(initialCalendarMonth('1988-02-29','2026-10-09'),'1988-02');
 assert.equal(initialCalendarMonth('','2026-10-09'),'1996-01');
 assert.equal(shiftCalendarMonth('2000-12',1,'2026-10-09'),'2001-01');
 assert.equal(shiftCalendarMonth('1900-01',-1,'2026-10-09'),'1900-01');
 assert.equal(shiftCalendarMonth('2026-10',1,'2026-10-09'),'2026-10');
 assert.ok(calendarDays('2000-02','2026-10-09').some(x=>x?.iso==='2000-02-29'&&!x.disabled));
 assert.equal(calendarDays('2026-10','2026-10-09').find(x=>x?.iso==='2026-10-10').disabled,true);
 const it=renderDateControl('2000-02-29','it',true,'2000-02','months');
 const en=renderDateControl('','en',true,'2026-10');
 assert.match(it,/data-action="calendar-prev"/);
 assert.match(it,/data-action="calendar-next"/);
 assert.match(it,/data-action="calendar-month-select"/);
 assert.match(it,/data-calendar-view="months"/);
 assert.match(it,/data-action="calendar-day" data-value="2000-02-29"/);
 assert.match(it,/role="grid"/);
 assert.match(it,/aria-expanded="true"/);
 assert.match(en,/Choose date of birth/);
 assert.match(en,/data-value="2026-10-10"[^>]* disabled/);
 assert.equal(birthDateLabel('2000-02-29','it'),'29/02/2000');
});
test('global selected/error visual contract only responds to a box click, not labels or hover',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/document\.addEventListener\('pointerdown',event=>\{/);
 assert.match(js,/event\.target\.closest\?\.\('\.fa-interactive-box'\)/);
 assert.match(js,/selectedBoxId=box\?\.id\?\?null/);
 assert.doesNotMatch(js,/event\.target\.closest\?\.\('label'\)\.classList\.add/);
 assert.match(css,/\.fa-page-main \.fa-interactive-box\.fa-control-selected:not\(\.fa-field-invalid\)/);
 assert.match(css,/\.fa-page-main \.fa-interactive-box\.fa-field-invalid/);
 assert.match(css,/--fa-error-border:#e57872/);
 assert.match(css,/\.restored-onboarding \.league-pick-option:not\(\.active\):hover/);
 assert.match(css,/\.restored-onboarding \.club-table-row:not\(\.is-selected\):hover td/);
 assert.match(css,/\.fa-action-error:not\(\[hidden\]\)/);
 assert.match(js,/const summary=document\.getElementById\('manager-form-error'\)/);
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.match(ui,/id="manager-form-error"/);
 assert.match(ui,/renderDateControl\(p\.birthDate/);
 assert.match(ui,/renderNationalityControl\(p\.nationality/);
});
test('shared site pickers stay open only when requested, with escape and outside click handlers',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const action of ['nationality-toggle','nationality-select','calendar-toggle','calendar-prev','calendar-next','calendar-day','calendar-clear'])
  assert.ok(js.includes("case '"+action+"'"),action);
 assert.match(js,/if\(event\.key==='Escape'\)/);
 assert.match(js,/if\(pickerOpen&&!event\.target\.closest\?\.\('\[data-fa-picker\]'\)\)/);
 assert.match(js,/case 'calendar-month-select'/);
 assert.match(js,/case 'calendar-year-select'/);
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/'\/src\/site-pickers\.js'/);
 assert.match(server,/'\/src\/site-picker-ui\.js'/);
});

test('outside click closes picker without rerendering clicked input or losing focus',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(controller,/app\.querySelector\('\.fa-picker-popover'\)\?\.remove\(\)/);
 assert.match(controller,/app\.querySelector\('\.fa-picker-trigger\[aria-expanded="true"\]'\)\?\.setAttribute\('aria-expanded','false'\)/);
 assert.doesNotMatch(controller,/if\(!event\.target\.closest\?\.\('\[data-action\]'\)\)\{void render\(\);return;\}/);
 assert.match(controller,/const box=event\.target\.closest\?\.\('\.fa-interactive-box'\)/);
});

test('MFL-inspired calendar shows 42 dates, muted adjacent months, today and birth-date shortcut',()=>{
 const grid=calendarGridDays('2026-02','2026-10-09');
 assert.equal(grid.length,42);
 assert.equal(grid[0].iso,'2026-01-26');
 assert.equal(grid[0].outside,true);
 assert.equal(grid[6].iso,'2026-02-01');
 assert.equal(calendarGridDays('1900-01','2026-10-09')[0].iso,'1900-01-01');
 assert.equal(calendarGridDays('1900-01','2026-10-09')[0].disabled,false);
 const today=calendarGridDays('2026-10','2026-10-09');
 assert.equal(today.find(d=>d.iso==='2026-10-09').disabled,false);
 assert.equal(today.find(d=>d.iso==='2026-10-10').disabled,true);
 const rendered=renderDateControl('2000-02-29','it',true,'2026-10');
 assert.equal((rendered.match(/data-action="calendar-day"/g)||[]).length,42);
 assert.match(rendered,/class="fa-calendar-day is-outside/);
 assert.match(rendered,/is-today/);
 assert.match(rendered,/fa-calendar-title/);
 assert.match(rendered,/fa-calendar-weekdays/);
 assert.match(rendered,/data-action="calendar-today"/);
 assert.match(rendered,/>Oggi<\/button>/);
 assert.match(rendered,/data-action="calendar-clear"/);
 const en=renderDateControl('','en',true,'2026-10');
 assert.match(en,/data-action="calendar-today"/);
 assert.match(en,/>Today<\/button>/);
});
test('label click clears selected visual state and input/picker highlight shares one CSS contract',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/document.documentElement.classList.remove\('fa-keyboard-navigation'\)/);
 assert.match(js,/selectedBoxId=box\?\.id\?\?null/);
 assert.match(css,/\.fa-page-main \.fa-interactive-box\.fa-control-selected:not\(\.fa-field-invalid\),/);
 assert.match(css,/\.fa-page-main \.wizard-profile-field \.text-field\.fa-control-selected:focus:not\(\.fa-field-invalid\)/);
 assert.doesNotMatch(css,/\.fa-page-main \.wizard-profile-field \.text-field:focus\{border-color:var\(--fa-box-border\)\}/);
 assert.doesNotMatch(css,/outline:2px dashed/);
 assert.match(css,/html\.fa-keyboard-navigation .*fa-interactive-box:focus-visible/);
});
test('floating calendar is constrained to viewport on render and scroll',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(css,/\.fa-calendar-panel\{\s*position:fixed/);
 assert.match(js,/function positionCalendar\(\)/);
 assert.match(js,/window.addEventListener\('resize',positionCalendar\)/);
 assert.match(js,/window.addEventListener\('scroll',positionCalendar,true\)/);
 assert.match(js,/if\(pickerOpen==='calendar'\)\{/);
 assert.match(js,/positionCalendar\(\);/);
 assert.match(js,/case 'calendar-day':case 'calendar-today'/);
});

test('noninteractive field labels never synthesize click selection or implicit focus',()=>{
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const page=managerPage({managerProfile:blankManagerProfile()},'it');
 for(const field of ['first-name','last-name','birth-place']){
  assert.match(page,new RegExp('id="manager-'+field+'-label"'));
  assert.match(page,new RegExp('id="manager-'+field+'" aria-labelledby="manager-'+field+'-label"'));
  assert.doesNotMatch(page,new RegExp('<label[^>]+for="manager-'+field+'"'));
 }
 assert.match(main,/const box=event.target.closest\?\.\('\.fa-interactive-box'\)/);
 assert.doesNotMatch(main,/event\.target\.closest\?\.\('\[data-fa-picker\]'\)\?\.querySelector/);
 assert.match(main,/if\(event.key==='Tab'\)/);
});
test('calendar uses MFL compact default and optional birth-year picker',()=>{
 const compact=renderDateControl('2000-02-29','it',true,'2000-02');
 assert.match(compact,/data-action="calendar-jump-toggle"/);
 assert.match(compact,/aria-expanded="false"/);
 assert.doesNotMatch(compact,/data-calendar-part="year"/);
 assert.equal((compact.match(/data-action="calendar-day"/g)||[]).length,42);
 const expanded=renderDateControl('2000-02-29','it',true,'2000-02','months');
 assert.match(expanded,/data-action="calendar-month-select"/);
 const years=renderDateControl('2000-02-29','it',true,'2000-02','years');
 assert.match(years,/data-action="calendar-year-select"/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/position:fixed;width:min\(272px,calc\(100vw - 16px\)\)/);
 assert.match(css,/height:30px;padding:0/);
});
test('shared typeahead chooses closest options with accents, spelling and country/language inputs',()=>{
 const {closestSelectIndex,selectTypeaheadBuffer}=typeaheadFns;
 const countries=['Albania','Francia','Italia','Îles Åland','Stati Uniti','Regno Unito'];
 assert.equal(closestSelectIndex(countries,'ital'),2);
 assert.equal(closestSelectIndex(countries,'franc'),1);
 assert.equal(closestSelectIndex(countries,'iles'),3);
 assert.equal(closestSelectIndex(countries,'itla'),2);
 assert.equal(closestSelectIndex(['Italiano','English'],'engl'),1);
 assert.equal(selectTypeaheadBuffer('It','a',100),'Ita');
 assert.equal(selectTypeaheadBuffer('It','F',1200),'F');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/document.addEventListener\('keydown',event=>\{/);
 assert.match(main,/closestSelectIndex\(options.map/);
 assert.match(main,/selectTypeaheadBuffer\(/);
 assert.match(main,/kind==='nationality'&&pickerOpen!=='nationality'/);
 assert.match(main,/kind==='language'&&!languageMenuOpen/);
 assert.match(main,/fa-calendar-year-option/);
});

test('global non-selectable text preserves editable inputs and textareas',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/html,body,#app,#app \*\{user-select:none;-webkit-user-select:none\}/);
 assert.match(css,/#app :is\(input:not\(\[type="button"\]\)/);
 assert.match(css,/textarea,\[contenteditable="true"\]/);
 assert.match(css,/user-select:text;-webkit-user-select:text/);
});
test('Teatro Baraccano calendar uses five-part header and month/year overlays',()=>{
 const it=renderDateControl('2000-02-29','it',true,'2000-02');
 for(const action of ['calendar-prev-coarse','calendar-prev','calendar-jump-toggle','calendar-next','calendar-next-coarse'])
  assert.ok(it.includes('data-action="'+action+'"'),action);
 assert.equal((it.match(/data-action="calendar-day"/g)||[]).length,42);
 const months=renderDateControl('2000-02-29','it',true,'2000-02','months');
 assert.equal((months.match(/data-action="calendar-month-select"/g)||[]).length,12);
 const years=renderDateControl('2000-02-29','it',true,'2000-02','years');
 assert.ok((years.match(/data-action="calendar-year-select"/g)||[]).length>=120);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:34px 34px minmax\(0,1fr\) 34px 34px/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/data-calendar-view="years"/);
});
test('second-click and Escape close popup without retaining green box highlight',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/if\(!pickerOpen\)selectedBoxId=null/);
 assert.match(js,/pickerOpen=null;pickerView='days';selectedBoxId=null/);
 assert.ok(js.includes("app.querySelectorAll('.fa-control-selected').forEach(el=>el.classList.remove('.fa-control-selected'))") || js.includes("app.querySelectorAll('.fa-control-selected').forEach(el=>el.classList.remove('fa-control-selected'))"));
 assert.match(js,/selectedBoxId=null;pickerView='days';await render\(\)/);
});
test('dropdown search handles Unicode and Baraccano month/year options',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/event\.key\.length!==1\|\|!\/\[\\p\{L\}\\p\{N\}\]\/u\.test\(event.key\)/);
 for(const cls of ['.fa-nationality-menu .fa-picker-option','.language-listbox .language-option',
                  '.fa-calendar-month-picker .fa-calendar-month-option','.fa-calendar-year-picker .fa-calendar-year-option'])
  assert.ok(js.includes(cls),cls);
});

test('calendar height follows active view and footer order is Clear left, Today right',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const it=renderDateControl('2000-02-29','it',true,'2000-02','days');
 const en=renderDateControl('2000-02-29','en',true,'2000-02','days');
 const itClear=it.indexOf('data-action="calendar-clear"'),itToday=it.indexOf('data-action="calendar-today"');
 const enClear=en.indexOf('data-action="calendar-clear"'),enToday=en.indexOf('data-action="calendar-today"');
 assert.ok(itClear>0&&itToday>itClear,'Italian footer order');
 assert.ok(enClear>0&&enToday>enClear,'English footer order');
 assert.match(it,/>Cancella data<\/button>/);
 assert.match(it,/>Oggi<\/button>/);
 assert.match(en,/>Clear date<\/button>/);
 assert.match(en,/>Today<\/button>/);
 assert.match(css,/\.fa-calendar-panel\{\s*position:fixed;width:min\(272px,calc\(100vw - 16px\)\);max-width:none;\s*height:auto;max-height:calc\(100dvh - 16px\)/);
 assert.doesNotMatch(css,/height:344px/);
 assert.match(css,/\.fa-calendar-footer\{\s*display:flex;align-items:center;justify-content:space-between/);
 assert.match(css,/data-calendar-view="years"\] > :is\(\.fa-calendar-weekdays,\.fa-calendar-grid,\.fa-calendar-footer\)\{\s*display:none/);
 assert.match(css,/\.fa-calendar-month-picker,\s*\.fa-calendar-year-picker\{\s*position:relative/);
 assert.match(css,/\.fa-calendar-month-picker\{\s*grid-template-rows:repeat\(4,36px\)/);
 assert.match(css,/\.fa-calendar-year-picker\{[\s\S]*?max-height:min\(280px,calc\(100dvh - 94px\)\)/);
 const months=renderDateControl('2000-02-29','it',true,'2000-02','months');
 const years=renderDateControl('2000-02-29','it',true,'2000-02','years');
 assert.equal((months.match(/data-action="calendar-month-select"/g)||[]).length,12);
 assert.ok((years.match(/data-action="calendar-year-select"/g)||[]).length>=120);
});

test('keyboard P0: one Tab stop per custom dropdown, all options navigable without Tab',()=>{
 const nationality=renderNationalityControl('IT','it',true);
 const nationalOptions=[...nationality.matchAll(/<button[^>]*role="option"[^>]*>/g)].map(m=>m[0]);
 assert.equal(nationalOptions.length,NATIONALITY_CODES.length);
 assert.ok(nationalOptions.every(b=>b.includes('tabindex="-1"')));
 assert.match(nationality,/aria-controls="fa-nationality-listbox"/);
 for(const view of ['days','months','years']){
  const cal=renderDateControl('2000-02-29','it',true,'2000-02',view);
  const buttons=[...cal.matchAll(/<button\b[^>]*>/g)].map(x=>x[0]);
  const internals=buttons.filter(x=>!x.includes('id="manager-birth-date"'));
  assert.ok(internals.length>0);
  assert.ok(internals.every(x=>x.includes('tabindex="-1"')));
  assert.match(cal,/id="manager-birth-date" type="button"/);
 }
});
test('keyboard P0: calendar grids have proper ARIA rows and preserve approved footer',()=>{
 const days=renderDateControl('2000-02-29','it',true,'2000-02','days');
 assert.equal((days.match(/role="row" class="fa-calendar-row"/g)||[]).length,6);
 assert.equal((days.match(/role="gridcell"/g)||[]).length,42);
 const months=renderDateControl('2000-02-29','en',true,'2000-02','months');
 assert.equal((months.match(/role="row" class="fa-calendar-row"/g)||[]).length,10);
 const years=renderDateControl('2000-02-29','it',true,'2000-02','years');
 assert.ok((years.match(/role="row" class="fa-calendar-row"/g)||[]).length>=45);
 assert.ok(days.indexOf('data-action="calendar-clear"')<days.indexOf('data-action="calendar-today"'));
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-calendar-row\{display:contents\}/);
});
test('keyboard P0: global Tab closes popovers and navigates from trigger, both directions',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/function tabStopElements\(\)/);
 assert.match(js,/function tabRelativeTo\(anchorId,reverse=false\)/);
 assert.match(js,/tabRelativeTo\(anchor,event.shiftKey\)/);
 assert.match(js,/event.stopImmediatePropagation\(\)/);
 assert.match(js,/languageMenuOpen&&el\?\.closest\?\.\('\[data-language-picker\]'\)/);
 assert.match(js,/pickerOpen&&el\?\.closest\?\.\('\[data-fa-picker\]'\)/);
 assert.doesNotMatch(js,/toggleLanguageMenu\(false,event.shiftKey\?'combo':'next'\)/);
});
test('keyboard P0: site rerenders preserve focus and wizard route headings gain focus',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.match(js,/function focusSnapshot\(\)/);
 assert.match(js,/function restoreSnapshot\(snapshot\)/);
 assert.match(js,/if\(samePage\)restoreSnapshot\(snapshot\)/);
 assert.match(js,/lastRenderedRoute=page/);
 assert.match(js,/heading\?\.focus\(\{preventScroll:false\}\)/);
 assert.match(ui,/<h1 class="fa-page-title">/);
 assert.match(js,/heading\?\.setAttribute\('tabindex','-1'\)/);
});
test('keyboard P1: field-level bilingual summary and arrows/PageUp/PageDown date grid',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/tr\(lang,'Controlla i campi evidenziati in rosso.','Check the fields highlighted in red.'\)/);
 assert.doesNotMatch(js,/tr\(lang,'Controlla: ','Check: '\)\+detail/);
 assert.match(js,/form.elements.namedItem\(key\)\)\?\.focus\(\{preventScroll:false\}\)/);
 assert.match(js,/event.altKey&&event.key==='ArrowUp'/);
 assert.match(js,/const deltas=day\?/);
 assert.match(js,/const monthDelta=/);
 assert.match(js,/pickerMonth=shiftCalendarMonth\(pickerMonth,monthDelta\)/);
 assert.match(js,/event.key==='Home'/);
 assert.match(js,/event.key==='End'/);
});
test('keyboard P1: responsive dropdown positioned within viewport',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(js,/function positionNationality\(\)/);
 assert.match(js,/window.addEventListener\('resize',positionNationality\)/);
 assert.match(js,/window.addEventListener\('scroll',positionNationality,true\)/);
 assert.match(js,/if\(pickerOpen==='nationality'\)positionNationality\(\)/);
 assert.match(css,/\.fa-nationality-menu\{\s*position:fixed;width:min\(320px,calc\(100vw - 16px\)\)/);
 assert.match(css,/max-height:min\(270px,calc\(100dvh - 16px\)\)/);
});

test('keyboard Tab uses identical green border and inset as click selection, with no alternate focus ring',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const shared=/\.fa-page-main \.fa-interactive-box\.fa-control-selected:not\(\.fa-field-invalid\),[\s\S]*?html\.fa-keyboard-navigation \.fa-page-main \.fa-interactive-box:focus-visible:not\(\.fa-field-invalid\)\{\s*border-color:var\(--fa-selection-border\);box-shadow:inset 0 0 0 1px var\(--fa-selection-border\);outline:none;/;
 assert.match(css,shared);
 assert.doesNotMatch(css,/outline:2px solid #8aa8a3;outline-offset:2px;/);
 assert.ok(js.includes("if(event.key==='Tab'){"));
 assert.ok(js.includes("selectedBoxId=null;"));
 assert.ok(js.includes("app.querySelectorAll('.fa-control-selected').forEach(el=>el.classList.remove('fa-control-selected'))"));
 assert.match(css,/\.fa-page-main \.fa-interactive-box\.fa-field-invalid,[\s\S]*?border-color:var\(--fa-error-border\)/);
});
test('generic IT/EN form errors remain by Avanti while invalid fields use red outlines',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(js,/tr\(lang,'Controlla i campi evidenziati in rosso.','Check the fields highlighted in red.'\)/);
 assert.doesNotMatch(js,/const detail=invalid.map/);
 assert.match(js,/updateManagerField\(form.elements.namedItem\(key\),issues\[key\]\)/);
 assert.match(css,/\.fa-action-error:not\(\[hidden\]\)/);
 assert.match(css,/\.fa-interactive-box\.fa-field-invalid/);
});


test('matched dropdown options are centered using relative viewport geometry, not offsetTop',()=>{
 const {centeredMenuScrollTop,closestSelectIndex}=typeaheadFns;
 assert.equal(centeredMenuScrollTop(0,200,1000,500,40),420);
 assert.equal(centeredMenuScrollTop(300,200,1000,200,40),420);
 assert.equal(centeredMenuScrollTop(0,200,1000,0,40),0);
 assert.equal(centeredMenuScrollTop(600,200,1000,400,40),800);
 assert.equal(centeredMenuScrollTop(0,220,200,40,40),0);
 assert.equal(centeredMenuScrollTop(25,0,1000,200,40),25);
 assert.equal(centeredMenuScrollTop(0,200,1000,NaN,40),0);
 assert.equal(closestSelectIndex(['Albania','Francia','Italia','Regno Unito'],'Itla'),2);
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/function centerMenuOption\(option\)/);
 assert.match(js,/option\.getBoundingClientRect\(\)/);
 assert.match(js,/menu\.getBoundingClientRect\(\)/);
 assert.match(js,/optionRect\.top-menuRect\.top/);
 assert.match(js,/menu\.scrollTop=centeredMenuScrollTop\(/);
 assert.doesNotMatch(js,/option\.offsetTop-panel\.offsetTop/);
});

test('shared centering works for typeahead, newly opened selected nationality, arrows and year grid',()=>{
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const selector of [
  '.fa-nationality-menu,.fa-calendar-year-picker,.fa-calendar-month-picker,.language-listbox',
  '.fa-nationality-menu .fa-picker-option.is-selected, .fa-nationality-menu .fa-picker-option',
  '.fa-calendar-year-picker .fa-calendar-year-option.is-selected'
 ])assert.ok(js.includes(selector),selector);
 assert.match(js,/option\?\.focus\(\{preventScroll:true\}\);\s*centerMenuOption\(option\)/);
 assert.match(js,/nextOption\?\.focus\(\{preventScroll:true\}\);centerMenuOption\(nextOption\)/);
 assert.match(js,/selected\?\.focus\(\{preventScroll:true\}\);centerMenuOption\(selected\)/);
 assert.match(js,/centerMenuOption\(app\.querySelector\('\.fa-calendar-year-picker/);
 assert.match(js,/if\(kind==='nationality'&&pickerOpen!=='nationality'\)/);
 assert.match(js,/if\(kind==='language'&&!languageMenuOpen\)/);
});


test('wizard exit button is Menu in IT and EN for all four stages without changing its action',()=>{
 const draft={managerName:'Ada Manager',managerProfile:blankManagerProfile(),countryId:'IT',clubId:4};
 for(const lang of ['it','en']){
  for(const page of [managerPage(draft,lang),countryPage(draft,lang),championshipPage({...draft,championshipId:'IT'},lang),teamsPage(draft,lang)]){
   assert.match(page,/<button[^>]*data-action="cancel-setup"[^>]*>[\s\S]*?<span>Menu<\/span><\/button>/);
   assert.doesNotMatch(page,/<span>(Annulla|Cancel)<\/span>/);
  }
 }
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(js,/case 'cancel-setup':draft=newDraft\(\);managerSubmitted=false;pickerMonth=null;navigate\('\/'\);break;/);
});


test('country step uses same panel, green focus and selection contract as manager',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const lang of ['it','en']){
  const blank=countryPage({countryId:null,clubId:null},lang);
  assert.match(blank,/class="wizard-country-panel panel"/);
  assert.match(blank,/class="onboard-heading"><h2 id="league-pick-title">/);
  assert.equal((blank.match(/class="fa-interactive-box wizard-country-option /g)||[]).length,8);
  assert.equal((blank.match(/aria-pressed="false"/g)||[]).length,8);
  assert.match(blank,/data-action="country-next" disabled/);
  assert.match(blank,/class="fa-action-row wizard-country-actions"/);
  assert.match(blank,lang==='it'?/Avanti: Campionato/:/Next: League/);
  assert.doesNotMatch(blank,/class="league-pick wizard-country-panel"/);
  const selected=countryPage({countryId:'IT',clubId:null},lang);
  assert.equal((selected.match(/fa-choice-selected/g)||[]).length,1);
  assert.equal((selected.match(/aria-pressed="true"/g)||[]).length,1);
  assert.doesNotMatch(selected,/data-action="country-next" disabled/);
 }
 assert.match(css,/\.wizard-country-panel\{max-width:820px\}/);
 assert.match(css,/\.fa-page-main \.wizard-country-option\.fa-choice-selected\{/);
 assert.match(css,/@media\(max-width:620px\)\{\s*\.wizard-country-options\{grid-template-columns:minmax\(0,1fr\)/);
});

test('club step preserves full-page table, summary, and consistent action',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const lang of ['it','en']){
  const blank=teamsPage({managerName:'Ada Rossi',countryId:'IT',clubId:null},lang);
  assert.match(blank,/class="onboard-clubs wizard-team-panel"/);
  assert.match(blank,/class="onboard-aside wizard-club-summary"/);
  assert.equal((blank.match(/class="club-table-select"/g)||[]).length,20);
  assert.equal((blank.match(/class="club-table-row /g)||[]).length,20);
  assert.match(blank,/class="fa-action-row wizard-team-actions"/);
  assert.match(blank,/data-action="start-career" disabled/);
  assert.doesNotMatch(blank,/selected-club-glow|class="hint"/);
  const selected=teamsPage({managerName:'Ada Rossi',countryId:'IT',clubId:2},lang);
  assert.equal((selected.match(/class="club-table-row is-selected"/g)||[]).length,1);
  assert.match(selected,/class="selected-stats"/);
  assert.match(selected,/class="wizard-manager-summary"/);
  assert.doesNotMatch(selected,/data-action="start-career" disabled/);
 }
 assert.match(css,/\.wizard-team-grid\{grid-template-columns:minmax\(0,1fr\) 320px/);
 assert.match(css,/@media\(max-width:760px\)\{\s*\.wizard-team-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.doesNotMatch(css,/\.wizard-team-grid\{[^}]*overflow-y:auto/);
 assert.match(css,/\.wizard-team-grid \.club-table-row\.is-selected td\{/);
 assert.match(css,/html\.fa-keyboard-navigation \.wizard-team-grid \.club-table-row:focus-within:not\(\.is-selected\) td\{/);
});


test('committed country choice keeps the green inset on hover and focus',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const selected=countryPage({countryId:'IT'},'it');
 assert.match(selected,/class="fa-interactive-box wizard-country-option fa-choice-selected"/);
 assert.match(css,/\.fa-page-main \.wizard-country-option\.fa-choice-selected\{\s*border-color:var\(--fa-selection-border\);/);
 for(const selector of [':hover',':focus',':focus-visible']){
  assert.ok(css.includes('.fa-page-main .fa-interactive-box'+selector+':not(.fa-control-selected,.fa-choice-selected):not(.fa-field-invalid)'),selector);
 }
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/const box=event\.target\.closest\?\.\('\.fa-interactive-box'\)/);
 assert.match(main,/selectedBoxId=box\?\.id\?\?null/);
});


test('Tab keyboard highlight on manager fields wins over neutral focus CSS after country redesign',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const manager=managerPage({managerProfile:blankManagerProfile()},'it');
 // One selector-list :not() excludes both selected states WITHOUT increasing
 // specificity versus the original manager focus selectors.
 const neutralBlock=css.match(/(\.fa-page-main \.fa-interactive-box:hover[\s\S]*?)\{\s*border-color:var\(--fa-box-border\)/)?.[1];
 assert.ok(neutralBlock);
 for(const focus of [':hover',':focus',':focus-visible']){
  assert.ok(neutralBlock.includes('.fa-page-main .fa-interactive-box'+focus+':not(.fa-control-selected,.fa-choice-selected):not(.fa-field-invalid)'),focus);
 }
 assert.doesNotMatch(neutralBlock,/:not\(\.fa-control-selected\):not\(\.fa-choice-selected\)/);
 const focusRule=css.indexOf('html.fa-keyboard-navigation .fa-page-main .fa-interactive-box:focus-visible:not(.fa-field-invalid)');
 const neutralRule=css.indexOf('.fa-page-main .fa-interactive-box:focus-visible:not(.fa-control-selected,.fa-choice-selected):not(.fa-field-invalid)');
 assert.ok(neutralRule>=0&&focusRule>neutralRule,'keyboard rule must be later with equal specificity');
 assert.match(css,/border-color:var\(--fa-selection-border\);box-shadow:inset 0 0 0 1px var\(--fa-selection-border\);outline:none;/);
 assert.match(js,/if\(event.key==='Tab'\)\{\s*selectedBoxId=null/);
 assert.match(js,/document\.documentElement\.classList\.add\('fa-keyboard-navigation'\)/);
 assert.match(ui,/export function managerPage\(draft,lang,pickers=\{\}\)/);
 for(const field of ['manager-first-name','manager-last-name','manager-birth-date','manager-nationality','manager-birth-place']){
  assert.ok(manager.includes('id="'+field+'"'),field);
 }
 assert.match(ui,/class="wizard-manager-panel panel"/);
});


test('all four new-career steps have title but no subtitle in IT and EN',()=>{
 for(const lang of ['it','en']){
  const pages=[
   managerPage({managerProfile:blankManagerProfile()},lang),
   countryPage({countryId:null},lang),
   championshipPage({countryId:'IT',championshipId:null},lang),
   teamsPage({countryId:'IT',championshipId:'IT',clubId:null,managerName:'Ada'},lang)
  ];
  for(let i=0;i<pages.length;i++){
   const header=pages[i].match(/<header class="onboard-header fa-page-heading">([\s\S]*?)<\/header>/)?.[1];
   assert.ok(header);
   assert.match(header,new RegExp((lang==='it'?'PASSAGGIO ':'STEP ')+(i+1)+'/4'));
   assert.match(header,/<h1 class="fa-page-title">/);
   assert.doesNotMatch(header,/<p\b/);
   assert.match(header,/<div class="wizard-topline">/);
  }
 }
});

test('all eight leagues use high-definition offline flags in new career, My Careers, and simulation',()=>{
 const codes={IT:'it',ENG:'gb-eng',ES:'es',DE:'de',FR:'fr',PT:'pt',NL:'nl',BR:'br'};
 assert.equal(LEAGUES.length,8);
 for(const league of LEAGUES){
  const asset=codes[league.id];
  assert.ok(asset,'Missing country asset: '+league.id);
  const tag=countryFlag(league.id);
  assert.match(tag,new RegExp('class="country-flag" src="/assets/flags/'+asset+'\\.svg"'));
  assert.match(tag,/width="32" height="24" alt=""/);
  assert.doesNotMatch(tag,/[\u{1F1E6}-\u{1F1FF}]/u);
  const svg=readFileSync(new URL('../assets/flags/'+asset+'.svg',import.meta.url),'utf8');
  assert.match(svg,/<svg\b[^>]*viewBox="0 0 640 480"/);
  for(const lang of ['it','en']){
   const html=countryPage({countryId:null},lang);
   const start=html.indexOf('data-country="'+league.id+'"');
   assert.ok(start>=0);
   assert.ok(html.slice(start,start+500).includes(tag));
  }
 }
 assert.equal(countryFlag('UNKNOWN'),'');
 assert.equal(countryFlag('__proto__'),'');
 assert.equal(countryFlag('GB'),'');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.country-flag\{display:block;width:32px;height:24px/);
 assert.match(css,/\.wizard-careers \.wizard-career-location \.country-flag\{/);
 const saved=careersPage({rows:[{id:'one',status:'ok',meta:{managerName:'Ada',careerName:'Test',countryId:'BR',clubId:1,updatedAt:'2026-10-09'},state:createSession('BR',1,'2026-10-09')}],activeId:null},'it');
 assert.match(saved,/class="wizard-careers-list"/);
 assert.match(saved,/class="wizard-career-location"/);
 assert.match(saved,/src="\/assets\/flags\/br\.svg"/);
 assert.doesNotMatch(saved,/class="career-grid"|class="career-card/);
 const simulation=simulationPage({managerName:'Ada',countryId:'IT',clubId:1},createSession('IT',1,'2026-10-09'),'it',false);
 assert.match(simulation,/src="\/assets\/flags\/it\.svg"/);
 assert.doesNotMatch(simulation,/undefined|class="wizard-country-flag-svg"/);
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/esc\(l\.flag\)/);
});

test('full vendored 4:3 flag catalog contains exactly 271 safely named SVG assets and no 1x1 directory',()=>{
 const dir=new URL('../assets/flags/',import.meta.url);
 const names=readdirSync(dir);
 const flags=names.filter(n=>n.endsWith('.svg'));
 assert.equal(flags.length,271);
 assert.equal(new Set(flags).size,271);
 assert.equal(existsSync(new URL('../assets/flags/1x1/',import.meta.url)),false);
 for(const name of flags){
  assert.match(name,/^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/);
  const svg=readFileSync(new URL('../assets/flags/'+name,import.meta.url),'utf8');
  assert.match(svg,/<svg\b/);
  assert.match(svg,/<\/svg>/);
  assert.doesNotMatch(svg,/<script\b|<foreignObject\b|<image\b|\sonload=/i);
 }
 for(const name of ['it.svg','gb-eng.svg','br.svg','jp.svg','us.svg','xx.svg'])assert.ok(flags.includes(name));
 assert.match(readFileSync(new URL('../assets/flags/LICENSE',import.meta.url),'utf8'),/MIT License/);
});

test('HTTP serves every bundled flag with SVG MIME and nosniff but denies unknown or nested paths',{timeout:30000},async()=>{
 const port=24853;
 const base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{
  env:{...process.env,PORT:String(port)},stdio:'ignore'
 });
 try{
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
   if(child.exitCode!==null)throw new Error('Flag smoke HTTP server exited with '+child.exitCode);
   try{
    if((await fetch(base+'/',{signal:AbortSignal.timeout(450)})).ok){ready=true;break;}
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.ok(ready,'Offline HTTP server did not become ready');
  const fixtureModule=await fetch(base+'/src/fixture-calendar.js');
  assert.equal(fixtureModule.status,200,'Fixture module must load in the browser');
  assert.match(fixtureModule.headers.get('content-type')??'',/^text\/javascript\b/);
  assert.equal(fixtureModule.headers.get('x-content-type-options'),'nosniff');
  assert.match(await fixtureModule.text(),/export function nextScheduledClubFixture/);
  const flags=readdirSync(new URL('../assets/flags/',import.meta.url)).filter(n=>n.endsWith('.svg'));
  assert.equal(flags.length,271);
  for(const name of flags){
   const response=await fetch(base+'/assets/flags/'+name);
   assert.equal(response.status,200,'SVG HTTP status: '+name);
   assert.match(response.headers.get('content-type')??'',/^image\/svg\+xml\b/i,'MIME: '+name);
   assert.equal(response.headers.get('x-content-type-options'),'nosniff','nosniff: '+name);
   assert.match(await response.text(),/<svg\b/,'SVG body: '+name);
  }
  for(const path of ['/assets/flags/missing.svg','/assets/flags/1x1/ad.svg','/assets/flags/it.svg.txt','/assets/flags/it.svg%00']){
   assert.equal((await fetch(base+path)).status,404,path);
  }
  assert.equal((await fetch(base+'/assets/flags/it.svg',{method:'POST'})).status,405);
 }finally{
  child.kill();
 }
});

test('club table is denser and includes actual reputation and capacity for all 20 clubs',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const lang of ['it','en']){
  const first=getLeagueClubs('IT')[0];
  const html=teamsPage({countryId:'IT',clubId:first.id,managerName:'Ada'},lang);
  assert.match(html,/class="club-table-reputation"/);
  assert.match(html,/class="club-table-capacity"/);
  assert.equal((html.match(/<td class="club-table-reputation"/g)||[]).length,20);
  assert.equal((html.match(/<td class="club-table-capacity"/g)||[]).length,20);
  assert.ok(html.includes(first.stadium));
  assert.ok(html.includes(new Intl.NumberFormat(lang==='en'?'en-GB':'it-IT').format(first.capacity)));
  assert.match(html,/class="wizard-stadium-stat"/);
  assert.match(html,/class="club-table-row is-selected"/);
 }
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table td\{height:auto;padding:0 6px/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table\{border-spacing:0 4px\}/);
 assert.match(css,/@media\(max-width:530px\)\{[\s\S]*?\.club-table-reputation\{width:15%/);
 assert.doesNotMatch(css,/\.wizard-team-grid\{[^}]*overflow-y:auto/);
});

test('Rosa is visible, disabled, translated and has no action until implemented',()=>{
 for(const lang of ['it','en']){
  const blank=teamsPage({countryId:'IT',clubId:null,managerName:'Ada'},lang);
  const selected=teamsPage({countryId:'IT',clubId:1,managerName:'Ada'},lang);
  for(const page of [blank,selected]){
   assert.match(page,/<button type="button" class="btn secondary wizard-roster-button" disabled aria-disabled="true"/);
   assert.match(page,lang==='it'?/<span>Rosa<\/span>/:/<span>Squad<\/span>/);
   assert.doesNotMatch(page,/data-action="roster"|data-action="squad"/);
  }
  assert.match(blank,/data-action="start-career" disabled/);
  assert.doesNotMatch(selected,/data-action="start-career" disabled/);
 }
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/case 'roster':|case 'squad':/);
});


test('championship is a required fourth-stage selection, scoped to selected country',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.equal(LEAGUES.length,8);
 for(const nation of LEAGUES){
  for(const lang of ['it','en']){
   const draft={countryId:nation.id,championshipId:null};
   const blank=championshipPage(draft,lang);
   assert.match(blank,/class="wizard-country-panel wizard-championship-panel panel"/);
   assert.match(blank,lang==='it'?/Scegli il campionato/:/Choose your league/);
   assert.equal((blank.match(/data-action="championship" /g)||[]).length,1);
   assert.match(blank,/aria-pressed="false"/);
   assert.match(blank,/data-action="championship-next" disabled/);
   assert.ok(blank.includes(nation.competition));
   const checked=championshipPage({...draft,championshipId:nation.id},lang);
   assert.equal((checked.match(/aria-pressed="true"/g)||[]).length,1);
   assert.match(checked,/class="fa-interactive-box wizard-country-option wizard-championship-option fa-choice-selected"/);
   assert.doesNotMatch(checked,/data-action="championship-next" disabled/);
  }
 }
 assert.match(controller,/countryId:null,championshipId:null,clubId:null/);
 assert.match(controller,/case 'country':if\([\s\S]*?draft.championshipId=null;draft.clubId=null/);
 assert.match(controller,/case 'championship':if\(LEAGUES\.some\(l=>l\.id===element\.dataset\.championship&&l\.id===draft\.countryId\)\)/);
 assert.match(controller,/case 'championship-next':if\(LEAGUES\.some\(l=>l\.id===draft\.championshipId&&l\.id===draft\.countryId\)\)navigate\('\/new-career\/team'\)/);
 assert.match(controller,/draft\.championshipId&&l\.id===draft\.countryId/);
 assert.match(controller,/history\.replaceState\(\{\},'','\/new-career\/league'\)/);
 assert.match(server,/'\/new-career\/league'/);
 assert.match(css,/\.wizard-championship-options\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.doesNotMatch(controller,/managerProfile:[\s\S]{0,80}championshipId:[\s\S]{0,80}createCareer\(/);
});


test('the club table rebuild does not impose any global table alignment rule',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.fa-page-main table/);
 assert.doesNotMatch(css,/\.fa-table-cell-inner|\.fa-table-cell-center|\.fa-table-cell-start/);
 assert.doesNotMatch(css,/\.fa-page-main table (?:th|td)\{display:(?:flex|grid)/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table :is\(th,td\)\{vertical-align:middle\}/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-cell\{\s*display:flex;align-items:center;/);
 const html=teamsPage({countryId:'IT',championshipId:'IT',clubId:1},'it');
 assert.match(html,/<table class="club-table"/);
 assert.doesNotMatch(html,/fa-table-cell-inner/);
});

test('every club row uses an equal-height, vertically centered cell across eight leagues',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const nation of LEAGUES){
  for(const lang of ['it','en']){
   const html=teamsPage({countryId:nation.id,championshipId:nation.id,clubId:1,managerName:'Ada'},lang);
   assert.equal((html.match(/class="club-table-row /g)||[]).length,20);
   assert.equal((html.match(/class="club-table-cell club-table-cell--name"/g)||[]).length,20);
   assert.equal((html.match(/class="club-table-cell club-table-cell--number"/g)||[]).length,40);
   assert.equal((html.match(/class="club-table-cell club-table-cell--status"/g)||[]).length,20);
   assert.equal((html.match(/class="club-table-cell"/g)||[]).length,40);
   assert.equal((html.match(/class="club-table-select"/g)||[]).length,20);
   assert.equal((html.match(/<td class="club-table-status"><div class="club-table-cell club-table-cell--status"><span class="club-table-indicator"/g)||[]).length,20);
   assert.equal((html.match(/<td><div class="club-table-cell club-table-cell--name"><button type="button" class="club-table-select"/g)||[]).length,20);
  }
 }
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-cell\{[\s\S]*?min-height:41px;width:100%;padding:3px 0/);
 assert.match(css,/@media\(max-width:530px\)\{\s*\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-cell\{min-height:43px\}/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table-name\{\s*display:flex;flex-direction:column;justify-content:center;align-items:flex-start/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-indicator\{\s*display:grid;place-items:center;margin:0;line-height:1/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-cell--status\{justify-content:center\}/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-reputation \.club-table-cell--number\{justify-content:center\}/);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table \.club-table-capacity \.club-table-cell--number\{justify-content:flex-end\}/);
});

test('local club cell rebuild preserves selection, keyboard focus and compact responsive rows',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const selected=teamsPage({countryId:'IT',championshipId:'IT',clubId:2},'it');
 const blank=teamsPage({countryId:'IT',championshipId:'IT',clubId:null},'it');
 assert.equal((selected.match(/class="club-table-row is-selected"/g)||[]).length,1);
 assert.equal((blank.match(/class="club-table-row is-selected"/g)||[]).length,0);
 assert.equal((selected.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(css,/\.restored-onboarding \.wizard-team-grid \.club-table td\{height:auto;padding:0 6px;font-size:11px\}/);
 assert.match(css,/@media\(max-width:530px\)\{[\s\S]*?\.restored-onboarding \.wizard-team-grid \.club-table td\{height:auto;padding:0 5px;font-size:10px\}/);
 assert.match(css,/html\.fa-keyboard-navigation \.wizard-team-grid \.club-table-row:focus-within:not\(\.is-selected\) td\{/);
 assert.match(css,/\.wizard-team-grid \.club-table-row\.is-selected td\{/);
 assert.doesNotMatch(css,/\.wizard-team-grid\{[^}]*overflow-y:auto/);
});


test('My Careers preserves three independent rows, active selection and full action IDs',async()=>{
 const db=await setup();
 const a=await createCareer(db,form('Ada','IT',2));
 await createCareer(db,form('Bo','DE',3));
 const c=await createCareer(db,form('Cami','FR',4));
 await selectCareer(db,a.meta.id);
 const catalog=await readCatalog(db);
 for(const lang of ['it','en']){
  const html=careersPage(catalog,lang);
  assert.equal((html.match(/class="wizard-career-row /g)||[]).length,3);
  assert.equal((html.match(/class="wizard-career-identity"/g)||[]).length,3);
  assert.equal((html.match(/class="wizard-career-facts"/g)||[]).length,3);
  assert.equal((html.match(/class="wizard-career-actions"/g)||[]).length,3);
  assert.equal((html.match(/aria-current="true"/g)||[]).length,0);
  assert.equal((html.match(/data-action="load"/g)||[]).length,3);
  assert.equal((html.match(/data-action="rename"/g)||[]).length,3);
  assert.equal((html.match(/data-action="export"/g)||[]).length,3);
  assert.equal((html.match(/data-action="delete"/g)||[]).length,3);
  assert.ok(html.includes('data-id="'+a.meta.id+'"'));
  assert.ok(html.includes('data-id="'+c.meta.id+'"'));
  assert.match(html,lang==='it'?/Carriere salvate/:/Saved careers/);
  assert.match(html,lang==='it'?/>Carica</:/>Load</);
  assert.match(html,lang==='it'?/Ultimo salvataggio/:/Last saved/);
  assert.doesNotMatch(html,lang==='it'?/Disponibile|Attiva</:/Available|Active</);
  const fromSimulation=careersPage(catalog,lang,a.meta.id);
  assert.equal((fromSimulation.match(/aria-current="true"/g)||[]).length,1);
  assert.match(fromSimulation,/class="wizard-career-row is-current /);
  assert.match(fromSimulation,lang==='it'?/Attuale/:/Current/);
  assert.equal((fromSimulation.match(/data-action="load"/g)||[]).length,3);
 }
});

test('My Careers shows a corrupt slot with red status, export/delete but never load/rename',async()=>{
 const db=await setup();
 const good=await createCareer(db,form('Healthy','IT',1));
 const corrupt=await createCareer(db,form('Broken','ENG',2));
 db.data.get('snapshots').set(corrupt.meta.id,{id:corrupt.meta.id,raw:'{bad'});
 const catalog=await readCatalog(db);
 const it=careersPage(catalog,'it'),en=careersPage(catalog,'en');
 for(const html of [it,en]){
  const row=html.match(new RegExp('<article class="wizard-career-row [^"]*"[^>]*>[\\s\\S]*?'+corrupt.meta.id+'[\\s\\S]*?<\\/article>'));
  // Extract by the corrupt row's unique label rather than depending on ordering.
  assert.match(html,/class="wizard-career-row  is-corrupt"/);
  assert.match(html,/class="wizard-career-status is-invalid"/);
  assert.match(html,/class="wizard-career-warning" role="status"/);
  assert.match(html,new RegExp('data-action="export"[^>]*data-id="'+corrupt.meta.id+'"'));
  assert.match(html,new RegExp('data-action="delete"[^>]*data-id="'+corrupt.meta.id+'"'));
  assert.doesNotMatch(html,new RegExp('data-action="load"[^>]*data-id="'+corrupt.meta.id+'"'));
  assert.doesNotMatch(html,new RegExp('data-action="rename"[^>]*data-id="'+corrupt.meta.id+'"'));
  assert.match(html,new RegExp('data-action="load"[^>]*data-id="'+good.meta.id+'"'));
 }
 assert.match(it,/Salvataggio danneggiato/);
 assert.match(en,/Corrupt save: loading disabled/);
});

test('My Careers uses only wizard-scoped panels and responsive document scrolling',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 assert.match(sheet,/\.fa-page-main \.wizard-careers \.wizard-careers-panel\{/);
 assert.match(sheet,/background:#142832;border:1px solid #385552;box-shadow:none;/);
 assert.match(sheet,/\.wizard-careers \.wizard-career-row\{/);
 assert.match(sheet,/\.wizard-careers \.wizard-career-row\.is-current\{/);
 assert.match(sheet,/\.wizard-careers \.wizard-career-row\.is-corrupt\{/);
 assert.match(sheet,/@media\(max-width:760px\)\{[\s\S]*?\.wizard-careers \.wizard-career-facts/);
 assert.match(sheet,/@media\(max-width:620px\)\{[\s\S]*?\.wizard-careers \.wizard-topline/);
 assert.match(sheet,/@media\(max-width:400px\)\{[\s\S]*?\.wizard-careers \.wizard-career-actions/);
 const block=sheet.slice(sheet.indexOf('/* My Careers follows the New Career wizard layout'));
 assert.doesNotMatch(block,/overflow-y:\s*(?:scroll|auto)|max-height:\s*\d+px/);
 assert.match(ui,/class="wizard-careers-panel panel"/);
 assert.match(ui,/class="wizard-careers-list"/);
 const empty=careersPage({rows:[],activeId:null},'en');
 assert.equal((empty.match(/<h1\b/g)||[]).length,1);
 assert.doesNotMatch(empty,/<p[^>]*>Open a career or create a new one\./);
 assert.doesNotMatch(empty,/STEP \d\/\d/);
});


test('My Careers compact UI uses identical Menu button markup as New Career',()=>{
 const lang=['it','en'],catalog={rows:[],activeId:'persisted-selection'};
 const ui=readFileSync(new URL('../src/ui-pages.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const locale of lang){
  const manager=managerPage({managerName:'Ada',managerProfile:blankManagerProfile()},locale);
  const careers=careersPage(catalog,locale);
  const extract=page=>page.match(/<button type="button" class="btn ghost wizard-cancel" data-action="cancel-setup"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(extract(manager));
  assert.equal(extract(careers),extract(manager));
  assert.equal((careers.match(/data-action="cancel-setup"/g)||[]).length,1);
  assert.doesNotMatch(careers,/is-current|is-available|Attiva|Disponibile|Active|Available/);
 }
 const block=css.slice(css.indexOf('/* Compact My Careers controls'));
 assert.match(block,/\.wizard-careers \.wizard-career-actions \.btn\{\s*min-width:84px;min-height:33px;padding:6px 9px;\s*font-size:10px/);
 assert.match(block,/\.wizard-careers \.wizard-careers-toolbar-actions \.btn\{\s*min-width:110px;min-height:35px;padding:6px 10px;\s*font-size:11px/);
 assert.match(block,/\.wizard-careers \.wizard-career-actions \.btn \.fa-icon,[\s\S]*?width:13px;height:13px/);
 assert.match(ui,/button\('cancel-setup',tr\(lang,'Menu','Menu'\),'ghost wizard-cancel'\)/);
});

test('Current career appears only with an explicit in-simulation entry context',async()=>{
 const db=await setup();
 const a=await createCareer(db,form('Ada','IT',2));
 const b=await createCareer(db,form('B','ENG',3));
 await selectCareer(db,a.meta.id);
 const catalog=await readCatalog(db);
 for(const locale of ['it','en']){
  const fromMenu=careersPage(catalog,locale);
  assert.equal((fromMenu.match(/aria-current="true"/g)||[]).length,0);
  assert.doesNotMatch(fromMenu,/is-current|is-available|Disponibile|Available/);
  const fromCareer=careersPage(catalog,locale,b.meta.id);
  assert.equal((fromCareer.match(/aria-current="true"/g)||[]).length,1);
  assert.equal((fromCareer.match(/class="wizard-career-status is-active"/g)||[]).length,1);
  assert.match(fromCareer,locale==='it'?/Attuale/:/Current/);
  assert.equal((fromCareer.match(/data-action="load"/g)||[]).length,2);
  assert.doesNotMatch(fromCareer,/class="wizard-career-status is-available"/);
 }
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(controller,/let lastRenderedRoute=null,careersFromSimulationId=null;/);
 assert.match(controller,/case 'careers':careersFromSimulationId=path\(\)==='\/simulation'&&loaded\?loaded\.meta\.id:null;if\(path\(\)==='\/dashboard'&&loaded\)careersFromSimulationId=loaded\.meta\.id;navigate\('\/careers'\);/);
 assert.match(controller,/careersPage\(catalog,lang,careersFromSimulationId\)/);
 assert.match(controller,/if\(url!=='\/careers'\)careersFromSimulationId=null/);
 assert.match(controller,/window\.addEventListener\('popstate',\(\)=>\{/);
 assert.match(controller,/if\(!\(CAREER_ROUTES\.has\(lastRenderedRoute\)&&CAREER_ROUTES\.has\(path\(\)\)\)\)stop\(\)/);
 assert.match(controller,/searchQuery='';searchHits=\[\];careersFromSimulationId=null/);
});

test('Rename uses site-style native modal, trims and validates names, never browser prompt',async()=>{
 const db=await setup();
 await createCareer(db,form('Ada','IT',2));
 const catalog=await readCatalog(db);
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const locale of ['it','en']){
  const html=careersPage(catalog,locale);
  assert.match(html,/<dialog id="career-rename-dialog" class="fa-site-dialog fa-rename-dialog" aria-labelledby="career-rename-title"/);
  assert.match(html,/<form id="career-rename-form" novalidate>/);
  assert.match(html,/<input id="career-rename-input" class="text-field fa-interactive-box"[^>]*maxlength="80"/);
  assert.match(html,/id="career-rename-error" class="fa-rename-error" role="alert" hidden/);
  assert.equal((html.match(/data-action="rename-cancel"/g)||[]).length,2);
  assert.match(html,locale==='it'?/Rinomina carriera/:/Rename career/);
  assert.match(html,locale==='it'?/Annulla/:/Cancel/);
  assert.match(html,locale==='it'?/>Salva</:/>Save</);
 }
 assert.doesNotMatch(controller,/\bprompt\(/);
 assert.match(controller,/case 'rename':\{/);
 assert.match(controller,/dialog\.showModal\(\)/);
 assert.match(controller,/case 'rename-cancel':closeRenameDialog\(true\)/);
 assert.match(controller,/if\(!name\|\|name\.length>80\)/);
 assert.match(controller,/await renameCareer\(db,id,name\)/);
 assert.match(controller,/if\(loaded\?\.meta\.id===id\)loaded=\{\.\.\.loaded,meta\}/);
 assert.match(controller,/document\.addEventListener\('submit',event=>\{\s*if\(event\.target\.id!=='career-rename-form'\)return/);
 assert.match(controller,/app\.querySelectorAll\('\.fa-site-dialog'\)\.forEach\(dialog=>\{/);
 assert.match(css,/\.fa-site-dialog::backdrop\{background:rgba\(4,14,19,\.77\)\}/);
 assert.match(css,/html\.fa-modal-open\{\s*overflow:hidden;scrollbar-gutter:auto;scrollbar-width:none;/);
 assert.match(css,/\.fa-site-dialog \.text-field\.fa-field-invalid\{/);
});

test('site popup contract: inert background and reserved hidden scrollbar without shifting page',()=>{
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/html\{\s*scrollbar-gutter:stable;\s*\}/);
 assert.match(css,/html\.fa-modal-open\{[\s\S]*?overflow:hidden;scrollbar-gutter:auto;scrollbar-width:none;\s*padding-right:var\(--fa-modal-scrollbar-gutter,0px\);/);
 assert.match(css,/html\.fa-modal-open body\{overflow:hidden\}/);
 assert.match(css,/html\.fa-modal-open::-webkit-scrollbar\{display:none;width:0;height:0\}/);
 assert.match(controller,/function openSiteModal\(dialog,initialFocus\)\{/);
 assert.match(controller,/Math\.max\(0,window\.innerWidth-root\.clientWidth\)/);
 assert.match(controller,/root\.style\.setProperty\('--fa-modal-scrollbar-gutter',gutter\+'\x70x'\)/);
 assert.match(controller,/dialog\.showModal\(\)/);
 assert.match(controller,/root\.classList\.add\('fa-modal-open'\)/);
 assert.match(controller,/function releaseSiteModalLock\(\)\{/);
 assert.match(controller,/root\.style\.removeProperty\('--fa-modal-scrollbar-gutter'\)/);
 assert.match(controller,/app\.querySelectorAll\('\.fa-site-dialog'\)\.forEach\(dialog=>\{/);
 assert.match(controller,/closeRenameDialog\(false\);\s*closeDeleteDialog\(false\);\s*app\.innerHTML=layout\(/);
});

test('rename label cannot select or focus field; highlight appears only while input is focused',async()=>{
 const db=await setup();await createCareer(db,form('Ada','IT',2));
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const locale of ['it','en']){
  const html=careersPage(await readCatalog(db),locale);
  assert.doesNotMatch(html,/Modifica il nome del salvataggio|Change the save name|career-rename-description/);
  assert.doesNotMatch(html,/<label[^>]*for="career-rename-input"/);
  assert.match(html,/<span class="input-label" id="career-rename-field-label">/);
  assert.match(html,/id="career-rename-title" tabindex="-1"/);
  assert.match(html,/id="career-rename-input"[^>]*aria-labelledby="career-rename-field-label"/);
  assert.doesNotMatch(html,/<input[^>]*class="[^"]*fa-control-selected/);
  assert.doesNotMatch(html,/aria-describedby="career-rename-description"/);
 }
 assert.match(controller,/openSiteModal\(dialog,dialog\.querySelector\('#career-rename-title'\)\)/);
 assert.doesNotMatch(controller,/input\.focus\(\);input\.select\(\)/);
 assert.match(controller,/document\.addEventListener\('focusin',event=>\{\s*if\(event\.target\.id!=='career-rename-input'\)return;\s*event\.target\.classList\.add\('fa-control-selected'\)/);
 assert.match(controller,/document\.addEventListener\('focusout',event=>\{\s*if\(event\.target\.id!=='career-rename-input'\)return;\s*event\.target\.classList\.remove\('fa-control-selected'\)/);
 assert.match(css,/\.fa-site-dialog \.text-field\.fa-control-selected:not\(\.fa-field-invalid\)\{/);
 assert.doesNotMatch(css,/\.fa-site-dialog \.text-field:focus-visible\{\s*border-color:var\(--fa-selection-border\)/);
 assert.match(css,/\.fa-site-dialog \.text-field\.fa-field-invalid\{/);
 assert.doesNotMatch(css,/career-rename-description/);
});

test('all destructive confirmations use the same site modal lifecycle, no native browser confirm',async()=>{
 const db=await setup();await createCareer(db,form('Delete QA','IT',2));
 const catalog=await readCatalog(db);
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const locale of ['it','en']){
  const html=careersPage(catalog,locale);
  const dialogs=[...html.matchAll(/<dialog id="career-(rename|delete)-dialog" class="fa-site-dialog /g)];
  assert.equal(dialogs.length,2);
  assert.match(html,/<dialog id="career-delete-dialog" class="fa-site-dialog fa-delete-dialog" aria-labelledby="career-delete-title"/);
  assert.match(html,/<form id="career-delete-form">/);
  assert.equal((html.match(/data-action="delete-cancel"/g)||[]).length,2);
  assert.match(html,locale==='it'?/Eliminare definitivamente questa carriera/:/Permanently delete this career/);
  assert.match(html,locale==='it'?/Elimina carriera/:/Delete career/);
 }
 assert.doesNotMatch(controller,/\bconfirm\(/);
 assert.match(controller,/case 'delete':\{/);
 assert.match(controller,/openSiteModal\(dialog,dialog\.querySelector\('#career-delete-title'\)\)/);
 assert.match(controller,/case 'delete-cancel':closeDeleteDialog\(true\)/);
 assert.match(controller,/document\.addEventListener\('submit',event=>\{\s*if\(event\.target\.id!=='career-delete-form'\)return/);
 assert.match(controller,/await deleteCareer\(db,id\)/);
 assert.match(controller,/closeDeleteDialog\(false\)/);
 assert.match(css,/\.fa-site-dialog\{\s*box-sizing:border-box;/);
 assert.match(css,/\.fa-site-dialog \.fa-site-dialog-description\{/);
 assert.match(css,/\.fa-site-dialog::backdrop\{background:rgba\(4,14,19,\.77\)\}/);
});


test('CAL-01 IndexedDB: hourly progress persists across catalog reload, export and import',async()=>{
 const db=await setup();
 const first=await createCareer(db,form('Clock QA','IT',2));
 assert.equal(first.state.time,'08:00');
 const changed=advanceMinutes(first.state,135);
 assert.equal(changed.time,'10:15');assert.equal(changed.date,first.state.date);
 await saveCareer(db,first.meta.id,changed,{expectedDays:0,expectedTime:'08:00'});
 const reloaded=await selectCareer(db,first.meta.id);
 assert.equal(reloaded.state.time,'10:15');
 const catalog=await readCatalog(db);
 assert.equal(catalog.rows.find(r=>r.id===first.meta.id).state.time,'10:15');
 const exported=await exportCareer(db,first.meta.id);
 const imported=parseCareerImport(JSON.stringify(exported));
 const second=await createCareer(db,{...imported,id:mkId(),now:'2026-10-09T10:00:00Z'});
 assert.equal(second.state.time,'10:15');
 assert.equal(validSession(second.state),true);
 const after=await selectCareer(db,first.meta.id);
 assert.equal(after.state.time,'10:15');
});

test('CAL-01 IndexedDB: stale same-day saves are refused without deleting either slot',async()=>{
 const db=await setup();
 const saved=await createCareer(db,form('Optimistic QA','IT',2));
 const oneHour=advanceMinutes(saved.state,60);
 await saveCareer(db,saved.meta.id,oneHour,{expectedDays:0,expectedTime:'08:00'});
 const staleTwoHours=advanceMinutes(saved.state,120);
 await assert.rejects(()=>saveCareer(db,saved.meta.id,staleTwoHours,{expectedDays:0,expectedTime:'08:00'}));
 await assert.rejects(()=>saveCareer(db,saved.meta.id,saved.state));
 const reloaded=await selectCareer(db,saved.meta.id);
 assert.equal(sessionTime(reloaded.state),'09:00');
 assert.equal(reloaded.state.daysElapsed,0);
});

test('CAL-01 IndexedDB: legacy six-field JSON imports remain readable and acquire the clock only on advance',async()=>{
 const db=await setup();
 const old=createSession('IT',2,'2026-07-01');
 delete old.time;
 assert.equal(validSession(old),true);
 const career=await createCareer(db,{...form('Old clock','IT',2),session:old});
 assert.equal((await selectCareer(db,career.meta.id)).state.time,undefined);
 assert.equal(sessionTime((await selectCareer(db,career.meta.id)).state),'08:00');
 const payload=await exportCareer(db,career.meta.id);
 assert.equal(parseCareerImport(JSON.stringify(payload)).session.time,undefined);
 const advanced=advanceMinutes(old,60);
 await saveCareer(db,career.meta.id,advanced,{expectedDays:0,expectedTime:'08:00'});
 assert.equal((await selectCareer(db,career.meta.id)).state.time,'09:00');
});

test('CAL-02.3: IndexedDB and JSON roundtrip reconstruct the same next match',async()=>{
 const db=await setup(),initial=createSession('BR',9,'2026-07-01');
 const saved=await createCareer(db,{...form('Fixture Import','BR',9,'2026-07-01'),session:initial});
 const expected=nextScheduledClubFixture(initial);
 const forward=advanceSession(initial,30);
 const updated=await saveCareer(db,saved.meta.id,forward,{expectedDays:0,expectedTime:sessionTime(initial)});
 const reopened=await selectCareer(db,saved.meta.id);
 assert.deepEqual(reopened.state,forward);
 assert.equal(nextScheduledClubFixture(reopened.state).id,nextScheduledClubFixture(updated.state).id);
 const exported=await exportCareer(db,saved.meta.id);
 assert.deepEqual(Object.keys(JSON.parse(exported.snapshotRaw)).sort(),Object.keys(forward).sort());
 const parsed=parseCareerImport(JSON.stringify(exported));
 const copied=await createCareer(db,{...parsed,id:mkId(),now:'2026-11-10T10:00:00.000Z'});
 assert.deepEqual(copied.state,forward);
 assert.equal(nextScheduledClubFixture(copied.state).id,nextScheduledClubFixture(forward).id);
 assert.ok(expected&&nextScheduledClubFixture(initial).id===expected.id);
 assert.equal((await readCatalog(db)).rows.length,2);
});

test('CAL-02.3: multiple careers reuse calendars by key, never another club selection',async()=>{
 const db=await setup();
 const first=await createCareer(db,form('First','IT',1,'2026-07-01'));
 const second=await createCareer(db,form('Second','IT',2,'2026-07-01'));
 const cache=createFixtureCalendarCache(4);
 const a=nextScheduledClubFixture((await selectCareer(db,first.meta.id)).state,cache);
 const b=nextScheduledClubFixture((await selectCareer(db,second.meta.id)).state,cache);
 assert.ok(a.homeClubId===1||a.awayClubId===1);
 assert.ok(b.homeClubId===2||b.awayClubId===2);
 assert.equal(nextScheduledClubFixture((await selectCareer(db,first.meta.id)).state,cache).id,a.id);
 assert.deepEqual((await selectCareer(db,second.meta.id)).state,second.state);
});


test('CAL-02.4: calendar renders for an imported v1 save without schema changes',async()=>{
 const db=await setup(),first=await createCareer(db,form('Calendar','IT',4,'2026-10-08'));
 const exported=await exportCareer(db,first.meta.id);
 const parsed=parseCareerImport(JSON.stringify(exported));
 const copy=await createCareer(db,{...parsed,id:mkId(),now:'2026-10-09T10:00:00Z'});
 assert.deepEqual(copy.state,first.state);
 const {scheduleCompetitionFixtures}=await import('../src/fixture-calendar.js');
 const calendar=scheduleCompetitionFixtures('IT-1',2026);
 for(const lang of ['it','en']){
  const html=calendarPage(copy.meta,copy.state,lang,calendar,{month:'2026-10',filter:'club',view:'month'});
  assert.match(html,/fa-fixture-calendar/);
  assert.doesNotMatch(html,/\bscore\b|classifica|risultati/i);
 }
 assert.equal((await readCatalog(db)).rows.length,2);
 assert.deepEqual(Object.keys(copy.state).sort(),Object.keys(first.state).sort());
});

test('CAL-02.4: dedicated route has HTTP 200 for GET/HEAD and never publishes match routes',{timeout:30000},async()=>{
 const port=24854,base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{
  env:{...process.env,PORT:String(port)},stdio:'ignore'
 });
 try{
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
   if(child.exitCode!==null)throw Error('Calendar server exited');
   try{if((await fetch(base+'/',{signal:AbortSignal.timeout(450)})).ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.ok(ready,'Calendar server did not become ready');
  const page=await fetch(base+'/calendar');
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-type')??'',/^text\/html\b/i);
  assert.equal((await fetch(base+'/calendar',{method:'HEAD'})).status,200);
  assert.equal((await fetch(base+'/match/1')).status,404);
 }finally{child.kill();}
});


test('UX-SHELL: dashboard and calendar are the only career sidebar entries in IT/EN',()=>{
 const meta={countryId:'IT',clubId:2,managerName:'Test Manager'};
 const state=createSession('IT',2,'2026-10-08');
 for(const lang of ['it','en']){
  for(const route of ['/dashboard','/calendar','/simulation']){
   const html=layout('<h1>Content</h1>',lang,null,false,{route,meta,state,playing:false});
   assert.match(html,/class="shell fa-career-shell"/);
   assert.equal((html.match(/class="fa-shell-link/g)||[]).length,2);
   assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
   assert.match(html,/data-action="career-dashboard"/);
   assert.match(html,/data-action="fixture-open"/);
   assert.match(html,/class="fa-shell-topbar"/);
   assert.match(html,/class="fa-shell-club"/);
   assert.match(html,/class="fa-shell-time"/);
   assert.match(html,/data-action="language-toggle"/);
   assert.doesNotMatch(html,/data-action="(?:play-match|open-inbox|open-tactics|open-club)"/);
   assert.equal((html.match(/<nav\b/g)||[]).length,1);
   assert.match(html,lang==='it'?/Calendario/:/Calendar/);
  }
 }
});

test('UX-SHELL: route-specific topbar offers one meaningful action, never duplicate dashboard CTA',()=>{
 const meta={countryId:'IT',clubId:1},state=createSession('IT',1,'2026-08-10');
 const render=(route,playing=false)=>layout('Content','it',null,false,{route,meta,state,playing});
 const dashboard=render('/dashboard'),playing=render('/simulation',true),calendar=render('/calendar');
 assert.match(dashboard,/class="fa-shell-primary"[\s\S]*?data-action="toggle"/);
 assert.match(playing,/data-action="toggle"[\s\S]*?Interrompi/);
 assert.match(calendar,/class="fa-shell-primary"[\s\S]*?data-action="toggle"/);
 assert.match(calendar,/aria-current="page"/);
 assert.equal((calendar.match(/data-action="toggle"/g)||[]).length,1);
 assert.doesNotMatch(dashboard,/data-action="(?:play-match|new-season)"/);
 const standalone=layout('<h1>Menu</h1>','it');
 assert.doesNotMatch(standalone,/fa-club-sidebar|fa-shell-sidebar|fa-shell-topbar/);
 assert.match(standalone,/class="top"/);
});

test('UX-SHELL: preserves both new dashboard and legacy simulation routes without changing save format',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(src,/page==='\/simulation'\|\|page==='\/dashboard'/);
 for(const route of ['/dashboard','/simulation','/calendar'])assert.ok(server.includes("'"+route+"'"));
 assert.match(src,/case 'career-dashboard':navigate\('\/dashboard'\)/);
 const current=createSession('IT',1,'2026-07-01');
 assert.equal(validSession(current),true);
 assert.deepEqual(Object.keys(current).sort(),['version','countryId','clubId','startedAt','date','daysElapsed','time'].sort());
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-career-shell\{display:grid;grid-template-columns:210px minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/\.fa-shell-link\{[^}]*border-radius:11px/);
 assert.doesNotMatch(css,/\.fa-shell-sidebar[^}]*display:none/);
});


test('UX-SHELL historic navigation: exact pre-reset category and two outline icons',()=>{
 const meta={countryId:'IT',clubId:2},state=createSession('IT',2,'2026-10-08');
 for(const lang of ['it','en']){
  const html=layout('Content',lang,null,false,{route:'/dashboard',meta,state,playing:false});
  assert.match(html,/class="fa-shell-nav-group" aria-labelledby="fa-shell-start-title"/);
  assert.match(html,lang==='it'?/id="fa-shell-start-title">Inizio<\/h2>/:/id="fa-shell-start-title">Home<\/h2>/);
  assert.match(html,/class="fa-shell-nav-group-items"/);
  assert.match(html,/FOOTBALL <b>ARCHITECT<\/b><small>MANAGER<\/small>/);
  assert.match(html,/data-action="career-dashboard"[^>]+aria-current="page"[^>]*>[\s\S]*?class="fa-icon"[\s\S]*?rect x="3" y="3" width="7"/);
  assert.match(html,/data-action="fixture-open"[^>]*>[\s\S]*?rect width="18" height="18" x="3" y="4"/);
  assert.equal((html.match(/class="fa-shell-link/g)||[]).length,2);
  assert.doesNotMatch(html,/data-action="(?:inbox|tactics|club|training|market|squad)"/);
 }
 const icons=readFileSync(new URL('../src/icons.js',import.meta.url),'utf8');
 assert.match(icons,/'grid-pre-reset':/);
 assert.match(icons,/'calendar-pre-reset':/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-shell-nav-group-title\{[^}]*font-size:8px;[^}]*letter-spacing:\.11em/);
 assert.match(css,/\.fa-shell-link\{[^}]*height:34px;min-height:34px/);
 assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?\.fa-shell-nav-group-title\{height:5px;/);
});


test('SHELL-SEARCH: global results include only real pages and scheduled matches, with IT/EN and Unicode support',()=>{
 const meta={countryId:'IT',clubId:2};
 const calendar=createFixtureCalendarCache(4)('IT-1',2026);
 const pages=searchCareer('calendario','it',meta,calendar,'2026-07-01T08:00');
 assert.equal(pages[0]?.kind,'page');
 assert.equal(pages[0]?.route,'/calendar');
 const en=searchCareer('dashboard','en',meta,calendar,'2026-07-01T08:00');
 assert.equal(en[0]?.route,'/dashboard');
 const club=getLeagueClubs('IT')[1];
 const results=searchCareer(club.name.slice(0,5),'it',meta,calendar,'2026-07-01T08:00');
 assert.ok(results.some(r=>r.kind==='fixture'));
 const match=results.find(r=>r.kind==='fixture');
 assert.match(match.date,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(calendar.matchdays.some(d=>d.fixtures.some(f=>f.date===match.date)));
 assert.deepEqual(searchCareer('','it',meta,calendar),[]);
 assert.deepEqual(searchCareer('nonexistent-search-string-xx','en',meta,calendar),[]);
 assert.ok(searchCareer('a','it',meta,calendar).length<=8);
 assert.deepEqual(searchCareer('  ','it',meta,calendar),[]);
 assert.deepEqual(searchCareer('calendario','it',null,calendar),[]);
 const unsafe=searchCareer('<script>','it',meta,calendar);
 assert.deepEqual(unsafe,[]);
});

test('SHELL-SEARCH: continue/stop is in every active career topbar and search remains scoped to real pages',()=>{
 const meta={countryId:'IT',clubId:1},state=createSession('IT',1,'2026-08-10');
 const render=(route,playing)=>layout('Body','it',null,false,{route,meta,state,playing,searchQuery:'cal',searchResults:searchCareer('cal','it',meta,createFixtureCalendarCache(4)('IT-1',2026))});
 for(const route of ['/dashboard','/simulation','/calendar']){
  for(const playing of [false,true]){
   const html=render(route,playing);
   assert.match(html,/class="fa-shell-primary"[\s\S]*?data-action="toggle"/);
   assert.equal((html.match(/data-action="toggle"/g)||[]).length,1);
   assert.match(html,playing?/Interrompi/:/Continua/);
   assert.match(html,/id="fa-global-search-input"/);
   assert.match(html,/role="combobox"/);
   assert.match(html,/id="fa-global-search-results"/);
   assert.match(html,/data-action="global-search-result"/);
  }
 }
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(src,/CAREER_ROUTES\.has\(path\(\)\)\&\&CAREER_ROUTES\.has\(url\)/);
 assert.match(src,/searchQuery='';searchHits=\[\]/);
 assert.match(src,/case 'global-search-result':/);
 assert.match(src,/view\.view='month';view\.filter='all'/);
 assert.ok(server.includes("'/src/global-search.js'"));
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.fa-shell-search\{position:relative/);
 assert.match(css,/@media\(max-width:1150px\)/);
 assert.match(css,/grid-template-areas:"club time language primary" "search search search search"/);
});


test('SHELL-SEARCH: Continue and Stop topbar buttons have identical fixed dimensions in IT/EN and at mobile widths',()=>{
 const meta={countryId:'IT',clubId:2},state=createSession('IT',2,'2026-08-10');
 for(const lang of ['it','en'])for(const route of ['/dashboard','/calendar','/simulation']){
  const idle=layout('Content',lang,null,false,{route,meta,state,playing:false});
  const active=layout('Content',lang,null,false,{route,meta,state,playing:true});
  for(const html of [idle,active]){
   assert.equal((html.match(/data-action="toggle"/g)||[]).length,1);
   assert.match(html,/class="fa-shell-primary"[\s\S]*?<button[^>]*data-action="toggle"/);
  }
  assert.match(idle,lang==='it'?/>Continua<\/span>/:/>Continue<\/span>/);
  assert.match(active,lang==='it'?/>Interrompi<\/span>/:/>Stop<\/span>/);
 }
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const fixed=css.match(/\.fa-shell-primary \.btn\{([^}]+)\}/)?.[1];
 assert.ok(fixed);
 for(const declaration of ['width:128px','min-width:128px','max-width:128px','height:39px','min-height:39px','justify-content:center'])assert.ok(fixed.includes(declaration));
 assert.match(css,/\.fa-shell-primary \.btn\{width:36px;min-width:36px;max-width:36px;height:36px;min-height:36px/);
 assert.match(css,/\.fa-shell-primary \.btn\{width:33px;min-width:33px;max-width:33px;height:34px;min-height:34px/);
});
