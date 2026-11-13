/* UI-only per-tab Admin permissions snapshot. Worker endpoints authorize each call.
 * Never store tokens, CSRF secrets, passwords or cookies in sessionStorage. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.faAdminPermissionsCache=api;
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const KEY='fa:admin:permissions:v1',version=1;
 const valid=p=>Array.isArray(p)&&p.length<=64&&p.every(x=>typeof x==='string'&&/^[a-z][a-z0-9.-]{0,79}$/.test(x));
 function create(win){
  let storage=null;
  try{storage=win.sessionStorage}catch{/* storage disabled: no cache */}
  const clear=()=>{try{storage?.removeItem(KEY)}catch{/* fail closed */}};
  try{
   const kind=win.performance?.getEntriesByType?.('navigation')?.[0]?.type;
   if(kind==='reload'||(!kind&&win.performance?.navigation?.type===1))clear();
  }catch{/* unsupported navigation API */}
  return {
   read(){
    try{
     const raw=storage?.getItem(KEY);if(!raw)return null;
     const value=JSON.parse(raw);
     if(value?.version!==version||!valid(value.permissions)){clear();return null}
     return [...value.permissions];
    }catch{clear();return null}
   },
   write(permissions){
    if(!valid(permissions))return false;
    try{storage?.setItem(KEY,JSON.stringify({version,permissions:[...permissions]}));return !!storage}
    catch{return false}
   },
   clear
  };
 }
 return {KEY,create};
});
