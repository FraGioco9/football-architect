import {readFileSync} from 'node:fs';

const bootstrap=readFileSync(new URL('../assets/sidebar-first-paint.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').trim();
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
 // Same 15px optical size as the former CSS mask, now no external image request.
 const playersIcon='<svg class="fa-icon" width="18" height="18" viewBox="-51.2 -51.2 614.4 614.4" aria-hidden="true" fill="currentColor"><path fill-rule="evenodd" d="M15,416 14,435 13,436 13,497 17,506 25,511 486,511 494,506 498,497 498,436 497,435 496,416 489,389 475,360 461,341 444,324 431,314 406,300 387,293 369,289 350,288 349,287 162,287 161,288 142,289 115,296 93,306 80,314 67,324 50,341 36,360 26,379 20,395Z M45,425 48,410 53,395 64,374 73,362 93,343 105,335 126,325 145,320 161,319 162,318 349,318 350,319 360,319 385,325 411,338 423,347 437,361 447,374 458,395 465,419 466,435 467,436 467,479 466,480 45,480 44,479Z M245,0 244,1 236,1 222,4 198,13 189,18 171,31 153,50 142,67 135,82 131,94 127,115 127,143 132,167 136,178 144,194 155,210 174,229 188,239 208,249 233,256 261,258 262,257 272,257 273,256 283,255 310,246 332,233 350,217 364,199 377,173 384,143 384,115 380,94 376,82 369,67 353,44 340,31 315,14 289,4 275,1 267,1 266,0Z M246,31 264,31 265,32 272,32 281,34 303,43 320,55 329,64 340,79 348,96 353,117 353,141 350,155 342,175 332,190 317,205 304,214 283,223 269,226 261,226 260,227 241,226 219,220 205,213 194,205 179,190 170,177 164,164 158,141 158,117 161,102 171,79 178,69 190,56 208,43 230,34Z"/></svg>';
 const clubs='<section class="fa-shell-nav-group" aria-labelledby="nav01-world-title"><h2 class="fa-shell-nav-group-title" id="nav01-world-title" data-nav01="3">Explore</h2><div class="fa-shell-nav-group-items"><a class="fa-shell-link" href="/players" data-nav01-players>'+playersIcon+'<span data-nav01="7">Players</span></a><a class="fa-shell-link" href="/clubs" data-nav01-clubs><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z"/></svg><span data-nav01="4">Clubs</span></a></div></section>';
 const guide='<a class="fa-shell-link" href="/guide" data-nav01-guide><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M12 6Q7 3 3 5v14q5-2 9 1 4-3 9-1V5q-5-2-9 1Zm0 0v14"/></svg><span data-nav01="5">Guide</span></a>';
 nav=nav.replace('<section class="fa-shell-nav-group fa-shell-nav-secondary">',clubs+'<section class="fa-shell-nav-group fa-shell-nav-secondary">');
 nav=nav.replace(/(<section class="fa-shell-nav-group fa-shell-nav-secondary">\s*<div class="fa-shell-nav-group-items">)/,'$1'+guide);
 const profile='<a class="fa-shell-link" id="app-nav-profile" href="/account" data-app-profile><svg class="fa-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg><span data-nav01-profile>Profile</span></a>';
 nav=nav.replace(/(<a\b[^>]*id="app-nav-settings"[\s\S]*?<\/a>)/,'$1\n            '+profile);
 let output=html.slice(0,start)+nav+'\n      <script data-nav01-bootstrap>'+bootstrap+'</script>'+html.slice(end);
 output=output.replace('<head>','<head>\n  <script data-nav01-fragment-state>history.scrollRestoration=location.hash?"manual":"auto";if(location.hash)document.documentElement.dataset.nav01Fragment="pending";</script>\n  <style data-nav01-fragment-visibility>html[data-nav01-fragment="pending"] .fa-shell-content-scroll{visibility:hidden}</style>');
 output=output.replace('</head>','  <script src="/assets/profile-navigation.js" defer></script>\n</head>');
 return output.replace('</body>','<script data-nav01-fragment-align>window.faSidebarPaint?.();window.faSidebarAlignFragment?.();delete document.documentElement.dataset.nav01Fragment;</script>\n</body>');
}
