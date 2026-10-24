import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolveSubpage,competitionSubpage,clubSubpage} from "../assets/subpage-routes.mjs";
import * as routes from "../assets/routes-registry.mjs";
const {countries,competitionViews,clubViews}=routes;
const raw=readFileSync(new URL("../vercel.json",import.meta.url));
const blobHash=buf=>createHash("sha1").update(Buffer.from("blob "+buf.length+"\0")).update(buf).digest("hex");
test("A03-01: exact hosting bytes and complete ordered rule fixture (29 redirects, 7 rewrites)",()=>{
 assert.equal(blobHash(raw),"b8afd0babb019680223c39be48e659f92aae39a5");
 const config=JSON.parse(raw);
 assert.equal(config.redirects.length,29);assert.equal(config.rewrites.length,7);
 assert.deepEqual(config.redirects,[{"source":"/clubs/","destination":"/clubs","permanent":true},{"source":"/clubs/index.html","destination":"/clubs","permanent":true},{"source":"/:page(dashboard|calendar|settings|competitions)/","destination":"/:page","permanent":true},{"source":"/:page(dashboard|calendar|settings|competitions)/index.html","destination":"/:page","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/index.html","destination":"/competitions/:division","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/overview","permanent":true},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)/","destination":"/competitions/:division/:view","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/stats","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/stats","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"overview"}],"destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"roster"}],"destination":"/clubs/:country/:club/roster","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"fixtures"}],"destination":"/clubs/:country/:club/fixtures","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"stats"}],"destination":"/clubs/:country/:club/stats","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","has":[{"type":"query","key":"view","value":"history"}],"destination":"/clubs/:country/:club/history","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/index.html","destination":"/clubs/:country/:club/overview","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|stats|history)/","destination":"/clubs/:country/:club/:view","permanent":true},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|stats|history)/index.html","destination":"/clubs/:country/:club/:view","permanent":true},{"source":"/competitions/:cup(int-1|int-2)/:view(standings|postseason|fixtures|stats|history|rules|awards)/","destination":"/competitions/:cup/:view","permanent":true}]);
 assert.deepEqual(config.rewrites,[{"source":"/clubs","destination":"/clubs/index.html"},{"source":"/:page(dashboard|calendar|settings|competitions)","destination":"/:page/index.html"},{"source":"/competitions/_shared/:file(index.html|manifest.json)","destination":"/competitions/_shared/:file"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])","destination":"/competitions/:division/index.html"},{"source":"/competitions/:division((?:it|eng|es|de|fr|pt|nl|br)-[12])/:view(overview|standings|postseason|fixtures|stats|history|rules|awards|teams)","destination":"/competitions/:division/index.html"},{"source":"/competitions/:cup(int-1|int-2)/:view(standings|postseason|fixtures|stats|history|rules|awards)","destination":"/competitions/:cup/index.html"},{"source":"/clubs/:country(it|eng|es|de|fr|pt|nl|br)/:club([1-9]|[1-3][0-9]|40)/:view(overview|roster|fixtures|stats|history)","destination":"/clubs/_shared/index.html"}]);
});
test("A03-02: legacy ROUTE-02 API and identity coverage unchanged",()=>{
 for(const c of countries)for(const tier of [1,2])for(const view of competitionViews){
 const id=c+"-"+tier,path="/competitions/"+id+"/"+view;
 assert.deepEqual(resolveSubpage(path),{kind:"competition",base:"/competitions/"+id,view,canonical:path,redirect:false});
 assert.equal(competitionSubpage(id,view),path);
 }
 for(const c of countries)for(let n=1;n<=40;n++)for(const view of clubViews){
 const path="/clubs/"+c+"/"+n+"/"+view;
 assert.deepEqual(resolveSubpage(path),{kind:"club",base:"/clubs/"+c+"/"+n,view,canonical:path,redirect:false});
 assert.equal(clubSubpage(c,String(n),view),path);
 }
});

test("A03-04B: generated domestic cards retain canonical hrefs",()=>{
 const source=readFileSync(new URL("../competitions/index.html",import.meta.url),"utf8");
 for(const c of countries)for(const tier of [1,2]){
  const id=c+"-"+tier;
  assert.ok(source.includes('href="'+routes.buildRoute({kind:"competition",id,view:"standings"})+'?season=1"'),id);
 }
});

import {readdirSync} from 'node:fs';
test('A03-04D: generated route bootstrap loads once before every deferred consumer',()=>{
 const expected=['calendar/index.html','clubs/index.html','clubs/_shared/index.html','competitions/index.html','competitions/_shared/index.html',...readdirSync(new URL('../competitions/',import.meta.url)).filter(p=>/^(?:(?:it|eng|es|de|fr|pt|nl|br)-[12]|int-[12])$/.test(p)).map(p=>'competitions/'+p+'/index.html')];
 assert.equal(expected.length,23);
 for(const path of expected){
  const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const deferred=[...html.matchAll(/<script\b[^>]*\bdefer\b[^>]*>/g)].map(m=>m[0]);
  assert.equal(deferred[0],'<script src="/assets/routes-registry.js" defer>',path);
  assert.equal(html.split('src="/assets/routes-registry.js"').length-1,1,path);
 }
 for(const path of ['dashboard/index.html','settings/index.html'])assert.ok(!readFileSync(new URL('../'+path,import.meta.url),'utf8').includes('/assets/routes-registry.js'),path);
});
