import {beforeAll,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {readWorld} from '../src/world-repository.ts';
import {
 buildLineupArchiveDigestV1,summarizeFrozenLineupPlayersV1,
 verifyLineupSeasonArchiveV1
} from '../src/lineup-season-archive-proof.ts';
import {archiveSeasonLineupV1} from '../src/season-archive-command-lineup-v1.ts';
import {closeSeasonLineupV1} from '../src/season-close-command-lineup-v1.ts';

const generation='11111111-1111-4111-8111-111111111111';
const hash='a'.repeat(64),other='b'.repeat(64);
const input=()=>({season:1,generation,calendarHash:hash,
 dayHashes:Array(56).fill(hash) as string[],
 tieHashes:Array(54).fill(other) as string[],resultCount:4082});

describe('#613 protected V2 archive and closure proof (unrouted)',()=>{
 it('computes the canonical archive digest from EXACTLY 56 V2 days/54 ties/4082 matches',async()=>{
  const source=input(),digest=await buildLineupArchiveDigestV1(source);
  const resultsHash=await canonicalHash(source.dayHashes),
   knockoutHash=await canonicalHash(source.tieHashes);
  expect(digest.resultsHash).toBe(resultsHash);
  expect(digest.knockoutHash).toBe(knockoutHash);
  expect(digest.archiveHash).toBe(await canonicalHash({
   schemaVersion:1,season:1,generation,calendarHash:hash,
   resultsHash,knockoutHash,resultsCount:4082,daysCount:56,tiesCount:54
  }));
  expect(digest.archiveHash).toMatch(/^[a-f0-9]{64}$/);
 });
 it('fails closed for incomplete/legacy/future evidence and altered identifiers',async()=>{
  const ok=input();
  for(const invalid of [
   {...ok,resultCount:4081},{...ok,resultCount:4083},
   {...ok,dayHashes:ok.dayHashes.slice(0,55)},
   {...ok,dayHashes:[...ok.dayHashes,hash]},
   {...ok,dayHashes:[...ok.dayHashes.slice(0,55),'invalid']},
   {...ok,tieHashes:ok.tieHashes.slice(0,53)},
   {...ok,tieHashes:[...ok.tieHashes,other]},
   {...ok,calendarHash:'temporary-score-v1'},
   {...ok,generation:'wrong'}, {...ok,season:0}
  ]){
   await expect(buildLineupArchiveDigestV1(invalid)).rejects.toMatchObject({
    status:422,code:'lineup_archive_invalid'
   });
  }
 });
 it('aggregates only verified frozen appearances, preserving club changes without phantom players',()=>{
  const frozen=(club:string,id:number,goals:number,minutes:number)=>({
   receipt:{fixture:{competitionId:'IT-1',homeClubId:club,awayClubId:'IT-40'},
    result:{
     home:{appearances:[{playerId:id,started:true,minutes,goals}]},
     away:{kind:'team_fallback',appearances:[]}
    }}
  });
  const records=new Map([
   ['match1',frozen('IT-1',23,2,90)],
   ['match2',frozen('IT-1',23,0,120)],
   ['match3',frozen('IT-2',23,1,90)]
  ]);
  const stats=summarizeFrozenLineupPlayersV1(records as any);
  expect(stats).toEqual([
   {playerId:23,clubId:'IT-1',competitionId:'IT-1',
    appearances:2,starts:2,minutes:210,goals:2},
   {playerId:23,clubId:'IT-2',competitionId:'IT-1',
    appearances:1,starts:1,minutes:90,goals:1}
  ]);
  const named=structuredClone(frozen('IT-1',23,2,90)) as any;
  named.receipt.result.playerIdentityVersion='player-identity-v1';
  named.receipt.result.playerIdentities=[{playerId:23,name:'Frozen Name',nationality:'ITA'}];
  expect(summarizeFrozenLineupPlayersV1(new Map([['named',named]]))).toEqual([
   {playerId:23,clubId:'IT-1',competitionId:'IT-1',appearances:1,starts:1,minutes:90,goals:2,name:'Frozen Name',nationality:'ITA'}
  ]);
  expect(summarizeFrozenLineupPlayersV1(new Map())).toEqual([]);
  expect(()=>summarizeFrozenLineupPlayersV1(
   new Map([['bad',frozen('IT-1',23,0,-1)]]) as any
  )).toThrow();
 });
});

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));
it('never archives or closes an unprepared season, and does not write legacy results',async()=>{
 await clearTestWorld(db);
 const session=(await seedUnifiedOperator(db,'lineup-archive-qa',
  'lineup-archive@example.invalid',now,'a'.repeat(64))).session;
 const world=await readWorld(db);
 const command={expectedGeneration:world.generation,expectedRevision:world.revision};
 await expect(archiveSeasonLineupV1(db,session,command,'lineup-archive-before-day56-0001',now))
  .rejects.toMatchObject({status:409});
 await expect(closeSeasonLineupV1(db,session,command,'lineup-close-before-day56-0001',now))
  .rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_archives').first() as {n:number}).n).toBe(0);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_day_outcomes').first() as {n:number}).n).toBe(0);
 await expect(verifyLineupSeasonArchiveV1(db,{...world,
  seasonNumber:1,phase:'active',day:13}))
  .rejects.toMatchObject({status:422});
});
