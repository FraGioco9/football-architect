import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('assets/club-fixtures.js',root),'utf8');
const window={faRoutesRegistry:{withSeason:path=>path}};
runInNewContext(source,{window});
const fixtures=window.faClubFixtures;

const snapshot={
 coverage:'complete',day:0,
 competitions:[{id:'IT-1',name:'Italy First'}],
 rows:[{id:'fixture-1',opponentId:'IT-2',competitionId:'IT-1',day:1,round:1,phaseId:'league',goalsFor:null,venue:'away'}]
};
const club={countryId:'IT',clubId:'2',primaryName:'Opponent FC'};
const render=clubs=>fixtures.render({manifest:{clubs,clubCrests:{'IT-2':'assets/opponent.svg'}},lang:'en',season:1,currentSeason:1,seasons:[1],snapshot});

test('Club Fixtures links and underlines only the opponent name, not the crest',()=>{
 const html=render([club]);
 assert.match(html,/<span class="club-fixture-opponent"><span class="app-world-club-crest-placeholder[^"]*"[^>]*data-club-crest="IT-2"/);
 assert.match(html,/<\/span><a class="club-fixture-opponent-name" href="\/clubs\/it\/2\/overview">Opponent FC<\/a><\/span>/);
 assert.doesNotMatch(html,/<a class="club-fixture-opponent"/);
 const css=readFileSync(new URL('assets/club-page.css',root),'utf8');
 assert.match(css,/\.club-fixture-opponent-name:is\(:hover,:focus-visible\)\{text-decoration:underline/);
 assert.doesNotMatch(css,/a\.club-fixture-opponent:is\(:hover,:focus-visible\)/);
});

test('Club Fixtures keeps unknown opponents as plain text and restores focus to name links',()=>{
 const html=render([]);
 assert.match(html,/<span class="club-fixture-opponent"><span class="app-world-club-crest-placeholder[^"]*"[^>]*aria-hidden="true">[\s\S]*?<\/span><span>Opponent TBD<\/span><\/span>/);
 assert.doesNotMatch(html,/class="club-fixture-opponent-name"/);
 const controller=readFileSync(new URL('assets/club-fixtures-controller.mjs',root),'utf8');
 assert.match(controller,/focused\?\.matches\('\.club-fixture-opponent-name'\)/);
});

test('Club Fixtures only link official numeric draw scores, not crest or DEV rows',()=>{
 const official={...snapshot,source:'authoritative',coverage:'partial',rows:[{...snapshot.rows[0],id:'123',matchId:'123'}]};
 const output=value=>fixtures.render({manifest:{clubs:[club],clubCrests:{'IT-2':'assets/opponent.svg'}},lang:'en',season:1,currentSeason:1,seasons:[1],snapshot:value});
 const linked=output(official);
 assert.match(linked,/<li class="club-fixture-row(?: is-next)? is-match-link"[^>]*data-club-fixture-id="123"/);
 assert.match(linked,/<a class="club-fixture-score-link" href="\/matches\/123" aria-label="Open match: Opponent FC"><strong/);
 const css=readFileSync(new URL('assets/club-page.css',root),'utf8');
 assert.match(css,/html:not\(\[data-fa-fixture-hover-suspended\]\) \.club-fixture-row\.is-match-link:hover[\s\S]*?background:color-mix/);
 assert.doesNotMatch(css,/\.club-fixture-score-link:is\(:hover,:focus-visible\) strong/);
 const controller=readFileSync(new URL('assets/club-fixtures-controller.mjs',root),'utf8');
 assert.match(controller,/card\?\.querySelector\('\.club-fixture-score-link'\)\?\.click\(\)/);
 for(const invalid of [
  {...official,coverage:'complete'},{...official,source:'dev'},
  {...official,rows:[{...official.rows[0],matchId:'00123'}]},
  {...official,rows:[{...official.rows[0],matchId:'124'}]},
  {...official,rows:[{...official.rows[0],id:'9007199254740992',matchId:'9007199254740992'}]}
 ]){
  assert.doesNotMatch(output(invalid),/class="club-fixture-score-link"/);
  assert.doesNotMatch(output(invalid),/class="club-fixture-row(?: is-next)? is-match-link"/);
 }
});

test('Complete verified club fixtures need the published lookup authority',()=>{
 const complete={...snapshot,source:'authoritative',coverage:'complete',
  rows:[{...snapshot.rows[0],id:'source-fixture',matchId:'785'}]};
 const html=s=>fixtures.render({manifest:{clubs:[club]},lang:'en',season:1,currentSeason:1,seasons:[1],snapshot:s});
 assert.doesNotMatch(html(complete),/club-fixture-score-link/);
 assert.match(html({...complete,linkAuthority:'published-match-index-v1'}),/href="\/matches\/785"/);
});

test('Club Fixtures scroll dismisses pointer hover without hiding keyboard focus',()=>{
 const css=readFileSync(new URL('assets/club-page.css',root),'utf8');
 const controller=readFileSync(new URL('assets/club-fixtures-controller.mjs',root),'utf8');
 assert.match(css,/\.club-fixture-row\.is-match-link\{cursor:pointer;transition:background-color \.15s ease\}/,
  'the hover fade-out is preserved during scrolling');
 assert.doesNotMatch(css,/html\[data-fa-fixture-hover-suspended\] \.club-fixture-row\.is-match-link\{transition:none\}/);
 assert.match(css,/\.club-fixture-row\.is-match-link:has\(\.club-fixture-score-link:focus-visible\)/);
 assert.match(controller,/window\.addEventListener\('scroll',[\s\S]*?faFixtureHoverSuspended='true'/);
 assert.match(controller,/window\.addEventListener\('pointermove',[\s\S]*?event\.pointerType!=='mouse'/);
 assert.match(controller,/delete document\.documentElement\.dataset\.faFixtureHoverSuspended/);
});
