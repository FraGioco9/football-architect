/* Yield one paint opportunity for the static competition shell before data hydration. */
(()=>{
  'use strict';
  const hydrate=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const script=document.createElement('script');
    script.src='/assets/competition-page.js';
    document.head.appendChild(script);
  }));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate,{once:true});
  else hydrate();
})();
