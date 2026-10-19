// DEV-GATE-01..06 and deterministic multi-division regression coverage.
// Run via Node's built-in test runner; no npm install or manual workflow needed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { request } from "node:http";
import { once } from "node:events";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { createPreviewStandings } from "../tools/dev-standings-preview-data.mjs";
import { createPreviewServer } from "../tools/dev-standings-preview.mjs";
import { isAllowlistedPublicPath, planPublicFiles, stagePublicArtifact,
  assertPublicArtifact } from "../tools/publication-guard.mjs";

const ROOT = new URL("../", import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const read = path => readFileSync(new URL(path, ROOT));
const manifest = JSON.parse(read("app/competitions/_shared/manifest.json"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const client = read("tools/dev-standings-preview-client.mjs").toString();
const widget = read("tools/dev-debug-widget.mjs").toString();
const serverSource = read("tools/dev-standings-preview.mjs").toString();
const clientName = "/__fa_dev__/standings-client.mjs";
const widgetName = "/__fa_dev__/debug-widget.mjs";
const dataName = "/__fa_dev__/standings-data.mjs";
const allIds = manifest.divisions.map(d => d.id);

test("DEV-LEAGUES: deterministic complete 16x16 standings and 1,920 DEV fixture objects", () => {
  assert.equal(manifest.approved, false);
  assert.equal(allIds.length, 16);
  const snapshots = [];
  const clubIdentities = new Set();
  let totalGames = 0;
  for (const division of manifest.divisions) {
    const model = createPreviewStandings(division);
    const second = createPreviewStandings(division);
    assert.deepEqual(second, model, division.id + " must be deterministic");
    assert.equal(model.rows.length, 16);
    assert.equal(model.fixtures.length, 120);
    assert.deepEqual(new Set(model.fixtures.map(f => f.round)).size, 15);
    const pairs = new Set();
    for (let day = 1; day <= 15; day++) {
      const matches = model.fixtures.filter(f => f.round === day);
      assert.equal(matches.length, 8);
      const dayClubs = matches.flatMap(m => [m.homeId, m.awayId]);
      assert.equal(new Set(dayClubs).size, 16);
    }
    for (const match of model.fixtures) {
      assert.ok(match.homeGoals >= 0 && match.awayGoals >= 0);
      const key = [match.homeId, match.awayId].sort((a, b) => a-b).join("/");
      assert.ok(!pairs.has(key), "pair must be played once");
      pairs.add(key);
    }
    let wins = 0, losses = 0, gf = 0, ga = 0, draws = 0;
    const previous = model.rows.map(x => [x.pts, x.gd, x.gf, x.club.clubId]);
    assert.deepEqual(previous, [...previous].sort((a, b) =>
      b[0]-a[0] || b[1]-a[1] || b[2]-a[2] || a[3]-b[3]));
    for (const row of model.rows) {
      const id = row.club.countryId + ":" + row.club.clubId;
      assert.ok(row.club.clubId >= (division.tier===1?1:17) &&
        row.club.clubId <= (division.tier===1?16:32), "wrong tier or excluded club");
      assert.ok(!clubIdentities.has(id));
      clubIdentities.add(id);
      assert.equal(row.played, 15);
      assert.equal(row.won + row.drawn + row.lost, 15);
      assert.equal(row.pts, 3 * row.won + row.drawn);
      assert.equal(row.gd, row.gf - row.ga);
      assert.equal(row.recent.length, 5);
      assert.deepEqual(row.recent.map(x=>x.round), [15,14,13,12,11]);
      wins += row.won;
      losses += row.lost;
      draws += row.drawn;
      gf += row.gf;
      ga += row.ga;
      for (const recent of row.recent) {
        const game = model.fixtures.find(x=>x.round===recent.round &&
          x.homeId===recent.homeId && x.awayId===recent.awayId);
        assert.ok(game);
        const home = recent.homeId===row.club.clubId;
        assert.equal(recent.isHome, home);
        assert.equal(recent.result, (home ?
          game.homeGoals > game.awayGoals ? "W" : game.homeGoals < game.awayGoals ? "L" : "D" :
          game.awayGoals > game.homeGoals ? "W" : game.awayGoals < game.homeGoals ? "L" : "D"));
      }
    }
    assert.equal(wins, losses);
    assert.equal(draws % 2, 0);
    assert.equal(gf, ga);
    totalGames += model.fixtures.length;
    snapshots.push(model);
  }
  assert.equal(totalGames, 1920);
  assert.equal(clubIdentities.size, 256);
  assert.equal(snapshots.length, 16);
});

test("DEV-SEASONS: seasons 1–4 generate deterministic, distinct fictional schedules", () => {
  const division = manifest.divisions[0];
  const seasons = [1, 2, 3, 4].map(season => createPreviewStandings(division, 30, season));
  for (let index = 0; index < seasons.length; index++) {
    const season = index + 1;
    const first = seasons[index];
    assert.equal(first.season, season);
    assert.equal(first.rows.length, 16);
    assert.equal(first.fixtures.length, 240);
    assert.deepEqual(createPreviewStandings(division, 30, season), first);
  }
  assert.equal(new Set(seasons.map(model => JSON.stringify(model.fixtures))).size, 4,
    "each season must have a distinct deterministic schedule");
  assert.throws(() => createPreviewStandings(division, 30, 5), /Invalid DEV season/);
});

test("DEV-GATE-01: published artifact excludes all preview sources and private fixtures", () => {
  const preview = ["tools/dev-debug-widget.mjs","tools/dev-standings-preview.mjs",
    "tools/dev-standings-preview-client.mjs","tools/dev-standings-preview-data.mjs",
    "tests/dev-standings-preview.test.mjs","tests/fixtures/it-1-demo.mjs"];
  for (const path of preview) assert.equal(isAllowlistedPublicPath(path), false, path);
  const publicFiles = planPublicFiles();
  for (const path of preview) assert.ok(!publicFiles.includes(path));
  assert.ok(publicFiles.includes("app/competitions/it-1/index.html"));
  assert.ok(publicFiles.includes("assets/theme.js"),"theme bootstrap must be published");
  const folder = mkdtempSync(join(tmpdir(), "fa-standings-dev-"));
  try {
    const artifact = join(folder, "public");
    stagePublicArtifact(ROOT_PATH, artifact);
    assert.ok(readFileSync(join(artifact,"assets/theme.js"),"utf8").includes("football-architect:theme"));
    assert.deepEqual(assertPublicArtifact(artifact, {
      sourceRoot: ROOT_PATH
    }), publicFiles);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("DEV-GATE-02 + 05: public source bytes and canonical datasets stay unchanged", async () => {
  const files = ["assets/competition-page.js", "assets/app.css", "assets/theme.js",
    "app/competitions/it-1/index.html","app/competitions/_shared/manifest.json",
    "data/divisions.json","data/clubs.json","data/division-allocations.provisional.json"];
  const before = files.map(f => hash(read(f)));
  for (const division of manifest.divisions) createPreviewStandings(division);
  assert.deepEqual(files.map(f => hash(read(f))), before);
  assert.equal(manifest.approved, false);
  const privateClient = client + serverSource + widget;
  assert.ok(privateClient.includes("sessionStorage"));
  assert.ok(!/\blocalStorage\b|\bindexedDB\b/.test(privateClient));
  assert.ok(!/\bwriteFile(?:Sync)?\b|\bappendFile(?:Sync)?\b/.test(privateClient));
});

test("DEV-GATE-03: ordinary public standings do not import or serve DEV fixtures", () => {
  for (const division of manifest.divisions) {
    const html = read("app/competitions/" + division.id.toLowerCase() +
      "/index.html").toString();
    assert.ok(!html.includes("__fa_dev__"));
    assert.ok(!html.includes("standingsPreview"));
    assert.ok(!html.includes("standings-client"));
  }
  const publicRuntime = read("assets/competition-page.js").toString();
  assert.ok(!publicRuntime.includes("__fa_dev__"));
  assert.ok(!publicRuntime.includes("standingsPreview"));
  assert.ok(!publicRuntime.includes("it1Demo"));
});

test("DEV-GATE-06: malformed and incomplete models are rejected without partial results", () => {
  const division = manifest.divisions[0];
  for (const bad of [null, {}, {...division, clubs:[]},
    {...division, id:"FAKE-1"},
    {...division, clubs:[...division.clubs.slice(0,15),division.clubs[0]]},
    {...division, clubs:[...division.clubs.slice(0,15),{...division.clubs[15],clubId:33}]},
    {...division, tier:division.tier===1?2:1},
    {...division, clubs:division.clubs.map(x=>({...x, primaryName:""}))}]) {
    assert.throws(()=>createPreviewStandings(bad));
  }
  assert.ok(client.includes("fragment.childNodes.length !== 16"));
  assert.ok(client.includes("tbody.replaceChildren(fragment)"));
  assert.ok(client.includes('manifest.approved !== false'));
});

async function withServer(callback) {
  const server = createPreviewServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  function get(path, { host = "127.0.0.1:2000", method = "GET" } = {}) {
    return new Promise((resolve, reject) => {
      const req = request({ host:"127.0.0.1",port,method,path,headers:{ Host:host } }, res => {
        const chunks = [];
        res.on("data", x => chunks.push(x));
        res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,
          body:Buffer.concat(chunks).toString()}));
      });
      req.on("error",reject);
      req.end();
    });
  }
  try {
    assert.equal(server.address().address, "127.0.0.1");
    await callback(get);
  } finally { await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok())); }
}

test("DEV-ROUTES: canonical slashless pages, assets and season links load directly", async()=>{
  await withServer(async get=>{
    const pages=["/","/guide","/app","/app/dashboard","/app/calendar","/app/settings","/app/competitions",
      ...allIds.map(id=>"/app/competitions/"+id.toLowerCase())];
    for(const page of [...pages,...pages.filter(p=>p.startsWith("/app/")).map(p=>p.slice(4))]){
      const response=await get(page);
      assert.equal(response.status,200,page);
      assert.match(response.headers["content-type"],/text\/html/,page);
      const base=response.body.match(/<base href="([^"]+)"/)?.[1];
      for(const match of response.body.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|png|ico))"/g)){
        const asset=new URL(match[1],new URL(base||page,"http://localhost:2000"));
        assert.equal((await get(asset.pathname)).status,200,page+" -> "+asset.pathname);
      }
    }
    const index=await get("/competitions");
    assert.equal((index.body.match(/data-dev-latest-season="4"/g)||[]).length,16);
    assert.equal((index.body.match(/\?season=4&amp;view=standings/g)||[]).length,16);
    assert.ok(!index.body.includes("?season=1"));
    for(const id of allIds){
      const path="/competitions/"+id.toLowerCase();
      for(const season of [2,3,4]){
        const response=await get(path+"?season="+season+"&view=fixtures");
        assert.ok(response.body.includes('data-fa-dev-preview'),path+" season "+season);
        assert.ok(response.body.includes('id="app-competition-season-value">'+season+'</span>'),path+" season "+season);
      }
      assert.equal((await get(path,{method:"HEAD"})).body,"");
    }
    for(const path of ["/unknown","/app/unknown","/app/competitions/unknown","/data/clubs","/tools/dev-standings-preview"])
      assert.equal((await get(path)).status,404,path);
  });
});

