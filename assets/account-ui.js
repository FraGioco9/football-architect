/* Shared account presentation and trusted host/language handoff; no credentials in storage. */
((root,factory)=>{
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.faAccountUI=api.mount(root);
})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const languages=['en','de','es','fr','it'],key='football-architect:language';
 const supported=value=>languages.includes(value);
 const resolveLanguage=(explicit,saved)=>supported(explicit)?explicit:supported(saved)?saved:'en';
 function accountTarget(href,language){
  const url=new URL(href);
  if(!/^\/account(?:\/(?:login|register|recover|verify-email))?\/?(?:index\.html)?$/.test(url.pathname))throw Error('Invalid account route');
  const host=url.hostname.toLowerCase();
  if(host==='localhost')url.hostname='app.localhost';
  else if(!host.startsWith('app.')&&!/^(?:127\.0\.0\.1|\[::1\])$/.test(host)&&!host.endsWith('.vercel.app')&&!host.endsWith('.github.io'))url.hostname='app.'+host.replace(/^www\./,'');
  const next=url.searchParams.get('next'),token=url.searchParams.get('token');
  url.search='';url.hash='';url.username='';url.password='';
  if(['/account/','/settings/'].includes(next))url.searchParams.set('next',next);
  if((url.pathname.includes('/recover')||url.pathname.includes('/verify-email'))&&/^[a-f0-9]{64}$/.test(token||''))url.searchParams.set('token',token);
  url.searchParams.set('lang',resolveLanguage(language,null));
  return url.href;
 }
 function mount(win){
  const doc=win.document,url=new URL(win.location.href);
  let saved;try{saved=win.localStorage.getItem(key)}catch{/* Storage is optional. */}
  let language=resolveLanguage(url.searchParams.get('lang'),saved),redirecting=false;
  const target=accountTarget(url.href,language);
  if(new URL(target).origin!==url.origin){
   redirecting=true;doc.documentElement.dataset.accountRedirecting='true';
   win.location.replace(target);
  }
  const callbacks=new Set();
  function links(){
   for(const a of doc.querySelectorAll('a[href]')){
    const href=new URL(a.getAttribute('href'),url);
    if(href.origin===url.origin&&href.pathname.startsWith('/account'))a.href=accountTarget(href.href,language);
   }
  }
  function choose(value){
   language=resolveLanguage(value,null);doc.documentElement.lang=language;
   try{win.localStorage.setItem(key,language)}catch{/* Current document still changes language. */}
   // Keep reloads in the chosen language; one-time tokens are never reintroduced.
   const current=new URL(win.location.href);current.searchParams.set('lang',language);
   win.history.replaceState(null,'',current.pathname+current.search);
   const select=doc.getElementById('account-language');if(select)select.value=language;
   const label=doc.getElementById('account-language-label');
   if(label)label.textContent={en:'Language',de:'Sprache',es:'Idioma',fr:'Langue',it:'Lingua'}[language];
   links();for(const callback of callbacks)callback(language);
  }
  function ready(){
   const select=doc.getElementById('account-language');
   if(select)select.addEventListener('change',()=>choose(select.value));
   choose(language);
   for(const link of doc.querySelectorAll('[data-account-home]')){
    const home=new URL('/',url);if(home.hostname.startsWith('app.'))home.hostname=home.hostname.slice(4);
    link.href=home.href;
   }
  }
  if(!redirecting){
   doc.documentElement.lang=language;
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
   win.addEventListener('storage',event=>{if(event.key===key)choose(event.newValue)});
  }
  // Repaint status messages as well as labels, without touching user-entered values.
  function translateStatus(previous,next){
   for(const node of doc.querySelectorAll('[role="status"],#status,#message,#sessions-summary')){
    const index=previous.indexOf(node.textContent);if(index>=0)node.textContent=next[index];
   }
  }
  return {get language(){return language},redirecting,bind(callback){callbacks.add(callback);callback(language)},translateStatus,choose};
 }
 return {accountTarget,resolveLanguage,mount};
});
