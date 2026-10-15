// Reusable local-only Debug Settings. Loaded only by the loopback DEV server.
const POSITION_KEY = "football-architect:dev-debug-widget-position";
const SECTIONS_KEY = "football-architect:dev-debug-sections";
const REGISTRY = new Map();
export function registerDebugControls(namespace, controls) {
 if(typeof namespace!=="string"||!namespace||!Array.isArray(controls))throw Error("Invalid DEV registry");
 if(controls.some(c=>!c?.id||!c?.type||typeof c.onChange!=="function"))throw Error("Invalid DEV controls");
 REGISTRY.set(namespace, controls);
 return () => REGISTRY.delete(namespace);
}
export function getDebugControls(namespace) { return [...(REGISTRY.get(namespace)||[])]; }
const EDGE = 8, SIZE = 48;
const clamp = (value,min,max) => Math.max(min,Math.min(value,max));
function element(tag,className,text) {
 const node = document.createElement(tag);
 node.className = className;
 if(text)node.textContent = text;
 return node;
}
export function createDebugWidget({controls=[],page="standings"}={}) {
 controls=[...getDebugControls("general"),...getDebugControls(page),...controls];
 if(!Array.isArray(controls)||!controls.length)return null;
 const style=element("style");
 style.textContent=[
  ".fa-dev-widget{position:fixed;width:48px;height:48px;z-index:2147483000}",
  ".fa-dev-widget *{box-sizing:border-box}",
  ".fa-dev-widget-button{width:48px;height:48px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid #498a7c;border-radius:50%;",
  "background:#184d46;color:#fff;font-size:23px;cursor:pointer;touch-action:none;user-select:none;",
  "box-shadow:0 5px 20px #0005}",
  ".fa-dev-widget-button:hover{background:#21665b;border-color:#8ee5c5}",
  'html[data-theme="light"] .fa-dev-widget-button{background:#e5f4ee;color:#174a40;border-color:#398674}',
  'html[data-theme="light"] .fa-dev-widget-button:hover{background:#cce9de;border-color:#256d5b}',
  'html[data-theme="light"] .fa-dev-widget-panel{background:#fff;color:#18332d;border-color:#9cbdb3}',
  ".fa-dev-widget-button:active{cursor:grabbing}",
  ".fa-dev-widget-button:focus-visible,.fa-dev-widget-panel input:focus-visible{outline:2px solid #8ee5c5;outline-offset:3px}",
  ".fa-dev-widget-panel{position:absolute;width:240px;padding:13px;border:1px solid #568378;",
  "border-radius:12px;background:#17302f;color:#f3f8f5;box-shadow:0 8px 32px #0008;",
  "font:14px/1.4 system-ui,sans-serif;max-height:65vh;overflow:auto}",
  ".fa-dev-widget-title{font-weight:700;margin:0 0 12px}",
  ".fa-dev-widget-option{display:flex;align-items:center;justify-content:space-between;gap:12px}",
  " .fa-dev-widget-option input{accent-color:#47b58d;width:20px;height:20px;flex-shrink:0;cursor:pointer}",
  " .fa-dev-widget-option input[type=range]{width:112px;height:20px}",
  " .fa-dev-widget-option output{min-width:2ch;text-align:right;font-variant-numeric:tabular-nums}",
  ".fa-dev-widget-option{cursor:pointer}",
  ".fa-dev-widget-option select,.fa-dev-widget-reset{cursor:pointer;background:#244c45;color:inherit;border:1px solid #568378;border-radius:6px;padding:5px}",
  "html[data-theme=\"light\"] .fa-dev-widget-option select,html[data-theme=\"light\"] .fa-dev-widget-reset{background:#e5f4ee;color:#174a40}",
  ".fa-dev-widget-reset{width:100%;margin-top:12px}",
  ".fa-dev-widget-section{margin:8px 0;border-top:1px solid #568378;padding-top:8px}",
  ".fa-dev-widget-section summary{cursor:pointer;font-weight:600;padding:5px 0}",
  ".fa-dev-widget-close{display:none;cursor:pointer}",
  ".fa-dev-widget-backdrop{display:none}",
  ".fa-dev-widget-panel[hidden]{display:none!important}",
  "@media(max-width:600px){.fa-dev-widget-panel{position:fixed!important;left:0!important;top:auto!important;bottom:0;width:100vw;max-height:85dvh;overflow:auto;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}.fa-dev-widget-close{display:block;float:right;border:0;background:transparent;color:inherit;font-size:24px}.fa-dev-widget-backdrop:not([hidden]){display:block;position:fixed;inset:0;background:#0007;z-index:1}.fa-dev-widget-panel{z-index:2}.fa-dev-widget-button{position:relative;z-index:2}.fa-dev-widget:has(.fa-dev-widget-panel:not([hidden])){z-index:2147483000}}",

  ".fa-dev-widget-panel{width:260px;padding:14px;border-color:var(--border,#568378);border-radius:14px;background:var(--surface,#17302f);color:var(--text,#f3f8f5);box-shadow:0 12px 36px #0005;font:inherit;font-size:13px;line-height:1.45;max-height:65vh;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--scroll-thumb,#63877c) transparent;transition:opacity .18s ease,transform .18s ease}",
  ".fa-dev-widget-panel:not([hidden]){animation:fa-dev-panel-in .18s ease both}",
  "@keyframes fa-dev-panel-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}",
  "@keyframes fa-dev-panel-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(6px) scale(.99)}}",
  ".fa-dev-widget-panel.is-closing{animation:fa-dev-panel-out .14s ease both}",
  ".fa-dev-widget-backdrop{opacity:0;transition:opacity .18s ease}",
  ".fa-dev-widget-backdrop:not([hidden]){opacity:1}",
  ".fa-dev-widget-panel::-webkit-scrollbar{width:8px}.fa-dev-widget-panel::-webkit-scrollbar-track{background:transparent}.fa-dev-widget-panel::-webkit-scrollbar-thumb{background:var(--scroll-thumb,#63877c);border:2px solid transparent;background-clip:padding-box;border-radius:10px}",
  ".fa-dev-widget-option input{accent-color:var(--primary,#47b58d);flex-shrink:0;cursor:pointer}",
  ".fa-dev-widget-option input[type=checkbox]{width:20px;height:20px}",
  ".fa-dev-widget-option input[type=range]{width:100%;min-width:70px;max-width:130px;height:24px;accent-color:var(--primary,#47b58d);cursor:pointer}",
  ".fa-dev-widget-option input[type=number]{width:66px;min-width:58px;max-width:30%;padding:7px 5px;border:1px solid var(--border,#568378);border-radius:8px;background:var(--surface-raised,#244c45);color:var(--text,#f3f8f5);font:inherit;font-variant-numeric:tabular-nums;text-align:center}",
  ".fa-dev-widget-option select,.fa-dev-widget-reset{cursor:pointer;background:var(--surface-raised,#244c45);color:inherit;border:1px solid var(--border,#568378);border-radius:8px;padding:8px 10px;font:inherit;transition:background .16s ease,border-color .16s ease,transform .16s ease}",
  ".fa-dev-widget-option select{max-width:55%;min-width:0}",
  ".fa-dev-widget-option select:focus-visible,.fa-dev-widget-option input:focus-visible,.fa-dev-widget-reset:focus-visible{outline:2px solid var(--focus,#8ee5c5);outline-offset:2px}",
  ".fa-dev-widget-option select:hover,.fa-dev-widget-reset:hover{border-color:var(--primary,#47b58d)}",
  ".fa-dev-widget-option input:disabled,.fa-dev-widget-reset:disabled{opacity:.6;cursor:wait}",
  ".fa-dev-widget-option input[type=number]::-webkit-inner-spin-button,.fa-dev-widget-option input[type=number]::-webkit-outer-spin-button{opacity:1;cursor:pointer}",
  "html[data-theme=\"light\"] .fa-dev-widget-option input[type=number]{background:var(--surface,#fff);color:var(--text,#18332d)}",
  ".fa-dev-widget-panel{box-sizing:border-box;width:min(320px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);overflow-x:hidden;overflow-y:auto}",
  ".fa-dev-widget-option{box-sizing:border-box;min-width:0;gap:8px}",
  ".fa-dev-widget-option>span{flex:0 1 42%;min-width:0;overflow-wrap:anywhere}",
  ".fa-dev-widget-option input[type=range]{box-sizing:border-box;flex:1 1 72px;width:72px;min-width:54px;max-width:none}",
  ".fa-dev-widget-option input[type=number]{box-sizing:border-box;flex:0 0 68px;width:68px;min-width:68px;max-width:68px;padding:6px 4px;color-scheme:dark}",
  'html[data-theme="light"] .fa-dev-widget-option input[type=number]{color-scheme:light}',
  ".fa-dev-widget-option input[type=number]{appearance:textfield;-moz-appearance:textfield;padding-right:4px}",
  ".fa-dev-widget-option input[type=number]::-webkit-inner-spin-button,.fa-dev-widget-option input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;appearance:none;margin:0}",
  ".fa-dev-number-wrap{position:relative;display:flex;flex:0 0 72px;width:72px;height:34px;min-width:72px;align-items:stretch}",
  ".fa-dev-number-wrap input[type=number]{width:100%;min-width:0;max-width:none;height:34px;padding:4px 21px 4px 4px;text-align:center}",
  ".fa-dev-number-spin{position:absolute;right:3px;top:3px;bottom:3px;width:16px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:1px;border-left:1px solid var(--border,#568378);padding-left:2px}",
  ".fa-dev-number-arrow{display:flex;align-items:center;justify-content:center;flex:1;min-height:0;width:13px;padding:0;border:0;border-radius:3px;background:transparent;color:var(--text,#f3f8f5);cursor:pointer;touch-action:manipulation;outline:none;user-select:none}",
  ".fa-dev-number-arrow svg{display:block;width:9px;height:6px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}",
  ".fa-dev-number-arrow:hover{background:var(--surface-hover,#315d53);color:var(--primary,#47b58d)}",
  ".fa-dev-number-arrow:active{background:var(--surface-raised,#244c45)}",
  ".fa-dev-number-arrow:focus-visible{outline:1px solid var(--focus,#8ee5c5);outline-offset:-1px}",
  ".fa-dev-widget-option,.fa-dev-widget-option>span{user-select:none;-webkit-user-select:none}",
  ".fa-dev-widget-button.dismiss-focus:focus{outline:none}",
  ".fa-dev-widget-panel{z-index:2147482998}",
  ".fa-dev-widget{z-index:2147482998}",
  "@media(max-width:600px){.fa-dev-widget-panel{width:calc(100vw - 24px);max-width:calc(100vw - 24px);padding-inline:16px}.fa-dev-widget-option>span{flex-basis:40%}.fa-dev-widget-option input[type=range]{min-width:48px}.fa-dev-widget-option input[type=number]{flex-basis:64px;width:64px;min-width:64px;max-width:64px}}",
  "@media(prefers-reduced-motion:reduce){.fa-dev-widget-panel{animation:none!important;transition:none!important}}"
 ].join("");
 const root=element("div","fa-dev-widget");
 const button=element("button","fa-dev-widget-button");
 button.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="19" r="2" fill="currentColor" stroke="none"/></svg>';
 button.type="button";
 button.setAttribute("aria-label","Debug Settings");
 button.setAttribute("aria-expanded","false");
 const panel=element("section","fa-dev-widget-panel");
 panel.id="fa-dev-widget-panel";
 panel.setAttribute("aria-label","Debug Settings");
 panel.hidden=true;
 button.setAttribute("aria-controls",panel.id);
 panel.append(element("h2","fa-dev-widget-title","Debug Settings"));
 const closeButton=element("button","fa-dev-widget-close","×");closeButton.type="button";closeButton.setAttribute("aria-label","Close Debug Settings");panel.prepend(closeButton);
 const sections=new Map();
 for(const [id,label] of [["general","General"],["page","Current page"]]){
  const details=element("details","fa-dev-widget-section");details.dataset.section=id;
  details.append(element("summary","",label));details.open=true;
  try{const saved=JSON.parse(sessionStorage.getItem(SECTIONS_KEY)||"{}");if(typeof saved[id]==="boolean")details.open=saved[id]}catch{}
  details.addEventListener("toggle",()=>{try{const saved=JSON.parse(sessionStorage.getItem(SECTIONS_KEY)||"{}");saved[id]=details.open;sessionStorage.setItem(SECTIONS_KEY,JSON.stringify(saved))}catch{}});
  sections.set(id,details);
 }
 for(const control of controls){
  const target=sections.get(control.scope==="general"?"general":"page");
  if(!["switch","select","range","number","button"].includes(control.type)||!control.id||!control.label||
     typeof control.onChange!=="function")throw Error("Invalid DEV control");
  if(control.type==="button"){
   const action=element("button","fa-dev-widget-reset",control.label);
   action.type="button";action.dataset.devControl=control.id;
   action.addEventListener("click",async()=>{
    action.disabled=true;
    try{await control.onChange();}catch(error){console.error("DEV Debug reset failed:",error)}
    finally{action.disabled=false}
   });
   target.append(action);continue;
  }
  if(control.type==="range"){
   const row=element("label","fa-dev-widget-option");
   row.dataset.devControlRow=control.id;
   row.hidden=typeof control.visible==="function"?!control.visible():control.visible===false;
   row.append(element("span","",control.label));
   const input=element("input");input.type="range";input.min=String(control.min??0);input.max=String(control.max??100);input.step=String(control.step??1);
   input.value=String(typeof control.value==="function"?control.value():control.value??input.min);input.dataset.devControl=control.id;input.dataset.previous=input.value;
   const numberWrap=element("div","fa-dev-number-wrap");
   const number=element("input");number.type="number";number.min=input.min;number.max=input.max;number.step=input.step;
   number.inputMode="numeric";number.value=input.value;number.dataset.devControl="matchdays-number";number.dataset.previous=number.value;
   number.id="fa-dev-matchdays-number";number.setAttribute("aria-label",control.label+" value");
   numberWrap.append(number);
   const spin=element("span","fa-dev-number-spin");
   for(const [direction,label] of [[1,"Increase matchdays"],[-1,"Decrease matchdays"]]){
    const arrow=element("button","fa-dev-number-arrow");arrow.type="button";arrow.dataset.step=String(direction);arrow.setAttribute("aria-label",label);
    arrow.innerHTML=direction===1?'<svg viewBox="0 0 12 8" aria-hidden="true"><path d="m2 6 4-4 4 4"/></svg>':'<svg viewBox="0 0 12 8" aria-hidden="true"><path d="m2 2 4 4 4-4"/></svg>';
    arrow.addEventListener("pointerdown",event=>{event.preventDefault();event.stopPropagation()});
    arrow.addEventListener("click",event=>{
     event.preventDefault();event.stopPropagation();
     const next=Math.max(Number(number.min),Math.min(Number(number.max),Number(number.value||0)+direction*Number(number.step||1)));
     number.value=String(next);number.dispatchEvent(new Event("change",{bubbles:true}));
    });
    spin.append(arrow);
   }
   numberWrap.append(spin);
   number.addEventListener("pointerdown",event=>event.stopPropagation());
   input.addEventListener("input",()=>{number.value=input.value});
   input.addEventListener("change",async()=>{
    const previous=input.dataset.previous;input.disabled=true;number.disabled=true;
    try{if(await control.onChange(Number(input.value))===false)input.value=previous;else input.dataset.previous=input.value}
    catch(error){input.value=previous;console.error("DEV Debug range change failed:",error)}
    finally{number.value=input.value;number.dataset.previous=input.value;number.disabled=false;input.disabled=false}
   });
   number.addEventListener("change",async()=>{
    const previous=number.dataset.previous,value=number.valueAsNumber;
    if(!Number.isInteger(value)||value<Number(number.min)||value>Number(number.max)){number.value=previous;return}
    input.disabled=true;number.disabled=true;
    try{if(await control.onChange(value)===false)number.value=previous;else number.dataset.previous=number.value}
    catch(error){number.value=previous;console.error("DEV Debug number change failed:",error)}
    finally{input.value=number.value;input.dataset.previous=number.value;number.disabled=false;input.disabled=false}
   });
   row.append(input,numberWrap);target.append(row);continue;
  }
  if(control.type==="number"){
   const row=element("label","fa-dev-widget-option");
   row.dataset.devControlRow=control.id;
   row.hidden=typeof control.visible==="function"?!control.visible():control.visible===false;
   row.append(element("span","",control.label));
   const input=element("input");input.type="number";input.min=String(control.min??0);input.max=String(control.max??100);input.step=String(control.step??1);
   input.inputMode="numeric";
   input.value=String(typeof control.value==="function"?control.value():control.value??input.min);
   input.dataset.devControl=control.id;input.dataset.previous=input.value;
   input.style.width="76px";input.style.maxWidth="40%";
   input.addEventListener("change",async()=>{
    const previous=input.dataset.previous;
    const value=input.valueAsNumber;
    if(!Number.isInteger(value)||value<Number(input.min)||value>Number(input.max)){
     input.value=previous;return;
    }
    input.disabled=true;
    try{
     if(await control.onChange(value)===false)input.value=previous;
     else input.dataset.previous=input.value;
    }catch(error){input.value=previous;console.error("DEV Debug number change failed:",error)}
    finally{input.disabled=false}
   });
   row.append(input);target.append(row);continue;
  }
  if(control.type==="select"){
   const row=element("label","fa-dev-widget-option");
   row.append(element("span","",control.label));
   const select=element("select");select.dataset.devControl=control.id;
   for(const option of control.options||[]){
    const item=element("option","",String(option));item.value=String(option);select.append(item);
   }
   select.value=String(typeof control.value==="function"?control.value():control.value);
   select.dataset.previous=select.value;
   select.addEventListener("change",async()=>{
    const previous=select.dataset.previous;
    select.disabled=true;
    try{if(await control.onChange(Number(select.value))===false)select.value=previous;
     else select.dataset.previous=select.value;}
    catch(error){select.value=previous;console.error("DEV Debug matchday change failed:",error)}
    finally{select.disabled=false}
   });
   row.append(select);target.append(row);continue;
  }
  const row=element("label","fa-dev-widget-option");
  row.dataset.devControlRow=control.id;
  row.hidden=typeof control.visible==="function"?!control.visible():control.visible===false;
  row.append(element("span","",control.label));
  const input=element("input");
  input.type="checkbox";
  input.setAttribute("role","switch");
  input.dataset.devControl=control.id;
  input.checked=typeof control.checked==="function"?
   !!control.checked():!!control.checked;
  input.addEventListener("change",async()=>{
   const desired=input.checked;
   input.disabled=true;
   try { if(await control.onChange(desired)===false)input.checked=!desired; }
   catch(error){input.checked=!desired;console.error("DEV Debug transition failed:",error)}
   finally {input.disabled=false;syncVisibility()}
  });
  row.append(input);
  target.append(row);
 }
 root.syncVisibility=()=>{for(const control of controls){const row=panel.querySelector(`[data-dev-control-row="${control.id}"]`);if(row)row.hidden=typeof control.visible==="function"?!control.visible():control.visible===false}};
 function syncVisibility(){root.syncVisibility()}
 for(const details of sections.values())if(details.children.length>1)panel.append(details);
 const backdrop=element("div","fa-dev-widget-backdrop");backdrop.hidden=true;
 root.append(backdrop,button,panel);
 document.head.append(style);
 document.body.append(root);
 let x=innerWidth-SIZE-16,y=innerHeight-SIZE-16;
 try{
  const saved=JSON.parse(sessionStorage.getItem(POSITION_KEY));
  if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y)){
   x=saved.x;y=saved.y;
  }
 }catch{ /* Session storage can be unavailable. */ }
 function placePanel(){
  if(panel.hidden)return;
  if(matchMedia("(max-width:600px)").matches){panel.style.left="0";panel.style.right="0";panel.style.top="auto";panel.style.bottom="0";return}
  panel.style.right="auto";panel.style.bottom="auto";
  panel.style.maxHeight=Math.max(160,innerHeight-EDGE*2)+"px";
  const rect=root.getBoundingClientRect();
  const panelRect=panel.getBoundingClientRect();
  const viewportRight=document.documentElement.clientWidth||innerWidth;
  const panelWidth=panelRect.width||320,panelHeight=panelRect.height;
  const left=clamp(rect.left,EDGE,Math.max(EDGE,viewportRight-panelWidth-EDGE));
  const spaceAbove=rect.top-EDGE-10,spaceBelow=innerHeight-EDGE-rect.bottom-10;
  let top;
  if(spaceAbove>=panelHeight)top=rect.top-panelHeight-10;
  else if(spaceBelow>=panelHeight)top=rect.bottom+10;
  else if(spaceBelow>=spaceAbove)top=rect.bottom+10;
  else top=EDGE;
  panel.style.left=(left-rect.left)+"px";
  panel.style.top=(clamp(top,EDGE,Math.max(EDGE,innerHeight-panelHeight-EDGE))-rect.top)+"px";
 }
 function move(left,top){
  x=clamp(left,EDGE,Math.max(EDGE,innerWidth-SIZE-EDGE));
  y=clamp(top,EDGE,Math.max(EDGE,innerHeight-SIZE-EDGE));
  root.style.left=x+"px";root.style.top=y+"px";placePanel();
 }
 move(x,y);
 let press=null,suppressClick=false;
 button.addEventListener("pointerdown",event=>{button.classList.remove("dismiss-focus");
  if(event.pointerType==="mouse"&&event.button!==0)return;
  press={id:event.pointerId,px:event.clientX,py:event.clientY,x,y,moved:false};
  button.setPointerCapture(event.pointerId);
 });
 button.addEventListener("pointermove",event=>{
  if(!press||event.pointerId!==press.id)return;
  const dx=event.clientX-press.px,dy=event.clientY-press.py;
  if(Math.hypot(dx,dy)>6)press.moved=true;
  if(press.moved)move(press.x+dx,press.y+dy);
 });
 button.addEventListener("pointerup",event=>{
  if(!press||event.pointerId!==press.id)return;
  if(press.moved){
   suppressClick=true;
   try{sessionStorage.setItem(POSITION_KEY,JSON.stringify({x,y}))}catch{}
  }
  press=null;
  if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
 });
 button.addEventListener("pointercancel",()=>{press=null});
 function setOpen(open){
  button.setAttribute("aria-expanded",String(open));
  if(open){panel.classList.remove("is-closing");panel.hidden=false;backdrop.hidden=false;placePanel();return}
  panel.classList.add("is-closing");backdrop.hidden=true;
  const finish=()=>{panel.hidden=true;panel.classList.remove("is-closing")};
  panel.addEventListener("animationend",finish,{once:true});
  setTimeout(finish,180);
 }
 root.resetWidgetState=()=>{try{sessionStorage.removeItem(POSITION_KEY);sessionStorage.removeItem(SECTIONS_KEY)}catch{return false}move(innerWidth-SIZE-16,innerHeight-SIZE-16);for(const section of sections.values())section.open=true;return true};
 closeButton.addEventListener("click",()=>setOpen(false));
 backdrop.addEventListener("click",()=>setOpen(false));
 let touchStart=null;
 panel.addEventListener("touchstart",e=>{touchStart=e.touches[0]?.clientY??null},{passive:true});
 panel.addEventListener("touchend",e=>{if(touchStart===null)return;const delta=(e.changedTouches[0]?.clientY??touchStart)-touchStart;if(delta>90&&panel.scrollTop===0)setOpen(false);touchStart=null},{passive:true});
 button.addEventListener("click",event=>{
  if(event.detail!==0&&suppressClick){suppressClick=false;return}
  suppressClick=false;
  setOpen(panel.hidden);
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!panel.hidden){
   event.preventDefault();event.stopPropagation();
   setOpen(false);button.classList.add("dismiss-focus");button.focus({preventScroll:true});
  }
 });
 window.addEventListener("resize",()=>move(x,y));
 return root;
}
