import './club-fixtures.js';
import {readClubFixtures} from './club-fixtures-source.mjs';
import {createClubPublicReadCache} from './club-public-read-cache.mjs';
import './world-clock-adapter.js';
import './competition-rules-view.js';
import './competition-tabs.js';

export function mountClubFixtures({host,manifest}){
 const ui=window.faClubFixtures,state=window.faWorldState;
 let panel=null,snapshot={coverage:'loading',rows:[],competitions:[]},filter='all',epoch=0,abort=null,lastKey=null,catalogue=null;
 let previewSelection=null;
 const bindings=new Map();
 const route=()=>window.faClubModel.route(location.pathname);
 const selection=()=>ui.resolveSeason({current:state?.get?.().current?.season??null,
  requested:new URLSearchParams(location.search).get('season')});
 const season=()=>selection().season;
 const normalizeLocation=()=>{
  const chosen=selection();
  if(!chosen.confirmed||route()?.view!=='fixtures')return;
  const url=new URL(location.href);
  const resolved=window.faRoutesRegistry.resolveSeasonQuery(url.searchParams,state.get().current?.season);
  if(resolved.remove){
   url.searchParams.delete('season');
   history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
 };

 const lang=()=>document.documentElement.lang;
 const cache=createClubPublicReadCache({getState:()=>state.get(),fetchJson:async(path,{signal}={})=>{
  const response=await fetch(path,{signal,credentials:'omit',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Club Fixtures HTTP '+response.status);return response.json();
 }});
 const tooltip=document.createElement('div');tooltip.id='club-fixture-venue-tooltip';tooltip.className='calendar-marker-tooltip club-fixture-tooltip';tooltip.role='tooltip';tooltip.hidden=true;document.body.append(tooltip);
 let tipTarget=null;
 const hideTip=()=>{tipTarget?.removeAttribute('aria-describedby');tipTarget=null;tooltip.hidden=true;};
 const showTip=node=>{
  if(!node)return;hideTip();tipTarget=node;tooltip.textContent=node.getAttribute('aria-label');tooltip.hidden=false;node.setAttribute('aria-describedby',tooltip.id);
  const r=node.getBoundingClientRect(),width=tooltip.offsetWidth,height=tooltip.offsetHeight;
  tooltip.style.left=Math.max(8,Math.min(innerWidth-width-8,r.left+r.width/2-width/2))+'px';
  const gap=8,edge=8,above=r.top-height-gap,below=r.bottom+gap;
  // Favor the top edge; fall back below when a top placement would clip.
  const top=above>=edge?above:below+height<=innerHeight-edge?below:r.top>=innerHeight-r.bottom?above:below;
  tooltip.style.top=Math.max(edge,Math.min(innerHeight-height-edge,top))+'px';
 };
 const navigate=(key,value)=>{
  const chosen=season();if(chosen===null)return;
  const url=new URL(location.href);
  if(key==='season'){
   const current=Math.max(1,state.get().current?.season??1);
   if(Number(value)===current)url.searchParams.delete('season');
   else url.searchParams.set('season',value);
   filter='all';url.searchParams.delete('competition');
  }else url.searchParams.set(key,value);
  history.pushState(null,'',url.pathname+url.search+url.hash);
  if(key==='competition'){paint();return;}
  previewSelection=null;lastKey=null;normalizeLocation();
  const nextSelection=identity();previewSelection=nextSelection;window.dispatchEvent(new Event('fa:club-fixtures-selection'));refresh();
 };
 function paint(){
  if(route()?.view!=='fixtures')return;
  const {season:chosen,seasons}=selection();
  const params=new URLSearchParams(location.search),displaySeason=chosen;
  const requested=params.get('competition');
  filter=requested&&snapshot.competitions?.some(d=>d.id===requested)?requested:'all';
  const focused=panel?.contains(document.activeElement)?document.activeElement:null;
  const focusControl=focused?.closest('[data-club-fixture-control]')?.dataset.clubFixtureControl;
  const focusRow=focused?.closest('[data-club-fixture-id]')?.dataset.clubFixtureId;
  const focusPart=focused?.matches('[data-club-venue]')?'[data-club-venue]':focused?.matches('.club-fixture-opponent-name')?'.club-fixture-opponent-name':focused?.matches('.club-fixture-meta a')?'.club-fixture-meta a':null;
  const oldCrests=new Map();
  for(const node of panel?.querySelectorAll('[data-club-crest]')||[]){const key=node.dataset.clubCrest;if(!oldCrests.has(key))oldCrests.set(key,[]);oldCrests.get(key).push(node);}
  const staging=document.createElement('div');staging.innerHTML=ui.render({manifest,lang:lang(),season:displaySeason,
   currentSeason:Math.max(1,state?.get?.().current?.season??1),
   explicitSeason:window.faRoutesRegistry.resolveSeasonQuery(params,state?.get?.().current?.season).explicit,
   seasons,filter,snapshot});
  const incoming=staging.firstElementChild;
  for(const crest of incoming.querySelectorAll('[data-club-crest]')){const old=oldCrests.get(crest.dataset.clubCrest)?.shift();if(old)crest.replaceWith(old);}
  hideTip();
  if(!panel){
   panel=incoming;
   panel.addEventListener('pointerover',e=>showTip(e.target.closest('[data-club-venue]')));
   panel.addEventListener('pointerout',e=>{if(!tipTarget?.contains(e.relatedTarget))hideTip();});
   panel.addEventListener('focusin',e=>showTip(e.target.closest('[data-club-venue]')));
   panel.addEventListener('focusout',hideTip);
   panel.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});
   panel.addEventListener('click',e=>{const action=e.target.closest('button[data-club-fixtures-next]');if(action){
    const next=ui.nextFixture({snapshot,season:season(),currentSeason:state?.get?.().current?.season??null});
    if(action.disabled||!next)return;
    if(filter!=='all'&&next.competitionId!==filter){const u=new URL(location.href);u.searchParams.delete('competition');history.pushState(null,'',u.pathname+u.search);paint();}
    const row=panel.querySelector('[data-club-fixture-next]');row?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});row?.focus({preventScroll:true});
   }});
  }else{
   // Keep combobox triggers, handlers and focus stable across source/language reads.
   for(const control of panel.querySelectorAll('[data-club-fixture-control]')){
    const id=control.dataset.clubFixtureControl,next=incoming.querySelector('[data-club-fixture-control="'+id+'"]');
    const menu=control.querySelector('[role=listbox]'),nextMenu=next.querySelector('[role=listbox]');
    menu.replaceChildren(...nextMenu.childNodes);menu.setAttribute('aria-label',nextMenu.getAttribute('aria-label'));
    control.querySelector('[data-club-fixture-value]').replaceChildren(...next.querySelector('[data-club-fixture-value]').childNodes);
    control.querySelector('button').setAttribute('aria-label',next.querySelector('button').getAttribute('aria-label'));
    next.replaceWith(control);
   }
   const focusedNext=panel.querySelector('[data-club-fixtures-next]')===document.activeElement;
   panel.replaceChildren(...incoming.childNodes);
   if(focusedNext)panel.querySelector('[data-club-fixtures-next]').focus({preventScroll:true});
  }
  for(const name of ['aria-label','data-club-fixtures-state','data-club-fixtures-source'])panel.setAttribute(name,incoming.getAttribute(name));
  for(const control of panel.querySelectorAll('[data-club-fixture-control]')){
   const id=control.dataset.clubFixtureControl,trigger=control.querySelector('button'),menu=control.querySelector('[role=listbox]'),options=[...menu.children];
   let binding=bindings.get(id);
   if(!binding){binding=window.faBindCompetitionMenu(trigger,menu,options,value=>navigate(id==='season'?'season':'competition',value),control);bindings.set(id,binding);}
   else binding.update(options);
   binding.sync(String(id==='season'?chosen:filter));
  }
  const mount=host.querySelector(':scope > .club-fixtures');if(mount&&mount!==panel)mount.replaceWith(panel);
  else if(!panel.isConnected)host.append(panel);
  if(focusControl)panel.querySelector('[data-club-fixture-control="'+focusControl+'"] button')?.focus({preventScroll:true});
  else if(focusRow){const row=[...panel.querySelectorAll('[data-club-fixture-id]')].find(n=>n.dataset.clubFixtureId===focusRow);(focusPart?row?.querySelector(focusPart):row)?.focus({preventScroll:true});}
  for(const link of panel.querySelectorAll('a'))if(window.faAppHref)link.href=window.faAppHref(link.getAttribute('href'));

 }
 const identity=()=>{
  const s=state?.get?.(),w=s?.world;
  return JSON.stringify([season(),s?.source,s?.sourceRevision,s?.worldStatus,w?.generation,w?.revision,w?.seasonNumber,w?.day,w?.phase,s?.current?.season,s?.current?.day]);
 };
 function refresh(){
  if(!state)return;
  normalizeLocation();
  const key=identity();
  if(key===lastKey){paint();return;}
  lastKey=key;abort?.abort();abort=new AbortController();const {signal}=abort,seq=++epoch;
  snapshot={coverage:'loading',rows:[],competitions:[]};paint();
  if(route()?.view!=='fixtures'){lastKey=null;return;}
  const current=state.get(),clubKey=route().countryId+'-'+route().clubId,selectedSeason=season();
  const publish=value=>{if(signal.aborted||seq!==epoch||key!==identity())return;snapshot=value;paint();};
  if(current.source==='dev'){
   if(window.faDevPreviewMode!==true||window.faDebugEnabled===false){publish({coverage:'unavailable',rows:[],competitions:[]});return;}
   const value=window.faDevClubFixturesSnapshot;
   if(current.current?.season===0){publish({source:'dev',coverage:'unstarted',rows:[],competitions:[]});return;}
   if(value?.source==='dev'&&value.clubKey===clubKey&&value.season===selectedSeason&&value.currentSeason===current.current?.season&&value.day===current.current?.day&&value.provenance?.kind==='fictional'&&value.provenance.sourceRef==='dev-fictional-preview'&&value.provenance.approved===false&&Array.isArray(value.rows)&&Array.isArray(value.competitions))publish(value);
   else if(window.faDevClubFixturesPublished)publish({coverage:'unavailable',rows:[],competitions:[]});
   return;
  }
  if(!current.world||current.worldStatus!=='ready'){
   if(current.worldStatus==='unavailable')publish({coverage:'unavailable',rows:[],competitions:[]});return;
  }
  void (async()=>{
   try{
    catalogue??=fetch('/competitions/_shared/manifest.json',{credentials:'omit'}).then(async r=>{if(!r.ok)throw Error('Competition catalogue unavailable');return r.json();}).catch(e=>{catalogue=null;throw e;});
    const data=await catalogue;
    const result=await readClubFixtures({clubKey,season:selectedSeason,world:current.world,fetchJson:cache.read,manifest:data,signal});
    publish(result);
   }catch{publish({coverage:'error',rows:[],competitions:[]});}
  })();
 }
 state?.subscribe(refresh);
 for(const name of ['fa:source-change','fa:dev-world-day-change','fa:dev-progress-change'])window.addEventListener(name,()=>{cache.clear();lastKey=null;refresh();});
 window.addEventListener('fa:club-fixtures-preview',()=>{lastKey=null;refresh();});
 window.addEventListener('pagehide',()=>{abort?.abort();epoch++;cache.clear();hideTip();lastKey=null;});
 window.addEventListener('pageshow',()=>refresh());
 // Filter-only Back/Forward keeps the verified season/world identity.
 // Reuse those rows without a loading flash or cancelling an in-flight read.
 // A changed season/source still refreshes via the existing identity fence.
 window.addEventListener('popstate',()=>{
  if(snapshot.coverage==='error')lastKey=null; // Explicit history navigation may retry a failed read.
  refresh();
 });
 const moveTip=()=>{if(tipTarget===document.activeElement)showTip(tipTarget);else hideTip();};
 window.addEventListener('scroll',moveTip,true);window.addEventListener('resize',moveTip);
 return {mount(){
  normalizeLocation();
  // History publishes a snapshot by repainting the club shell. It must not
  // request Fixtures again, or DEV's shared History publication loops forever.
  if(route()?.view!=='fixtures'){previewSelection=null;hideTip();return;}
  const selection=identity();
  if(selection!==previewSelection){previewSelection=selection;window.dispatchEvent(new Event('fa:club-fixtures-selection'));}
  refresh();
 }};
}
