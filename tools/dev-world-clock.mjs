/* CAL-WORLD-56A: DEV-only world progress; never included in the public artifact. */
export const SEASON_KEY='football-architect:standings-dev-season';
export const DAY_KEY='football-architect:calendar-dev-world-day';
export const ROUNDS_KEY='football-architect:standings-dev-matchdays';
export const NATIONAL_DAYS=Object.freeze([13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,34,35,37,39,40,42,44,45,47,49,50,52,53,54]);
const valid=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const stored=(storage,key,min,max,fallback)=>{
  try{const raw=storage.getItem(key);if(raw===null||raw.trim()==='')return fallback;const n=Number(raw);return valid(n,min,max)?n:fallback}catch{return fallback}
};
export const nationalProgress=day=>{
  if(!valid(day,1,56))throw RangeError('Invalid world day');
  return NATIONAL_DAYS.filter(n=>n<=day).length;
};
export function createDevWorldClock(storage=sessionStorage,dispatch=()=>{}){
  let revision=0;
  const read=()=>{const season=stored(storage,SEASON_KEY,0,4,1);return Object.freeze({season,day:season===0?1:stored(storage,DAY_KEY,1,56,1)})};
  const snapshot=s=>s.season===0?null:({source:{kind:'dev',reference:'fictional DEV clock'},current:{season:s.season,day:s.day}});
  const emit=(s,previous)=>{
    dispatch('fa:world-clock-snapshot',snapshot(s));
    dispatch('fa:dev-progress-change',{season:s.season,worldDay:s.day,matchdays:s.season===0?0:nationalProgress(s.day)});
    if(s.day!==previous.day)dispatch('fa:dev-world-day-change',{season:s.season,day:s.day});
  };
  const commit=(next)=>{
    if(!valid(next.season,0,4)||!valid(next.day,1,56))return false;
    if(next.season===0)next={season:0,day:1};
    const before=read();
    if(before.season===next.season&&before.day===next.day)return true;
    let savedSeason,savedDay,savedRounds;
    try{
      savedSeason=storage.getItem(SEASON_KEY);savedDay=storage.getItem(DAY_KEY);savedRounds=storage.getItem(ROUNDS_KEY);
      storage.setItem(SEASON_KEY,String(next.season));storage.setItem(DAY_KEY,String(next.day));if(next.season===0||before.season===0)storage.setItem(ROUNDS_KEY,"0");
    }catch{
      try{if(savedSeason===null)storage.removeItem(SEASON_KEY);else if(savedSeason!==undefined)storage.setItem(SEASON_KEY,savedSeason);
        if(savedDay===null)storage.removeItem(DAY_KEY);else if(savedDay!==undefined)storage.setItem(DAY_KEY,savedDay);
        if(savedRounds===null)storage.removeItem(ROUNDS_KEY);else if(savedRounds!==undefined)storage.setItem(ROUNDS_KEY,savedRounds)}catch{}
      return false;
    }
    revision++;
    emit(next,before);
    return true;
  };
  const reset=()=>{
    const before=read();
    try{storage.removeItem(SEASON_KEY);storage.removeItem(DAY_KEY);storage.removeItem(ROUNDS_KEY)}catch{return false}
    revision++;emit(read(),before);return true;
  };
  return Object.freeze({read,revision:()=>revision,commit,setSeason:n=>commit({...read(),season:n}),setDay:n=>read().season===0?false:commit({...read(),day:n}),reset,nationalProgress:()=>read().season===0?0:nationalProgress(read().day),snapshot:()=>snapshot(read()),publish:()=>{const s=read();dispatch('fa:world-clock-snapshot',snapshot(s));dispatch('fa:dev-progress-change',{season:s.season,worldDay:s.day,matchdays:s.season===0?0:nationalProgress(s.day)})}});
}
