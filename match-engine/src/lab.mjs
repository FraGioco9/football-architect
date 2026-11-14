import {createEngine, initializeRapier, PRESETS, canonicalSnapshot, FIXED_DT, toGroundClearance} from '/__fa_match_engine__/core.mjs';
import {drawPitchMarkings,pickObservedPlayerAtCanvasPixel} from '/__fa_match_engine__/pitch-markings.mjs';
import {createPlayerMovement,currentObservedPlayerAssignments} from '/__fa_match_engine__/player-movement.mjs';
import {createPlayerBallReachObserver} from '/__fa_match_engine__/player-ball-reach.mjs';
import {measureBounceHistory,FIFA_TURF_QUALITY_PRO_REFERENCE_M} from '/__fa_match_engine__/rebound-metrics.mjs';
import {formatNumericValue, stepNumericValue} from '/__fa_match_engine__/numeric-controls.mjs';
import {runPhysicsDiagnostics,BOUNCE_OBSERVATION_SECONDS,ROLL_OBSERVATION_SECONDS,SPIN_OBSERVATION_SECONDS} from '/__fa_match_engine__/physics-diagnostics.mjs';
import {speedDependentDragCd as speedDependentDragCdForPlot} from '/__fa_match_engine__/aerodynamics.mjs';
import {reviewAerodynamicCandidate} from '/__fa_match_engine__/aero-model-review.mjs';
import {runSpinAxisDiagnostics} from '/__fa_match_engine__/spin-axis-qa.mjs';
import {runSpinDecayDiagnostics} from '/__fa_match_engine__/spin-decay-qa.mjs';
import {reviewSpinRetentionEvidence} from '/__fa_match_engine__/spin-retention-evidence.mjs';
import {reviewLiftInputContributions} from '/__fa_match_engine__/lift-input-qa.mjs';
import {runContactImpactDiagnostics} from '/__fa_match_engine__/contact-impact-qa.mjs';
import {prepareFlightPlaybackPair,sampleFlightPlaybackPair,flightPlaybackWallTime} from '/__fa_match_engine__/flight-playback.mjs';

const byId = id => document.getElementById(id);
const pitch = byId('pitch'), elevation = byId('elevation');
const fields = ['x', 'y', 'z', 'vx', 'vy', 'vz'];
const controls = ['play', 'pause', 'step', 'reset', 'apply', 'compare', 'measure'];
let rapier, engine, history = [], playing = false, lastFrame = 0, accumulator = 0;
let physicsTickSnapshot = null;
let playerWorld=createPlayerMovement(),playerSnapshot=playerWorld.snapshot();
let playerBallReach=createPlayerBallReachObserver();
let playersShown=false;
let inspectedPlayerId=null;
let kickDemoActive=false,passDemoActive=false,exchangeDemoActive=false,defendDemoActive=false,autonomousDefendActive=false,multiPassDefenseActive=false,threePassDefenseActive=false,fourPassDefenseActive=false,shownKickTick=null,shownPassStageCount=0,shownExchangeCount=0,shownOppositionFlightTick=null;

const say = (message, error = false) => {
  byId('status').textContent = message;
  byId('status').classList.toggle('error', error);
};
const fmt = x => x.toFixed(2);
// Keep field captions inert: no <label for> activation/focus animation.
// Only the input itself and its two arrow buttons receive pointer/keyboard input.
function refreshNumericArrows(field) {
  const input=byId(field);
  for(const button of document.querySelectorAll('[data-me-spin="'+field+'"]')) {
    const direction=Number(button.dataset.direction);
    button.disabled=stepNumericValue(field,input.value,direction)===null;
  }
}
function normalizeNumericField(field) {
  const input=byId(field);
  const formatted=formatNumericValue(input.value);
  if(formatted!==null) input.value=formatted;
  refreshNumericArrows(field);
}
function applyNumericStep(field,direction) {
  const input=byId(field);
  const next=stepNumericValue(field,input.value,direction);
  if(next===null)return;
  input.value=next;
  input.dispatchEvent(new Event('input',{bubbles:true}));
}
function setupNumericFields() {
  for(const field of fields) {
    const input=byId(field);
    input.addEventListener('input',()=>refreshNumericArrows(field));
    input.addEventListener('blur',()=>normalizeNumericField(field));
    input.addEventListener('change',()=>normalizeNumericField(field));
    input.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      event.preventDefault(); // Never use the browser's native step/grid rounding.
      applyNumericStep(field,event.key==='ArrowUp'?1:-1);
    });
  }
  for(const button of document.querySelectorAll('[data-me-spin]')) {
    const field=button.dataset.meSpin;
    const direction=Number(button.dataset.direction);
    if(!fields.includes(field)||(direction!==1&&direction!==-1))
      throw new TypeError('Invalid numeric control');
    button.addEventListener('click',()=>applyNumericStep(field,direction));
  }
}

