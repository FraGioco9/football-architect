(()=>{'use strict';
const labels={
 en:'Open local DEV inbox',it:'Apri la casella DEV locale',de:'Lokales DEV-Postfach öffnen',es:'Abrir buzón DEV local',fr:'Ouvrir la boîte DEV locale'
};
let checked=null;
async function available(){
 if(checked!==null)return checked;
 checked=(async()=>{
  try{
   const r=await fetch('/api/local-dev/inbox',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
   if(!r.ok||r.headers.get('Content-Type')?.includes('text/html'))return false;
   const value=await r.json();return value?.localOnly===true&&Array.isArray(value.messages);
  }catch{return false}
 })();
 return checked;
}
window.faLocalDevInbox={
 async show(anchor){
  if(!anchor||!await available()||anchor.parentElement?.querySelector('[data-local-dev-inbox]'))return;
  const link=document.createElement('a');
  link.href='/api/local-dev/inbox';
  link.dataset.localDevInbox='';
  const locale=window.faAccountUI?.language||'en';
  link.textContent=labels[locale]||labels.en;
  const p=document.createElement('p');p.append(link);anchor.insertAdjacentElement('afterend',p);
 }
};
})();
