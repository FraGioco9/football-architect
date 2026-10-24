// ARCH-CLEAN-02 A01: pure, immutable canonical identity/relationship lookup.
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const languages=['en','de','es','fr','it'];
const native={IT:'it',ENG:'en',ES:'es',DE:'de',FR:'fr',PT:'pt',NL:'nl',BR:'pt'};
const fail=(message)=>{throw Error('World Catalog: '+message)};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value)}return value};
export function parseClubId(id){
 if(typeof id!=='string')return null;
 const match=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.exec(id);
 return match?freeze({countryId:match[1],clubId:Number(match[2])}):null;
}
export function createWorldCatalog({clubs,divisions,internationalCompetitions,provisionalAllocations,rivalries,descriptions}){
 if(!Array.isArray(clubs)||clubs.length!==320||!Array.isArray(divisions)||divisions.length!==16||!Array.isArray(internationalCompetitions)||internationalCompetitions.length!==2||!Array.isArray(rivalries)||rivalries.length!==352)fail('source cardinality');
 if(provisionalAllocations?.status!=='provisional'||provisionalAllocations.approved!==false||provisionalAllocations.allocations?.length!==16)fail('provisional status');
 const byClub=new Map(),byDivision=new Map(),byCompetition=new Map(),byAllocation=new Map(),byRivalry=new Map(),byCountry=new Map(countries.map(c=>[c,[]]));
 for(const club of clubs){
  const id=club.countryId+'-'+club.clubId;
  if(!parseClubId(id)||byClub.has(id))fail('duplicate/invalid club '+id);
  byClub.set(id,freeze(structuredClone(club)));byRivalry.set(id,[]);byCountry.get(club.countryId).push(id);
 }
 for(const d of divisions){
  if(!countries.includes(d.countryId)||![1,2].includes(d.tier)||d.id!==d.countryId+'-'+d.tier||byDivision.has(d.id)||d.capacity!==16)fail('division '+d.id);
  const record=freeze(structuredClone(d));byDivision.set(d.id,record);byCompetition.set(d.id,record);
 }
 for(const cup of internationalCompetitions){
  if(!['int-1','int-2'].includes(cup.id)||byCompetition.has(cup.id)||cup.capacity!==24)fail('cup '+cup.id);
  byCompetition.set(cup.id,freeze(structuredClone(cup)));
 }
 const used=new Set();
 for(const a of provisionalAllocations.allocations){
  const division=byDivision.get(a.divisionId);
  if(!division||byAllocation.has(a.divisionId)||a.clubIds?.length!==16)fail('allocation '+a.divisionId);
  const members=a.clubIds.map(n=>{
   const id=division.countryId+'-'+n;
   if(!byClub.has(id)||used.has(id))fail('allocation member '+id);
   used.add(id);return id;
  });
  byAllocation.set(a.divisionId,freeze({divisionId:a.divisionId,status:'provisional',approved:false,clubIds:[...a.clubIds],memberIds:members}));
 }
 if(used.size!==256)fail('allocation cardinality');
 const pairs=new Set();
 for(const rivalry of rivalries){
  const {clubAId:a,clubBId:b}=rivalry;
  if(!byClub.has(a)||!byClub.has(b)||a===b)fail('rivalry endpoints');
  const pair=[a,b].sort().join('__');
  if(pairs.has(pair))fail('duplicate rivalry '+pair);
  pairs.add(pair);
  const frozen=freeze(structuredClone(rivalry));
  byRivalry.get(a).push(frozen);byRivalry.get(b).push(frozen);
 }
 const localized=new Map();
 for(const [id,club] of byClub){
  const translation=descriptions?.[club.countryId]?.[club.clubId];
  const value={...translation,[native[club.countryId]]:club.description};
  if(languages.some(lang=>typeof value[lang]!=='string'||!value[lang].trim()))fail('missing localization '+id);
  localized.set(id,freeze(value));
 }
 const get=(index,id)=>index.get(id)??null;
 const list=ids=>freeze(ids.map(id=>byClub.get(id)));
 const sortedCountries=new Map([...byCountry].map(([key,ids])=>[key,ids.sort((a,b)=>Number(a.split('-').at(-1))-Number(b.split('-').at(-1)))]));
 const api={
  getClub:id=>get(byClub,id),
  getDivision:id=>get(byDivision,id),
  getCompetition:id=>get(byCompetition,id),
  getClubsByCountry:id=>sortedCountries.has(id)?list(sortedCountries.get(id)):freeze([]),
  getClubsByDivision:id=>byAllocation.has(id)?list(byAllocation.get(id).memberIds):freeze([]),
  getProvisionalAllocation:id=>get(byAllocation,id),
  getRivalries:id=>freeze([...(byRivalry.get(id)||[])]),
  getDescription:(id,lang)=>languages.includes(lang)?localized.get(id)?.[lang]??null:null,
  getDescriptions:id=>get(localized,id),
  getDivisionForClub:id=>[...byAllocation.values()].find(a=>a.memberIds.includes(id))?.divisionId??null,
  clubs:freeze([...byClub.values()]),
  divisions:freeze([...byDivision.values()]),
  competitions:freeze([...byCompetition.values()]),
  rivalries:freeze([...pairs].length===352?rivalries.map(r=>freeze(structuredClone(r))):[]),
  allocationStatus:'provisional'
 };
 return Object.freeze(api);
}
