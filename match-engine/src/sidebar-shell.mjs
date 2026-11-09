// ME-01: derive all existing sidebar markup from the canonical generated app.
// Only the DEV-only Development group is added. Public pages and templates are untouched.
const PLACEHOLDER = '<!-- ME-01_CANONICAL_SIDEBAR -->';
const SECONDARY_GROUP = '<section class="fa-shell-nav-group fa-shell-nav-secondary">';
const DEV_GROUP = [
  '<section class="fa-shell-nav-group" aria-labelledby="me-nav-development">',
  '  <h2 class="fa-shell-nav-group-title" id="me-nav-development">Development</h2>',
  '  <div class="fa-shell-nav-group-items">',
  '    <a class="fa-shell-link" href="/dev/match-engine" data-me-dev-link aria-label="Match Engine">',
  '      <svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l2 4v5l3 3v5H3v-5l3-3V7l2-4Z"/><circle cx="12" cy="12" r="3"/></svg>',
  '      <span>Match Engine</span>',
  '    </a>',
  '    <a class="fa-shell-link" href="/dev/kit-maker" data-km-dev-link aria-label="Kit Maker">',
  '      <svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 5 6 2 11l4 2 2-2v9h8v-9l2 2 4-2-3-5-3-2-2 3h-4L8 4Z"/></svg>',
  '      <span>Kit Maker</span>',
  '    </a>',
  '  </div>',
  '</section>'
].join('\n');

const SIDEBAR_START = '<aside class="fa-shell-sidebar"';
const SIDEBAR_END = '</aside>';
const BOOTSTRAP_TAG = /<script data-nav01-bootstrap>[\s\S]*?<\/script>/;
const LAB_BOOTSTRAP = '<script src="/__fa_match_engine__/sidebar-first-paint.js"></script>';
const BOOTSTRAP_SELECTED = "const selected=onClubs?";
const LAB_SELECTED = "const selected=path==='/dev/match-engine'?nav.querySelector('[data-me-dev-link]'):onClubs?";
const KIT_SELECTED = "const selected=path==='/dev/kit-maker'?nav.querySelector('[data-km-dev-link]'):onClubs?";
const KIT_PLACEHOLDER = '<!-- KM-01_CANONICAL_SIDEBAR -->';
const KIT_BOOTSTRAP = '<script src="/__fa_kit_maker__/sidebar-first-paint.js"></script>';

function asideRange(markup) {
  const start = markup.indexOf(SIDEBAR_START);
  if (start < 0) return null;
  const end = markup.indexOf(SIDEBAR_END, start);
  if (end < 0) throw new Error('Unclosed canonical sidebar');
  return {start, end:end + SIDEBAR_END.length};
}

function insertOnlyDevelopment(aside) {
  if (aside.includes('data-me-dev-link')) throw new Error('Duplicate Development entry');
  const start = aside.indexOf('<nav class="fa-shell-nav"');
  const end = aside.indexOf('</nav>', start);
  if (start < 0 || end < 0) throw new Error('Canonical navigation missing');
  const nav = aside.slice(start, end);
  if (nav.split(SECONDARY_GROUP).length !== 2) throw new Error('Canonical secondary group must be unique');
  const newNav = nav.replace(SECONDARY_GROUP, DEV_GROUP + '\n        ' + SECONDARY_GROUP);
  return aside.slice(0, start) + newNav + aside.slice(end);
}

export function sidebarFromAppPage(html) {
  const range = asideRange(html);
  if (!range) throw new Error('Canonical generated sidebar unavailable');
  const aside = html.slice(range.start, range.end);
  if (!aside.includes('data-nav01-static') || !aside.includes('data-nav01-bootstrap') ||
      !aside.includes('id="app-nav-profile"') || !aside.includes('id="nav01-children"'))
    throw new Error('Canonical sidebar structure incomplete');
  return aside;
}

