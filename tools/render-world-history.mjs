/** #581: semantic, dimensionally stable World History first paint. */
export function renderWorldHistoryPage(){
 return [
  '        <section id="world-history" class="app-view fa-world-history" aria-labelledby="world-history-title">',
  '          <h1 class="app-page-title" id="world-history-title">World History</h1>',
  '          <p class="fa-world-history-intro" id="world-history-intro">Verified champions of completed seasons across all competitions.</p>',
  '          <div class="fa-world-history-controls" role="group" aria-label="Archive filters">',
  '            <div class="fa-world-history-control"><label for="world-history-season">Season</label><select id="world-history-season" aria-controls="world-history-archive" disabled><option value="">All seasons</option></select></div>',
  '            <div class="fa-world-history-control"><label for="world-history-country">Champion country</label><select id="world-history-country" aria-controls="world-history-archive" disabled><option value="">All countries</option></select></div>',
  '            <div class="fa-world-history-control"><label for="world-history-competition">Competition</label><select id="world-history-competition" aria-controls="world-history-archive" disabled><option value="">All competitions</option></select></div>',
  '          </div>',
  '          <p class="fa-world-history-count" id="world-history-count" aria-live="polite"></p>',
  '          <p id="world-history-status" class="app-competition-status fa-world-history-status" role="status" aria-live="polite">Loading verified archive…</p>',
  '          <div id="world-history-archive" class="fa-world-history-archive" aria-busy="true">',
  '            <div class="fa-world-history-skeleton" aria-hidden="true">',
  '              <div class="fa-world-history-skeleton-row"><span></span><span></span></div>',
  '              <div class="fa-world-history-skeleton-row"><span></span><span></span></div>',
  '              <div class="fa-world-history-skeleton-row"><span></span><span></span></div>',
  '            </div>',
  '          </div>',
  '          <button class="app-link app-link-secondary fa-world-history-retry" id="world-history-retry" type="button" hidden>Retry</button>',
  '        </section>'
 ].join('\n');
}
