// I03: form data is derived only from completed regular-league matches.
// Pure preparation for existing shared Form display, not a second tooltip renderer.
export function prepareProtectedForm(fixtures,participants){
 const ids=new Set(participants),form=new Map([...ids].map(id=>[id,[]]));
 if(ids.size!==16||fixtures?.length!==240)throw Error("I03 Form: invalid league");
 const chronological=[...fixtures].sort((a,b)=>a.round-b.round||a.homeId.localeCompare(b.homeId));
 for(const fixture of chronological){
  if(!ids.has(fixture.homeId)||!ids.has(fixture.awayId))throw Error("I03 Form: foreign team");
  if(fixture.homeGoals===null||fixture.awayGoals===null)continue;
  const delta=fixture.homeGoals-fixture.awayGoals,homeResult=delta>0?"W":delta<0?"L":"D";
  for(const [id,isHome,result] of [[fixture.homeId,true,homeResult],[fixture.awayId,false,homeResult==="W"?"L":homeResult==="L"?"W":"D"]]){
   const entries=form.get(id);
   entries.push({round:fixture.round,homeId:fixture.homeId,awayId:fixture.awayId,
    homeGoals:fixture.homeGoals,awayGoals:fixture.awayGoals,isHome,result});
  }
 }
 return new Map([...form].map(([id,entries])=>[id,entries.slice(-5).reverse()]));
}
