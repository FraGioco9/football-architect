// Public compatibility facade: existing imports remain supported.
import {getLeagueClubs} from './leagues.js';
export const CLUBS = getLeagueClubs('IT');
export {POSITIONS,POSITION_LABELS,ROLE_GROUPS,FORMATIONS,clamp,toInt} from './domain/rules.js';
export {randomFactory,choose} from './domain/rng.js';
export {createFixtures} from './domain/fixtures.js';
export {makeDefaultLineup} from './domain/lineups.js';
export {makeWorld} from './domain/world.js';
