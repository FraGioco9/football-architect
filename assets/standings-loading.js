/* Shared competition loading lifecycle; tokens prevent stale requests releasing newer loads. */
(function(root){
  const views=['stats','history','awards'];
  function createStandingsLoading(update,updateView=()=>{}){
    const pending=new Set(['bootstrap']),perView=new Map();
    const sync=()=>update(pending.size>0);
    const set=(source,loading)=>{loading?pending.add(source):pending.delete(source);sync();};
    sync();
    return Object.freeze({set,
      begin(){const token=Symbol('competition request');set(token,true);return ()=>set(token,false);},
      beginView(view){
        if(!views.includes(view))return ()=>{};
        const tokens=perView.get(view)||new Set(),token=Symbol(view);perView.set(view,tokens);tokens.add(token);updateView(view,true);
        return ()=>{if(tokens.delete(token))updateView(view,tokens.size>0);};
      }
    });
  }
  if(typeof module==='object'&&module.exports)module.exports={createStandingsLoading};
  if(root.document){
    let requestsLoading=true;const local={};
    function syncSkeleton(view,loading){
      const panel=root.document.getElementById('competition-panel-'+view);
      if(!panel?.querySelector||!root.document.querySelector)return;
      let current=panel.querySelector('[data-competition-skeleton-root]');
      if(!loading){current?.remove();return;}
      const preview=root.faDebugEnabled!==false&&root.document.documentElement.dataset.faDevSeasons!==undefined;
      const selected=view==='stats'?(panel.querySelector('[data-stats-view][aria-pressed="true"]')?.dataset.statsView||'overview'):null;
      const key=view==='stats'?'stats-'+selected:view==='history'?'history-'+(preview?'preview':'authoritative'):'awards';
      if(current?.dataset.competitionSkeletonRoot!==key){
        const template=root.document.querySelector('template[data-competition-skeleton="'+key+'"]');
        if(template){current?.remove();panel.append(template.content.cloneNode(true));current=panel.querySelector('[data-competition-skeleton-root]');root.faAppRenderLanguage?.();}
      }
      if(view==='history'&&preview&&current?.querySelectorAll){
        const progress=root.faFixturesInitialProgress||{},season=Number(root.document.documentElement.dataset.faDevCurrentSeason||progress.currentSeason||1);
        const day=root.faDevWorldClockSnapshot?.current?.day??progress.day,last=Number(current.dataset.skeletonLastLeagueDay),rounds=Number(current.dataset.skeletonLeagueRounds);
        const completed=Math.max(0,season-1+((last>0&&day>=last)||(!day&&rounds>0&&progress.matchdays>=rounds)?1:0));
        for(const row of current.querySelectorAll('[data-skeleton-archive-row]'))row.hidden=Number(row.dataset.skeletonArchiveRow)>=Math.max(1,completed);
      }
    }
    const render=()=>{
      const state=root.document.documentElement.dataset;
      const loading=requestsLoading||['faDevStandingsPending','faDebugPending','faDevSeasonTransition'].some(key=>state[key]==='true');
      if(state.faStandingsLoading!==String(loading))state.faStandingsLoading=String(loading);
      for(const view of ['standings','fixtures',...views]){
        const busy=loading||Boolean(local[view]);
        root.document.getElementById('competition-panel-'+view)?.setAttribute('aria-busy',String(busy));
        if(views.includes(view))syncSkeleton(view,busy);
      }
    };
    root.faStandingsLoading=createStandingsLoading(loading=>{requestsLoading=loading;render();},(view,loading)=>{
      local[view]=loading;root.document.documentElement.dataset['fa'+view[0].toUpperCase()+view.slice(1)+'Loading']=String(loading);render();
    });
    new root.MutationObserver(render).observe(root.document.documentElement,{attributes:true,
      attributeFilter:['data-fa-dev-standings-pending','data-fa-debug-pending','data-fa-dev-season-transition']});
    const observer=new root.MutationObserver(render);
    for(const view of views){const panel=root.document.getElementById('competition-panel-'+view);if(panel)observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});}
  }
})(typeof window==='undefined'?globalThis:window);
