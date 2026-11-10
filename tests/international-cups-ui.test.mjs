import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicRequestFile,isAllowlistedPublicPath} from "../tools/publication-guard.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const script=read("assets/international-cups.js");
const index=read("competitions/index.html");
const names=["int-1","int-2"];
const views=["standings","postseason","fixtures","stats","history","rules","awards"];

test("INT-24: both cup routes resolve to public allowlisted HTML",()=>{
  for(const slug of names){
    const route="/competitions/"+slug;
    const file=publicRequestFile(route);
    assert.equal(file,"competitions/"+slug+"/index.html");
    assert.ok(isAllowlistedPublicPath(file));
    assert.ok(index.includes('href="'+route+'/standings"'));
    const html=read(file);
    assert.match(html,/u\.searchParams\.delete\("view"\)/);
    assert.match(html,/history\.replaceState\(null,"",u\.pathname\+u\.search\+u\.hash\)/);
    assert.ok(html.includes('<h1 class="app-page-title" id="divisions-title"'));
    assert.ok(html.includes('aria-labelledby="divisions-title"'));
    assert.ok(html.includes('class="app-competition-header"'));
    assert.ok(html.includes('id="app-competition-season"'));
    assert.ok(html.includes('src="/assets/competition-page.js"'));
    for(const view of views){
      assert.ok(html.includes('id="competition-tab-'+view+'"'),slug+" "+view);
      assert.ok(html.includes('id="competition-panel-'+view+'"'));
      assert.equal(publicRequestFile(route+"/"+view),file);
    }
  }
  assert.ok(isAllowlistedPublicPath("assets/international-cups.js"));
  assert.equal((index.match(/class="app-division-card" href="\/competitions\/(?:it|eng|es|de|fr|pt|nl|br)-[12]\/standings/g)||[]).length,16);
});

test("INT-24: five language dictionaries and empty states, no fabricated results",()=>{
  for(const locale of ["en","de","es","fr","it"])assert.match(script,new RegExp('"'+locale+'":\\['));
  assert.ok(script.includes('document.documentElement.lang'));
  assert.ok(script.includes('MutationObserver'));

  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('id="app-standings-body"'));
    assert.ok(!html.includes('data-world-country="IT"'));
    assert.ok(!html.includes('data-fa-score='));
  }
});

test("INT-24: shared theme controls and responsive CSS exist",()=>{
  for(const slug of names){
    const html=read("competitions/"+slug+"/index.html");
    assert.ok(html.includes('src="/assets/theme.js"'));
    assert.ok(html.includes('href="/assets/app.css"'));
    assert.ok(html.includes('class="app-competition-tabs"'));
    assert.ok(!html.includes('class="app-international-tabs"'));
  }
});

test('INT-24 cup knockout tab uses its own label without changing domestic playoffs',()=>{
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  assert.match(html,/id="competition-tab-postseason"[^>]+data-app-i18n="competitionTabKnockouts">Knockouts<\/button>/);
  assert.doesNotMatch(html,/\/__fa_dev__\//);
 }
 assert.match(read('competitions/it-1/index.html'),/data-app-i18n="competitionTabPlayout">Playout/);
});

test('INT-24 DEV injects shared Debug controls on cup root and subpage routes',async()=>{
 const {createPreviewServer}=await import('../tools/dev-standings-preview.mjs');
 const {once}=await import('node:events');
 const {request}=await import('node:http');
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=path=>new Promise((resolve,reject)=>{
  request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:2000'}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,body}));
  }).on('error',reject).end();
 });
 try{
  for(const slug of names)for(const suffix of ['',...views.map(v=>'/'+v)]){
   const response=await get('/competitions/'+slug+suffix+'?season=99');
   assert.equal(response.status,200);
   assert.match(response.body,/data-fa-dev-preview src="\/__fa_dev__\/standings-client.mjs"/);
   assert.match(response.body,/dataset.faDevSeasons="1,2,3,4"/);
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('INT-24: generated cup identity enters the same loader without a domestic identity',()=>{
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  assert.match(html,new RegExp('<meta name="fa-competition" content="'+slug+'">'));
  assert.doesNotMatch(html,/<meta name="fa-division"/);
  assert.equal((html.match(/src="\/assets\/competition-page.js"/g)||[]).length,1);
  assert.doesNotMatch(html,/<script src="\/assets\/(?:app|competition-tabs|competition-history|competition-fixtures|competition-awards)\.js"/);
 }
});

test('INT-24: Knockouts renders all rounds without controls while results are pending',()=>{
 for(const slug of names){
  const html=read('competitions/'+slug+'/index.html');
  const panel=html.split('id="competition-panel-postseason"')[1].split('id="competition-panel-fixtures"')[0];
  assert.doesNotMatch(panel,/data-postseason-(filter|help|outcome)|postseasonTie/);
  assert.deepEqual([...panel.matchAll(/data-postseason-round="([^"]+)"/g)].map(match=>match[1]),['playoffs','quarterfinals','semifinals','final']);
  assert.equal((panel.match(/data-postseason-config-tie=/g)||[]).length,11);
  const [,playoffs,quarterfinals]=panel.split(/data-postseason-round="[^"]+"/);
  const firstRound=[...playoffs.matchAll(/data-bracket-tie="([^"]+)"/g)].map(match=>match[1]);
  const quarterfinalFeeders=[...quarterfinals.matchAll(/data-bracket-feeders="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(firstRound,quarterfinalFeeders,'play-offs line up with their quarter-finals');
  // Responsive static markup stores the 4-column and 2-column connector variants.
  // Only the variant for the active row configuration is visible at first paint.
  const fourColumn=[...panel.matchAll(/<svg class="fa-bracket-links" data-bracket-layout="4"[^>]*>([\s\S]*?)<\/svg>/g)];
  const twoColumn=[...panel.matchAll(/<svg class="fa-bracket-links" data-bracket-layout="2"[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.equal(fourColumn.length,3,'adjacent four-column rounds have a connector');
  assert.equal(twoColumn.length,2,'both same-row two-column round pairs have a connector');
  assert.equal(fourColumn.reduce((n,m)=>n+(m[1].match(/data-bracket-link=/g)||[]).length,0),10,'all desktop links are present at first paint');
  assert.equal(twoColumn.reduce((n,m)=>n+(m[1].match(/data-bracket-link=/g)||[]).length,0),6,'both tablet row connections are present at first paint');
  assert.match(panel,/data-postseason-score="q1:0:first"/);
  assert.match(panel,/data-postseason-score="q1:0:second"/);
  assert.doesNotMatch(panel,/data-postseason-score="q1:0:aggregate"/);
  assert.doesNotMatch(panel,/data-app-i18n="postseasonNeutral"|Select a division/);
 }

});

test("QA-08: international mobile blank-state stays visible while unpublished",()=>{
 const source=read("assets/competition-page.js"),css=read("assets/app.css");
 assert.match(source,/app-world-mobile-empty/);
 assert.match(source,/message\.dataset\.appI18n='competitionStandingsEmpty'/);
 assert.match(source,/replaceChildren\(li\)/);
 assert.match(css,/@media\(max-width:620px\)\{\.app-world-standing-scroll\{display:none!important\}/);
 assert.match(css,/\.app-world-mobile-empty/);
});

test("QA-08: verified international Form tooltip cannot invent opponents or scores",async()=>{
 const {runInNewContext}=await import("node:vm");
 const src=read("assets/competition-page.js");
 const start=src.indexOf("  function verifiedPublishedForms(");
 const end=src.indexOf("\n  function bindPublishedFormTooltips(",start);
 assert.ok(start>=0&&end>start);
 const verify=runInNewContext(src.slice(start,end)+";verifiedPublishedForms",{}, {timeout:1000});
 const italy={countryId:"IT",clubId:1,primaryName:"Italy One"};
 const england={countryId:"ENG",clubId:1,primaryName:"England One"};
 const rules={clubKey:c=>c.countryId+"-"+c.clubId};
 const definition={category:"international"};
 const fixture={phaseId:"league",round:2,homeId:"IT-1",awayId:"ENG-1",homeGoals:2,awayGoals:1,kickoff:null};
 const game={round:2,homeId:"IT-1",awayId:"ENG-1",result:"W"};
 const data={participants:[italy,england],fixtures:[fixture]};
 const rows=[{club:italy,recent:[game]}];
 const actual=verify(data,rows,definition,rules);
 assert.deepEqual([...actual.keys()],["IT-1|2|IT-1|ENG-1"]);
 const value=actual.get("IT-1|2|IT-1|ENG-1");
 assert.equal(value.fixture.homeGoals,2);
 assert.equal(value.fixture.awayGoals,1);
 assert.equal(value.home.primaryName,italy.primaryName);
 assert.equal(value.away.primaryName,england.primaryName);
 assert.equal(value.homePerspective,true);
 for(const invalid of [
  {...fixture,homeGoals:null},{...fixture,awayGoals:null},
  {...fixture,phaseId:"quarterfinals"},{...fixture,awayId:"FR-1"}
 ]){
  assert.equal(verify({...data,fixtures:[invalid]},rows,definition,rules).size,0,"Do not show unknown or unplayed scores");
 }
 assert.equal(verify(data,[{club:italy,recent:[{...game,result:"D"}]}],definition,rules).size,0,"Form letter must match actual result");
 assert.equal(verify({...data,fixtures:[]},rows,definition,rules).size,0,"Never infer a score from W alone");
 // Domestic uses numeric fixture IDs but the exact same verified tooltip contract.
 const domestic={category:"domestic"};
 const dFixture={...fixture,homeId:1,awayId:2},dGame={...game,homeId:1,awayId:2};
 const dClubs=[italy,{...england,countryId:"IT",clubId:2}];
 assert.equal(verify({participants:dClubs,fixtures:[dFixture]},[{club:italy,recent:[dGame]}],domestic,rules).size,1);
});
