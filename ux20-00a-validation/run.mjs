import assert from 'node:assert/strict';
import {renderHomeMenu} from '../src/home-menu.js';

const active={
  id:'slot-00000001',
  name:'Carriera Bologna',
  manager:'Francesco',
  clubId:7,
  clubName:'Bologna Città',
  countryId:'IT',
  season:3,
  round:9,
  lastSavedAt:'2026-10-06T18:42:00.000Z',
  createdAt:'2026-07-01T08:00:00.000Z',
  saveSchemaVersion:7,
  storageKey:'football-architect:career:slot-00000001',
  status:'ok'
};
const overview={
  activeSlotId:active.id,
  slots:[
    active,
    {...active,id:'slot-00000002',name:'Seconda carriera',clubName:'Torino Borgo',lastSavedAt:'2026-09-30T11:00:00.000Z'},
    {...active,id:'slot-00000003',name:'Terza carriera',clubName:'Genova Porto',lastSavedAt:'2026-09-20T11:00:00.000Z'}
  ]
};
const world={clubId:7,currentDate:'2028-09-16'};
const ui={language:'it',page:'home',careers:overview};
const html=renderHomeMenu(world,ui,{languagePicker:'<div data-language-test></div>'});

const mainActions=[...html.matchAll(/data-action="(menu-[^"]+)"/g)].map(match=>match[1])
  .filter(action=>!['menu-home','menu-open-settings'].includes(action));
assert.deepEqual(mainActions,['menu-continue','menu-new','menu-manage','menu-settings'],
  '00A must expose exactly Continue, New career, Careers and Settings');

assert.equal((html.match(/fa-menu-primary/g)||[]).length,1,'00A must have one primary action');
assert.match(html,/data-action="menu-continue"[^>]*fa-menu-primary/,'Continue must be primary when a career is valid');
assert.doesNotMatch(html,/data-action="menu-load"/,'Load career must move into Careers');
assert.doesNotMatch(html,/data-action="menu-import"/,'Import JSON must move into Careers');
assert.doesNotMatch(html,/home-import-file/,'Home must not own the import file input');
assert.doesNotMatch(html,/fa-menu-recent/,'Home must not render recent-save list');
assert.doesNotMatch(html,/SALVATAGGI LOCALI|LOCAL SAVES/,'Home must not render the old technical saves overview');
assert.doesNotMatch(html,/IndexedDB/,'Home must not display storage implementation details');

assert.match(html,/Francesco/,'active career summary must show manager');
assert.match(html,/Bologna Città/,'active career summary must show club');
assert.match(html,/Stagione<\/dt><dd>3<\/dd>/,'active career summary must show season');
assert.match(html,/16 set 2028/i,'active career summary must show in-game date');
assert.match(html,/06\/10\/2026|6 ott 2026|06 ott 2026/i,'active career summary must show last save');

const emptyHtml=renderHomeMenu({clubId:null,currentDate:'2026-07-01'},{language:'en',page:'home',careers:{activeSlotId:null,slots:[]}},{languagePicker:''});
const emptyActions=[...emptyHtml.matchAll(/data-action="(menu-[^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(emptyActions,['menu-continue','menu-new','menu-manage','menu-settings'],
  'empty Home must keep the same four-entry information architecture');
assert.match(emptyHtml,/data-action="menu-continue"[^>]*disabled/,'Continue must remain visible but disabled without an active career');
assert.doesNotMatch(emptyHtml,/fa-menu-active-summary/,'active career card must be absent without a valid career');

console.log('UX20 00A HOME CONTRACT PASS');
