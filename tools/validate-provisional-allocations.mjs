import model from "../assets/competition-model.js";
// Validates approved initial ID ranges for provisional UI only, never game results.
export function validateProvisionalAllocations(manifest,divisionData,clubData){
  const fail=message=>{throw Error("Provisional division allocations: "+message);};
  const check=(condition,message)=>{if(!condition)fail(message);};
  check(manifest?.schema==="football-architect-season-one-preview-v1","unexpected schema");
  check(manifest.status==="provisional"&&manifest.approved===false,"allocation must remain provisional");
  check(manifest.season===1&&manifest.source==="backend/catalogues/season-1.participants.json","season/source changed");
  const divisions=divisionData,clubs=clubData;
  const expectedCountries=model.countries;
  const capacity=model.profile.capacity;
  check(Array.isArray(divisions)&&divisions.length===model.divisionCount,"expected flat 16-division registry");
  const countries=[...new Set(divisions.map(d=>d.countryId))];
  check(countries.length===8&&new Set(countries).size===8&&expectedCountries.every(id=>countries.includes(id)),"unexpected countries");
  check(divisions.every(d=>!Object.hasOwn(d,"clubIds")),"canonical participants must remain unset");
  for(const countryId of expectedCountries){
    const national=divisions.filter(d=>d.countryId===countryId);
    check(national.length===2&&new Set(national.map(d=>d.countryName)).size===1,"inconsistent country metadata "+countryId);
  }
  check(Array.isArray(clubs)&&clubs.length===320,"expected 320 identities");
  check(Array.isArray(manifest.allocations)&&manifest.allocations.length===model.divisionCount,"expected 16 allocations");
  const byClub=new Map(),byDivision=new Map(),seen=new Set(),excluded=new Set();
  const fields=["countryId","clubId","city","primaryName","fullName","compactName","abbr","nickname","description","primaryColor","secondaryColor","stadiumName"];
  const abbreviations=new Set(),fullNames=new Set();
  for(const club of clubs){
    const key=club.countryId+":"+club.clubId;
    check(expectedCountries.includes(club.countryId)&&Number.isInteger(club.clubId)&&club.clubId>=1&&club.clubId<=40,"invalid club key "+key);
    check(!byClub.has(key),"duplicate club identity "+key);
    check(Object.keys(club).length===fields.length&&fields.every(field=>Object.hasOwn(club,field)),"unexpected club fields "+key);
    check(fields.filter(field=>field!=="clubId").every(field=>typeof club[field]==="string"&&club[field].trim().length>0),"incomplete club identity "+key);
    check(/^[A-Z]{3}$/.test(club.abbr)&&!abbreviations.has(club.abbr)&&!fullNames.has(club.fullName),"duplicate or invalid club name/abbreviation "+key);
    check([club.primaryColor,club.secondaryColor].every(color=>/^#[0-9A-Fa-f]{6}$/.test(color)),"invalid club colors "+key);
    abbreviations.add(club.abbr);fullNames.add(club.fullName);
    byClub.set(key,club);
  }
  for(const countryId of expectedCountries)for(let id=1;id<=40;id++){
    const key=countryId+":"+id;
    check(byClub.has(key),"missing club "+key);
    if(id>capacity*model.tiers.length)excluded.add(key);
  }
  const allocationById=new Map(manifest.allocations.map(entry=>[entry.divisionId,entry]));
  check(allocationById.size===model.divisionCount,"duplicate allocation division");
  let tier1=0,tier2=0;
  for(let i=0;i<divisions.length;i++){
    const division=divisions[i],entry=allocationById.get(division.id);
    check(expectedCountries.includes(division.countryId)&&[1,2].includes(division.tier)&&division.id===division.countryId+"-"+division.tier,"invalid division identity");
    check(!byDivision.has(division.id),"duplicate division "+division.id);
    check(entry?.divisionId===division.id,"missing allocation "+division.id);
    check(division.capacity===capacity,"wrong capacity "+division.id);
    check(entry.evidenceType==="owner-approved-initial-id-rule","wrong allocation evidence "+division.id);
    check(Array.isArray(entry.clubIds)&&entry.clubIds.length===capacity,"wrong club count "+division.id);
    const start=model.firstClubId(division.tier),allocated=[];
    for(let j=0;j<capacity;j++){
      const id=entry.clubIds[j],key=division.countryId+":"+id;
      check(id===start+j,"wrong club ID/order "+division.id+" at "+j);
      check(byClub.has(key)&&!excluded.has(key)&&!seen.has(key),"duplicate, excluded or missing club "+key);
      seen.add(key);
      allocated.push(byClub.get(key));
    }
    byDivision.set(division.id,allocated);
    if(division.tier===1)tier1+=capacity;else tier2+=capacity;
  }
  check(byDivision.size===model.divisionCount&&tier1===capacity*expectedCountries.length&&tier2===tier1&&seen.size===model.participantCount&&excluded.size===64,"invalid active/excluded totals");
  check([...byClub.keys()].every(key=>seen.has(key)!==excluded.has(key)),"invalid 320-club partition");
  return {byDivision,counts:{total:model.participantCount,tier1,tier2,excluded:64,catalog:320},approved:false};
}
