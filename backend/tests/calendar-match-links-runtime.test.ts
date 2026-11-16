import {describe,it,expect} from 'vitest';
import type {Database} from '../src/database.ts';
import {linkCalendarFixturesFromRows,readCalendarPublishedMatchLinks}
 from '../src/calendar-match-links.ts';

const generation='550e8400-e29b-41d4-a716-446655440000',season=2,day=52;
const league={id:'season:2:IT-1:N31:IT-1:IT-2',competitionId:'IT-1',phaseId:'league',
 tieId:null,leg:null,marker:'N31',day,round:31};
const knockout={id:'season:2:IT-1:N31:IT-1:IT-3',competitionId:'IT-1',phaseId:'playout',
 tieId:'relegation13',leg:1,marker:'N31',day,round:31};
const row=(source:string|null,id:number,phase:string,tie:string|null,leg:number|null)=>({
 public_id:id,generation,season_number:season,competition_id:'IT-1',phase_id:phase,
 source_fixture_id:source,tie_id:tie,leg,marker:'N31',scheduled_day:day,round_number:31
});
describe('#605 published calendar match links',()=>{
 it('binds league by original fixture ID and knockout by immutable bracket slot',()=>{
  const slots=[row(league.id,785,'league',null,null),row(null,786,'playout','relegation13',1)];
  const links=linkCalendarFixturesFromRows([league,knockout],slots,generation,season,day);
  expect(links.get(league.id)).toBe('785');
  expect(links.get(knockout.id)).toBe('786');
  expect(linkCalendarFixturesFromRows([{...league,day:51}],slots,generation,season,day).size).toBe(0);
  expect(linkCalendarFixturesFromRows([{...knockout,leg:2}],slots,generation,season,day).size).toBe(0);
  expect(linkCalendarFixturesFromRows([league],[{...slots[0],generation:'old'}],generation,season,day).size).toBe(0);
  expect(linkCalendarFixturesFromRows([league],[...slots,slots[0]],generation,season,day).size).toBe(0);
 });
 it('reads only the selected generation/season/day without extra public API requests',async()=>{
  const binds:unknown[][]=[];let sql='';
  const db={prepare(statement:string){sql=statement;return {bind(...args:unknown[]){binds.push(args);
   return {all:async()=>({results:[row(league.id,785,'league',null,null)]})};
  }};}} as unknown as Database;
  const links=await readCalendarPublishedMatchLinks(db,generation,season,day,[league]);
  expect(links.get(league.id)).toBe('785');
  expect(sql).toContain('FROM season_match_slots');
  expect(sql).toContain('FROM season_knockout_match_slots');
  expect(binds).toEqual([[generation,season,day,generation,season,day]]);
  const unavailable={prepare(){throw Error('schema unavailable')}} as unknown as Database;
  expect((await readCalendarPublishedMatchLinks(unavailable,generation,season,day,[league])).size).toBe(0);
 });
});
