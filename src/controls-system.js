/** UX2-09. One tooltip portal for focus/pointer help, independent of careers.
 * Uses existing native select/menu controls; never intercepts game actions.
 */
const TRIGGER='[data-fa-tooltip],button[title],a[href][title],input[title],select[title],.form-dot[title]';
const OFFSET=9;
export function createControlHints(root,doc=globalThis.document){
  let active=null;
  let openSelect=null;
  let selectSerial=0;
  const selectMenus=new Set();
  const tip=doc.createElement('div');
  tip.className='fa-control-tooltip';tip.id='fa-control-hint';
  tip.setAttribute('role','tooltip');tip.hidden=true;
  doc.body.append(tip);
  function decorate(){
    for(const menu of root.querySelectorAll('details.ds-dropdown,details.ds-popover')){
      menu.querySelector('summary')?.setAttribute('aria-expanded',String(menu.open));
    }
    for(const el of root.querySelectorAll(TRIGGER)){
      const title=el.getAttribute('data-fa-tooltip')||el.getAttribute('title');
      if(!title?.trim())continue;
      el.setAttribute('data-fa-tooltip',title.trim());
      if(el.hasAttribute('title'))el.removeAttribute('title'); // no duplicated native bubble
      if(el.matches('.form-dot')){
        if(!el.hasAttribute('tabindex'))el.tabIndex=0;
        if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',title.trim());
      }
      if(!el.hasAttribute('aria-describedby'))el.setAttribute('aria-describedby',tip.id);
    }
  }

  function associatedLabel(select){
    const direct=select.getAttribute('aria-label')?.trim();
    if(direct)return direct;
    const labelledBy=select.getAttribute('aria-labelledby');
    if(labelledBy){
      const text=labelledBy.split(/\s+/).map(id=>doc.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      if(text)return text;
    }
    const label=select.labels?.[0];
    if(label){
      const clone=label.cloneNode(true);
      clone.querySelectorAll('select,button,input,textarea').forEach(el=>el.remove());
      const text=clone.textContent?.replace(/\s+/g,' ').trim();
      if(text)return text;
    }
    return select.name||select.id||'Select';
  }
  function syncCustomSelect(entry){
    const option=entry.select.options[entry.select.selectedIndex]||entry.select.options[0];
    entry.value.textContent=option?.textContent?.trim()||'';
    entry.trigger.setAttribute('aria-disabled',String(Boolean(entry.select.disabled)));
    entry.trigger.tabIndex=entry.select.disabled?-1:0;
    entry.items.forEach(item=>item.node.setAttribute('aria-selected',String(item.index===entry.select.selectedIndex)));
  }
  function positionCustomSelect(entry){
    if(!entry||entry.menu.hidden||!entry.trigger.isConnected)return;
    const r=entry.trigger.getBoundingClientRect();
    const vw=doc.documentElement.clientWidth,vh=doc.documentElement.clientHeight;
    entry.menu.style.minWidth=`${Math.max(120,Math.round(r.width))}px`;
    entry.menu.style.maxWidth=`${Math.max(120,Math.min(380,vw-16))}px`;
    entry.menu.style.visibility='hidden';
    entry.menu.style.left='8px';entry.menu.style.top='8px';
    const width=Math.min(Math.max(r.width,entry.menu.scrollWidth),Math.max(120,vw-16));
    entry.menu.style.width=`${Math.round(width)}px`;
    const height=Math.min(entry.menu.scrollHeight,Math.max(120,Math.min(vh*.52,420)));
    const below=r.bottom+6+height<=vh-8;
    const top=below?r.bottom+6:Math.max(8,r.top-height-6);
    const left=Math.max(8,Math.min(vw-8-width,r.left));
    entry.menu.style.left=`${Math.round(left)}px`;
    entry.menu.style.top=`${Math.round(top)}px`;
    entry.menu.style.visibility='visible';
  }
  function closeCustomSelect(restoreFocus=false){
    if(!openSelect)return;
    const entry=openSelect;openSelect=null;
    entry.menu.hidden=true;entry.trigger.setAttribute('aria-expanded','false');
    if(restoreFocus&&entry.trigger.isConnected)entry.trigger.focus();
  }
  function focusCustomOption(entry,index){
    const enabled=entry.items.filter(item=>item.node.getAttribute('aria-disabled')!=='true');
    if(!enabled.length)return;
    const exact=entry.items.find(item=>item.index===index&&item.node.getAttribute('aria-disabled')!=='true');
    (exact?.node||enabled[0].node).focus();
  }
  function openCustomSelect(entry,direction=0){
    if(entry.select.disabled)return;
    if(openSelect&&openSelect!==entry)closeCustomSelect(false);
    openSelect=entry;entry.menu.hidden=false;entry.trigger.setAttribute('aria-expanded','true');
    syncCustomSelect(entry);positionCustomSelect(entry);
    if(direction){
      const enabled=entry.items.filter(item=>item.node.getAttribute('aria-disabled')!=='true');
      if(!enabled.length)return;
      const current=enabled.findIndex(item=>item.index===entry.select.selectedIndex);
      const base=current<0?0:current;
      const target=enabled[(base+(direction>0?1:-1)+enabled.length)%enabled.length];
      target.node.focus();
    }else focusCustomOption(entry,entry.select.selectedIndex);
  }
  function chooseCustomOption(entry,index){
    const option=entry.select.options[index];
    if(!option||option.disabled)return;
    entry.select.selectedIndex=index;syncCustomSelect(entry);closeCustomSelect(false);
    entry.select.dispatchEvent(new Event('change',{bubbles:true}));
    if(entry.trigger.isConnected)entry.trigger.focus();
  }
  function buildCustomMenu(select){
    if(select.multiple||Number(select.size)>1||select.dataset.faNativeSelect==='true')return;
    const parent=select.parentElement;if(!parent)return;
    const before=select.getBoundingClientRect();
    const parentRect=parent.getBoundingClientRect();
    const wrapper=doc.createElement('span');wrapper.className='fa-custom-select';
    if(parentRect.width>0&&Math.abs(before.width-parentRect.width)<=2)wrapper.classList.add('fa-custom-select-block');
    else if(before.width>0)wrapper.style.width=`${Math.ceil(before.width)}px`;
    select.before(wrapper);wrapper.append(select);
    select.classList.add('fa-select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');

    const id=`fa-select-${++selectSerial}`;
    const trigger=doc.createElement('span');trigger.className='fa-select-trigger';trigger.id=`${id}-trigger`;
    trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`${id}-menu`);
    trigger.setAttribute('aria-label',associatedLabel(select));trigger.tabIndex=select.disabled?-1:0;
    const value=doc.createElement('span');value.className='fa-select-value';trigger.append(value);wrapper.append(trigger);

    const menu=doc.createElement('div');menu.className='fa-select-menu';menu.id=`${id}-menu`;menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby',trigger.id);menu.hidden=true;
    const items=[];
    let index=0;
    for(const child of select.children){
      if(child.tagName==='OPTGROUP'){
        const group=doc.createElement('div');group.className='fa-select-group-label';group.textContent=child.label||'';menu.append(group);
        for(const option of child.children){
          const node=doc.createElement('div');node.className='fa-select-option';node.setAttribute('role','option');node.tabIndex=-1;node.textContent=option.textContent?.trim()||'';
          node.dataset.index=String(index);if(option.disabled||child.disabled)node.setAttribute('aria-disabled','true');menu.append(node);items.push({node,index});index++;
        }
      }else if(child.tagName==='OPTION'){
        const node=doc.createElement('div');node.className='fa-select-option';node.setAttribute('role','option');node.tabIndex=-1;node.textContent=child.textContent?.trim()||'';
        node.dataset.index=String(index);if(child.disabled)node.setAttribute('aria-disabled','true');menu.append(node);items.push({node,index});index++;
      }
    }
    doc.body.append(menu);selectMenus.add(menu);
    const entry={select,wrapper,trigger,value,menu,items};
    syncCustomSelect(entry);

    trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(openSelect===entry)closeCustomSelect(false);else openCustomSelect(entry,0);});
    trigger.addEventListener('keydown',event=>{
      if(entry.select.disabled)return;
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openCustomSelect(entry,event.key==='ArrowDown'?1:-1);return;}
      if(['Enter',' '].includes(event.key)){event.preventDefault();if(openSelect===entry)closeCustomSelect(false);else openCustomSelect(entry,0);return;}
      if(event.key==='Escape'&&openSelect===entry){event.preventDefault();closeCustomSelect(true);}
    });
    menu.addEventListener('click',event=>{const node=event.target.closest?.('.fa-select-option');if(!node||node.getAttribute('aria-disabled')==='true')return;chooseCustomOption(entry,Number(node.dataset.index));});
    menu.addEventListener('keydown',event=>{
      const current=event.target.closest?.('.fa-select-option');if(!current)return;
      const enabled=items.filter(item=>item.node.getAttribute('aria-disabled')!=='true');if(!enabled.length)return;
      const currentIndex=enabled.findIndex(item=>item.node===current);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();let next=0;
        if(event.key==='Home')next=0;else if(event.key==='End')next=enabled.length-1;else next=(currentIndex+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length;
        enabled[next].node.focus();return;
      }
      if(['Enter',' '].includes(event.key)){event.preventDefault();chooseCustomOption(entry,Number(current.dataset.index));return;}
      if(event.key==='Escape'){event.preventDefault();closeCustomSelect(true);return;}
      if(event.key==='Tab')closeCustomSelect(false);
    });
    select.addEventListener('change',()=>syncCustomSelect(entry));
    select.addEventListener('focus',()=>{if(trigger.isConnected)trigger.focus();});
  }
  function enhanceCustomSelects(){
    closeCustomSelect(false);
    for(const menu of selectMenus)menu.remove();selectMenus.clear();
    for(const select of root.querySelectorAll('select')){
      if(select.closest('.fa-custom-select'))continue;
      buildCustomMenu(select);
    }
  }
  function decorateOverflowButtons(){
    for(const el of root.querySelectorAll('.btn,.qol03-shortcut,.qol03-back')){
      const label=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!label||el.hasAttribute('data-fa-tooltip'))continue;
      if(el.scrollWidth>el.clientWidth+1){el.setAttribute('data-fa-tooltip',label);el.setAttribute('aria-describedby',tip.id);}
    }
  }
  function hide(){tip.hidden=true;tip.textContent='';active=null;}
  function position(){
    if(!active||!active.isConnected){hide();return;}
    const bounds=active.getBoundingClientRect();
    const vw=doc.documentElement.clientWidth,vh=doc.documentElement.clientHeight;
    const maxWidth=Math.max(160,Math.min(300,vw-20));
    tip.style.maxWidth=`${maxWidth}px`;
    const w=tip.offsetWidth,h=tip.offsetHeight;
    const left=Math.max(10,Math.min(vw-10-w,bounds.left+(bounds.width-w)/2));
    const below=bounds.bottom+OFFSET+h<=vh-10;
    const top=below?bounds.bottom+OFFSET:Math.max(10,bounds.top-h-OFFSET);
    tip.style.left=`${left}px`;tip.style.top=`${top}px`;
  }
  function show(el){
    const label=el?.getAttribute('data-fa-tooltip');
    if(!label||!el.isConnected)return;
    active=el;tip.textContent=label;tip.hidden=false;position();
  }
  function trigger(target){return target?.closest?.('[data-fa-tooltip]')||null;}
  function pointerover(event){if(event.pointerType==='touch')return;const el=trigger(event.target);if(el!==active){if(el)show(el);else hide();}}
  function pointerout(event){if(event.pointerType==='touch'||!active)return;const next=event.relatedTarget;if(!next||!active.contains(next))hide();}
  function focusin(event){const el=trigger(event.target);if(el)show(el);else hide();}
  function focusout(event){if(active&&!active.contains(event.relatedTarget))hide();}
  function pointerdown(event){
    if(event.pointerType!=='touch')return;
    const el=trigger(event.target);
    // A non-action status dot has no click handler; tapping gives touch users
    // access to its hint without swallowing an actual gameplay action.
    if(el?.matches('.form-dot')){
      if(active===el&&!tip.hidden)hide();else show(el);
    }else hide();
  }
  function outsidePointer(event){
    if(!openSelect)return;
    if(openSelect.trigger.contains(event.target)||openSelect.menu.contains(event.target))return;
    closeCustomSelect(false);
  }
  function keydown(event){
    if(event.key==='Escape'){
      hide();
      const menu=event.target.closest?.('details.ds-dropdown[open],details.ds-popover[open]');
      if(menu){menu.open=false;menu.querySelector('summary')?.focus();event.preventDefault();}
      return;
    }
    const menu=event.target.closest?.('details.ds-dropdown[open],details.ds-popover[open]');
    if(!menu||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const choices=[...menu.querySelectorAll('[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]')].filter(el=>!el.hasAttribute('disabled')&&el.getAttribute('aria-disabled')!=='true');
    if(!choices.length)return;
    const index=choices.indexOf(doc.activeElement),direction=event.key==='ArrowUp'?-1:1;
    const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+direction+choices.length)%choices.length;
    choices[next].focus();event.preventDefault();
  }
  function toggle(event){
    const menu=event.target;
    if(menu.matches?.('details.ds-dropdown,details.ds-popover')){
      const summary=menu.querySelector('summary');
      if(summary)summary.setAttribute('aria-expanded',String(menu.open));
    }
  }
  function scroll(){if(active)position();if(openSelect)positionCustomSelect(openSelect);}
  // Event listeners stay stable across render() / innerHTML replacement.
  root.addEventListener('pointerover',pointerover);
  root.addEventListener('pointerout',pointerout);
  root.addEventListener('pointerdown',pointerdown);
  root.addEventListener('toggle',toggle,true);
  root.addEventListener('focusin',focusin);
  root.addEventListener('focusout',focusout);
  root.addEventListener('keydown',keydown);
  doc.addEventListener('scroll',scroll,true);
  doc.addEventListener('pointerdown',outsidePointer,true);
  doc.defaultView?.addEventListener('resize',scroll);
  return {
    enhance(){hide();enhanceCustomSelects();decorate();decorateOverflowButtons();},
    hide,
    destroy(){hide();closeCustomSelect(false);for(const menu of selectMenus)menu.remove();selectMenus.clear();root.removeEventListener('pointerover',pointerover);root.removeEventListener('pointerout',pointerout);root.removeEventListener('pointerdown',pointerdown);root.removeEventListener('toggle',toggle,true);root.removeEventListener('focusin',focusin);root.removeEventListener('focusout',focusout);root.removeEventListener('keydown',keydown);doc.removeEventListener('pointerdown',outsidePointer,true);doc.removeEventListener('scroll',scroll,true);doc.defaultView?.removeEventListener('resize',scroll);tip.remove();}
  };
}
