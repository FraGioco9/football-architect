/** #581: anonymous archive-only World History; never publish active sporting projections. */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {readClosedSeasonHistory} from './season-archive-read.ts';

const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'] as const;
const clubPattern=/^(?:IT|ENG|ES|DE|FR|PT|NL|BR)-(?:[1-9]|[1-3][0-9]|40)$/;
const validObject=(value:unknown):value is Record<string,unknown>=>
 value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalid=():never=>{throw new ApiError(422,'archive_invalid')};

/** Allowlist championship identities; never return the internal qualification/holder payload. */
export function projectWorldHistoryChampions(summary:unknown,season:number){
 if(!validObject(summary)||summary.schemaVersion!==1||summary.sourceSeason!==season||
  !Array.isArray(summary.divisions)||summary.divisions.length!==16||
  !Array.isArray(summary.cupWinners)||summary.cupWinners.length!==2)invalid();
 const divisions=new Map<string,string>();
 for(const item of summary.divisions){
  if(!validObject(item)||typeof item.competitionId!=='string'||
    !Array.isArray(item.table)||item.table.length!==16||
    divisions.has(item.competitionId))invalid();
  const clubIds=new Set<string>();
  for(const row of item.table){
   if(!validObject(row)||typeof row.clubId!=='string'||!clubPattern.test(row.clubId)||
     clubIds.has(row.clubId))invalid();
   clubIds.add(row.clubId);
  }
  const winner=item.table[0];
  if(!validObject(winner)||typeof winner.clubId!=='string')invalid();
  divisions.set(item.competitionId,winner.clubId);
 }
 const champions:{competitionId:string;championClubId:string}[]=[];
 for(const country of countries)for(const tier of [1,2]){
  const id=country+'-'+tier,winner=divisions.get(id);
  if(!winner||!winner.startsWith(country+'-'))invalid();
  champions.push({competitionId:id,championClubId:winner});
 }
 const cups=new Map<string,string>();
 for(const item of summary.cupWinners){
  if(!validObject(item)||!['int-1','int-2'].includes(String(item.competitionId))||
   typeof item.championClubId!=='string'||!clubPattern.test(item.championClubId)||
   cups.has(String(item.competitionId)))invalid();
  cups.set(String(item.competitionId),item.championClubId);
 }
 for(const id of ['int-1','int-2']){
  const winner=cups.get(id);if(!winner)invalid();
  champions.push({competitionId:id,championClubId:winner});
 }
 return champions;
}

/** Public GET requires an independent completed closure receipt for every historic season. */
export async function readPublicWorldHistory(db:Database){
 const before=await readWorld(db);
 const last=before.phase==='closed'?before.seasonNumber:before.seasonNumber-1;
 if(!Number.isSafeInteger(last)||last<0)invalid();
 const seasons:{seasonNumber:number;champions:{competitionId:string;championClubId:string}[]}[]=[];
 for(let season=last;season>=1;season--){
  const record=await readClosedSeasonHistory(db,season);
  seasons.push({seasonNumber:season,champions:projectWorldHistoryChampions(record.summary,season)});
 }
 const after=await readWorld(db);
 if(['generation','revision','seasonNumber','day','phase'].some(key=>
  before[key as keyof typeof before]!==after[key as keyof typeof after]))
  throw new ApiError(409,'stale_world');
 return {schemaVersion:1 as const,providerId:'authoritative-world-history' as const,
  world:{seasonNumber:before.seasonNumber,phase:before.phase},
  status:seasons.length?'available' as const:'empty' as const,
  provenance:{kind:'authoritative' as const,source:'closed-season-archive' as const},
  seasons};
}
