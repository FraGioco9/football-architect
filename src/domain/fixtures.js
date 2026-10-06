// Domain logic: no DOM, browser storage or UI dependencies.

export function createFixtures(teamIds,season=1){
  const ids=[...teamIds], rounds=[], count=ids.length;
  for(let round=0;round<count-1;round++){
    const matches=[];
    for(let i=0;i<count/2;i++){
      const a=ids[i],b=ids[count-1-i];
      matches.push({home:(round+i)%2===0?a:b,away:(round+i)%2===0?b:a});
    }
    rounds.push(matches);
    ids.splice(1,0,ids.pop());
  }
  return [...rounds,...rounds.map(r=>r.map(m=>({home:m.away,away:m.home})))].map((r,i)=>({round:i+1,season,matches:r.map((m,j)=>({id:`${season}-${i+1}-${j+1}`,...m,result:null}))}));
}
