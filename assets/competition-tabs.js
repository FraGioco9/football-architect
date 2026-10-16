/* Competition URL state: one season/view/round, restored without reloading. */
(() => {
  "use strict";
  const tablist=document.querySelector(".app-competition-tabs");
  if(!tablist)return;
  const views=["standings","fixtures","stats","history","rules","awards"];
  const tabs=[...tablist.querySelectorAll('[role="tab"]')];
  const panels=tabs.map(tab=>document.getElementById(tab.getAttribute("aria-controls")));
  const season=document.getElementById("app-competition-season");
  const unavailable=document.getElementById("app-competition-season-unavailable");
  if(tabs.length!==6||panels.some(panel=>!panel)||!season||!unavailable)return;
  const listeners=new Set();let state;
  // Season 1 is a provisional display context, not an official calendar/history.
  function read(){
    const params=new URL(window.location.href).searchParams;
    const id=params.get("season"),round=params.get("matchday");
    return {season:/^[1-9]\d{0,8}$/.test(id||"")?id:"1",
      view:views.includes(params.get("view"))?params.get("view"):"standings",
      matchday:/^(?:[1-9]|[12]\d|30)$/.test(round||"")?Number(round):1};
  }
  function apply(next,{replace=false,focus=false}={}){
    state={...next};
    const url=new URL(window.location.href);
    url.pathname=url.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    url.search="";url.hash="";
    url.searchParams.set("season",state.season);url.searchParams.set("view",state.view);
    if(state.view==="fixtures")url.searchParams.set("matchday",String(state.matchday));
    if(url.href!==window.location.href)window.history[replace?"replaceState":"pushState"](null,"",url.href);
    const index=views.indexOf(state.view),available=state.season==="1";
    document.documentElement.dataset.competitionView=state.view;
    document.documentElement.dataset.competitionSeasonUnavailable=String(!available);
    season.value=available?"1":"";unavailable.hidden=available;
    for(let i=0;i<tabs.length;i++){
      const active=i===index;
      tabs[i].setAttribute("aria-selected",String(active));tabs[i].tabIndex=active?0:-1;
      tabs[i].classList.toggle("is-active",active);panels[i].hidden=!active||!available;
    }
    if(focus){tabs[index].focus();tabs[index].scrollIntoView?.({block:"nearest",inline:"nearest"})}
    for(const listener of listeners)listener({...state});
  }
  function set(patch,options){
    const next={...state,...patch};
    if(!views.includes(next.view)||!/^[1-9]\d{0,8}$/.test(next.season)||
      !Number.isInteger(next.matchday)||next.matchday<1||next.matchday>30)return;
    apply(next,options);
  }
  window.faCompetitionRoute={get:()=>({...state}),set,
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)}};
  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>set({view:views[index]}));
    tab.addEventListener("keydown",event=>{
      let next=index;
      if(event.key==="ArrowRight")next=(index+1)%tabs.length;
      else if(event.key==="ArrowLeft")next=(index-1+tabs.length)%tabs.length;
      else if(event.key==="Home")next=0;
      else if(event.key==="End")next=tabs.length-1;
      else return;
      event.preventDefault();set({view:views[next]},{focus:true});
    });
  });
  season.addEventListener("change",()=>set({season:season.value}));
  window.addEventListener("popstate",()=>apply(read(),{replace:true}));
  apply(read(),{replace:true});
})();
