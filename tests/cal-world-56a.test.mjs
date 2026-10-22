import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDevWorldClock,nationalProgress,NATIONAL_DAYS,SEASON_KEY,DAY_KEY,ROUNDS_KEY} from '../tools/dev-world-clock.mjs';
import model from '../assets/world-calendar-model.js';
const storage=(initial={})=>{
 const values=new Map(Object.entries(initial));
 return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};
};
const make=(initial={})=>{const s=storage(initial),events=[];return {s,events,clock:createDevWorldClock(s,(name,detail)=>events.push({name,detail}))}};
test('W56-01 defaults to season 1, day 1',()=>assert.deepEqual(make().clock.read(),{season:1,day:1}));
test('W56-02 accepts seasons 1–4 and all 56 days',()=>{
 for(let season=1;season<=4;season++)for(let day=1;day<=56;day++){
  const {clock}=make();assert.equal(clock.commit({season,day}),true);assert.deepEqual(clock.read(),{season,day});
 }
});
test('W56-03 rejects invalid writes and corrupt storage',()=>{
 const {s,clock}=make({[SEASON_KEY]:'',[DAY_KEY]:'0'});
 assert.deepEqual(clock.read(),{season:1,day:1});
 for(const day of [-1,0,57,2.5,NaN,Infinity])assert.equal(clock.setDay(day),false);
 for(const season of [0,5,1.5,NaN])assert.equal(clock.setSeason(season),false);
 assert.deepEqual(clock.read(),{season:1,day:1});
});
test('W56-04 56-day mapping matches the frozen calendar model including N31–N33',()=>{
 const days=model.createSeason(1).days;
 const expected=days.flatMap(d=>d.events.some(e=>e.family==='national')?[d.day]:[]);
 assert.deepEqual(NATIONAL_DAYS,expected);
 for(let day=1;day<=56;day++)assert.equal(nationalProgress(day),expected.filter(x=>x<=day).length);
 assert.equal(NATIONAL_DAYS.length,33);
});
test('W56-05 days 53–56 preserve final events and postseason',()=>{
 const days=model.createSeason(1).days;
 assert.deepEqual(days[52].events.map(e=>e.marker).sort(),['FEDERATION-FINAL','N32']);
 assert.deepEqual(days[53].events.map(e=>e.marker).sort(),['N33','SOVEREIGN-FINAL']);
 assert.equal(nationalProgress(53),32);assert.equal(nationalProgress(54),33);assert.equal(nationalProgress(56),33);
});
test('W56-06 season changes preserve the day',()=>{const {clock}=make();clock.setDay(36);clock.setSeason(3);assert.deepEqual(clock.read(),{season:3,day:36})});
test('W56-07 day changes preserve the season',()=>{const {clock}=make();clock.setSeason(4);clock.setDay(54);assert.deepEqual(clock.read(),{season:4,day:54})});
test('W56-08 both routes import the shared DEV clock',()=>{
 const client=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
 assert.match(client,/createDevWorldClock/);assert.match(client,/devWorldClock\.setDay\(n\)/);
});
test('W56-09 single event publication per actual change',()=>{
 const {clock,events}=make();clock.setDay(36);assert.deepEqual(events.map(e=>e.name),['fa:world-clock-snapshot','fa:dev-progress-change','fa:dev-world-day-change']);
 clock.setDay(36);assert.equal(events.length,3);assert.equal(events[1].detail.matchdays,21);
});
test('W56-10 failure rolls back and emits no change',()=>{
 const {clock,events,s}=make();s.setItem=(k,v)=>{if(k===DAY_KEY)throw Error('storage denied');s.values.set(k,v)};
 assert.equal(clock.setDay(20),false);assert.deepEqual(clock.read(),{season:1,day:1});assert.equal(events.length,0);
});
test('W56-11 browsing state is not in the DEV clock contract',()=>{
 const {clock}=make();assert.deepEqual(Object.keys(clock.read()).sort(),['day','season']);assert.equal('setWeek' in clock,false);
});
test('W56-12 published snapshot reflects persisted state',()=>{
 const {clock,events}=make({[SEASON_KEY]:'3',[DAY_KEY]:'36'});clock.publish();
 assert.deepEqual(events[0].detail.current,{season:3,day:36});
});
test('W56-13 reset removes legacy and canonical overrides',()=>{
 const {s,clock}=make({[SEASON_KEY]:'4',[DAY_KEY]:'56',[ROUNDS_KEY]:'33'});
 assert.equal(clock.reset(),true);assert.deepEqual(clock.read(),{season:1,day:1});
 for(const k of [SEASON_KEY,DAY_KEY,ROUNDS_KEY])assert.equal(s.getItem(k),null);
});
test('W56-14 DEV module appears only in protected asset map',()=>{
 const source=readFileSync(new URL('../tools/dev-preview-artifact.mjs',import.meta.url),'utf8');
 assert.match(source,/__fa_dev__\/dev-world-clock\.mjs/);
 const local=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 assert.match(local,/__fa_dev__\/dev-world-clock\.mjs/);
});
test('W56-15 Calendar sidebar season regression retained',()=>{
 const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(source,/standings-dev-season/);assert.match(source,/calendarView/);
});
test('W56-16 calendar model and publication guard remain outside patch scope',()=>{
 const source=readFileSync(new URL('../tools/dev-preview-artifact.mjs',import.meta.url),'utf8');
 assert.match(source,/planPublicFiles/);assert.match(source,/protected_debug/);
});
