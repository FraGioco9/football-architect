// Pure selection validation shared by the Node build and server-side snapshot gate.
// No I/O, DEV state, approval grant, hashes or rule definitions live here.
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
const fail=()=>{throw Error('Invalid Season 1 participant selection')};
export function validateSeasonOneBindings(bindings){
 if(!Array.isArray(bindings)||bindings.length!==18)return fail();
 const byId=new Map();
 for(const b of bindings){
  if(!b||typeof b!=='object'||typeof b.competitionId!=='string'||!Array.isArray(b.clubIds)||byId.has(b.competitionId))return fail();
  byId.set(b.competitionId,b);
 }
 const expected=new Map(countries.flatMap(c=>[1,2].map(t=>[`${c}-${t}`,Array.from({length:16},(_,i)=>`${c}-${i+1+(t===1?0:16)}`)])));
 for(const [id,first] of [['int-1',1],['int-2',4]])expected.set(id,countries.flatMap(c=>[first,first+1,first+2].map(n=>`${c}-${n}`)));
 for(const [id,ids] of expected){
  const b=byId.get(id);
  if(!b||b.clubIds.length!==ids.length||new Set(b.clubIds).size!==ids.length||ids.some(id=>!b.clubIds.includes(id)))return fail();
 }
}
export function validateSeasonOneSelection(selection){
 if(!selection||selection.schemaVersion!==1||selection.kind!=='season-one-participant-selection'||
  selection.status!=='owner-approved-participants-only'||selection.season!==1||selection.productionApproval!==false||
  selection.sourceOfTruth!=='initialization-input-not-current-world'||!Array.isArray(selection.countries)||
  selection.countries.length!==8||new Set(selection.countries).size!==8||countries.some(c=>!selection.countries.includes(c)))return fail();
 validateSeasonOneBindings(selection.bindings);
 for(const b of selection.bindings)if(Object.keys(b).sort().join(',')!=='clubIds,competitionId')return fail();
}
