import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUES,getLeagueClubs} from '../src/leagues.js';
import {createSession,advanceSession,SAVE_KEY} from '../src/simulation.js';
import {CAREER_DB,EXPORT_FORMAT,openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport} from '../src/career-store.js';
import {layout,homePage,managerPage,teamsPage,careersPage,settingsPage,simulationPage} from '../src/ui-pages.js';
import {languagePicker} from '../src/language-picker.js';
import {icon} from '../src/icons.js';

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
 managerName,countryId,clubId,session:createSession(countryId,clubId,date),id:mkId(),now:'2026-10-08T10:00:00.000Z'
});
test('IndexedDB schema has three isolated stores',async()=>{
 const db=await setup();assert.ok(db.objectStoreNames.contains('careers'));
 assert.ok(db.objectStoreNames.contains('snapshots'));assert.ok(db.objectStoreNames.contains('preferences'));
 assert.equal((await readCatalog(db)).rows.length,0);
});
test('manager/team setup creates no save until explicit createCareer',async()=>{
 const db=await setup(),draft={managerName:'Ada Manager',countryId:'IT',clubId:2,query:''};
 assert.match(managerPage(draft,'it'),/NOME ALLENATORE/);
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
 assert.match(managerPage(draft,'en'),/MANAGER NAME/);
 assert.match(teamsPage(draft,'en'),/Choose your club/);
 assert.match(settingsPage('en'),/Language/);
 assert.match(careersPage(empty,'en'),/Import/);
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 for(const route of ['/new-career','/new-career/team','/careers','/settings','/simulation'])assert.ok(server.includes("'"+route+"'"));
});
test('simulation maintains match-free semantics, responsive UI and keyboard focus',()=>{
 const state=createSession('PT',4,'2026-10-08'),meta={managerName:'M',countryId:'PT',clubId:4};
 const markup=simulationPage(meta,state,'it',false);
 assert.match(markup,/Avanza nel tempo/);
 assert.match(markup,/Non viene giocata alcuna partita/);
 assert.doesNotMatch(markup,/\bfixture\b|\bscore\b|risultati|classifica/i);
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



test('the historic one-page onboarding contains country, club, and manager before any save',async()=>{
 const db=await setup(),draft={managerName:'Ada Coach',countryId:'IT',clubId:2,query:''};
 const markup=managerPage(draft,'it'),compat=teamsPage(draft,'it');
 assert.match(markup,/class="onboarding restored-onboarding"/);
 assert.match(markup,/class="onboard-header"/);
 assert.match(markup,/Costruisci la tua carriera/);
 assert.match(markup,/class="league-pick"/);
 assert.match(markup,/class="league-pick-options"/);
 assert.equal((markup.match(/data-action="country"/g)||[]).length,8);
 assert.equal((markup.match(/class="club-table-select"/g)||[]).length,20);
 assert.match(markup,/<table class="club-table"/);
 assert.match(markup,/<thead>/);
 assert.match(markup,/<tbody>/);
 assert.equal((markup.match(/class="club-table-row /g)||[]).length,20);
 assert.equal((markup.match(/class="club-table-select"/g)||[]).length,20);
 assert.match(markup,/class="onboard-aside"/);
 assert.match(markup,/class="selected-stats"/);
 assert.match(markup,/id="manager-form"/);
 assert.match(markup,/id="manager-name"/);
 assert.match(markup,/Inizia carriera/);
 assert.match(markup,/data-action="cancel-setup"/);
 assert.equal((markup.match(/<h1\b/g)||[]).length,1);
 assert.equal(compat,markup);
 assert.equal((await readCatalog(db)).rows.length,0);
});
test('historic career library uses its card grid and old-style actions with minimal saves',async()=>{
 const db=await setup();await createCareer(db,form('Ada','IT',2));
 const html=careersPage(await readCatalog(db),'it');
 assert.match(html,/class="restored-careers"/);
 assert.match(html,/class="career-grid"/);
 assert.match(html,/class="career-card/);
 assert.match(html,/class="career-meta"/);
 assert.match(html,/class="career-actions"/);
 assert.match(html,/class="career-more"/);
 assert.match(html,/Le tue carriere/);
 assert.match(html,/data-action="load"/);
 assert.match(html,/data-action="rename"/);
 assert.match(html,/data-action="export"/);
 assert.match(html,/data-action="delete"/);
 assert.doesNotMatch(html,/Recupera simulazione precedente|Checkpoint|Duplicazione/);
 assert.match(careersPage({rows:[],activeId:null},'en'),/No saved careers/);
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
test('restored original CSS and single-page UI are responsive while match engine remains removed',()=>{
 const sheet=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const name of ['onboard-wrap','onboard-grid','club-table','career-grid','career-card','settings-grid','settings-action'])
  assert.ok(sheet.includes('.'+name),name);
 assert.match(sheet,/@media\(max-width:760px\)/);
 assert.match(sheet,/@media\(max-width:430px\)/);
 assert.match(controller,/draft\.managerName=name;void begin\(\)\.catch\(fail\)/);
 assert.match(controller,/case 'country':draft\.countryId=element\.dataset\.country;draft\.clubId=1/);
 assert.doesNotMatch(controller,/navigate\('\/new-career\/team'\)/);
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
 assert.match(ui,/class="career-grid"/);
 // The shared selectors target every descendant, without requiring classes
 // or making new containers scrollable.
 assert.doesNotMatch(css.slice(css.lastIndexOf('/* QOL05.08')),/\boverflow-[xy]\s*:/);
});

test('new career club table keeps every club on the document without an internal scrollbar',()=>{
 const draft={managerName:'QA',countryId:'IT',clubId:1,query:''};
 const html=managerPage(draft,'it');
 assert.match(html,/<table class="club-table" id="clubs"/);
 assert.match(html,/<thead>[\s\S]*?<th scope="col">Squadra<\/th>/);
 assert.match(html,/<tbody>/);
 assert.equal((html.match(/<tr class="club-table-row /g)||[]).length,20);
 assert.equal((html.match(/<button type="button" class="club-table-select"/g)||[]).length,20);
 assert.equal((html.match(/aria-pressed="true" aria-label="Seleziona /g)||[]).length,1);
 assert.match(html,/data-id="1" aria-pressed="true"/);
 const en=managerPage({managerName:'QA',countryId:'ENG',clubId:3,query:''},'en');
 assert.match(en,/<th scope="col">Club<\/th>/);
 assert.equal((en.match(/<tr class="club-table-row /g)||[]).length,20);
 assert.match(en,/aria-label="Select /);
});
test('club table hover is contained and the document provides the only scrollbar',()=>{
 const style=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 const tableRules=style.slice(style.lastIndexOf('/* New Career: all 20 clubs'));
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
