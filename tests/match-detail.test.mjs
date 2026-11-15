import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
import {scoreboardThemes,resolveScoreboardTheme,resolveFirstPaintMatchTheme,contrastRatio} from '../assets/match-scoreboard-themes.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('competitions/_shared/manifest.json')).competitions;

test('#577 match URLs use only positive numeric public identities',()=>{
 assert.equal(buildRoute({kind:'match',id:1}),'/matches/1');
 assert.equal(parseRoute('/matches/42')?.kind,'match');
 assert.equal(parseRoute('/matches/42/')?.canonical,'/matches/42');
 for(const p of ['/matches/0','/matches/01','/matches/-1','/matches/1.5','/matches/%34','/matches/42/other','/matches/9007199254740992'])
  assert.equal(parseRoute(p),null,p);
 assert.equal(publicRequestFile('/matches/42'),'matches/_shared/index.html');
 assert.equal(publicRequestFile('/matches/42/'),'matches/_shared/index.html');
});
test('#577 scoreboard is the first independently reusable match section',()=>{
 for(const path of ['matches/_shared/index.html','assets/match-detail.js','assets/match-detail.css','assets/match-scoreboard-themes.mjs'])
  assert.equal(isAllowlistedPublicPath(path),true,path);
 assert.ok(planPublicFiles().includes('matches/_shared/index.html'));
 // Approved division assets are published by the canonical DIV-ASSET validator.
 for(const competition of catalog.filter(c=>c.category==='domestic')){
  const logo=resolveScoreboardTheme(competition).logoAsset;
  assert.ok(logo&&logo.endsWith('/compact.svg'),competition.id);
  assert.equal(isAllowlistedPublicPath(logo),true,logo);
  assert.ok(planPublicFiles().includes(logo),logo);
  const svg=read(logo);
  assert.match(svg,/<svg[\s>]/);
  assert.match(svg,/<path\b/);
  assert.match(svg,/\.s0\s*\{\s*fill:/);
  assert.match(svg,/\.s1\s*\{\s*fill:/);
 }
 const html=read('matches/_shared/index.html'),template=read('templates/match-detail-content.html');
 for(const section of [html,template]){
  assert.match(section,/data-match-detail/);
  assert.match(section,/app-match-scoreboard/);
  assert.match(section,/data-match-competition-logo/);
  assert.doesNotMatch(section,/fa-match-logo-ivory-outline|feMorphology|app-match-logo-filter-defs/);
  assert.doesNotMatch(section,/symbol-mono-white\.svg|data-match-logo-fallback/);
  assert.match(section,/data-match-home-name/);
  assert.match(section,/data-match-away-name/);
  for(const selector of ['app-match-competition-logo','data-match-home-name','data-match-away-name']){
   const opening=selector==='app-match-competition-logo'?
    section.match(/<a class="app-match-competition-logo"[^>]*>/)?.[0]:
    section.match(new RegExp('<a class="app-match-team-link" '+selector+'[^>]*>'))?.[0];
   assert.ok(opening,selector);
   assert.match(opening,/target="_blank"/);assert.match(opening,/rel="noopener noreferrer"/);
  }
  assert.match(section,/<div class="app-match-team-slot app-match-team-home"><a class="app-match-team-link" data-match-home-name target="_blank" rel="noopener noreferrer">/);
  assert.match(section,/<div class="app-match-team-slot app-match-team-away"><a class="app-match-team-link" data-match-away-name target="_blank" rel="noopener noreferrer">/);
  assert.match(section,/data-match-home-score/);
  assert.match(section,/data-match-away-score/);
  assert.doesNotMatch(section,/data-match-status|data-match-extra|app-match-scoreboard-meta/);
  assert.doesNotMatch(section,/app-match-scoreboard-topline/);
  assert.match(section,/<\/section>\s*<p class="app-match-feedback"/);
  assert.doesNotMatch(section,/data-match-reference|app-match-page-heading|match-page-title|data-match-home-crest|data-match-away-crest/);
  assert.doesNotMatch(section,/data-match-tab|data-match-panel|role="tablist"/);
  assert.ok(section.includes('<section class="app-match-context" data-match-cards'));
  assert.ok(section.includes('<section class="app-match-visual" aria-label="Match visualization">'));
  assert.ok(section.includes('data-match-pitch role="img"'));
  assert.ok(section.includes('viewBox="0 0 1050 680"'));
  for(const key of ['overview','lineups','events','stats']){
   assert.ok(section.includes('data-match-card="'+key+'" data-match-emphasis='));
   assert.ok(section.includes('data-match-card-summary="'+key+'"></p>'));
   assert.ok(section.includes('data-match-card-detail="'+key+'"></p>'));
  }
  assert.doesNotMatch(section,/app-match-score-group/);
  assert.match(section,/data-match-home-score aria-label="Home score" aria-hidden="true"><\/strong>/);
  assert.match(section,/data-match-away-score aria-label="Away score" aria-hidden="true"><\/strong>/);
  assert.match(section,/class="app-match-score-separator" aria-hidden="true">–<\/span>/);
  const columns=['data-match-competition-logo','data-match-home-name','data-match-home-score','app-match-score-separator','data-match-away-score','data-match-away-name'];
  for(let i=1;i<columns.length;i++)assert.ok(section.indexOf(columns[i-1])<section.indexOf(columns[i]),'Wrong scoreboard order '+columns[i]);
 }
 assert.doesNotMatch(html,/\btemporary-score-v1\b|<script\b[^>]*src="https?:/);
 assert.match(read('tools/generate-app-pages.mjs'),/writeOutput\("matches\/_shared\/index\.html"/);
});
test('#577 every competition has an explicit theme and only approved HEX roles are used',()=>{
 const ids=catalog.map(x=>x.id).sort();
 assert.deepEqual(Object.keys(scoreboardThemes).sort(),ids);
 for(const competition of catalog){
  const config=scoreboardThemes[competition.id];
  assert.ok(config,'Missing theme '+competition.id);
  const theme=resolveScoreboardTheme(competition);
  assert.ok(contrastRatio(theme.backgroundHex,theme.foregroundHex)>=4.5);
  assert.match(theme.backgroundHex,/^#[0-9A-F]{6}$/);
  assert.match(theme.foregroundHex,/^#[0-9A-F]{6}$/);
  assert.match(theme.accentHex,/^#[0-9A-F]{6}$/);
  if(competition.category==='international'){
   assert.equal(theme.kind,'neutral','No dedicated international colour approved yet');
   assert.equal(config.logoAsset,null,'International cup logo not yet published');
   assert.equal(theme.logoAsset,null);
  }else{
   const allowed=[competition.primaryHex,competition.secondaryHex,competition.ivoryHex];
   assert.equal(theme.logoAsset,config.logoAsset,competition.id);
   assert.match(theme.logoAsset,/^assets\/divisions\/[a-z0-9-]+\/compact\.svg$/);
   assert.equal(isAllowlistedPublicPath(theme.logoAsset),true);
   assert.equal(theme.kind,'competition',competition.id);
   for(const field of ['backgroundHex','foregroundHex','accentHex'])
    assert.ok(allowed.includes(theme[field]),competition.id+': '+field);
   assert.equal(theme.backgroundHex,competition.primaryHex);
   assert.equal(theme.foregroundHex,competition.ivoryHex);
   assert.equal(theme.accentHex,competition.secondaryHex);
   // The light surface is 16% competition primary + 84% ivory. Graphite
   // text must remain legible for all 16 independently-branded divisions.
   const tint='#'+[1,3,5].map(i=>Math.round(
    Number.parseInt(competition.primaryHex.slice(i,i+2),16)*.16+
    Number.parseInt(competition.ivoryHex.slice(i,i+2),16)*.84
   ).toString(16).padStart(2,'0')).join('').toUpperCase();
   assert.ok(contrastRatio(tint,competition.secondaryHex)>=4.5,competition.id+' light contrast');
  }
 }
});
test('#577 refuses arbitrary palette entries or fake logos',()=>{
 assert.equal(resolveScoreboardTheme(null).kind,'neutral');
 assert.equal(resolveScoreboardTheme({id:'ZZ-1'}).kind,'neutral');
 const sample=catalog.find(x=>x.id==='IT-1');
 assert.equal(resolveScoreboardTheme({...sample,primaryHex:'#123456'}).kind,'neutral',
  'A valid-looking but unapproved HEX must be rejected');
 assert.equal(resolveScoreboardTheme({...sample,primaryHex:'orange'}).kind,'neutral');
 assert.equal(resolveScoreboardTheme({...sample,ivoryHex:'var(--unsafe)'}).kind,'neutral');
 assert.equal(resolveScoreboardTheme(sample).logoAsset,'assets/divisions/it-1-lega-federale/compact.svg');
});
test('#577 never fabricates scores, lineups, competition branding or match outcomes',()=>{
 const js=read('assets/match-detail.js');
 assert.match(js,/fetch\('\/api\/matches\/'\+matchId/);
 assert.match(js,/import\('\/assets\/match-scoreboard-themes\.mjs'\)/);
 assert.match(js,/const intended=theme\.logoAsset\?'\/'\+theme\.logoAsset:''/);
 assert.match(js,/const img=document\.createElement\('img'\)/);
 assert.match(js,/img\.src=intended/);
 assert.match(js,/img\.width=44;img\.height=44/);
 assert.match(js,/slot\.append\(img\)/);
 assert.match(js,/const intended=theme\.logoAsset\?'\/'\+theme\.logoAsset:''/);
 assert.match(js,/attributeFilter:\['lang'\]/);
 assert.doesNotMatch(js,/loadLogoPaths|DOMParser|setAttribute\('fill'|feMorphology|fa-match-logo-union-outline|\.dataset\.theme|\.matchLogoPath===intendedKey/);
 assert.doesNotMatch(js,/symbol-mono-white\.svg|data-match-logo-fallback/);
 assert.match(js,/data\.status==='completed'\?data\.result:null/);
 assert.match(js,/write\('\[data-match-home-score\]',validScore\?result\.homeGoals:''\)/);
 assert.match(js,/write\('\[data-match-away-score\]',validScore\?result\.awayGoals:''\)/);
 assert.doesNotMatch(js,/write\('\.app-match-score-separator'/);
 // A static separator is not a fixture result; numbers remain official-only.
 assert.match(js,/score\.setAttribute\('aria-hidden',String\(!validScore\)\)/);
 assert.doesNotMatch(js,/officialState|data-match-status|data-match-extra/);
 for(const snippet of [
  'function renderContext(tr)',
  "data.provenance?.kind==='authoritative'",
  "status==='in_progress'||status==='completed'",
  'Array.isArray(data.events)',
  'knownStats(data.statistics)',
  'validLineup(data.lineups?.home)&&validLineup(data.lineups?.away)',
  'renderContext(tr);'
 ])assert.ok(js.includes(snippet),snippet);
 assert.doesNotMatch(js,/data\.events\.map\(|setInterval\(|requestAnimationFrame\(/);
 assert.match(js,/name\.target='_blank';name\.rel='noopener noreferrer'/);
 assert.match(js,/link\.target='_blank';link\.rel='noopener noreferrer'/);
 assert.match(js,/link\.removeAttribute\('href'\);link\.removeAttribute\('target'\);link\.removeAttribute\('rel'\)/);
 assert.match(js,/if\(!numeric\(matchId\)\)/);
 assert.match(js,/const abbreviation=typeof club\?\.abbr==='string'/);
 assert.match(js,/\?club\.abbr:club\?\.compactName\|\|full/);
 assert.match(js,/name\.textContent=abbreviation/);
 assert.match(js,/name\.href=href\('\/clubs\/'\+id\.split\('-'\)\[0\]\.toLowerCase\(\)\+'\/'\+Number\(id\.split\('-'\)\[1\]\)\+'\/overview'\)/);
 assert.match(js,/name\.removeAttribute\('href'\);name\.removeAttribute\('target'\);name\.removeAttribute\('rel'\)/);
 const clubs=JSON.parse(read('clubs/_shared/manifest.json')).clubs;
 assert.equal(clubs.length,320);
 assert.ok(clubs.every(c=>/^[A-Z0-9]{2,5}$/.test(c.abbr)),'Approved club abbreviations expected');
 assert.match(js,/data-match-home-score/);
 assert.match(js,/data-match-away-score/);
 assert.doesNotMatch(js,/data-match-reference|data-match-home-crest|data-match-away-crest|\+' # '\+matchId/);
 assert.doesNotMatch(js,/Math\.random|mockMatch|demoFixture|temporary-score-v1/);
 const css=read('assets/match-detail.css');
 assert.match(css,/\.app-match-page\{box-sizing:border-box;width:100%;min-width:0;padding-top:0;overflow:visible\}/);
 for(const snippet of [
  'grid-template-columns:repeat(4,minmax(0,1fr))',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  '.app-match-context-card[data-match-emphasis="medium"]{opacity:.72}',
  '.app-match-context-card[data-match-emphasis="low"]{opacity:.42}',
  'aspect-ratio:105 / 68',
  '.app-match-page[data-match-load="missing"] .app-match-context'
 ])assert.ok(css.includes(snippet),snippet);
 assert.doesNotMatch(css,/\.app-match-scoreboard-meta|\.app-match-status|\.app-match-extra/);
 assert.doesNotMatch(css,/\.app-match-page\{padding-top:(?:4|6)px\}/);
 assert.match(css,/left:-20px;width:min\(100%,284px\);height:48px/);
 assert.match(css,/@media\(max-width:308px\)\{\.app-match-scoreboard\{left:clamp\(-20px,calc\(134px - 50vw\),0px\)\}\}/);
 assert.match(css,/width:min\(100%,268px\);height:48px/);
 assert.match(css,/grid-template-columns:48px minmax\(0,1fr\) 35px 20px 35px minmax\(0,1fr\)/);
 assert.match(css,/grid-template-columns:48px minmax\(0,1fr\) 32px 18px 32px minmax\(0,1fr\)/);
 assert.match(css,/\.app-match-score-line\{[^}]*column-gap:0;align-items:center/s);
 assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.app-match-score-line\{[^}]*column-gap:0;padding-right:8px/s);
 assert.match(css,/\.app-match-side-score\[data-match-home-score\]\{box-sizing:border-box;text-align:right;padding-right:3px\}/);
 assert.match(css,/\.app-match-side-score\[data-match-away-score\]\{box-sizing:border-box;text-align:left;padding-left:3px\}/);
 assert.match(css,/\.app-match-score-separator\{[^}]*text-align:center;color:#FFFFFF;[^}]*font-size:21px;line-height:1;font-weight:700;opacity:1/s);
 assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.app-match-score-separator\{font-size:19px\}/);
 assert.match(css,/html\[data-theme="light"\] \.app-match-score-separator\{color:var\(--app-match-text\)\}/);
 assert.match(css,/\.app-match-scoreboard::before\{[^}]*inset:0 0 0 12px/s);
 assert.match(css,/\.app-match-scoreboard::before\{[^}]*border:1px solid var\(--app-match-edge\)/s);
 assert.match(css,/\.app-match-scoreboard::before\{[^}]*background:var\(--app-match-surface\)/s);
 assert.match(css,/\.app-match-competition-logo\{[^}]*width:48px;height:48px;overflow:hidden/s);
 assert.match(css,/\.app-match-competition-logo>span\{[^}]*display:grid;place-items:center;width:100%;height:100%;min-width:0;min-height:0/s);
 assert.doesNotMatch(css,/\.app-match-competition-logo>span\{[^}]*width:48px;height:48px/s);
 assert.match(css,/\.app-match-competition-logo\{[^}]*border:1px solid var\(--app-match-edge\);border-radius:var\(--app-match-radius\)/s);
 assert.match(css,/\.app-match-competition-logo img\{[^}]*width:44px;height:44px/s);
 assert.match(css,/--app-match-logo-surface:#F5F1E8/);
 assert.match(css,/--app-match-radius:6px/);
 assert.match(css,/\.app-match-side-score\{[^}]*font-size:24px/s);
 assert.match(css,/\.app-match-team-slot\{[^}]*display:flex;align-items:center;align-self:stretch/s);
 assert.match(css,/\.app-match-team-link\{[^}]*display:inline-block;flex:0 1 auto;width:max-content/s);
 assert.match(css,/\.app-match-team-link\{[^}]*overflow:visible;white-space:nowrap/s);
 assert.doesNotMatch(css,/\.app-match-team-link\{[^}]*overflow:hidden/s);
 assert.match(css,/\.app-match-team-link:not\(\[href\]\)\{cursor:default;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(css,/\.app-match-team-link\{[^}]*text-align:center;font-size:26px;line-height:1;font-weight:800;letter-spacing:0/s);
 assert.match(css,/\.app-match-team-home\{justify-content:flex-end;padding-right:4px\}/);
 assert.match(css,/\.app-match-team-away\{justify-content:flex-start;padding-left:4px\}/);
 assert.match(css,/\.app-match-team-slot\{[^}]*box-sizing:border-box;min-width:0/s);
 assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.app-match-team-link\{font-size:24px;letter-spacing:0\}/);
 assert.match(css,/\.app-match-team-link \.app-skeleton-bar\{[^}]*display:block;width:54px;max-width:100%;height:20px/s);
 assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.app-match-team-link \.app-skeleton-bar\{width:50px;height:18px\}/);
 assert.match(css,/\.app-match-team-link \.app-skeleton-bar\{[^}]*margin:0;border-radius:4px/s);
 assert.match(css,/\.app-match-team-link\{[^}]*width:max-content;min-width:0;max-width:100%/);
 assert.doesNotMatch(css,/\.app-match-team-link\{[^}]*overflow:hidden;text-overflow:ellipsis/s);
 assert.match(css,/--app-match-text:var\(--app-match-accent\)/);
 assert.match(css,/--app-match-edge:var\(--app-match-surface\)/);
 assert.match(css,/--app-match-logo-surface:color-mix\(in srgb,var\(--app-match-surface\) 5%,#F5F1E8 95%\)/);
 assert.match(css,/background:color-mix\(in srgb,var\(--app-match-surface\) 16%,#F5F1E8 84%\)/);
 assert.match(css,/html\[data-theme="light"\] \.app-match-scoreboard\[data-scoreboard-theme="neutral"\]/);
 assert.match(css,/\.app-match-scoreboard,\.app-match-scoreboard \*\{transition:none!important;animation:none!important\}/);
 assert.match(css,/\.app-match-team-link\[href\]\{cursor:pointer\}/);
 assert.match(css,/\.app-match-team-link\[href\]:hover\{[^}]*text-decoration-line:underline;text-decoration-thickness:\.1em;[^}]*text-underline-offset:3px/s);
 assert.doesNotMatch(css,/\.app-match-team-link\[href\]\{[^}]*text-decoration-line:underline/s);
 assert.doesNotMatch(css,/\.app-match-team-link\[href\](?::hover)?\{[^}]*padding|\.app-match-team-link\[href\](?::hover)?\{[^}]*margin/s);
 assert.match(css,/\.app-match-competition-logo\[href\]:hover\{opacity:1\}/);
 assert.doesNotMatch(css,/gradient\(|\.app-match-scoreboard::after|\.app-match-competition-logo::after|app-match-score-group|app-match-score-surface|app-match-score-text/);
 assert.doesNotMatch(css,/\.app-match-side-score\{[^}]*border:|\.app-match-side-score\{[^}]*background:/s);
 assert.doesNotMatch(css,/drop-shadow\(|filter:url\(|\.app-match-logo-art/);
 // Disallow hover tooltips on scoreboard elements; document.title is the legitimate page title.
 assert.doesNotMatch(js,/(?:name|link|slot|img|board)\.title\s*=/);
 assert.match(js,/document\.title=tr\.match/);
 assert.match(js,/name\.removeAttribute\('title'\)/);
 assert.match(js,/link\.removeAttribute\('title'\)/);
});

test('#577 parser-time branding only uses the same approved palette as hydration',()=>{
 for(const competition of catalog){
  const initial=resolveFirstPaintMatchTheme(competition.id);
  const hydrated=resolveScoreboardTheme(competition);
  if(competition.category==='international')assert.equal(initial,null);
  else assert.deepEqual(initial,{backgroundHex:hydrated.backgroundHex,
   foregroundHex:hydrated.foregroundHex,accentHex:hydrated.accentHex});
 }
 for(const id of ['ZZ-1','it-1','IT-3',null,'<script>'])assert.equal(resolveFirstPaintMatchTheme(id),null);
});
