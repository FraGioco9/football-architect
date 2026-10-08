import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWorld} from '../src/domain/world.js';
import {startCareer} from '../src/domain/career.js';
import {TRAIT_KEYS,readPersonality,createPersonality} from '../src/addons/domain/player-personality.mjs';
import {emptyTraitEvidence,advanceTraitEvidence,validateTraitEvidence,scoutPersonality} from '../src/addons/domain/player-personality-scouting.mjs';
import {personalityPlayerView,recordCareerPersonalityEvent,syncCareerPersonality,validateCareerPersonality} from '../src/domain/career-personality.js';
import {scoutingPlayers,scoutingPlayer,refreshScoutingReport,validateCareerScouting,scoutingEstimate} from '../src/domain/career-scouting.js';
import {renderObservedRelations} from '../src/player-observed-details.js';
import {renderPlayerOverviewPage,PLAYER_PROFILE_TABS} from '../src/player-overview.js';
import {advancedPage} from '../src/addons/advanced-ui.js';
import {careerScoutingPanel} from '../src/addons/career-scouting-ui.js';
import {inspectCareerPlayer} from '../src/addons/career-bridge.mjs';
const make=(seed=42)=>{const w=makeWorld(seed,'IT');startCareer(w,w.teams[0].id,'QA Manager');return w;};
const own=w=>w.players.find(p=>p.clubId===w.clubId);
const external=w=>scoutingPlayers(w).find(x=>!x.owned&&x.countryId===w.countryId&&x.player.clubId>0);
const keys=value=>{
 const found=new Set();
 const walk=x=>{if(x&&typeof x==='object'){Object.entries(x).forEach(([k,v])=>{found.add(k);walk(v);});}};
 walk(value);return found;
};
const forbidden=['value','range','seed','potential','knowledge','confidence','metadata','personalityProfile','personalityEvidence','traitEvidence','influence','morale','coachRelationship'];
const assertSafe=value=>{
 const found=keys(value);
 for(const field of forbidden)assert.equal(found.has(field),false,field+' present in DTO');
 assert.equal(value.traits.length,7);
 for(const t of value.traits){
  assert.deepEqual(Object.keys(t).sort(),['description','key','label','status','visibility'].sort());
  assert.ok(['hidden','early','descriptive'].includes(t.visibility));
 }
};
test('evidence per trait is bounded, strict, deterministic and does not mutate input',()=>{
 const before=emptyTraitEvidence(),snapshot=structuredClone(before);
 assert.equal(Object.keys(before).length,7);assert.deepEqual(Object.keys(before),TRAIT_KEYS);
 const one=advanceTraitEvidence(before,{observationId:'club:week:1',count:2});
 assert.deepEqual(before,snapshot);
 assert.equal(Object.values(one).reduce((a,b)=>a+b,0),2);
 assert.deepEqual(one,advanceTraitEvidence(before,{observationId:'club:week:1',count:2}));
 assert.throws(()=>validateTraitEvidence({...before,hacked:44}),/EVIDENCE/);
 assert.throws(()=>validateTraitEvidence({...before,leadership:100}),/EVIDENCE/);
 let capped=one;for(let i=0;i<1000;i++)capped=advanceTraitEvidence(capped,{observationId:'opportunity:'+i,count:3});
 assert.ok(Object.values(capped).every(n=>n<=12));
});
test('scouting DTO has no numeric private values even at full knowledge, IT/EN',()=>{
 const traits=Object.fromEntries(TRAIT_KEYS.map((k,i)=>[k,i%2?100:1]));
 const profile=createPersonality(traits);
 for(const lang of ['it','en']){
  const zero=scoutPersonality(profile,{lang});
  assertSafe(zero);assert.ok(zero.traits.every(x=>x.visibility==='hidden'&&x.description==='—'));
  const early=scoutPersonality(profile,{lang,evidence:Object.fromEntries(TRAIT_KEYS.map(k=>[k,1]))});
  assertSafe(early);assert.ok(early.traits.every(x=>x.visibility==='early'&&x.description==='—'));
  const deep=scoutPersonality(profile,{lang,evidence:Object.fromEntries(TRAIT_KEYS.map(k=>[k,12]))});
  assertSafe(deep);assert.ok(deep.traits.every(x=>x.visibility==='descriptive'));
  assert.ok(deep.traits.every(x=>x.description.match(lang==='en'?/subject to/:/da confermare/)));
 }
});
test('owned traits begin unknown and progress only through real events and weekly time',()=>{
 const w=make(),p=own(w),first=personalityPlayerView(w,p,{lang:'it'});
 assertSafe(first);assert.ok(first.traits.every(x=>x.visibility==='hidden'));
 assert.equal(recordCareerPersonalityEvent(w,{playerId:p.id,eventId:'qa-game:1',type:'played'}),true);
 const e1=structuredClone(w.advancedV1.personalityV1.playerStates[String(p.id)].traitEvidence);
 assert.equal(recordCareerPersonalityEvent(w,{playerId:p.id,eventId:'qa-game:1',type:'played'}),false);
 assert.deepEqual(w.advancedV1.personalityV1.playerStates[String(p.id)].traitEvidence,e1);
 const noWeek=JSON.stringify(w);assert.equal(syncCareerPersonality(w),false);assert.equal(JSON.stringify(w),noWeek);
 w.advancedV1.clockDay+=14;
 assert.equal(syncCareerPersonality(w),true);
 assertSafe(personalityPlayerView(w,p,{lang:'en'}));
 assert.ok(Object.values(w.advancedV1.personalityV1.playerStates[String(p.id)].traitEvidence).some(v=>v>=1));
 assert.equal(validateCareerPersonality(w),true);
});
test('scout reports gain evidence only after real review; same day review cannot farm traits',()=>{
 const w=make(),candidate=external(w);assert.ok(candidate);
 const absent=personalityPlayerView(w,candidate.player,{owned:false});
 assertSafe(absent);assert.ok(absent.traits.every(x=>x.visibility==='hidden'));
 refreshScoutingReport(w,{revision:w.advancedV1.scoutingV1.revision,playerId:candidate.id});
 const first=structuredClone(w.advancedV1.scoutingV1.reports[candidate.id].personalityEvidence);
 assert.equal(Object.values(first).reduce((a,b)=>a+b,0),2);
 refreshScoutingReport(w,{revision:w.advancedV1.scoutingV1.revision,playerId:candidate.id});
 assert.deepEqual(w.advancedV1.scoutingV1.reports[candidate.id].personalityEvidence,first);
 assertSafe(personalityPlayerView(w,candidate.player,{owned:false,lang:'it'}));
 assert.equal(validateCareerScouting(w),true);
 // Observer change must NOT inherit the other club's knowledge.
 const previous=w.clubId;w.clubId=w.teams.find(t=>t.id!==previous&&t.id!==candidate.player.clubId).id;
 assert.ok(personalityPlayerView(w,candidate.player,{owned:false}).traits.every(t=>t.visibility==='hidden'));
 w.clubId=previous;
 assert.equal(validateCareerScouting(w),true);
 assert.deepEqual(w.advancedV1.scoutingV1.reports[candidate.id].personalityEvidence,first);
});
test('progressive scout knowledge stays local, persists through JSON and never infers exact potential',()=>{
 const w=make(),c=external(w);
 for(let day=1;day<=12;day++){
  w.advancedV1.clockDay+=1;
  refreshScoutingReport(w,{revision:w.advancedV1.scoutingV1.revision,playerId:c.id});
 }
 const observed=personalityPlayerView(w,c.player,{owned:false,lang:'it'});
 assertSafe(observed);
 assert.ok(observed.traits.some(t=>t.visibility==='descriptive'));
 assert.equal(JSON.stringify(observed).includes('potential'),false);
 const snap=structuredClone(w);
 assert.deepEqual(personalityPlayerView(snap,c.player,{owned:false,lang:'it'}),observed);
 assert.equal(validateCareerScouting(w),true);
});
test('standalone five-tab Overview is qualitative, accessible, with no second relations panel',()=>{
 const w=make(),p=own(w),ui={language:'it',routePlayerId:p.id,playerTab:'overview'};
 assert.equal(PLAYER_PROFILE_TABS.length,5);
 for(const lang of ['it','en']){
  const html=renderPlayerOverviewPage(w,{...ui,language:lang});
  const expected=lang==='en'?'Personality and relationships':'Personalità e relazioni';
  assert.ok(html.includes(expected));
  assert.equal((html.match(/class="plyr051-tab(?:\\s|\")/g)||[]).length,5);
  assert.equal((html.match(/class="plyr064-trait"/g)||[]).length,7);
  assert.ok(html.includes('role="list"')&&html.includes('role="listitem"'));
  assert.ok(!html.includes('Potenziale')&&!html.includes('Potential'));
  assert.equal((html.match(new RegExp(expected,'g'))||[]).length,2); // aria-label and heading
  const raw=renderObservedRelations(w,p,lang);
  assert.ok(!raw.includes('Influenza nello spogliatoio'));
 }
 const safe=inspectCareerPlayer(p,w);
 assert.equal('personality' in safe,false);
});
test('analysis and scouting pages do not interpolate raw private personality values',()=>{
 const w=make(),p=own(w),pr=readPersonality(p,{seed:w.seed,countryId:w.countryId});
 const before=structuredClone(p);
 const ui={language:'en',advancedTab:'players',advancedPlayerId:p.id,scoutCountry:'IT',scoutPosition:'ALL'};
 const analysis=advancedPage(w,ui);
 assert.ok(analysis.includes('Observed personality'));
 assert.ok(!analysis.includes('Projected personality'));
 assert.ok(analysis.includes('—'));
 const scout=careerScoutingPanel(w,ui);
 assert.ok(scout.includes('Personality'));
 assert.ok(!scout.includes('personalityEvidence'));
 assert.deepEqual(p,before);
 const css=readFileSync(new URL('../src/player-overview.css',import.meta.url),'utf8');
 assert.ok(css.includes('max-width:540px')&&css.includes('.plyr064-traits'));
});
