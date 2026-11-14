// ME-PB-54 / A1.3b.2 provisional: 22 homogeneous temporary actors.
// This is NOT an affiliation record, real player ID, roster selection,
// generated footballer or a claim of game-scoring authority.
import {INITIAL_PLAYERS,
 PLAYER_MAX_SPEED_MPS,PLAYER_ACCEL_MPS2,
 PLAYER_BRAKE_MPS2,PLAYER_TURN_RAD_PER_S}
 from './player-movement.mjs';

export const TEMPORARY_UNIFORM_SQUAD_VERSION=
 'me-pb-54-temporary-uniform-11v11-v1';

export const TEMPORARY_PLAYER_ATTRIBUTE_VALUE=50;

// The exact 20 approved field names; no per-position ability advantage.
// These ratings are a neutral placeholder, not generated-player strength.
export const TEMPORARY_PLAYER_ATTRIBUTES=Object.freeze(
 Object.fromEntries(
  'speed strength stamina agility passing technique dribbling shooting crossing tackling marking heading vision positioning decisions composure gk_reflexes gk_handling gk_positioning gk_aerial'.split(' ').map(key=>[key,TEMPORARY_PLAYER_ATTRIBUTE_VALUE])
 )
);

// These are the ACTUAL shared movement caps used by player-movement.mjs.
// Rating 50 does not yet alter the Rapier movement algorithm.
export const TEMPORARY_UNIFORM_MOVEMENT=Object.freeze({
 maxSpeedMps:PLAYER_MAX_SPEED_MPS,
 accelerationMps2:PLAYER_ACCEL_MPS2,
 brakingMps2:PLAYER_BRAKE_MPS2,
 turnRadPerSecond:PLAYER_TURN_RAD_PER_S
});

export function createTemporaryUniformFixtureSquad(fixture){
 if(!fixture||typeof fixture!=='object'||
    typeof fixture.homeClubId!=='string'||
    typeof fixture.awayClubId!=='string'||
    fixture.homeClubId===fixture.awayClubId)
  throw new TypeError('Validated fixture clubs required for temporary squad');
 // Actual players/colliders are owned by the already verified
 // canonical 22-player mover, with stable engineId home-1..away-11.
 if(INITIAL_PLAYERS.length!==22||
    INITIAL_PLAYERS.filter(p=>p.team==='home').length!==11||
    INITIAL_PLAYERS.filter(p=>p.team==='away').length!==11||
    new Set(INITIAL_PLAYERS.map(p=>p.id)).size!==22)
  throw new Error('Canonical 11v11 physical movement source missing');
 const players=Object.freeze(INITIAL_PLAYERS.map(p=>Object.freeze({
  engineId:p.id,
  team:p.team,
  clubId:p.team==='home'?fixture.homeClubId:fixture.awayClubId,
  squadNumber:p.number,
  tacticalRole:p.role,
  generatedPlayerId:null,
  playerId:null,
  temporary:true,
  attributes:TEMPORARY_PLAYER_ATTRIBUTES,
  movementLimits:TEMPORARY_UNIFORM_MOVEMENT
 })));
 return Object.freeze({
  version:TEMPORARY_UNIFORM_SQUAD_VERSION,
  source:'homogeneous-temporary-actors',
  fixtureId:fixture.id,
  homeClubId:fixture.homeClubId,
  awayClubId:fixture.awayClubId,
  players,
  playerCount:22,
  playersPerTeam:11,
  statsHomogeneous:true,
  attributeValue:TEMPORARY_PLAYER_ATTRIBUTE_VALUE,
  physicalMovementUniform:true,
  ratingsAppliedToPhysics:false,
  generatedPlayersUsed:false,
  rosterBound:false,
  officialPlayerIdentity:false
 });
}
