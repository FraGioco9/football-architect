/**
 * Immutable public identity for a published match slot, independent of clubs,
 * results and presentation order. This does NOT publish a fixture: a protected
 * command must persist the slot and its verified source before exposing it.
 */
export interface MatchSlotKey {
  readonly generation:string;
  readonly season:number;
  readonly competitionId:string;
  readonly phaseId:string;
  readonly slotId:string;
}

export interface LeagueFixtureSource {
  readonly id:string;
  readonly competitionId:string;
  readonly round:number;
}

export interface LeagueMatchSlot {
  readonly sourceFixtureId:string;
  readonly competitionId:string;
  readonly round:number;
  readonly ordinal:number;
  readonly slotId:string;
  readonly matchId:string;
}

const generationPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const competitionPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const identityPartPattern=/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/;
const matchIdPattern=/^m1_[0-9a-f]{32}$/;

/** The first 128 bits of a domain-separated SHA-256 digest, encoded as hex. */
export async function matchIdForSlot(key:MatchSlotKey):Promise<string> {
  if(!generationPattern.test(key.generation)||!Number.isSafeInteger(key.season)||key.season<1||
    !competitionPattern.test(key.competitionId)||!identityPartPattern.test(key.phaseId)||
    !identityPartPattern.test(key.slotId))throw new RangeError('Invalid match slot key');
  const tuple=['football-architect-match-slot-v1',key.generation.toLowerCase(),key.season,key.competitionId,key.phaseId,key.slotId];
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(tuple))));
  return 'm1_'+Array.from(bytes.slice(0,16),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function isMatchId(value:string):boolean{return matchIdPattern.test(value);}

/**
 * Allocate fixture-independent ordinals once for a committed league draw.
 * The caller must persist source-fixture -> match-slot mappings; do not derive
 * ordinals again from a different/new draw or a user-facing sort order.
 */
export async function assignLeagueMatchSlots(
  fixtures:readonly LeagueFixtureSource[],generation:string,season:number,
):Promise<readonly LeagueMatchSlot[]> {
  const sourceIds=new Set<string>();
  for(const fixture of fixtures){
    if(!fixture||typeof fixture.id!=='string'||!fixture.id||sourceIds.has(fixture.id)||
      !competitionPattern.test(fixture.competitionId)||!Number.isSafeInteger(fixture.round)||fixture.round<1)
      throw new RangeError('Invalid or duplicate source fixture');
    sourceIds.add(fixture.id);
  }
  const ordered=[...fixtures].sort((a,b)=>
    (a.competitionId<b.competitionId?-1:a.competitionId>b.competitionId?1:0)||
    a.round-b.round||(a.id<b.id?-1:a.id>b.id?1:0));
  const ordinals=new Map<string,number>();
  const result=await Promise.all(ordered.map(async fixture=>{
    const group=fixture.competitionId+':'+fixture.round;
    const ordinal=(ordinals.get(group)??0)+1;
    ordinals.set(group,ordinal);
    const slotId='round:'+fixture.round+':match:'+ordinal;
    const matchId=await matchIdForSlot({generation,season,competitionId:fixture.competitionId,phaseId:'league',slotId});
    return {sourceFixtureId:fixture.id,competitionId:fixture.competitionId,round:fixture.round,ordinal,slotId,matchId};
  }));
  if(new Set(result.map(r=>r.matchId)).size!==result.length)throw new RangeError('Duplicate match slot');
  return result;
}
