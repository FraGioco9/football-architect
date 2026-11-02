// Loopback-only fallback Debug launcher for pages without competition/calendar controls.
import {createDebugWidget,registerDebugControls} from './debug-widget.mjs';
import {createDevWorldClock} from './dev-world-clock.mjs';
const start=()=>{
 if(document.querySelector('.fa-dev-widget'))return;
 const clock=createDevWorldClock(sessionStorage,(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail})));
 let widget;
 registerDebugControls('general',[
  {type:'range',id:'season',label:'Season',min:0,max:4,step:1,scope:'general',value:()=>clock.read().season,onChange:n=>clock.setSeason(n)},
  {type:'range',id:'world-day',label:'Day',min:1,max:56,step:1,scope:'general',value:()=>clock.read().day,disabled:()=>clock.read().season===0,onChange:n=>clock.setDay(n)},
  {type:'button',id:'reset-global',label:'Reset',scope:'general',onChange:()=>widget?.resetAllSettings()}
 ]);
 widget=createDebugWidget({page:'general'});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
