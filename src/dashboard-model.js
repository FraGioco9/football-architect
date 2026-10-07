// UX2-02: presentation-only, read-only operational priorities.
// All links use existing page IDs / router actions. No persistence or gameplay changes.
export function dashboardFocus({players=[],requiredInput=null}={}){
  const squad=Array.isArray(players)?players:[];
  const injuries=squad.filter(p=>Number(p?.injury)>0).length;
  const fatigued=squad.filter(p=>Number(p?.injury)<=0&&Number.isFinite(Number(p?.fitness))&&Number(p.fitness)<65).length;
  const actions=[];
  if(requiredInput)actions.push({kind:'input',count:null,message:requiredInput,page:'inbox',level:'urgent'});
  if(injuries)actions.push({kind:'injuries',count:injuries,page:'squad',level:'warning'});
  if(fatigued)actions.push({kind:'fitness',count:fatigued,page:'squad',level:'warning'});
  return actions;
}

export function dashboardSchedule({fixtures=[],round=0,clubId}={}){
  const weeks=Array.isArray(fixtures)?fixtures:[];
  const done=Math.max(0,Math.min(weeks.length,Math.trunc(Number(round)||0)));
  const mine=week=>week?.matches?.find(m=>m.home===clubId||m.away===clubId)||null;
  return {
    next:mine(weeks[done]),
    upcoming:weeks.slice(done,done+4).map(mine).filter(Boolean),
    recent:weeks.slice(0,done).reverse().slice(0,5).map(mine).filter(Boolean),
    completed:done>=weeks.length
  };
}
