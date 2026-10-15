// Reusable local-only Debug Settings. Loaded only by the loopback DEV server.
const POSITION_KEY = "football-architect:dev-debug-widget-position";
const EDGE = 8, SIZE = 48;
const clamp = (value,min,max) => Math.max(min,Math.min(value,max));
function element(tag,className,text) {
 const node = document.createElement(tag);
 node.className = className;
 if(text)node.textContent = text;
 return node;
}
export function createDebugWidget({controls=[]}={}) {
 if(!Array.isArray(controls)||!controls.length)return null;
 const style=element("style");
 style.textContent=[
  ".fa-dev-widget{position:fixed;width:48px;height:48px;z-index:2147483000}",
  ".fa-dev-widget *{box-sizing:border-box}",
  ".fa-dev-widget-button{width:48px;height:48px;border:1px solid #498a7c;border-radius:50%;",
  "background:#184d46;color:#fff;font-size:23px;cursor:grab;touch-action:none;user-select:none;",
  "box-shadow:0 5px 20px #0005}",
  ".fa-dev-widget-button:active{cursor:grabbing}",
  ".fa-dev-widget-button:focus-visible,.fa-dev-widget-panel input:focus-visible{outline:2px solid #8ee5c5;outline-offset:3px}",
  ".fa-dev-widget-panel{position:absolute;width:240px;padding:13px;border:1px solid #568378;",
  "border-radius:12px;background:#17302f;color:#f3f8f5;box-shadow:0 8px 32px #0008;",
  "font:14px/1.4 system-ui,sans-serif;max-height:65vh;overflow:auto}",
  ".fa-dev-widget-title{font-weight:700;margin:0 0 12px}",
  ".fa-dev-widget-option{display:flex;align-items:center;justify-content:space-between;gap:12px}",
  ".fa-dev-widget-option input{accent-color:#47b58d;width:20px;height:20px;flex-shrink:0}"
 ].join("");
 const root=element("div","fa-dev-widget");
 const button=element("button","fa-dev-widget-button","⚙");
 button.type="button";
 button.setAttribute("aria-label","Debug Settings");
 button.setAttribute("aria-expanded","false");
 const panel=element("section","fa-dev-widget-panel");
 panel.id="fa-dev-widget-panel";
 panel.setAttribute("aria-label","Debug Settings");
 panel.hidden=true;
 button.setAttribute("aria-controls",panel.id);
 panel.append(element("h2","fa-dev-widget-title","Debug Settings"));
 for(const control of controls){
  if(control.type!=="switch"||!control.id||!control.label||
     typeof control.onChange!=="function")throw Error("Invalid DEV control");
  const row=element("label","fa-dev-widget-option");
  row.append(element("span","",control.label));
  const input=element("input");
  input.type="checkbox";
  input.setAttribute("role","switch");
  input.dataset.devControl=control.id;
  input.checked=typeof control.checked==="function"?
   !!control.checked():!!control.checked;
  input.addEventListener("change",()=>{
   if(control.onChange(input.checked)===false)input.checked=!input.checked;
  });
  row.append(input);
  panel.append(row);
 }
 root.append(button,panel);
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
  const rect=root.getBoundingClientRect();
  panel.style.left=(clamp(rect.left,EDGE,Math.max(EDGE,innerWidth-240-EDGE))-rect.left)+"px";
  const above=rect.top-panel.offsetHeight-10;
  const top=above>=EDGE?above:Math.min(rect.bottom+10,innerHeight-panel.offsetHeight-EDGE);
  panel.style.top=(top-rect.top)+"px";
 }
 function move(left,top){
  x=clamp(left,EDGE,Math.max(EDGE,innerWidth-SIZE-EDGE));
  y=clamp(top,EDGE,Math.max(EDGE,innerHeight-SIZE-EDGE));
  root.style.left=x+"px";root.style.top=y+"px";placePanel();
 }
 move(x,y);
 let press=null,suppressClick=false;
 button.addEventListener("pointerdown",event=>{
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
 button.addEventListener("click",event=>{
  if(event.detail!==0&&suppressClick){suppressClick=false;return}
  suppressClick=false;
  panel.hidden=!panel.hidden;
  button.setAttribute("aria-expanded",String(!panel.hidden));
  placePanel();
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!panel.hidden){
   panel.hidden=true;button.setAttribute("aria-expanded","false");button.focus();
  }
 });
 window.addEventListener("resize",()=>move(x,y));
 return root;
}
