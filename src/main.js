import {LEAGUES,getLeagueClubs} from './leagues.js';
import {createSession,advanceSession} from './simulation.js';
import {openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport,readLegacyMinimal,hasImportedLegacy} from './career-store.js';
import {layout,homePage,managerPage,teamsPage,clubList,careersPage,settingsPage,simulationPage,tr,esc} from './ui-pages.js';

const app=document.getElementById('app');
const ROUTES=new Set(['/','/new-career','/new-career/team','/careers','/settings','/simulation']);
let db=null,catalog={rows:[],activeId:null},loaded=null,lang='it';
let draft={managerName:'',countryId:'IT',clubId:null,query:''};
let timer=null,busy=false,sequence=0,notice='';
const locale=()=>lang;
try{lang=localStorage.getItem('football-architect:minimal:lang')==='en'?'en':'it';}catch{}
const path=()=>ROUTES.has(location.pathname)?location.pathname:'/';
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function navigate(url){stop();notice='';history.pushState({},'',url);void render();}
function fail(error){stop();notice=tr(lang,'Operazione non completata: ','Operation failed: ')+(error?.message??String(error));void render();}
async function refreshCatalog(){catalog=await readCatalog(db);return catalog;}
async function render(){
 const ticket=++sequence;
 if(!db){app.innerHTML=layout(`<section class="heading"><h1>${tr(lang,'Impossibile aprire i salvataggi','Cannot open save storage')}</h1><p>${tr(lang,'IndexedDB non disponibile: i salvataggi non verranno sostituiti o cancellati.','IndexedDB is unavailable: existing saves will not be changed or deleted.')}</p></section>` ,lang,notice);return;}
 let page=path();
 try{
  if(page!=='/simulation')await refreshCatalog();
  if(ticket!==sequence)return;
  if(page==='/new-career/team'&&!draft.managerName.trim()){history.replaceState({},'','/new-career');page='/new-career';}
  if(page==='/simulation'&&!loaded){
   await refreshCatalog();
   const candidate=bestCareer(catalog);
   if(candidate){loaded=await selectCareer(db,candidate.id);}
   else {history.replaceState({},'','/');page='/';}
  }
  if(ticket!==sequence)return;
  let inner;
  if(page==='/new-career')inner=managerPage(draft,lang);
  else if(page==='/new-career/team')inner=teamsPage(draft,lang);
  else if(page==='/careers')inner=careersPage(catalog,lang,Boolean(readLegacyMinimal(localStorage))&&!hasImportedLegacy(catalog));
  else if(page==='/settings')inner=settingsPage(lang);
  else if(page==='/simulation'&&loaded)inner=simulationPage(loaded.meta,loaded.state,lang,timer!==null);
  else inner=homePage(catalog,lang);
  app.innerHTML=layout(inner,lang,notice);
  document.documentElement.lang=lang;
  document.title=tr(lang,'Football Architect','Football Architect');
 }catch(e){
  if(ticket!==sequence)return;
  stop();
  app.innerHTML=layout(`<section class="heading"><h1>${tr(lang,'Errore di caricamento','Loading error')}</h1><p>${esc(e.message)}</p>
  <button class="btn secondary" data-action="home">${tr(lang,'Torna al menu','Back to menu')}</button></section>`,lang);
 }
}
async function advance(days){
 if(busy||!loaded)return;
 busy=true;
 const current=loaded;
 try{
  const next=advanceSession(current.state,days);
  const saved=await saveCareer(db,current.meta.id,next,{expectedDays:current.state.daysElapsed});
  if(loaded?.meta.id===current.meta.id){loaded=saved;await render();}
 }catch(e){fail(e);}finally{busy=false;}
}
async function begin(){
 if(!draft.managerName.trim()||draft.managerName.trim().length>80||!LEAGUES.some(l=>l.id===draft.countryId)||!getLeagueClubs(draft.countryId).some(c=>c.id===draft.clubId))return;
 const current=await createCareer(db,{managerName:draft.managerName,countryId:draft.countryId,clubId:draft.clubId});
 loaded=current;
 draft={managerName:'',countryId:'IT',clubId:null,query:''};
 navigate('/simulation');
}
async function load(id){stop();loaded=await selectCareer(db,id);navigate('/simulation');}
function download(name,object){
 const data=new Blob([JSON.stringify(object,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(data),link=document.createElement('a');
 link.href=href;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
async function handle(action,element){
 switch(action){
  case 'home':navigate('/');break;
  case 'new':draft={managerName:'',countryId:'IT',clubId:null,query:''};navigate('/new-career');break;
  case 'careers':navigate('/careers');break;
  case 'settings':navigate('/settings');break;
  case 'cancel-setup':draft={managerName:'',countryId:'IT',clubId:null,query:''};navigate('/');break;
  case 'setup-back':navigate('/new-career');break;
  case 'country':draft.countryId=element.dataset.country;draft.clubId=null;draft.query='';await render();break;
  case 'select':draft.clubId=Number(element.dataset.id);await render();break;
  case 'start-career':await begin();break;
  case 'continue':{
   await refreshCatalog();
   const last=bestCareer(catalog);if(last)await load(last.id);
   break;
  }
  case 'load':await load(element.dataset.id);break;
  case 'rename':{
   const entry=catalog.rows.find(r=>r.id===element.dataset.id&&r.status==='ok');
   if(!entry)return;
   const name=prompt(tr(lang,'Nome carriera','Career name'),entry.meta.careerName??entry.meta.managerName);
   if(name===null)return;
   const trimmed=name.trim();
   if(!trimmed||trimmed.length>80){notice=tr(lang,'Nome non valido','Invalid name');await render();return;}
   const meta=await renameCareer(db,entry.id,trimmed);
   if(loaded?.meta.id===entry.id)loaded={...loaded,meta};
   await render();break;
  }
  case 'export':{
   const snapshot=await exportCareer(db,element.dataset.id);
   download('football-architect-'+element.dataset.id+'.json',snapshot);
   break;
  }
  case 'delete':{
   const id=element.dataset.id,entry=catalog.rows.find(r=>r.id===id);
   if(!entry)return;
   if(!confirm(tr(lang,'Eliminare definitivamente questa carriera?','Permanently delete this career?')))return;
   await deleteCareer(db,id);
   if(loaded?.meta.id===id){stop();loaded=null;}
   await render();break;
  }
  case 'import':document.getElementById('import-file')?.click();break;
  case 'legacy':{
   await refreshCatalog();
   if(hasImportedLegacy(catalog))return;
   const s=readLegacyMinimal(localStorage);if(!s)return;
   const name=prompt(tr(lang,'Nome allenatore per la simulazione precedente','Manager name for previous simulation'),'');
   if(name===null)return;
   if(!name.trim()||name.trim().length>80){notice=tr(lang,'Nome non valido','Invalid name');await render();return;}
   await createCareer(db,{managerName:name.trim(),countryId:s.countryId,clubId:s.clubId,session:s,source:'minimal-v1'});
   notice=tr(lang,'Simulazione precedente importata. I dati originali rimangono intatti.','Previous simulation imported. Original data remains untouched.');
   await render();break;
  }
  case 'day':stop();await advance(1);break;
  case 'week':stop();await advance(7);break;
  case 'month':stop();await advance(30);break;
  case 'year':stop();await advance(365);break;
  case 'toggle':{
   if(timer!==null)stop();
   else timer=setInterval(()=>{if(!busy)void advance(1);},500);
   await render();break;
  }
 }
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el||!app.contains(el))return;
 if(el.dataset.action==='home')event.preventDefault();
 if(busy)return;
 void handle(el.dataset.action,el).catch(fail);
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='manager-form')return;
 event.preventDefault();
 const field=event.target.elements.namedItem('managerName');
 const name=String(field?.value??'').trim();
 if(!name||name.length>80){field?.focus();return;}
 draft.managerName=name;navigate('/new-career/team');
});
document.addEventListener('input',event=>{
 if(event.target.id!=='search')return;
 draft.query=event.target.value;
 const list=document.getElementById('clubs');if(list)list.innerHTML=clubList(draft,lang);
});
document.addEventListener('change',event=>{
 if(event.target.id==='language'){
  lang=event.target.value==='en'?'en':'it';
  try{localStorage.setItem('football-architect:minimal:lang',lang);}catch{}
  void render();
 }
 if(event.target.id==='import-file')void (async()=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>2_000_000)throw Error('IMPORT_TOO_LARGE');
  const data=parseCareerImport(await file.text());
  await createCareer(db,data);
  notice=tr(lang,'Carriera importata','Career imported');
  await render();
 })().catch(fail);
});
window.addEventListener('popstate',()=>{stop();void render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer!==null){stop();void render();}});
async function boot(){
 try{db=await openCareerDatabase();await render();}
 catch(e){notice=e.message;await render();}
}
void boot();
