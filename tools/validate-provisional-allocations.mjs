// Validates provisional UI-only allocations before any generated page uses them.
export function validateProvisionalAllocations(manifest,divisionData,clubData){
  const fail = message => { throw new Error("Provisional division allocations: "+message); };
  const check = (condition,message) => { if(!condition)fail(message); };
  check(manifest?.schema==="football-architect-provisional-division-allocation-v1","unexpected schema");
  check(manifest.status==="provisional" && manifest.approved===false,"approval gate must remain provisional and unapproved");
  check(manifest.sources?.clubs==="data/clubs.json" && manifest.sources?.divisions==="data/divisions.json","source catalogue mismatch");
  const divisions=divisionData?.divisions,clubs=clubData?.clubs;
  check(Array.isArray(divisions) && divisions.length===16,"expected 16 division definitions");
  check(Array.isArray(clubs) && clubs.length===320,"expected 320 club identities");
  check(Array.isArray(manifest.allocations) && manifest.allocations.length===divisions.length,"expected one allocation for each division");
  const byClub=new Map(),byDivision=new Map(),seen=new Set();
  for(const club of clubs){
    const key=club.countryId+":"+club.clubId;
    check(!byClub.has(key),"duplicate club identity "+key);
    check(typeof club.fullName==="string" && club.fullName.length>0 && typeof club.abbr==="string","missing club identity "+key);
    byClub.set(key,club);
  }
  const historic=new Set(clubs.filter(club=>club.firstDivisionReference).map(club=>club.countryId+":"+club.clubId));
  check(historic.size===160,"expected 160 historic first-division references");
  let historicalCount=0,derivedCount=0;
  for(let index=0;index<divisions.length;index++){
    const division=divisions[index],entry=manifest.allocations[index];
    check(entry?.divisionId===division.id,"division identifier/order mismatch at index "+index);
    check(!byDivision.has(division.id),"duplicate division "+division.id);
    check(division.tier===1 || division.tier===2,"unsupported tier "+division.id);
    check(division.capacity===20,"unexpected division capacity "+division.id);
    const evidenceType=division.tier===1?"historical-first-division-reference":"derived-complement";
    check(entry.evidenceType===evidenceType,"wrong provenance for "+division.id);
    check(Array.isArray(entry.clubIds) && entry.clubIds.length===division.capacity,"club count mismatch for "+division.id);
    const allocated=[];
    let last=0;
    for(const id of entry.clubIds){
      check(Number.isInteger(id) && id>last,"duplicate or unordered club ID in "+division.id);
      check(division.tier===1 ? id<=20 : id>=21 && id<=40,"unexpected tier assignment "+division.id+" club "+id);
      const key=division.countryId+":"+id,club=byClub.get(key);
      check(club!==undefined,"unknown or foreign club "+key);
      check(!seen.has(key),"club allocated more than once "+key);
      check(division.tier===1 ? historic.has(key) : !historic.has(key),"historical source mismatch "+key);
      seen.add(key);
      allocated.push(club);
      last=id;
      if(division.tier===1)historicalCount++;else derivedCount++;
    }
    byDivision.set(division.id,allocated);
  }
  check(seen.size===320,"incomplete allocation");
  check(historicalCount===160 && derivedCount===160,"provenance totals must be 160+160");
  return {byDivision,counts:{total:seen.size,historical:historicalCount,derived:derivedCount},approved:false};
}
