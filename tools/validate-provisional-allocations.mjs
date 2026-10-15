// Validates approved initial ID ranges for provisional UI only, never game results.
export function validateProvisionalAllocations(manifest,divisionData,clubData){
  const fail=message=>{throw Error("Provisional division allocations: "+message);};
  const check=(condition,message)=>{if(!condition)fail(message);};
  check(manifest?.schema==="football-architect-provisional-division-allocation-v1","unexpected schema");
  check(manifest.status==="provisional"&&manifest.approved===false,"allocation must remain provisional");
  check(manifest.sources?.clubs==="data/clubs.json"&&manifest.sources?.divisions==="data/divisions.json","source catalogues changed");
  const divisions=divisionData,clubs=clubData?.clubs;
  const expectedCountries=["IT","ENG","ES","DE","FR","PT","NL","BR"];
  check(Array.isArray(divisions)&&divisions.length===16,"expected flat 16-division registry");
  const countries=[...new Set(divisions.map(d=>d.countryId))];
  check(countries.length===8&&new Set(countries).size===8&&expectedCountries.every(id=>countries.includes(id)),"unexpected countries");
  check(divisions.every(d=>Array.isArray(d.clubIds)&&d.clubIds.length===0),"canonical participants must remain unset");
  for(const countryId of expectedCountries){
    const national=divisions.filter(d=>d.countryId===countryId);
    check(national.length===2&&new Set(national.map(d=>d.countryName)).size===1,"inconsistent country metadata "+countryId);
  }
  check(Array.isArray(clubs)&&clubs.length===320,"expected 320 identities");
  check(Array.isArray(manifest.allocations)&&manifest.allocations.length===16,"expected 16 allocations");
  const byClub=new Map(),byDivision=new Map(),seen=new Set(),excluded=new Set();
  for(const club of clubs){
    const key=club.countryId+":"+club.clubId;
    check(expectedCountries.includes(club.countryId)&&Number.isInteger(club.clubId)&&club.clubId>=1&&club.clubId<=40,"invalid club key "+key);
    check(!byClub.has(key),"duplicate club identity "+key);
    check(typeof club.fullName==="string"&&club.fullName.length>0&&typeof club.abbr==="string"&&club.abbr.length>0,"incomplete club identity "+key);
    byClub.set(key,club);
  }
  for(const countryId of expectedCountries)for(let id=1;id<=40;id++){
    const key=countryId+":"+id;
    check(byClub.has(key),"missing club "+key);
    if(id>=33)excluded.add(key);
  }
  const historical=new Set(clubs.filter(c=>c.firstDivisionReference).map(c=>c.countryId+":"+c.clubId));
  check(historical.size===160,"historical reference count changed");
  for(const countryId of expectedCountries)for(let id=1;id<=20;id++)
    check(historical.has(countryId+":"+id),"historical reference changed "+countryId+":"+id);
  const allocationById=new Map(manifest.allocations.map(entry=>[entry.divisionId,entry]));
  check(allocationById.size===16,"duplicate allocation division");
  let tier1=0,tier2=0;
  for(let i=0;i<divisions.length;i++){
    const division=divisions[i],entry=allocationById.get(division.id);
    check(expectedCountries.includes(division.countryId)&&[1,2].includes(division.tier)&&division.id===division.countryId+"-"+division.tier,"invalid division identity");
    check(!byDivision.has(division.id),"duplicate division "+division.id);
    check(entry?.divisionId===division.id,"missing allocation "+division.id);
    check(division.capacity===16,"wrong capacity "+division.id);
    check(entry.evidenceType==="owner-approved-initial-id-rule","wrong allocation evidence "+division.id);
    check(Array.isArray(entry.clubIds)&&entry.clubIds.length===16,"wrong club count "+division.id);
    const start=division.tier===1?1:17,allocated=[];
    for(let j=0;j<16;j++){
      const id=entry.clubIds[j],key=division.countryId+":"+id;
      check(id===start+j,"wrong club ID/order "+division.id+" at "+j);
      check(byClub.has(key)&&!excluded.has(key)&&!seen.has(key),"duplicate, excluded or missing club "+key);
      seen.add(key);
      allocated.push(byClub.get(key));
    }
    byDivision.set(division.id,allocated);
    if(division.tier===1)tier1+=16;else tier2+=16;
  }
  check(byDivision.size===16&&tier1===128&&tier2===128&&seen.size===256&&excluded.size===64,"invalid active/excluded totals");
  check([...byClub.keys()].every(key=>seen.has(key)!==excluded.has(key)),"invalid 320-club partition");
  return {byDivision,counts:{total:256,tier1,tier2,excluded:64,catalog:320},approved:false};
}
