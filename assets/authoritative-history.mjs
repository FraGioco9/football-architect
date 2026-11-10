// Public History consumes only independently verified, closed-season sporting projections.
// It never reads Admin routes or infers a champion from an active season.
import {validateAuthoritativeSeason,adaptAuthoritativeSeason} from './authoritative-season.mjs';

const metricKeys=['historyBestAttack','historyBestDefence','historyMostSeasonWins','historyMostSeasonPoints','historyBestGoalDifference','historyLargestTitleMargin'];
const clubKey=club=>club.countryId+'-'+club.clubId;
const positive=(n,key)=>key==='historyBestGoalDifference'&&n>0?'+'+n:String(n);

export function historyViewModel(context){
 const data=context?.seasonData,history=data?.history;
 if(data?.provenance?.kind!=='authoritative'||(data.seasonState?.phase??data.world?.phase)!=='closed'||data.season!==context.selectedSeason||history?.season!==context.selectedSeason||
    !/^[a-f0-9]{64}$/.test(history?.archiveHash||'')||!Number.isSafeInteger(history.closedAt)||history.closedAt<=0)return null;
 const table=data.statistics?.standings,clubs=new Map((data.participants||[]).map(c=>[clubKey(c),c]));
 const champion=clubs.get(history.championClubId);
 if(!champion||!Array.isArray(table)||!table.length)return null;
 // Domestic records are based on the final 30-match league standings. For
 // international cups, league standings alone omit the verified knockout games:
 // use sealed competition-wide team totals for goals and wins, retaining the
 // actual league-phase points for the points record.
 const international=context.definition.category==='international';
 const tableByClub=new Map(table.map(row=>[clubKey(row.club),row]));
 const cupTeams=data.statistics?.teams;
 if(international&&!Array.isArray(cupTeams))return null;
 const totals=international?cupTeams.map(t=>({
  club:clubs.get(t.clubKey),won:t.w,gf:t.gf,ga:t.ga,gd:t.gd,
  pts:tableByClub.get(t.clubKey)?.pts
 })):table;
 if(international&&(totals.length!==clubs.size||totals.some(t=>!t.club||!Number.isSafeInteger(t.won)||!Number.isSafeInteger(t.gf)||!Number.isSafeInteger(t.ga)||!Number.isSafeInteger(t.gd)||!Number.isSafeInteger(t.pts))))return null;
 const record=(field,minimum=false)=>{
  const rows=field==='pts'?table:totals;
  const value=Math[minimum?'min':'max'](...rows.map(r=>r[field]));
  return {value,clubs:rows.filter(r=>r[field]===value).map(r=>r.club)};
 };
 const records={historyBestAttack:record('gf'),historyBestDefence:record('ga',true),historyMostSeasonWins:record('won'),historyMostSeasonPoints:record('pts'),historyBestGoalDifference:record('gd')};
 if(context.definition.category==='domestic'&&table.length>1)records.historyLargestTitleMargin={value:table[0].pts-table[1].pts,clubs:[champion]};
 let podium;
 let semifinalLosers=[];
 if(context.definition.category==='domestic')podium=[table[0]?.club,table[1]?.club,table[2]?.club];
 else{
  const final=data.fixtures?.find(f=>f.phaseId==='final'&&f.homeId&&f.awayId);
  const other=final&&(final.homeId===history.championClubId?final.awayId:final.awayId===history.championClubId?final.homeId:null);
  podium=[champion,other?clubs.get(other):null,null];
  // The two eliminated semifinalists share the archive's third-place cell.
  const semifinalists=new Set(data.fixtures?.filter(f=>f.phaseId==='semifinals').flatMap(f=>[f.homeId,f.awayId]));
  if(semifinalists.size===4&&semifinalists.has(history.championClubId)&&semifinalists.has(other)){
   semifinalists.delete(history.championClubId);
   semifinalists.delete(other);
   const eliminated=[...semifinalists].map(id=>clubs.get(id));
   if(eliminated.every(Boolean))semifinalLosers=eliminated;
  }
 }
 return {season:history.season,champion,podium,semifinalLosers,records,teams:totals.map(r=>({club:r.club,won:r.won,gf:r.gf,pts:r.pts})),players:null,allTime:null};
}

