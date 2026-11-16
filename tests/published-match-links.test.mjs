import test from 'node:test';
import assert from 'node:assert/strict';
import {indexPublishedMatchLinks,matchIdForFixture} from '../assets/published-match-links.mjs';

const season=2,competitionId='IT-1';
const league={matchId:'15',sourceFixtureId:'season:2:IT-1:N01:IT-1:IT-2',
 phaseId:'league',marker:'N01',day:13,round:1,homeClubId:'IT-1',awayClubId:'IT-2'};
const knockout={matchId:'16',sourceFixtureId:null,phaseId:'playout',tieId:'tie13',leg:1,
 marker:'N31',day:52,round:31,homeClubId:null,awayClubId:null};
const packet={schemaVersion:1,providerId:'authoritative-world',season,competitionId,
 status:'published',provenance:{kind:'authoritative'},fixtures:[league,knockout]};
const row={season,competitionId,sourceFixtureId:league.sourceFixtureId,
 phaseId:'league',day:13,round:1,marker:'N01'};
test('#605 published link index preserves official league and knockout identities',()=>{
 const index=indexPublishedMatchLinks(packet,season,competitionId);
 assert.equal(matchIdForFixture(row,index),'15');
 assert.equal(matchIdForFixture({season,competitionId,phaseId:'playout',tieId:'tie13',leg:1,day:52,marker:'N31'},index),'16');
 assert.equal(matchIdForFixture({...row,day:14},index),null);
 assert.equal(matchIdForFixture({...row,season:1},index),null);
 assert.equal(matchIdForFixture({...row,competitionId:'IT-2'},index),null);
 assert.equal(matchIdForFixture({...row,sourceFixtureId:'season:2:IT-1:N01:IT-2:IT-1'},index),null);
 assert.equal(matchIdForFixture({...row,sourceFixtureId:null},index),null);
 assert.equal(matchIdForFixture({season,competitionId,phaseId:'playout',tieId:'tie13',leg:2,day:52},index),null);
 assert.equal(Object.getPrototypeOf(index.bySource),null);
 assert.ok(Object.isFrozen(index.bySource)&&Object.isFrozen(index.bySlot)&&Object.isFrozen(index.byId));
});
test('#605 index fails closed for unpublished, spoofed, duplicated or stale collections',()=>{
 for(const data of [
  {...packet,status:'unpublished'},
  {...packet,provenance:{kind:'dev'}},
  {...packet,season:3},
  {...packet,competitionId:'IT-2'},
  {...packet,fixtures:[league,league]},
  {...packet,fixtures:[{...league,matchId:'01'}]},
  {...packet,fixtures:[{...league,sourceFixtureId:'other'}]},
  {...packet,fixtures:[knockout,{...knockout,matchId:'17'}]},
  {...packet,fixtures:[{...knockout,sourceFixtureId:'rogue'}]},
  {...packet,fixtures:[{...league,day:0}]}
 ])assert.throws(()=>indexPublishedMatchLinks(data,season,competitionId),TypeError);
});
