/* ARCH-CLEAN-02 A02: pure, versioned rules registry. No I/O or runtime state. */
((root,factory)=>{
 const api=factory();
 root.faRulesRegistry=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const versions=Object.freeze(['domestic-top-v1','domestic-second-v1','international-int24-v1']);
 const cups=Object.freeze({'int-1':'SOVEREIGN-FINAL','int-2':'FEDERATION-FINAL'});
 const copy=value=>JSON.parse(JSON.stringify(value));
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const x of Object.values(value))freeze(x);Object.freeze(value)}return value};
 const fail=message=>{throw new TypeError('Rules Registry: '+message)};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function createRulesRegistry(definitions,engine){
  if(!Array.isArray(definitions)||definitions.length!==18||!engine||typeof engine.normalizeCompetition!=='function')fail('invalid source');
  const byCompetition=new Map(),byVersion=new Map(),historical=new Map();
  for(const item of definitions){
   if(!item||typeof item.id!=='string'||byCompetition.has(item.id))fail('duplicate or invalid competition');
   if(!versions.includes(item.rules?.version))fail('unknown version '+item.rules?.version);
   const normalized=engine.normalizeCompetition(item);
   const {id,rules,category,tier}=normalized;
   const version=rules.version;
   if(!versions.includes(version))fail('unknown version '+version);
   if(category==='domestic'){
    if(!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(id)||version!==(tier===1?'domestic-top-v1':'domestic-second-v1'))fail('domestic binding '+id);
   }else{
    if(!Object.hasOwn(cups,id)||version!=='international-int24-v1')fail('international binding '+id);
    const events=rules.phases.find(p=>p.id==='final')?.calendarEvents;
    if(!same(events,[cups[id]]))fail('final event '+id);
   }
   const canonical=freeze(copy(normalized));
   byCompetition.set(id,canonical);historical.set(id,canonical.rules);
   const template=byVersion.get(version);
   if(!template){
    byVersion.set(version,canonical.rules);
   }else{
    // The only legal profile variation is the cup-specific final event.
    const candidate=copy(canonical.rules),baseline=copy(template);
    if(version==='international-int24-v1'){
     const a=candidate.phases.find(p=>p.id==='final');
     const b=baseline.phases.find(p=>p.id==='final');
     a.calendarEvents=b.calendarEvents;
    }
    if(!same(candidate,baseline))fail('unapproved profile difference '+id);
   }
  }
  if(byCompetition.size!==18||byVersion.size!==3)fail('registry cardinality');
  for(const country of ['IT','ENG','ES','DE','FR','PT','NL','BR'])for(const tier of [1,2])if(!byCompetition.has(country+'-'+tier))fail('missing division');
  for(const cup of Object.keys(cups))if(!byCompetition.has(cup))fail('missing cup');
  return Object.freeze({
   versions,
   getProfile:version=>byVersion.get(version)??null,
   getCompetition:id=>byCompetition.get(id)??null,
   resolveCompetitionRules:id=>byCompetition.get(id)?.rules??null,
   getHistoricalBaseline:id=>historical.get(id)??null,
   listCompetitions:()=>freeze([...byCompetition.values()]),
   listBindings:()=>freeze([...byCompetition.values()].map(x=>({id:x.id,version:x.rules.version,finalEvent:cups[x.id]??null})))
  });
 }
 return Object.freeze({createRulesRegistry});
});
