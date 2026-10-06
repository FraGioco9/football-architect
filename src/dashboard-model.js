// UX2-02: presentation-only, read-only operational priorities.
// All links use existing page IDs / router actions. No persistence or gameplay changes.
export function dashboardFocus({players=[],unread=0,hasNext=false,seasonFinished=false}={}){
  const squad=Array.isArray(players)?players:[];
  const injuries=squad.filter(p=>Number(p?.injury)>0).length;
  const fatigued=squad.filter(p=>Number.isFinite(Number(p?.fitness))&&Number(p.fitness)<65).length;
  const parsedUnread=Number(unread);
  const mail=Number.isFinite(parsedUnread)?Math.max(0,Math.trunc(parsedUnread)):0;
  const actions=[];
  if(injuries)actions.push({kind:'injuries',count:injuries,page:'squad',level:'warning'});
  if(fatigued)actions.push({kind:'fitness',count:fatigued,page:'squad',level:'warning'});
  if(mail)actions.push({kind:'inbox',count:mail,page:'inbox',level:'info'});
  if(hasNext)actions.push({kind:'preparation',count:null,page:'tactics',level:'normal'});
  else if(seasonFinished)actions.push({kind:'season',count:null,action:'new-season',level:'normal'});
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
