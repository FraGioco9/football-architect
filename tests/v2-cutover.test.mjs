import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const at=path=>new URL(path,root);
const read=path=>readFileSync(at(path),'utf8');
const removed=[
 'backend/src/admin-calendar-advance-plan.ts',
 'backend/src/admin-calendar-clock.ts',
 'backend/src/admin-calendar-publish.ts',
 'backend/src/calendar-command.ts',
 'backend/src/lifecycle-command.ts',
 'backend/src/public-match-read.ts',
 'backend/src/public-sporting-read.ts',
 'backend/src/season-archive-command.ts',
 'backend/src/season-close-command.ts',
 'backend/src/sporting-day-payload.ts',
 'backend/src/temporary-simulation.ts'
];

test('#613 single V2 cutover has no retired score-only backend entrypoints',()=>{
 for(const file of removed)assert.equal(existsSync(at(file)),false,file);
 const router=read('backend/src/index.ts');
 const admin=read('backend/src/http-admin.ts');
 const candidate=read('backend/src/season-two-candidate-read.ts');
 for(const name of [
  'readPublicSportingSeasonLineupV1','readPublicMatchLineupV1',
  'readPublishedCompetitionMatchesLineupV1','readPublicClubHistoryLineupV1'
 ])assert.match(router,new RegExp(name),name);
 for(const name of [
  'executeLineupLifecycleV1','advanceAdministrativeClockLineupV1',
  'publishInternationalCalendarLineupV1','archiveSeasonLineupV1',
  'closeSeasonLineupV1'
 ])assert.match(admin,new RegExp(name),name);
 assert.match(candidate,/verifyLineupSeasonArchiveV1/);
 assert.doesNotMatch(candidate,/processSportingDay\(|sportingDayPayload/);
 assert.doesNotMatch(admin,/generateSeasonCalendar\(/);
});

test('#613 no backend source imports any retired score-only module',()=>{
 const src=new URL('backend/src/',root);
 const dirs=[src];
 while(dirs.length){
  const dir=dirs.pop();
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const full=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
   if(entry.isDirectory()){dirs.push(full);continue}
   if(!/\.(?:ts|mjs)$/.test(entry.name))continue;
   const text=readFileSync(full,'utf8');
   for(const old of removed){
    const name=old.split('/').at(-1);
    assert.doesNotMatch(text,new RegExp("from\\s*['\\\"]\\./"+name.replaceAll('.','\\.')+"['\\\"]"),full.pathname);
   }
   // Published scoring must never mutate or consume the retired day table.
   if(!full.pathname.endsWith('reset-world-command.ts'))
    assert.doesNotMatch(text,/['"\x60][^'"\x60]*season_day_outcomes[^'"\x60]*['"\x60]/,full.pathname);
  }
 }
});

test('#613 client validators accept only frozen V2 sporting provenance',()=>{
 for(const path of [
  'assets/authoritative-season.mjs',
  'assets/authoritative-calendar.mjs',
  'assets/club-history-source.mjs',
  'assets/club-fixtures-source.mjs'
 ]){
  const source=read(path);
  assert.match(source,/temporary-lineup-v1/,path);
  assert.doesNotMatch(source,/temporary-score-v1/,path);
 }
});

test('#613 Admin UI has no hidden legacy start/calendar command',()=>{
 const controller=read('assets/admin-settings.js'),html=read('admin/calendar/index.html');
 assert.doesNotMatch(controller,/\/api\/admin\/seasons\/start|\/api\/admin\/seasons\/calendar/);
 assert.doesNotMatch(html,/data-admin-command="start"/);
 assert.match(controller,/\/api\/admin\/seasons\/events\/start/);
 assert.match(controller,/\/api\/admin\/seasons\/advance/);
});
