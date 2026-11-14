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
