import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {readClubCompetitionCatalogue} from '../assets/club-competition-catalogue.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json=path=>JSON.parse(read(path));
const model=createRequire(import.meta.url)(new URL('../assets/competition-model.js',import.meta.url).pathname);

test('PERF-API-657 Club Fixtures transport expands the compact catalogue to exact canonical sporting definitions',async()=>{
 const paths=[];
 const result=await readClubCompetitionCatalogue({
  fetchJson:async path=>{paths.push(path);return json(path.slice(1));},
  loadModel:async()=>model
 });
 assert.deepEqual(paths,['/competitions/_shared/compact.json']);
 assert.deepEqual(result,json('competitions/_shared/manifest.json'));
 assert.equal(model.validManifest(result),true);
 assert.equal(result.competitions.length,18);
 assert.equal(result.divisions.flatMap(d=>d.clubs).length,256);
 assert.deepEqual(result.clubCrests,json('competitions/_shared/manifest.json').clubCrests);
 assert.ok(Buffer.byteLength(read('competitions/_shared/compact.json'))<
  Buffer.byteLength(read('competitions/_shared/manifest.json'))*0.6,
  'compact static response must provide a material raw transfer reduction');
});

test('PERF-API-657 Club Fixtures rejects missing model and tampered static definitions without falling back to full manifest',async()=>{
 const compact=json('competitions/_shared/compact.json');
 const seen=[];
 const fetchJson=async path=>{seen.push(path);return compact;};
 await assert.rejects(readClubCompetitionCatalogue({fetchJson,loadModel:async()=>null}),/validator/);
 const altered=structuredClone(compact);
 altered.clubCrests['ES-2']='assets/clubs/ES/1/crest.svg';
 await assert.rejects(readClubCompetitionCatalogue({
  fetchJson:async path=>{seen.push(path);return altered;},loadModel:async()=>model
 }),/Invalid|Unverified/);
 await assert.rejects(readClubCompetitionCatalogue({
  fetchJson:async path=>{seen.push(path);return {bad:true};},loadModel:async()=>model
 }),/Invalid/);
 assert.deepEqual(seen,Array(3).fill('/competitions/_shared/compact.json'));
});

test('PERF-API-657 Club Fixtures remains lazy and Club History stays on one authoritative aggregate',()=>{
 const fixtures=read('assets/club-fixtures-controller.mjs');
 const history=read('assets/club-history-source.mjs');
 const clubPage=read('assets/club-page.js');
 assert.match(fixtures,/readClubCompetitionCatalogue\(/);
 assert.match(fixtures,/import\('\/assets\/competition-model\.js'\)/);
 assert.doesNotMatch(fixtures,/fetch\('\/competitions\/_shared\/manifest\.json'/);
 assert.match(fixtures,/current\.worldStatus!=='ready'/);
 assert.match(clubPage,/await import\('\/assets\/club-fixtures-controller\.mjs'\)/);
 assert.match(history,/fetchJson\('\/api\/clubs\/'\+clubKey\+'\/history'/);
 assert.doesNotMatch(history,/fetchJson\('\/api\/competitions\//);
});
