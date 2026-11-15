import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,buildRoute} from '../assets/routes-registry.mjs';
import {publicRequestFile,isAllowlistedPublicPath,planPublicFiles} from '../tools/publication-guard.mjs';
import {scoreboardThemes,resolveScoreboardTheme,contrastRatio} from '../assets/match-scoreboard-themes.mjs';
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
  assert.match(section,/data-match-home-score/);
  assert.match(section,/data-match-away-score/);
  assert.match(section,/data-match-status/);
  assert.doesNotMatch(section,/app-match-scoreboard-topline/);
  assert.match(section,/<\/section>\s*<div class="app-match-scoreboard-meta">/);
  assert.doesNotMatch(section,/data-match-reference|app-match-page-heading|match-page-title|data-match-home-crest|data-match-away-crest/);
  assert.doesNotMatch(section,/data-match-tab|data-match-panel/);
  const columns=['data-match-home-name','data-match-home-score','data-match-competition-logo','data-match-away-score','data-match-away-name'];
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
 assert.match(js,/loadLogoPaths\(intended\)/);
 assert.match(js,/cloneNode\(true\)/);
 assert.match(js,/node\.setAttribute\('stroke','#F5F1E8'\)/);
 assert.match(js,/node\.setAttribute\('stroke-width','5'\)/);
 assert.match(js,/node\.setAttribute\('vector-effect','non-scaling-stroke'\)/);
 assert.match(js,/node\.setAttribute\('paint-order','stroke fill'\)/);
 assert.match(js,/colors\[child\.getAttribute\('class'\)\]/);
 assert.doesNotMatch(js,/feMorphology|filter:url\(/);
 assert.doesNotMatch(js,/symbol-mono-white\.svg|data-match-logo-fallback/);
 assert.match(js,/data\.status==='completed'\?data\.result:null/);
 assert.match(js,/validLineup\(data\.lineups\?\.home\)&&validLineup\(data\.lineups\?\.away\)/);
 assert.match(js,/lineup\?\.confirmed===true&&Array\.isArray\(lineup\.starters\)&&lineup\.starters\.length===11/);
 assert.match(js,/if\(!numeric\(matchId\)\)/);
 assert.match(js,/const abbreviation=typeof club\?\.abbr==='string'/);
 assert.match(js,/\?club\.abbr:club\?\.compactName\|\|full/);
 assert.match(js,/name\.textContent=abbreviation/);
 const clubs=JSON.parse(read('clubs/_shared/manifest.json')).clubs;
 assert.equal(clubs.length,320);
 assert.ok(clubs.every(c=>/^[A-Z0-9]{2,5}$/.test(c.abbr)),'Approved club abbreviations expected');
 assert.match(js,/data-match-home-score/);
 assert.match(js,/data-match-away-score/);
 assert.doesNotMatch(js,/data-match-reference|data-match-home-crest|data-match-away-crest|\+' # '\+matchId/);
 assert.doesNotMatch(js,/Math\.random|mockMatch|demoFixture|temporary-score-v1/);
 const css=read('assets/match-detail.css');
 assert.match(css,/width:min\(100%,340px\)/);
 assert.match(css,/height:34px/);
 assert.match(css,/height:30px/);
 assert.match(css,/overflow:visible/);
 assert.match(css,/margin:0 auto/);
 assert.match(css,/width:min\(100%,310px\)/);
 assert.match(css,/top:calc\(50% - 7px\)/);
 assert.match(js,/const svg=document\.createElementNS\(svgNS,'svg'\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 22px 70px 22px minmax\(0,1fr\)/);
 assert.match(css,/width:80px;height:80px/);
 assert.match(css,/width:68px;height:68px/);
 assert.match(css,/top:calc\(50% - 8px\)/);
 assert.match(css,/\.app-match-page\{min-width:0;padding-top:16px;overflow:visible\}/);
 assert.match(css,/\.app-match-page\{padding-top:11px\}/);
 assert.match(css,/\.app-match-scoreboard,\.app-match-scoreboard \*\{transition:none!important;animation:none!important\}/);
 assert.match(css,/\.app-match-team-link\[href\]:hover\{text-decoration:none;opacity:1\}/);
 assert.match(css,/\.app-match-competition-logo\[href\]:hover\{opacity:1\}/);
 assert.match(css,/margin:16px auto 0/);
 assert.match(css,/max-width:310px;margin-top:14px/);
 assert.match(css,/border:1px solid color-mix\(in srgb,var\(--app-match-ink\) 18%,var\(--app-match-surface\)\)/);
 assert.doesNotMatch(css,/border:1px solid #F5F1E8/);
 assert.match(css,/\.app-match-competition-logo \.app-match-logo-art\{[^}]*filter:none/s);
 assert.doesNotMatch(css,/drop-shadow\(|filter:url\(/);
 assert.doesNotMatch(js,/\.title\s*=/);
 assert.match(js,/name\.removeAttribute\('title'\)/);
 assert.match(js,/link\.removeAttribute\('title'\)/);
 assert.doesNotMatch(css,/background:#F5F1E8|border-radius:50%/);
});
