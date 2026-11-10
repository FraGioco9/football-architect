// CLUB-HISTORY-13: per-world, per-path shared public reads.
// A caller leaving a tab cancels only its own wait; another tab can finish the
// same request. World/source changes abort underlying work and fence old data.
export function createClubPublicReadCache({getState,fetchJson}){
 if(typeof getState!=='function'||typeof fetchJson!=='function')throw TypeError('Invalid Club read cache');
 const entries=new Map();let identity=null;
 const aborted=()=>Object.assign(Error('Club public read cancelled'),{name:'AbortError'});
 const clear=()=>{
  for(const entry of entries.values())entry.controller.abort();
  entries.clear();identity=null;
 };
 const worldKey=()=>{
  const state=getState(),w=state?.world;
  if(state?.source!=='authoritative'||state.worldStatus!=='ready'||!w)
   throw TypeError('Club public source not ready');
  return JSON.stringify([state.sourceRevision,w.generation,w.revision,w.seasonNumber,w.day,w.phase]);
 };
 const read=async(path,{signal}={})=>{
  if(signal?.aborted)return Promise.reject(aborted());
  const key=worldKey();
  if(key!==identity){clear();identity=key;}
  let entry=entries.get(path);
  if(!entry){
   const controller=new AbortController();
   entry={controller,promise:null};
   entry.promise=Promise.resolve().then(()=>fetchJson(path,{signal:controller.signal}));
   entries.set(path,entry);
   const current=entry;
   // A rejected fetch can be retried; successful projections remain cached
   // strictly for the same generation, revision, source and sporting day.
   void current.promise.catch(()=>{
    if(entries.get(path)===current)entries.delete(path);
   });
  }
  if(!signal)return entry.promise;
  return new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(error,value)=>{
    if(settled)return;settled=true;
    signal.removeEventListener('abort',onAbort);
    if(error)reject(error);else resolve(value);
   };
   const onAbort=()=>finish(aborted());
   signal.addEventListener('abort',onAbort,{once:true});
   if(signal.aborted)return onAbort();
   entry.promise.then(value=>finish(null,value),error=>finish(error));
  });
 };
 return Object.freeze({read,clear});
}
