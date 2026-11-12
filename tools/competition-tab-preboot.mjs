// Parser-time Competition tab navigation: no manifest, world or external JS required.
// The full competition router takes over once its scripts are ready.
export function bootstrapCompetitionTabs() {
  const views = ['standings', 'postseason', 'fixtures', 'stats', 'history', 'rules', 'awards'];
  const route = /^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12]|int-[12])(?:\/(?:standings|postseason|fixtures|stats|history|rules|awards|index\.html))?\/?$/;
  const initial = route.exec(location.pathname);
  if (!initial || window.faCompetitionPrebootTabs) return;
  const base = '/competitions/' + initial[1];
  const initialUrl = new URL(location.href);
  let fixtureRound = initialUrl.searchParams.get('matchday');
  let calendarReturn = initialUrl.searchParams.get('calendarReturn');

  function currentView() {
    const last = location.pathname.replace(/\/+$/, '').split('/').at(-1);
    const requested = new URL(location.href).searchParams.get('view');
    return views.includes(last) ? last : views.includes(requested) ? requested : 'standings';
  }
  function rememberFixtureContext() {
    const url = new URL(location.href);
    if (url.pathname.replace(/\/+$/, '').endsWith('/fixtures')) {
      fixtureRound = url.searchParams.get('matchday') || fixtureRound;
      calendarReturn = url.searchParams.get('calendarReturn') || calendarReturn;
    }
  }
  function paint(view, focus = false, reveal = false) {
    document.documentElement.dataset.competitionView = view;
    const bar = document.querySelector('#app-divisions > .app-competition-tabs');
    if (!bar) return;
    let activeTab = null;
    for (const tab of bar.querySelectorAll('[role="tab"]')) {
      const active = tab.id === 'competition-tab-' + view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('is-active', active);
      if (active) activeTab = tab;
    }
    for (const panel of document.querySelectorAll('#app-divisions > .app-competition-panel')) {
      panel.hidden = panel.id !== 'competition-panel-' + view;
    }
    if (focus) activeTab?.focus({ preventScroll: true });
    if (reveal && activeTab) {
      const bounds = bar.getBoundingClientRect();
      const rect = activeTab.getBoundingClientRect();
      if (rect.left < bounds.left + 16) bar.scrollLeft += rect.left - bounds.left - 16;
      else if (rect.right > bounds.right - 16) bar.scrollLeft += rect.right - bounds.right + 16;
      try { sessionStorage.setItem('football-architect:competition-tabs-scroll:' + base, String(bar.scrollLeft)); } catch {}
    }
    const maximum = Math.max(0, bar.scrollWidth - bar.clientWidth);
    bar.dataset.canScrollLeft = String(maximum > 1 && bar.scrollLeft > 1);
    bar.dataset.canScrollRight = String(maximum > 1 && bar.scrollLeft < maximum - 1);
  }
  function select(view, focus = false) {
    if (!views.includes(view)) return;
    rememberFixtureContext();
    const before = new URL(location.href);
    const after = new URL(location.href);
    after.pathname = base + '/' + view;
    after.search = '';
    after.hash = '';
    if (view === 'fixtures' && calendarReturn) after.searchParams.set('calendarReturn', calendarReturn);
    if (before.searchParams.has('season')) after.searchParams.set('season', before.searchParams.get('season'));
    if (view === 'fixtures' && fixtureRound) after.searchParams.set('matchday', fixtureRound);
    if (after.href !== before.href) history.pushState(null, '', after.pathname + after.search);
    paint(view, focus, true);
  }
  function findTab(target) {
    const tab = target?.closest?.('[role="tab"]');
    const bar = document.querySelector('#app-divisions > .app-competition-tabs');
    return tab && bar?.contains(tab) && views.includes(tab.id?.replace(/^competition-tab-/, '')) ? tab : null;
  }
  function click(event) {
    if (window.faCompetitionRoute) return;
    const tab = findTab(event.target);
    if (tab) select(tab.id.slice('competition-tab-'.length));
  }
  function keydown(event) {
    if (window.faCompetitionRoute) return;
    const tab = findTab(event.target);
    if (!tab) return;
    const index = views.indexOf(tab.id.slice('competition-tab-'.length));
    const next = event.key === 'ArrowRight' ? (index + 1) % views.length
      : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : -1;
    if (next < 0) return; // Native button click handles Enter and Space.
    event.preventDefault();
    select(views[next], true);
  }
  function popstate() {
    if (window.faCompetitionRoute) return;
    rememberFixtureContext();
    paint(currentView(), false, true);
  }
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', keydown, true);
  window.addEventListener('popstate', popstate);
  window.faCompetitionPrebootTabs = {
    snapshot: () => ({ fixtureRound, calendarReturn }),
    dispose() {
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('popstate', popstate);
      delete window.faCompetitionPrebootTabs;
    }
  };
}