// One authoritative Scenario dropdown. LAB-03 is Compare replay, not an
// independent initial state; existing LAB-01/02/04/05 IDs remain stable.
const LAB_SCENARIOS=Object.freeze({
  drop:Object.freeze({preset:'drop',seed:'me01-fixed',initial:PRESETS.drop}),
  launch:Object.freeze({preset:'launch',seed:'me01-fixed',initial:PRESETS.launch}),
  roll:Object.freeze({preset:'roll',seed:'me01-fixed',initial:PRESETS.roll}),
  bounce:Object.freeze({preset:'bounce',seed:'me01-fixed',initial:PRESETS.bounce}),
  'ai-kick':Object.freeze({preset:'roll',seed:'local-ai-first-kick',
    initial:Object.freeze({x:-4.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-pass':Object.freeze({preset:'roll',seed:'local-ai-first-pass',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-exchange':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-defend':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-defend-auto':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-defend-multi':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-defend-three':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})}),
  'ai-defend-four':Object.freeze({preset:'roll',seed:'local-ai-exchange',
    initial:Object.freeze({x:-19.35,y:0,z:0,vx:0,vy:0,vz:0})})
});
function selectedLabScenario(){
  const config=LAB_SCENARIOS[byId('preset').value];
  if(!config)throw new RangeError('Unknown LAB scenario');
  return config;
}
function loadPreset(){
  const choice=byId('preset').value,config=selectedLabScenario();
  kickDemoActive=choice==='ai-kick';
  passDemoActive=choice==='ai-pass';
  defendDemoActive=choice==='ai-defend';
  fourPassDefenseActive=choice==='ai-defend-four';
  threePassDefenseActive=choice==='ai-defend-three'||fourPassDefenseActive;
  multiPassDefenseActive=choice==='ai-defend-multi'||threePassDefenseActive;
  autonomousDefendActive=choice==='ai-defend-auto'||multiPassDefenseActive;
  exchangeDemoActive=choice==='ai-exchange'||defendDemoActive||autonomousDefendActive;
  const experimental=kickDemoActive||passDemoActive||exchangeDemoActive;
  for(const key of fields){
    byId(key).value=formatNumericValue(config.initial[key]);
    refreshNumericArrows(key);
  }
  byId('seed').value=config.seed;
  // Experimental AI physically requires shoe bodies; the checkbox mirrors
  // this requirement and restores unchecked when returning to normal LABs.
  byId('foot-contact-optin').checked=experimental;
  byId('foot-contact-optin').disabled=experimental;
  playersShown=experimental;
  byId('players-toggle').setAttribute('aria-pressed',String(playersShown));
  byId('player-controls').hidden=!playersShown;
  byId('compare-result').textContent='';
  byId('compare-result').hidden=true;
}
function currentInput(){
  for(const field of fields)normalizeNumericField(field);
  const data={preset:selectedLabScenario().preset,seed:byId('seed').value};
  for(const key of fields){
    const element=byId(key);
    if(element.value.trim()==='')throw new RangeError('Empty value: '+key);
    data[key]=Number(element.value);
  }
  return data;
}
function restart() {
  const next = createEngine(rapier,currentInput(),{
    diagnosticPlayerFootContactsEnabled:kickDemoActive||passDemoActive||
      exchangeDemoActive||byId('foot-contact-optin').checked,
    diagnosticLocalAiKickEnabled:kickDemoActive,
    diagnosticLocalAiPassReceiveEnabled:passDemoActive,
    diagnosticLocalAiExchangeEnabled:exchangeDemoActive,
    diagnosticLocalAiOpponentLaneEnabled:defendDemoActive,
    diagnosticLocalAiAutonomousDefenseEnabled:autonomousDefendActive,
    diagnosticLocalAiThirdPassEnabled:threePassDefenseActive,
    diagnosticLocalAiFourthPassEnabled:fourPassDefenseActive
  });
  if (engine) engine.dispose();
  engine = next;
  history = [engine.snapshot()];
  physicsTickSnapshot = history[0];
  playerWorld=createPlayerMovement({
    experimentalAiKickApproach:kickDemoActive,
    experimentalAiPassReceiveApproach:passDemoActive,
    experimentalAiExchangeApproach:exchangeDemoActive,
    experimentalAiOpponentLane:defendDemoActive,
    experimentalAiAutonomousDefense:autonomousDefendActive,
    experimentalAiMultiPassDefense:multiPassDefenseActive,
    experimentalAiThreePassDefense:threePassDefenseActive,
    experimentalAiFourPassDefense:fourPassDefenseActive
  });
  playerSnapshot=playerWorld.snapshot();
  playerBallReach=createPlayerBallReachObserver();
  playerBallReach.observe(physicsTickSnapshot,playerSnapshot); // Tick zero is baseline, not an invented touch.
  inspectedPlayerId=autonomousDefendActive?'away-10':
    exchangeDemoActive||passDemoActive?'home-7':
    kickDemoActive?'home-10':null;
  byId('player-inspect-choice').value=inspectedPlayerId??'';
  shownKickTick=null;shownPassStageCount=0;shownExchangeCount=0;
  shownOppositionFlightTick=null;
  byId('ai-lane-plan').hidden=!autonomousDefendActive;
  byId('ai-lane-plan').textContent=autonomousDefendActive?
    'Away #10 starts in the normal formation · waiting for measured outgoing ball velocity':'';
  byId('ai-kick-outcome').hidden=!(kickDemoActive||passDemoActive||exchangeDemoActive);
  byId('ai-kick-outcome').textContent=autonomousDefendActive?
    'Away #10 in normal formation · waiting for a real Home #7 pass':
    defendDemoActive?
    'Away #7 pressuring the live passing lane · watching for real Rapier contact':
    exchangeDemoActive?
    'Home #7 preparing first pass · awaiting real shoe contacts for the return':
    passDemoActive?
    'Home #7 approaching for a real pass to Home #10 · waiting for shoe contact':
    kickDemoActive?
    'Home #10 approaching the ball · waiting for real shoe contact':'';

  accumulator = 0;
  playing = false;
  byId('compare-result').textContent = '';
  byId('compare-result').hidden = true;
  say(autonomousDefendActive?
    'Ready · autonomous lane response from the standard formation (DEV only)':
    defendDemoActive?
    'Ready · live defending during a dynamic local AI pass (DEV only)':
    exchangeDemoActive?
    'Ready · physical AI exchange demo (Home #7 ↔ Home #10 · DEV only)':
    passDemoActive?
    'Ready · real AI pass and reception demo (Home #7 → Home #10 · DEV only)':
    kickDemoActive?
    'Ready · first real AI kick demo (Home #10 · no match results)':
    'Ready · ' + ({drop:'Ball Drop',launch:'Ball Launch',roll:'Ball Roll (Grass)',bounce:'Ball Bounce (2 m)'}[engine.scenario.preset])+ (engine.footContactSnapshot?' · experimental foot collisions':''));
  render();
}
function advance() {
  let snapshot;
  if(engine.footContactSnapshot){
    // The explicit diagnostic needs real autonomous player XY at the NEXT tick
    // before Rapier integrates its kinematic foot-body colliders.
    const exchange=multiPassDefenseActive?engine.localAiExchangeSnapshot?.():null;
    const nextPlayers=playerWorld.step(physicsTickSnapshot.ball.position,{
      velocity:physicsTickSnapshot.ball.velocity,
      footContact:engine.footContactSnapshot(),
      ...(multiPassDefenseActive?{
        passEvent:exchange?.events?.filter(e=>
          e.stage==='pass'||e.stage==='return-pass').at(-1)??null,
        oppositionFlightAudit:exchange?.oppositionFlightAudit??null
      }:{})
    });
    snapshot=engine.step(nextPlayers);
    playerSnapshot=nextPlayers;
  }else{
    // Preserve the canonical accepted LAB ball-first update and its replays.
    snapshot=engine.step();
    playerSnapshot=playerWorld.step(snapshot.ball.position);
  }
  physicsTickSnapshot = snapshot;
  const lane=playerSnapshot.observedLaneClosure;
  if(multiPassDefenseActive)
    byId('ai-lane-plan').textContent=
      'Observed genuine Rapier pass actions: '+playerSnapshot.observedPassEpochs.length+
      (fourPassDefenseActive?' / 4':threePassDefenseActive?' / 3':' / 2')+
      ' · latest action '+(playerSnapshot.observedPassEpochs.at(-1)?.stage??'awaiting real shoe START')+
      ' · no possession inferred';
  if(autonomousDefendActive&&lane){
    byId('ai-lane-plan').textContent=
      lane.phase==='released-after-physical-contact'?
      'Away #10 assignment released after real Rapier shoe START at tick '+
        lane.observedRapierShoeStartTick+
        ' · regular bounded movement resumed · no official interception':
      lane.phase==='released-after-observed-flight'?
      'Away #10 assignment abandoned · '+
        ({slowed:'measured ball slowed',reversed:'observed ball reversed',
          'passed-defender':'ball passed the defending corridor'}[lane.releaseReason])+
        ' at tick '+lane.releasedAtMovementTick+
        ' · normal bounded movement resumed · no shoe contact inferred':
      'Away defender autonomously closing measured pass lane · '+
        (multiPassDefenseActive?'physical pass #'+lane.passSequence+
          ' ('+lane.passStage+') · ':'')+
        'decision at tick '+lane.activatedAtTick+' · waypoint ('+
        fmt(lane.waypoint.x)+', '+fmt(lane.waypoint.y)+') m'+
        (lane.retargetCount?
          ' · '+lane.retargetCount+' bounded lateral corrections from observed Rapier flight':
          '')+
        ' · real shoe contact not inferred';
    // ME-PB-31 only reports the measured post-release physical body
    // distance to its CURRENT normal tactical duty (not its base lineup).
    const rejoin=playerSnapshot.observedLaneRecovery;
    if(rejoin)
      byId('ai-lane-plan').textContent+=
        ' · duty recovery: '+
        (rejoin.status==='aligned-with-current-duty'?'aligned':
          rejoin.status==='blocked-by-observed-player'?'blocked by real player':
          'returning')+
        ' · measured duty gap '+fmt(rejoin.distanceToCurrentDutyM)+' m';
    if(multiPassDefenseActive)
      byId('ai-lane-plan').textContent=
        'Observed genuine Rapier pass actions: '+playerSnapshot.observedPassEpochs.length+
        (fourPassDefenseActive?' / 4':threePassDefenseActive?' / 3':' / 2')+
        ' · physical pass #'+lane.passSequence+
        ' ('+lane.passStage+') · '+byId('ai-lane-plan').textContent;
  }
  // ME-PB-37: show ownerless post-contact reaction in the EXISTING
  // LAB-11 diagnostic row, not a new scattered control.
  const loose=playerSnapshot.observedLooseBallResponse;
  if(loose)
    byId('ai-lane-plan').textContent+=
      ' · post-contact loose ball: '+
      (loose.phase==='responding'?'responding':'recovery window complete')+
      ' · '+loose.responders.home+' / '+loose.responders.away+
      ' · no possession inferred';
  // ME-PB-38 reports evidence only; continuous contact is NOT possession.
  const controlEvidence=playerSnapshot.observedControlEvidence;
  if(controlEvidence)
    byId('ai-lane-plan').textContent+=
      ' · shoe co-motion evidence: '+
      (controlEvidence.sustainedCoMotionObserved?
       '6+ consecutive contact-aligned ticks observed':
       controlEvidence.consecutiveTicks+' consecutive qualifying ticks')+
      ' · no control or possession confirmed';
  // ME-PB-39: actual shoe END plus measurable separation, not possession.
  const releaseEvidence=playerSnapshot.observedReleaseEvidence;
  if(releaseEvidence)
    byId('ai-lane-plan').textContent+=
      ' · shoe release evidence: '+
      (releaseEvidence.currentlyMeasuredUncontested?
       'uncontested clearance after real shoe END':
       releaseEvidence.trueShoeEndObserved?
        'real shoe END; clearance not yet confirmed':
        'no qualified physical shoe END observed')+
      ' · no possession or official free-ball verdict';
  const kick=engine.localAiKickSnapshot?.();
  if(kick&&shownKickTick!==kick.tick){
    shownKickTick=kick.tick;
    byId('ai-kick-outcome').textContent='Home #10 KICK · real Rapier impulse '+
      fmt(Math.hypot(kick.impulseNs.x,kick.impulseNs.y))+
      ' N·s at '+fmt(kick.tick*FIXED_DT)+' s (DEV only)';
    say('Home #10 kicked the real ball · one physical AI action');
  }
  const sequence=engine.localAiPassReceiveSnapshot?.();
  if(sequence&&sequence.events.length>shownPassStageCount){
    shownPassStageCount=sequence.events.length;
    const text=sequence.events.map(action=>
      action.stage==='pass'?
      'Home #7 PASS → Home #10 · real Rapier impulse '+
        fmt(Math.hypot(action.impulseNs.x,action.impulseNs.y))+
        ' N·s at '+fmt(action.tick*FIXED_DT)+' s':
      'Home #10 CONTROL · real Rapier reception at '+
        fmt(action.tick*FIXED_DT)+' s').join(' · ');
    byId('ai-kick-outcome').textContent=text+' (DEV only)';
    say(sequence.control?
      'Home #10 controlled the physically passed ball · DEV only':
      'Home #7 passed the real ball · awaiting Home #10 shoe contact');
    if(sequence.control){
      inspectedPlayerId='home-10';
      byId('player-inspect-choice').value='home-10';
    }
  }
  const exchange=engine.localAiExchangeSnapshot?.();
  if(exchange&&exchange.events.length>shownExchangeCount){
    shownExchangeCount=exchange.events.length;
    const labels=exchange.events.map(e=>
      e.stage==='pass'?
        (e.previousPassTick?'Home #7 THIRD PASS':'Home #7 PASS')+
          ' at '+fmt(e.tick*FIXED_DT)+' s':
      e.stage==='return-pass'?
        (e.previousPassTick===exchange.thirdPass?.tick?
          'Home #10 FOURTH PASS':'Home #10 RETURN')+
          ' at '+fmt(e.tick*FIXED_DT)+' s':
      e.stage==='return-control'?'Home #7 CONTROL at '+fmt(e.tick*FIXED_DT)+' s':
      'OPPONENT SHOE CONTACT ('+e.playerId+') at '+fmt(e.tick*FIXED_DT)+' s');
    byId('ai-kick-outcome').textContent=labels.join(' · ')+
      ' · real Rapier START only (DEV · no possession)';
    say(exchange.oppositionContact?
      'Physical opposition contact interrupted exchange (not possession)':
      exchange.fourthPass?'Home #10 made an independent fourth Rapier pass':
      exchange.thirdPass?'Home #7 made a genuine third Rapier pass toward Home #10':
      exchange.finalControl?'Home #7 received return on real shoe contact':
      exchange.returnPass?'Home #10 returned the real ball toward Home #7':
      'Home #7 passed to Home #10 · awaiting genuine shoe contact');
    if(exchange.returnPass){
      inspectedPlayerId=exchange.finalControl?'home-7':'home-10';
      byId('player-inspect-choice').value=inspectedPlayerId;
    }
  }
  // ME-PB-36: report the actual post-contact velocity trend only after
  // consecutive completed Rapier ticks. Never call it a steal/possession.
  const flight=exchange?.oppositionFlightAudit;
  if(flight&&flight.status!=='observing'&&
     flight.status!=='insufficient-incoming-flight'&&
     shownOppositionFlightTick!==flight.tick){
    shownOppositionFlightTick=flight.tick;
    byId('ai-kick-outcome').textContent+=
      ' · observed after real Away shoe contact: '+
      (flight.status==='confirmed-changed-flight'?
        'persistent '+flight.classification+' ball flight':
        'no sustained trajectory change observed')+
      ' · aggregate Rapier velocity only · no interception or possession';
  }
  playerBallReach.observe(snapshot,playerSnapshot); // Observer is independent of real collider contacts.
  history.push(snapshot);
  if (history.length > 1400) history.shift();
}
function play() { playing = true; say('Running'); }
function pause() { playing = false; say('Paused'); }
function drawPlayers(ctx,X,Y){
  for(const p of playerSnapshot.players){
    const x=X(p.x),y=Y(p.y),pressing=Object.values(playerSnapshot.pressers).includes(p.id);
    const supporting=Object.values(playerSnapshot.supports).some(run=>run?.playerId===p.id);
    const balancing=Object.values(playerSnapshot.balances).some(b=>b?.playerId===p.id);
    const keeper=p.role==='goalkeeper';
    ctx.beginPath();ctx.arc(x,y,pressing?8.7:keeper?8:7,0,Math.PI*2);
    ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';
    ctx.fill();ctx.strokeStyle=pressing?'#ffdf71':supporting?'#c0f17a':balancing?'#ddbcff':keeper?'#fbdfaa':'#183f36';
    ctx.lineWidth=pressing?2.6:supporting?2.6:balancing?2.6:keeper?2.2:1.4;ctx.stroke();
    const pointerX=x+Math.cos(p.facingRad)*12,pointerY=y+Math.sin(p.facingRad)*12;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(pointerX,pointerY);
    ctx.strokeStyle=pressing?'#ffdf71':'#142e29';
    ctx.lineWidth=pressing?2.5:1.8;ctx.stroke();
    ctx.fillStyle='#102d2e';ctx.font='bold 9px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(p.number),x,y+0.5);
    if(p.id===inspectedPlayerId){
      ctx.beginPath();ctx.arc(x,y,13.5,0,Math.PI*2);
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2.7;ctx.stroke();
    }
  }
}
function renderPlayerReadout(){
  // Four current facts only: the simulation remains entirely autonomous.
  const label=id=>id?id.replace('home-','Home #').replace('away-','Away #'):'None';
  byId('player-pressing').textContent=label(playerSnapshot.pressers.home)+
    ' · '+label(playerSnapshot.pressers.away);
  const thirds={'home-third':'Home third','middle-third':'Middle third',
    'away-third':'Away third'};
  const lanes={'negative-y':'Left flank','central':'Centre','positive-y':'Right flank'};
  const sector=playerSnapshot.ballSector;
  byId('player-ball-sector').textContent=thirds[sector.third]+' · '+lanes[sector.lane];
  const current=inspectedPlayerId?
    playerSnapshot.players.find(p=>p.id===inspectedPlayerId):null;
  byId('player-inspection').textContent=current?
    (current.team==='home'?'Home #':'Away #')+current.number+
    ' · '+current.role+' · ('+fmt(current.x)+', '+fmt(current.y)+') m'+
    ' · '+fmt(Math.hypot(current.vx,current.vy))+' m/s':'Select a player';
  const duty=current?currentObservedPlayerAssignments(playerSnapshot,current.id):null;
  byId('player-inspection-duty').textContent=duty?
    (duty.assignments.length?duty.assignments.join(' + '):duty.fallback):
    'Select a player';
}

