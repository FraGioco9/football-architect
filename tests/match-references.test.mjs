import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicMatchId,isCompetitionId,referenceFromPublicMatch,indexPublishedCompetitionMatches}
 from '../assets/match-references.mjs';

const published={
 schemaVersion:1,providerId:'authoritative-world',status:'published',
 season:3,competitionId:'IT-1',provenance:{kind:'authoritative',sourceHash:'receipt'},
 fixtures:[
  {matchId:'123',phaseId:'league',day:4,round:2,homeClubId:'IT-1',result:{homeGoals:7}},
  {matchId:'124',phaseId:'playout',day:55,round:31,participantA:{kind:'leagueRank',rank:13}}
 ]
};
test('#577 references: official competition collection contains immutable IDs, no game data',()=>{
 const indexed=indexPublishedCompetitionMatches(published);
 assert.equal(indexed.references.length,2);
 assert.deepEqual(indexed.byMatchId['123'],{matchId:'123',season:3,competitionId:'IT-1',phaseId:'league',day:4,round:2});
 assert.equal(indexed.byMatchId['124'].phaseId,'playout');
 assert.equal(indexed.byMatchId['125'],undefined);
 assert.equal(Object.getPrototypeOf(indexed.byMatchId),null);
 assert.ok(Object.isFrozen(indexed.byMatchId)&&Object.isFrozen(indexed.references)&&Object.isFrozen(indexed.byMatchId['123']));
 assert.equal('result' in indexed.byMatchId['123'],false);
 assert.equal('homeClubId' in indexed.byMatchId['123'],false);
});
test('#577 references: bad IDs, unpublished competitions and duplicates fail closed',()=>{
 for(const id of ['0','01','-1','1.5','9007199254740992','<script>',123])assert.equal(isPublicMatchId(id),false);
 assert.equal(isPublicMatchId('123'),true);
 assert.equal(isCompetitionId('IT-1'),true);
 assert.equal(isCompetitionId('int-2'),true);
 assert.equal(isCompetitionId('XX-1'),false);
 for(const malformed of [
  {...published,status:'draft'},
  {...published,provenance:{kind:'dev'}},
  {...published,competitionId:'XX-1'},
  {...published,fixtures:[published.fixtures[0],published.fixtures[0]]},
  {...published,fixtures:[{...published.fixtures[0],matchId:'99999999999999999'}]},
  {...published,fixtures:[{...published.fixtures[0],day:90}]},
  {...published,fixtures:[]}
 ])assert.throws(()=>indexPublishedCompetitionMatches(malformed),TypeError);
});
test('#577 references: individual projection verifies expected ID and authoritative provenance',()=>{
 const detail={schemaVersion:1,providerId:'authoritative-world',matchId:'123',
  season:3,competitionId:'IT-1',stageId:'league',round:2,day:4,
  status:'completed',result:{homeGoals:2,awayGoals:1},
  provenance:{kind:'authoritative'}};
 assert.deepEqual(referenceFromPublicMatch(detail,'123'),published&&
  {matchId:'123',season:3,competitionId:'IT-1',phaseId:'league',round:2,day:4});
 assert.equal(referenceFromPublicMatch(detail,'124'),null);
 assert.equal(referenceFromPublicMatch({...detail,provenance:{kind:'temporary'}},'123'),null);
 assert.equal(referenceFromPublicMatch({...detail,matchId:'0123'}),null);
 assert.equal(referenceFromPublicMatch({...detail,competitionId:'unknown'}),null);
});