test("DEV-GATE-04: server accepts only loopback + strict Host, rejects traversal", async () => {
  await withServer(async get => {
    for (const path of ["/%2e%2e/data/clubs.json","/../data/clubs.json",
      "/tests/fixtures/it-1-demo.mjs","/tools/dev-standings-preview-data.mjs",
      "/.github/workflows/landing-checks.yml","//example.com/app/competitions/it-1/"]) {
      assert.notEqual((await get(path)).status, 200, path);
    }
    assert.equal((await get("/app/competitions/it-1/",{host:"attacker.example:2000"})).status,403);
    assert.equal((await get("/app/competitions/it-1/",{host:"localhost:2000"})).status,403);
    assert.equal((await get("/dashboard",{host:"app.localhost:2000"})).status,403);
    assert.equal((await get("/app/competitions/it-1/",{method:"POST"})).status,405);
    assert.equal((await get("/app/competitions/it-1/",{method:"HEAD"})).body,"");
  });
});

test("DEV-GATE-01/03: only DEV responses inject private scripts; static source stays clean", async () => {
  await withServer(async get => {
    const page = await get("/app/competitions/it-1/");
    assert.equal(page.status,200);
    assert.equal(page.headers["cache-control"],"no-store");
    assert.equal(page.body.split(clientName).length,2);
    assert.ok(page.body.includes("<script type=\"module\""));
    const indexPage = await get("/app/competitions/eng-2/index.html");
    assert.equal(indexPage.status,200);
    assert.equal(indexPage.body.split(clientName).length,2);
    const regular = await get("/");
    assert.equal(regular.status,200);
    assert.ok(!regular.body.includes(clientName));
    assert.ok(regular.body.includes("assets/theme.js"),"landing bootstraps theme");
    const theme=await get("/assets/theme.js");
    assert.equal(theme.status,200,"DEV loopback must serve required public runtime");
    assert.match(theme.headers["content-type"],/javascript/);
    assert.equal(theme.headers["cache-control"],"no-store");
    assert.ok(theme.body.includes("football-architect:theme"));
    assert.ok(theme.body.includes("data-theme"));
    assert.ok(!theme.body.includes("__fa_dev__"));
    for (const virtual of [clientName,dataName,widgetName]) {
      const result = await get(virtual);
      assert.equal(result.status,200);
      assert.match(result.headers["content-type"],/javascript/);
      assert.ok(result.body.length > 300);
    }
    for (const division of manifest.divisions) {
      assert.equal((await get("/app/competitions/" +
        division.id.toLowerCase() + "/")).status,200);
    }
  });
});

