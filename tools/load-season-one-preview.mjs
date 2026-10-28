// Node-only I/O. A nonauthoritative presentation projection, never approval/current-world state.
import {readFileSync} from 'node:fs';
import {validateSeasonOneSelection} from '../backend/catalogues/season-one-selection.mjs';
export function loadSeasonOnePreview(){
 const selection=JSON.parse(readFileSync(new URL('../backend/catalogues/season-1.participants.json',import.meta.url),'utf8'));
 validateSeasonOneSelection(selection);
 return {schema:'football-architect-season-one-preview-v1',status:'provisional',approved:false,season:1,
  source:'backend/catalogues/season-1.participants.json',
  allocations:selection.bindings.filter(b=>!b.competitionId.startsWith('int-')).map(b=>({
   divisionId:b.competitionId,evidenceType:'owner-approved-initial-id-rule',clubIds:b.clubIds.map(id=>Number(id.split('-')[1])).sort((a,b)=>a-b)
  }))};
}
