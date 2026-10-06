// Public compatibility facade. Keep API and signatures stable for callers, tests and saved careers.
// Gameplay, state transitions and read models are implemented in DOM-free domain modules.
export {currency,compactMoney} from './domain/format.js';
export {clubById,playerById,clubPlayers,clubMatch,fullName,myClub} from './domain/selectors.js';
export {latestResult,findMatch} from './domain/history.js';
export {table,leagueScorers,standingsSummary} from './domain/standings.js';
export {formationSlots,teamStrength} from './domain/lineups.js';
export {startCareer,advanceDay,simulateRound,newSeason} from './domain/career.js';
export {changeFormation,assignPlayer,autoLineup} from './domain/tactics.js';
export {signPlayer,sellPlayer} from './domain/transfers.js';
export {validateSave} from './domain/save-validation.js';