test("DEV-L10N + interactions: 5 languages, 80 results and widget", () => {
  for(const lang of ["en","de","es","fr","it"])
    assert.match(client, new RegExp("\\b"+lang+": \\{ round:"));
  assert.ok(client.includes("entries.length !== 16*Math.min(5,matchdays)"));
  assert.ok(client.includes('new MutationObserver(translate)'));
  for(const event of ["pointerenter","pointerleave","pointerdown","focus","blur","click","keydown","resize"])
    assert.ok(client.includes('"'+event+'"'),event);
  for(const property of ["game.homeGoals","game.awayGoals","game.homeId","game.awayId",
    "game.round","game.isHome"])
    assert.ok(client.includes(property),property);
  assert.ok(client.includes("sessionStorage.removeItem(FLAG)"));
});

test("UX-01A: mobile compact-only and desktop full table share one validated model", () => {
  const html = read("app/competitions/_shared/index.html").toString();
  const runtime = read("assets/competition-page.js").toString();
  const css = read("assets/app.css").toString();
  const localization = read("assets/app.js").toString();
  // The shared HTML remains generator-owned and byte-identical.
  assert.ok(!html.includes('id="app-standings-compact-list"'));
  for (const id of ["app-standings-compact-list","app-standings-full"])
    assert.ok(runtime.includes('id="'+id+'"'),id);
  assert.ok(runtime.includes("withMobileShell(standings.outerHTML)"));
  for (const key of ["standingsMobileRecent","standingsMobileDetails"])
    assert.equal(localization.split(key+":").length,6,"five localizations for "+key);
  for (const removed of ["app-standings-layout-switch","app-standings-show-compact",
    "app-standings-show-full"]) assert.ok(!runtime.includes(removed));
  assert.ok(!css.includes(".app-world-layout-switch"));
  assert.ok(css.includes("@media(max-width:620px){.app-world-standing-scroll{display:none!important}"));
  assert.ok(css.includes("@media(min-width:621px){.app-world-compact{display:none!important}}"));
  assert.ok(runtime.includes("function createMobileStandings()"));
  assert.ok(runtime.includes('element("dl","app-world-mobile-stats")'));
  assert.ok(runtime.includes('for (const game of row.recent) {'),"five form indicators preserved");
  for (const absent of ["app-world-mobile-matches","app-world-mobile-match",
    "standingsMobileMatches","Recent matches"]) {
    assert.ok(!runtime.includes(absent),"removed from mobile rendering: "+absent);
    assert.ok(!css.includes(absent),"removed from CSS: "+absent);
  }
  assert.ok(!localization.includes("standingsMobileMatches:"));
  assert.ok(runtime.includes("window.faStandingsMobile = mobile"));
  assert.ok(runtime.includes("const commitMobile = mobile.prepare(provisional)"));
  assert.ok(client.includes("const commitMobile = mobile.prepare(rows)"));
  assert.ok(client.indexOf("const commitMobile = mobile.prepare(rows)") <
    client.indexOf("tbody.replaceChildren(fragment)"));
  assert.ok(client.indexOf("tbody.replaceChildren(fragment)") < client.indexOf("commitMobile();"));
  assert.ok(css.includes("@media(max-width:360px)"));
  assert.ok(css.includes(".app-world-standings [hidden]"));
  assert.ok(!read("app/competitions/_shared/manifest.json").toString().includes("standingsPreview"));
});

