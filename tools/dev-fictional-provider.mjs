// A04-08: DEV-only adapter. Never include in public staging.
import {createProvider} from '../assets/provider-contract.mjs';

// The existing DEV simulator remains the sole producer. This adapter neither
// schedules fixtures nor supplies an alternative history/results source.
export function createDevFictionalProvider({getCompetition,readProgress,loadSeason,resolveSeasonRules,validateSeasonData}){
 if([getCompetition,readProgress,loadSeason,resolveSeasonRules,validateSeasonData].some(fn=>typeof fn!=='function'))
  throw new TypeError('DEV provider requires injected source and domain boundaries');
 const sourceRef='dev-fictional-preview';
 return createProvider({
  id:'dev-fictional',
  getCompetition:id=>{
   const definition=getCompetition(id);
   return /^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(id)&&definition?.id===id?definition:null;
  },
  load:async request=>{
   const progress=readProgress();
   const active=progress?.enabled===true&&Number.isInteger(progress.debugSeason)&&progress.debugSeason>=1&&progress.debugSeason<=4;
   const echo={...Object.fromEntries(['competitionId','selectedSeason','scope','requestId','contextRevision'].map(k=>[k,request[k]])),
    schemaVersion:1,providerId:'dev-fictional'};
   const none=(status,reason)=>({...echo,status,data:null,reason,
    provenance:{kind:'fictional',sourceRef:null,approved:false,coverage:'none'}});
   if(!active)return none('empty','disabled');
   // Historical archive access belongs to A04-09, not a synthetic DEV record.
   if(request.scope==='history')return none('unavailable','unsupported');
   if(request.selectedSeason>progress.debugSeason)return none('empty','no-results');
   const data=await loadSeason(request,progress);
   if(data==null)return none('empty','no-results');
   return {...echo,status:data.status,data,reason:null,
    provenance:{kind:'fictional',sourceRef,approved:false,coverage:data.status==='available'?'complete':'partial'}};
  },
  validateData:(data,request)=>{
   const definition=getCompetition(request.competitionId);
   return Boolean(definition&&resolveSeasonRules(definition,data))&&validateSeasonData(data,request)===true;
  }
 });
}
