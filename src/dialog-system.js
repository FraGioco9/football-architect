/** QOL05.12 — One focus/scroll policy for every dialog, including career dialogs.
 * No persistence or gameplay side effects. Works with HTML replaced on every render.
 */
export const DIALOG_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function identity(node){
  if (!node) return null;
  if (node.id) return {id:node.id};
  if (!node.dataset?.action) return null;
  return {action:node.dataset.action,id:node.dataset.id,index:node.dataset.index,page:node.dataset.page,value:node.dataset.value};
}
function resolve(root,key){
  if (!key) return null;
  if (key.id) return [...root.querySelectorAll('[id]')].find(el=>el.id===key.id)||null;
  return [...root.querySelectorAll('[data-action]')].find(el=>['action','id','index','page','value'].every(prop=>key[prop]===undefined||el.dataset[prop]===key[prop]))||null;
}
function enabled(dialog){
  return [...dialog.querySelectorAll(DIALOG_FOCUSABLE)].filter(el=>!el.hidden&&!el.closest('[hidden],[inert]')&&el.getAttribute('aria-hidden')!=='true'&&el.getClientRects().length);
}
export function createDialogCoordinator(root,doc,close){
  let opener=null;
  let activeDialog=null;
  function noteOpener(element){
    if (!root.querySelector('.modal-layer [role="dialog"]')) opener=identity(element);
  }
  function beforeRender(){
    const dialog=root.querySelector('.modal-layer [role="dialog"]');
    const focus=dialog?.contains(doc.activeElement)?identity(doc.activeElement):null;
    return {hadDialog:!!dialog,focus,kind:activeDialog};
  }
  function afterRender(before){
    const layer=root.querySelector('.modal-layer');
    const dialog=layer?.querySelector('[role="dialog"]');
    // Render completely replaces the subtree, so inactive siblings must be marked again.
    doc.body.classList.toggle('dialog-open',!!dialog);
    if(!dialog){
      if(before.hadDialog){const target=resolve(root,opener);if(target&&!target.disabled&&target.isConnected)target.focus({preventScroll:true});}
      if(before.hadDialog&&!resolve(root,opener))root.querySelector('#main-content')?.focus({preventScroll:true});
      opener=null;activeDialog=null;return;
    }
    for(const sibling of layer.parentElement.children){
      if(sibling!==layer && !sibling.matches?.('[role="status"],[role="alert"]'))sibling.inert=true;
    }
    const kind=dialog.getAttribute('data-dialog-kind')||'generic';
    const remembered=before.hadDialog&&before.kind===kind?resolve(dialog,before.focus):null;
    const first=dialog.querySelector('[data-dialog-autofocus]')||dialog.querySelector('#career-name');
    const focusTarget=remembered||(!before.hadDialog?first:null)||dialog;
    focusTarget.focus({preventScroll:true});
    activeDialog=kind;
  }
  function keydown(event){
    const dialog=root.querySelector('.modal-layer [role="dialog"]');
    if(!dialog)return false;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();close();return true;
    }
    if(event.key!=='Tab')return false;
    const items=enabled(dialog);
    if(!items.length){event.preventDefault();dialog.focus();return true;}
    const first=items[0],last=items.at(-1),current=doc.activeElement;
    if(event.shiftKey&&(current===first||current===dialog||!dialog.contains(current))){event.preventDefault();last.focus();return true;}
    if(!event.shiftKey&&(current===last||current===dialog||!dialog.contains(current))){event.preventDefault();first.focus();return true;}
    return false;
  }
  return {noteOpener,beforeRender,afterRender,keydown};
}
