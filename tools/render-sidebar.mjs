import {readFileSync} from 'node:fs';

const bootstrap=readFileSync(new URL('../assets/sidebar-evolution.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').trim();
// The full navigation is static. Preferences need no deferred network request.
export function renderSidebar(html){
 if(html.includes('data-nav01-static'))return html;
 const start=html.indexOf('<nav class="fa-shell-nav"');if(start<0)return html;
 const end=html.indexOf('</nav>',start)+6;
 let nav=html.slice(start,end).replace('<nav class="fa-shell-nav"','<nav class="fa-shell-nav" data-nav01-static');
 nav=nav.replace('id="app-nav-world-title" data-app-i18n="navWorld">World','id="app-nav-world-title" data-nav01="0">Competitions');
 nav=nav.replace(/<a\b[^>]*id="app-nav-divisions"[\s\S]*?<\/a>/,link=>'<div class="nav01-row">'+link+'<button type="button" class="nav01-expand" aria-expanded="false" aria-controls="nav01-children" aria-label="Expand competitions"></button></div><div class="nav01-children" id="nav01-children" hidden><a href="/competitions#domestic" data-nav01="1">Domestic</a><a href="/competitions#international" data-nav01="2">International</a></div>');
 const clubs='<section class="fa-shell-nav-group" aria-labelledby="nav01-world-title"><h2 class="fa-shell-nav-group-title" id="nav01-world-title" data-nav01="3">Football World</h2><div class="fa-shell-nav-group-items"><a class="fa-shell-link" href="/clubs" data-nav01-clubs><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/></svg><span data-nav01="4">Clubs</span></a></div></section>';
 const guide='<a class="fa-shell-link" href="/guide" data-nav01-guide><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M12 6Q7 3 3 5v14q5-2 9 1 4-3 9-1V5q-5-2-9 1Zm0 0v14"/></svg><span data-nav01="5">Guide</span></a>';
 nav=nav.replace('<section class="fa-shell-nav-group fa-shell-nav-secondary">',clubs+'<section class="fa-shell-nav-group fa-shell-nav-secondary">');
 nav=nav.replace(/(<section class="fa-shell-nav-group fa-shell-nav-secondary">\s*<div class="fa-shell-nav-group-items">)/,'$1'+guide);
 return html.slice(0,start)+nav+'\n      <script data-nav01-bootstrap>'+bootstrap+'</script>'+html.slice(end);
}
