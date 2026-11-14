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
 const positionsNeedCompact=(textWidth,availableWidth,count)=>count>1&&availableWidth>0&&textWidth>availableWidth+1;
 const positionText=cell=>String(cell.textContent||'').trim();
 const positionCodes=full=>full.split(',').map(code=>code.trim()).filter(Boolean);
 const positionLabels={
  en:'Show all positions: ',it:'Mostra tutte le posizioni: ',de:'Alle Positionen anzeigen: ',
  es:'Mostrar todas las posiciones: ',fr:'Afficher tous les postes : '
 };
 const scrollState=(width,viewport,offset)=>{
  const max=Math.max(0,width-viewport),scrollable=max>1;
  return {left:scrollable&&offset>1,right:scrollable&&offset<max-1};
 };
 function mount(win){
  const doc=win.document;
  const start=()=>{
   const known=new Map(),positionCells=new WeakMap();
   const popup=doc.createElement('div');
   popup.className='fa-positions-popup';popup.id='fa-positions-popup';
   popup.setAttribute('role','tooltip');popup.hidden=true;
   doc.body.append(popup);
   let activeButton=null;
   const closePopup=(restoreFocus=false)=>{
    if(!activeButton)return;
    const previous=activeButton;activeButton=null;
    previous.setAttribute('aria-expanded','false');
    previous.removeAttribute('aria-describedby');
    popup.hidden=true;
    if(restoreFocus&&previous.isConnected)previous.focus({preventScroll:true});
   };
   const showPopup=button=>{
    const full=button.closest('.fa-positions-cell')?.querySelector('.fa-positions-full')?.textContent?.trim();
    if(!full)return;
    closePopup();
    activeButton=button;button.setAttribute('aria-expanded','true');
    button.setAttribute('aria-describedby',popup.id);
    popup.textContent=full;popup.hidden=false;
    const rect=button.getBoundingClientRect(),height=popup.offsetHeight,width=popup.offsetWidth;
    const top=rect.bottom+7+height<=win.innerHeight-8?rect.bottom+7:Math.max(8,rect.top-height-7);
    popup.style.top=Math.round(top)+'px';
    popup.style.left=Math.round(Math.max(8,Math.min(rect.left,win.innerWidth-width-8)))+'px';
   };
   doc.addEventListener('click',event=>{
    const trigger=event.target.closest?.('button.fa-positions-more');
    if(!trigger){closePopup();return;}
    event.preventDefault();
    if(activeButton===trigger)closePopup();else showPopup(trigger);
   });
   doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&activeButton){event.preventDefault();closePopup(true);}
   });
   win.addEventListener('scroll',()=>closePopup(),{capture:true,passive:true});
   const decoratePosition=cell=>{
    if(positionCells.has(cell))return positionCells.get(cell);
    const full=positionText(cell),codes=positionCodes(full);
    if(codes.length<2)return null;
    const layout=doc.createElement('span');layout.className='fa-positions-layout';
    const value=doc.createElement('span');value.className='fa-positions-full';value.textContent=full;
    const primary=doc.createElement('span');primary.className='fa-positions-primary';primary.textContent=codes[0];
    const more=doc.createElement('button');more.type='button';more.className='fa-positions-more';
    more.textContent='+';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',popup.id);
    const lang=(doc.documentElement.lang||'en').toLowerCase().slice(0,2);
    more.setAttribute('aria-label',(positionLabels[lang]||positionLabels.en)+full);
    layout.append(value,primary,more);cell.replaceChildren(layout);
    cell.classList.add('fa-positions-cell');
    const state={full,value,codes};positionCells.set(cell,state);
    return state;
   };
   const updatePositions=region=>{
    const table=region.querySelector('table.app-players-table,table.admin-contracts-table');
    if(!table?.tBodies.length)return;
    const isMobile=mobile(),index=table.classList.contains('admin-contracts-table')?3:2;
    for(const row of table.tBodies[0].rows){
     const cell=row.cells[index];
     if(!cell)continue;
     const previous=positionCells.get(cell);
     if(!isMobile){
      if(previous){
       if(activeButton&&cell.contains(activeButton))closePopup();
       cell.textContent=previous.full;cell.classList.remove('fa-positions-cell');
       delete cell.dataset.faCompact;positionCells.delete(cell);
      }
      continue;
     }
     const state=previous||decoratePosition(cell);
     if(!state||!cell.offsetWidth)continue;
     // Expand the hidden full text before measuring, so an open '+' state
     // never oscillates or remains stale after view/viewport changes.
     const wasCompact=cell.dataset.faCompact==='true';
     if(wasCompact)cell.dataset.faCompact='false';
     const compact=positionsNeedCompact(state.value.scrollWidth,state.value.clientWidth,state.codes.length);
     if(compact!==wasCompact)cell.dataset.faCompact=String(compact);
     if(!compact&&activeButton&&cell.contains(activeButton))closePopup();
    }
   };
   const mobile=()=>!!win.matchMedia?.('(max-width:720px)').matches;
   const updateFade=region=>{
    const state=mobile()?scrollState(region.scrollWidth,region.clientWidth,region.scrollLeft):{left:false,right:false};
    region.dataset.canScrollLeft=String(state.left);
    region.dataset.canScrollRight=String(state.right);
    updatePositions(region);
   };
   const observer=typeof win.ResizeObserver==='function'
    ?new win.ResizeObserver(entries=>{for(const entry of entries)updateFade(entry.target)}):null;
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
 return {abbreviate,scrollState,positionsNeedCompact,positionCodes,mount};
});
