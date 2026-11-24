// #766 — informational schedule, never a financial entitlement or settlement.
export const REWARDS_VERSION = 'draft-1';
export const REWARDS = Object.freeze({
  domestic1: Object.freeze({pool:4000000,capacity:16,shares:Object.freeze([60,15,25])}),
  domestic2: Object.freeze({pool:2000000,capacity:16,shares:Object.freeze([60,15,25])}),
  sovereign: Object.freeze({pool:8000000,capacity:24,shares:Object.freeze([40,20,40])}),
  federation: Object.freeze({pool:4000000,capacity:24,shares:Object.freeze([40,20,40])})
});
export const REWARD_IDS = Object.freeze([
  ...['BR','DE','ENG','ES','FR','IT','NL','PT'].flatMap(c=>[c+'-1',c+'-2']),
  'int-1','int-2'
]);
export function competitionRewards(id) {
  if(typeof id!=='string')return null;
  const canonical=REWARD_IDS.find(key=>key.toLowerCase()===id.toLowerCase());
  if(!canonical)return null;
  const international=canonical.startsWith('int-');
  const rule=REWARDS[international?(canonical==='int-1'?'sovereign':'federation'):('domestic'+canonical.at(-1))];
  const [participation,points,placement]=rule.shares.map(share=>rule.pool*share/100);
  return Object.freeze({id:canonical,version:REWARDS_VERSION,status:'draft-reference',international,
    pool:rule.pool,capacity:rule.capacity,shares:rule.shares,participation,points,placement,
    participationReference:participation/rule.capacity,participationIsAverage:international});
}
export function rewardTotals() {
  return REWARD_IDS.map(competitionRewards).reduce((sum,row)=>({
    pool:sum.pool+row.pool,participation:sum.participation+row.participation,
    points:sum.points+row.points,placement:sum.placement+row.placement
  }),{pool:0,participation:0,points:0,placement:0});
}