// Every sealed season belongs to the archive: a two-season limit silently
// dropped past champions and corrupted cumulative records beyond Season 2.
export function closedHistorySeasonNumbers(world){
 const last=world?.seasonNumber-(world?.phase==='closed'?0:1);
 if(!Number.isSafeInteger(last)||last<0)return [];
 return Array.from({length:last},(_,i)=>i+1);
}

export function historyAggregate(seasons){
 const records={},ordered=[...seasons].sort((a,b)=>a.season-b.season);
 for(const key of metricKeys){
  const matching=ordered.flatMap(s=>s.records[key]?s.records[key].clubs.map(club=>({club,season:s.season,value:s.records[key].value})):[]);
  if(!matching.length)continue;
  const value=Math[key==='historyBestDefence'?'min':'max'](...matching.map(r=>r.value));
  records[key]={value,entries:matching.filter(r=>r.value===value)};
 }
 const teams=new Map();
 for(const season of ordered){
  const seen=new Set();
  for(const row of season.teams){
   const k=clubKey(row.club);if(seen.has(k))throw Error('Repeated club in closed history');seen.add(k);
   const current=teams.get(k)||{club:row.club,titles:0,podiums:0,won:0,gf:0,pts:0,run:0,last:0,streak:0};
   current.won+=row.won;current.gf+=row.gf;current.pts+=row.pts;
   teams.set(k,current);
  }
  const podium=season.podium.filter(Boolean);
  podium.forEach((club,i)=>{
   const row=teams.get(clubKey(club));if(!row)throw Error('Invalid verified history podium');
   if(i===0){row.titles++;row.run=row.last===season.season-1?row.run+1:1;row.last=season.season;row.streak=Math.max(row.streak,row.run)}
   // International cups do not have a third-place/podium award.
   if(season.podium[2])row.podiums++;
  });
 }
 const allTime={};
 for(const [name,field] of [['historyMostTitles','titles'],['historyMostPodiums','podiums'],['historyLongestTitleStreak','streak'],['historyMostTotalWins','won'],['historyMostTotalGoals','gf'],['historyMostTotalPoints','pts']]){
  const candidates=[...teams.values()].filter(t=>field!=='podiums'||ordered.some(s=>s.podium[2]));
  if(!candidates.length)continue;
  const value=Math.max(...candidates.map(t=>t[field]));
  allTime[name]={value,entries:candidates.filter(t=>t[field]===value).map(t=>({club:t.club}))};
 }
 return {season:records,'all-time':allTime};
}

