import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUES} from '../src/leagues.js';
import {makeWorld} from '../src/domain/world.js';
import {startCareer} from '../src/domain/career.js';
import {officialCareerSystemsReady,ensureOfficialCareerSystems} from '../src/domain/career-official.js';
import {personalityEnabled,personalityMatchMultiplier,personalityTrainingMultiplier,personalityContractInterest,validateCareerPersonality} from '../src/domain/career-personality.js';
import {evaluatePersonalityEffects,matchPerformanceFactor} from '../src/addons/domain/player-personality-effects.mjs';
import {readPersonality} from '../src/addons/domain/player-personality.mjs';
import {developmentContext} from '../src/addons/domain/player-development.mjs';
import {managedClubKey} from '../src/domain/career-market.js';
import {aiMarketEnabled,planCareerAIOffers,validateCareerAIMarket} from '../src/domain/career-ai-market.js';
const make=(seed=1234,country='IT')=>{const w=makeWorld(seed,country);startCareer(w,w.teams[0].id,'Test Coach');return w;};

test('standard career enables personality, market, contracts, AI automatically and idempotently',()=>{
 const w=make();assert.ok(officialCareerSystemsReady(w)&&personalityEnabled(w)&&aiMarketEnabled(w));
 assert.equal(validateCareerPersonality(w),true);
 const before=JSON.stringify(w),again=ensureOfficialCareerSystems(w);
 assert.equal(again.changed,false);assert.equal(JSON.stringify(w),before);
});
test('training factor capped at ±3% with no second multiplier of physical workload',()=>{
 const w=make(),p=w.players.find(p=>p.clubId===w.clubId),f=evaluatePersonalityEffects(p.personalityProfile).factors.training;
 assert.ok(f>=.97&&f<=1.03);assert.equal(personalityTrainingMultiplier(w,p),f);
 const ctx=developmentContext(p.developmentV1,p,{season:w.season,minutes:1800,workload:55});
 assert.equal(ctx.personalityTraining,f);assert.equal(ctx.workload,55);
 const code=readFileSync(new URL('../src/domain/career-training.js',import.meta.url),'utf8');
 assert.ok(!code.includes('personalityTrainingMultiplier(w,p)'));
});
test('contract and transfer share capped deterministic willingness incl international adaptability',()=>{
 const w=make(),p=w.players.find(p=>p.clubId===w.clubId);
 const domestic=personalityContractInterest(w,p,{offeredRaise:10,clubLevel:55});
 const abroad=personalityContractInterest(w,p,{offeredRaise:10,clubLevel:55,international:true});
 assert.ok(domestic>=0&&domestic<=100&&abroad>=0&&abroad<=100);
 assert.ok(Math.abs(domestic-abroad)<=4);
 assert.ok(personalityContractInterest(w,p,{offeredRaise:150})>=personalityContractInterest(w,p,{offeredRaise:-20}));
});
test('user and AI XI use same capped modifier without altering players',()=>{
 const w=make(),other=w.teams[1].id;
 const p=w.players.filter(p=>p.clubId===w.clubId).slice(0,11).map(p=>p.id);
 const q=w.players.filter(p=>p.clubId===other).slice(0,11).map(p=>p.id);
 const before=JSON.stringify(w);
 const a=personalityMatchMultiplier(w,w.clubId,p),b=personalityMatchMultiplier(w,other,q);
 assert.ok(a>=.98&&a<=1.02&&b>=.98&&b<=1.02);
 assert.equal(JSON.stringify(w),before);
});
test('all eight leagues maintain private personality, and NPC matches share bounded rule',()=>{
 for(const league of LEAGUES){
  const w=make(2048,league.id),npc=w.advancedV1.worldV1.leagues.find(l=>!l.locked);
  assert.ok(npc?.players.length>0);
  const p=npc.players[0],before=structuredClone(p);
  const f=matchPerformanceFactor(readPersonality(p,{seed:w.seed,countryId:npc.countryId}),{morale:50});
  assert.ok(f>=.98&&f<=1.02);assert.deepEqual(p,before);
 }
 const code=readFileSync(new URL('../src/domain/career-world.js',import.meta.url),'utf8');
 assert.match(code,/matchPerformanceFactor\(readPersonality\(p,/);
});
test('AI market planning respects ledgers and never exposes hidden trait or interest fields',()=>{
 const w=make(1337),snapshot=JSON.stringify(w.advancedV1.personalityV1);
 const count=planCareerAIOffers(w);assert.ok(count>=0&&count<=2);
 assert.ok(validateCareerAIMarket(w));
 assert.equal(JSON.stringify(w.advancedV1.personalityV1),snapshot);
 for(const offer of w.advancedV1.aiMarketV1.offers){
  assert.notEqual(offer.buyerKey,managedClubKey(w));assert.notEqual(offer.sellerKey,managedClubKey(w));
  for(const key of ['personalityProfile','traits','interestScore','matchFactor'])assert.equal(Object.hasOwn(offer,key),false);
 }
});
test('player strength and OVR are invariant under pure personality evaluations',()=>{
 const w=make(),p=w.players.find(p=>p.clubId===w.clubId),copy=structuredClone(p);
 developmentContext(p.developmentV1,p,{season:w.season,minutes:1800,workload:55});
 personalityMatchMultiplier(w,w.clubId,w.lineup);
 personalityContractInterest(w,p,{offeredRaise:50,international:true});
 assert.deepEqual(p,copy);
});