test("UX-01A integration: approved division logos and theme rebind survive mobile hydration", () => {
  const runtime = read("assets/competition-page.js").toString();
  const theme = read("assets/theme.js").toString();
  const css = read("assets/app.css").toString();
  const manifest = JSON.parse(read("app/competitions/_shared/manifest.json").toString());
  assert.ok(runtime.includes("withMobileShell(standings.outerHTML)"));
  assert.ok(runtime.includes("window.faThemeRebind?.()"));
  assert.ok(!runtime.includes("visualAsset"));
  assert.ok(!runtime.includes("badge.replaceChildren"));
  assert.ok(!runtime.includes("document.body.innerHTML ="));
  assert.ok(!theme.includes("data-division-logo"));
  assert.ok(css.includes('html[data-theme="light"] .app-world-mobile-points'));
  assert.equal(manifest.divisions.length, 16);
  assert.equal(manifest.approved, false);
  for (const division of manifest.divisions)
    assert.equal(division.clubs.length, 16);
});

test("DEV-WIDGET: movable local-only control and clean standings page",()=>{
 assert.ok(widget.includes("export function createDebugWidget("));
 assert.ok(client.includes('import { createDebugWidget, registerDebugControls } from "./debug-widget.mjs";'));
 assert.ok(client.includes('id:"fictional-standings",label:"Fictional standings"'));
 assert.ok(client.includes('caption.dataset.appI18n="standingsFilledCaption"'));
 assert.ok(client.includes("window.faAppRenderLanguage?.()"));
 assert.ok(!client.includes("standingsPreview"));
 assert.ok(!client.includes("fa-dev-preview-toolbar"));
 assert.ok(!client.includes("fa-dev-preview-label"));
 assert.ok(!client.includes("fa-dev-preview-exit"));
 for(const event of ["pointerdown","pointermove","pointerup","pointercancel",
   "click","keydown","resize","change"]){
  assert.ok(widget.includes('"'+event+'"'),event);
 }
 assert.ok(widget.includes("setPointerCapture"));
 assert.ok(widget.includes("suppressClick"));
 assert.ok(widget.includes('role","switch"'));
 assert.ok(!isAllowlistedPublicPath("tools/dev-debug-widget.mjs"));
 assert.ok(!planPublicFiles().includes("tools/dev-debug-widget.mjs"));
});
test("DEV-M01: mount the Debug widget only after competition hydration", { timeout: 10000 }, async () => {
  const runtime = read("assets/competition-page.js").toString();
  assert.ok(runtime.includes("standings.outerHTML=withMobileShell(standings.outerHTML)"));
  const start = client.indexOf("if(validPath){");
  const end = client.indexOf("\nfunction strings()", start);
  assert.ok(start >= 0 && end > start, "DEV initialization block missing");
  const initializer = client.slice(start, end);
  assert.ok(initializer.includes("waitForRows().then("));
  assert.ok(!initializer.includes("createDebugWidget({controls:[{") ||
    initializer.indexOf("waitForRows().then(") < initializer.indexOf("createDebugWidget({controls:[{"));
  for (const enabled of [false, true]) {
    let hydrate, signalMounted;
    const hydration = new Promise(resolve => { hydrate = resolve; });
    const widgetMounted = new Promise(resolve => { signalMounted = resolve; });
    const operations = [];
    runInNewContext(initializer, {
      validPath: ["/app/competitions/it-1/", "it-1"],
      window: {faCompetitionRoute:{subscribe(){}},addEventListener(){}},
      selectedSeason: () => 1,
      syncHistoryPreview: () => {},
      savedPreviewEnabled: () => enabled,
      document: {documentElement:{dataset:{}},querySelector:()=>null},
      waitForRows: () => hydration,
      createDebugWidget: () => { operations.push("widget"); signalMounted(); return {syncVisibility(){}}; },
      registerDebugControls: () => {},
      isPreviewEnabled: () => enabled,
      setPreviewEnabled: () => { operations.push("toggle"); return Promise.resolve(true); },
      matchdays: 15,
      setMatchdays: () => Promise.resolve(true),
      resetPreview: () => Promise.resolve(true),
      Array,
      boot: division => operations.push("boot:" + division),
      console: { error: error => { throw error; } }
    });
    assert.deepEqual(operations, [], "widget must not mount before hydration");
    hydrate();
    await widgetMounted;
    if (enabled) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(operations, enabled ? ["widget", "toggle"] : ["widget"]);
  }
});

