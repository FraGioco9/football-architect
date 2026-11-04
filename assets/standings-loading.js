/* Shared standings loading lifecycle; tokens prevent stale requests releasing newer loads. */
(function(root){
  function createStandingsLoading(update){
    const pending=new Set(['bootstrap']);
    const sync=()=>update(pending.size>0);
    const set=(source,loading)=>{loading?pending.add(source):pending.delete(source);sync();};
    sync();
    return Object.freeze({set,begin(){const token=Symbol('standings request');set(token,true);return ()=>set(token,false);}});
  }
  if(typeof module==='object'&&module.exports)module.exports={createStandingsLoading};
  if(root.document){
    let requestsLoading=true;
    const render=()=>{
      const state=root.document.documentElement.dataset;
      const loading=requestsLoading||['faDevStandingsPending','faDebugPending','faDevSeasonTransition'].some(key=>state[key]==='true');
      root.document.documentElement.dataset.faStandingsLoading=String(loading);
      for(const id of ['competition-panel-standings','competition-panel-fixtures'])root.document.getElementById(id)?.setAttribute('aria-busy',String(loading));
    };
    root.faStandingsLoading=createStandingsLoading(loading=>{requestsLoading=loading;render();});
    new root.MutationObserver(render).observe(root.document.documentElement,{attributes:true,
      attributeFilter:['data-fa-dev-standings-pending','data-fa-debug-pending','data-fa-dev-season-transition']});
  }
})(typeof window==='undefined'?globalThis:window);
