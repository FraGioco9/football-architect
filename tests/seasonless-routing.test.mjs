import test from 'node:test';
import assert from 'node:assert/strict';
import routes from '../assets/routes-registry.js';
import fixtures from '../assets/club-fixtures.js';

test('#531 shared season resolver leaves missing values implicit and keeps explicit valid links',()=>{
 for(const search of ['', '?view=stats', '?matchday=7']){
  const result=routes.resolveSeasonQuery(search,2);
  assert.equal(result.season,2);
  assert.equal(result.explicit,false);
  assert.equal(result.remove,false);
 }
 for(const [search,season] of [['?season=1',1],['?season=2',2]]){
  const result=routes.resolveSeasonQuery(search,2);
  assert.equal(result.season,season);
  assert.equal(result.explicit,true);
  assert.equal(result.remove,false);
 }
});

test('#531 invalid or unavailable seasons are removed without suppressing canonical current',()=>{
 for(const raw of ['', '-1','01','2.0','2e0','NaN','bad','999999999','3','0']){
  const parsed=routes.resolveSeasonQuery('?season='+encodeURIComponent(raw)+'&view=fixtures',2);
  assert.equal(parsed.season,2,raw);
  assert.equal(parsed.remove,true,raw);
  assert.equal(parsed.explicit,false,raw);
 }
 assert.deepEqual(routes.resolveSeasonQuery('?season=0',0,{min:0}).season,0);
 assert.equal(routes.resolveSeasonQuery('?season=1',0).season,1,'Season 0 still exposes the supported provisional Season 1');
 const pending=routes.resolveSeasonQuery('?season=2',null);
 assert.equal(pending.season,2);
 assert.equal(pending.explicit,true,'Do not discard a future permalink before verifying the world');
 assert.equal(routes.resolveSeasonQuery('',null).season,null);
});

test('#531 link builder preserves unrelated parameters and fragments',()=>{
 assert.equal(routes.withSeason('/competitions/it-1/fixtures?matchday=7#top',2,2),'/competitions/it-1/fixtures?matchday=7#top');
 assert.equal(routes.withSeason('/competitions/it-1/fixtures?matchday=7#top',1,2),'/competitions/it-1/fixtures?season=1&matchday=7#top');
 assert.equal(routes.withSeason('/competitions/it-1/stats?view=old&source=qa#top',2,2,{preserveExplicit:true}),'/competitions/it-1/stats?season=2&view=old&source=qa#top');
});

test('#531 Club Fixtures uses the canonical current and no remembered stale selection',()=>{
 assert.equal(fixtures.resolveSeason({current:2,requested:null}).season,2);
 assert.equal(fixtures.resolveSeason({current:2,requested:'1'}).season,1);
 assert.equal(fixtures.resolveSeason({current:2,requested:'2'}).season,2);
 assert.equal(fixtures.resolveSeason({current:2,requested:'3'}).season,2);
 assert.equal(fixtures.resolveSeason({current:2,requested:'invalid'}).season,2);
 assert.equal(fixtures.resolveSeason({current:0,requested:null}).season,1);
 assert.equal(fixtures.resolveSeason({current:null,requested:'3'}).season,null);
});
