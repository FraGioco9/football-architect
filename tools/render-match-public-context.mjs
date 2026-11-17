/** Public match page needs just club identity and competition branding, not season rules. */
export function renderMatchPublicContext(clubs,competitions,clubCrests){
 if(!Array.isArray(clubs)||clubs.length!==320||!Array.isArray(competitions)||competitions.length!==18)
  throw Error('Canonical match catalog cardinality changed');
 if(!clubCrests||typeof clubCrests!=='object'||Array.isArray(clubCrests))throw Error('Canonical crest catalog missing');
 const entries=new Set(),compEntries=new Set();
 const clubById=Object.fromEntries([...clubs].sort((a,b)=>(a.countryId+'-'+a.clubId).localeCompare(b.countryId+'-'+b.clubId,'en')).map(club=>{
  const id=club.countryId+'-'+club.clubId;
  if(entries.has(id)||typeof club.primaryName!=='string'||typeof club.abbr!=='string'||
     typeof club.stadiumName!=='string')throw Error('Invalid club match identity '+id);
  entries.add(id);
  return [id,{countryId:club.countryId,clubId:club.clubId,primaryName:club.primaryName,
   compactName:club.compactName,abbr:club.abbr,stadiumName:club.stadiumName}];
 }));
 const competitionById=Object.fromEntries([...competitions].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(c=>{
  if(compEntries.has(c.id)||typeof c.name!=='string')throw Error('Invalid match competition '+c.id);
  compEntries.add(c.id);
  return [c.id,{id:c.id,name:c.name,primaryHex:c.primaryHex,secondaryHex:c.secondaryHex,ivoryHex:c.ivoryHex}];
 }));
 return "/** Generated from canonical club + competition sources; no rules, history or personal data. */\n"+
  "const clubs="+JSON.stringify(clubById)+";\n"+
  "const competitions="+JSON.stringify(competitionById)+";\n"+
  "const clubCrests="+JSON.stringify(clubCrests)+";\n"+
  "export function matchPublicContext(match){\n"+
  " if(!match||typeof match!=='object'||!Object.hasOwn(competitions,match.competitionId))return null;\n"+
  " const ids=[match.homeParticipant?.clubId,match.awayParticipant?.clubId];\n"+
  " const selected=[];\n"+
  " for(const id of ids)if(typeof id==='string'&&Object.hasOwn(clubs,id)&&!selected.some(c=>c.countryId+'-'+c.clubId===id))selected.push(clubs[id]);\n"+
  " return {clubs:selected,competitions:[competitions[match.competitionId]]};\n"+
  "}\n"+
  "export function publicClubIdentityCatalog(){return {clubs:Object.values(clubs),clubCrests};}\n";
}
