import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const catalogue = JSON.parse(read("data/divisions.json"));
const indexPath = "app/world/divisions/index.html";
const index = read(indexPath);
const routes = catalogue.divisions.map(division => ({
  division,
  file:"app/world/divisions/"+division.id.toLowerCase()+"/index.html"
}));

test("UI-WORLD catalogue maps to 8 country sections and exactly 16 detail URLs",()=>{
  assert.equal(catalogue.countries.length,8);
  assert.equal(catalogue.divisions.length,16);
  assert.equal(new Set(catalogue.divisions.map(division=>division.id)).size,16);
  for(const country of catalogue.countries){
    assert.ok(index.includes('id="world-country-'+country.id.toLowerCase()+'"'));
    assert.equal(catalogue.divisions.filter(division=>division.countryId===country.id).length,2);
  }
  for(const {division,file} of routes){
    assert.ok(existsSync(new URL("../"+file,import.meta.url)),file);
    assert.ok(index.includes('href="./'+division.id.toLowerCase()+'/"'),division.id);
    const detail=read(file);
    assert.ok(detail.includes('id="division-detail-name"'));
    assert.ok(detail.includes(division.name.replaceAll("&","&amp;")),division.id);
    assert.ok(detail.includes('class="app-division-mark app-division-mark-large"'));
    assert.ok(detail.includes('data-app-i18n="competitionUnavailable"'));
    assert.ok(detail.includes('<dd>'+division.capacity+'</dd>'));
    assert.ok(detail.includes('href="../" data-app-i18n="allDivisions"'));
    assert.equal((detail.match(/aria-current="page"/g)||[]).length,1);
    assert.match(detail,/id="app-nav-divisions"[^>]*aria-current="page"/);
    assert.doesNotMatch(detail,/class="(?:league-table|match-result|club-roster)"/);
  }
});

test("UI-WORLD routes resolve every static asset and direct navigation destination",()=>{
  const all=[indexPath,...routes.map(({file})=>file)];
  for(const path of all){
    const html=read(path),base=new URL("../"+path,import.meta.url);
    for(const [,target] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      if(target.startsWith("#")||target.startsWith("data:"))continue;
      assert.doesNotMatch(target,/^https?:/,"no external URL is needed");
      const url=new URL(target,base);
      const candidate=url.pathname.endsWith("/")?new URL("index.html",url):url;
      assert.ok(existsSync(fileURLToPath(candidate)),path+" -> "+target);
    }
    assert.ok(html.includes('id="app-nav-world-title"'));
    assert.ok(html.includes('id="app-nav-settings"'));
    assert.ok(html.includes('id="app-search-trigger"'));
    assert.ok(html.includes('data-app-i18n="navWorld"'));
  }
  assert.equal((index.match(/class="app-division-card"/g)||[]).length,16);
});

test("UI-WORLD uses five localized sets and CSS-only temporary badges",()=>{
  const script=read("assets/app.js");
  const css=read("assets/app.css");
  const template=read("templates/app-page.html");
  for(const lang of ["en","de","es","fr","it"]){
    assert.match(script,new RegExp('(?:^|\\s)'+lang+': \\{'));
  }
  for(const key of ["navWorld","divisionIntro","allDivisions","divisionTier1","divisionTier2","crestPlaceholder","competitionUnavailable","competitionNotice"]){
    assert.equal((script.match(new RegExp(key+':',"g"))||[]).length,5,key);
  }
  assert.match(template,/@@FA_WORLD_SECTION@@/);
  assert.match(template,/@@FA_WORLD_LINK@@/);
  assert.match(css,/\.app-division-mark\{[^}]*border:1px dashed/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.ok(index.includes('src="../../../assets/flags/it.svg"'));
  assert.ok(read("assets/flags/LICENSE").includes("MIT License"));
});

test("PAGE-COMPLETE-01 keeps the three sporting areas empty and offers same-country navigation",()=>{
  const translations=read("assets/app.js");
  const generator=read("tools/generate-app-pages.mjs");
  const search=read("assets/app-search.js");
  const keys=["otherDivision","relatedDivisions","standingsHeading","standingsEmpty",
    "fixturesHeading","fixturesEmpty","clubsHeading","clubsEmpty"];
  for(const key of keys) assert.equal((translations.match(new RegExp(key+":","g"))||[]).length,5,key);
  for(const {division,file} of routes){
    const html=read(file);
    const counterpart=catalogue.divisions.find(d=>d.countryId===division.countryId&&d.id!==division.id);
    assert.ok(counterpart);
    assert.ok(html.includes('href="../'+counterpart.id.toLowerCase()+'/"'));
    for(const id of ["division-standings-heading","division-fixtures-heading","division-clubs-heading"])
      assert.ok(html.includes('id="'+id+'"'),file+" "+id);
    for(const key of ["standingsEmpty","fixturesEmpty","clubsEmpty","otherDivision"])
      assert.ok(html.includes('data-app-i18n="'+key+'"'),file+" "+key);
    assert.doesNotMatch(html,/class="(?:league-table|match-result|club-roster)"/);
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  }
  assert.match(generator,/detailAppend\(division\)/);
  assert.ok(search.includes('../data/divisions.json'));
});

test("COMPETITIONS-01 uses a trophy sidebar icon, no subtitle, and rounded flags",()=>{
  const app=read("assets/app.js");
  const css=read("assets/app.css");
  const sharedCss=read("assets/landing.css");
  const template=read("templates/app-page.html");
  const generator=read("tools/generate-app-pages.mjs");
  assert.equal((app.match(/navCompetitions:/g)||[]).length,5,"five translated sidebar labels");
  assert.ok(template.includes('data-app-i18n="navCompetitions">Competitions'));
  assert.ok(template.includes('M7 4h10v5a5 5 0 0 1-10 0V4Z'),"original trophy icon");
  assert.ok(generator.includes('data-app-aria="navCompetitions"'));
  assert.ok(css.includes('border-radius:6px}'));
  assert.ok(sharedCss.includes('img[src*="assets/flags/"]{border-radius:6px}'));
  assert.ok(!generator.includes("app-world-lead"),"index has no introductory subtitle");
  for(const path of ["app/dashboard/index.html","app/calendar/index.html","app/settings/index.html",indexPath,...routes.map(x=>x.file)]){
    const html=read(path);
    assert.ok(html.includes('data-app-i18n="navCompetitions">Competitions'),path);
    assert.ok(html.includes('data-app-aria="navCompetitions"'),path);
    assert.ok(html.includes('M7 4h10v5a5 5 0 0 1-10 0V4Z'),path);
    if(path===indexPath) assert.ok(!html.includes("app-world-lead"),path);
    else if(path.startsWith("app/world/divisions/")){
      assert.ok(!html.includes('data-app-i18n="placeholderNotice"'),path);
      assert.ok(html.includes('data-app-i18n="competitionNotice"'),path);
    }
  }
});
