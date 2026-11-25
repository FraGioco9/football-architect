/** Synthetic funding for disposable tests only; no defaults for real worlds. */
import type {Database} from '../../src/database.ts';
import {prepareEconomicGenesis,stepEconomicGenesis,completeEconomicGenesis} from '../../src/economic-genesis.ts';
import {economicAssert} from '../../src/economic-ledger.ts';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from '../../src/approved-season-one.ts';
import {readWorld} from '../../src/world-repository.ts';
import {MARKET_VALUE_CONFIG} from '../../src/player-market-value.mjs';
export async function prepareOpeningFundingFixture(db:Database,now:number){
 const world=await readWorld(db),snapshot=await loadApprovedSnapshot();
 const active=snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>[...b.clubIds]);
 const access=()=>[economicAssert(db,'SELECT 1')];
 const input={version:'synthetic-opening-world',clubs:serverCanonicalCatalogue().clubIds.map(clubKey=>({clubKey,amountArc:100000})),freeReserveArc:100000,issuanceLimitArc:100000000,
 openingContracts:{schema:'opening-contract-forecast-v1' as const,worldGeneration:world.generation,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,formulaVersion:MARKET_VALUE_CONFIG.version,expectedRewardsByClub:Object.fromEntries(active.map(k=>[k,1000]))}};
 return prepareEconomicGenesis(db,input,'synthetic-opening-fixture',access(),now);
}
export async function fundOpeningFixture(db:Database,now:number){
 await prepareOpeningFundingFixture(db,now);
 const access=()=>[economicAssert(db,'SELECT 1')];
 for(let i=0;i<21;i++)await stepEconomicGenesis(db,access(),now);
 await completeEconomicGenesis(db,access(),now);
}