function topDown() {
  const c = pitch.getContext('2d'), w = pitch.width, h = pitch.height;
  const {X, Y} = drawPitchMarkings(c, w, h);
  if(playersShown)drawPlayers(c,X,Y);
  if (!physicsTickSnapshot) return;
  c.strokeStyle = '#ffda84'; c.lineWidth = 2.6; c.beginPath();
  history.forEach((s, i) => {
    const p = s.ball.position;
    if (i === 0) c.moveTo(X(p.x), Y(p.y));
    else c.lineTo(X(p.x), Y(p.y));
  });
  c.stroke();
  const p = physicsTickSnapshot.ball.position;
  c.fillStyle = '#ffffff'; c.strokeStyle = '#202f2b'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(X(p.x), Y(p.y), 7.5, 0, Math.PI * 2); c.fill(); c.stroke();
}
function sideView() {
  const c = elevation.getContext('2d'), w = elevation.width, h = elevation.height;
  c.fillStyle = '#152a34'; c.fillRect(0, 0, w, h);
  const margin = 34, base = h - margin;
  const maxZ = Math.max(4, ...history.map(s => toGroundClearance(s.ball.position.z))) * 1.15;
  const left = Math.max(0, history[history.length - 1].time - 9);
  const right = left + 9;
  const X = t => margin + (t - left) / 9 * (w - margin - 12);
  const Z = z => base - Math.max(0, z) / maxZ * (h - 2 * margin);
  c.strokeStyle = '#6b8b90'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(margin, 12); c.lineTo(margin, base); c.lineTo(w - 12, base); c.stroke();
  c.fillStyle = '#c5dee2'; c.font = '14px system-ui';
  c.fillText('Z (m)', margin + 4, 21); c.fillText('t (s)', w - 48, base + 22);
  c.fillText(fmt(maxZ), 4, Z(maxZ) + 4); c.fillText('0', 16, base + 4);
  c.strokeStyle = '#ffd47c'; c.lineWidth = 3;
  c.beginPath();
  let started = false;
  for (const snap of history) {
    if (snap.time < left) continue;
    const x = X(snap.time), y = Z(toGroundClearance(snap.ball.position.z));
    if (!started) { c.moveTo(x, y); started = true; }
    else c.lineTo(x, y);
  }
  c.stroke();
  if (physicsTickSnapshot) {
    const p = physicsTickSnapshot;
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(X(p.time), Z(toGroundClearance(p.ball.position.z)), 5.5, 0, Math.PI * 2); c.fill();
  }
}
function render() {
  if (!physicsTickSnapshot) return;
  topDown(); sideView();
  if(playersShown)renderPlayerReadout();
  const s = physicsTickSnapshot, p = s.ball.position, v = s.ball.velocity;
  byId('tick').textContent = fmt(s.time) + ' s';
  byId('height').textContent = fmt(toGroundClearance(p.z)) + ' m';
  byId('position').textContent = [p.x, p.y, toGroundClearance(p.z)].map(fmt).join(', ');
  byId('velocity').textContent = [v.x, v.y, v.z].map(fmt).join(', ');
  byId('ground').textContent = s.nearGround ? 'On ground' : 'Airborne';
  byId('ground-speed').textContent = fmt(Math.hypot(v.x,v.y)) + ' m/s';
  // LAB-05: display measured first rebound only after observing its apex.
  // Do not conflate the measured simulation with FIFA turf certification.
  const bounceResult=byId('bounce-result');
  const firstPeak=engine.scenario.preset==='bounce'
    ? measureBounceHistory(history).firstReboundHeightM : null;
  bounceResult.hidden=firstPeak===null;
  if(firstPeak!==null) {
    const {min,max}=FIFA_TURF_QUALITY_PRO_REFERENCE_M;
    bounceResult.textContent='1st rebound '+fmt(firstPeak)+' m'+
      (firstPeak>=min&&firstPeak<=max?' · reference range':' · outside reference');
  }
}
// ME-PHYS-03 diagnostic simulations are independent of the active lab engine.
function tableRow(tbody,values) {
  const row=document.createElement('tr');
  values.forEach(value=>{
    const cell=document.createElement('td');
    cell.textContent=value;
    row.appendChild(cell);
  });
  tbody.appendChild(row);
}

