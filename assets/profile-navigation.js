/* Sidebar profile entry: session is checked on activation, never during public reads. */
((root,factory)=>{
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 function profileDestination(authenticated,href,language){
  const url=new URL(authenticated?'/account/':'/account/login/',href);
  if(!authenticated)url.searchParams.set('next','/account/');
  url.searchParams.set('lang',['en','de','es','fr','it'].includes(language)?language:'en');
  return url.href;
 }
 function mount(win){
  const link=win.document.getElementById('app-nav-profile');if(!link)return;
  let pending=false;
  link.addEventListener('click',async event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const destination=new URL(link.href,win.location.href);
   if(destination.origin!==win.location.origin)return;
   event.preventDefault();if(pending)return;pending=true;link.setAttribute('aria-busy','true');
   const controller=new AbortController(),timer=win.setTimeout(()=>controller.abort(),8000);
   try{
    const response=await win.fetch('/api/player/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(response.status===401){win.location.assign(profileDestination(false,destination.href,win.document.documentElement.lang));return;}
    if(response.ok){
     const value=await response.json();
     if(value?.authenticated===true&&typeof value?.actor?.id==='string'){
      win.location.assign(profileDestination(true,destination.href,win.document.documentElement.lang));return;
     }
    }
    // Unavailable checks are not proof of logout; the account page handles them.
    win.location.assign(destination.href);
   }catch{win.location.assign(destination.href)}finally{win.clearTimeout(timer);pending=false;link.removeAttribute('aria-busy');}
  });
 }
 return {profileDestination,mount};
});