test("UX-02..08: DEV switch lifecycle and rollback contracts",()=>{
 assert.ok(!client.includes("location.reload()"));
 assert.ok(client.includes("transition=transition.catch(()=>false).then(async()=>"));
 assert.ok(client.includes("activePreview=cleanup"));
 assert.ok(client.includes("return restore"));
 assert.ok(client.includes("tbody.replaceChildren(...canonicalRows)"));
 assert.ok(client.includes("mobileList.replaceChildren(...canonicalMobile)"));
 assert.ok(client.includes("languageObserver.disconnect()"));
 assert.ok(client.includes("listeners.abort()"));
 assert.ok(client.includes("signal:listeners.signal"));
 assert.ok(client.includes("sessionStorage.setItem(FLAG"));
 assert.ok(client.includes("sessionStorage.removeItem(FLAG"));
 assert.ok(widget.includes("input.disabled=true"));
 assert.ok(widget.includes("await control.onChange(desired)"));
 assert.ok(widget.includes('html[data-theme="light"]'));
 assert.ok(widget.includes("<svg"));
});


test("DEV modular registry and adaptive panel contracts",()=>{
 assert.ok(widget.includes("export function registerDebugControls("));
 assert.ok(widget.includes("export function getDebugControls("));
 assert.ok(widget.includes("fa-dev-widget-section"));
 assert.ok(widget.includes("fa-dev-widget-backdrop"));
 assert.ok(widget.includes("safe-area-inset-bottom"));
 assert.ok(widget.includes("touchend"));
 assert.ok(widget.includes("SECTIONS_KEY"));
 assert.ok(client.includes('id:"reset-page"'));
 assert.ok(client.includes('id:"reset-global"'));
 assert.ok(client.includes('registerDebugControls("standings"'));
});


