// A04-07: static identity/rules adapter. No result source or public I/O.
import {createProvider} from './provider-contract.mjs';

export function createStaticProvider({catalog,rulesRegistry}){
 if(!catalog||typeof catalog.getCompetition!=='function'||
    !rulesRegistry||typeof rulesRegistry.getCompetition!=='function'||
    typeof rulesRegistry.resolveCompetitionRules!=='function')
  throw new TypeError('Static provider requires A01 Catalog and A02 Rules Registry');
 // Fail before accepting requests if the canonical binding is missing or drifts.
 const entries=catalog.competitions;
 if(!Array.isArray(entries)||entries.length!==18)throw new TypeError('Incomplete static catalog');
 for(const item of entries){
  const canonical=catalog.getCompetition(item.id);
  const definition=rulesRegistry.getCompetition(item.id);
  const rules=rulesRegistry.resolveCompetitionRules(item.id);
  if(!canonical||!definition||!rules||definition.id!==item.id||
     canonical.capacity!==definition.capacity||
     canonical.rules?.version!==rules.version||
     definition.rules!==rules||
     canonical.category==='international'&&
       canonical.rules?.phases?.find(p=>p.id==='final')?.calendarEvents?.[0]!==
       rules.phases.find(p=>p.id==='final')?.calendarEvents?.[0])
    throw new TypeError('Invalid static competition binding: '+item.id);
 }
 const getCompetition=id=>{
  const item=catalog.getCompetition(id);
  return item&&rulesRegistry.getCompetition(id)?.id===id?item:null;
 };
 return createProvider({
  id:'static',getCompetition,
  // No verified sports-results source exists. Lack of results is not zero.
  load:async request=>({
   schemaVersion:1,providerId:'static',competitionId:request.competitionId,
   selectedSeason:request.selectedSeason,scope:request.scope,
   requestId:request.requestId,contextRevision:request.contextRevision,
   status:'empty',data:null,reason:'no-results',
   provenance:{kind:'none',sourceRef:null,approved:false,coverage:'none'}
  })
 });
}