function drawRollComparison(runs) {
  const canvas=byId('metrics-roll-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=38,right=w-12,top=37,bottom=h-27;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  const x=t=>left+(right-left)*t/ROLL_OBSERVATION_SECONDS;
  const y=v=>bottom-(bottom-top)*v/6.4;
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='12px system-ui';c.textAlign='center';
  for(const t of [0,4,8,12]){
    c.fillText(String(t),x(t),h-9);
  }
  c.textAlign='right';
  for(const v of [0,2,4,6])c.fillText(String(v),left-7,y(v)+4);
  const colors=['#93dccc','#ffd47c','#82aaf0'];
  for(const [i,run] of runs.entries()){
    c.strokeStyle=colors[i];c.lineWidth=i===1?3:2;
    c.beginPath();
    run.checkpoints.forEach((p,j)=>{
      if(j===0)c.moveTo(x(p.timeS),y(p.speedMps));
      else c.lineTo(x(p.timeS),y(p.speedMps));
    });
    c.stroke();
    const legendX=left+i*155;
    c.fillStyle=colors[i];c.fillRect(legendX,13,15,3);
    c.font='11px system-ui';c.textAlign='left';
    c.fillText(run.launchSpeedMps.toFixed(0)+' m/s'+(run.launchSpeedMps===4?' · base':''),legendX+20,19);
  }
}

// Compare measured contact-point sliding velocity for identical 4 m/s launches.
function drawSpinComparison(trials) {
  const canvas=byId('metrics-spin-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=38,right=w-12,top=37,bottom=h-27;
  const x=t=>left+(right-left)*t/SPIN_OBSERVATION_SECONDS;
  const y=slip=>bottom-(bottom-top)*slip/4.4;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='12px system-ui';c.textAlign='center';
  for(const t of [0,2,4,7])c.fillText(String(t),x(t),h-9);
  c.textAlign='right';
  for(const v of [0,2,4])c.fillText(String(v),left-7,y(v)+4);
  const colors=['#93dccc','#ffd47c','#82aaf0'];
  for(const [i,trial] of trials.entries()){
    c.strokeStyle=colors[i];c.lineWidth=trial.spinFraction===0?3:2;
    c.beginPath();
    trial.checkpoints.forEach((p,j)=>{
      if(j===0)c.moveTo(x(p.timeS),y(p.slipMps));
      else c.lineTo(x(p.timeS),y(p.slipMps));
    });
    c.stroke();
    const lx=left+i*155;
    c.fillStyle=colors[i];c.fillRect(lx,13,15,3);
    c.font='11px system-ui';c.textAlign='left';
    c.fillText(fmt(100*trial.spinFraction)+'% spin',lx+20,19);
  }
}

function renderSpinMetrics(trials) {
  const summary=byId('metrics-spin-rows');
  summary.replaceChildren();
  for(const run of trials){
    const one=run.checkpoints.find(p=>p.timeS===1);
    const travel=run.distanceToStopM??run.finalDistanceM;
    tableRow(summary,[
      fmt(run.spinFraction*100)+'%',
      run.transitionTimeS===null?'Not observed':fmt(run.transitionTimeS),
      run.stoppedAtS===null?'Not reached':fmt(run.stoppedAtS),
      fmt(travel),
      fmt(one.speedMps)+' m/s',
      one.energyRetainedFraction===null?'—':fmt(one.energyRetainedFraction*100)+'%'
    ]);
  }
  const checkpointBody=byId('metrics-spin-checkpoints');
  checkpointBody.replaceChildren();
  for(const item of trials[0].checkpoints){
    tableRow(checkpointBody,[
      fmt(item.timeS)+' s',
      ...trials.map(run=>{
        const p=run.checkpoints.find(v=>v.timeS===item.timeS);
        return fmt(p.speedMps)+' / '+fmt(p.slipMps)+' / '+fmt(p.angularSpeedRadS)+' / '+fmt(p.totalKineticJ);
      })
    ]);
  }
  drawSpinComparison(trials);
}

function drawNaturalGrassComparison(trials) {
  const canvas=byId('metrics-grass-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=38,right=w-12,top=37,bottom=h-27;
  const x=time=>left+(right-left)*time/12;
  const y=speed=>bottom-(bottom-top)*speed/4.4;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='12px system-ui';c.textAlign='center';
  for(const t of [0,4,8,12])c.fillText(String(t),x(t),h-9);
  c.textAlign='right';
  for(const speed of [0,2,4])c.fillText(String(speed),left-7,y(speed)+4);
  const colors=['#93dccc','#ffd47c','#82aaf0'];
  for(const [i,trial] of trials.entries()){
    c.strokeStyle=colors[i];c.lineWidth=trial.isDefault?3:2;c.beginPath();
    trial.checkpoints.forEach((point,j)=>{
      if(j===0)c.moveTo(x(point.timeS),y(point.speedMps));
      else c.lineTo(x(point.timeS),y(point.speedMps));
    });
    c.stroke();
    const lx=left+i*164;
    c.fillStyle=colors[i];c.fillRect(lx,13,15,3);
    c.font='11px system-ui';c.textAlign='left';
    c.fillText(fmt(trial.configuredDecelerationMps2)+(trial.isDefault?' · default':''),lx+20,19);
  }
}

function renderNaturalGrassMetrics(grass) {
  const tbody=byId('metrics-grass-rows');
  tbody.replaceChildren();
  const base=grass.trials.find(t=>t.isDefault);
  const baseDistance=base.distanceToStopM??base.lastObservedDistanceM;
  for(const trial of grass.trials){
    const distance=trial.distanceToStopM??trial.lastObservedDistanceM;
    const difference=distance-baseDistance;
    tableRow(tbody,[
      fmt(trial.configuredDecelerationMps2)+(trial.isDefault?' · default':''),
      trial.observedDecelerationMps2===null?'Not observed':fmt(trial.observedDecelerationMps2),
      fmt(trial.steadyWindowMaxSlipMps),
      trial.stoppedAtS===null?'Not observed':fmt(trial.stoppedAtS),
      fmt(distance),
      trial.isDefault?'Baseline':(difference>=0?'+':'')+fmt(difference)+' m'
    ]);
  }
  const points=byId('metrics-grass-checkpoints');
  points.replaceChildren();
  for(const first of grass.trials[0].checkpoints){
    tableRow(points,[
      fmt(first.timeS)+' s',
      ...grass.trials.map(trial=>{
        const value=trial.checkpoints.find(p=>p.timeS===first.timeS);
        return fmt(value.speedMps)+' / '+fmt(value.distanceM)+' / '+fmt(value.contactSlipMps);
      })
    ]);
  }
  byId('metrics-grass-note').textContent=
    'Observed speed slope fitted over 0.50–2.00 s, with measured max contact slip in that window. '+
    'The experimental 0.80 m/s² default is retained: the reference range does not '+
    'justify changing the one universal Football Architect pitch coefficient.';
  drawNaturalGrassComparison(grass.trials);
}

function drawFlightBaseline(report) {
  const canvas=byId('metrics-flight-chart'),c=canvas.getContext('2d');
  const width=canvas.width,height=canvas.height,left=38,right=width-12,top=35,bottom=height-27;
  const x=time=>left+(right-left)*time/2.5;
  const y=metres=>bottom-(bottom-top)*metres/7;
  c.fillStyle='#152a34';c.fillRect(0,0,width,height);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.font='12px system-ui';c.fillStyle='#c5dee2';c.textAlign='center';
  for(const t of [0,1,2])c.fillText(String(t),x(t),height-9);
  c.textAlign='right';
  for(const h of [0,2,4,6])c.fillText(String(h),left-7,y(h)+4);
  for(const [index,key,color] of [[0,'observedClearanceM','#93dccc'],
      [1,'idealClearanceM','#ffd47c']]){
    c.lineWidth=index===0?3:2;c.strokeStyle=color;c.beginPath();
    report.checkpoints.forEach((point,j)=>{
      if(j===0)c.moveTo(x(point.timeS),y(point[key]));
      else c.lineTo(x(point.timeS),y(point[key]));
    });
    c.stroke();
    const legendX=left+index*200;
    c.fillStyle=color;c.fillRect(legendX,13,15,3);
    c.font='11px system-ui';c.textAlign='left';
    c.fillText(index===0?'Rapier':'Ideal (no air forces)',legendX+20,19);
  }
}

function renderFlightMetrics(flight) {
  const tbody=byId('metrics-flight-rows');
  tbody.replaceChildren();
  for(const [label,actual,ideal] of [
    ['First ground contact (s)',flight.observedFirstContactTimeS,flight.idealFirstContactTimeS],
    ['First-flight XY travel (m)',flight.observedFirstContactDistanceM,flight.idealFirstContactDistanceM],
    ['Maximum underside height (m)',flight.observedApex.heightM,flight.idealApex.heightM],
    ['Time of maximum height (s)',flight.observedApex.timeS,flight.idealApex.timeS]
  ])tableRow(tbody,[label,actual===null?'Not observed':fmt(actual),fmt(ideal)]);
  const checkpoints=byId('metrics-flight-checkpoints');
  checkpoints.replaceChildren();
  for(const point of flight.checkpoints)
    tableRow(checkpoints,[
      fmt(point.timeS)+' s',fmt(point.observedClearanceM),
      fmt(point.idealClearanceM),fmt(point.horizontalDifferenceM)
    ]);
  byId('metrics-flight-note').textContent=
    'Maximum airborne deviation from continuous ideal: XY '+
    fmt(flight.maxHorizontalDeviationM)+' m; Z '+fmt(flight.maxVerticalDeviationM)+
    ' m. No drag/Magnus; fixed-step integration differs slightly from ideal calculus.';
  drawFlightBaseline(flight);
}

function drawAirDragComparison(comparison) {
  const canvas=byId('metrics-drag-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=38,right=w-12,top=37,bottom=h-27;
  const x=t=>left+(right-left)*t/2.5;
  const y=metres=>bottom-(bottom-top)*metres/7;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='12px system-ui';c.textAlign='center';
  for(const t of [0,1,2])c.fillText(String(t),x(t),h-9);
  c.textAlign='right';
  for(const v of [0,2,4,6])c.fillText(String(v),left-7,y(v)+4);
  for(const [index,flight,label,color] of [
    [0,comparison.baseline,'Cd=0 baseline','#93dccc'],
    [1,comparison.dragOnly,'Cd=0.24 experimental','#ffd47c']
  ]){
    c.strokeStyle=color;c.lineWidth=index===0?3:2;c.beginPath();
    flight.checkpoints.forEach((p,j)=>{
      if(j===0)c.moveTo(x(p.timeS),y(p.observedClearanceM));
      else c.lineTo(x(p.timeS),y(p.observedClearanceM));
    });
    c.stroke();
    const lx=left+index*207;
    c.fillStyle=color;c.fillRect(lx,13,15,3);
    c.font='11px system-ui';c.textAlign='left';c.fillText(label,lx+20,19);
  }
}
function renderAirDragMetrics(comparison) {
  const base=comparison.baseline,drag=comparison.dragOnly;
  const rows=byId('metrics-drag-rows');rows.replaceChildren();
  const data=[
    ['First ground contact (s)',base.observedFirstContactTimeS,drag.observedFirstContactTimeS],
    ['First-flight XY travel (m)',base.observedFirstContactDistanceM,drag.observedFirstContactDistanceM],
    ['Maximum underside height (m)',base.observedApex.heightM,drag.observedApex.heightM],
    ['Apex time (s)',base.observedApex.timeS,drag.observedApex.timeS]
  ];
  for(const [label,a,b] of data)
    tableRow(rows,[label,a===null?'Not observed':fmt(a),b===null?'Not observed':fmt(b)]);
  const points=byId('metrics-drag-checkpoints');points.replaceChildren();
  for(const p of base.checkpoints){
    const d=drag.checkpoints.find(q=>q.timeS===p.timeS);
    tableRow(points,[
      fmt(p.timeS)+' s',
      fmt(p.observedClearanceM)+' / '+fmt(p.horizontalDistanceM),
      d?fmt(d.observedClearanceM)+' / '+fmt(d.horizontalDistanceM):'After contact'
    ]);
  }
  byId('metrics-drag-note').textContent=
    'First-flight distance change: '+
    (comparison.distanceDeltaM===null?'Not observed':
      (comparison.distanceDeltaM>=0?'+':'')+fmt(comparison.distanceDeltaM)+' m')+
    '; apex change: '+(comparison.apexDeltaM>=0?'+':'')+fmt(comparison.apexDeltaM)+
    ' m. Drag-only diagnostic, no Magnus or wind; normal LAB-02 remains Cd=0.';
  drawAirDragComparison(comparison);
}


function drawSpeedDragCurve(report) {
  const canvas=byId('metrics-speed-curve-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=45,right=w-15,top=35,bottom=h-27;
  const x=v=>left+(right-left)*v/35,y=cd=>bottom-(bottom-top)*cd/0.5;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const v of [0,7,12,19,32,35])c.fillText(String(v),x(v),h-9);
  c.textAlign='right';
  for(const v of [0,0.2,0.4])c.fillText(v.toFixed(2),left-7,y(v)+4);
  c.strokeStyle='#93dccc';c.lineWidth=2;c.beginPath();
  report.knots.forEach((k,i)=>i?c.lineTo(x(k.speedMps),y(k.cd)):
    c.moveTo(x(k.speedMps),y(k.cd)));c.stroke();
  for(const k of report.knots){
    c.fillStyle=k.evidence.startsWith('Euro')?'#ffd47c':'#93dccc';
    c.beginPath();c.arc(x(k.speedMps),y(k.cd),3.5,0,2*Math.PI);c.fill();
  }
  c.font='11px system-ui';c.fillStyle='#93dccc';c.textAlign='left';
  c.fillText('Hypothesis / interpolated',left+4,17);
  c.fillStyle='#ffd47c';c.fillText('Measured: 19 & 32 m/s',left+240,17);
}
function drawSpeedDragRange(report) {
  const canvas=byId('metrics-speed-range-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=40,right=w-16,top=34,bottom=h-27;
  const x=v=>left+(right-left)*(v-7)/(30-7);
  const y=v=>bottom-(bottom-top)*v/70;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const v of [7,15,30])c.fillText(String(v),x(v),h-9);
  c.textAlign='right';
  for(const v of [0,20,40,60])c.fillText(String(v),left-7,y(v)+4);
  for(const [i,key,label,color] of [
    [0,'zero','Cd=0','#93dccc'],
    [1,'fixed','Cd=0.24','#ffd47c'],
    [2,'variable','Cd(v)','#a8a6ff']
  ]){
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();
    report.trials.forEach((t,j)=>{
      const v=t[key].observedFirstContactDistanceM;
      if(v===null)return;
      if(j===0)c.moveTo(x(t.launchVxMps),y(v));
      else c.lineTo(x(t.launchVxMps),y(v));
    });
    c.stroke();
    c.fillStyle=color;c.font='11px system-ui';c.textAlign='left';
    c.fillRect(left+i*145,13,13,3);c.fillText(label,left+i*145+18,18);
  }
}
function renderSpeedDragMetrics(report) {
  const rows=byId('metrics-speed-rows'),points=byId('metrics-speed-checkpoints');
  rows.replaceChildren();points.replaceChildren();
  for(const trial of report.trials){
    for(const [key,label] of [['zero','Cd=0'],['fixed','Cd=0.24'],['variable','Cd(v)']]){
      const run=trial[key];
      tableRow(rows,[
        fmt(trial.launchVxMps),label,fmt(run.initialCd),fmt(run.cdAtOneSecond),
        run.observedFirstContactTimeS===null?'Not observed':fmt(run.observedFirstContactTimeS),
        run.observedFirstContactDistanceM===null?'Not observed':fmt(run.observedFirstContactDistanceM),
        fmt(run.observedApex.heightM),fmt(run.mechanicalEnergyLostAtOneSecondJ)
      ]);
    }
    for(const p of trial.zero.checkpoints){
      const cell=k=>{
        const found=trial[k].checkpoints.find(q=>q.timeS===p.timeS);
        return found?fmt(found.clearanceM)+' / '+fmt(found.distanceM):'Not observed';
      };
      tableRow(points,[fmt(trial.launchVxMps),fmt(p.timeS)+' s',
        cell('zero'),cell('fixed'),cell('variable')]);
    }
  }
  byId('metrics-speed-note').textContent=
    'Experimental continuous Cd(v) sensitivity; only 19/32 m/s Cd reference values '+
    'and the approximate 12 m/s transition are supported by the cited study. '+
    'Low-speed knots and interpolation are hypotheses. Energy lost is measured '+ 
    'mechanical energy change by 1s (includes Rapier numerical effects), not isolated aerodynamic work. '+
    'No wind/Magnus, no active-world mutation, normal LAB-02 remains Cd=0, one universal grass model.';
  drawSpeedDragCurve(report);drawSpeedDragRange(report);
}


function drawMagnusSeries(report, canvasId, keys, metric) {
  const canvas=byId(canvasId),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=40,right=w-13,top=37,bottom=h-28;
  const selected=keys.map(k=>report.runs.find(run=>run.key===k.key));
  const lastTime=Math.max(2,...selected.map(run=>run.trail.at(-1)?.timeS??0));
  const values=selected.flatMap(run=>run.trail.map(p=>
    metric==='lateral'?p.lateralM:p.heightM));
  const bound=Math.max(metric==='lateral'?0.5:2,...values.map(Math.abs))*1.1;
  const x=t=>left+(right-left)*t/lastTime;
  const y=value=>metric==='lateral'?
    bottom-(bottom-top)*(value+bound)/(2*bound):
    bottom-(bottom-top)*value/bound;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  if(metric==='lateral'){
    c.beginPath();c.moveTo(left,y(0));c.lineTo(right,y(0));c.stroke();
  }
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const t of [0,1,2,3]){
    if(t<=lastTime)c.fillText(String(t),x(t),h-9);
  }
  c.textAlign='right';
  for(const v of metric==='lateral'?[-bound,0,bound]:[0,bound/2,bound]){
    c.fillText(v.toFixed(1),left-7,y(v)+4);
  }
  keys.forEach((entry,i)=>{
    const run=selected[i];
    c.strokeStyle=entry.color;c.lineWidth=2;c.beginPath();
    run.trail.forEach((p,j)=>{
      const value=metric==='lateral'?p.lateralM:p.heightM;
      if(j)c.lineTo(x(p.timeS),y(value));
      else c.moveTo(x(p.timeS),y(value));
    });c.stroke();
    c.fillStyle=entry.color;c.fillRect(left+i*154,13,13,3);
    c.textAlign='left';c.fillText(entry.label,left+i*154+18,19);
  });
}

function renderMagnusMetrics(report) {
  const rows=byId('metrics-magnus-rows'),points=byId('metrics-magnus-checkpoints');
  rows.replaceChildren();points.replaceChildren();
  for(const run of report.runs){
    const flight=run.flight;
    tableRow(rows,[
      run.label,fmt(run.initialSpinRps),fmt(run.spinAtOneRps),
      fmt(run.liftClAtOne),fmt(run.lateralAtOneM),
      fmt(flight.observedApex.heightM),
      flight.observedFirstContactDistanceM===null?'Not observed':
        fmt(flight.observedFirstContactDistanceM),
      flight.observedFirstContactTimeS===null?'Not observed':
        fmt(flight.observedFirstContactTimeS),
      fmt(run.translationPotentialEnergyDeltaAtOneJ)
    ]);
    for(const point of run.checkpoints){
      tableRow(points,[run.label,fmt(point.timeS)+' s',
        point.observed?fmt(point.lateralM)+' / '+fmt(point.heightM):'Not observed']);
    }
  }
  byId('metrics-magnus-note').textContent=
    'Side-spin sign symmetry residual at 1 s: '+
    fmt(report.measuredSignSymmetryAtOneM)+' m; baseline Cd='+fmt(report.dragCd)+
    ' is the SAME experimental drag in all five runs. Cl slope and cap are '+
    'hypotheses, not calibrated soccer-ball coefficients. Mechanical energy '+
    'change is translational kinetic + gravitational potential; excludes spin '+
    'energy and includes integration error. No gameplay Magnus, no wind or '+
    'new field profiles; normal LAB-02 remains Cd=0.';
  drawMagnusSeries(report,'metrics-magnus-side-chart',[
    {key:'side-positive',label:'+Side spin',color:'#93dccc'},
    {key:'none',label:'No spin',color:'#c5dee2'},
    {key:'side-negative',label:'−Side spin',color:'#ffd47c'}
  ],'lateral');
  drawMagnusSeries(report,'metrics-magnus-height-chart',[
    {key:'topspin',label:'Topspin',color:'#ffd47c'},
    {key:'none',label:'No spin',color:'#c5dee2'},
    {key:'backspin',label:'Backspin',color:'#a8a6ff'}
  ],'height');
}


function drawCombinedFlightComparison(report, id, lines, measure, maximum) {
  const canvas=byId(id),c=canvas.getContext('2d');
  const width=canvas.width,height=canvas.height,left=42,right=width-14,top=32,bottom=height-26;
  const yLimit=Math.max(1,maximum)*1.2;
  const x=value=>left+(right-left)*(measure==='lateral'?value/2.5:(value-7)/(30-7));
  const y=value=>measure==='lateral'?
    bottom-(bottom-top)*(value+yLimit)/(2*yLimit):
    bottom-(bottom-top)*value/yLimit;
  c.fillStyle='#152a34';c.fillRect(0,0,width,height);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  if(measure==='lateral'){c.beginPath();c.moveTo(left,y(0));c.lineTo(right,y(0));c.stroke();}
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const v of measure==='lateral'?[0,0.5,1,1.5,2,2.5]:[7,15,30])
    c.fillText(String(v),x(v),height-9);
  c.textAlign='right';
  for(const v of measure==='lateral'?[-yLimit,0,yLimit]:[0,yLimit/2,yLimit])
    c.fillText(v.toFixed(1),left-5,y(v)+4);
  lines.forEach((line,index)=>{
    const points=line.values;
    c.strokeStyle=line.color;c.lineWidth=2;c.beginPath();
    points.forEach((p,i)=>i?c.lineTo(x(p[0]),y(p[1])):c.moveTo(x(p[0]),y(p[1])));
    c.stroke();c.fillStyle=line.color;c.fillRect(left+index*124,11,12,3);
    c.font='11px system-ui';c.textAlign='left';c.fillText(line.label,left+index*124+16,17);
  });
}
function renderCombinedFlightMetrics(report) {
  const rows=byId('metrics-combined-rows'),points=byId('metrics-combined-checkpoints');
  rows.replaceChildren();points.replaceChildren();
  const keys=report.modes.map(m=>m.key);
  for(const trial of report.trials){
    for(const mode of report.modes){
      const r=trial[mode.key];
      tableRow(rows,[
        fmt(trial.vxMps),trial.spinLabel+' ('+(trial.spinRps===0?'0':'±'+fmt(trial.spinRps))+')',
        mode.label,fmt(r.cdAtOne),fmt(r.clAtOne),fmt(r.lateralAtOneM),
        fmt(r.apexHeightM),
        r.firstFlightDistanceM===null?'Not observed':fmt(r.firstFlightDistanceM),
        r.firstContactTimeS===null?'Not observed':fmt(r.firstContactTimeS),
        fmt(r.mechanicalEnergyDeltaAtOneJ)
      ]);
    }
    for(const timeS of report.checkpointSeconds){
      const cell=key=>{
        const cp=trial[key].checkpoints.find(p=>p.timeS===timeS);
        return cp?.observed?fmt(cp.lateralM)+' / '+fmt(cp.heightM):'Not observed';
      };
      tableRow(points,[fmt(trial.vxMps),trial.spinLabel,fmt(timeS)+' s',...keys.map(cell)]);
    }
  }
  byId('metrics-combined-note').textContent=
    '36 measured worlds · same initial actual Rapier spin within each matched group. '+
    'No-spin Magnus-only equals no forces; no-spin combined equals Cd(v)-only. '+
    'Instantaneous lift power = F_lift · velocity = 0 (up to numerical rounding). '+
    'Cd(v) and Cl are research hypotheses, not global calibrated ball coefficients. '+
    'Energy is translational plus gravitational, excluding rotational energy; '+
    'discrete solver effects apply. Normal LAB-02 stays Cd=0, zero Magnus, one universal grass.';
  const at=(vx,spin)=>report.trials.find(t=>t.vxMps===vx&&t.spinKey===spin);
  const tracks=[
    {key:'combined',spin:'positive',label:'Both +Z',color:'#93dccc'},
    {key:'combined',spin:'negative',label:'Both −Z',color:'#ffd47c'},
    {key:'drag',spin:'positive',label:'Drag only',color:'#c5dee2'}
  ].map(line=>({
    ...line,values:at(15,line.spin)[line.key].trail
      .filter(p=>p.timeS<=2.5).map(p=>[p.timeS,p.lateralM])
  }));
  const lateralLimit=Math.max(1,...tracks.flatMap(l=>l.values.map(p=>Math.abs(p[1]))));
  drawCombinedFlightComparison(report,'metrics-combined-side-chart',tracks,'lateral',lateralLimit);
  const ranges=[
    {key:'baseline',label:'No forces',color:'#c5dee2'},
    {key:'drag',label:'Cd(v)',color:'#93dccc'},
    {key:'magnus',label:'Magnus',color:'#ffd47c'},
    {key:'combined',label:'Combined',color:'#a8a6ff'}
  ].map(line=>({
    ...line,values:report.launchVxMps.map(v=>[v,at(v,'positive')[line.key].firstFlightDistanceM])
  }));
  const upper=Math.max(20,...ranges.flatMap(line=>line.values.map(point=>point[1]??0)));
  drawCombinedFlightComparison(report,'metrics-combined-distance-chart',ranges,'distance',upper);
}


function drawCalibrationAudit(report,canvasId,kind) {
  const canvas=byId(canvasId),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=46,right=w-16,top=32,bottom=h-27;
  const side=kind==='side',maxX=side?0.4:35,maxY=side?0.35:0.5;
  const x=value=>left+(right-left)*value/maxX;
  const y=value=>bottom-(bottom-top)*value/maxY;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const v of side?[0,0.1,0.2,0.3,0.4]:[0,7,12,19,32,35])
    c.fillText(side?v.toFixed(1):String(v),x(v),h-9);
  c.textAlign='right';
  for(const v of side?[0,0.1,0.2,0.3]:[0,0.2,0.4])
    c.fillText(v.toFixed(2),left-7,y(v)+4);
  c.strokeStyle='#93dccc';c.lineWidth=2;c.beginPath();
  const data=side?report.sideAnchors:report.dragAnchors;
  const knots=side?report.currentMagnusSlope:null;
  for(let i=0;i<=140;i++){
    const value=maxX*i/140;
    const coefficient=side?Math.min(report.currentMagnusCap,knots*value):
      // The drag audit uses source-backed values from the shared Cd(v)
      // evaluator at render time, supplied by the physics-diagnostics report.
      speedDependentDragCdForPlot(value);
    i?c.lineTo(x(value),y(coefficient)):c.moveTo(x(value),y(coefficient));
  }
  c.stroke();
  c.fillStyle='#ffd47c';
  for(const point of data){
    const vx=side?point.meanSpinParameter:point.airspeedMps;
    const coeff=side?point.measuredMeanCs:point.measuredCd;
    c.beginPath();c.arc(x(vx),y(coeff),4,0,Math.PI*2);c.fill();
  }
  c.font='11px system-ui';c.textAlign='left';
  c.fillStyle='#93dccc';c.fillText('Existing prototype',left,16);
  c.fillStyle='#ffd47c';c.fillText('Published anchors',left+175,16);
}

function renderCalibrationEvidence(report){
  const drag=byId('metrics-calibration-drag-rows'),
    side=byId('metrics-calibration-side-rows');
  drag.replaceChildren();side.replaceChildren();
  for(const point of report.dragAnchors)
    tableRow(drag,[fmt(point.airspeedMps),fmt(point.measuredCd),
      fmt(point.prototypeCd),fmt(point.signedDifference)]);
  for(const point of report.sideAnchors)
    tableRow(side,[fmt(point.meanSpinParameter),fmt(point.measuredMeanCs),
      fmt(point.currentProxyCl),fmt(point.signedDifference)]);
  byId('metrics-calibration-note').textContent=
    report.stage+' · Mean absolute (indicative, NOT calibrated) Cs vs current Cl '+
    'difference at three published mean-Sp samples = '+
    fmt(report.meanAbsSideDifference)+
    '. Agreement at two Cd anchors is by construction, NOT independent validation. '+
    report.keyFinding+' Reference provenance: '+report.referenceBall+'. Calibration blocked: '+report.blockers.join(' ');
  drawCalibrationAudit(report,'metrics-calibration-cd-chart','drag');
  drawCalibrationAudit(report,'metrics-calibration-cs-chart','side');
}


function drawUniversalBallReadiness(report) {
  const canvas=byId('metrics-universal-range-chart'),c=canvas.getContext('2d');
  const width=canvas.width,height=canvas.height,left=66,right=width-18,top=29,bottom=height-33;
  const min=45,max=55;
  const x=v=>left+(right-left)*(v-min)/(max-min);
  c.fillStyle='#152a34';c.fillRect(0,0,width,height);
  c.strokeStyle='#587079';c.lineWidth=1;c.beginPath();
  c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.font='11px system-ui';c.fillStyle='#c5dee2';c.textAlign='center';
  for(const value of [45,47,49,51,53,55])c.fillText(String(value),x(value),height-13);
  const marks=report.orientationEvidence.orientations;
  const palette=['#93dccc','#ffd47c'];
  marks.forEach((o,i)=>{
    const y=top+28+i*37;
    c.strokeStyle=palette[i];c.lineWidth=3;
    c.beginPath();c.moveTo(x(min),y);c.lineTo(x(o.rangeM),y);c.stroke();
    c.fillStyle=palette[i];c.beginPath();c.arc(x(o.rangeM),y,4,0,2*Math.PI);c.fill();
    c.fillStyle='#c5dee2';c.textAlign='right';c.fillText(o.key,left-9,y+4);
    c.textAlign='left';c.fillText(o.rangeM.toFixed(2)+' m',x(o.rangeM)+9,y+4);
  });
  c.fillStyle='#c5dee2';c.textAlign='center';
  c.fillText('Calculated range (m), NOT measured trajectories',width/2,height-2);
}

function renderUniversalBallReadiness(report) {
  const orientation=byId('metrics-universal-orientation-rows');
  const gates=byId('metrics-universal-gates');
  orientation.replaceChildren();gates.replaceChildren();
  for(const o of report.orientationEvidence.orientations){
    tableRow(orientation,[
      o.key,fmt(o.rangeM),fmt(o.subcriticalMeanCd),
      fmt(o.supercriticalMeanCd),fmt(o.fullRangeMeanCd)
    ]);
  }
  for(const gate of report.gates){
    tableRow(gates,[gate.name,gate.state.toUpperCase(),gate.reason]);
  }
  byId('metrics-universal-range-note').textContent=
    'One physical Trionda specimen, A-90 vs B-90 static orientations at 30 m/s '+
    'and 30°: modeled range difference '+fmt(report.orientationSpanM)+
    ' m ('+fmt(report.orientationSpanPercentOfMean)+'% of the mean). '+
    'Published results are simulations from wind-tunnel Cd(v), NOT observed landings.';
  byId('metrics-universal-readiness').textContent=
    report.stage+' · available '+report.summary.available+
    ' / partial '+report.summary.partial+' / missing '+report.summary.missing+
    '. Gameplay calibration approved: NO. '+report.nextEvidenceRequest+' '+
    report.note;
  drawUniversalBallReadiness(report);
}


function renderCalibrationDatasetIntake(report){
  const rows=byId('metrics-intake-sources');
  rows.replaceChildren();
  for(const source of report.sources){
    tableRow(rows,[
      source.label,source.evidence+' · '+source.access,
      source.calibrationRole.toUpperCase(),source.holdoutRole.toUpperCase()
    ]);
  }
  byId('metrics-intake-status').textContent=report.stage+
    ' · verified matched bundles: '+report.verifiedMatchedBundles+
    '. Gameplay eligibility: NO. '+report.rightsBlocker+' '+report.scope;
}


// ME-PHYS-18 — draw actual, pre-contact Rapier positions, not a parametric
// bend approximation. The TOP view shares one pixel-per-metre scale across
// forward and lateral directions; choosing another speed changes the zoom
// and displays that scale explicitly. The side view labels its own axes.
function drawLiteratureFlightTrajectories(report,vxMps){
  const speed=report.speeds.find(v=>v===vxMps)??30;
  const runs=report.cases.filter(c=>c.vxMps===speed);
  const pick=key=>runs.find(r=>r.spinKey===key);
  if(runs.length!==3)throw new Error('Incomplete literature trajectory A/B');
  const series=[
    {spin:'plus',model:'current',color:'#93dccc',dash:[],label:'Old +Z'},
    {spin:'plus',model:'literature',color:'#ffd47c',dash:[],label:'Candidate +Z'},
    {spin:'minus',model:'current',color:'#93dccc',dash:[6,4],label:'Old −Z'},
    {spin:'minus',model:'literature',color:'#ffd47c',dash:[6,4],label:'Candidate −Z'},
    {spin:'none',model:'literature',color:'#c5dee2',dash:[3,5],label:'No spin'}
  ].map(spec=>({
    ...spec,
    run:pick(spec.spin)[spec.model]
  }));
  const all=series.flatMap(line=>[
    ...line.run.preContactTrail,
    ...(line.run.firstContactPoint?[line.run.firstContactPoint]:[])
  ]);
  const maxForward=Math.max(1,...all.map(p=>p.forwardM));
  const maxSide=Math.max(1,...all.map(p=>Math.abs(p.lateralM)));
  const maxHeight=Math.max(1,...all.map(p=>p.undersideM));
  const sky='#152a34',grid='#526873',text='#c5dee2';
  const draw=(id,view)=>{
    const canvas=byId(id),ctx=canvas.getContext('2d');
    const w=canvas.width,h=canvas.height;
    const l=49,r=w-14,t=31,b=h-33,cy=(t+b)/2;
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    const map=view==='top'?
      // Equal px/m in both axes: no visual exaggeration of the curve.
      (()=>{const scale=Math.min((r-l-8)/(maxForward*1.08),
        (b-t-12)/(2*maxSide*1.12));
        return {scale, x:p=>l+p.forwardM*scale,
          y:p=>cy-p.lateralM*scale,
          topRange:(b-t)/(2*scale)};})():
      (()=>{const xs=(r-l-8)/(maxForward*1.08),zs=(b-t-8)/(maxHeight*1.12);
        return {scale:xs,x:p=>l+p.forwardM*xs,
          y:p=>b-p.undersideM*zs,verticalScale:zs};})();
    ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(l,t);ctx.lineTo(l,b);
    ctx.lineTo(r,b);if(view==='top'){ctx.moveTo(l,cy);ctx.lineTo(r,cy);}
    ctx.stroke();
    ctx.font='11px system-ui';ctx.fillStyle=text;ctx.textAlign='center';
    const tick=maxForward>30?10:maxForward>14?5:2;
    for(let q=0;q<=maxForward*1.04;q+=tick){
      ctx.fillText(String(q),l+q*map.scale,h-11);
    }
    ctx.textAlign='right';
    const ymax=view==='top'?Math.max(2,Math.floor(map.topRange)):Math.ceil(maxHeight);
    const yTick=view==='top'?(ymax>=8?5:ymax>=4?2:1):(ymax>=6?2:1);
    if(view==='top'){
      for(let v=-ymax;v<=ymax;v+=yTick){
        const yy=cy-v*map.scale;if(yy>=t&&yy<=b)
          ctx.fillText(String(v),l-7,yy+4);
      }
    }else{
      for(let v=0;v<=ymax;v+=yTick)
        ctx.fillText(String(v),l-7,b-v*map.verticalScale+4);
    }
    ctx.fillStyle=text;ctx.textAlign='left';
    ctx.fillText(view==='top'?'Y lateral (m)':'Z underside (m)',l+2,16);
    ctx.textAlign='right';ctx.fillText('X forward (m)',r,16);
    ctx.save();ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
    for(const line of series){
      const path=[...line.run.preContactTrail];
      if(line.run.firstContactPoint)path.push(line.run.firstContactPoint);
      ctx.strokeStyle=line.color;ctx.lineWidth=line.spin==='none'?1.3:2.3;
      ctx.setLineDash(line.dash);ctx.beginPath();
      path.forEach((p,i)=>i?ctx.lineTo(map.x(p),map.y(p)):
        ctx.moveTo(map.x(p),map.y(p)));
      ctx.stroke();ctx.setLineDash([]);
      if(line.run.oneSecondPoint&&line.spin!=='none'){
        const p=line.run.oneSecondPoint;
        ctx.fillStyle=line.color;ctx.beginPath();
        ctx.arc(map.x(p),map.y(p),3,0,Math.PI*2);ctx.fill();
      }
      if(line.run.firstContactPoint&&line.spin!=='none'){
        const p=line.run.firstContactPoint,x=map.x(p),y=map.y(p);
        ctx.beginPath();ctx.moveTo(x-3,y-3);ctx.lineTo(x+3,y+3);
        ctx.moveTo(x-3,y+3);ctx.lineTo(x+3,y-3);
        ctx.strokeStyle=line.color;ctx.stroke();
      }
    }
    ctx.restore();
    return map.scale;
  };
  const scale=draw('metrics-literature-topdown','top');
  draw('metrics-literature-elevation','side');
  byId('metrics-literature-trajectory-note').textContent=
    speed+' m/s (forward X launch), vz=10 m/s, 0/±6 rev/s Z; '+
    'top-down 1:1 axes ('+scale.toFixed(1)+' px per metre, speed-specific zoom). '+
    'Teal = previous, amber = candidate, gray = no spin; solid +Z / dashed −Z; '+
    'dot = 1 s, cross = first ground contact. All paths stop at contact. '+
    'Side view has separately labelled vertical scale. Simulated, NOT measured.';
}


let stopFlightPlayback=()=>{};
let pauseFlightPlayback=()=>{};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseFlightPlayback();});

