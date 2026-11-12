import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {bootstrapCompetitionTabs} from '../tools/competition-tab-preboot.mjs';

const views = ['standings', 'postseason', 'fixtures', 'stats', 'history', 'rules', 'awards'];
function simulate(start = '/competitions/it-1/fixtures?season=2&matchday=12') {
  const handlers = {document: {}, window: {}};
  const historyStack = [new URL(start, 'https://fa.test')];
  let position = 0;
  const location = {};
  function sync() {
    for (const key of ['href', 'pathname', 'search', 'hash']) location[key] = historyStack[position][key];
  }
  sync();
  const tabs = views.map((view, index) => ({
    id: 'competition-tab-' + view, attrs: {}, tabIndex: -1,
    classList: {toggle(name, enabled) {this[name] = enabled}},
    setAttribute(k, v) {this.attrs[k] = v},
    focus() {this.focused = true},
    closest() {return this},
    getBoundingClientRect() {return {left: index * 104 - bar.scrollLeft, right: index * 104 + 100 - bar.scrollLeft}}
  }));
  const panels = views.map(view => ({id: 'competition-panel-' + view, hidden: view !== 'standings'}));
  const bar = {
    dataset: {}, scrollLeft: 0, clientWidth: 240, scrollWidth: 730,
    contains(tab) {return tabs.includes(tab)},
    querySelectorAll() {return tabs},
    getBoundingClientRect() {return {left: 0, right: 240}}
  };
  const document = {
    documentElement: {dataset: {competitionView: 'fixtures'}},
    querySelector(selector) {return selector === '#app-divisions > .app-competition-tabs' ? bar : null},
    querySelectorAll(selector) {return selector === '#app-divisions > .app-competition-panel' ? panels : []},
    addEventListener(type, fn) {handlers.document[type] = fn},
    removeEventListener(type, fn) {if (handlers.document[type] === fn) delete handlers.document[type]}
  };
  const window = {
    addEventListener(type, fn) {handlers.window[type] = fn},
    removeEventListener(type, fn) {if (handlers.window[type] === fn) delete handlers.window[type]}
  };
  const history = {
    pushState(_data, _title, url) {
      historyStack.splice(position + 1); historyStack.push(new URL(url, location.href)); position++; sync();
    }
  };
  const saves = [];
  const sessionStorage = {setItem(k, v) {saves.push([k, v])}};
  runInNewContext('(' + bootstrapCompetitionTabs.toString() + ')()', {window, document, location, history, URL, sessionStorage});
  const click = view => handlers.document.click({target: tabs[views.indexOf(view)]});
  const key = (view, name) => {
    let prevented = false;
    handlers.document.keydown({target: tabs[views.indexOf(view)], key: name, preventDefault() {prevented = true}});
    return prevented;
  };
  return {tabs, panels, bar, window, document, location, historyStack, handlers, saves, click, key,
    back() {position--; sync(); handlers.window.popstate()}};
}
test('COMPETITIONS #516: parser-time tabs respond before the manifest and any page JS', () => {
  const s = simulate();
  assert.ok(s.handlers.document.click);
  s.click('history');
  assert.equal(s.location.pathname, '/competitions/it-1/history');
  assert.equal(s.location.search, '?season=2');
  assert.equal(s.document.documentElement.dataset.competitionView, 'history');
  assert.deepEqual(s.panels.filter(p => !p.hidden).map(p => p.id), ['competition-panel-history']);
  assert.equal(s.tabs[4].attrs['aria-selected'], 'true');
  assert.equal(s.tabs[4].tabIndex, 0);
  s.click('stats'); s.click('awards');
  assert.equal(s.location.pathname, '/competitions/it-1/awards');
  s.back();
  assert.equal(s.location.pathname, '/competitions/it-1/stats');
  assert.equal(s.document.documentElement.dataset.competitionView, 'stats');
});
test('COMPETITIONS #516: keyboard, saved matchday and handoff are coherent', () => {
  const s = simulate('/competitions/int-1/fixtures?season=1&matchday=quarterfinals&calendarReturn=%2Fcalendar%3Fseason%3D1');
  assert.equal(s.key('fixtures', 'ArrowRight'), true);
  assert.equal(s.location.pathname, '/competitions/int-1/stats');
  assert.equal(s.tabs[3].focused, true);
  assert.equal(s.key('stats', 'End'), true);
  assert.equal(s.location.pathname, '/competitions/int-1/awards');
  s.click('fixtures');
  assert.equal(s.location.search, '?calendarReturn=%2Fcalendar%3Fseason%3D1&season=1&matchday=quarterfinals');
  s.click('rules');
  const snapshot = s.window.faCompetitionPrebootTabs.snapshot();
  assert.equal(snapshot.fixtureRound, 'quarterfinals');
  assert.equal(snapshot.calendarReturn, '/calendar?season=1');
  s.window.faCompetitionPrebootTabs.dispose();
  assert.equal(s.window.faCompetitionPrebootTabs, undefined);
  assert.equal(s.handlers.document.click, undefined);
  assert.equal(s.handlers.window.popstate, undefined);
});
test('COMPETITIONS #516: no fabricated season or default round before verified state', () => {
  const s = simulate('/competitions/it-1/history');
  s.click('fixtures');
  assert.equal(s.location.pathname, '/competitions/it-1/fixtures');
  assert.equal(s.location.search, '');
});
const competitionIds = ['it','eng','es','de','fr','pt','nl','br'].flatMap(c => [c + '-1', c + '-2']).concat('int-1', 'int-2');
const root = new URL('../', import.meta.url);
test('COMPETITIONS #516: all 18 generated pages install preboot before deferred scripts', () => {
  for (const id of competitionIds) {
    const html = readFileSync(new URL('competitions/' + id + '/index.html', root), 'utf8');
    const early = html.indexOf('data-fa-competition-preboot');
    assert.ok(early > 0, id + ': parser-time preboot');
    assert.ok(early < html.indexOf('src="/assets/competition-model.js"'), id + ': before deferred dependencies');
    assert.ok(early < html.indexOf('class="app-competition-tabs"'), id + ': document event delegation bound in head');
    assert.equal((html.match(/data-fa-competition-preboot/g)||[]).length, 1, id + ': one preboot');
  }
});
