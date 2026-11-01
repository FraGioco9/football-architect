/* Competition URL state: one season/view/round, restored without reloading. */
(() => {
  "use strict";
  // Match the Settings language combobox interaction and shared CSS classes.
  window.faBindCompetitionMenu=(trigger,menu,options,choose,control,config={})=>{
    let active=0;
    const {search,empty}=config;
    const visible=()=>options.filter(option=>!option.hidden);
    const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(document.documentElement.lang).trim();
    function position(){
      if(!config.fitViewport||menu.hidden)return;
      menu.style.maxHeight='';
      const bounds=trigger.getBoundingClientRect(),viewport=window.visualViewport;
      const top=viewport?.offsetTop||0,bottom=top+(viewport?.height||window.innerHeight),gap=6,edge=8;
      const below=Math.max(0,bottom-bounds.bottom-gap-edge),above=Math.max(0,bounds.top-top-gap-edge);
      const cssLimit=parseFloat(getComputedStyle(menu).maxHeight);
      const desired=Math.min(menu.scrollHeight+menu.offsetHeight-menu.clientHeight,Number.isFinite(cssLimit)?cssLimit:Infinity);
      const placement=desired<=below||below>=above?'below':'above';
      menu.dataset.menuPlacement=placement;
      menu.style.maxHeight=Math.max(0,Math.min(desired,placement==='below'?below:above))+'px';
    }
    function highlight(){
      const choices=visible();active=Math.max(0,Math.min(active,choices.length-1));
      options.forEach(option=>delete option.dataset.active);
      for(const node of [trigger,search].filter(Boolean)){
        if(choices.length)node.setAttribute('aria-activedescendant',choices[active].id);else node.removeAttribute('aria-activedescendant');
      }
      if(choices.length){
        const option=choices[active];option.dataset.active='true';
        if(config.fitViewport){
          const item=option.getBoundingClientRect(),box=menu.getBoundingClientRect();
          if(item.top<box.top+menu.clientTop)menu.scrollTop-=box.top+menu.clientTop-item.top;
          else if(item.bottom>box.top+menu.clientTop+menu.clientHeight)menu.scrollTop+=item.bottom-box.top-menu.clientTop-menu.clientHeight;
        }else option.scrollIntoView?.({block:'nearest'});
      }
    }
    function filter(){
      const query=normalize(search?.value||'');
      options.forEach(option=>option.hidden=!!query&&!normalize(option.textContent+' '+option.dataset.menuValue).includes(query));
      if(empty)empty.hidden=visible().length>0;
      active=0;if(!menu.hidden)highlight();
    }
    function close(focus=false){
      menu.hidden=true;trigger.setAttribute('aria-expanded','false');
      for(const node of [trigger,search].filter(Boolean))node.removeAttribute('aria-activedescendant');
      options.forEach(option=>delete option.dataset.active);
      if(focus)trigger.focus({preventScroll:!!config.fitViewport});
    }
    function open(){
      if(trigger.disabled)return;
      if(search){search.value='';filter();}
      const choices=visible();active=Math.max(0,choices.findIndex(option=>option.dataset.menuValue===trigger.value));
      menu.hidden=false;trigger.setAttribute('aria-expanded','true');(search||trigger).focus({preventScroll:!!config.fitViewport});position();highlight();
    }
    function select(){const option=visible()[active];if(option){choose(option.dataset.menuValue);close(true)}}
    if(config.fitViewport){window.addEventListener('resize',position,{passive:true});window.addEventListener('scroll',position,{passive:true});window.visualViewport?.addEventListener('resize',position,{passive:true});window.visualViewport?.addEventListener('scroll',position,{passive:true});}
    trigger.addEventListener('click',()=>{if(menu.hidden)open();else{close();trigger.blur();}});
    function keydown(event){
      const key=event.key;
      if(['ArrowDown','ArrowUp','Home','End'].includes(key)&&!(event.target===search&&['Home','End'].includes(key))){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();
        const choices=visible();if(!choices.length)return;
        active=key==='Home'?0:key==='End'?choices.length-1:(active+(key==='ArrowDown'?1:-1)+choices.length)%choices.length;
        highlight();
      }else if(key==='Enter'||(key===' '&&event.target!==search)){
        event.preventDefault();if(trigger.disabled)return;if(menu.hidden)open();else select();
      }else if(key==='Escape'&&!menu.hidden){event.preventDefault();close();trigger.blur();search?.blur()}
      else if(key==='Tab')close();
    }
    trigger.addEventListener('keydown',keydown);
    search?.addEventListener('keydown',keydown);search?.addEventListener('input',filter);
    const bound=new WeakSet();
    function bindOptions(){options.forEach(option=>{
      if(bound.has(option))return;bound.add(option);
      option.addEventListener('click',()=>{const index=visible().indexOf(option);if(index>=0){active=index;select()}});
      option.addEventListener('pointermove',()=>{const index=visible().indexOf(option);if(!menu.hidden&&index>=0){active=index;highlight()}});
    })}
    bindOptions();
    document.addEventListener('pointerdown',event=>{
      if(control.contains(event.target))return;
      if(!menu.hidden)close();
      if(document.activeElement===trigger)trigger.blur();
    },true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close();trigger.blur();search?.blur()}});
    return {close,update(next){close();options=next;active=0;bindOptions();if(search){search.value='';filter();}},sync(value){trigger.value=value;options.forEach(option=>option.setAttribute('aria-selected',String(option.dataset.menuValue===value)))}};
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
  const routes=window.faRoutesRegistry;
  const routePath=()=>{
    const path=window.location.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    // Cup roots are a legacy UI entry; the core intentionally accepts explicit cup views only.
    const parsed=routes.parseRoute(path)||routes.parseRoute(path+"/standings");
    if(!parsed||!['competition','cup'].includes(parsed.kind))throw new TypeError('Unknown competition route');
    return parsed;
  };
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
  const tabScrollKey="football-architect:competition-tabs-scroll:"+new URL(window.location.href).pathname.replace(/\/(standings|postseason|fixtures|stats|history|rules|awards|overview|teams)\/?$/,"");
  let restoringTabScroll=true;
  let savedTabScroll=null;
  try{const raw=sessionStorage.getItem(tabScrollKey);if(raw!==null&&Number.isFinite(Number(raw)))savedTabScroll=Math.max(0,Number(raw))}catch{}
  tablist.addEventListener("scroll",()=>{syncTabOverflow();if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}},{passive:true});
  window.addEventListener("pagehide",()=>{if(restoringTabScroll)return;try{sessionStorage.setItem(tabScrollKey,String(tablist.scrollLeft))}catch{}});
  // Keep the selected view visible when viewport size or tab layout changes.
  window.addEventListener("resize",revealSelectedTab);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(revealSelectedTab).observe(tablist);
  // CAL-IMP-04: validated return context; no external or legacy route.
  const rawReturn=new URL(window.location.href).searchParams.get('calendarReturn');
  let calendarReturn=null;
  if(rawReturn){
    try{const u=new URL(rawReturn,window.location.origin),p=u.searchParams;
      if(u.origin===window.location.origin&&u.pathname==='/calendar'&&p.get('season')==='1'&&
        /^(?:[1-9]|[1-4][0-9]|5[0-6])$/.test(p.get('day')||'')&&
        ['season','week'].includes(p.get('calendarView'))&&
        ['all','national','international','sovereign','federation'].includes(p.get('competition'))&&
        (!p.has('division')||/^(it|eng|es|de|fr|pt|nl|br)-[12]$/.test(p.get('division'))))
        calendarReturn=u.pathname+u.search;
    }catch{}
  }
  const returnHost=document.getElementById('app-fixtures-toolbar');
  if(calendarReturn&&returnHost){const a=document.createElement('a');a.href=calendarReturn;a.textContent='← Calendar';returnHost.append(a)}
  let pendingDefaultMatchday=!new URL(window.location.href).searchParams.has("matchday");
  // Seasons 2–4 are isolated DEV previews, never public competition seasons.
  const devSeasons=(document.documentElement.dataset.faDevSeasons||"").split(",").filter(x=>/^[1-9]\d*$/.test(x));
  let availableSeasons=[...new Set(["1",...devSeasons])];
  const initialLimit=Number(document.documentElement.dataset.faDevCurrentSeason);
  if(devSeasons.length&&Number.isInteger(initialLimit)&&initialLimit>=0)
    availableSeasons=availableSeasons.filter(id=>Number(id)<=Math.max(1,initialLimit));
  let latestSeason=availableSeasons.reduce((a,b)=>Number(a)>Number(b)?a:b);
  // Season 1 is a provisional display context, not an official calendar/history.
  const configuredChoices=()=>window.faCompetitionContext&&window.faCompetitionRules?.fixtureChoices(window.faCompetitionContext.definition);
  const validFixtureRound=value=>{const choices=configuredChoices();return choices?choices.some(c=>c.value===value):model.validRound(value)||value==="playoffs"||value==="playout"};
  function read(){
    const params=new URL(window.location.href).searchParams;
    const id=params.get("season"),round=params.get("matchday"),parsed=routePath();
    const explicit=window.location.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"")!==parsed.base?parsed.view:null;
    const requested=/^[1-9]\d{0,8}$/.test(id||"")?id:params.has("season")?"1":latestSeason;
    return {season:devSeasons.length&&!availableSeasons.includes(requested)?"1":requested,
      view:views.includes(explicit)?explicit:views.includes(params.get("view"))?params.get("view"):"standings",
      matchday:validFixtureRound(round)?round:/^[1-9]\d*$/.test(round||"")&&validFixtureRound(Number(round))?Number(round):1};
  }
  function apply(next,{replace=false,focus=false}={}){
    state={...next};
    if(devSeasons.length&&!availableSeasons.includes(state.season))state.season="1";
    const url=new URL(window.location.href);
    const identity=routePath();
    url.pathname=routes.buildRoute({kind:identity.kind,id:identity.base.slice("/competitions/".length),view:state.view});
    url.search="";url.hash="";
    if(state.view==="fixtures"&&calendarReturn)url.searchParams.set("calendarReturn",calendarReturn);
    url.searchParams.set("season",state.season);
    if(state.view==="fixtures")url.searchParams.set("matchday",String(state.matchday));
    if(url.href!==window.location.href)window.history[replace?"replaceState":"pushState"](null,"",url.href);
    const index=views.indexOf(state.view),available=availableSeasons.includes(state.season);
    season.disabled=false;
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
    window.faAppRenderLanguage?.();
    window.faCompetitionContextApi?.selectSeason(Number(state.season));
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
  window.faCompetitionRoute.setPublicSeasonLimit=(limit,{selectLatest=false}={})=>{
    if(devSeasons.length||!Number.isInteger(limit)||limit<0||limit>2)return false;
    availableSeasons=Array.from({length:Math.max(1,limit)},(_,i)=>String(i+1));latestSeason=availableSeasons.at(-1);
    seasonPicker.update(seasonOptions());apply({...state,season:selectLatest?latestSeason:state.season},{replace:true});return true;
  };
  window.faCompetitionRoute.setSeasonLimit=limit=>{
    if(limit!==0&&!devSeasons.includes(String(limit)))return false;
    const inactiveChanged=(document.documentElement.dataset.faDevCurrentSeason==="0")!==(limit===0);
    document.documentElement.dataset.faDevCurrentSeason=String(limit);
    const next=[...new Set(["1",...devSeasons])].filter(id=>Number(id)<=Math.max(1,limit));
    if(!inactiveChanged&&next.length===availableSeasons.length&&next.every(id=>availableSeasons.includes(id)))return true;
    availableSeasons=next;latestSeason=next.reduce((a,b)=>Number(a)>Number(b)?a:b);
    seasonPicker.update(seasonOptions());
    apply({...state,season:availableSeasons.includes(state.season)?state.season:"1"},{replace:true});
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