test("DEV-M03: matchday slider visibility, first paint value and matchdays 0–4",()=>{
 assert.ok(client.includes('type:"range",id:"matchdays",label:"Matchdays",min:0,max:30,step:1'));
 assert.ok(client.includes('visible:()=>previewState==="ON"'));
 assert.ok(widget.includes('input.type="range"'));
 for(const days of [0,1,2,3,4,30]){
  const model=createPreviewStandings(manifest.divisions[0],days);
  assert.equal(model.fixtures.length,days*8,"fixture count for "+days);
  for(const row of model.rows){assert.equal(row.played,days);assert.equal(row.won+row.drawn+row.lost,days);assert.equal(row.recent.length,Math.min(5,days))}
 }
 assert.ok(client.includes('value:()=>matchdays,visible:()=>previewState==="ON"'));
 assert.ok(client.includes("widgetRoot?.syncVisibility()"));
 assert.ok(client.includes("const matchdayRow=document.querySelector"));
 assert.ok(widget.includes("root.syncVisibility=()=>"));
 assert.ok(client.includes('activePreview=()=>{try{replacement()}finally{previous()}}'));
 const mobileRuntime=read("assets/competition-page.js").toString();
 assert.ok(mobileRuntime.includes("row.recent.length !== Math.min(5,row.played)"),
  "mobile standings must accept exactly the available recent results for 1–4 matchdays");
 for(const days of [1,2,3,4]){
  const model=createPreviewStandings(manifest.divisions[0],days);
  assert.ok(model.rows.every(row=>row.recent.length===days),
   "recent form should contain "+days+" results");
 }
});

test("DEV-LAN: LAN access is opt-in and limited to private IPv4 clients and hosts",()=>{
 const serverSource = read("tools/dev-standings-preview.mjs").toString();
 assert.ok(serverSource.includes('process.env.FA_DEV_LAN === "1"'));
 assert.ok(serverSource.includes('const HOST = LAN_ENABLED ? "0.0.0.0" : LOOPBACK'));
 assert.ok(serverSource.includes("function isPrivateIPv4(value)"));
 assert.ok(serverSource.includes("if (!isLoopback(remote) && !(!subdomains && LAN_ENABLED && isPrivateIPv4(remote)))"));
 assert.ok(serverSource.includes("if (!allowedHost(req.headers.host, subdomains))"));
 assert.ok(serverSource.includes('"LAN opt-in"'));
});

