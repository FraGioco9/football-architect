import {LEAGUES,getLeagueClubs} from './leagues.js';
import {createSession,advanceSession} from './simulation.js';
import {openCareerDatabase,readCatalog,bestCareer,createCareer,selectCareer,saveCareer,renameCareer,deleteCareer,exportCareer,parseCareerImport} from './career-store.js';
import {layout,homePage,managerPage,teamsPage,careersPage,settingsPage,simulationPage,tr,esc} from './ui-pages.js';

const app=document.getElementById('app');
const ROUTES=new Set(['/','/new-career','/new-career/team','/careers','/settings','/simulation']);
let db=null,catalog={rows:[],activeId:null},loaded=null,lang='it';
let draft={managerName:'',countryId:'IT',clubId:1,query:''};
let timer=null,busy=false,sequence=0,notice='',languageMenuOpen=false;
const locale=()=>lang;
try{lang=localStorage.getItem('football-architect:minimal:lang')==='en'?'en':'it';}catch{}
const path=()=>ROUTES.has(location.pathname)?location.pathname:'/';
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function navigate(url){stop();languageMenuOpen=false;notice='';history.pushState({},'',url);void render();}
function fail(error){stop();notice=tr(lang,'Operazione non completata: ','Operation failed: ')+(error?.message??String(error));void render();}
async function refreshCatalog(){catalog=await readCatalog(db);return catalog;}
async function render(){
 const ticket=++sequence;
 if(!db){app.innerHTML=layout(`<section class="heading"><h1>${tr(lang,'Impossibile aprire i salvataggi','Cannot open save storage')}</h1><p>${tr(lang,'IndexedDB non disponibile: i salvataggi non verranno sostituiti o cancellati.','IndexedDB is unavailable: existing saves will not be changed or deleted.')}</p></section>` ,lang,notice,languageMenuOpen);return;}
 let page=path();
 try{
  if(page!=='/simulation')await refreshCatalog();
  if(ticket!==sequence)return;
  if(page==='/new-career/team'){history.replaceState({},'','/new-career');page='/new-career';}
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
  else if(page==='/careers')inner=careersPage(catalog,lang);
  else if(page==='/settings')inner=settingsPage(lang);
  else if(page==='/simulation'&&loaded)inner=simulationPage(loaded.meta,loaded.state,lang,timer!==null);
  else inner=homePage(catalog,lang);
  app.innerHTML=layout(inner,lang,notice,languageMenuOpen);
  document.documentElement.lang=lang;
  document.title=tr(lang,'Football Architect','Football Architect');
 }catch(e){
  if(ticket!==sequence)return;
  stop();
  app.innerHTML=layout(`<section class="heading"><h1>${tr(lang,'Errore di caricamento','Loading error')}</h1><p>${esc(e.message)}</p>
  <button class="btn secondary" data-action="home">${tr(lang,'Torna al menu','Back to menu')}</button></section>`,lang,'',languageMenuOpen);
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
 if(busy||!draft.managerName.trim()||draft.managerName.trim().length>80||!LEAGUES.some(l=>l.id===draft.countryId)||!getLeagueClubs(draft.countryId).some(c=>c.id===draft.clubId))return;
 busy=true;
 try{
  const current=await createCareer(db,{managerName:draft.managerName,countryId:draft.countryId,clubId:draft.clubId});
  loaded=current;
  draft={managerName:'',countryId:'IT',clubId:1,query:''};
  navigate('/simulation');
 }finally{busy=false;}
}
async function load(id){stop();loaded=await selectCareer(db,id);navigate('/simulation');}
function download(name,object){
 const data=new Blob([JSON.stringify(object,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(data),link=document.createElement('a');
 link.href=href;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
async function toggleLanguageMenu(open,focus){
 languageMenuOpen=open;
 await render();
 const combo=app.querySelector('[data-action="language-toggle"]');
 if(focus==='combo')combo?.focus({preventScroll:true});
 if(focus==='option'){
  const options=[...app.querySelectorAll('[data-action="language-option"]')];
  (options.find(o=>o.getAttribute('aria-selected')==='true')??options[0])?.focus({preventScroll:true});
 }
 if(focus==='next'){
  const controls=[...app.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])')];
  controls[controls.indexOf(combo)+1]?.focus({preventScroll:true});
 }
}
async function setLanguage(value){
 if(!['it','en'].includes(value))return;
 lang=value;languageMenuOpen=false;
 try{localStorage.setItem('football-architect:minimal:lang',lang);}catch{}
 await render();
 app.querySelector('[data-action="language-toggle"]')?.focus({preventScroll:true});
}
async function handle(action,element){
 switch(action){
  case 'language-toggle':await toggleLanguageMenu(!languageMenuOpen,'combo');break;
  case 'language-option':await setLanguage(element.dataset.value);break;
  case 'language-focus':await toggleLanguageMenu(true,'option');break;
  case 'home':navigate('/');break;
  case 'new':draft={managerName:'',countryId:'IT',clubId:1,query:''};navigate('/new-career');break;
  case 'careers':navigate('/careers');break;
  case 'settings':navigate('/settings');break;
  case 'cancel-setup':draft={managerName:'',countryId:'IT',clubId:1,query:''};navigate('/');break;
  case 'setup-back':navigate('/new-career');break;
  case 'country':draft.countryId=element.dataset.country;draft.clubId=1;draft.query='';await render();break;
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
 const el=event.target.closest('[data-action]');
 if(languageMenuOpen&&!event.target.closest('[data-language-picker]')){
  languageMenuOpen=false;
  if(!el||!app.contains(el)){void render();return;}
 }
 if(!el||!app.contains(el))return;
 if(el.dataset.action==='home')event.preventDefault();
 if(busy)return;
 void handle(el.dataset.action,el).catch(fail);
});
document.addEventListener('keydown',event=>{
 const combo=event.target.closest?.('[data-action="language-toggle"]');
 if(combo){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();void toggleLanguageMenu(true,'option');return;
  }
  if(event.key==='Escape'&&languageMenuOpen){event.preventDefault();void toggleLanguageMenu(false,'combo');return;}
 }
 const option=event.target.closest?.('[data-action="language-option"]');
 if(!option)return;
 const items=[...app.querySelectorAll('[data-action="language-option"]')],position=items.indexOf(option);
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:(position+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
  items[next]?.focus({preventScroll:true});
 }else if(event.key==='Escape'){
  event.preventDefault();void toggleLanguageMenu(false,'combo');
 }else if(event.key==='Tab'){
  event.preventDefault();void toggleLanguageMenu(false,event.shiftKey?'combo':'next');
 }
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='manager-form')return;
 event.preventDefault();
 const field=event.target.elements.namedItem('managerName');
 const name=String(field?.value??'').trim();
 if(!name||name.length>80){field?.focus();return;}
 draft.managerName=name;void begin().catch(fail);
});
document.addEventListener('input',event=>{
 if(event.target.id==='manager-name')draft.managerName=event.target.value;
});
document.addEventListener('change',event=>{
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
