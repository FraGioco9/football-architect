import {describe,expect,it} from 'vitest';
import {salaryBounds,validAnnualSalary,contractEnd,accruedSalary,earnedBetween,promotionSalary,
 canAffordNextPayday,clubMayRecruit,canCounterOffer,offerExpiresAt} from '../src/player-contract-policy.ts';
describe('#777 contract policy (inert)',()=>{
 it('applies division floor, 200% ceiling and exact 125% AI demand',()=>{
  expect(salaryBounds(1,0)).toEqual({minimum:40,reference:40,maximum:80,aiDemand:50});
  const b=salaryBounds(2,100.01);
  expect(b).toEqual({minimum:20,reference:101,maximum:202,aiDemand:127});
  expect(validAnnualSalary(20,b,'human')).toBe(true);
  expect(validAnnualSalary(202,b,'human')).toBe(true);
  for(const v of [19,203,20.5,NaN])expect(validAnnualSalary(v,b,'human')).toBe(false);
  for(const v of [101,126,128,202])expect(validAnnualSalary(v,b,'ai')).toBe(false);
  expect(validAnnualSalary(127,b,'ai')).toBe(true);
  expect(()=>salaryBounds(1,NaN)).toThrow();
  expect(()=>salaryBounds(2,-1)).toThrow();
 });
 it('uses the current partial season as first, and reconciles cumulative rounding',()=>{
  expect(contractEnd({season:2,day:29},3)).toEqual({season:4,day:56});
  expect(()=>contractEnd({season:2,day:57},1)).toThrow();
  expect(()=>contractEnd({season:2,day:1},4)).toThrow();
  expect(accruedSalary(101,28)).toBe(50);
  expect(earnedBetween(101,0,28)+earnedBetween(101,28,56)).toBe(101);
  expect(earnedBetween(101,0,12)+earnedBetween(101,12,28)+earnedBetween(101,28,56)).toBe(101);
  expect(()=>earnedBetween(101,28,12)).toThrow();
  expect(promotionSalary(20,1)).toBe(40);
  expect(promotionSalary(250,2)).toBe(250);
 });
 it('requires next-payday affordability and no arrears',()=>{
  const f={uncommittedCash:100,uncreditedGuaranteedParticipation:200,committedUncoveredWages:250,arrears:0,newDue:50};
  expect(canAffordNextPayday(f)).toBe(true);
  expect(canAffordNextPayday({...f,newDue:51})).toBe(false);
  expect(canAffordNextPayday({...f,arrears:1})).toBe(false);
  expect(()=>canAffordNextPayday({...f,uncommittedCash:-1})).toThrow();
 });
 it('blocks AI external recruitment and counteroffers',()=>{
  expect(clubMayRecruit('free-agent','ai')).toBe(false);
  expect(clubMayRecruit('transfer','ai')).toBe(false);
  expect(clubMayRecruit('renewal','ai')).toBe(true);
  expect(clubMayRecruit('own-academy','ai')).toBe(true);
  expect(clubMayRecruit('free-agent','human')).toBe(true);
  expect(canCounterOffer('ai')).toBe(false);
  expect(canCounterOffer('human')).toBe(true);
  expect(offerExpiresAt(1000)).toBe(604801000);
 });
});