// Playback has NO Rapier reference and never steps, resets or mutates the LAB.
// The original fixed-step observations are immutable and each model freezes
// at its own recorded first contact. Interpolation only smooths those points.
function drawAnimatedFlightPair(state){
  const pair=state.pair,frame=sampleFlightPlaybackPair(pair,state.timeS);
  const runs=[
    {label:'Previous',run:pair.previous,point:frame.previous,color:'#93dccc'},
    {label:'Candidate',run:pair.candidate,point:frame.candidate,color:'#ffd47c'}
  ];
  const all=runs.flatMap(r=>r.run.points);
  // Fix the visual frame for BOTH spin signs at a given speed, so
  // switching +Z to -Z cannot silently change the displayed zoom.
  const maxX=Math.max(1,...all.map(p=>p.forwardM),state.bounds.maxX);
  const maxY=Math.max(1,...all.map(p=>Math.abs(p.lateralM)),state.bounds.maxY);
  const maxZ=Math.max(1,...all.map(p=>p.undersideM),state.bounds.maxZ);
  const draw=(id,mode)=>{
    const canvas=byId(id),ctx=canvas.getContext('2d');
    const w=canvas.width,h=canvas.height,l=49,r=w-14,t=27,b=h-32,mid=(t+b)/2;
    const scale=mode==='xy'?
      Math.min((r-l-8)/(maxX*1.1),(b-t-12)/(2*maxY*1.12)):
      (r-l-8)/(maxX*1.1);
    const scaleZ=(b-t-8)/(maxZ*1.12);
    const x=p=>l+p.forwardM*scale;
    const y=p=>mode==='xy'?mid-p.lateralM*scale:b-p.undersideM*scaleZ;
    ctx.fillStyle='#152a34';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#526873';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(l,t);ctx.lineTo(l,b);ctx.lineTo(r,b);
    if(mode==='xy'){ctx.moveTo(l,mid);ctx.lineTo(r,mid);}ctx.stroke();
    ctx.fillStyle='#c5dee2';ctx.font='11px system-ui';ctx.textAlign='left';
    ctx.fillText(mode==='xy'?'Y lateral (m) · equal XY scale':'Z clearance (m)',l+2,14);
    ctx.textAlign='right';ctx.fillText('X forward (m)',r,14);
    ctx.textAlign='center';
    const step=maxX>30?10:maxX>14?5:2;
    for(let v=0;v<=maxX;v+=step)ctx.fillText(String(v),l+v*scale,h-10);
    ctx.textAlign='right';
    const limit=mode==='xy'?Math.floor((b-t)/(2*scale)):Math.ceil(maxZ);
    const tick=limit>=8?5:limit>=4?2:1;
    if(mode==='xy'){
      for(let v=-limit;v<=limit;v+=tick){
        const pos=mid-v*scale;if(pos>=t&&pos<=b)ctx.fillText(String(v),l-7,pos+4);
      }
    }else{
      for(let v=0;v<=limit;v+=tick){
        const pos=b-v*scaleZ;if(pos>=t&&pos<=b)ctx.fillText(String(v),l-7,pos+4);
      }
    }
    ctx.save();ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
    for(const line of runs){
      const path=line.run.points;
      const trace=(points)=>{
        ctx.beginPath();
        points.forEach((p,i)=>i?ctx.lineTo(x(p),y(p)):ctx.moveTo(x(p),y(p)));
        ctx.stroke();
      };
      ctx.strokeStyle=line.color;ctx.lineWidth=1;
      ctx.globalAlpha=0.23;trace(path);ctx.globalAlpha=1;
      ctx.lineWidth=2.3;
      const covered=path.filter(p=>p.timeS<=line.point.timeS+1e-9);
      if(!covered.length)covered.push(path[0]);
      if(Math.abs(covered.at(-1).timeS-line.point.timeS)>1e-8)
        covered.push(line.point);
      trace(covered);
      const px=x(line.point),py=y(line.point);
      ctx.beginPath();ctx.arc(px,py,line.label==='Previous'?7:4.5,0,Math.PI*2);
      if(line.label==='Previous'){ctx.strokeStyle=line.color;ctx.lineWidth=2.8;ctx.stroke();}
      else{ctx.fillStyle=line.color;ctx.fill();}
      if(line.point.phase==='contact'){
        ctx.strokeStyle=line.color;ctx.lineWidth=1.5;ctx.beginPath();
        ctx.moveTo(px-7,py-7);ctx.lineTo(px+7,py+7);
        ctx.moveTo(px-7,py+7);ctx.lineTo(px+7,py-7);ctx.stroke();
      }
    }
    ctx.restore();
    return scale;
  };
  const pixelPerMetre=draw('metrics-animation-topdown','xy');
  draw('metrics-animation-elevation','xz');
  const timeOutput=byId('metrics-animation-time');
  timeOutput.textContent=frame.timeS.toFixed(2)+' s';
  byId('metrics-animation-timeline').value=String(Math.round(frame.timeS*100));
  const status=byId('metrics-animation-status');
  const lastPhases=status.dataset.phasePrevious+'/'+status.dataset.phaseCandidate;
  status.dataset.phasePrevious=frame.previous.phase;
  status.dataset.phaseCandidate=frame.candidate.phase;
  status.dataset.timeS=frame.timeS.toFixed(3);
  const p=frame.previous,c=frame.candidate;
  const gapM=Math.hypot(c.forwardM-p.forwardM,c.lateralM-p.lateralM);
  status.dataset.horizontalGapM=gapM.toFixed(3);
  status.dataset.previousLateralM=p.lateralM.toFixed(3);
  status.dataset.candidateLateralM=c.lateralM.toFixed(3);
  status.textContent=
    'Previous: '+p.phase+' (contact '+pair.previous.impactTimeS.toFixed(2)+' s) · '+
    'Candidate: '+c.phase+' (contact '+pair.candidate.impactTimeS.toFixed(2)+' s). '+
    'Lateral Y: '+p.lateralM.toFixed(2)+' / '+c.lateralM.toFixed(2)+' m · '+
    'XY separation: '+gapM.toFixed(2)+' m. '+
    'Top-down 1:1: '+pixelPerMetre.toFixed(1)+' px/m. Simulated only.';
  // Update the screen-reader live region ONLY for actual contact-phase
  // transitions. The frame-by-frame text above must not speak at 60Hz.
  if(lastPhases!==p.phase+'/'+c.phase)
    byId('metrics-animation-announcement').textContent=
      'Previous ball '+p.phase+', candidate ball '+c.phase+
      ', at '+frame.timeS.toFixed(2)+' seconds.';
}
function configureAnimatedFlightPair(report){
  stopFlightPlayback(); // Cancel previous RAF when reopening/recalculating Metrics.
  const speed=byId('metrics-animation-speed');
  const legacySpeed=byId('metrics-literature-speed');
  const spin=byId('metrics-animation-spin');
  const slider=byId('metrics-animation-timeline');
  const play=byId('metrics-animation-play');
  const reset=byId('metrics-animation-reset');
  const state={pair:null,timeS:0,playing:false,startedAtMs:null,
    playOffsetS:0,raf:null,bounds:null};
  const stop=()=>{
    state.playing=false;state.startedAtMs=null;
    if(state.raf!==null)cancelAnimationFrame(state.raf);
    state.raf=null;play.textContent='Play';
  };
  pauseFlightPlayback=stop;
  stopFlightPlayback=()=>{
    stop();state.timeS=0;
    if(state.pair)drawAnimatedFlightPair(state);
  };
  const choose=()=>{
    stop();
    const vx=Number(speed.value);
    const row=report.cases.find(c=>c.vxMps===vx&&c.spinKey===spin.value);
    state.pair=prepareFlightPlaybackPair(row);
    const both=report.cases.filter(c=>c.vxMps===vx&&
      (c.spinKey==='plus'||c.spinKey==='minus')).map(prepareFlightPlaybackPair);
    const all=both.flatMap(entry=>[
      ...entry.previous.points,...entry.candidate.points
    ]);
    state.bounds={
      maxX:Math.max(1,...all.map(p=>p.forwardM)),
      maxY:Math.max(1,...all.map(p=>Math.abs(p.lateralM))),
      maxZ:Math.max(1,...all.map(p=>p.undersideM))
    };
    state.timeS=0;slider.max=String(Math.ceil(state.pair.durationS*100));
    slider.value='0';
    drawAnimatedFlightPair(state);
  };
  const tick=now=>{
    state.raf=null;
    if(!state.playing)return;
    if(!byId('metrics-dialog').open){stop();return;}
    if(state.startedAtMs===null)state.startedAtMs=now;
    state.timeS=flightPlaybackWallTime({
      startedAtMs:state.startedAtMs,nowMs:now,offsetS:state.playOffsetS,
      durationS:state.pair.durationS
    });
    drawAnimatedFlightPair(state);
    if(state.timeS>=state.pair.durationS){stop();return;}
    state.raf=requestAnimationFrame(tick);
  };
  speed.onchange=()=>{
    legacySpeed.value=speed.value;
    drawLiteratureFlightTrajectories(report,Number(speed.value));
    choose();
  };
  legacySpeed.onchange=()=>{
    speed.value=legacySpeed.value;
    drawLiteratureFlightTrajectories(report,Number(speed.value));
    choose();
  };
  spin.onchange=choose;
  slider.oninput=()=>{
    stop();
    state.timeS=Math.min(state.pair.durationS,Number(slider.value)/100);
    drawAnimatedFlightPair(state);
  };
  play.onclick=()=>{
    if(state.playing){stop();return;}
    if(state.timeS>=state.pair.durationS)state.timeS=0;
    state.playing=true;state.startedAtMs=null;
    state.playOffsetS=state.timeS;
    play.textContent='Pause';
    drawAnimatedFlightPair(state);
    state.raf=requestAnimationFrame(tick);
  };
  reset.onclick=()=>{stop();state.timeS=0;drawAnimatedFlightPair(state);};
  speed.value=legacySpeed.value;
  choose(); // Never autoplay; also respects reduced-motion preferences.
}