test("DEV-MATCHDAYS-TEXT: number input shares 0–30 validation, visibility and persistence with slider",()=>{
 assert.ok(widget.includes('"number"'));
 assert.ok(widget.includes('input.type="number"'));
 assert.ok(widget.includes('input.inputMode="numeric"'));
 assert.ok(widget.includes('!Number.isInteger(value)||value<Number(input.min)||value>Number(input.max)'));
 assert.ok(widget.includes('number.dataset.devControl="matchdays-number"'));
 assert.ok(client.includes("for(const input of [slider,number].filter(Boolean))"));
 assert.ok(client.includes("const matchdayRow=document.querySelector"));
 assert.ok(client.includes('visible:()=>previewState==="ON",onChange:setMatchdays'));
 assert.ok(client.includes('sessionStorage.setItem(ROUNDS_KEY,String(value))'));
 for(const invalid of [-1,31,1.5,NaN]) assert.equal(Number.isInteger(invalid)&&invalid>=0&&invalid<=30,false);
});

test("DEV-MATCHDAYS-STYLE: numeric input occupies the former slider output position",()=>{
 assert.ok(widget.includes('row.append(input,numberWrap)'));
 assert.ok(widget.includes('const spin=element("span","fa-dev-number-spin")'));
 assert.ok(widget.includes('element("button","fa-dev-number-arrow")'));
 assert.ok(widget.includes('number.dataset.devControl="matchdays-number"'));
 assert.ok(client.includes('type:"range",id:"matchdays",label:"Matchdays",min:0,max:30,step:1'));
 assert.ok(!client.includes('id:"matchdays-number"'),"no separate numeric row");
 assert.ok(client.includes('const number=document.querySelector(\'[data-dev-control="matchdays-number"]\')'));
 assert.ok(widget.includes("scrollbar-width:thin;scrollbar-color:var(--scroll-thumb"));
 assert.ok(widget.includes("@keyframes fa-dev-panel-in"));
 assert.ok(widget.includes("prefers-reduced-motion:reduce"));
 assert.ok(widget.includes("input[type=number]::-webkit-inner-spin-button"));
 assert.ok(widget.includes("var(--surface-raised"));
});


test("STANDINGS-UX-01C: localized recent-form controls remain accessible and DEV-only",()=>{
 const client=read("tools/dev-standings-preview-client.mjs").toString();
 const mobile=read("assets/competition-page.js").toString();
 const css=read("assets/app.css").toString();
 for(const [locale,letters] of Object.entries({
  en:'letters: {W:"W",D:"D",L:"L"}',
  de:'letters: {W:"S",D:"U",L:"N"}',
  es:'letters: {W:"V",D:"E",L:"D"}',
  fr:'letters: {W:"V",D:"N",L:"D"}',
  it:'letters: {W:"V",D:"N",L:"P"}'
 }))assert.ok(client.includes(letters),"localized result letters: "+locale);
 assert.ok(client.includes('button.setAttribute("aria-haspopup","true")'));
 assert.ok(client.includes('entry.glyph.textContent = t.letters[entry.game.result]'));
 assert.ok(client.includes('entry.button.setAttribute("aria-label", t[entry.game.result]'));
 assert.ok(client.includes('index === 0 ? " app-world-form-last"'));
 assert.ok(mobile.includes('mark.dataset.appI18n = formLetterKeys[game.result]'));
 assert.ok(mobile.includes('"standingsDemoWinLetter"'));
 assert.ok(css.includes(".app-world-form-strip .app-world-form-control{width:18px;height:18px;border-radius:5px}"));
 assert.ok(css.includes(".app-world-form-strip .app-world-form-control + .app-world-form-control{margin-left:-4px}"));
 assert.ok(css.includes("width:15px;height:15px;border-radius:4px;font-size:9px"));
 assert.ok(css.includes(".app-world-form-control:focus-visible"));
 assert.ok(css.includes(".app-world-form-control.app-world-form-last .app-world-form-glyph"));
 assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"));
 assert.ok(client.includes('const FLAG = "football-architect:standings-dev-preview"'));
 assert.ok(client.includes("function isPreviewEnabled()"));
 assert.ok(read(".github/workflows/landing-checks.yml").toString().includes("node --test --test-concurrency=1 tests/*.test.mjs"));
});


