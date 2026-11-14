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
 // Preserve source order and never truncate an intermediate position code.
 // The fits callback measures the real CSS footprint of the text and +N.
 const visiblePositionPlan=(codes,fits)=>{
  for(let count=codes.length;count>=1;count--){
   const visible=codes.slice(0,count).join(', '),hidden=codes.length-count;
   if(fits(visible,hidden)||count===1)return {visible,hidden};
  }
  return {visible:'—',hidden:0};
 };
 const updatePositionCompact=(cell,state)=>{
  const paint=(visible,hidden)=>{
   const badge=hidden?'+'+hidden:'';
   if(state.value.textContent!==visible)state.value.textContent=visible;
   if(state.more.textContent!==badge)state.more.textContent=badge;
   const compact=String(hidden>0);
   if(cell.dataset.faCompact!==compact)cell.dataset.faCompact=compact;
   return state.value.clientWidth>0&&state.value.scrollWidth<=state.value.clientWidth+1;
  };
  const plan=visiblePositionPlan(state.codes,paint);
  paint(plan.visible,plan.hidden);
  return plan.hidden;
 };
 // Prefer above whenever the full tooltip fits there; below is a fallback.
 const tooltipPlacement=(rect,width,height,viewportWidth,viewportHeight)=>{
  const gap=7,edge=8,above=rect.top-height-gap,below=rect.bottom+gap;
  const fitsAbove=above>=edge,fitsBelow=below+height<=viewportHeight-edge;
  const top=fitsAbove?above:fitsBelow?below:
   rect.top-edge>=viewportHeight-rect.bottom-edge
    ?Math.max(edge,above)
    :Math.max(edge,Math.min(below,viewportHeight-height-edge));
  const triggerWidth=Number.isFinite(rect.width)?rect.width:Math.max(0,(rect.right||rect.left)-rect.left);
  const centeredLeft=rect.left+triggerWidth/2-width/2;
  const left=Math.max(edge,Math.min(centeredLeft,viewportWidth-width-edge));
  return {top:Math.round(top),left:Math.round(left),
   placement:fitsAbove?'above':fitsBelow?'below':top<=rect.top?'above':'below'};
 };
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
   popup.addEventListener('animationend',event=>{
    if(event.animationName==='app-world-tooltip-out'&&!activeButton){
     popup.hidden=true;popup.classList.remove('is-closing');
    }
   });
   const closePopup=(restoreFocus=false)=>{
    if(!activeButton)return;
    const previous=activeButton;activeButton=null;
    previous.setAttribute('aria-expanded','false');
    previous.removeAttribute('aria-describedby');
    if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
     popup.hidden=true;popup.classList.remove('is-closing');
    }else popup.classList.add('is-closing');
    if(restoreFocus&&previous.isConnected)previous.focus({preventScroll:true});
   };
   const showPopup=button=>{
    const cell=button.closest('.fa-positions-cell'),full=cell&&positionCells.get(cell)?.full;
    if(!full)return;
    closePopup();
    popup.classList.remove('is-closing');
    activeButton=button;button.setAttribute('aria-expanded','true');
    button.setAttribute('aria-describedby',popup.id);
    popup.textContent=full;popup.hidden=false;
    const rect=button.getBoundingClientRect(),height=popup.offsetHeight,width=popup.offsetWidth;
    const position=tooltipPlacement(rect,width,height,win.innerWidth,win.innerHeight);
    popup.style.top=position.top+'px';
    popup.style.left=position.left+'px';
    popup.dataset.placement=position.placement;
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
    const value=doc.createElement('span');value.className='fa-positions-visible';value.textContent=full;
    const more=doc.createElement('button');more.type='button';more.className='fa-positions-more';
    more.textContent='';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',popup.id);
    const lang=(doc.documentElement.lang||'en').toLowerCase().slice(0,2);
    more.setAttribute('aria-label',(positionLabels[lang]||positionLabels.en)+full);
    layout.append(value,more);cell.replaceChildren(layout);
    cell.classList.add('fa-positions-cell');
    const state={full,value,more,codes};positionCells.set(cell,state);
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
     // Measure each complete candidate against the remaining space for +N.
     // Keep the current disclosure open only while some positions are hidden.
     const hidden=updatePositionCompact(cell,state);
     if(!hidden&&activeButton&&cell.contains(activeButton))closePopup();
    }
   };
   const mobile=()=>!!win.matchMedia?.('(max-width:720px)').matches;
   const updateFade=(region,measurePositions=true)=>{
    // Keep the first-paint CSS right fade while a table is still unmeasurable.
    if(mobile()&&!region.clientWidth)return;
    const state=mobile()?scrollState(region.scrollWidth,region.clientWidth,region.scrollLeft):{left:false,right:false};
    region.dataset.canScrollLeft=String(state.left);
    region.dataset.canScrollRight=String(state.right);
    if(measurePositions)updatePositions(region);
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
      // Horizontal scrolling changes fade edges, not column widths.
      const listener=()=>updateFade(region,false);
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
   win.addEventListener('resize',()=>{closePopup();schedule()},{passive:true});
   if(typeof win.MutationObserver==='function')new win.MutationObserver(changes=>{
    for(const mutation of changes){
     if(!mutation.addedNodes.length)continue;
     // Measuring candidates updates text inside our own layout. Never
     // schedule another frame for those internal, non-data changes.
     if(mutation.target.closest?.('.fa-positions-layout'))continue;
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
 return {abbreviate,scrollState,positionsNeedCompact,positionCodes,visiblePositionPlan,tooltipPlacement,updatePositionCompact,mount};
});
