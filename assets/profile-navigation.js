/* Sidebar profile entry: session is checked on activation, never during public reads. */
((root,factory)=>{
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 function profileDestination(authenticated,href,language){
  const url=new URL(authenticated?'/account/':'/account/login/',href);
  if(['de','es','fr','it'].includes(language))url.searchParams.set('lang',language);
  return url.href;
 }
 function mount(win){
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
 return {profileDestination,mount};
});
