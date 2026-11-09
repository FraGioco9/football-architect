/* CAL-IMP-05A: read-only world clock adapter; no wall-clock inference or simulation writes. */
((root,factory)=>{
 const api=factory(root.faWorldCalendarModel);
 root.faWorldClockAdapter=api;
 if(root.document&&!root.faWorldState)root.faWorldState=api.createWorldState();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,model=>{
 'use strict';
 const unavailable=()=>Object.freeze({source:Object.freeze({kind:'unavailable',reference:null}),current:null,eventStates:Object.freeze([])});
 function normalize(input){
  if(input===null||input===undefined)return unavailable();
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Invalid clock snapshot');
  const {source,current,eventStates=[]}=input;
  if(!source||!['dev','authoritative'].includes(source.kind)||typeof source.reference!=='string'||!source.reference.trim())throw TypeError('Invalid source provenance');
  if(!current||!Number.isSafeInteger(current.season)||current.season<1||!Number.isInteger(current.day)||current.day<1||current.day>56)throw TypeError('Invalid world day');
  if(!Array.isArray(eventStates)||eventStates.length)throw TypeError('Lifecycle data requires an independently authorized provider');
  if(!model||typeof model.projectSeason!=='function')throw TypeError('World Calendar model unavailable');
  model.projectSeason(current.season,{source,current,eventStates:[]});
  return Object.freeze({source:Object.freeze({kind:source.kind,reference:source.reference}),current:Object.freeze({season:current.season,day:current.day}),eventStates:Object.freeze([])});
 }
 function project(season,snapshot){
  const valid=normalize(snapshot);
  return model.projectSeason(season,valid);
 }
 function projectCompetition(season,competitionId,snapshot){
  const valid=normalize(snapshot);
  if(!model||typeof model.projectCompetition!=='function')throw TypeError('Competition projection unavailable');
  return model.projectCompetition(season,competitionId,valid);
 }
 // Shared SH-03 contracts. Selection is deliberately external to global progress.
 const worldKeys=['generation','revision','seasonNumber','day','phase'];
 const sameWorld=(a,b)=>worldKeys.every(key=>a?.[key]===b?.[key]);
 function validPublicWorld(w){
  const count=n=>Number.isSafeInteger(n)&&n>=0;
  return !!w&&typeof w==='object'&&!Array.isArray(w)&&w.schemaVersion===1&&
   typeof w.generation==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(w.generation)&&
   count(w.revision)&&count(w.seasonNumber)&&count(w.day)&&w.day<=56&&
   (w.phase==='unstarted'?w.seasonNumber===0&&w.day===0&&w.revision===0:w.seasonNumber>0&&
    (w.phase==='preparing'?w.day===0:w.phase==='active'?w.day>=1:w.phase==='closed'&&w.day===56));
 }
 function createWorldState(){
  let source='authoritative',sourceRevision=0,world=null,current=null,readRevision=0,worldStatus='pending';
  const listeners=new Set();
  const get=()=>Object.freeze({source,sourceRevision,world,current,readRevision,worldStatus});
  const emit=()=>{const value=get();for(const listener of listeners)listener(value)};
  return Object.freeze({get,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)},
   waitForWorld({signal}={}){
    const revision=sourceRevision;
    return new Promise((resolve,reject)=>{
     let finished=false;
     const unsubscribe=()=>listeners.delete(check);
     const cleanup=()=>{unsubscribe();signal?.removeEventListener?.('abort',onAbort)};
     const finish=(value,error)=>{if(finished)return;finished=true;cleanup();if(error)reject(error);else resolve(value)};
     const onAbort=()=>finish(null,Error('World read aborted'));
     const check=()=>{
      if(signal?.aborted)return onAbort();
      if(sourceRevision!==revision||source!=='authoritative')return finish(null,Error('World source changed'));
      if(worldStatus==='unavailable')return finish(null,Error('World unavailable'));
      if(worldStatus==='ready'&&validPublicWorld(world))return finish(world);
     };
     listeners.add(check);
     signal?.addEventListener?.('abort',onAbort,{once:true});
     check();
    });
   },
   setSource(next){
    if(!next||!['authoritative','dev'].includes(next.kind))return false;
    const c=next.current;
    if(next.kind==='dev'&&(!c||!Number.isSafeInteger(c.season)||c.season<0||!Number.isInteger(c.day)||c.day<0||c.day>56||
      (c.season===0?c.day!==0:c.day<1)))return false;
    if(source===next.kind&&(source==='authoritative'||current?.season===c.season&&current?.day===c.day))return true;
    source=next.kind;sourceRevision++;readRevision++;world=null;worldStatus='pending';
    current=source==='dev'?Object.freeze({season:c.season,day:c.day}):null;emit();return true;
   },
   beginRead(){worldStatus='pending';return Object.freeze({sourceRevision,readRevision:++readRevision})},
   acceptWorld(input,ticket){
    if(source!=='authoritative'||ticket?.sourceRevision!==sourceRevision||ticket?.readRevision!==readRevision||!validPublicWorld(input))return false;
    if(world?.generation===input.generation&&input.revision<world.revision){worldStatus='ready';emit();return false;}
    if(world&&sameWorld(world,input)){worldStatus='ready';emit();return true;}
    worldStatus='ready';world=Object.freeze({...input});current=Object.freeze({season:world.seasonNumber,day:world.day});emit();return true;
   },
   unavailable(ticket){if(source!=='authoritative'||ticket?.sourceRevision!==sourceRevision||ticket?.readRevision!==readRevision)return false;world=null;current=null;worldStatus='unavailable';emit();return true}
  });
 }
 function createSnapshotReader({timeoutMs=8000,getIdentity,isEnabled=()=>true,worldState=globalThis.faWorldState,getSource=()=>worldState?.get?.(),useSharedWorld=false,clear,fetchWorld,read,validate,commit,onState=()=>{},onBeforeWorld=()=>{},onWorld=()=>{}}){
  let epoch=0,controller=null,disposed=false;
  const cancel=()=>{epoch++;controller?.abort()};
  return Object.freeze({async load(){
   if(disposed||!isEnabled()||getSource()?.source==='dev')return false;
   const shared=useSharedWorld&&typeof worldState?.waitForWorld==='function';
   const sourceRevision=getSource()?.sourceRevision,worldTicket=shared?null:worldState?.beginRead();
   cancel();const ticket=epoch;controller=new AbortController();const {signal}=controller;
   clear();const identity=getIdentity();
   const current=()=>!disposed&&ticket===epoch&&isEnabled()&&getSource()?.sourceRevision===sourceRevision&&getSource()?.source!=='dev'&&getIdentity()===identity;
   if(identity===null||identity===undefined)return false;
   onState('loading');let completed=false;const requestController=controller,timer=setTimeout(()=>requestController.abort(),timeoutMs);
   try{
    const before=shared?await worldState.waitForWorld({signal}):await fetchWorld({signal});
    if(!current()||!validPublicWorld(before))return false;
    if(!shared&&worldState&&!worldState.acceptWorld(before,worldTicket)&&!sameWorld(worldState.get().world,before))return false;
    const lease=shared?getSource()?.readRevision:null;
    onBeforeWorld(before);if(!current())return false;
    const payload=validate(await read({signal}));if(!current()||!sameWorld(before,payload?.world))return false;
    let after=before;
    if(shared){
     // A canonical snapshot is enough for the initial read, but the backend
     // can reset while the season response is in flight (including a response
     // held by the network). Recheck once *after* that response before commit.
     // This preserves cross-session reset fencing without the old third GET.
     const latest=await fetchWorld({signal});
     if(!current()||!validPublicWorld(latest))return false;
     const snapshot=getSource();
     if(snapshot?.readRevision!==lease||!sameWorld(snapshot?.world,before))return false;
     if(!sameWorld(payload.world,latest)){
      // Publish the newly observed canonical world so consumers can invalidate
      // the old view and load the correct season; never commit the old payload.
      if(worldState?.acceptWorld)worldState.acceptWorld(latest,worldState.beginRead());
      return false;
     }
     after=latest;
    }else{
     after=await fetchWorld({signal});
     if(!current()||!validPublicWorld(after)||!sameWorld(payload.world,after))return false;
     if(worldState&&!worldState.acceptWorld(after,worldTicket)&&!sameWorld(worldState.get().world,after))return false;
    }
    // The caller commits synchronously. It may update its own context revision.
    if(commit(payload)===false)return false;
    completed=true;onWorld(after);onState(payload.status);return true;
   }catch{return false}finally{clearTimeout(timer);if(!completed&&current())onState('unavailable')}
  },cancel,dispose(){disposed=true;cancel()}});
 }
 function mountWorldState({window,document,onChange=()=>{}}){
    const state=window.faWorldState;
    if(!state)return;
    state.subscribe(()=>onChange());onChange();
    const protectedSource=window.faDevPreviewMode===true||document.documentElement.dataset.faDevCurrentSeason!==undefined;
    const syncDebug=()=>{
      if(!protectedSource||window.faDebugEnabled===false)return;
      try{
        const raw=sessionStorage.getItem('football-architect:standings-dev-season');
        const candidate=raw===null||raw.trim()===''?1:Number(raw),n=Number.isInteger(candidate)&&candidate>=0&&candidate<=4?candidate:1;
        const storedDay=Number(sessionStorage.getItem('football-architect:calendar-dev-world-day')||1),day=Number.isInteger(storedDay)&&storedDay>=1&&storedDay<=56?storedDay:1;
        state.setSource({kind:'dev',current:{season:n,day:n===0?0:day}});
      }catch{state.setSource({kind:'dev',current:{season:0,day:0}})}
    };
    let controller;
    const refresh=async()=>{
      if(protectedSource&&window.faDebugEnabled!==false){syncDebug();return;}
      state.setSource({kind:'authoritative'});
      controller?.abort();controller=new AbortController();const ticket=state.beginRead(),requestController=controller,timer=setTimeout(()=>requestController.abort(),8000);
      try{
        const response=await window.fetch('/api/world',{signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
        if(!response.ok)throw Error('World unavailable');
        const world=(await response.json())?.world;
        if(!validPublicWorld(world))state.unavailable(ticket);else state.acceptWorld(world,ticket);
      }catch{state.unavailable(ticket)}finally{clearTimeout(timer)}
    };
    window.addEventListener('fa:dev-progress-change',syncDebug);
    window.addEventListener('fa:dev-world-day-change',syncDebug);
    window.addEventListener('fa:source-change',refresh);
    window.addEventListener('fa:world-invalidated',refresh);
    // Tab visibility/focus alone does not invalidate the canonical world.
    // Explicit world/source invalidation and restored documents still refresh.
    window.addEventListener('pageshow',event=>{if(event.persisted)void refresh()});
    window.addEventListener('pagehide',()=>controller?.abort());
    void refresh();
 }
 return Object.freeze({normalize,unavailable,project,projectCompetition,validPublicWorld,sameWorld,createWorldState,createSnapshotReader,mountWorldState});
});
