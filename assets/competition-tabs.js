/* Competition URL state: one season/view/round, restored without reloading. */
(() => {
  "use strict";
  // Match the Settings language combobox interaction and shared CSS classes.
  window.faBindCompetitionMenu=(trigger,menu,options,choose,control)=>{
    let active=0;
    function highlight(){
      options.forEach((option,index)=>option.dataset.active=String(index===active));
      trigger.setAttribute("aria-activedescendant",options[active].id);
      options[active].scrollIntoView?.({block:"nearest"});
    }
    function close(focus=false){
      menu.hidden=true;trigger.setAttribute("aria-expanded","false");
      trigger.removeAttribute("aria-activedescendant");
      options.forEach(option=>delete option.dataset.active);
      if(focus)trigger.focus();
    }
    function open(){
      if(trigger.disabled)return;
      active=Math.max(0,options.findIndex(option=>option.dataset.menuValue===trigger.value));
      menu.hidden=false;trigger.focus();trigger.setAttribute("aria-expanded","true");highlight();
    }
    function select(){choose(options[active].dataset.menuValue);close(true)}
    trigger.addEventListener("click",()=>menu.hidden?open():close());
    trigger.addEventListener("keydown",event=>{
      const key=event.key;
      if(["ArrowDown","ArrowUp","Home","End"].includes(key)){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();
        active=key==="Home"?0:key==="End"?options.length-1:
          (active+(key==="ArrowDown"?1:-1)+options.length)%options.length;
        highlight();
      }else if(key==="Enter"||key===" "){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();else select();
      }else if(key==="Escape"&&!menu.hidden){event.preventDefault();close(true)}
      else if(key==="Tab")close();
    });
    const bound=new WeakSet();
    function bindOptions(){options.forEach(option=>{
      if(bound.has(option))return;bound.add(option);
      option.addEventListener("click",()=>{const index=options.indexOf(option);if(index>=0){active=index;select()}});
      option.addEventListener("pointermove",()=>{const index=options.indexOf(option);if(!menu.hidden&&index>=0){active=index;highlight()}});
    })}
    bindOptions();
    document.addEventListener("pointerdown",event=>{
      if(control.contains(event.target))return;
      if(!menu.hidden)close();
      if(document.activeElement===trigger)trigger.blur();
    },true);
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!menu.hidden)close(true)});
    return {close,update(next){close();options=next;active=0;bindOptions()},sync(value){trigger.value=value;options.forEach(option=>option.setAttribute("aria-selected",String(option.dataset.menuValue===value)))}};
  };
  const tablist=document.querySelector(".app-competition-tabs");
  if(!tablist)return;
  const model=window.faCompetitionModel;
  const views=model.views.map(view=>view.id);
  const tabs=[...tablist.querySelectorAll('[role="tab"]')];
  // Safari may briefly restore touch focus to the active tab when a modal closes.
  for(const tab of tabs)if(tab.style)tab.style.webkitTapHighlightColor="transparent";
  const panels=tabs.map(tab=>document.getElementById(tab.getAttribute("aria-controls")));
  const season=document.getElementById("app-competition-season");
  const seasonMenu=document.getElementById("app-competition-season-menu");
  const seasonValue=document.getElementById("app-competition-season-value");
  const unavailable=document.getElementById("app-competition-season-unavailable");
  if(tabs.length!==views.length||panels.some(panel=>!panel)||!season||!unavailable||!seasonMenu||!seasonValue)return;
  const listeners=new Set();let state;
  function syncTabOverflow(){
    const maximum=Math.max(0,tablist.scrollWidth-tablist.clientWidth);
    tablist.dataset.canScrollLeft=String(maximum>1&&tablist.scrollLeft>1);
    tablist.dataset.canScrollRight=String(maximum>1&&tablist.scrollLeft<maximum-1);
  }
  function revealSelectedTab(){
    const tab=tabs[views.indexOf(state?.view||"standings")];
    const bounds=tablist.getBoundingClientRect(),rect=tab.getBoundingClientRect();
    if(rect.left<bounds.left+16)tablist.scrollLeft+=rect.left-bounds.left-16;
    else if(rect.right>bounds.right-16)tablist.scrollLeft+=rect.right-bounds.right+16;
    syncTabOverflow();
  }
  const tabScrollKey="football-architect:competition-tabs-scroll:"+new URL(window.location.href).pathname;
  let restoringTabScroll=true;
  let savedTabScroll=null;
  try{const raw=sessionStorage.getItem(tabScrollKey);if(raw!==null&&Number.isFinite(Number(raw)))savedTabScroll=Math.max(0,Number(raw))}catch{}
  tablist.addEventListener("scroll",()=>{syncTabOverflow();if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}},{passive:true});
  window.addEventListener("pagehide",()=>{if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}});
  // Keep the selected view visible when viewport size or tab layout changes.
  window.addEventListener("resize",revealSelectedTab);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(revealSelectedTab).observe(tablist);
  let pendingDefaultMatchday=!new URL(window.location.href).searchParams.has("matchday");
  // Seasons 2–4 are isolated DEV previews, never public competition seasons.
  const devSeasons=(document.documentElement.dataset.faDevSeasons||"").split(",").filter(x=>/^[1-9]\d*$/.test(x));
  let availableSeasons=[...new Set(["1",...devSeasons])];
  const initialLimit=Number(document.documentElement.dataset.faDevCurrentSeason);
  if(devSeasons.length&&Number.isInteger(initialLimit)&&initialLimit>=1)
    availableSeasons=availableSeasons.filter(id=>Number(id)<=initialLimit);
  let latestSeason=availableSeasons.reduce((a,b)=>Number(a)>Number(b)?a:b);
  // Season 1 is a provisional display context, not an official calendar/history.
  const validFixtureRound=value=>model.validRound(value)||value==="playoffs"||value==="playout";
  function read(){
    const params=new URL(window.location.href).searchParams;
    const id=params.get("season"),round=params.get("matchday");
    const requested=/^[1-9]\d{0,8}$/.test(id||"")?id:latestSeason;
    return {season:devSeasons.length&&!availableSeasons.includes(requested)?latestSeason:requested,
      view:views.includes(params.get("view"))?params.get("view"):"standings",
      matchday:round==="playoffs"||round==="playout"?round:/^[1-9]\d*$/.test(round||"")&&model.validRound(Number(round))?Number(round):1};
  }
  function apply(next,{replace=false,focus=false}={}){
    state={...next};
    if(devSeasons.length&&!availableSeasons.includes(state.season))state.season=latestSeason;
    const url=new URL(window.location.href);
    url.pathname=url.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    url.search="";url.hash="";
    url.searchParams.set("season",state.season);url.searchParams.set("view",state.view);
    if(state.view==="fixtures")url.searchParams.set("matchday",String(state.matchday));
    if(url.href!==window.location.href)window.history[replace?"replaceState":"pushState"](null,"",url.href);
    const index=views.indexOf(state.view),available=availableSeasons.includes(state.season);
    document.documentElement.dataset.competitionView=state.view;
    document.documentElement.dataset.competitionSeasonUnavailable=String(!available);
    seasonPicker.sync(available?state.season:"");seasonPicker.close();unavailable.hidden=available;
    seasonValue.textContent=available?state.season:unavailable.textContent;
    if(available)seasonValue.removeAttribute("data-app-i18n");
    else seasonValue.setAttribute("data-app-i18n","competitionSeasonUnavailable");
    for(let i=0;i<tabs.length;i++){
      const active=i===index;
      tabs[i].setAttribute("aria-selected",String(active));tabs[i].tabIndex=active?0:-1;
      tabs[i].classList.toggle("is-active",active);panels[i].hidden=!active||!available;
    }
    if(focus)tabs[index].focus({preventScroll:true});
    if(focus||!restoringTabScroll)revealSelectedTab();
    for(const listener of listeners)listener({...state});
    // Notify DEV enhancements even when they initialize before this router.
    window.dispatchEvent(new CustomEvent("fa:competition-route-change",{detail:{...state}}));
  }
  function set(patch,options){
    if(Object.hasOwn(patch,"matchday"))pendingDefaultMatchday=false;
    const next={...state,...patch};
    if(!views.includes(next.view)||!/^[1-9]\d{0,8}$/.test(next.season)||
      !validFixtureRound(next.matchday))return;
    apply(next,options);
  }
  window.faCompetitionRoute={get:()=>({...state}),set,
    defaultMatchday(round){
      if(!pendingDefaultMatchday||state.view!=="fixtures"||!(availableSeasons.includes(state.season)))return;
      pendingDefaultMatchday=false;
      if(validFixtureRound(round))apply({...state,matchday:round},{replace:true});
    },
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
  // Rebuild the available options when DEV progress changes, retaining one binding.
  function seasonOptions(){
    for(const option of seasonMenu.querySelectorAll("[data-menu-value]"))
      if(!availableSeasons.includes(option.dataset.menuValue))option.remove();
    for(const value of availableSeasons.filter(value=>!seasonMenu.querySelector(`[data-menu-value="${value}"]`))){
      const option=document.createElement("div");
      option.id="app-competition-season-option-"+value;option.className="language-option";
      option.setAttribute("role","option");option.dataset.menuValue=value;
      option.setAttribute("aria-selected","false");option.textContent=value;seasonMenu.append(option);
    }
    const options=[...seasonMenu.querySelectorAll("[data-menu-value]")]
      .sort((a,b)=>Number(b.dataset.menuValue)-Number(a.dataset.menuValue));
    options.forEach(option=>seasonMenu.append(option));return options;
  }
  const seasonPicker=window.faBindCompetitionMenu(season,seasonMenu,seasonOptions(),value=>set({season:value}),
    document.getElementById("app-competition-season-control"));
  window.faCompetitionRoute.setSeasonLimit=limit=>{
    if(!devSeasons.includes(String(limit)))return false;
    const next=[...new Set(["1",...devSeasons])].filter(id=>Number(id)<=limit);
    if(next.length===availableSeasons.length&&next.every(id=>availableSeasons.includes(id)))return true;
    availableSeasons=next;latestSeason=next.reduce((a,b)=>Number(a)>Number(b)?a:b);
    seasonPicker.update(seasonOptions());
    apply({...state,season:availableSeasons.includes(state.season)?state.season:latestSeason},{replace:true});
    return true;
  };
  window.addEventListener("popstate",()=>{
    pendingDefaultMatchday=false;
    apply(read(),{replace:true});
  });
  apply(read(),{replace:true});
  const restoreTabScroll=()=>{
    if(savedTabScroll!==null)tablist.scrollLeft=Math.min(savedTabScroll,Math.max(0,tablist.scrollWidth-tablist.clientWidth));
    syncTabOverflow();
  };
  const scheduleFrame=typeof window.requestAnimationFrame==="function"?window.requestAnimationFrame.bind(window):callback=>callback();
  restoreTabScroll();
  scheduleFrame(()=>{
    restoreTabScroll();
    scheduleFrame(()=>{
      restoreTabScroll();
      restoringTabScroll=false;
      // Keep the route-selected tab visible after restoring the previous strip offset.
      revealSelectedTab();
      if(document.documentElement.dataset.faDevSeasons)document.documentElement.dataset.faTabsRestored="true";
    });
  });
})();