// The static History shell stays in the DOM from first paint. Only verified
// historical values and archive rows are inserted when public reads complete.
export function mountAuthoritativeHistory(panel,{getContext,manifest,isDev=()=>false,document=globalThis.document,refreshRecords=()=>{},fetchJson=async(path,{signal})=>{
 const response=await fetch(path,{signal,credentials:'omit',cache:'no-store',redirect:'error'});
 if(!response.ok)throw Error('Public historical season unavailable');
 return response.json();
}}){
 const cards=[...panel.querySelectorAll('[data-history-team-records] [data-history-scope="season"]'),
              ...panel.querySelectorAll('[data-history-team-records] [data-history-scope="all-time"]')].map(node=>({node,html:node.innerHTML}));
 const shell=panel.querySelector('[data-history-empty]');
 const archive=shell?.querySelector('.app-view-skeleton-history-archive');
 const initialArchive=archive?.innerHTML||'';
 const error=panel.querySelector('[data-history-error]');
 const make=(tag,text,cls='')=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node};
 const localized=(tag,key,word,cls='')=>{const node=make(tag,word,cls);node.dataset.appI18n=key;return node};
 const identity=club=>{
  const node=make('span',undefined,'app-world-club-identity'),crest=make('span',undefined,'app-world-club-crest-placeholder');
  crest.dataset.clubCrest=clubKey(club);crest.setAttribute('aria-hidden','true');
  const link=make('a',club.primaryName,'app-world-club-name app-world-standing-club-link');
  link.href=window.faRoutesRegistry.buildRoute({kind:'club',country:club.countryId.toLowerCase(),id:club.clubId,view:'overview'});
  node.append(crest,link);return node;
 };
 const seasonLink=season=>{
  const link=make('a',undefined,'app-history-dev-season-link app-world-standing-club-link');
  link.href='/competitions/'+getContext().definition.id.toLowerCase()+'/standings?season='+season;
  const label=make('span',undefined,'app-history-dev-season');
  label.append(localized('span','historySeasonLabel','Season'),document.createTextNode(' '+season));link.append(label);
  link.addEventListener('click',event=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
   event.preventDefault();window.faCompetitionRoute?.set?.({season:String(season),view:'standings'},{focus:true});
   const scroll=document.querySelector('.fa-shell-content-scroll');if(scroll)scroll.scrollTop=0;
   if(document.scrollingElement)document.scrollingElement.scrollTop=0;
  });
  return link;
 };
 let collection=new Map(),generation='',running='',ready='',abort=null,finish=()=>{},counter=0;
 function reset(){
  for(const {node,html} of cards)node.innerHTML=html;
  if(archive){
   archive.innerHTML=initialArchive;
   archive.querySelector('[data-history-archive-empty]')?.setAttribute('hidden','');
  }
  if(shell)shell.hidden=false;
  if(error)error.hidden=true;
  if(panel.dataset)panel.dataset.faHistoryReadState='pending';
  refreshRecords();
 }
 function paint(items){
  reset();
  if(!items.length){
   // A public world snapshot confirms that there is no closed season.
   // Display the static empty-archive message only after this determination.
   archive?.querySelector('[data-history-archive-empty]')?.removeAttribute('hidden');
   if(panel.dataset)panel.dataset.faHistoryReadState='empty';
   refreshRecords();window.faAppRenderLanguage?.();return;
  }
  const aggregated=historyAggregate(items);
  for(const {node} of cards){
   const heading=node.querySelector('h5'),key=heading?.dataset.appI18n;
   const scope=node.dataset.historyScope,record=aggregated[scope]?.[key];
   if(!record)continue;
   node.replaceChildren(heading,make('strong',positive(record.value,key),'app-competition-stat-value'));
   const holders=make('div',undefined,'app-history-record-holders');
   for(const entry of record.entries){
    const line=make('div',undefined,'app-history-dev-record-entry');
    line.append(identity(entry.club));
    if(entry.season)line.append(seasonLink(entry.season));
    holders.append(line);
   }
   node.append(holders);
  }
  if(archive){
   const heading=make('div',undefined,'app-history-dev-archive-head');
   heading.setAttribute('aria-hidden','true');
   for(const [key,word] of [['historySeasonLabel','Season'],['historyChampionLabel','Champion'],['historyRunnerUp','Runner-up'],['historyThirdPlace','Third place']])heading.append(localized('span',key,word));
   const list=make('ol',undefined,'app-history-dev-archive');
   for(const item of [...items].reverse()){
    const row=make('li'),content=make('div',undefined,'app-history-dev-season-button');
    content.append(seasonLink(item.season));
    item.podium.forEach((club,i)=>{
     const holder=make('span',undefined,'app-history-dev-archive-club'+(i===0?' app-history-dev-archive-champion':''));
     holder.append(localized('span',['historyChampionLabel','historyRunnerUp','historyThirdPlace'][i],['Champion','Runner-up','Third place'][i],'app-history-dev-podium-label'));
     if(i===2&&item.semifinalLosers.length){
      const clubs=make('span',undefined,'app-history-dev-archive-clubs');
      clubs.append(...item.semifinalLosers.map(identity));
      holder.append(clubs);
     }else if(club)holder.append(identity(club));
     content.append(holder);
    });
    row.append(content);list.append(row);
   }
   archive.replaceChildren(heading,list);
  }
  if(panel.dataset)panel.dataset.faHistoryReadState='available';
  refreshRecords();window.faAppRenderLanguage?.();
 }
 function stop(){
  counter++;abort?.abort();abort=null;finish();finish=()=>{};running='';
 }
 function settleUnavailable(){
  // The canonical world source is independently unavailable. Render the
  // harmless static empty-record layout rather than leaving a perpetual
  // skeleton, but do not announce zero completed seasons without proof.
  if(isDev()||window.faWorldState?.get?.().source!=='authoritative'||window.faWorldState.get().world)return;
  stop();ready='';generation='';collection.clear();reset();
  window.faHistorySetReady?.(true);
 }
 function render(){
  if(isDev()){stop();ready='';generation='';collection.clear();return;}
  const ctx=getContext(),data=ctx?.seasonData,clock=window.faWorldState?.get?.();
  const world=clock?.source==='authoritative'?clock.world:null,route=window.faCompetitionRoute?.get?.();
  if(route?.view!=='history'){stop();return;}
  if(clock?.worldStatus==='unavailable'&&!world){
   settleUnavailable();
   return;
  }
  if(!ctx?.definition||!Number.isSafeInteger(world?.seasonNumber)){
   // A new season or source invalidates the visible cards immediately, rather
   // than briefly presenting stale records or a false empty archive.
   if(ready||running){stop();ready='';reset();}
   window.faHistorySetReady?.(false);
   return;
  }
  const group=world.generation+':'+ctx.definition.id;
  if(generation!==group){stop();collection.clear();generation=group;ready='';}
  const completed=closedHistorySeasonNumbers(world);
  // Distinct world revisions must cancel obsolete in-flight historical reads.
  const key=group+':'+world.revision+':'+completed.join(',');
  // Current-season data may be null: the canonical clock alone authorizes
  // fetching closed-season projections. Reuse current data only if world-matched.
  const own=data?.provenance?.kind==='authoritative'&&
   data.world?.generation===world.generation&&data.world.revision===world.revision?historyViewModel(ctx):null;
  if(own)collection.set(own.season,own);
  if(ready===key){refreshRecords();window.faHistorySetReady?.(true);return;}
  if(running===key)return;
  stop();
  const missing=completed.filter(n=>!collection.has(n));
  if(!missing.length){
   paint(completed.map(n=>collection.get(n)));ready=key;window.faHistorySetReady?.(true);
   return;
  }
  running=key;const seq=counter,control=new AbortController();abort=control;
  finish=window.faStandingsLoading?.beginView?.('history')||(()=>{});
  window.faHistorySetReady?.(false);
  (async()=>{
   try{
   for(const season of missing){
    const input=await fetchJson('/api/competitions/'+ctx.definition.id+'/seasons/'+season,{signal:control.signal});
    if(seq!==counter||isDev())return;
    if(input?.world?.generation!==world.generation||input.world.seasonNumber!==world.seasonNumber||input.world.revision!==world.revision)throw Error('Stale public historical world');
    const target={...ctx,selectedSeason:season,definition:ctx.currentDefinition||ctx.definition};
    const checked=validateAuthoritativeSeason(input,target,manifest);
    const adapted=adaptAuthoritativeSeason(checked,target,manifest);
    const info=historyViewModel({...target,seasonData:adapted});
    if(!info)throw Error('Unverified completed-season history');
    collection.set(season,info);
   }
   if(seq!==counter||isDev())return;
   paint(completed.map(n=>collection.get(n)));ready=key;
  }catch(e){
   if(seq!==counter||control.signal.aborted)return;
   reset();if(shell)shell.hidden=true;if(error)error.hidden=false;
   if(panel.dataset)panel.dataset.faHistoryReadState='unavailable';
  }finally{
   if(seq===counter){running='';abort=null;const done=finish;finish=()=>{};done();window.faHistorySetReady?.(true)}
  }
  })();
 }
 const unsubscribe=window.faWorldState?.subscribe?.(render)||(()=>{});
 render();
 return Object.freeze({render,settleUnavailable,destroy:()=>{unsubscribe();stop();}});
}
