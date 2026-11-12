/* Profile session is checked on activation. Admin discoverability uses account permissions only. */
((root,factory)=>{
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 function profileDestination(authenticated,href,language){
  const url=new URL(authenticated?'/account':'/account/login',href);
  if(['de','es','fr','it'].includes(language))url.searchParams.set('lang',language);
  return url.href;
 }
 function canAccessAdmin(permissions){
  return Array.isArray(permissions)&&permissions.includes('admin.access')&&permissions.includes('admin.world.read');
 }
 function mountAdminNavigation(win){
  const doc=win.document,settings=doc.getElementById('app-nav-settings');if(!settings)return;
  const onAdmin=/^\/admin(?:\/calendar|\/players(?:\/preview(?:\/player)?)?)?$/.test(win.location.pathname.replace(/\/+$/,''));
  let entry=null,request=0;
  function paint(){
   if(!entry)return;
   entry.href=typeof win.faAppHref==='function'?win.faAppHref('/admin'):new URL('/admin',settings.href).href;
   entry.classList.toggle('is-active',onAdmin);
   if(onAdmin)entry.setAttribute('aria-current','page');
  }
  function show(allowed){
   if(!allowed){entry?.remove();entry=null;return;}
   if(!entry){
    entry=doc.createElement('a');entry.id='app-nav-admin';entry.className='fa-shell-link';
    const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    icon.setAttribute('class','fa-icon');icon.setAttribute('width','18');icon.setAttribute('height','18');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('aria-hidden','true');
    const shape=doc.createElementNS('http://www.w3.org/2000/svg','path');shape.setAttribute('d','M12 3 3 7v5c0 5 4 8 9 10 5-2 9-5 9-10V7Z M8 12l3 3 5-6');icon.append(shape);
    const label=doc.createElement('span');label.textContent='Admin';entry.append(icon,label);settings.after(entry);
   }
   paint();
  }
  async function check(){
   const ticket=++request;show(false);
   const controller=new win.AbortController(),timer=win.setTimeout(()=>controller.abort(),8000);
   try{
    const response=await win.fetch('/api/player/permissions',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const value=response.ok?await response.json():null;
    if(ticket===request)show(canAccessAdmin(value?.permissions));
   }catch{if(ticket===request)show(false)}finally{win.clearTimeout(timer)}
  }
  // The Admin controller has its own fresh permission checks, including refresh
  // and revocation. Reuse that state here instead of duplicating its request.
  if(onAdmin){
   show(win.faAdminAccess===true);
   win.addEventListener('fa:admin-access',event=>show(event.detail===true));
  }else{
   void check();
   win.addEventListener('pageshow',event=>{if(event.persisted)void check()});
  }
 }
 function mount(win){
  mountAdminNavigation(win);
  const link=win.document.getElementById('app-nav-profile');if(!link)return;
  link.href=profileDestination(false,link.href,win.document.documentElement.lang);
  let pending=false;
  link.addEventListener('click',async event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const destination=new URL(link.href,win.location.href);
   if(destination.origin!==win.location.origin)return;
   event.preventDefault();if(pending)return;pending=true;link.setAttribute('aria-busy','true');
   const login=()=>{win.faLoginReturn?.remember();win.location.assign(profileDestination(false,destination.href,win.document.documentElement.lang))};
   const controller=new AbortController(),timer=win.setTimeout(()=>controller.abort(),8000);
   try{
    const response=await win.fetch('/api/player/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(response.status===401){login();return;}
    if(response.ok){
     const value=await response.json();
     if(value?.authenticated===true&&typeof value?.actor?.id==='string'){
      win.location.assign(profileDestination(true,destination.href,win.document.documentElement.lang));return;
     }
    }
    // Login restores a confirmed session if this preliminary check was unavailable.
    login();
   }catch{login()}finally{win.clearTimeout(timer);pending=false;link.removeAttribute('aria-busy');}
  });
 }
 return {profileDestination,canAccessAdmin,mount};
});