export function addDevelopmentToAppHtml(html) {
  const range = asideRange(html);
  if (!range) return html;
  if (html.slice(range.start, range.end).includes('data-me-dev-link')) return html;
  const aside = html.slice(range.start, range.end);
  return html.slice(0, range.start) + insertOnlyDevelopment(aside) + html.slice(range.end);
}

export function renderMatchEngineLab(html, canonicalAppPage) {
  if (html.split(PLACEHOLDER).length !== 2) throw new Error('Match Engine sidebar placeholder missing');
  let aside = insertOnlyDevelopment(sidebarFromAppPage(canonicalAppPage));
  if (!BOOTSTRAP_TAG.test(aside)) throw new Error('Canonical navigation bootstrap missing');
  aside = aside.replace(BOOTSTRAP_TAG, LAB_BOOTSTRAP);
  // Preserve the same navigation destination as normal local app responses:
  // canonical DEV rewrites its brand/Guide links to the separate site origin.
  aside = aside.replace('class="app-brand" href="/"','class="app-brand" href="http://localhost:2000/"');
  aside = aside.replace('class="fa-shell-link" href="/guide"','class="fa-shell-link" href="http://localhost:2000/guide"');
  // The canonical page marks Dashboard active at first paint. Only the lab is active here.
  aside = aside.replace(/(<a class="fa-shell-link) is-active(" id="app-nav-dashboard")/, '$1$2');
  aside = aside.replace(/(id="app-nav-dashboard"[^>]*?) aria-current="page"/, '$1');
  aside = aside.replace('class="fa-shell-link" href="/dev/match-engine" data-me-dev-link',
    'class="fa-shell-link is-active" href="/dev/match-engine" data-me-dev-link aria-current="page"');
  if (!aside.includes('data-me-dev-link aria-current="page"')) throw new Error('Lab active state missing');
  return html.replace(PLACEHOLDER, aside);
}

export function labFirstPaintBootstrap(canonicalSource) {
  if (canonicalSource.split(BOOTSTRAP_SELECTED).length !== 2)
    throw new Error('Canonical navigation selection contract changed');
  return canonicalSource.replace(BOOTSTRAP_SELECTED, LAB_SELECTED);
}

// KM-01 shares the same canonical sidebar and DEV Development group as ME-01.
// Keep this route exclusive to the local app-host preview: never publish the shell.
export function renderKitMakerLab(html, canonicalAppPage) {
  if (html.split(KIT_PLACEHOLDER).length !== 2) throw new Error('Kit Maker sidebar placeholder missing');
  let aside = insertOnlyDevelopment(sidebarFromAppPage(canonicalAppPage));
  if (!BOOTSTRAP_TAG.test(aside)) throw new Error('Canonical navigation bootstrap missing');
  aside = aside.replace(BOOTSTRAP_TAG, KIT_BOOTSTRAP);
  aside = aside.replace('class="app-brand" href="/"','class="app-brand" href="http://localhost:2000/"');
  aside = aside.replace('class="fa-shell-link" href="/guide"','class="fa-shell-link" href="http://localhost:2000/guide"');
  aside = aside.replace(/(<a class="fa-shell-link) is-active(" id="app-nav-dashboard")/, '$1$2');
  aside = aside.replace(/(id="app-nav-dashboard"[^>]*?) aria-current="page"/, '$1');
  aside = aside.replace('class="fa-shell-link" href="/dev/kit-maker" data-km-dev-link',
    'class="fa-shell-link is-active" href="/dev/kit-maker" data-km-dev-link aria-current="page"');
  if (!aside.includes('data-km-dev-link aria-current="page"')) throw new Error('Kit Maker active state missing');
  return html.replace(KIT_PLACEHOLDER, aside);
}

export function kitFirstPaintBootstrap(canonicalSource) {
  if (canonicalSource.split(BOOTSTRAP_SELECTED).length !== 2)
    throw new Error('Canonical navigation selection contract changed');
  return canonicalSource.replace(BOOTSTRAP_SELECTED, KIT_SELECTED);
}
