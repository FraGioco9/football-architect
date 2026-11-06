/* Shared competition loading lifecycle; tokens prevent stale requests releasing newer loads. */
(function(root){
  const views=['stats','history','awards'];
  // Only a verified empty result for the selected season/revision may hide a skeleton.
  function confirmedEmpty(panel,context,route){
    return !!panel&&!!context&&panel.dataset.faContentState==='empty'&&
      panel.dataset.faContentSeason===String(context.selectedSeason)&&
      panel.dataset.faContentRevision===String(context.revision??'')&&
      (!route?.season||String(route.season)===String(context.selectedSeason));
  }
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
  if(typeof module==='object'&&module.exports)module.exports={createStandingsLoading,confirmedEmpty};
  if(root.document){
    let requestsLoading=true;const local={};
    function syncSkeleton(view,loading){
      const panel=root.document.getElementById('competition-panel-'+view);
      if(!panel?.querySelector||!root.document.querySelector)return;
      let current=panel.querySelector('[data-competition-skeleton-root]');
      if(!loading||confirmedEmpty(panel,root.faCompetitionContext,root.faCompetitionRoute?.get?.())){current?.remove();return;}
      const preview=root.faDebugEnabled!==false&&root.document.documentElement.dataset.faDevSeasons!==undefined;
      const season=Number((preview?root.document.documentElement.dataset.faDevCurrentSeason:undefined)??root.faFixturesInitialProgress?.currentSeason??1);
      if(view==='history'&&preview&&season===0){
        current?.remove();
        panel.querySelector('[data-history-empty]')?.removeAttribute('hidden');
        return;
      }
      const selected=view==='stats'?(panel.querySelector('[data-stats-view][aria-pressed="true"]')?.dataset.statsView||'overview'):null;
      const key=view==='stats'?'stats-'+selected:view==='history'?'history-preview':'awards';
      if(current?.dataset.competitionSkeletonRoot!==key){
        const template=root.document.querySelector('template[data-competition-skeleton="'+key+'"]');
        if(template){current?.remove();panel.append(template.content.cloneNode(true));current=panel.querySelector('[data-competition-skeleton-root]');root.faAppRenderLanguage?.();}
      }
      if(view==='history'&&current?.querySelectorAll){
        const progress=root.faFixturesInitialProgress||{},knownSeason=(preview?root.document.documentElement.dataset.faDevCurrentSeason:undefined)??progress.currentSeason,season=Number(knownSeason??1);
        const day=root.faDevWorldClockSnapshot?.current?.day??progress.day,last=Number(current.dataset.skeletonLastLeagueDay),rounds=Number(current.dataset.skeletonLeagueRounds);
        const completed=Math.max(0,season-1+((last>0&&day>=last)||(!day&&rounds>0&&progress.matchdays>=rounds)?1:0));
        const archive=current.querySelector('.app-history-dev-archive');
        if(archive){
          if(completed===0&&knownSeason!==undefined){
            const shell=archive.closest('.app-view-skeleton-history-archive');
            if(shell){
              shell.innerHTML='<p class="app-competition-empty-row" data-app-i18n="competitionHistoryEmpty">No completed seasons available yet.</p>';
              root.faAppRenderLanguage?.();
            }
          }else{
          const needed=knownSeason===undefined?Math.max(4,archive.querySelectorAll('[data-skeleton-archive-row]').length):Math.max(1,completed);
          const sample=archive.querySelector('[data-skeleton-archive-row]');
          // Recreated templates always start with four rows; extend when required.
          // This must run on every loading refresh, not only during first paint.
          while(sample&&archive.querySelectorAll('[data-skeleton-archive-row]').length<needed){
            const row=sample.cloneNode(true);
            row.dataset.skeletonArchiveRow=String(archive.querySelectorAll('[data-skeleton-archive-row]').length);
            archive.append(row);
          }
          for(const row of archive.querySelectorAll('[data-skeleton-archive-row]'))
            row.hidden=Number(row.dataset.skeletonArchiveRow)>=needed;
          }
        }
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
