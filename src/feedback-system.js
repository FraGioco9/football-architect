// QOL05.13 — Feedback independent of the application render lifecycle.
// Keeps screen-reader announcements and dismiss buttons stable during navigation.
const LEVELS=new Set(['success','info','warning','error']);
export const FEEDBACK_MAX_VISIBLE=3;
export const FEEDBACK_DURATIONS=Object.freeze({success:3600,info:4400,warning:6500,error:0});

export function createFeedbackStore({schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),onChange=()=>{}}={}){
  let entries=[],sequence=0;
  const timers=new Map();
  const publish=()=>onChange(entries.map(({id,level,message})=>({id,level,message})));
  const dismiss=id=>{
    if(!entries.some(e=>e.id===id))return false;
    entries=entries.filter(e=>e.id!==id);
    if(timers.has(id)){cancel(timers.get(id));timers.delete(id);}
    publish();return true;
  };
  const notify=(message,{level='success',duration}={})=>{
    if(!LEVELS.has(level))throw new TypeError('Unknown feedback level');
    const value=String(message??'').trim();if(!value)return null;
    const existing=entries.find(e=>e.message===value&&e.level===level);
    if(existing)return existing.id; // prevent duplicate announcements from nested errors
    const id=++sequence;
    entries=[...entries,{id,level,message:value}];
    while(entries.length>FEEDBACK_MAX_VISIBLE)dismiss(entries[0].id);
    const delay=duration===undefined?FEEDBACK_DURATIONS[level]:Math.max(0,Number(duration)||0);
    if(delay>0)timers.set(id,schedule(()=>dismiss(id),delay));
    publish();return id;
  };
  return {notify,dismiss,items:()=>entries.map(e=>({...e})),clear:()=>{for(const item of [...entries])dismiss(item.id);}};
}

export function createFeedbackCenter(doc,{language=()=> 'it',schedule,cancel}={}){
  const stack=doc.createElement('section');
  stack.className='feedback-stack';
  stack.setAttribute('aria-label',language()==='en'?'Notifications':'Notifiche');
  doc.body.appendChild(stack);
  const store=createFeedbackStore({schedule,cancel,onChange:items=>{
    stack.setAttribute('aria-label',language()==='en'?'Notifications':'Notifiche');
    // Retain existing live regions to avoid replaying a message whenever a new one appears.
    for(const el of [...stack.children])if(!items.some(item=>String(item.id)===el.dataset.feedbackId))el.remove();
    for(const item of items){
      if([...stack.children].some(el=>el.dataset.feedbackId===String(item.id)))continue;
      const element=doc.createElement('div');element.className=`feedback-toast feedback-${item.level}`;
      element.dataset.feedbackId=String(item.id);
      element.setAttribute('role',item.level==='error'?'alert':'status');
      element.setAttribute('aria-live',item.level==='error'?'assertive':'polite');
      element.setAttribute('aria-atomic','true');
      const mark=doc.createElement('span');mark.className='feedback-mark';mark.setAttribute('aria-hidden','true');
      mark.textContent=({success:'✓',info:'i',warning:'!',error:'!'})[item.level];
      const content=doc.createElement('span');content.className='feedback-message';content.textContent=item.message;
      const close=doc.createElement('button');close.type='button';close.className='feedback-dismiss';
      close.textContent='×';close.setAttribute('aria-label',language()==='en'?'Dismiss notification':'Chiudi notifica');
      close.addEventListener('click',()=>store.dismiss(item.id));
      element.append(mark,content,close);stack.appendChild(element);
    }
  }});
  return {...store,updateLanguage:()=>{
    stack.setAttribute('aria-label',language()==='en'?'Notifications':'Notifiche');
    for(const button of stack.querySelectorAll('.feedback-dismiss'))button.setAttribute('aria-label',language()==='en'?'Dismiss notification':'Chiudi notifica');
  },destroy:()=>{store.clear();stack.remove();}};
}
