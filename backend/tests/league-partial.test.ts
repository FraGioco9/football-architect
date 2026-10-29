import assert from 'node:assert/strict';
import test from 'node:test';
import {rankLeagueTable} from '../src/league-standings.ts';
import type {Fixture} from '../src/initial-schedule.ts';
const clubs=['IT-1','IT-2'];
const fixtures:Fixture[]=[{id:'first',competitionId:'IT-1',marker:'N01',day:13,round:1,homeClubId:'IT-1',awayClubId:'IT-2'},{id:'return',competitionId:'IT-1',marker:'N02',day:15,round:2,homeClubId:'IT-2',awayClubId:'IT-1'}];
test('partial table includes only elapsed league fixtures while full coverage stays strict',async()=>{
 const scores=new Map([['first',{homeGoals:2,awayGoals:0}]]);
 const table=await rankLeagueTable('IT-1',clubs,fixtures,scores,'synthetic-seed-0001',{throughDay:13});
 assert.deepEqual(table.map(r=>[r.clubId,r.played,r.points]),[['IT-1',1,3],['IT-2',1,0]]);
 await assert.rejects(rankLeagueTable('IT-1',clubs,fixtures,scores,'synthetic-seed-0001'));
 await assert.rejects(rankLeagueTable('IT-1',clubs,fixtures,new Map(),'synthetic-seed-0001',{throughDay:13}));
});
test('future scores and malformed future memberships cannot affect partial standings',async()=>{
 const scores=new Map([['first',{homeGoals:2,awayGoals:0}],['return',{homeGoals:9,awayGoals:0}]]);
 const table=await rankLeagueTable('IT-1',clubs,fixtures,scores,'synthetic-seed-0001',{throughDay:0});
 assert.ok(table.every(r=>r.played===0&&r.points===0));
 await assert.rejects(rankLeagueTable('IT-1',clubs,[fixtures[0],{...fixtures[1],homeClubId:'FR-1'}],scores,'synthetic-seed-0001',{throughDay:0}));
 for(const throughDay of [-1,57,NaN,1.5])await assert.rejects(rankLeagueTable('IT-1',clubs,fixtures,scores,'synthetic-seed-0001',{throughDay}));
});
