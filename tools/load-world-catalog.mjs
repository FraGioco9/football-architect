// Node-only I/O boundary for pure A01 World Catalog.
import {readFileSync} from 'node:fs';
import {createWorldCatalog} from '../assets/world-catalog.mjs';
import {validateProvisionalAllocations} from './validate-provisional-allocations.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
export function loadWorldCatalog(){
 const clubs=load('clubs.json'),divisions=load('divisions.json');
 const provisionalAllocations=load('division-allocations.provisional.json');
 validateProvisionalAllocations(provisionalAllocations,divisions,clubs);
 return createWorldCatalog({clubs,divisions,provisionalAllocations,
  internationalCompetitions:load('international-competitions.json'),
  rivalries:load('club-rivalries.json'),descriptions:load('club-descriptions.i18n.json')});
}