test("STANDINGS-UX-01D: result tooltips adapt to long names and constrained viewports",()=>{
 const css=read("assets/app.css").toString();
 const client=read("tools/dev-standings-preview-client.mjs").toString();
 const publicRuntime=read("assets/competition-page.js").toString();
 assert.ok(css.includes("min-height:clamp(100px,29vw,114px);height:auto;max-height:min(60vh,260px);aspect-ratio:auto"));
 assert.ok(css.includes("overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain"));
 assert.ok(css.includes(".app-world-form-tooltip-team{min-width:0;overflow-wrap:anywhere;white-space:normal;font-weight:700}"));
 for(const field of ["game.homeGoals","game.awayGoals","game.homeId","game.awayId","game.round","game.isHome"])
  assert.ok(client.includes(field),"tooltip retains real DEV match metadata: "+field);
 assert.ok(client.includes("const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124") ||
  client.includes("const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;"),
  "positioning measures the adaptive tooltip dimensions");
 assert.ok(publicRuntime.includes("if (!demoFormTriggers.length) return"));
 assert.ok(!publicRuntime.includes("data-dev-control"),"DEV controls remain isolated from public rendering");
});


test("STANDINGS-UX-01D: mobile compact form keeps its appearance and opens tooltips on tap",()=>{
 const client=read("tools/dev-standings-preview-client.mjs").toString();
 const canonical=read("assets/competition-page.js").toString();
 assert.ok(client.includes('item.querySelectorAll(".app-world-mobile-form .app-world-form-dot")'));
 assert.ok(client.includes('if(entry.mobile){e.preventDefault();e.stopPropagation();}'));
 assert.ok(client.includes('[...entries,...mobileEntries]'));
 assert.ok(canonical.includes('element("span","app-world-form-dot app-world-form-"'));
 assert.ok(!client.includes('node("button","app-world-form-dot app-world-form-control app-world-form-"'));
});

test("DEV-FIXTURES-READY: restored preview waits for Fixtures runtime as well as standings rows",async()=>{
 const start=client.indexOf('function waitForRows() {'),end=client.indexOf('\nasync function boot(',start);
 const body={rows:Array.from({length:16},()=>({}))};
 let notify,settled=false;
 const window={};
 const context={window,document:{documentElement:{},getElementById:()=>body,querySelector:()=>({})},
  MutationObserver:class{constructor(fn){notify=fn}observe(){}disconnect(){}},setTimeout,clearTimeout};
 const wait=runInNewContext(client.slice(start,end)+'\nwaitForRows',context);
 const pending=wait().then(value=>{settled=true;return value});
 await new Promise(resolve=>setImmediate(resolve));
 const early=settled;
 window.faCompetitionRoute={get(){}};window.faFixtures={prepare(){},snapshot(){}};
 notify();
 assert.equal(await pending,body);
 assert.equal(early,false,'standings rows alone must not release initial DEV hydration');
});


test('STANDINGS-TOOLTIP-DATE: supplied kickoff is localized and missing dates stay unknown',()=>{
 const start=client.indexOf('function formatMatchDate('),end=client.indexOf('\nfunction node(',start);
 assert.ok(start>=0&&end>start,'tooltip date formatter exists');
 const format=runInNewContext(client.slice(start,end)+';formatMatchDate');
 assert.equal(format({},'en'),null);
 assert.equal(format({kickoff:null},'it'),null);
 assert.equal(format({kickoff:'invalid'},'en'),null);
 const kickoff='2026-10-20T12:30:00Z';
 for(const lang of ['en','it','de','es','fr'])assert.equal(format({kickoff},lang),new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(kickoff)));
});


test("HISTORY-DEV-01: History preview is gated by local DEV settings and derives its sections from deterministic seasons",()=>{
 const client=read("tools/dev-standings-preview-client.mjs").toString(),html=read("app/competitions/_shared/index.html").toString(),css=read("assets/app.css").toString();
 assert.match(client,/function renderHistoryPreview\(\)/);
 assert.match(client,/if\(!isPreviewEnabled\(\)\)\{clearHistoryPreview\(\);return\}/);
 assert.match(client,/createPreviewStandings\(division,30,season\)/);
 for(const key of ["historySeasonArchive","historyHistoricalRecords","historyMostTitles","historyMostPodiums","historyLongestTitleStreak"])assert.ok(client.includes(key),key);
 assert.match(client,/clearHistoryPreview\(\)/);assert.match(html,/<section id="competition-panel-history"/);assert.match(css,/\.app-competition-stat-grid/);
 assert.equal(isAllowlistedPublicPath("tools/dev-standings-preview-client.mjs"),false);assert.equal(isAllowlistedPublicPath("tools/dev-standings-preview-data.mjs"),false);
});
