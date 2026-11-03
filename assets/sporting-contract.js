/* SH-01: pure sporting identity/version contract shared by browser and Worker.
 * No season membership, approved snapshot, fixture state, or persistence authority.
 */
((root,factory)=>{
 const api=factory();
 root.faSportingContract=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const countries=Object.freeze(['IT','ENG','ES','DE','FR','PT','NL','BR']);
 const domestic=Object.freeze(countries.flatMap(country=>[country+'-1',country+'-2']));
 const cups=Object.freeze({'int-1':'SOVEREIGN-FINAL','int-2':'FEDERATION-FINAL'});
 const international=Object.freeze(Object.keys(cups));
 const competitionIds=Object.freeze([...domestic,...international]);
 const versions=Object.freeze(['domestic-top-v1','domestic-second-v1','international-int24-v1']);
 const rulesVersion=id=>domestic.includes(id)?(id.endsWith('-1')?versions[0]:versions[1]):Object.hasOwn(cups,id)?versions[2]:null;
 const finalEvent=id=>Object.hasOwn(cups,id)?cups[id]:null;
 return Object.freeze({countries,domestic,international,competitionIds,cups,versions,rulesVersion,finalEvent});
});
