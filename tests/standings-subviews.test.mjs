import test from 'node:test';
import assert from 'node:assert/strict';
import {projectStandings,STANDINGS_SUBVIEWS} from '../assets/standings-subviews.mjs';

const A={countryId:'IT',clubId:1,primaryName:'Alpha'};
const B={countryId:'IT',clubId:2,primaryName:'Bravo'};
const definition={category:'domestic',metrics:{phases:{league:{rounds:30}}}};
const fixture=(round,homeId,awayId,homeGoals,awayGoals)=>({
  phaseId:'league',round,day:round,sourceFixtureId:'fixture-'+round,
  homeId,awayId,homeGoals,awayGoals
});
const fixtures=[
  fixture(30,2,1,2,2),fixture(1,1,2,2,1),
  fixture(26,1,2,4,0),fixture(14,2,1,0,1),
  fixture(4,2,1,0,0),fixture(16,1,2,1,3),
  {...fixture(31,1,2,10,0),phaseId:'playoff'}
];
const rows=[
  {club:A,position:1,played:6,won:3,drawn:2,lost:1,gf:10,ga:6,gd:4,pts:11,recent:[]},
  {club:B,position:2,played:6,won:1,drawn:2,lost:3,gf:6,ga:10,gd:-4,pts:5,recent:[]}
];
const a=(mode)=>projectStandings(rows,fixtures,definition,mode).find(row=>row.club.clubId===1);

test('overall stays authoritative; no mutation of input rows or official positions',()=>{
  assert.deepEqual(STANDINGS_SUBVIEWS,['overall','first','second','home','away','last5']);
  assert.strictEqual(projectStandings(rows,fixtures,definition,'overall'),rows);
  a('home');assert.equal(rows[0].pts,11);assert.equal(rows[0].position,1);
});
test('first/second half use rounds 1–15/16–30, not home vs away',()=>{
  assert.deepEqual([a('first').played,a('first').won,a('first').drawn,a('first').lost,a('first').pts],[3,2,1,0,7]);
  assert.deepEqual([a('second').played,a('second').won,a('second').drawn,a('second').lost,a('second').pts],[3,1,1,1,4]);
});
test('home and away use perspective and only played league fixtures',()=>{
  assert.deepEqual([a('home').played,a('home').gf,a('home').ga,a('home').pts],[3,7,4,6]);
  assert.deepEqual([a('away').played,a('away').gf,a('away').ga,a('away').pts],[3,3,2,5]);
  assert.deepEqual(a('away').recent.map(x=>x.round),[30,14,4]);
});
test('last five are per-club, recent first, without playoff scores',()=>{
  const r=a('last5');
  assert.deepEqual([r.played,r.won,r.drawn,r.lost,r.gf,r.ga,r.pts],[5,2,2,1,8,5,8]);
  assert.deepEqual(r.recent.map(x=>x.round),[30,26,16,14,4]);
  assert.deepEqual(r.recent.map(x=>x.result),['D','W','L','W','D']);
});
test('unplayed fixtures never count, but all confirmed 0-match entrants remain',()=>{
  const scheduled=[fixture(1,1,2,null,null)];
  const empty=rows.map(r=>({...r,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0}));
  const result=projectStandings(empty,scheduled,definition,'home');
  assert.deepEqual(result.map(r=>[r.club.clubId,r.played,r.pts]),[[1,0,0],[2,0,0]]);
});
test('reconciliation rejects missing scores and invalid result evidence',()=>{
  assert.equal(projectStandings(rows,fixtures.slice(1),definition,'home'),null);
  assert.equal(projectStandings(rows,[...fixtures,fixture(28,1,2,1,null)],definition,'home'),null);
  assert.equal(projectStandings(rows,[...fixtures,fixtures[0]],definition,'last5'),null);
});
test('international cups expose location/form splits but not fictitious halves',()=>{
  const cup={category:'international',metrics:{phases:{league:{rounds:6}}}};
  const internationalRows=rows.map(row=>({...row,club:{...row.club},recent:[]}));
  assert.equal(projectStandings(internationalRows,[],cup,'first'),null);
  assert.equal(projectStandings(internationalRows,[],cup,'second'),null);
  const noGames=internationalRows.map(row=>({...row,played:0,gf:0,ga:0}));
  assert.equal(projectStandings(noGames,[],cup,'home')?.length,2);
});