function renderAerodynamicDecisionReview(){
  // Pure instantaneous snapshots only: no physics stepping, no parameter fit.
  const audit=reviewAerodynamicCandidate();
  const rows=byId('metrics-aero-review-rows');
  rows.replaceChildren();
  for(const point of audit.rows){
    tableRow(rows,[
      fmt(point.speedMps)+' m/s',
      fmt(point.spinRps)+' rev/s',
      point.spinParameter.toFixed(3),
      point.previousCl.toFixed(3)+' / '+point.candidateCl.toFixed(3),
      point.liftRatio===null?'—':point.liftRatio.toFixed(2)+'×',
      point.previousCd.toFixed(3)+' / '+point.candidateCd.toFixed(3)
    ]);
  }
  byId('metrics-aero-review-verdict').textContent=
    audit.decision+' · at 30 m/s and 6 rev/s, lift coefficient '+
    audit.highSpeed.previousCl.toFixed(3)+' (previous) versus '+
    audit.highSpeed.candidateCl.toFixed(3)+' (candidate), '+
    audit.highSpeed.liftRatio.toFixed(2)+'× at the identical instantaneous speed. '+
    audit.limitation+' Gameplay approved: NO.';
}

function renderSpinAxisDiagnostics(report){
  const rows=byId('metrics-spin-axis-rows');
  rows.replaceChildren();
  const paired=(a,b)=>a===null||b===null?'Not observed':fmt(a)+' / '+fmt(b);
  for(const c of report.cases){
    tableRow(rows,[
      c.label,
      paired(c.previous.initialLiftN.y,c.candidate.initialLiftN.y),
      paired(c.previous.initialLiftN.z,c.candidate.initialLiftN.z),
      paired(c.previous.atOne?.lateralM??null,c.candidate.atOne?.lateralM??null),
      paired(c.previous.atOne?.clearanceM??null,c.candidate.atOne?.clearanceM??null),
      paired(c.previous.firstContactTimeS,c.candidate.firstContactTimeS)
    ]);
  }
  const canvas=byId('metrics-spin-axis-elevation'),ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=50,right=w-14,top=30,bottom=h-30;
  const styles=[
    {key:'none',color:'#c5dee2'},
    {key:'topspin',color:'#ffd47c'},
    {key:'backspin',color:'#93dccc'}
  ];
  const chosen=styles.map(style=>({style,data:report.cases.find(c=>c.key===style.key)}));
  const points=chosen.flatMap(o=>['previous','candidate'].flatMap(mode=>
    [...o.data[mode].trajectory,...(o.data[mode].impact?[o.data[mode].impact]:[])]));
  const maxX=Math.max(1,...points.map(p=>p.forwardM))*1.06;
  const maxZ=Math.max(1,...points.map(p=>p.clearanceM))*1.12;
  const sx=x=>left+x/maxX*(right-left),sy=z=>bottom-z/maxZ*(bottom-top);
  ctx.fillStyle='#152a34';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#587079';ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
  ctx.fillStyle='#c5dee2';ctx.font='11px system-ui';ctx.textAlign='left';
  ctx.fillText('Z clearance (m)',left+4,14);
  ctx.fillText('X (m) — previous dashed / candidate solid',left+132,h-8);
  ctx.textAlign='right';
  for(let n=0;n<=4;n++)ctx.fillText((maxZ*n/4).toFixed(1),left-7,sy(maxZ*n/4)+4);
  ctx.textAlign='center';
  for(let n=0;n<=4;n++)ctx.fillText((maxX*n/4).toFixed(0),sx(maxX*n/4),h-15);
  for(const {style,data} of chosen){
    for(const mode of ['previous','candidate']){
      const trial=data[mode];
      const samples=[...trial.trajectory,...(trial.impact?[trial.impact]:[])];
      ctx.strokeStyle=style.color;ctx.lineWidth=mode==='candidate'?2.5:1.5;
      ctx.setLineDash(mode==='previous'?[5,4]:[]);
      ctx.beginPath();
      samples.forEach((p,i)=>i?ctx.lineTo(sx(p.forwardM),sy(p.clearanceM)):
        ctx.moveTo(sx(p.forwardM),sy(p.clearanceM)));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);ctx.font='11px system-ui';ctx.textAlign='left';
  ctx.fillStyle='#c5dee2';ctx.fillText('No spin',left+7,top+14);
  ctx.fillStyle='#ffd47c';ctx.fillText('Topspin (+Y)',left+78,top+14);
  ctx.fillStyle='#93dccc';ctx.fillText('Backspin (−Y)',left+200,top+14);
  byId('metrics-spin-axis-note').textContent=
    report.independentWorlds+' isolated 60 Hz Rapier flights; launch X 15 m/s, '+
    'VZ 10 m/s, 6 rev/s or zero. All values are previous / candidate. '+
    report.assumption+' Gameplay approved: NO.';
}

function renderSpinDecayDiagnostics(report){
  const rows=byId('metrics-spin-decay-rows');
  rows.replaceChildren();
  const pair=(a,b)=>a===null||b===null?'Not observed':fmt(a)+' / '+fmt(b);
  for(const trial of report.cases){
    const old=trial.previous,latest=trial.candidate;
    tableRow(rows,[trial.label,
      trial.decayRatePerS.toFixed(2)+' s⁻¹',
      pair(old.atOne?.spinRevS??null,latest.atOne?.spinRevS??null),
      pair(old.atOne?.lateralM??null,latest.atOne?.lateralM??null),
      pair(old.atOne?.undersideM??null,latest.atOne?.undersideM??null),
      pair(old.firstContactTimeS,latest.firstContactTimeS)
    ]);
  }
  const canvas=byId('metrics-spin-decay-chart'),ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=48,right=w-14,top=26,bottom=h-32;
  const curves=[
    {rate:0,color:'#c5dee2',name:'0.00'},
    {rate:0.2,color:'#93dccc',name:'0.20'},
    {rate:0.5,color:'#ffd47c',name:'0.50'}
  ];
  const selected=curves.map(c=>({
    ...c,samples:report.cases.find(r=>r.axis==='side-plus'&&r.decayRatePerS===c.rate)
      .previous.checkpoints.filter(Boolean)
  }));
  const maxT=report.checkpoints.at(-1),sx=t=>left+t/maxT*(right-left);
  const sy=spin=>bottom-spin/6.7*(bottom-top);
  ctx.fillStyle='#152a34';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#587079';ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
  ctx.fillStyle='#c5dee2';ctx.font='11px system-ui';ctx.textAlign='left';
  ctx.fillText('Actual spin (rev/s)',left+5,14);
  ctx.fillText('Time in flight (s)',right-95,h-7);
  ctx.textAlign='right';
  for(const n of [0,2,4,6])ctx.fillText(String(n),left-8,sy(n)+4);
  ctx.textAlign='center';
  for(const t of [0,0.5,1,1.5])ctx.fillText(t.toFixed(1),sx(t),h-17);
  for(const line of selected){
    ctx.strokeStyle=line.color;ctx.lineWidth=2.4;ctx.beginPath();
    line.samples.forEach((s,i)=>i?ctx.lineTo(sx(s.timeS),sy(s.spinRevS)):
      ctx.moveTo(sx(s.timeS),sy(s.spinRevS)));
    ctx.stroke();
  }
  ctx.font='11px system-ui';ctx.textAlign='left';
  selected.forEach((line,i)=>{
    ctx.fillStyle=line.color;ctx.fillText('λ='+line.name, left+8+i*96,top+15);
  });
  byId('metrics-spin-decay-note').textContent=
    report.independentWorlds+' independent 60 Hz Rapier flights; '+
    'signed 3D spin, air-only rate comparison, true first-contact cutoff. '+
    'All numeric pairs are previous / candidate. '+
    report.disclaimer+' Gameplay approved: NO.';
}

function renderContactImpactDiagnostics(report){
  const rows=byId('metrics-contact-impact-rows');
  rows.replaceChildren();
  for(const item of report.cases){
    const pre=item.pre,post=item.post;
    tableRow(rows,[
      item.label,
      fmt(pre.verticalSpeedMps),
      fmt(post.verticalSpeedMps),
      fmt(item.effectiveStepRestitution),
      item.firstReboundHeightM===null?'Not observed':fmt(item.firstReboundHeightM),
      fmt(pre.contactSlipMps.magnitude),
      fmt(post.contactSlipMps.magnitude),
      fmt(post.velocityMps.x),
      fmt(item.deltaSpinRevS),
      fmt(item.energyRetainedFraction*100)+'%',
      fmt(item.observedEnergyGainJ)
    ]);
  }
  byId('metrics-contact-impact-note').textContent=
    report.independentWorlds+' disposable 60 Hz Rapier impact worlds; '+
    '4 m/s forward, 2 m underside drop, 6 rev/s signed spin or zero, '+
    'one fixed grass collider. '+report.limitation+
    ' Calibrated to real turf: NO. Gameplay approved: NO.';
}

function renderLiftInputContributions(report){
  const rows=byId('metrics-lift-input-rows');
  rows.replaceChildren();
  const force=v=>Math.abs(v)<0.005?'0.00':fmt(v);
  for(const r of report.rows){
    tableRow(rows,[
      r.ratePerS.toFixed(2)+' s⁻¹',
      r.model==='previous'?'Previous':'Candidate',
      force(r.initialSideLiftN),
      force(r.observedSideLiftN),
      force(r.velocityContributionN),
      force(r.spinContributionN),
      force(r.totalDeltaN),
      force(r.closureResidualN)
    ]);
  }
  byId('metrics-lift-input-note').textContent=
    report.decision+' · 6 rows, 4 pure force evaluations each, '+
    report.newRapierWorlds+' new Rapier worlds; at '+
    fmt(report.timeS)+' s, all trajectories are airborne. '+
    report.caveat+' Gameplay approved: NO.';
}

function renderSpinRetentionReview(report){
  const rows=byId('metrics-spin-retention-rows');
  rows.replaceChildren();
  for(const trial of report.rows){
    tableRow(rows,[
      trial.ratePerS.toFixed(2)+' s⁻¹',
      fmt(trial.previous.spinRetainedFraction*100)+'% / '+
        fmt(trial.candidate.spinRetainedFraction*100)+'%',
      fmt(trial.previous.spinLostFraction*100)+'% / '+
        fmt(trial.candidate.spinLostFraction*100)+'%',
      fmt(trial.previous.lossRatioToPublished)+'× / '+
        fmt(trial.candidate.lossRatioToPublished)+'×'
    ]);
  }
  const study=report.observation;
  byId('metrics-spin-retention-note').textContent=
    report.decision+' · Published single-trial spin retention '+
    fmt(100*study.spinRetainedFraction)+'% in '+
    fmt(study.source.spinIntervalS)+' s (approximately '+
    fmt(study.source.spinInitialRevS)+' → '+fmt(study.source.spinLaterRevS)+
    ' rev/s). Ball-speed retention '+fmt(100*study.speedRetainedFraction)+
    '% in '+fmt(study.source.speedIntervalS)+' s. '+report.note+
    ' Gameplay approved: NO.';
}

function renderLiteratureCandidate(report){
  const rows=byId('metrics-literature-rows');rows.replaceChildren();
  const pair=(a,b)=>fmt(a)+' / '+fmt(b);
  for(const entry of report.cases){
    tableRow(rows,[
      fmt(entry.vxMps)+' m/s',entry.spinLabel,
      pair(entry.current.cdAtOne,entry.literature.cdAtOne),
      pair(entry.current.clAtOne,entry.literature.clAtOne),
      pair(entry.current.lateralAtOneM,entry.literature.lateralAtOneM),
      pair(entry.current.firstFlightDistanceM,entry.literature.firstFlightDistanceM)
    ]);
  }
  renderAerodynamicDecisionReview();
  const speedSelect=byId('metrics-literature-speed');
  drawLiteratureFlightTrajectories(report,Number(speedSelect.value));
  configureAnimatedFlightPair(report);
  byId('metrics-literature-note').textContent=
    report.label+' · '+report.independentWorlds+
    ' independent 60Hz worlds (same initial spin). '+
    'Model calibrated: NO · Gameplay approved: NO. '+report.note;
  const canvas=byId('metrics-literature-cl-chart'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,left=49,right=w-16,top=29,bottom=h-28;
  const sx=value=>left+(right-left)*value/8;
  const sy=value=>bottom-(bottom-top)*value/0.3;
  c.fillStyle='#152a34';c.fillRect(0,0,w,h);
  c.strokeStyle='#587079';c.lineWidth=1;
  c.beginPath();c.moveTo(left,top);c.lineTo(left,bottom);c.lineTo(right,bottom);c.stroke();
  c.fillStyle='#c5dee2';c.font='11px system-ui';c.textAlign='center';
  for(const r of [0,2,4,6,8])c.fillText(String(r),sx(r),h-8);
  c.textAlign='right';
  for(const cl of [0,0.1,0.2,0.3])c.fillText(cl.toFixed(2),left-7,sy(cl)+4);
  const lines=[
    {color:'#93dccc',label:'Current: min(0.25, 0.6 × Sp)',get:r=>Math.min(0.25,0.6*0.11*r*2*Math.PI/20)},
    {color:'#ffd47c',label:'Candidate: 0.25(1−exp(−0.5 × rev/s))',get:r=>0.25*(1-Math.exp(-0.5*r))}
  ];
  // Current curve illustration assumes v=20m/s for Sp; the candidate uses
  // perpendicular rev/s. Table coefficients use *actual* Rapier velocities.
  lines.forEach(line=>{
    c.strokeStyle=line.color;c.lineWidth=2;c.beginPath();
    for(let i=0;i<=80;i++){
      const r=i/10;i?c.lineTo(sx(r),sy(line.get(r))):c.moveTo(sx(r),sy(line.get(r)));
    }
    c.stroke();
  });
  c.font='10px system-ui';c.textAlign='left';
  c.fillStyle='#93dccc';c.fillText('Current Cl (20 m/s)',left,15);
  c.fillStyle='#ffd47c';c.fillText('Candidate Cl',left+185,15);
}

function renderPhysicsMetrics(report) {
  const bounceBody=byId('metrics-bounce-rows');
  bounceBody.replaceChildren();
  for(const b of report.bounce.impacts){
    tableRow(bounceBody,[
      '#'+b.number,fmt(b.impactTimeS),
      b.intervalSincePreviousS===null?'—':fmt(b.intervalSincePreviousS),
      b.apexHeightM===null?'Not resolved':fmt(b.apexHeightM),
      b.energyRetainedFraction===null?'—':fmt(100*b.energyRetainedFraction)+'%'
    ]);
  }
  if(!report.bounce.impacts.length)
    tableRow(bounceBody,['—','No impact observed','—','—','—']);
  byId('metrics-bounce-stop').textContent=report.bounce.settledAtS===null
    ?'No sustained rest observed within '+fmt(BOUNCE_OBSERVATION_SECONDS)+' s'
    :'Sustained rest after '+fmt(report.bounce.settledAtS)+' s';
  const rollBody=byId('metrics-roll-rows');
  rollBody.replaceChildren();
  const baseline=report.rolling.find(r=>r.launchSpeedMps===4);
  const baselineDistance=baseline.distanceToStopM??baseline.finalDistanceM;
  for(const run of report.rolling){
    const distance=run.distanceToStopM??run.finalDistanceM;
    const difference=distance-baselineDistance;
    tableRow(rollBody,[
      fmt(run.launchSpeedMps)+' m/s',
      run.stoppedAtS===null?'Not reached':fmt(run.stoppedAtS),
      fmt(distance),
      fmt(run.finalPositionM.x)+', '+fmt(run.finalPositionM.y),
      run.launchSpeedMps===4?'Baseline':(difference>=0?'+':'')+fmt(difference)+' m'
    ]);
  }
  const checkpointBody=byId('metrics-roll-checkpoints');
  checkpointBody.replaceChildren();
  for(const checkpoint of report.rolling[0].checkpoints){
    const values=report.rolling.map(run=>{
      const point=run.checkpoints.find(p=>p.timeS===checkpoint.timeS);
      return fmt(point.speedMps)+' / '+fmt(point.distanceM)+' / '+
        (point.slipMps===null?'—':fmt(point.slipMps));
    });
    tableRow(checkpointBody,[fmt(checkpoint.timeS)+' s',...values]);
  }
  byId('metrics-roll-note').textContent='Distance at stop when observed; otherwise at '+
    fmt(ROLL_OBSERVATION_SECONDS)+' s. All runs share the same grass model.';
  byId('metrics-config').textContent=report.version+' · 60 Hz · fixed reference scenarios';
  drawRollComparison(report.rolling);
  renderSpinMetrics(report.spinTrials);
  renderNaturalGrassMetrics(report.naturalGrass);
  renderFlightMetrics(report.flight);
  renderAirDragMetrics(report.dragComparison);
  renderSpeedDragMetrics(report.speedDragComparison);
  renderMagnusMetrics(report.magnusComparison);
  renderCombinedFlightMetrics(report.combinedFlightComparison);
  renderCalibrationEvidence(report.calibrationEvidence);
  renderUniversalBallReadiness(report.universalBallReadiness);
  renderCalibrationDatasetIntake(report.calibrationDataIntake);
  renderLiteratureCandidate(report.literatureCandidateComparison);
}

function measurePhysics() {
  const button=byId('measure');
  if(!rapier||button.disabled)return;
  button.disabled=true;
  try{
    const before=engine.snapshot();
    const result=runPhysicsDiagnostics(rapier);
    renderPhysicsMetrics(result);
    renderSpinAxisDiagnostics(runSpinAxisDiagnostics(rapier));
    const spinDecay=runSpinDecayDiagnostics(rapier);
    renderSpinDecayDiagnostics(spinDecay);
    renderSpinRetentionReview(reviewSpinRetentionEvidence(spinDecay));
    renderLiftInputContributions(reviewLiftInputContributions(spinDecay));
    renderContactImpactDiagnostics(runContactImpactDiagnostics(rapier));
    if(canonicalSnapshot(before)!==canonicalSnapshot(engine.snapshot()))
      throw new Error('Diagnostics unexpectedly modified the active simulation');
    byId('metrics-dialog').showModal();
  }catch(error){say('Metrics failed: '+error.message,true);}
  finally{button.disabled=false;}
}
byId('metrics-close').addEventListener('click',()=>byId('metrics-dialog').close());
byId('metrics-dialog').addEventListener('close',()=>{stopFlightPlayback();byId('measure').focus();});

function compareReplay() {
  try {
    const ticks = engine.snapshot().tick;
    const withFeet=Boolean(engine.footContactSnapshot);
    const repeat = createEngine(rapier, engine.scenario,{
      diagnosticPlayerFootContactsEnabled:withFeet,
      diagnosticLocalAiKickEnabled:kickDemoActive,
      diagnosticLocalAiPassReceiveEnabled:passDemoActive,
      diagnosticLocalAiExchangeEnabled:exchangeDemoActive,
      diagnosticLocalAiOpponentLaneEnabled:defendDemoActive,
      diagnosticLocalAiAutonomousDefenseEnabled:autonomousDefendActive,
      diagnosticLocalAiThirdPassEnabled:threePassDefenseActive,
      diagnosticLocalAiFourthPassEnabled:fourPassDefenseActive
    });
    let other = repeat.snapshot();
    const replayPlayers=withFeet?createPlayerMovement({
      experimentalAiKickApproach:kickDemoActive,
      experimentalAiPassReceiveApproach:passDemoActive,
      experimentalAiExchangeApproach:exchangeDemoActive,
      experimentalAiOpponentLane:defendDemoActive,
      experimentalAiAutonomousDefense:autonomousDefendActive,
      experimentalAiMultiPassDefense:multiPassDefenseActive,
      experimentalAiThreePassDefense:threePassDefenseActive,
      experimentalAiFourPassDefense:fourPassDefenseActive
    }):null;
    let equal;
    try {
      for (let n = 0; n < ticks; n += 1) {
        const exchange=multiPassDefenseActive?repeat.localAiExchangeSnapshot?.():null;
        other=withFeet?repeat.step(replayPlayers.step(other.ball.position,{
          velocity:other.ball.velocity,
          footContact:repeat.footContactSnapshot(),
          ...(multiPassDefenseActive?{
            passEvent:exchange?.events?.filter(e=>
              e.stage==='pass'||e.stage==='return-pass').at(-1)??null,
            oppositionFlightAudit:exchange?.oppositionFlightAudit??null
          }:{})
        })):repeat.step();
      }
      equal=canonicalSnapshot(other) === canonicalSnapshot(engine.snapshot())&&
        (!withFeet||JSON.stringify(repeat.footContactSnapshot())===
          JSON.stringify(engine.footContactSnapshot()));
    }finally{repeat.dispose();}
    byId('compare-result').textContent = equal
      ? 'PASS · identical canonical physics state after ' + ticks + ' ticks.'
      : 'FAIL · replay state diverged at tick ' + ticks + '.';
    byId('compare-result').hidden = false;
    say(equal ? 'LAB-03 PASS — deterministic repeat' : 'LAB-03 FAIL — investigate divergence', !equal);
  } catch (error) { say(error.message, true); }
}
function frame(now) {
  if (engine && playing) {
    accumulator += Math.min(Math.max(0, now - lastFrame) / 1000, 0.08) * Number(byId('speed').value);
    let iterations = 0;
    while (accumulator >= FIXED_DT && iterations < 24) {
      advance(); accumulator -= FIXED_DT; iterations++;
    }
    if (iterations === 24) accumulator = 0;
    render();
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}
// Use the same language-trigger / language-menu patterns as the site.
// A hidden input preserves the existing engine API and emits the same change event.
function setupDropdowns() {
  const dropdowns = [];
  for (const root of document.querySelectorAll('[data-me-dropdown]')) {
    const input = root.querySelector('input[type="hidden"]');
    const trigger = root.querySelector('.language-trigger');
    const menu = root.querySelector('.language-menu');
    const value = trigger.querySelector('span');
    const options = [...menu.querySelectorAll('[role="option"][data-value]')];
    if (!input || !trigger || !menu || !value || !options.length) throw new Error('Malformed lab dropdown');
    function selectedIndex() { return Math.max(0, options.findIndex(option => option.dataset.value === input.value)); }
    function update() {
      const selected = options[selectedIndex()];
      value.textContent = selected.textContent;
      for (const option of options) option.setAttribute('aria-selected', String(option === selected));
    }
    function close(restoreFocus = false) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      for (const option of options) option.removeAttribute('data-active');
      if (restoreFocus) trigger.focus();
    }
    function focusOption(index) {
      const target = options[(index + options.length) % options.length];
      for (const option of options) {
        if (option === target) option.dataset.active = 'true';
        else delete option.dataset.active;
      }
      target.focus();
    }
    function open(index = selectedIndex()) {
      for (const dropdown of dropdowns) dropdown.close();
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      focusOption(index);
    }
    function choose(option) {
      if (!options.includes(option)) return;
      const changed = input.value !== option.dataset.value;
      input.value = option.dataset.value;
      update();
      close(true);
      if (changed) input.dispatchEvent(new Event('change', {bubbles: true}));
    }
    trigger.addEventListener('click', () => {
      if (menu.hidden) open();
      else close(true);
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' ||
          event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        open(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
          selectedIndex() + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Escape' && !menu.hidden) {
        event.preventDefault();
        close(true);
      }
    });
    menu.addEventListener('click', event => {
      const option = event.target.closest('[role="option"]');
      if (option) choose(option);
    });
    menu.addEventListener('keydown', event => {
      const index = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' ||
          event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
          (index < 0 ? selectedIndex() : index) + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(options[index < 0 ? selectedIndex() : index]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') {
        close();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) close();
    });
    update();
    dropdowns.push({close});
  }
}

// Managerial observation only. Players self-organize on each Rapier tick;
// this button changes visibility, never movement or the ball's state.
byId('players-toggle').addEventListener('click',()=>{
  playersShown=!playersShown;
  byId('players-toggle').setAttribute('aria-pressed',String(playersShown));
  byId('player-controls').hidden=!playersShown;
  if(playersShown)renderPlayerReadout();
  topDown();
});

// ME-PLAYER-28: observation-only canvas selection; both mouse and tap use
// CURRENT physical marker positions. Neither writes to the movement engine.
byId('player-inspect-choice').addEventListener('change',()=>{
 inspectedPlayerId=byId('player-inspect-choice').value||null;
 if(playersShown)renderPlayerReadout();
 topDown();
});
pitch.addEventListener('click',event=>{
 if(!playersShown||!physicsTickSnapshot)return;
 const rect=pitch.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0||
   event.clientX<rect.left||event.clientX>rect.right||
   event.clientY<rect.top||event.clientY>rect.bottom)return;
 const x=(event.clientX-rect.left)*pitch.width/rect.width;
 const y=(event.clientY-rect.top)*pitch.height/rect.height;
 const radiusPx=(event.pointerType==='touch'?19:14)*pitch.width/rect.width;
 const playerId=pickObservedPlayerAtCanvasPixel(playerSnapshot.players,x,y,
   pitch.width,pitch.height,Math.min(radiusPx,100));
 if(!playerId)return;
 inspectedPlayerId=playerId;
 byId('player-inspect-choice').value=playerId;
 renderPlayerReadout();
 topDown();
});
byId('preset').addEventListener('change',()=>{
  // Every selection initializes paused at tick zero. Use Play/Step to
  // advance; unlike the old one-click buttons, selection never autoplays.
  try{
    loadPreset();
    if(rapier)restart();
  }catch(e){say(e.message,true);}
});
byId('play').addEventListener('click', play);
byId('pause').addEventListener('click', pause);
byId('step').addEventListener('click', () => { playing = false; advance(); render(); say('Paused · advanced one tick'); });
byId('reset').addEventListener('click', () => { try { restart(); } catch (e) { say(e.message, true); } });
byId('apply').addEventListener('click', () => { try { restart(); } catch (e) { say(e.message, true); } });
byId('compare').addEventListener('click', compareReplay);
byId('measure').addEventListener('click', measurePhysics);
setupDropdowns();
setupNumericFields();
loadPreset();
topDown(); // Show the complete static pitch while the WASM physics module loads.
requestAnimationFrame(frame);
try {
  const moduleNamespace = await import('/__fa_match_engine__/rapier.es.js');
  rapier = await initializeRapier(moduleNamespace);
  restart();
  for (const id of controls) byId(id).disabled = false;
} catch (error) {
  say('Physics library failed to initialize: ' + error.message + '. Run npm --prefix match-engine ci locally.', true);
}
