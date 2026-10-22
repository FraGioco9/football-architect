import {readFileSync} from 'node:fs';

const bootstrap=readFileSync(new URL('../assets/sidebar-evolution.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').trim();
// The full navigation is static. Preferences need no deferred network request.
export function renderSidebar(html){
 if(html.includes('data-nav01-static'))return html;
 const start=html.indexOf('<nav class="fa-shell-nav"');if(start<0)return html;
 const end=html.indexOf('</nav>',start)+6;
 let nav=html.slice(start,end).replace('<nav class="fa-shell-nav"','<nav class="fa-shell-nav" data-nav01-static');
 nav=nav.replace('id="app-nav-world-title" data-app-i18n="navWorld">World','id="app-nav-world-title" data-nav01="0">World');
 const icon=paths=>'<svg class="fa-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
 const domesticIcon=icon('<path d="m3 10 9-7 9 7v11H3zM9 21v-7h6v7"/>');
 const internationalIcon=icon('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>');
 nav=nav.replace(/<a\b[^>]*id="app-nav-divisions"[\s\S]*?<\/a>/,link=>{
  link=link.replace(' data-app-aria="navCompetitions"','').replace('data-app-i18n="navCompetitions">Competitions','data-nav01="6">Competitions');
  return '<div class="nav01-row">'+link+'<button type="button" class="nav01-expand" aria-expanded="false" aria-controls="nav01-children" aria-label="Expand world navigation"><svg class="language-chevron" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="nav01-children" id="nav01-children" hidden><a href="/competitions#domestic">'+domesticIcon+'<span data-nav01="1">Domestic</span></a><a href="/competitions#international">'+internationalIcon+'<span data-nav01="2">International</span></a></div>';
 });
 const clubs='<section class="fa-shell-nav-group" aria-labelledby="nav01-world-title"><h2 class="fa-shell-nav-group-title" id="nav01-world-title" data-nav01="3">Explore</h2><div class="fa-shell-nav-group-items"><a class="fa-shell-link" href="/clubs" data-nav01-clubs><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/></svg><span data-nav01="4">Clubs</span></a></div></section>';
 const guide='<a class="fa-shell-link" href="/guide" data-nav01-guide><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M12 6Q7 3 3 5v14q5-2 9 1 4-3 9-1V5q-5-2-9 1Zm0 0v14"/></svg><span data-nav01="5">Guide</span></a>';
 nav=nav.replace('<section class="fa-shell-nav-group fa-shell-nav-secondary">',clubs+'<section class="fa-shell-nav-group fa-shell-nav-secondary">');
 nav=nav.replace(/(<section class="fa-shell-nav-group fa-shell-nav-secondary">\s*<div class="fa-shell-nav-group-items">)/,'$1'+guide);
 let output=html.slice(0,start)+nav+'\n      <script data-nav01-bootstrap>'+bootstrap+'</script>'+html.slice(end);
 output=output.replace('<head>','<head>\n  <script data-nav01-fragment-state>history.scrollRestoration=location.hash?"manual":"auto";if(location.hash)document.documentElement.dataset.nav01Fragment="pending";</script>\n  <style data-nav01-fragment-visibility>html[data-nav01-fragment="pending"] .fa-shell-content-scroll{visibility:hidden}</style>');
 return output.replace('</body>','<script data-nav01-fragment-align>window.faSidebarPaint?.();window.faSidebarAlignFragment?.();delete document.documentElement.dataset.nav01Fragment;</script>\n</body>');
}
