import {it,expect} from 'vitest';
import {buildKnockoutSlotReservations} from '../src/domain/calendar/knockout-slot-reservations.ts';
const generation='123e4567-e89b-42d3-a456-426614174000';
it('reserves exactly 98 stable, unique fixtures from approved domestic and international brackets',async()=>{
 const domestic=await buildKnockoutSlotReservations(generation,1,'domestic');
 const international=await buildKnockoutSlotReservations(generation,1,'international');
 const all=await buildKnockoutSlotReservations(generation,1,'calendar');
 expect(domestic).toHaveLength(56);expect(international).toHaveLength(42);expect(all).toHaveLength(98);
 expect(all).toEqual([...domestic,...international]);
 expect(new Set(all.map(x=>x.matchId)).size).toBe(98);
 expect(all.every(x=>x.day>0&&x.day<=56&&x.leg>=1&&x.leg<=2)).toBe(true);
 expect(await buildKnockoutSlotReservations(generation,1,'calendar')).toEqual(all);
 const fresh=await buildKnockoutSlotReservations('123e4567-e89b-42d3-a456-426614174001',1,'calendar');
 expect(all.every((x,i)=>x.matchId!==fresh[i].matchId)).toBe(true);
});
it('keeps ordered rank/tie dependencies and correct leg markers without inventing club IDs',async()=>{
 const all=await buildKnockoutSlotReservations(generation,2,'calendar');
 const cup=all.filter(s=>s.competitionId==='int-1');
 expect(cup).toHaveLength(21);
 expect(cup.filter(s=>s.phaseId==='playoffs')).toHaveLength(8);
 expect(cup.filter(s=>s.phaseId==='quarterfinals')).toHaveLength(8);
 expect(cup.filter(s=>s.phaseId==='semifinals')).toHaveLength(4);
 expect(cup.filter(s=>s.phaseId==='final')).toHaveLength(1);
 expect(cup.find(s=>s.phaseId==='final')).toMatchObject({
  marker:'SOVEREIGN-FINAL',homePolicy:'neutral',
  participantA:{kind:'tieWinner',tieId:'s1'},participantB:{kind:'tieWinner',tieId:'s2'}});
 expect(all.filter(s=>s.competitionId==='IT-2'&&s.phaseId==='promotionPlayoffs'&&s.tieId==='final'))
  .toMatchObject([{marker:'N33',leg:1,participantA:{kind:'tieWinner',tieId:'semi36'}}]);
 expect(JSON.stringify(all)).not.toMatch(/homeClubId|awayClubId/);
});
