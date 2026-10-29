import {describe,it,expect} from 'vitest';
import {buildSeasonOneCalendarEvidence} from '../src/season-calendar-evidence.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';

describe('Season 1 immutable 56-day design calendar (not sporting fixtures)',()=>{
 it('builds one source-pinned calendar with 30 national league rounds and postseason markers',async()=>{
  const evidence=await buildSeasonOneCalendarEvidence();
  expect(evidence.season).toBe(1);
  expect(evidence.calendarVersion).toBe('WORLD-TIME-QA-06');
  const value=JSON.parse(evidence.calendarJson);
  expect(value.days).toHaveLength(56);
  const events=value.days.flatMap((day:{events:unknown[]})=>day.events);
  const nationals=events.filter((e:{family:string})=>e.family==='national');
  const cups=events.filter((e:{family:string})=>e.family==='international');
  expect(nationals).toHaveLength(33);
  expect(nationals.slice(30).map((e:{marker:string})=>e.marker)).toEqual(['N31','N32','N33']);
  expect(nationals.filter((e:{phase:string})=>e.phase==='league')).toHaveLength(30);
  expect(cups).toHaveLength(14);
  expect(value.days[55]).toMatchObject({day:56,kind:'transition'});
  expect(await canonicalHash(value)).toBe(evidence.calendarHash);
 });
 it('has international and national calendar markers but never fixtures or match results',async()=>{
  const value=JSON.parse((await buildSeasonOneCalendarEvidence()).calendarJson);
  const text=JSON.stringify(value);
  expect(text).not.toMatch(/"homeClub"|"awayClub"|"score"|"winner"/);
  expect(value.days.flatMap((day:{events:unknown[]})=>day.events).some((e:{marker:string})=>e.marker==='FEDERATION-FINAL')).toBe(true);
  expect(value.days.flatMap((day:{events:unknown[]})=>day.events).some((e:{marker:string})=>e.marker==='SOVEREIGN-FINAL')).toBe(true);
 });
});
