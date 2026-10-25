// A04-09: opt-in historical access, with no built-in source or history generation.
import {createProvider} from './provider-contract.mjs';

export function createVerifiedHistoryProvider({getCompetition,loadHistory,resolveSeasonRules,validateHistory,sourceRef=null,approved=false}){
 if([getCompetition,loadHistory,resolveSeasonRules,validateHistory].some(fn=>typeof fn!=='function'))
  throw new TypeError('Historical provider requires injected source and domain validation');
 const configured=typeof sourceRef==='string'&&sourceRef.trim().length>0&&approved===true;
 const echo=request=>Object.fromEntries(['competitionId','selectedSeason','scope','requestId','contextRevision'].map(key=>[key,request[key]]));
 const noData=(request,status,reason)=>({...echo(request),schemaVersion:1,providerId:'verified-historical',
  status,data:null,reason,provenance:{kind:'none',sourceRef:null,approved:false,coverage:'none'}});
 return createProvider({id:'verified-historical',getCompetition,sourceRef,approved,
  load:async request=>{
   if(request.scope!=='history')return noData(request,'unavailable','unsupported');
   const payload=await loadHistory(request);
   if(payload===null||payload===undefined)return noData(request,'empty','no-results');
   // A declared canonical, complete, approved source is necessary but never
   // sufficient: historical rules and the caller's domain validator must pass.
   return {...echo(request),schemaVersion:1,providerId:'verified-historical',
    status:'available',data:payload,reason:null,
    provenance:{kind:'verified',sourceRef,approved:configured,coverage:'complete'}};
  },
  validateData:(payload,request)=>{
   if(request.scope!=='history'||!configured||!payload||payload.source!=='canonical'||
      payload.competitionId!==request.competitionId||payload.coverage!=='complete'||
      payload.provenance?.approved!==true||!Array.isArray(payload.seasons))return false;
   const definition=getCompetition(request.competitionId);
   if(!definition)return false;
   const seen=new Set();
   for(const season of payload.seasons){
    if(!Number.isSafeInteger(season?.seasonId)||season.seasonId<1||
       season.seasonId>request.selectedSeason||season.status!=='completed'||
       seen.has(season.seasonId)||!resolveSeasonRules(definition,season))return false;
    seen.add(season.seasonId);
   }
   // Empty archives do not establish a completed record or data availability.
   return seen.size>0&&validateHistory(payload,request)===true;
  }
 });
}
