/* PLAYERS-MOBILE-01 (#574): shared presentation only, no API or data changes. */
((root,factory)=>{
 const ui=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=ui;
 if(root?.document)ui.mount(root);
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const abbreviate=name=>{
  if(typeof name!=='string')return name;
  const match=/^(\S+)\s+(.+)$/u.exec(name.trim());
  if(!match||/^\p{L}\.$/u.test(match[1]))return name;
  return Array.from(match[1])[0]+'. '+match[2];
 };
 const scrollState=(width,viewport,offset)=>{
  const max=Math.max(0,width-viewport),scrollable=max>1;
  return {left:scrollable&&offset>1,right:scrollable&&offset<max-1};
 };
 const selector='.app-player-name-link,.club-roster-player-link,.admin-contracts-player-name';
 function mount(win){
  const doc=win.document;
  const start=()=>{
   const known=new Map();
   const mobile=()=>!!win.matchMedia?.('(max-width:720px)').matches;
   const updateFade=region=>{
    const state=mobile()?scrollState(region.scrollWidth,region.clientWidth,region.scrollLeft):{left:false,right:false};
    region.dataset.canScrollLeft=String(state.left);
    region.dataset.canScrollRight=String(state.right);
   };
   const observer=typeof win.ResizeObserver==='function'
    ?new win.ResizeObserver(entries=>{for(const entry of entries)updateFade(entry.target)}):null;
   const decorate=node=>{
    if(node.dataset.mobileNameReady)return;
    const full=node.textContent?.trim();
    if(!full)return;
    node.dataset.mobileNameReady='true';
    const shortened=abbreviate(full);
    if(shortened===full)return;
    const fullSpan=doc.createElement('span');fullSpan.className='fa-player-full-name';fullSpan.textContent=full;
    const smallSpan=doc.createElement('span');smallSpan.className='fa-player-short-name';smallSpan.setAttribute('aria-hidden','true');smallSpan.textContent=shortened;
    node.setAttribute('aria-label',full);
    node.replaceChildren(fullSpan,smallSpan);
   };
   const sync=()=>{
    // Roster/Preview can replace entire scrollers; detach observers from old nodes.
    for(const [old,listener] of known){
     if(!old.isConnected){old.removeEventListener('scroll',listener);observer?.unobserve(old);known.delete(old);}
    }
    for(const region of doc.querySelectorAll('.app-players-table-scroll')){
     if(!known.has(region)){
      const listener=()=>updateFade(region);
      known.set(region,listener);
      region.addEventListener('scroll',listener,{passive:true});
      observer?.observe(region);
     }
     if(mobile())for(const node of region.querySelectorAll(selector))decorate(node);
     updateFade(region);
    }
   };
   let queued=false;
   const schedule=()=>{
    if(queued)return;
    queued=true;
    win.requestAnimationFrame(()=>{queued=false;sync()});
   };
   sync();
   win.addEventListener('resize',schedule,{passive:true});
   if(typeof win.MutationObserver==='function')new win.MutationObserver(changes=>{
    for(const mutation of changes){
     if(!mutation.addedNodes.length)continue;
     if(mutation.target.closest?.('.app-players-table-scroll')){schedule();return;}
     for(const node of mutation.addedNodes){
      if(node.nodeType===1&&(node.matches?.('.app-players-table-scroll')||node.querySelector?.('.app-players-table-scroll'))){schedule();return;}
     }
    }
   }).observe(doc.body,{childList:true,subtree:true});
  };
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
 }
 return {abbreviate,scrollState,mount};
});
